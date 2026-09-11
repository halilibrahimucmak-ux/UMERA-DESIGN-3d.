import test from 'node:test';
import assert from 'node:assert/strict';

import {
  abajurGeometrisi, manifoldKontrol, hacimHesapla, ortalamaYaricap,
  KALITE, YAKA_YUKSEKLIGI, HAT_GENISLIGI,
} from '../lib/abajur-geometri.mjs';
import { DELIK_DESENLERI, delikAlani, delikAlaniFonksiyonu, CUBUK_ARALIK } from '../lib/abajur-delik.mjs';
import { normalizeAbajurConfig, quoteAbajur } from '../lib/abajur.js';
import { uret } from '../lib/siparis-stl.mjs';

const DESENLER = ['elmas', 'petek', 'organik'];

const SENARYOLAR = [
  ['varsayılan', {}],
  ['küçük E14', { duyTipi: 'E14', altCap: 130, ustCap: 110, yukseklik: 160 }],
  ['büyük çan', { profil: 'can', altCap: 220, ustCap: 90, yukseklik: 240 }],
  ['fıçı', { profil: 'fici', bel: 20, altCap: 170, ustCap: 170 }],
  ['nervürlü gövde', { desen: 'nervur', nervurSayisi: 20, derinlik: 3 }],
  ['ince duvar', { cidar: 0.84 }],
];

function ayar(ek) {
  return normalizeAbajurConfig({ desen: 'duz', ...ek });
}

test('delik desenleri su geçirmez ağ üretir', () => {
  for (const delik of DESENLER) {
    for (const [ad, ek] of SENARYOLAR) {
      const p = ayar({ ...ek, delik, cubukKalinlik: 2.5 });
      const k = manifoldKontrol(abajurGeometrisi(p, KALITE.uretim));
      assert.equal(
        k.kapali, true,
        `${delik}/${ad}: ağ kapalı değil (açık=${k.acikKenar} ters=${k.tersSarim} dejenere=${k.dejenereUcgen})`
      );
    }
  }
});

test('çubuk kalınlığı istenen ölçüyü tutar', () => {
  for (const delik of DESENLER) {
    for (const cubuk of [2, 3, 4.5]) {
      const p = ayar({ delik, cubukKalinlik: cubuk });
      const { f } = delikAlaniFonksiyonu(p, Math.min(YAKA_YUKSEKLIGI, p.yukseklik * 0.22), ortalamaYaricap(p));
      // f, çubuk ekseninde en büyük değerine (yarı kalınlık) ulaşır
      let enBuyuk = 0;
      for (let u = 0.2; u <= 0.8; u += 0.004) {
        for (let c = 0; c < 160; c++) {
          const v = f((c / 160) * Math.PI * 2, u);
          if (v < 50) enBuyuk = Math.max(enBuyuk, v);
        }
      }
      assert.ok(
        Math.abs(enBuyuk * 2 - cubuk) < 0.06,
        `${delik}: çubuk ${(enBuyuk * 2).toFixed(2)} mm, beklenen ${cubuk} mm`
      );
    }
  }
});

test('delikler üst yaka ve alt halka bantlarına taşmaz', () => {
  for (const delik of DESENLER) {
    const p = ayar({ delik });
    const yaka = Math.min(YAKA_YUKSEKLIGI, p.yukseklik * 0.22);
    const alan = delikAlani(p, yaka);
    const { f } = delikAlaniFonksiyonu(p, yaka, ortalamaYaricap(p));
    for (let u = 0; u <= 1; u += 0.002) {
      const t = u * p.yukseklik;
      if (t >= alan.alt && t <= alan.ust) continue;
      for (let c = 0; c < 48; c++) {
        assert.ok(
          f((c / 48) * Math.PI * 2, u) >= 0,
          `${delik}: ${t.toFixed(1)} mm yüksekliğinde bantta delik var — taşıyıcı bağlantısı zayıflar`
        );
      }
    }
  }
});

test('en kısa gövdede bile delik açılır ve ağ kapalı kalır', () => {
  // Alt sınır 80 mm; yaka ve bantlar çıktıktan sonra hâlâ delik alanı kalır.
  const p = ayar({ yukseklik: 80, delik: 'organik' });
  const yaka = Math.min(YAKA_YUKSEKLIGI, p.yukseklik * 0.22);
  const alan = delikAlani(p, yaka);
  assert.equal(alan.yeterli, true, 'en kısa gövdede delik alanı kalmadı');
  assert.equal(manifoldKontrol(abajurGeometrisi(p, KALITE.uretim)).kapali, true);
});

test('delik alanı kalmadığında desen sessizce iptal olur', () => {
  // Savunma yolu: yaka gövdeyi yutarsa delik açmak yerine kapalı kabuk üret.
  const p = ayar({ yukseklik: 80, delik: 'organik' });
  assert.equal(delikAlaniFonksiyonu(p, 60, ortalamaYaricap(p)), null);
});

