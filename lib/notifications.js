import { odemeMetni, odemeTalimati } from './odeme.js';

const NOTIFY_STATUSES = new Set([
  'Ödeme Bekleniyor',
  'Ödeme Alındı',
  'Onaylandı',
  'Hazırlanıyor',
  'Kargoya Hazır',
  'Kargolandı',
  'Tamamlandı',
  'İptal'
]);

const STATUS_COPY = {
  'Ödeme Bekleniyor': 'Siparişiniz alındı. Aşağıdaki hesaba havale/EFT yaptığınızda üretime başlıyoruz.',
  'Ödeme Alındı': 'Ödemeniz hesabımıza geçti. Siparişiniz üretim sırasına alındı.',
  'Onaylandı': 'Siparişiniz onaylandı.',
  'Hazırlanıyor': 'Siparişiniz hazırlanmaya başladı.',
  'Kargoya Hazır': 'Siparişiniz paketlendi ve kargoya teslim edilmeye hazır.',
  'Kargolandı': 'Siparişiniz kargoya verildi.',
  'Tamamlandı': 'Siparişiniz tamamlandı. Bizi tercih ettiğiniz için teşekkür ederiz.',
  'İptal': 'Siparişiniz iptal edildi. Ayrıntılı bilgi için bizimle iletişime geçebilirsiniz.'
};

function cleanPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('90')) return digits;
  if (digits.startsWith('0')) return `90${digits.slice(1)}`;
  return digits.length === 10 ? `90${digits}` : digits;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function orderStatusMessage(order) {
  const detail = STATUS_COPY[order.status] || `Siparişinizin durumu “${order.status}” olarak güncellendi.`;
  // Ödeme bekleyen siparişte IBAN mesajın içinde gider; müşteri ayrıca
  // bir yere bakmak zorunda kalmasın.
  const odeme = order.status === 'Ödeme Bekleniyor' ? odemeMetni(order) : '';
  const bloklar = [
    `Merhaba ${order.name},`,
    `${order.orderNo} numaralı UMERA Design 3D siparişiniz hakkında bilgi:\n${detail}`,
    `Güncel durum: ${order.status}`,
    odeme,
    'UMERA Design 3D\nHayal Et. Tasarla. Gerçekleştir.'
  ];
  return bloklar.filter(Boolean).join('\n\n');
}

