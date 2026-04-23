import os
from collections import deque
from dotenv import load_dotenv

load_dotenv()

# --- 실시간 로그 큐 (SSE 스트리밍용) ---
log_queue: deque = deque(maxlen=500)

# --- Ollama ---
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:e4b")

# --- Gmail OAuth ---
CREDENTIALS_FILE = os.getenv("CREDENTIALS_FILE", "credentials.json")
TOKEN_FILE = os.getenv("TOKEN_FILE", "token.json")
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]

# --- GCP Pub/Sub ---
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "gaboda-login")
PUBSUB_TOPIC_NAME = os.getenv("PUBSUB_TOPIC_NAME", "email_request")

# --- Web Server ---
SERVER_HOST = "0.0.0.0"
SERVER_PORT = 8080

# --- Agent Tuning ---
SCORE_THRESHOLD = 90        # 이 점수 이상이면 초안 완성 / 자동 발송
TAG_PENALTY_CAP = 70        # START_BODY/END_BODY 태그 누락 시 점수 상한
MAX_DRAFT_ATTEMPTS = 5      # 셀프 교정 루프 최대 시도 횟수

# --- LLM Temperature ---
TEMP_GENERATION = 0.7       # 초안 생성 (창의성)
TEMP_EVALUATION = 0.1       # 평가 / 관련성 검사 (일관성)

# --- Data Paths ---
DATA_DIR = "data"
DIR_STEP1 = f"{DATA_DIR}/flow_step1_draft_resource"
DIR_STEP2 = f"{DATA_DIR}/flow_step2_initial_draft"
DIR_STEP3 = f"{DATA_DIR}/flow_step3_received_replies"
DIR_STEP4 = f"{DATA_DIR}/flow_step4_user_actions"
DIR_STEP5 = f"{DATA_DIR}/flow_step5_followup_draft"
SEND_HISTORY_FILE = f"{DATA_DIR}/send_history.json"
HISTORY_STATE_FILE = f"{DATA_DIR}/history_state.json"

# --- Database ---
DATABASE_URL = os.getenv("DATABASE_URL", "")

# --- Static / Prompts ---
STATIC_DIR = "static"
PROMPTS_DIR = "prompts"
COMMON_DOMAIN_FILE = "common_domain_emails.json"
