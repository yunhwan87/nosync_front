import os
import json
import base64
import re
import glob
from datetime import datetime
from email.message import EmailMessage
import ollama
from ollama import Client

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config import (
    OLLAMA_HOST, OLLAMA_MODEL,
    CREDENTIALS_FILE, TOKEN_FILE, GMAIL_SCOPES,
    SCORE_THRESHOLD, TAG_PENALTY_CAP, MAX_DRAFT_ATTEMPTS,
    TEMP_GENERATION, TEMP_EVALUATION,
    DIR_STEP2, DIR_STEP3, DIR_STEP4, DIR_STEP5,
    SEND_HISTORY_FILE, HISTORY_STATE_FILE,
    PROMPTS_DIR, COMMON_DOMAIN_FILE,
    log_queue,
)

def log_emit(msg: str):
    """print + SSE 큐에 동시 기록"""
    print(msg)
    log_queue.append({"ts": datetime.now().strftime("%H:%M:%S"), "msg": msg})

def _ollama_chat_stream(client, model, messages, options) -> str:
    """Ollama 스트리밍 호출 — 토큰마다 log_emit, 완성된 전체 텍스트 반환"""
    full = []
    buf = []
    for chunk in client.chat(model=model, messages=messages, options=options, stream=True):
        token = chunk['message']['content']
        full.append(token)
        buf.append(token)
        # 단어 경계(공백/줄바꿈)마다 emit
        if token in (' ', '\n', '。', '.', ',') or len(''.join(buf)) >= 30:
            log_queue.append({"ts": datetime.now().strftime("%H:%M:%S"),
                              "msg": ''.join(buf), "stream": True})
            buf.clear()
    if buf:
        log_queue.append({"ts": datetime.now().strftime("%H:%M:%S"),
                          "msg": ''.join(buf), "stream": True})
    return ''.join(full).strip()

# TOKEN_FILE, CREDENTIALS_FILE을 모듈 수준에서 노출 (setup_gmail_watch.py에서 import)
__all__ = ["CoreLogicAgent", "TOKEN_FILE", "CREDENTIALS_FILE"]

class REQAgentException(Exception):
    pass

class DataSchemaError(REQAgentException):
    pass

