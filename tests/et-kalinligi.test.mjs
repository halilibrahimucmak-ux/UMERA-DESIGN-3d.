import test from 'node:test';
import assert from 'node:assert/strict';

import { disR, etOlcegi, ET_OLCEK_TAVANI, HAT_GENISLIGI } from '../lib/abajur-geometri.mjs';
import { normalizeAbajurConfig } from '../lib/abajur.js';
import { createOrderStl } from '../lib/order-stl.js';

/**
 * Duvar yarıçap yönünde sabit kesilirse yüzey eğildikçe dike bakan gerçek et
 * incelir. 0.42 mm hat genişliğinin altına inen katmanları Bambu Studio hiç
 * basmaz ve "boş katman" uyarısı verir — bu, sahada karşılaşılan bir hataydı.
 */
function enInceDikEt(p) {
  let enAz = Infinity;
  for (let u = 0; u <= 1; u += 0.004) {
    for (let c = 0; c < 32; c++) {
      const th = (c / 32) * Math.PI * 2;
      const ro = disR(th, u, p);
      const ri = Math.max(0.5, ro - p.cidar * etOlcegi(th, u, p, ro));

      // gerçek (tavansız) eğim ölçeği
      const dT = 1e-3, du = 5e-4;
      const rT = (disR(th + dT, u, p) - disR(th - dT, u, p)) / (2 * dT);
      const u0 = Math.max(0, u - du), u1 = Math.min(1, u + du);
      const rU = (disR(th, u1, p) - disR(th, u0, p)) / (u1 - u0);
      const olcek = Math.sqrt(1 + (rT / Math.max(1, ro)) ** 2 + (rU / p.yukseklik) ** 2);

      enAz = Math.min(enAz, (ro - ri) / olcek);
    }
  }
  return enAz;
}

const DIK_SENARYOLAR = [
  ['varsayılan', {}],
  ['dik dalga', { desen: 'dalga', dalgaSayisi: 20, derinlik: 12, altCap: 150, ustCap: 150 }],
  ['orta dalga', { desen: 'dalga', dalgaSayisi: 12, derinlik: 6 }],
  ['çan profil', { profil: 'can', altCap: 220, ustCap: 80, yukseklik: 200 }],
  ['fıçı geniş bel', { profil: 'fici', bel: 40, altCap: 150, ustCap: 150 }],
  ['ince duvar dalga', { cidar: 0.84, desen: 'dalga', dalgaSayisi: 10, derinlik: 6 }],
  ['faset', { desen: 'faset', nervurSayisi: 40 }],
  ['derin nervür burgulu', { desen: 'nervur', nervurSayisi: 48, derinlik: 8, burgu: 300 }],
];

test('yüzeye dik et kalınlığı her yerde hat genişliğinin üstünde kalır', () => {
  for (const [ad, ayar] of DIK_SENARYOLAR) {
    const p = normalizeAbajurConfig(ayar);
    const dikEt = enInceDikEt(p);
    assert.ok(
      dikEt >= HAT_GENISLIGI,
      `${ad}: en ince dik et ${dikEt.toFixed(2)} mm, hat genişliği ${HAT_GENISLIGI} mm — dilimleyici bu katmanları atlar`
    );
  }
});

test('dik et istenen duvar kalınlığını tutar', () => {
  for (const [ad, ayar] of DIK_SENARYOLAR) {
    const p = normalizeAbajurConfig(ayar);
    const dikEt = enInceDikEt(p);
    // tavana dayanmadığı sürece tam cidar çıkmalı
    assert.ok(
      Math.abs(dikEt - p.cidar) < 0.02 || dikEt > p.cidar,
      `${ad}: dik et ${dikEt.toFixed(2)} mm, beklenen ${p.cidar} mm`
    );
  }
});

test('ölçek eğimle artar ve tavanı aşmaz', () => {
  const p = normalizeAbajurConfig({ desen: 'nervur', nervurSayisi: 22, derinlik: 3 });

  // nervür tepesinde eğim sıfır -> ölçek 1
  assert.ok(Math.abs(etOlcegi(0, 0.5, p, disR(0, 0.5, p)) - 1) < 0.01, 'tepede ölçek 1 olmalı');

  // en dik yamaç n·θ = π/2 noktasında (π/n vadidir, orada da eğim sıfır)
  const yamacTheta = Math.PI / (2 * 22);
  const yamac = etOlcegi(yamacTheta, 0.5, p, disR(yamacTheta, 0.5, p));
  assert.ok(yamac > 1.05, `yamaçta ölçek 1'e yakın kaldı: ${yamac.toFixed(3)}`);

  // aşırı tasarımda tavan devreye girer ama aşılmaz
  const asiri = normalizeAbajurConfig({ desen: 'nervur', nervurSayisi: 64, derinlik: 12, burgu: 360 });
  let enBuyuk = 0;
  for (let u = 0; u <= 1; u += 0.02) {
    for (let c = 0; c < 32; c++) {
      const th = (c / 32) * Math.PI * 2;
      enBuyuk = Math.max(enBuyuk, etOlcegi(th, u, asiri, disR(th, u, asiri)));
    }
  }
  assert.ok(enBuyuk <= ET_OLCEK_TAVANI + 1e-9, `tavan aşıldı: ${enBuyuk}`);
});

test('eski siparişin yapılandırması üretim sınırlarına çekilir ve raporlanır', () => {
  // 0.6 mm duvar eski sürümde geçerliydi; bugün 2 hat = 0.84 mm altına inilemez
  const siparis = {
    orderNo: 'UM-TEST',
    configurations: [{
      quantity: 1,
      geoSurum: '2.0',
      config: {
        paket: 'set', duyTipi: 'E14', profil: 'duz', altCap: 190, ustCap: 190,
        yukseklik: 260, bel: 18, desen: 'nervur', nervurSayisi: 22, derinlik: 3,
        burgu: 0, dalgaSayisi: 6, cidar: 0.6, malzeme: 'PLA', renk: 'Kemik Beyazı',
        montaj: 'boyun', kelvin: 2700, adet: 1
      }
    }]
  };
  const r = createOrderStl(siparis, 0);

  const uyarilar = r.isEmri.uyarilar.join(' | ');
  assert.match(uyarilar, /cidar: 0\.6 -> 0\.84/, 'duvar düzeltmesi bildirilmedi');
  assert.match(uyarilar, /yukseklik: 260 -> 254/, 'yükseklik düzeltmesi bildirilmedi');
  assert.match(uyarilar, /2\.0 geometri sürümüyle/, 'sürüm uyarısı yok');
  assert.match(r.isEmri.dilimleyici.duvar, /2 duvar \(0\.84 mm\)/);
  assert.equal(r.kontrol.kapali, true);
  assert.match(r.fileName, /^UM-TEST-abajur-1-E14\.stl$/);
});

test('güncel siparişte gereksiz düzeltme uyarısı çıkmaz', () => {
  const config = normalizeAbajurConfig({});
  const siparis = { orderNo: 'UM-YENI', configurations: [{ quantity: 1, geoSurum: undefined, config }] };
  const r = createOrderStl(siparis, 0);
  assert.equal(r.isEmri.uyarilar.length, 0, `beklenmeyen uyarı: ${r.isEmri.uyarilar.join(' | ')}`);
});
