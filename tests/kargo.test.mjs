import test from 'node:test';
import assert from 'node:assert/strict';

import { kargoAyari, kargoHesapla, bedavaKargoyaKalan } from '../lib/kargo.js';

function ortam({ ucret, esik } = {}) {
  if (ucret === undefined) delete process.env.KARGO_UCRETI;
  else process.env.KARGO_UCRETI = String(ucret);
  if (esik === undefined) delete process.env.KARGO_BEDAVA_ESIK;
  else process.env.KARGO_BEDAVA_ESIK = String(esik);
}

test('kargo tanımlı değilse ücret alınmaz ve sitede gösterilmez', () => {
  ortam();
  assert.equal(kargoAyari().aktif, false);
  assert.equal(kargoHesapla(0), 0);
  assert.equal(kargoHesapla(100000), 0);
});

test('sabit kargo ücreti her tutarda uygulanır', () => {
  ortam({ ucret: 150 });
  assert.equal(kargoAyari().aktif, true);
  assert.equal(kargoHesapla(0), 150);
  assert.equal(kargoHesapla(50000), 150, 'eşik yokken tutar ne olursa olsun ücret alınır');
});

test('eşik aşılınca kargo bedava olur', () => {
  ortam({ ucret: 150, esik: 2000 });
  assert.equal(kargoHesapla(1999), 150);
  assert.equal(kargoHesapla(2000), 0, 'eşiğe tam ulaşmak yeterli olmalı');
  assert.equal(kargoHesapla(2001), 0);
});

test('bedava kargoya kalan tutar doğru hesaplanır', () => {
  ortam({ ucret: 150, esik: 2000 });
  assert.equal(bedavaKargoyaKalan(0), 2000);
  assert.equal(bedavaKargoyaKalan(1500), 500);
  assert.equal(bedavaKargoyaKalan(2000), 0);
  assert.equal(bedavaKargoyaKalan(3000), 0);

  ortam({ ucret: 150 });
  assert.equal(bedavaKargoyaKalan(0), 0, 'eşik yoksa kalan tutar gösterilmez');
});

test('geçersiz ortam değerleri kargoyu kapatır, çökertmez', () => {
  for (const bozuk of ['abc', '-50', '', '0']) {
    ortam({ ucret: bozuk });
    assert.equal(kargoHesapla(500), 0, `"${bozuk}" için ücret alınmamalı`);
    assert.equal(kargoAyari().aktif, false);
  }
  ortam();
});

test('ondalıklı ücret tam sayıya yuvarlanır', () => {
  ortam({ ucret: '149.6' });
  assert.equal(kargoHesapla(100), 150);
  ortam();
});
