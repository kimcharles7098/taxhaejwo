# TAX해줘

종합소득세, 부가가치세, 월급 실수령액, 주휴수당 계산기입니다.

- 서비스: https://taxhaejwo.vercel.app/
- 각 HTML에 스타일·폰트·계산 스크립트를 포함합니다. 계산은 브라우저에서 수행하며 금액을 상담 서버로 보내지 않습니다.
- 상담 폼은 목적, 선택 전화번호, 이메일, 문의 내용과 동의를 받아 /api/consult로 전송합니다.
- 서버는 Gmail API로 운영자에게 메일을 보냅니다. 실제 운영에는 Vercel 서버 환경 변수 GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN 및 CONSULT_ENABLED=true 설정이 필요합니다. 인증 값은 저장소에 넣지 않습니다.
- 개인정보처리방침: https://taxhaejwo.vercel.app/privacy.html
- 상담 종료 후 30일 이내 운영자가 상담 메일을 직접 삭제합니다.
- 공개 상담 API는 같은 IP에서 10분당 3회로 제한합니다.

계산기는 입력한 가정에 따른 예상값입니다. 2026년 귀속 종합소득세 경비율은 요청에 따른 가정값을 포함하며 실제 신고 전에 공식 기준을 확인해야 합니다. 상담 이메일 발송에는 인터넷과 서버 연결이 필요합니다.

SUIT 폰트 라이선스는 FONT-LICENSE.txt에 있습니다.
