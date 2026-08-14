import test from 'node:test';
import assert from 'node:assert/strict';

import { ibanBicimle, ibanGecerli, ibanSadelestir, odemeBilgisi, odemeTalimati, odemeMetni } from '../lib/odeme.js';
import { orderStatusMessage, sendOrderStatusNotification } from '../lib/notifications.js';

// Türkiye Cumhuriyet Merkez Bankası'nın yayımladığı örnek TR IBAN biçimi
const GECERLI = 'TR330006100519786457841326';

function ortamKur({ iban = GECERLI, alici = 'UMERA Design 3D', banka = 'Örnek Bankası' } = {}) {
  process.env.ODEME_IBAN = iban;
  process.env.ODEME_ALICI = alici;
  process.env.ODEME_BANKA = banka;
}

function ortamSil() {
  delete process.env.ODEME_IBAN;
  delete process.env.ODEME_ALICI;
  delete process.env.ODEME_BANKA;
  for (const ad of ['RESEND_API_KEY', 'ORDER_NOTIFICATION_FROM', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_STATUS_TEMPLATE_NAME']) {
    delete process.env[ad];
  }
}

test('IBAN sağlaması yanlış girilmiş numarayı yakalar', () => {
  assert.equal(ibanGecerli(GECERLI), true);
  assert.equal(ibanGecerli('TR33 0006 1005 1978 6457 8413 26'), true, 'boşluklu biçim kabul edilmeli');

  // tek hane değiştirildiğinde mod-97 tutmamalı — müşterinin parası
  // başkasına gitmesin diye bu kontrol önemli
  assert.equal(ibanGecerli('TR330006100519786457841327'), false);
  assert.equal(ibanGecerli('TR33000610051978645784132'), false, 'eksik haneli');
  assert.equal(ibanGecerli('DE89370400440532013000'), false, 'TR dışı');
  assert.equal(ibanGecerli(''), false);
});

test('IBAN dörtlü gruplar halinde okunabilir biçimde gösterilir', () => {
  assert.equal(ibanBicimle('tr330006100519786457841326'), 'TR33 0006 1005 1978 6457 8413 26');
  assert.equal(ibanSadelestir(' tr33 0006\t1005 '), 'TR3300061005');
});

test('ödeme bilgisi ortam değişkeni yoksa null döner', () => {
  ortamSil();
  assert.equal(odemeBilgisi(), null);
  assert.equal(odemeTalimati({ orderNo: 'UM-1', total: 100 }), null);
  assert.equal(odemeMetni({ orderNo: 'UM-1', total: 100 }), '');
});

test('ödeme talimatı açıklama olarak sipariş numarasını taşır', () => {
  ortamKur();
  const t = odemeTalimati({ orderNo: 'UM-ABC123', total: 2450 });
  assert.equal(t.aciklama, 'UM-ABC123', 'açıklama sipariş numarası olmalı — eşleştirmenin tek yolu bu');
  assert.equal(t.tutar, 2450);
  assert.equal(t.gecerli, true);
  assert.match(t.iban, /^TR33 0006/);

  const metin = odemeMetni({ orderNo: 'UM-ABC123', total: 2450 });
  assert.match(metin, /UM-ABC123/);
  assert.match(metin, /TR33 0006 1005/);
  ortamSil();
});

test('geçersiz IBAN gecerli=false ile işaretlenir ama akış durmaz', () => {
  ortamKur({ iban: 'TR330006100519786457841327' });
  const t = odemeTalimati({ orderNo: 'UM-1', total: 10 });
  assert.equal(t.gecerli, false);
  ortamSil();
});

test('"Ödeme Bekleniyor" mesajı IBAN içerir, diğer durumlar içermez', () => {
  ortamKur();
  const temel = { orderNo: 'UM-XYZ', name: 'Ayşe Yılmaz', total: 1200 };

  const bekleyen = orderStatusMessage({ ...temel, status: 'Ödeme Bekleniyor' });
  assert.match(bekleyen, /TR33 0006 1005/, 'ödeme bekleyen mesajda IBAN olmalı');
  assert.match(bekleyen, /Açıklama: UM-XYZ/);

  const kargolandi = orderStatusMessage({ ...temel, status: 'Kargolandı' });
  assert.doesNotMatch(kargolandi, /TR33/, 'kargo mesajında IBAN olmamalı');
  assert.match(kargolandi, /kargoya verildi/i);

  const odendi = orderStatusMessage({ ...temel, status: 'Ödeme Alındı' });
  assert.match(odendi, /Ödemeniz hesabımıza geçti/);
  assert.doesNotMatch(odendi, /TR33/);
  ortamSil();
});

test('ödeme durumları müşteri bildirimini tetikler', async () => {
  ortamSil();
  ortamKur();
  for (const durum of ['Ödeme Bekleniyor', 'Ödeme Alındı']) {
    const sonuc = await sendOrderStatusNotification({
      orderNo: 'UM-1', name: 'Ali', phone: '05321112233', total: 500,
      status: durum, previousStatus: 'Yeni'
    });
    assert.notEqual(sonuc.reason, 'status-not-notifiable', `${durum} bildirilebilir olmalı`);
    assert.match(sonuc.fallbackUrl, /^https:\/\/wa\.me\/905321112233/);
  }
  ortamSil();
});
