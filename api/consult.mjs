const purposes = ['세무 회계 상담', '이 사이트 기능 상담', '그 외에 이 사이트 주인에게 문의하기'];
const reply = (status, message, headers) => Response.json({message}, {status, headers: {'Cache-Control':'no-store', ...headers}});
const accepted = () => reply(200, '문의가 접수되었습니다. 남겨 주신 연락처로 답변드리겠습니다.');
const maxBytes = 16 * 1024;
const windowMs = 10 * 60 * 1000;
// The firewall enforces the shared limit. This second limit covers concurrent sends on one instance.
const sendWindows = new Map();

function reserveSend(ip) {
  const now = Date.now();
  // Windows are inserted in expiry order.
  for (const [key, entry] of sendWindows) {
    if (entry.until > now) break;
    sendWindows.delete(key);
  }
  const entry = sendWindows.get(ip);
  if (!entry) sendWindows.set(ip, {count: 1, until: now + windowMs});
  else if (entry.count >= 3) return false;
  else entry.count++;
  return true;
}

function validEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || /[\r\n]/.test(value)) return false;
  const [local, domain, ...extra] = value.split('@');
  return extra.length === 0 && local.length <= 64 && domain !== undefined &&
    /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local) &&
    /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(domain);
}

async function consult(request) {
  if (request.method !== 'POST') return reply(405, '잘못된 요청입니다.', {Allow: 'POST'});
  if (request.headers.get('origin') !== 'https://taxhaejwo.vercel.app') return reply(403, '이 사이트에서 다시 접수해 주세요.');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply(415, '잘못된 요청입니다.');
  if (Number(request.headers.get('content-length')) > maxBytes) return reply(413, '문의 내용이 너무 깁니다.');
  let input;
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request.body) {
      size += chunk.byteLength;
      if (size > maxBytes) return reply(413, '문의 내용이 너무 깁니다.');
      chunks.push(chunk);
    }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return reply(400, '입력 내용을 확인해 주세요.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400, '입력 내용을 확인해 주세요.');
  const {purpose, email, phone, message, consent, overseasConsent, website} = input;
  if (!purposes.includes(purpose) || !validEmail(email) || typeof website !== 'string' ||
      typeof phone !== 'string' || phone.length > 32 || /[\r\n]/.test(phone) ||
      (phone && (!/^\+?[\d()\s-]*$/.test(phone) || !/^\d{7,15}$/.test(phone.replace(/\D/g,'')))) ||
      typeof message !== 'string' || message.trim().length < 5 || message.length > 3000 || consent !== true || overseasConsent !== true) return reply(400, '연락처, 문의 내용과 전송 동의를 확인해 주세요.');
  if (website !== '') return accepted();
  const {GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, CONSULT_ENABLED, CONSULT_RECIPIENT: owner} = process.env;
  // Enable only after the /api/consult firewall rate limit is active.
  if (CONSULT_ENABLED !== 'true' || !validEmail(owner) || !GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) return reply(503, '상담 이메일 연결을 준비 중입니다. 잠시 후 다시 이용해 주세요.');
  if (!reserveSend(request.headers.get('x-vercel-forwarded-for'))) return reply(429, '잠시 기다린 뒤 다시 시도해 주세요.');
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
    return accepted();
  } catch {
    console.error('Consultation Gmail request failed:', stage);
    return reply(502, stage === 'delivery' ? '접수 결과를 확인하지 못했습니다. 중복 접수를 피하려면 잠시 기다린 뒤 다시 시도해 주세요.' : '이메일 연결에 문제가 있습니다. 잠시 후 다시 이용해 주세요.');
  }
}

export default {fetch: consult};
