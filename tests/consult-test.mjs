import assert from 'node:assert/strict';
import {mock, test} from 'node:test';
import consult from '../api/consult.mjs';

test('consult validates before delivery and limits concurrent sends', async () => {
  const origin = 'https://taxhaejwo.vercel.app';
  const valid = {purpose: '세무 회계 상담', phone: '', email: 'user+tag@example.org',
    message: '문의 내용 <b>&\nBcc: inside body', consent: true, overseasConsent: true, website: ''};
  const headers = {origin, 'content-type': 'Application/JSON; charset=UTF-8', 'x-vercel-forwarded-for': '192.0.2.1'};
  Object.assign(process.env, {CONSULT_ENABLED: 'true', CONSULT_RECIPIENT: 'owner@example.org',
    GMAIL_CLIENT_ID: 'fixture', GMAIL_CLIENT_SECRET: 'fixture', GMAIL_REFRESH_TOKEN: 'fixture'});
  const sent = [];
  const gmail = mock.method(globalThis, 'fetch', async (url, init) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({access_token: 'fixture'});
    assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    sent.push(Buffer.from(JSON.parse(init.body).raw, 'base64url').toString());
    return Response.json({id: 'receipt'});
  });
  async function check(status, data = valid, options = {}) {
    const request = new Request(origin + '/api/consult', {
      method: 'POST', body: JSON.stringify(data), ...options, headers: {...headers, ...options.headers}
    });
    const response = await consult.fetch(request);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const json = await response.json();
    assert.deepEqual(Object.keys(json), ['message']);
    assert.equal(typeof json.message, 'string');
    return json.message;
  }
  for (const method of ['GET', 'OPTIONS']) await check(405, valid, {method, body: undefined});
  for (const origin of ['', 'https://taxhaejwo.vercel.app.other.example']) await check(403, valid, {headers: {origin}});
  for (const type of ['', 'application/jsonx', 'text/plain']) await check(415, valid, {headers: {'content-type': type}});
  for (const body of ['', '{', 'null', '[]']) await check(400, valid, {body});
  await check(413, valid, {headers: {'content-length': '16385'}});
  const padded = JSON.stringify(valid);
  const exact = ' '.repeat(16384 - Buffer.byteLength(padded)) + padded;
  const stream = new ReadableStream({start(c) {
    c.enqueue(Buffer.from(exact)); c.enqueue(Buffer.from(' ')); c.close();
  }});
  await check(413, valid, {body: stream, duplex: 'half'});
  for (const key of Object.keys(valid)) {
    for (const value of [[], {}, null, undefined]) await check(400, {...valid, [key]: value});
  }
  for (const key of ['email', 'phone', 'purpose']) {
    for (const newline of ['\r', '\n', '\r\nBcc: x@example.org']) await check(400, {...valid, [key]: valid[key] + newline});
  }
  for (const patch of [{purpose: 'other'}, {phone: '123456'}, {phone: '1'.repeat(16)}, {phone: ' '.repeat(33)},
    {phone: 'call1234567'}, {message: '1234'}, {message: 'x'.repeat(3001)}, {email: 'a@x..com'},
    {email: 'a'.repeat(250) + '@x.com'}, {consent: 'true'}, {overseasConsent: false}]) {
    await check(400, {...valid, ...patch});
  }
  const trap = await check(200, {...valid, website: 'bot'});
  assert.equal(gmail.mock.callCount(), 0);
  assert.equal(await check(200, valid, {body: exact}), trap);
  assert.equal(sent.length, 1);
  const [fields, encoded] = sent[0].split('\r\n\r\n');
  assert(fields.includes('From: owner@example.org\r\nTo: owner@example.org\r\nReply-To: ' + valid.email + '\r\n'));
  assert(fields.includes('Content-Type: text/plain; charset=UTF-8'));
  assert(!/^(?:Cc|Bcc):/im.test(fields));
  assert(Buffer.from(encoded, 'base64').toString().endsWith(valid.message));
  await Promise.all([
    check(200, {...valid, purpose: '이 사이트 기능 상담', phone: '+82 (10) 1234-5678'}),
    check(200, {...valid, purpose: '그 외에 이 사이트 주인에게 문의하기', message: 'x'.repeat(3000)}),
    check(429)
  ]);
  assert.equal(sent.length, 3);
  await check(200, valid, {headers: {'x-vercel-forwarded-for': '192.0.2.2'}});
  const future = Date.now() + 600001;
  mock.method(Date, 'now', () => future);
  await check(200);
  delete process.env.CONSULT_RECIPIENT;
  await check(503);
  assert.equal(sent.length, 5);
});
