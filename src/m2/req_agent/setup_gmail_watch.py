import os
from googleapiclient.discovery import build
from core_logic_ollama import CoreLogicAgent
from config import GCP_PROJECT_ID, PUBSUB_TOPIC_NAME

def setup_watch():
    # CoreLogicAgent의 인증 로직 재활용
    agent = CoreLogicAgent()
    creds = agent._authenticate_gmail()
    
    if not creds:
        print("[Error] Gmail 인증에 실패했습니다.")
        return

    service = build('gmail', 'v1', credentials=creds)

    full_topic_name = f"projects/{GCP_PROJECT_ID}/topics/{PUBSUB_TOPIC_NAME}"

    print(f"[*] {full_topic_name} 에 대한 Gmail Watch를 설정합니다...")

    try:
        request_body = {
            'topicName': full_topic_name,
            'labelIds': ['INBOX'],  # 인박스에 들어오는 것만 감시
            'labelFilterAction': 'include'
        }
        
        response = service.users().watch(userId='me', body=request_body).execute()
        
        print("\n[Success] Gmail Watch 설정 완료!")
        print(f"Expiration: {response.get('expiration')}")
        print(f"History ID: {response.get('historyId')}")
        print("\n[중요 알림]")
        print("1. Google Cloud Console의 Pub/Sub Topic에서 'Gmail API Push' 서비스 계정에 권한을 주었는지 확인하세요.")
        print("   계정: gmail-api-push@system.gserviceaccount.com")
        print("   역할: Pub/Sub Publisher (게시자)")
        print("2. 해당 Topic에 Push Subscription을 생성하고, Tailscale Funnel URL을 Endpoint로 설정하세요.")
        print("   Endpoint 예시: https://your-node.tailscale.net/gmail/webhook")
        
    except Exception as e:
        print(f"\n[Error] Watch 설정 중 오류 발생: {e}")
        if "403" in str(e):
            print("힌트: Pub/Sub Topic 권한 설정(Publisher)이 누락되었을 가능성이 높습니다.")

if __name__ == "__main__":
    setup_watch()
