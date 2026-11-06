const owner = 'mongdingding@gmail.com';
const purposes = ['세무 회계 상담', '이 사이트 기능 상담', '그 외에 이 사이트 주인에게 문의하기'];
const reply = (status, message) => Response.json({message}, {status, headers: {'Cache-Control':'no-store'}});

export async function POST(request) {
  if (request.headers.get('origin') !== 'https://taxhaejwo.vercel.app') return reply(403, '이 사이트에서 다시 접수해 주세요.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, '잘못된 요청입니다.');
  if (Number(request.headers.get('content-length')) > 16384) return reply(413, '문의 내용이 너무 깁니다.');
  let input;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 16384) return reply(413, '문의 내용이 너무 깁니다.');
    input = JSON.parse(text);
  } catch { return reply(400, '입력 내용을 확인해 주세요.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400, '입력 내용을 확인해 주세요.');
  const {purpose, email, phone = '', message, consent, overseasConsent, website = ''} = input;
  if (website !== '') return reply(400, '접수할 수 없는 요청입니다.');
  if (!purposes.includes(purpose) || typeof email !== 'string' || email.length > 254 ||
      !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(email) ||
      typeof phone !== 'string' || phone.length > 32 || (phone && (!/^\+?[\d() -]+$/.test(phone) || phone.replace(/\D/g,'').length < 7 || phone.replace(/\D/g,'').length > 15)) ||
      typeof message !== 'string' || message.trim().length < 5 || message.length > 3000 || consent !== true || overseasConsent !== true) return reply(400, '연락처, 문의 내용과 전송 동의를 확인해 주세요.');
  const {GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, CONSULT_ENABLED} = process.env;
  // Enable only after the /api/consult firewall rate limit is active.
  if (CONSULT_ENABLED !== 'true' || !GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) return reply(503, '상담 이메일 연결을 준비 중입니다. 잠시 후 다시 이용해 주세요.');
  let stage = 'authorization';
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, signal:AbortSignal.timeout(10000),
      body:new URLSearchParams({client_id:GMAIL_CLIENT_ID, client_secret:GMAIL_CLIENT_SECRET, refresh_token:GMAIL_REFRESH_TOKEN, grant_type:'refresh_token'})
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) throw new Error('Authorization failed');
    stage = 'delivery';
    const body = ['TAX해줘 상담 접수', '', '문의 목적: '+purpose, '답변 이메일: '+email, '전화번호: '+(phone || '입력하지 않음'), '', '문의 내용', message.trim()].join('\r\n');
    const mime = ['From: '+owner, 'To: '+owner, 'Reply-To: '+email, 'Subject: =?UTF-8?B?'+Buffer.from('TAX해줘 상담 접수').toString('base64')+'?=', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(body).toString('base64').match(/.{1,76}/g).join('\r\n')].join('\r\n');
    const sent = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method:'POST', headers:{Authorization:'Bearer '+token.access_token, 'Content-Type':'application/json'},
      body:JSON.stringify({raw:Buffer.from(mime).toString('base64url')}), signal:AbortSignal.timeout(15000)
    });
    if (!sent.ok) throw new Error('Send failed');
    const result = await sent.json();
    if (!result.id) throw new Error('Missing receipt');
    return reply(200, '문의가 접수되었습니다. 남겨 주신 연락처로 답변드리겠습니다.');
  } catch {
    console.error('Consultation Gmail request failed:', stage);
    return reply(502, stage === 'delivery' ? '접수 결과를 확인하지 못했습니다. 중복 접수를 피하려면 잠시 기다린 뒤 다시 시도해 주세요.' : '이메일 연결에 문제가 있습니다. 잠시 후 다시 이용해 주세요.');
  }
}
