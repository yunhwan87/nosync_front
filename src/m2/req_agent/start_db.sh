#!/bin/bash
# DB 연동 버전 (AWS RDS + Ollama)
# 사용: bash start_db.sh

set -e
cd "$(dirname "$0")"

PYTHON=".venv/bin/python"

echo "========================================"
echo " REQ Agent  [DB / Production]"
echo "========================================"

# 1. Ollama 확인
echo "[1/5] Checking Ollama..."
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "      Ollama OK"
else
    echo "      Ollama not running. Starting..."
    ollama serve &
    sleep 3
    echo "      Ollama started."
fi

# 2. DB 연결 확인
echo "[2/5] Checking DB connection..."
$PYTHON -c "
import psycopg2, os
from dotenv import load_dotenv
load_dotenv()
url = os.getenv('DATABASE_URL', '')
if not url:
    raise ValueError('DATABASE_URL not set in .env')
conn = psycopg2.connect(url)
conn.close()
print('      DB connection OK')
"

# 3. Tailscale Funnel
echo "[3/5] Starting Tailscale Funnel..."
sudo tailscale funnel 8080 &
sleep 2
echo "      Funnel URL: https://onsync-latency-test.tailb3adc4.ts.net"

# 4. Gmail Watch 재등록
echo "[4/5] Registering Gmail Watch..."
$PYTHON setup_gmail_watch.py

# 5. DB 버전 웹훅 서버 실행
echo "[5/5] Starting webhook server (DB version)..."
nohup $PYTHON webhook_server_db.py > webhook_server_db.log 2>&1 &
SERVER_PID=$!
sleep 2

EXTERNAL_IP=$(curl -s ifconfig.me)
if curl -s http://localhost:8080/ > /dev/null; then
    echo ""
    echo "========================================"
    echo " All systems running (DB version)"
    echo " Server PID : $SERVER_PID"
    echo " Dashboard  : http://$EXTERNAL_IP:8080/dashboard"
    echo " API        : http://$EXTERNAL_IP:8080/"
    echo " Webhook    : https://onsync-latency-test.tailb3adc4.ts.net/gmail/webhook"
    echo " Logs       : tail -f webhook_server_db.log"
    echo "========================================"
else
    echo "[ERROR] Server failed to start. Check webhook_server_db.log"
    exit 1
fi