export function whatsappFallbackUrl(order) {
  const phone = cleanPhone(order.phone);
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(orderStatusMessage(order))}` : '';
}

async function sendWhatsAppTemplate(order) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_STATUS_TEMPLATE_NAME;
  if (!token || !phoneNumberId || !templateName || !order.phone) return { channel: 'whatsapp', configured: false, sent: false };

  const phone = cleanPhone(order.phone);
  if (!phone) return { channel: 'whatsapp', configured: true, sent: false, error: 'Geçerli telefon numarası yok.' };
  const version = process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: process.env.WHATSAPP_STATUS_TEMPLATE_LANGUAGE || 'tr' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: String(order.name || 'Müşterimiz').slice(0, 120) },
            { type: 'text', text: String(order.orderNo || '').slice(0, 120) },
            { type: 'text', text: String(order.status || '').slice(0, 120) }
          ]
        }]
      }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `WhatsApp API ${response.status}`);
  return { channel: 'whatsapp', configured: true, sent: true, id: payload.messages?.[0]?.id || '' };
}

async function sendEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ORDER_NOTIFICATION_FROM;
  if (!apiKey || !from || !order.email) return { channel: 'email', configured: Boolean(apiKey && from), sent: false };

  const message = orderStatusMessage(order);
  const safeName = escapeHtml(order.name || 'Müşterimiz');
  const safeOrderNo = escapeHtml(order.orderNo);
  const safeStatus = escapeHtml(order.status);
  const safeDetail = escapeHtml(STATUS_COPY[order.status] || `Durum: ${order.status}`);

  // Ödeme bekleyen siparişte IBAN kartı e-postanın içine gömülür; WhatsApp
  // şablonu serbest metin kabul etmediği için ayrıntı yalnızca burada olur.
  const odeme = order.status === 'Ödeme Bekleniyor' ? odemeTalimati(order) : null;
  const odemeHtml = odeme
    ? `<div style="margin-top:22px;padding:18px;border:1px solid #ded5ca;border-radius:12px">
         <div style="font-size:11px;letter-spacing:2px;color:#8a5b32;margin-bottom:10px">HAVALE / EFT BİLGİLERİ</div>
         ${odeme.banka ? `<div style="margin-bottom:6px"><span style="color:#6e6259">Banka:</span> <strong>${escapeHtml(odeme.banka)}</strong></div>` : ''}
         <div style="margin-bottom:6px"><span style="color:#6e6259">Alıcı:</span> <strong>${escapeHtml(odeme.alici)}</strong></div>
         <div style="margin-bottom:6px"><span style="color:#6e6259">IBAN:</span> <strong style="font-family:monospace;font-size:15px">${escapeHtml(odeme.iban)}</strong></div>
         <div style="margin-bottom:6px"><span style="color:#6e6259">Tutar:</span> <strong>${escapeHtml(String(odeme.tutar))} TL</strong></div>
         <div style="margin-top:12px;padding:11px;background:#f5f1ea;border-radius:8px">
           Açıklama alanına <strong>${escapeHtml(odeme.aciklama)}</strong> yazın.<br>
           <span style="color:#6e6259;font-size:13px">Ödemenizi siparişinizle bu numara üzerinden eşleştiriyoruz.</span>
         </div>
       </div>`
    : '';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'UMERA-Design-3D/1.0',
      'Idempotency-Key': `order-status/${String(order.orderNo).replace(/[^a-zA-Z0-9_-]/g, '-')}/${String(order.status).replace(/[^a-zA-Z0-9_-]/g, '-')}`
    },
    body: JSON.stringify({
      from,
      to: [order.email],
      subject: `${safeOrderNo} numaralı siparişiniz: ${safeStatus}`,
      text: message,
      html: `<div style="background:#f5f1ea;padding:32px 16px;font-family:Arial,sans-serif;color:#1c1713"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #ded5ca;border-radius:16px;padding:32px"><div style="font-size:12px;letter-spacing:3px;color:#8a5b32">UMERA DESIGN 3D</div><h1 style="font-size:24px;margin:16px 0 8px">Sipariş durumunuz güncellendi</h1><p>Merhaba ${safeName},</p><p><strong>${safeOrderNo}</strong> numaralı siparişiniz hakkında bilgi:</p><p style="font-size:17px">${safeDetail}</p><div style="margin-top:24px;padding:16px;background:#f5f1ea;border-radius:10px">Güncel durum: <strong>${safeStatus}</strong></div>${odemeHtml}<p style="margin-top:28px;color:#6e6259;font-size:13px">Hayal Et. Tasarla. Gerçekleştir.</p></div></div>`,
      tags: [{ name: 'category', value: 'order-status' }]
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `E-posta API ${response.status}`);
  return { channel: 'email', configured: true, sent: true, id: payload.id || '' };
}

export async function sendOrderStatusNotification(order) {
  const fallbackUrl = whatsappFallbackUrl(order);
  if (!NOTIFY_STATUSES.has(order.status)) {
    return { attempted: false, sent: false, reason: 'status-not-notifiable', channels: [], fallbackUrl };
  }
  if (order.previousStatus === order.status) {
    return { attempted: false, sent: false, reason: 'status-unchanged', channels: [], fallbackUrl };
  }

  const channels = [];
  for (const sender of [sendWhatsAppTemplate, sendEmail]) {
    try {
      channels.push(await sender(order));
    } catch (error) {
      channels.push({ channel: sender === sendEmail ? 'email' : 'whatsapp', configured: true, sent: false, error: error.message });
    }
  }
  return {
    attempted: channels.some(item => item.configured),
    sent: channels.some(item => item.sent),
    channels,
    fallbackUrl
  };
}