class CoreLogicAgent:
    def __init__(self, model_name=None, host=None):
        self.model_name = model_name or OLLAMA_MODEL
        self.host = host or OLLAMA_HOST
        self.client = Client(host=self.host)

        self.common_domains = ["gmail.com", "naver.com", "daum.net", "hanmail.net", "kakao.com"]
        try:
            if os.path.exists(COMMON_DOMAIN_FILE):
                with open(COMMON_DOMAIN_FILE, "r", encoding="utf-8") as f:
                    self.common_domains = json.load(f)
        except Exception:
            pass

    # =========================================================================
    # SECTION 1: Utilities & Helpers
    # =========================================================================

    def _load_prompt(self, filename, default=""):
        try:
            with open(f"{PROMPTS_DIR}/{filename}", "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            return default

    def _extract_tagged_content(self, text, start_tag, end_tag):
        pattern = f"{re.escape(start_tag)}(.*?){re.escape(end_tag)}"
        match = re.search(pattern, text, re.DOTALL)
        if match:
            return match.group(1).strip()
        return text.strip()

    def _clean_quoted_text(self, text):
        if not text: return ""
        patterns = [
            r"\d{4}년 \d{1,2}월 \d{1,2}일.*작성:",
            r"On.*at.*wrote:",
            r"---------- Forwarded message ----------",
            r"________________________________"
        ]
        lines = text.splitlines()
        cleaned_lines = []
        for line in lines:
            if line.strip().startswith(">"): continue
            stop = False
            for p in patterns:
                if re.search(p, line):
                    stop = True
                    break
            if stop: break
            cleaned_lines.append(line)
        return "\n".join(cleaned_lines).strip()

    def refine_tone(self, draft_content):
        system_prompt = self._load_prompt("util_tone_refiner.txt", default="AI 말투를 제거하고 본문만 남기세요.")
        try:
            response = self.client.chat(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": draft_content}
                ],
                options={"temperature": TEMP_EVALUATION}
            )
            raw_refined = response['message']['content'].strip()
            refined = self._extract_tagged_content(raw_refined, "[START_BODY]", "[END_BODY]")

            stop_patterns = [r"\n---", r"\n###", r"\n참고:", r"\n추가 조언"]
            for pattern in stop_patterns:
                f_match = re.search(pattern, refined)
                if f_match:
                    refined = refined[:f_match.start()].strip()

            return refined if len(refined) >= 20 else draft_content
        except Exception as e:
            print(f"[Core-Ollama] Tone refining error: {e}")
            return draft_content

    # =========================================================================
    # SECTION 2: Gmail API Core
    # =========================================================================

    def _authenticate_gmail(self):
        creds = None
        if os.path.exists(TOKEN_FILE):
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, GMAIL_SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(CREDENTIALS_FILE):
                    print(f"[Error] {CREDENTIALS_FILE} not found.")
                    return None
                flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, GMAIL_SCOPES)
                creds = flow.run_local_server(port=0)
            with open(TOKEN_FILE, 'w') as token:
                token.write(creds.to_json())
        return creds

    def _parse_body(self, payload):
        def _get_plain_text(parts):
            for part in parts:
                if part['mimeType'] == 'text/plain':
                    return part['body'].get('data', '')
                if 'parts' in part:
                    res = _get_plain_text(part['parts'])
                    if res: return res
            return ""

        def _get_any_text(parts):
            for part in parts:
                if part['mimeType'] in ['text/plain', 'text/html']:
                    return part['body'].get('data', '')
                if 'parts' in part:
                    res = _get_any_text(part['parts'])
                    if res: return res
            return ""

        body_data = ""
        if 'parts' in payload:
            body_data = _get_plain_text(payload['parts'])
            if not body_data:
                body_data = _get_any_text(payload['parts'])
        elif payload.get('mimeType') in ['text/plain', 'text/html']:
            body_data = payload.get('body', {}).get('data', '')

        if body_data:
            missing_padding = len(body_data) % 4
            if missing_padding: body_data += '=' * (4 - missing_padding)
            try:
                return base64.urlsafe_b64decode(body_data).decode('utf-8')
            except UnicodeDecodeError:
                return base64.urlsafe_b64decode(body_data).decode('euc-kr', errors='replace')
        return "(HTML content only)"

    def _mark_as_read(self, service, msg_id):
        try:
            service.users().messages().modify(userId='me', id=msg_id, body={'removeLabelIds': ['UNREAD']}).execute()
        except Exception as e:
            print(f"[Core] Error marking as read: {e}")

    # =========================================================================
    # SECTION 3: Outbound Flow
    # =========================================================================

    def evaluate_initial_draft(self, raw_content, contact_type="email"):
        prompt_file = "step2_messenger_draft_evaluator.txt" if contact_type == "messenger" else "step2_initial_draft_evaluator.txt"
        criteria = self._load_prompt(prompt_file)
        eval_system_prompt = "당신은 베테랑 섭외 전문가이자 품질 검수자입니다. 상대방이 보낸 '초안'이 [평가 기준]을 얼마나 충족하는지 냉정하게 평가하세요."
        eval_user_content = f"""[평가 기준]\n{criteria}\n\n[검수할 초안]\n--------------------------\n{raw_content}\n--------------------------\n\n결과는 반드시 아래 형식을 지켜주세요:\nScore: [점수]\nReasons: [점수 산정 이유 및 부족한 점 상세 설명]\n\n주의: \n1. 만약 출력물이 섭외 제안 형태가 아니거나, 피드백에 대한 분석/답변인 경우 점수는 무조건 0점 처리하십시오.\n2. 오직 실제 발송 가능한 본문이 포함되어 있을 때만 점수를 부여하십시오."""

        import time
        start_eval = time.time()
        log_emit(f"[*] [Step 2.3] Calling Ollama for Evaluation...")

        try:
            eval_res = _ollama_chat_stream(
                self.client, self.model_name,
                [{"role": "system", "content": eval_system_prompt},
                 {"role": "user", "content": eval_user_content}],
                {"temperature": TEMP_EVALUATION}
            )
            log_emit(f"[+] [Step 2.3] Evaluation completed in {time.time() - start_eval:.2f}s")
        except Exception as e:
            log_emit(f"[!] [Step 2.3] Ollama Evaluation failed: {e}")
            raise

        score_match = re.search(r"Score:\s*(\d+)", eval_res)
        score = int(score_match.group(1)) if score_match else 0
        reasons = eval_res.split("Reasons:")[1].strip() if "Reasons:" in eval_res else eval_res

        return score, reasons

    def generate_initial_draft(self, project_data, venue_data, req_id, contact_type="email"):
        prompt_file = "step2_messenger_draft_writer.txt" if contact_type == "messenger" else "step2_initial_draft_writer.txt"
        system_prompt = self._load_prompt(prompt_file).replace("{{req_id}}", req_id)
        user_content = f"""[프로젝트 정보]\n- 유저 정체성: {project_data['identity']}\n- 촬영 컨셉: {project_data['concept']}\n\n[섭외지 정보]\n- 장소 이름: {venue_data['venue_name']}\n- 날짜 및 시간: {venue_data['schedule']}\n- 인원 정보: {venue_data.get('crew', '정보 없음')}"""
        current_feedback = None
        final_draft_data = None

        for attempt in range(1, MAX_DRAFT_ATTEMPTS + 1):
            prompt_with_feedback = user_content
            if current_feedback:
                prompt_with_feedback += f"\n\n[이전 시도에 대한 피드백 - 다음 사항을 반드시 수정하여 '새로운 이메일 본문'을 작성하세요]\n{current_feedback}\n\n주의: 피드백에 대해 설명하지 말고 오직 '수정된 이메일 본문'만 출력하십시오."

            import time
            start_gen = time.time()
            log_emit(f"[*] [Step 2.2] Calling Ollama for Initial Draft (Attempt {attempt})...")

            try:
                raw_output = _ollama_chat_stream(
                    self.client, self.model_name,
                    [{'role': 'system', 'content': system_prompt},
                     {'role': 'user', 'content': prompt_with_feedback}],
                    {"temperature": TEMP_GENERATION}
                )
                log_emit(f"[+] [Step 2.2] Generation completed in {time.time() - start_gen:.2f}s (Length: {len(raw_output)})")
            except Exception as e:
                log_emit(f"[!] [Step 2.2] Ollama Generation failed: {e}")
                raise

            draft_body = self._extract_tagged_content(raw_output, "[START_BODY]", "[END_BODY]")
            score, reasons = self.evaluate_initial_draft(raw_output, contact_type=contact_type)
            log_emit(f"[{datetime.now().strftime('%H:%M:%S')}] [Ollama] Step 2 Attempt {attempt}: Score {score}")

            if "[START_BODY]" not in raw_output or "[END_BODY]" not in raw_output:
                reasons = "[CRITICAL] [START_BODY] 및 [END_BODY] 태그가 누락되었습니다. 반드시 본문 전체를 이 태그로 감싸십시오.\n" + reasons
                score = min(score, TAG_PENALTY_CAP)

            if score >= SCORE_THRESHOLD:
                final_draft_data = {
                    "req_id": req_id,
                    "contact_type": contact_type,
                    "project_info": project_data,
                    "venue_name": venue_data['venue_name'],
                    "subject": f"[{venue_data['venue_name']}] 촬영 제안",
                    "email_draft_ko": draft_body,
                    "score": score,
                    "reasons": reasons,
                    "attempts": attempt,
                    "status": "DRAFT_COMPLETED" if contact_type == "email" else "MESSENGER_READY",
                    "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                break
            else:
                current_feedback = reasons

        if not final_draft_data:
            final_draft_data = {
                "req_id": req_id,
                "contact_type": contact_type,
                "project_info": project_data,
                "venue_name": venue_data['venue_name'],
                "subject": f"[{venue_data['venue_name']}] 촬영 제안",
                "email_draft_ko": draft_body,
                "score": score, "reasons": reasons, "attempts": MAX_DRAFT_ATTEMPTS,
                "status": "DRAFT_COMPLETED" if contact_type == "email" else "MESSENGER_READY",
                "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

        if f"[Ref: {req_id}]" not in final_draft_data["email_draft_ko"]:
            final_draft_data["email_draft_ko"] += f"\n\n[다른 이메일 주소로 답장하실 경우, 원활한 처리를 위해 제목이나 본문에 반드시 아래 식별자를 포함해 주시면 감사하겠습니다.]\n[Ref: {req_id}]"

        out_path = f"{DIR_STEP2}/initial_draft_{req_id}.json"
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(final_draft_data, f, ensure_ascii=False, indent=4)

        return final_draft_data

    def send_email_and_store(self, req_id, to_address, subject):
        draft_path = f"{DIR_STEP2}/initial_draft_{req_id}.json"
        if not os.path.exists(draft_path): return None
        with open(draft_path, "r", encoding="utf-8") as f:
            draft_data = json.load(f)

        creds = self._authenticate_gmail()
        if not creds: return None
        try:
            service = build('gmail', 'v1', credentials=creds)
            message = EmailMessage()
            message.set_content(draft_data["email_draft_ko"])
            message['To'] = to_address
            message['From'] = "me"
            message['Subject'] = subject
            encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
            send_message = service.users().messages().send(userId="me", body={'raw': encoded_message}).execute()

            draft_data["thread_id"] = send_message["threadId"]
            draft_data["to_address"] = to_address
            draft_data["status"] = "EMAIL_SENT"
            with open(draft_path, "w", encoding="utf-8") as f:
                json.dump(draft_data, f, ensure_ascii=False, indent=4)
            return send_message["threadId"]
        except HttpError as error:
            print(f'[Core] Send Error: {error}')
            return None

    def generate_followup_reply(self, req_id):
        action_path = f"{DIR_STEP4}/action_items_{req_id}.json"
        initial_path = f"{DIR_STEP2}/initial_draft_{req_id}.json"

        if not os.path.exists(action_path): return
        if not os.path.exists(initial_path):
            raise FileNotFoundError(f"Initial draft file not found for {req_id}")

        with open(action_path, "r", encoding="utf-8") as f:
            action_data = json.load(f)
        with open(initial_path, "r", encoding="utf-8") as f:
            initial_data = json.load(f)

        if "project_info" not in initial_data:
            raise DataSchemaError(f"Missing 'project_info' in initial_draft_{req_id}.json. Please run repair_legacy_data.py first.")

        project_info = initial_data["project_info"]
        previous_email = initial_data.get("email_draft_ko", "")

        user_name = project_info.get("user_name", "Kevin")
        identity = project_info["identity"]
        concept = project_info["concept"]

        followup_drafts = []
        modified = False

        for packet in action_data.get("pending_actions", []):
            if "items" in packet:
                unresolved = [i for i in packet["items"] if i.get("resolved") == False]
                if unresolved or packet.get("followup_generated"): continue

                combined_ans = "\n".join([f"- Q: {i['task']}\n  A: {i['answer']}" for i in packet["items"]])
                writer_template = self._load_prompt("step5_followup_writer.txt")

                current_feedback = None
                best_draft = ""

                print(f"[{datetime.now().strftime('%H:%M:%S')}] [Ollama] Starting self-correction loop for {req_id} followup...")

                for attempt in range(1, MAX_DRAFT_ATTEMPTS + 1):
                    gen_prompt = writer_template.format(
                        user_name=user_name,
                        identity=identity,
                        concept=concept,
                        original_reply=packet["original_reply"],
                        user_answer=combined_ans,
                        previous_email=previous_email
                    )

                    user_instruction = "위의 지침에 따라 후속 답장 이메일을 작성하세요."
                    if current_feedback:
                        user_instruction += f"\n\n[이전 시도에 대한 피드백 - 다음 사항을 반드시 수정하세요]\n{current_feedback}\n\n주의: 피드백에 대해 설명하지 말고 오직 '수정된 이메일 본문'만 출력하십시오."

                    response = self.client.chat(
                        model=self.model_name,
                        messages=[
                            {"role": "user", "content": gen_prompt},
                            {"role": "user", "content": user_instruction}
                        ],
                        options={"temperature": TEMP_GENERATION}
                    )
                    raw_content = response['message']['content'].strip()
                    draft_body = self._extract_tagged_content(raw_content, "[START_BODY]", "[END_BODY]")

                    score, reasons = self.verify_followup_draft(req_id, raw_content, combined_ans, previous_email, user_name)
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] [Ollama] Followup Attempt {attempt}: Score {score}")

                    if "[START_BODY]" not in raw_content or "[END_BODY]" not in raw_content:
                        reasons = "[CRITICAL] [START_BODY] 및 [END_BODY] 태그가 누락되었습니다. 반드시 본문 전체를 이 태그로 감싸십시오.\n" + reasons
                        score = min(score, TAG_PENALTY_CAP)

                    best_draft = draft_body
                    if score >= SCORE_THRESHOLD:
                        break
                    else:
                        current_feedback = reasons

                followup_drafts.append({
                    "based_on_action": "Combined Items",
                    "user_answer": combined_ans,
                    "draft": best_draft,
                    "score": score,
                    "reasons": reasons,
                    "attempts": attempt,
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
                packet["followup_generated"] = True
                packet["user_resolved"] = True
                modified = True

        if modified:
            with open(action_path, "w", encoding="utf-8") as f:
                json.dump(action_data, f, ensure_ascii=False, indent=4)
            f_path = f"{DIR_STEP5}/followup_draft_{req_id}.json"
            os.makedirs(os.path.dirname(f_path), exist_ok=True)
            if os.path.exists(f_path):
                with open(f_path, "r", encoding="utf-8") as f: f_data = json.load(f)
            else: f_data = {"req_id": req_id, "drafts": []}
            f_data["drafts"].extend(followup_drafts)
            with open(f_path, "w", encoding="utf-8") as f: json.dump(f_data, f, ensure_ascii=False, indent=4)

            for draft_info in followup_drafts:
                if draft_info.get("score", 0) >= SCORE_THRESHOLD:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] [Auto] High quality draft ({draft_info['score']}). Sending followup...")
                    self.send_followup_and_store(req_id)
                    break

    def verify_followup_draft(self, req_id, draft_content, user_answer, previous_email="", user_name="Kevin"):
        reply_path = f"{DIR_STEP3}/raw_reply_{req_id}.json"
        original_reply = ""
        if os.path.exists(reply_path):
            with open(reply_path, "r", encoding="utf-8") as f:
                rdata = json.load(f)
                if rdata.get("replies"): original_reply = rdata["replies"][-1]["content"]

        evaluator_template = self._load_prompt("step5_followup_evaluator.txt")
        criteria = evaluator_template.format(
            user_name=user_name,
            original_reply=original_reply,
            user_answer=user_answer,
            previous_email=previous_email
        )

        eval_system_prompt = "당신은 베테랑 섭외 전문가이자 이메일 품질 검수자입니다. 상대방이 보낸 '후속 답장 초안'을 냉정하게 평가하세요."
        eval_user_content = f"[평가 기준]\n{criteria}\n\n[검수할 후속 답장 초안]\n--------------------------\n{draft_content}\n--------------------------"

        response = self.client.chat(
            model=self.model_name,
            messages=[
                {"role": "system", "content": eval_system_prompt},
                {"role": "user", "content": eval_user_content}
            ],
            options={"temperature": TEMP_EVALUATION}
        )
        eval_res = response['message']['content'].strip()

        score_match = re.search(r"Score:\s*(\d+)", eval_res)
        score = int(score_match.group(1)) if score_match else 0
        reasons = eval_res.split("Reasons:")[1].strip() if "Reasons:" in eval_res else eval_res

        return score, reasons

    def send_followup_and_store(self, req_id):
        followup_path = f"{DIR_STEP5}/followup_draft_{req_id}.json"
        initial_path = f"{DIR_STEP2}/initial_draft_{req_id}.json"
        if not os.path.exists(followup_path): return None

        with open(followup_path, "r", encoding="utf-8") as f:
            f_data = json.load(f)
        if not f_data.get("drafts"): return None
        latest = f_data["drafts"][-1]

        with open(initial_path, "r", encoding="utf-8") as f:
            initial = json.load(f)

        creds = self._authenticate_gmail()
        if not creds: return None
        service = build('gmail', 'v1', credentials=creds)
        try:
            thread = service.users().threads().get(userId='me', id=initial['thread_id']).execute()
            last_msg = thread.get('messages', [])[-1]
            headers = last_msg.get('payload', {}).get('headers', [])
            msg_id = next((h['value'] for h in headers if h['name'].lower() == 'message-id'), None)
            orig_subj = next((h['value'] for h in headers if h['name'].lower() == 'subject'), "Re: 협조 요청")
            subject = orig_subj if orig_subj.lower().startswith("re:") else f"Re: {orig_subj}"

            message = EmailMessage()
            message.set_content(latest["draft"])
            message['To'] = initial['to_address']
            message['From'] = "me"
            message['Subject'] = subject
            if msg_id:
                message['In-Reply-To'] = msg_id
                message['References'] = msg_id

            encoded = base64.urlsafe_b64encode(message.as_bytes()).decode()
            service.users().messages().send(userId='me', body={'raw': encoded, 'threadId': initial['thread_id']}).execute()

            latest["status"] = "SENT"
            latest["sent_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with open(followup_path, "w", encoding="utf-8") as f:
                json.dump(f_data, f, ensure_ascii=False, indent=4)
            self._record_send_history(req_id, "FOLLOWUP", initial['to_address'], subject, latest["draft"], initial['thread_id'])
            return initial['thread_id']
        except Exception as e:
            print(f"[Core] Followup send error: {e}")
            return None

    # =========================================================================
    # SECTION 4: Inbound Flow (Fetching & Analysis)
    # =========================================================================

    def load_active_reqs(self):
        active = {}
        for df in glob.glob(f"{DIR_STEP2}/*.json"):
            try:
                with open(df, "r", encoding="utf-8") as f: data = json.load(f)
                if data.get("status") in ["EMAIL_SENT", "SENT", "CONFIRMED", "FOLLOWUP_SENT"]:
                    active[data["req_id"]] = {"thread_id": data.get("thread_id"), "to_address": data.get("to_address"), "venue_name": data.get("venue_name", "")}
            except Exception: pass
        return active

    def fetch_and_filter_emails(self, active_reqs):
        creds = self._authenticate_gmail()
        if not creds: return
        service = build('gmail', 'v1', credentials=creds)
        try:
            for req_id, info in active_reqs.items():
                if info.get("thread_id"):
                    self._check_and_save_thread_replies(service, req_id, info["thread_id"], info)
            results = service.users().messages().list(userId='me', q='is:unread').execute()
            for msg_meta in results.get('messages', []):
                msg = service.users().messages().get(userId='me', id=msg_meta['id']).execute()
                if msg['threadId'] in [r.get('thread_id') for r in active_reqs.values()]: continue
                self._process_single_message(service, msg, active_reqs)
        except Exception as e:
            print(f"[Core] Fetch Error: {e}")

    def fetch_emails_via_history(self, active_reqs, history_id):
        creds = self._authenticate_gmail()
        if not creds: return
        service = build('gmail', 'v1', credentials=creds)
        last_hid = self._get_last_history_id()
        if not last_hid: return self.fetch_and_filter_emails(active_reqs)
        try:
            results = service.users().history().list(userId='me', startHistoryId=last_hid).execute()
            for h in results.get('history', []):
                for added in h.get('messagesAdded', []):
                    msg = service.users().messages().get(userId='me', id=added['message']['id']).execute()
                    self._process_single_message(service, msg, active_reqs)
            self._save_last_history_id(history_id)
        except Exception:
            self.fetch_and_filter_emails(active_reqs)
            self._save_last_history_id(history_id)

    def _process_single_message(self, service, msg_data, active_reqs):
        payload = msg_data.get('payload', {})
        headers = payload.get('headers', [])
        sender = next((h['value'] for h in headers if h['name'] == 'From'), "")
        body = self._parse_body(payload)
        full_text = next((h['value'] for h in headers if h['name'] == 'Subject'), "") + "\n" + body
        for req_id in active_reqs.keys():
            if f"[Ref: {req_id}]" in full_text:
                self._save_raw_reply(req_id, sender, body, msg_data['threadId'])
                self._mark_as_read(service, msg_data['id'])
                return
        domain = sender.split('@')[-1].replace('>', '') if '@' in sender else ''
        if domain not in self.common_domains:
            for rid, rinfo in active_reqs.items():
                if domain in rinfo.get("to_address", ""):
                    if self._llm_relevance_check(rid, full_text, rinfo):
                        self._save_raw_reply(rid, sender, body, msg_data['threadId'])
                        self._mark_as_read(service, msg_data['id'])
                        return

    def _llm_relevance_check(self, req_id, email_text, req_info):
        template = self._load_prompt("step3_relevance_filter.txt")
        prompt = template.replace("{venue_name}", req_info.get("venue_name", "")).replace("{email_text}", email_text)
        resp = self.client.chat(model=self.model_name, messages=[{"role": "user", "content": prompt}], options={"temperature": TEMP_EVALUATION})
        return "YES" in resp['message']['content'].upper()

    def analyze_reply_and_extract_actions(self, req_id):
        reply_path = f"{DIR_STEP3}/raw_reply_{req_id}.json"
        if not os.path.exists(reply_path): return
        with open(reply_path, "r", encoding="utf-8") as f: data = json.load(f)
        action_packets = []
        for reply in data.get("replies", []):
            if reply.get("action_extracted"): continue
            cleaned = self._clean_quoted_text(reply['content'])
            p1 = self._load_prompt("step4_action_extractor.txt").replace("{reply_content}", cleaned)
            r1 = self.client.chat(model=self.model_name, messages=[{"role": "user", "content": p1}], options={"temperature": TEMP_EVALUATION})
            prelim = self._extract_tagged_content(r1['message']['content'], "[START_ACTIONS]", "[END_ACTIONS]")
            p2 = self._load_prompt("step4_action_verifier.txt").replace("{reply_content}", cleaned).replace("{preliminary_actions}", prelim)
            r2 = self.client.chat(model=self.model_name, messages=[{"role": "user", "content": p2}], options={"temperature": TEMP_EVALUATION})
            final_str = self._extract_tagged_content(r2['message']['content'], "[START_ACTIONS]", "[END_ACTIONS]")
            lines = [l.strip().lstrip("-* ").strip() for l in final_str.splitlines() if l.strip().lstrip("-* ")]
            item_list = [{"task": l, "answer": "", "resolved": False} for l in lines]

            if item_list:
                packet = {"original_reply": reply['content'], "items": item_list, "timestamp": reply['received_at']}
            else:
                packet = {
                    "original_reply": reply['content'],
                    "items": [],
                    "timestamp": reply['received_at'],
                    "is_confirmation": True
                }

            action_packets.append(packet)
            reply["action_extracted"] = True

        if action_packets:
            with open(reply_path, "w", encoding="utf-8") as f: json.dump(data, f, ensure_ascii=False, indent=4)
            a_path = f"{DIR_STEP4}/action_items_{req_id}.json"
            os.makedirs(os.path.dirname(a_path), exist_ok=True)
            if os.path.exists(a_path):
                with open(a_path, "r", encoding="utf-8") as f: adata = json.load(f)
            else: adata = {"req_id": req_id, "pending_actions": []}
            adata["pending_actions"].extend(action_packets)
            with open(a_path, "w", encoding="utf-8") as f: json.dump(adata, f, ensure_ascii=False, indent=4)

    # =========================================================================
    # SECTION 5: Internal Persistence & Logging
    # =========================================================================

    def _save_raw_reply(self, req_id, sender, body, thread_id):
        path = f"{DIR_STEP3}/raw_reply_{req_id}.json"
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f: d = json.load(f)
        else: d = {"req_id": req_id, "replies": []}
        d["replies"].append({"sender": sender, "content": body, "received_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "incoming_thread_id": thread_id, "action_extracted": False})
        with open(path, "w", encoding="utf-8") as f: json.dump(d, f, ensure_ascii=False, indent=4)

    def _record_send_history(self, req_id, msg_type, to, subj, content, thread_id):
        path = SEND_HISTORY_FILE
        os.makedirs(os.path.dirname(path), exist_ok=True)
        h = []
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f: h = json.load(f)
            except: pass
        h.append({"req_id": req_id, "msg_type": msg_type, "to": to, "subject": subj, "thread_id": thread_id, "sent_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})
        with open(path, "w", encoding="utf-8") as f: json.dump(h, f, ensure_ascii=False, indent=4)

    def _get_last_history_id(self):
        if os.path.exists(HISTORY_STATE_FILE):
            with open(HISTORY_STATE_FILE, "r") as f: return json.load(f).get("last_history_id")
        return None

    def _save_last_history_id(self, hid):
        os.makedirs(os.path.dirname(HISTORY_STATE_FILE), exist_ok=True)
        with open(HISTORY_STATE_FILE, "w") as f:
            json.dump({"last_history_id": hid, "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}, f)

    def _check_and_save_thread_replies(self, service, req_id, thread_id, info):
        try:
            thread = service.users().threads().get(userId='me', id=thread_id).execute()
            for msg in thread.get('messages', [])[1:]:
                if 'UNREAD' in msg.get('labelIds', []):
                    body = self._parse_body(msg.get('payload', {}))
                    self._save_raw_reply(req_id, "Unknown", body, thread_id)
                    self._mark_as_read(service, msg['id'])
        except Exception: pass
