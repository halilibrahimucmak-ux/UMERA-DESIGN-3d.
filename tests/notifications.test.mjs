import test from 'node:test';
import assert from 'node:assert/strict';
import { orderStatusMessage, sendOrderStatusNotification, whatsappFallbackUrl } from '../lib/notifications.js';

const baseOrder = {
  orderNo: 'UM-TEST123',
  name: 'Ayşe Yılmaz',
  phone: '0532 111 22 33',
  email: 'ayse@example.com',
  status: 'Hazırlanıyor',
  previousStatus: 'Onaylandı'
};

function clearNotificationEnv() {
  for (const name of [
    'RESEND_API_KEY',
    'ORDER_NOTIFICATION_FROM',
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_STATUS_TEMPLATE_NAME',
    'WHATSAPP_STATUS_TEMPLATE_LANGUAGE',
    'WHATSAPP_GRAPH_VERSION'
  ]) delete process.env[name];
}

test('WhatsApp fallback Türkiye telefonunu ve durum mesajını hazırlar', () => {
  const url = whatsappFallbackUrl(baseOrder);
  assert.match(url, /^https:\/\/wa\.me\/905321112233\?text=/);
  assert.match(decodeURIComponent(url), /siparişiniz hazırlanmaya başladı/i);
  assert.match(orderStatusMessage(baseOrder), /UM-TEST123/);
});

test('aynı durum için yinelenen bildirim göndermez', async () => {
  clearNotificationEnv();
  const result = await sendOrderStatusNotification({ ...baseOrder, previousStatus: 'Hazırlanıyor' });
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'status-unchanged');
});

test('servis ayarlı değilse hazır WhatsApp bağlantısı döndürür', async () => {
  clearNotificationEnv();
  const result = await sendOrderStatusNotification(baseOrder);
  assert.equal(result.sent, false);
  assert.equal(result.attempted, false);
  assert.match(result.fallbackUrl, /wa\.me\/905321112233/);
});

test('Resend ayarlıysa otomatik e-posta gönderir', async () => {
  clearNotificationEnv();
  process.env.RESEND_API_KEY = 're_test';
  process.env.ORDER_NOTIFICATION_FROM = 'UMERA <siparis@example.com>';
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ id: 'email_123' }) };
  };
  try {
    const result = await sendOrderStatusNotification(baseOrder);
    assert.equal(result.sent, true);
    assert.equal(result.channels.find(item => item.channel === 'email')?.id, 'email_123');
    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.match(request.options.body, /Hazırlanıyor/);
  } finally {
    globalThis.fetch = originalFetch;
    clearNotificationEnv();
  }
});

test('WhatsApp Cloud API ayarlıysa onaylı şablonu kullanır', async () => {
  clearNotificationEnv();
  process.env.WHATSAPP_ACCESS_TOKEN = 'token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '12345';
  process.env.WHATSAPP_STATUS_TEMPLATE_NAME = 'umera_siparis_durumu';
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ messages: [{ id: 'wamid.123' }] }) };
  };
  try {
    const result = await sendOrderStatusNotification({ ...baseOrder, email: '' });
    assert.equal(result.sent, true);
    assert.equal(result.channels.find(item => item.channel === 'whatsapp')?.id, 'wamid.123');
    assert.equal(requestBody.to, '905321112233');
    assert.equal(requestBody.template.name, 'umera_siparis_durumu');
    assert.equal(requestBody.template.components[0].parameters[2].text, 'Hazırlanıyor');
  } finally {
    globalThis.fetch = originalFetch;
    clearNotificationEnv();
  }
});