test('aynı yapılandırma her zaman aynı modeli verir', () => {
  // Sipariş aylar sonra yeniden basıldığında desen kaymamalı
  const p = ayar({ delik: 'organik', delikTohum: 42 });
  const a = abajurGeometrisi(p, KALITE.uretim).attributes.position.array;
  const b = abajurGeometrisi(p, KALITE.uretim).attributes.position.array;
  assert.equal(a.length, b.length, 'üçgen sayısı değişti');
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) assert.fail(`konum ${i} farklı: ${a[i]} != ${b[i]}`);
  }
});

test('farklı tohum farklı desen üretir', () => {
  const a = abajurGeometrisi(ayar({ delik: 'organik', delikTohum: 1 }), KALITE.uretim);
  const b = abajurGeometrisi(ayar({ delik: 'organik', delikTohum: 2 }), KALITE.uretim);
  const pa = a.attributes.position.array;
  const pb = b.attributes.position.array;
  const ayni = pa.length === pb.length && pa.every((v, i) => v === pb[i]);
  assert.equal(ayni, false, 'tohum değişti ama desen aynı kaldı');
});

test('petek tohumdan bağımsızdır (düzgün ızgara)', () => {
  const a = abajurGeometrisi(ayar({ delik: 'petek', delikTohum: 1 }), KALITE.uretim).attributes.position.array;
  const b = abajurGeometrisi(ayar({ delik: 'petek', delikTohum: 999 }), KALITE.uretim).attributes.position.array;
  assert.equal(a.length, b.length);
  assert.ok(a.every((v, i) => v === b[i]), 'petek deseni tohuma göre değişmemeli');
});

test('delikler malzemeyi ve fiyatı belirgin düşürür', () => {
  const kapali = quoteAbajur({ desen: 'duz', delik: 'yok' });
  for (const delik of DESENLER) {
    const delikli = quoteAbajur({ desen: 'duz', delik });
    assert.ok(delikli.gram < kapali.gram * 0.7, `${delik}: ağırlık yeterince düşmedi (${delikli.gram}g / ${kapali.gram}g)`);
    assert.ok(delikli.birim < kapali.birim, `${delik}: fiyat düşmedi`);
  }
});

test('delikli modelde boş katman oluşmaz', () => {
  for (const delik of DESENLER) {
    const p = ayar({ delik, cubukKalinlik: 2.2 });
    const { stl, olcu } = uret({ config: p });
    const dv = new DataView(stl);
    const n = dv.getUint32(80, true);
    const zMin = new Float64Array(n);
    const zMax = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;
      const z = [0, 1, 2].map(k => dv.getFloat32(o + k * 12 + 8, true));
      zMin[i] = Math.min(...z);
      zMax[i] = Math.max(...z);
    }
    for (let z = 0.4; z < olcu.yukseklik - 0.4; z += 1) {
      let kesen = false;
      for (let i = 0; i < n; i++) {
        if (zMin[i] <= z && zMax[i] >= z) { kesen = true; break; }
      }
      assert.ok(kesen, `${delik}: ${z.toFixed(1)} mm yüksekliğinde katman boş`);
    }
  }
});

test('yapılandırma alanları doğrulanır', () => {
  assert.equal(normalizeAbajurConfig({ delik: 'bilinmeyen' }).delik, 'yok');
  assert.equal(normalizeAbajurConfig({}).delik, 'yok');
  assert.ok(DELIK_DESENLERI.includes(normalizeAbajurConfig({ delik: 'petek' }).delik));

  // çubuk kalınlığı güvenli aralığa sıkışır
  assert.equal(normalizeAbajurConfig({ cubukKalinlik: 0.1 }).cubukKalinlik, CUBUK_ARALIK[0]);
  assert.equal(normalizeAbajurConfig({ cubukKalinlik: 99 }).cubukKalinlik, CUBUK_ARALIK[1]);
  assert.equal(normalizeAbajurConfig({ cubukKalinlik: '2,8' }).cubukKalinlik, 2.8, 'virgüllü yazım kabul edilmeli');

  assert.equal(normalizeAbajurConfig({ delikTohum: 7.6 }).delikTohum, 8);
  assert.equal(normalizeAbajurConfig({ delikBoyu: 1000 }).delikBoyu, 45);
});

test('ince çubuk iş emrinde uyarı verir', () => {
  const p = normalizeAbajurConfig({ desen: 'duz', delik: 'elmas', cubukKalinlik: 1.6 });
  const { isEmri } = uret({ config: p });
  assert.ok(
    isEmri.uyarilar.some(u => /kafes kırılgan/.test(u)),
    `ince çubuk uyarısı yok: ${JSON.stringify(isEmri.uyarilar)}`
  );
  assert.match(isEmri.delikDeseni, /Elmas kafes/);
});
