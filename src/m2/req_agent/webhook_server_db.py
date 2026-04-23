from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from typing import Dict
import asyncio
import base64
import json
import os
import uuid
from datetime import datetime
from pydantic import BaseModel

from core_logic_db import CoreLogicAgentDB
from config import SERVER_HOST, SERVER_PORT, STATIC_DIR, log_queue

app = FastAPI()

os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

print("[*] Initializing CoreLogicAgentDB...")
agent = CoreLogicAgentDB()

is_processing = False

# =========================================================================
# Health / Dashboard
# =========================================================================

@app.get("/")
def read_root():
    return {"status": "ok", "message": "REQ Agent (DB) is running. Access /dashboard for UI."}

@app.get("/dashboard", response_class=HTMLResponse)
async def get_dashboard():
    dashboard_path = f"{STATIC_DIR}/dashboard_db.html"
    if os.path.exists(dashboard_path):
        with open(dashboard_path, "r", encoding="utf-8") as f:
            return f.read()
    return """
    <html>
        <body style="background:#121212;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div><h1>Dashboard not found</h1><p>Please ensure static/dashboard.html exists.</p></div>
        </body>
    </html>
    """

# =========================================================================
# GET /api/logs/stream — SSE 실시간 로그 스트리밍
# =========================================================================

@app.get("/api/logs/stream")
async def logs_stream():
    async def event_generator():
        last_len = 0
        while True:
            current = list(log_queue)
            if len(current) > last_len:
                for entry in current[last_len:]:
                    data = json.dumps(entry, ensure_ascii=False)
                    yield f"data: {data}\n\n"
                last_len = len(current)
            await asyncio.sleep(0.3)

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

# =========================================================================
# GET /api/flow — DB 기반 전체 워크플로우 조회
# =========================================================================

@app.get("/api/flow")
async def api_get_flow():
    rows = agent._execute("""
        SELECT
            er.id, er.request_code, er.status,
            er.project_snapshot_json, er.contact_snapshot_json,
            er.created_at, er.last_message_at, er.confirmed_at,
            p.name AS venue_name,
            tic.contact_email
        FROM email_requests er
        LEFT JOIN timeline_item_contacts tic ON tic.id = er.timeline_item_contact_id
        LEFT JOIN places_normalized p ON p.id = er.place_id
        ORDER BY er.created_at DESC
    """, fetch='all') or []

    flows = {}
    for row in rows:
        req_id = str(row[0])
        flows[req_id] = {
            "step2": {
                "req_id": req_id,
                "request_code": row[1],
                "status": row[2],
                "project_info": row[3],
                "venue_name": row[8],
                "to_address": row[9],
                "created_at": str(row[5]) if row[5] else None,
                "last_message_at": str(row[6]) if row[6] else None,
                "confirmed_at": str(row[7]) if row[7] else None,
            }
        }

        # step3: 수신된 인바운드 메시지
        inbound_rows = agent._execute("""
            SELECT id, body_text, created_at, status
            FROM email_messages
            WHERE email_request_id = %s::uuid AND direction = 'inbound'
            ORDER BY created_at DESC
        """, (req_id,), fetch='all') or []
        if inbound_rows:
            # ACTION_EXTRACTED 상태인데 action items가 0개 → 확정 가능
            extracted_count = sum(1 for r in inbound_rows if r[3] == 'ACTION_EXTRACTED')
            action_count = agent._execute("""
                SELECT COUNT(*) FROM email_action_items
                WHERE email_request_id = %s::uuid
            """, (req_id,), fetch='one')[0]
            flows[req_id]["step3"] = {
                "req_id": req_id,
                "inbound_count": len(inbound_rows),
                "latest_body": inbound_rows[0][1],
                "latest_at": str(inbound_rows[0][2]) if inbound_rows[0][2] else None,
                "is_confirmable": extracted_count > 0 and action_count == 0,
            }

        # step2 초기 발송 이메일 본문 추가
        first_out = agent._execute("""
            SELECT body_text, subject, created_at
            FROM email_messages
            WHERE email_request_id = %s::uuid AND direction = 'outbound'
            ORDER BY created_at ASC
            LIMIT 1
        """, (req_id,), fetch='one')
        if first_out:
            flows[req_id]["step2"]["initial_email_body"] = first_out[0]
            flows[req_id]["step2"]["initial_email_subject"] = first_out[1]
            flows[req_id]["step2"]["initial_email_at"] = str(first_out[2]) if first_out[2] else None

        # step4: 미완료 액션 아이템
        actions = agent.get_pending_action_items(req_id)
        if actions:
            flows[req_id]["step4"] = {"req_id": req_id, "pending_actions": actions}

        # step5: 후속 메시지 (DRAFT 또는 SENT, 최초 outbound 제외)
        draft_row = agent._execute("""
            SELECT id, draft_text, body_text, subject, created_at, status
            FROM email_messages
            WHERE email_request_id = %s::uuid AND direction = 'outbound'
              AND status IN ('DRAFT', 'SENT')
              AND created_at > (
                  SELECT MIN(created_at) FROM email_messages
                  WHERE email_request_id = %s::uuid AND direction = 'outbound'
              )
            ORDER BY created_at DESC
            LIMIT 1
        """, (req_id, req_id), fetch='one')
        if draft_row:
            flows[req_id]["step5"] = {
                "req_id": req_id,
                "message_id": str(draft_row[0]),
                "draft_text": draft_row[1] or draft_row[2],
                "subject": draft_row[3],
                "created_at": str(draft_row[4]) if draft_row[4] else None,
                "status": draft_row[5],
            }

    return {"flows": flows}

