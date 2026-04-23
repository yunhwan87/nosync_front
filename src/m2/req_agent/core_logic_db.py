import os
import json
import hashlib
import re
import base64
from datetime import datetime, timezone
from email.message import EmailMessage

import psycopg2
from googleapiclient.discovery import build

from core_logic_ollama import CoreLogicAgent, log_emit, _ollama_chat_stream
from config import (
    DATABASE_URL,
    SCORE_THRESHOLD, TAG_PENALTY_CAP, MAX_DRAFT_ATTEMPTS,
    TEMP_GENERATION, TEMP_EVALUATION,
)


class CoreLogicAgentDB(CoreLogicAgent):
    """
    CoreLogicAgent를 상속받아 파일 I/O를 DB I/O로 오버라이드.
    LLM 로직(generate_initial_draft, evaluate_initial_draft 등)은 부모 그대로 사용.
    """

    def __init__(self, model_name=None, host=None):
        super().__init__(model_name, host)
        self._conn = None

    # =========================================================================
    # SECTION 1: DB Connection
    # =========================================================================

    def _get_conn(self):
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(DATABASE_URL)
            self._conn.autocommit = False
        return self._conn

    def _execute(self, query, params=None, fetch=None):
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
                if fetch == 'one':
                    return cur.fetchone()
                if fetch == 'all':
                    return cur.fetchall()
                conn.commit()
        except Exception:
            conn.rollback()
            raise

    # =========================================================================
    # SECTION 2: DB Read — 프로젝트 / 섭외지 정보 조회
    # =========================================================================

    def fetch_project_data(self, creator_request_id: int) -> dict:
        """creator_requests + users 조회 → generate_initial_draft() project_data 형식 반환"""
        row = self._execute("""
            SELECT
                cr.id, cr.creator_name, cr.identity_json, cr.concept,
                cr.content_purpose, cr.shoot_date, cr.start_time, cr.end_time,
                cr.people_count, cr.portfolio_url, cr.team_roles_json,
                u.id AS user_id, u.email, u.name, u.phone
            FROM creator_requests cr
            JOIN users u ON u.id = cr.user_id
            WHERE cr.id = %s
        """, (creator_request_id,), fetch='one')

        if not row:
            raise ValueError(f"creator_request_id={creator_request_id} not found")

        identity = row[2]
        if isinstance(identity, dict):
            identity = json.dumps(identity, ensure_ascii=False)

        return {
            "creator_request_id": row[0],
            "creator_name": row[1],
            "identity": identity,
            "concept": row[3],
            "content_purpose": row[4],
            "shoot_date": str(row[5]) if row[5] else None,
            "shoot_start": str(row[6]) if row[6] else None,
            "shoot_end": str(row[7]) if row[7] else None,
            "people_count": row[8],
            "portfolio_url": row[9],
            "team_roles": row[10],
            "user_id": str(row[11]),
            "user_email": row[12],
            "user_name": row[13],
            "user_phone": row[14],
        }

    def fetch_venue_data(self, timeline_item_contact_id: str, project_data: dict = None) -> dict:
        """
        timeline_item_contacts + places_normalized + timeline_items 조회 → venue_data 형식 반환
        - schedule: 섭외지 개별 방문 시간 (timeline_items.start_time ~ end_time)
        - crew: 프로젝트 전체 인원 정보 (project_data에서 조합)
        """
        row = self._execute("""
            SELECT
                tic.contact_name, tic.contact_email, tic.contact_phone,
                tic.timeline_item_id, tic.place_id,
                p.name, p.category, p.address, p.region,
                ti.start_time, ti.end_time
            FROM timeline_item_contacts tic
            JOIN places_normalized p ON p.id = tic.place_id
            LEFT JOIN timeline_items ti ON ti.id = tic.timeline_item_id
            WHERE tic.id = %s::uuid
        """, (timeline_item_contact_id,), fetch='one')

        if not row:
            raise ValueError(f"timeline_item_contact_id={timeline_item_contact_id} not found")

        # 섭외지 개별 방문 시간 — 날짜는 project_data.shoot_date 조합
        start_time = str(row[9]) if row[9] else None
        end_time = str(row[10]) if row[10] else None
        shoot_date = project_data.get("shoot_date") if project_data else None

        time_range = ""
        if start_time and end_time:
            time_range = f"{start_time} ~ {end_time}"
        elif start_time:
            time_range = start_time

        if shoot_date and time_range:
            schedule = f"{shoot_date}, {time_range}"
        elif shoot_date:
            schedule = shoot_date
        else:
            schedule = time_range

        # 인원 정보: project_data에서 조합
        crew = ""
        if project_data:
            parts = []
            if project_data.get("people_count"):
                parts.append(f"총 {project_data['people_count']}명")
            team_roles = project_data.get("team_roles")
            if team_roles:
                roles = [f"{m.get('name', '')}({m.get('role', '')})" for m in team_roles if m.get("role")]
                if roles:
                    parts.append(", ".join(roles))
            crew = " / ".join(parts)

        return {
            "contact_name": row[0],
            "contact_email": row[1],
            "contact_phone": row[2],
            "timeline_item_id": row[3],
            "place_id": row[4],
            "venue_name": row[5],
            "category": row[6],
            "address": row[7],
            "region": row[8],
            "schedule": schedule,
            "crew": crew,
        }

    # =========================================================================
    # SECTION 3: email_requests CRUD
    # =========================================================================

    def create_email_request(
        self,
        creator_request_id: int,
        timeline_item_contact_id: str,
        place_id: int,
        timeline_item_id: int,
        user_id: str,
        project_data: dict,
        venue_data: dict,
    ) -> str:
        """email_requests INSERT → req_id(uuid) 반환"""
        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
        raw = f"{place_id}{timeline_item_contact_id}{ts}"
        request_code = hashlib.sha256(raw.encode()).hexdigest()[:12].upper()

        sender_snapshot = json.dumps({
            "user_email": project_data.get("user_email"),
            "user_name": project_data.get("user_name"),
        }, ensure_ascii=False)
        contact_snapshot = json.dumps({
            "contact_email": venue_data.get("contact_email"),
            "contact_name": venue_data.get("contact_name"),
        }, ensure_ascii=False)
        project_snapshot = json.dumps(project_data, ensure_ascii=False)

        row = self._execute("""
            INSERT INTO email_requests (
                id, request_code, creator_request_id, timeline_item_id,
                place_id, timeline_item_contact_id, user_id,
                status, sender_snapshot_json, contact_snapshot_json, project_snapshot_json,
                created_at, updated_at
            ) VALUES (
                gen_random_uuid(), %s, %s, %s,
                %s, %s::uuid, %s::uuid,
                'DRAFT',
                %s::jsonb, %s::jsonb, %s::jsonb,
                NOW(), NOW()
            )
            RETURNING id
        """, (
            request_code, creator_request_id, timeline_item_id,
            place_id, timeline_item_contact_id, user_id,
            sender_snapshot, contact_snapshot, project_snapshot,
        ), fetch='one')
        self._get_conn().commit()
        return str(row[0])

    def get_email_request(self, req_id: str) -> dict:
        row = self._execute("""
            SELECT
                er.id, er.request_code, er.status,
                er.project_snapshot_json, er.contact_snapshot_json,
                tic.contact_email,
                p.name AS venue_name
            FROM email_requests er
            LEFT JOIN timeline_item_contacts tic ON tic.id = er.timeline_item_contact_id
            LEFT JOIN places_normalized p ON p.id = er.place_id
            WHERE er.id = %s::uuid
        """, (req_id,), fetch='one')
        if not row:
            return None
        return {
            "req_id": str(row[0]),
            "request_code": row[1],
            "status": row[2],
            "project_snapshot": row[3],
            "contact_snapshot": row[4],
            "to_address": row[5],
            "venue_name": row[6],
        }

    def update_email_request_status(self, req_id: str, status: str, confirmed: bool = False):
        if confirmed:
            self._execute("""
                UPDATE email_requests
                SET status = %s, confirmed_at = NOW(), updated_at = NOW()
                WHERE id = %s::uuid
            """, (status, req_id))
        else:
            self._execute("""
                UPDATE email_requests
                SET status = %s, updated_at = NOW()
                WHERE id = %s::uuid
            """, (status, req_id))
        self._get_conn().commit()

    # =========================================================================
    # SECTION 4: email_messages CRUD
    # =========================================================================

    def _insert_message(self, req_id, direction, subject=None, body_text=None,
                        draft_text=None, provider_message_id=None,
                        in_reply_to=None, status='DRAFT') -> str:
        row = self._execute("""
            INSERT INTO email_messages (
                id, email_request_id, direction,
                subject, body_text, draft_text,
                provider_message_id, in_reply_to_message_id,
                status, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), %s::uuid, %s,
                %s, %s, %s,
                %s, %s,
                %s, NOW(), NOW()
            )
            RETURNING id
        """, (req_id, direction, subject, body_text, draft_text,
              provider_message_id, in_reply_to, status), fetch='one')
        self._get_conn().commit()
        return str(row[0])

    def insert_outbound_draft(self, req_id, subject, body_text) -> str:
        return self._insert_message(req_id, 'outbound', subject=subject,
                                    body_text=body_text, status='DRAFT')

    def insert_inbound_message(self, req_id, body_text, sender=None,
                               provider_message_id=None, in_reply_to=None) -> str:
        msg_id = self._insert_message(
            req_id, 'inbound', body_text=body_text,
            provider_message_id=provider_message_id,
            in_reply_to=in_reply_to, status='RECEIVED'
        )
        self._execute("""
            UPDATE email_requests
            SET last_message_at = NOW(), updated_at = NOW()
            WHERE id = %s::uuid
        """, (req_id,))
        self._get_conn().commit()
        return msg_id

    def get_latest_outbound_message(self, req_id: str) -> dict:
        row = self._execute("""
            SELECT id, subject, body_text, provider_message_id
            FROM email_messages
            WHERE email_request_id = %s::uuid AND direction = 'outbound' AND status = 'SENT'
            ORDER BY sent_at DESC NULLS LAST, created_at DESC
            LIMIT 1
        """, (req_id,), fetch='one')
        if not row:
            return None
        return {"id": str(row[0]), "subject": row[1], "body_text": row[2], "provider_message_id": row[3]}

    def get_latest_inbound_message(self, req_id: str) -> dict:
        row = self._execute("""
            SELECT id, body_text, provider_message_id
            FROM email_messages
            WHERE email_request_id = %s::uuid AND direction = 'inbound'
            ORDER BY received_at DESC NULLS LAST, created_at DESC
            LIMIT 1
        """, (req_id,), fetch='one')
        if not row:
            return None
        return {"id": str(row[0]), "body_text": row[1], "provider_message_id": row[2]}

    def mark_message_sent(self, message_id: str, provider_message_id: str, subject: str = None):
        self._execute("""
            UPDATE email_messages
            SET status = 'SENT', sent_at = NOW(),
                provider_message_id = %s,
                subject = COALESCE(%s, subject),
                body_text = COALESCE(body_text, draft_text),
                updated_at = NOW()
            WHERE id = %s::uuid
        """, (provider_message_id, subject, message_id))
        self._get_conn().commit()

    # =========================================================================
    # SECTION 5: email_action_items CRUD
    # =========================================================================

    def insert_action_items(self, req_id: str, source_message_id: str, action_texts: list) -> list:
        ids = []
        for order, text in enumerate(action_texts, start=1):
            row = self._execute("""
                INSERT INTO email_action_items (
                    id, email_request_id, source_message_id,
                    item_order, action_text,
                    status, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), %s::uuid, %s::uuid,
                    %s, %s,
                    'PENDING', NOW(), NOW()
                )
                RETURNING id
            """, (req_id, source_message_id, order, text), fetch='one')
            ids.append(str(row[0]))
        self._get_conn().commit()
        return ids

    def get_pending_action_items(self, req_id: str) -> list:
        rows = self._execute("""
            SELECT id, source_message_id, item_order, action_text, user_response_text
            FROM email_action_items
            WHERE email_request_id = %s::uuid AND status = 'PENDING'
            ORDER BY item_order
        """, (req_id,), fetch='all') or []
        return [
            {
                "id": str(r[0]),
                "source_message_id": str(r[1]) if r[1] else None,
                "item_order": r[2],
                "action_text": r[3],
                "user_response_text": r[4],
            }
            for r in rows
        ]

    def resolve_action_item(self, action_item_id: str, user_response: str):
        self._execute("""
            UPDATE email_action_items
            SET status = 'COMPLETED', user_response_text = %s,
                resolved_at = NOW(), updated_at = NOW()
            WHERE id = %s::uuid
        """, (user_response, action_item_id))
        self._get_conn().commit()

    # =========================================================================
    # SECTION 6: Overrides — load_active_reqs
    # =========================================================================

    def load_active_reqs(self) -> dict:
        rows = self._execute("""
            SELECT
                er.id,
                em.provider_message_id AS thread_id,
                tic.contact_email,
                p.name AS venue_name
            FROM email_requests er
            LEFT JOIN LATERAL (
                SELECT provider_message_id
                FROM email_messages
                WHERE email_request_id = er.id AND direction = 'outbound' AND status = 'SENT'
                ORDER BY sent_at DESC NULLS LAST
                LIMIT 1
            ) em ON TRUE
            LEFT JOIN timeline_item_contacts tic ON tic.id = er.timeline_item_contact_id
            LEFT JOIN places_normalized p ON p.id = er.place_id
            WHERE er.status IN ('EMAIL_SENT', 'FOLLOWUP_SENT', 'CONFIRMED')
        """, fetch='all') or []
        return {
            str(r[0]): {"thread_id": r[1], "to_address": r[2], "venue_name": r[3]}
            for r in rows
        }

    # =========================================================================
    # SECTION 6b: Overrides — history_id DB 영속화
    # =========================================================================


    # =========================================================================
    # SECTION 7: Overrides — _save_raw_reply
    # =========================================================================

    def _save_raw_reply(self, req_id: str, sender: str, body: str, thread_id: str):
        self.insert_inbound_message(
            req_id=req_id,
            body_text=body,
            sender=sender,
            provider_message_id=thread_id,
        )

    # =========================================================================
    # SECTION 8: Overrides — analyze_reply_and_extract_actions
    # =========================================================================

    def analyze_reply_and_extract_actions(self, req_id: str):
        rows = self._execute("""
            SELECT id, body_text
            FROM email_messages
            WHERE email_request_id = %s::uuid
              AND direction = 'inbound'
              AND status != 'ACTION_EXTRACTED'
            ORDER BY received_at ASC NULLS LAST
        """, (req_id,), fetch='all') or []

        for raw_msg_id, body_text in rows:
            msg_id = str(raw_msg_id)
            cleaned = self._clean_quoted_text(body_text)

            p1 = self._load_prompt("step4_action_extractor.txt").replace("{reply_content}", cleaned)
            log_emit(f"[*] [Step 4] Extracting action items from reply {msg_id[:8]}...")
            prelim_raw = _ollama_chat_stream(self.client, self.model_name,
                                             [{"role": "user", "content": p1}],
                                             {"temperature": TEMP_EVALUATION})
            prelim = self._extract_tagged_content(prelim_raw, "[START_ACTIONS]", "[END_ACTIONS]")

            p2 = self._load_prompt("step4_action_verifier.txt")\
                .replace("{reply_content}", cleaned)\
                .replace("{preliminary_actions}", prelim)
            log_emit(f"[*] [Step 4] Verifying action items...")
            final_raw = _ollama_chat_stream(self.client, self.model_name,
                                            [{"role": "user", "content": p2}],
                                            {"temperature": TEMP_EVALUATION})
            final_str = self._extract_tagged_content(final_raw, "[START_ACTIONS]", "[END_ACTIONS]")

            lines = [l.strip().lstrip("-* ").strip() for l in final_str.splitlines() if l.strip().lstrip("-* ")]

            if lines:
                self.insert_action_items(req_id, msg_id, lines)
            else:
                self.update_email_request_status(req_id, 'CONFIRMED', confirmed=True)

            self._execute("""
                UPDATE email_messages
                SET status = 'ACTION_EXTRACTED', updated_at = NOW()
                WHERE id = %s::uuid
            """, (msg_id,))
            self._get_conn().commit()

    # =========================================================================
    # SECTION 9: Overrides — send_email_and_store
    # =========================================================================

    def send_email_and_store(self, req_id: str, to_address: str, subject: str):
        row = self._execute("""
            SELECT id, body_text
            FROM email_messages
            WHERE email_request_id = %s::uuid AND direction = 'outbound' AND status = 'DRAFT'
            ORDER BY created_at DESC
            LIMIT 1
        """, (req_id,), fetch='one')
        if not row:
            return None
        msg_id, body_text = str(row[0]), row[1]

        creds = self._authenticate_gmail()
        if not creds:
            return None
        try:
            service = build('gmail', 'v1', credentials=creds)
            message = EmailMessage()
            message.set_content(body_text)
            message['To'] = to_address
            message['From'] = "me"
            message['Subject'] = subject
            encoded = base64.urlsafe_b64encode(message.as_bytes()).decode()
            result = service.users().messages().send(userId="me", body={'raw': encoded}).execute()
            thread_id = result["threadId"]

            self.mark_message_sent(msg_id, thread_id, subject)
            self.update_email_request_status(req_id, 'EMAIL_SENT')
            return thread_id
        except Exception as e:
            print(f"[Core-DB] Send Error: {e}")
            return None

    # =========================================================================
    # SECTION 10: Overrides — generate_followup_reply
    # =========================================================================

    def generate_followup_reply(self, req_id: str):
        # COMPLETED 항목 중 followup draft가 아직 없는 경우에만 생성
        answered_rows = self._execute("""
            SELECT id, source_message_id, item_order, action_text, user_response_text
            FROM email_action_items
            WHERE email_request_id = %s::uuid AND status = 'COMPLETED'
            ORDER BY item_order
        """, (req_id,), fetch='all') or []
        answered = [
            {"id": str(r[0]), "source_message_id": str(r[1]) if r[1] else None,
             "item_order": r[2], "action_text": r[3], "user_response_text": r[4]}
            for r in answered_rows
        ]
        if not answered:
            return

        # 이미 followup draft/sent가 있으면 중복 생성 방지
        existing = self._execute("""
            SELECT id FROM email_messages
            WHERE email_request_id = %s::uuid AND direction = 'outbound'
              AND status IN ('DRAFT', 'SENT')
              AND created_at > (
                  SELECT MAX(created_at) FROM email_messages
                  WHERE email_request_id = %s::uuid AND direction = 'inbound'
              )
            LIMIT 1
        """, (req_id, req_id), fetch='one')
        if existing:
            return

        req_info = self.get_email_request(req_id)
        if not req_info:
            return

        project_snapshot = req_info.get("project_snapshot") or {}
        user_name = project_snapshot.get("user_name", "Kevin")
        identity = project_snapshot.get("identity", "")
        concept = project_snapshot.get("concept", "")

        previous_msg = self.get_latest_outbound_message(req_id)
        previous_email = previous_msg["body_text"] if previous_msg else ""
        inbound_msg = self.get_latest_inbound_message(req_id)
        original_reply = inbound_msg["body_text"] if inbound_msg else ""

        combined_ans = "\n".join(
            [f"- Q: {a['action_text']}\n  A: {a['user_response_text']}" for a in answered]
        )

        writer_template = self._load_prompt("step5_followup_writer.txt")
        current_feedback = None
        best_draft = ""
        score = 0
        reasons = ""

        log_emit(f"[{datetime.now().strftime('%H:%M:%S')}] [DB] Starting followup self-correction for {req_id}...")

        for attempt in range(1, MAX_DRAFT_ATTEMPTS + 1):
            gen_prompt = writer_template.format(
                user_name=user_name, identity=identity, concept=concept,
                original_reply=original_reply, user_answer=combined_ans,
                previous_email=previous_email,
            )
            user_instruction = "위의 지침에 따라 후속 답장 이메일을 작성하세요."
            if current_feedback:
                user_instruction += f"\n\n[피드백]\n{current_feedback}\n\n주의: 수정된 이메일 본문만 출력하십시오."

            log_emit(f"[*] [Step 5] Followup Draft Attempt {attempt}/{MAX_DRAFT_ATTEMPTS}...")
            raw_content = _ollama_chat_stream(
                self.client, self.model_name,
                [{"role": "user", "content": gen_prompt},
                 {"role": "user", "content": user_instruction}],
                {"temperature": TEMP_GENERATION},
            )
            draft_body = self._extract_tagged_content(raw_content, "[START_BODY]", "[END_BODY]")
            score, reasons = self.verify_followup_draft(req_id, raw_content, combined_ans, previous_email, user_name)

            log_emit(f"[{datetime.now().strftime('%H:%M:%S')}] [DB] Followup Attempt {attempt}: Score {score}")

            if "[START_BODY]" not in raw_content or "[END_BODY]" not in raw_content:
                reasons = "[CRITICAL] 태그 누락\n" + reasons
                score = min(score, TAG_PENALTY_CAP)

            best_draft = draft_body
            if score >= SCORE_THRESHOLD:
                break
            else:
                current_feedback = reasons

        self._insert_message(req_id, 'outbound', draft_text=best_draft, status='DRAFT')
        log_emit(f"[{datetime.now().strftime('%H:%M:%S')}] [DB] Followup draft saved (score={score}).")

        if score >= SCORE_THRESHOLD:
            log_emit(f"[{datetime.now().strftime('%H:%M:%S')}] [DB] Score passed — auto-sending followup...")
            self.send_followup_and_store(req_id)
        else:
            log_emit(f"[{datetime.now().strftime('%H:%M:%S')}] [DB] Score too low — awaiting manual review in dashboard.")

    # =========================================================================
    # SECTION 11: Overrides — verify_followup_draft
    # =========================================================================

    def verify_followup_draft(self, req_id, draft_content, user_answer, previous_email="", user_name="Kevin"):
        inbound = self.get_latest_inbound_message(req_id)
        original_reply = inbound["body_text"] if inbound else ""

        evaluator_template = self._load_prompt("step5_followup_evaluator.txt")
        criteria = evaluator_template.format(
            user_name=user_name, original_reply=original_reply,
            user_answer=user_answer, previous_email=previous_email,
        )
        response = self.client.chat(
            model=self.model_name,
            messages=[
                {"role": "system", "content": "당신은 베테랑 섭외 전문가이자 이메일 품질 검수자입니다."},
                {"role": "user", "content": f"[평가 기준]\n{criteria}\n\n[검수할 후속 답장 초안]\n--------------------------\n{draft_content}\n--------------------------"}
            ],
            options={"temperature": TEMP_EVALUATION},
        )
        eval_res = response['message']['content'].strip()
        score_match = re.search(r"Score:\s*(\d+)", eval_res)
        score = int(score_match.group(1)) if score_match else 0
        reasons = eval_res.split("Reasons:")[1].strip() if "Reasons:" in eval_res else eval_res
        return score, reasons

    # =========================================================================
    # SECTION 12: Overrides — send_followup_and_store
    # =========================================================================

    def send_followup_and_store(self, req_id: str):
        row = self._execute("""
            SELECT id, draft_text
            FROM email_messages
            WHERE email_request_id = %s::uuid AND direction = 'outbound' AND status = 'DRAFT'
            ORDER BY created_at DESC
            LIMIT 1
        """, (req_id,), fetch='one')
        if not row:
            return None
        followup_msg_id, draft_body = str(row[0]), row[1]

        init_row = self._execute("""
            SELECT provider_message_id, subject
            FROM email_messages
            WHERE email_request_id = %s::uuid AND direction = 'outbound' AND status = 'SENT'
            ORDER BY sent_at ASC NULLS LAST
            LIMIT 1
        """, (req_id,), fetch='one')
        if not init_row:
            return None
        thread_id, orig_subject = init_row[0], init_row[1]

        req_info = self.get_email_request(req_id)
        to_address = req_info["to_address"] if req_info else None
        if not to_address:
            return None

        creds = self._authenticate_gmail()
        if not creds:
            return None
        try:
            service = build('gmail', 'v1', credentials=creds)
            thread = service.users().threads().get(userId='me', id=thread_id).execute()
            last_msg = thread.get('messages', [])[-1]
            headers = last_msg.get('payload', {}).get('headers', [])
            msg_id_header = next((h['value'] for h in headers if h['name'].lower() == 'message-id'), None)
            subj = next((h['value'] for h in headers if h['name'].lower() == 'subject'), orig_subject or "Re: 협조 요청")
            subject = subj if subj.lower().startswith("re:") else f"Re: {subj}"

            message = EmailMessage()
            message.set_content(draft_body)
            message['To'] = to_address
            message['From'] = "me"
            message['Subject'] = subject
            if msg_id_header:
                message['In-Reply-To'] = msg_id_header
                message['References'] = msg_id_header
            encoded = base64.urlsafe_b64encode(message.as_bytes()).decode()
            service.users().messages().send(
                userId='me', body={'raw': encoded, 'threadId': thread_id}
            ).execute()

            self.mark_message_sent(followup_msg_id, thread_id, subject)
            self.update_email_request_status(req_id, 'FOLLOWUP_SENT')
            return thread_id
        except Exception as e:
            print(f"[Core-DB] Followup send error: {e}")
            return None

    # =========================================================================
    # SECTION 13: generate_initial_draft wrapper
    # =========================================================================

    def generate_initial_draft_db(self, project_data, venue_data, req_id, contact_type="email") -> dict:
        """
        부모의 LLM 초안 생성 루프를 호출한 뒤 결과를 DB에 저장.
        부모가 파일도 저장하지만 DB가 정본.
        """
        draft_data = super().generate_initial_draft(project_data, venue_data, req_id, contact_type)
        self.insert_outbound_draft(
            req_id=req_id,
            subject=draft_data.get("subject", ""),
            body_text=draft_data.get("email_draft_ko", ""),
        )
        return draft_data