# =========================================================================
# POST /api/new-project
# =========================================================================

class ProjectRequest(BaseModel):
    creator_request_id: int
    timeline_item_contact_id: str   # uuid
    contact_type: str = "email"

@app.post("/api/new-project")
async def trigger_new_project(req: ProjectRequest):
    try:
        # 1. DB에서 프로젝트 + 섭외지 정보 조회
        project_data = agent.fetch_project_data(req.creator_request_id)
        venue_data = agent.fetch_venue_data(req.timeline_item_contact_id, project_data)

        # 2. email_requests INSERT
        req_id = agent.create_email_request(
            creator_request_id=req.creator_request_id,
            timeline_item_contact_id=req.timeline_item_contact_id,
            place_id=venue_data["place_id"],
            timeline_item_id=venue_data["timeline_item_id"],
            user_id=project_data.get("user_id", ""),
            project_data=project_data,
            venue_data=venue_data,
        )

        print(f"[{datetime.now().strftime('%H:%M:%S')}] [API-DB] New project {req_id} for {venue_data.get('venue_name')}")

        # 3. 초안 생성 (LLM 셀프 교정 루프)
        draft_data = agent.generate_initial_draft_db(project_data, venue_data, req_id, req.contact_type)

        # 4. 이메일 발송
        if req.contact_type == "email":
            subject = draft_data.get("subject", f"[{venue_data['venue_name']}] 촬영 제안")
            if f"[Ref: {req_id}]" not in subject:
                subject = f"{subject} [Ref: {req_id}]"
            thread_id = agent.send_email_and_store(req_id, venue_data["contact_email"], subject)
        else:
            thread_id = "MESSENGER_DRAFT"

        if thread_id:
            return {"status": "success", "req_id": req_id, "thread_id": thread_id}
        else:
            return {"status": "error", "message": "Failed to send email. Check credentials."}

    except Exception as e:
        print(f"[Error] new-project: {e}")
        return {"status": "error", "message": str(e)}

# =========================================================================
# POST /api/resolve-actions
# =========================================================================

class ActionResolutionDB(BaseModel):
    req_id: str
    answers: Dict[str, str]   # {action_item_id: user_response_text}

@app.post("/api/resolve-actions")
async def resolve_actions(req: ActionResolutionDB):
    try:
        for action_item_id, response_text in req.answers.items():
            agent.resolve_action_item(action_item_id, response_text)

        print(f"[{datetime.now().strftime('%H:%M:%S')}] [API-DB] Actions resolved for {req.req_id}. Triggering followup...")
        agent.generate_followup_reply(req.req_id)
        return {"status": "success"}
    except Exception as e:
        print(f"[Error] resolve-actions: {e}")
        return {"status": "error", "message": str(e)}

# =========================================================================
# POST /api/confirm-venue
# =========================================================================

class ConfirmVenueRequest(BaseModel):
    req_id: str

@app.post("/api/confirm-venue")
async def confirm_venue(req: ConfirmVenueRequest):
    try:
        agent.update_email_request_status(req.req_id, 'CONFIRMED', confirmed=True)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [API-DB] Venue {req.req_id} confirmed.")
        return {"status": "success"}
    except Exception as e:
        print(f"[Error] confirm-venue: {e}")
        return {"status": "error", "message": str(e)}

# =========================================================================
# POST /api/send-followup
# =========================================================================

class SendFollowupRequest(BaseModel):
    req_id: str

@app.post("/api/send-followup")
async def send_followup(req: SendFollowupRequest):
    try:
        thread_id = agent.send_followup_and_store(req.req_id)
        if thread_id:
            return {"status": "success", "thread_id": thread_id}
        else:
            return {"status": "error", "message": "Failed to send. Check draft status or credentials."}
    except Exception as e:
        print(f"[Error] send-followup: {e}")
        return {"status": "error", "message": str(e)}

# =========================================================================
# Gmail Webhook
# =========================================================================

@app.post("/")
@app.post("/gmail/webhook")
@app.post("/gmail.webhook")
async def gmail_webhook(request: Request):
    log_file = "webhook_access.log"
    try:
        payload = await request.json()
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {json.dumps(payload)}\n")

        history_id = None
        if "message" in payload:
            msg_data_b64 = payload["message"].get("data")
            if msg_data_b64:
                msg_data = json.loads(base64.b64decode(msg_data_b64).decode("utf-8"))
                email_address = msg_data.get("emailAddress")
                history_id = msg_data.get("historyId")
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [Webhook] Push received for {email_address} (History ID: {history_id})")

        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, process_agent_logic, history_id)
        return {"status": "success"}
    except Exception as e:
        print(f"[Error] Webhook: {e}")
        return {"status": "error", "message": str(e)}


def process_agent_logic(history_id):
    global is_processing
    if is_processing:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [Agent] Already processing. Skipping.")
        return
    is_processing = True
    try:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [Agent-DB] Starting flow check...")
        active_reqs = agent.load_active_reqs()

        if history_id:
            agent.fetch_emails_via_history(active_reqs, history_id)
        else:
            agent.fetch_and_filter_emails(active_reqs)

        for req_id in active_reqs.keys():
            agent.analyze_reply_and_extract_actions(req_id)

        print(f"[{datetime.now().strftime('%H:%M:%S')}] [Agent-DB] Flow check completed.")
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        is_processing = False


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT)
