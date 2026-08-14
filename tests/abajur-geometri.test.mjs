import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import {
  GEO_SURUM,
  TABLA,
  PAY,
  HAT_GENISLIGI,
  KALITE,
  abajurGeometrisi,
  montajParcalari,
  manifoldKontrol,
  hacimHesapla,
  cozunurluk,
  cidarKirp,
  duvarSayisi,
  olcum,
  disR,
  DUY_MONTAJ,
  AYAK_GOMME,
} from '../lib/abajur-geometri.mjs';
import { normalizeAbajurConfig, quoteAbajur } from '../lib/abajur.js';
import { uret } from '../lib/siparis-stl.mjs';

/* Baskıya gidecek dosyanın doğruluğunu belirleyen özellikler burada
   kilitleniyor: kapalı ağ, doğru hacim, tablaya sığma ve dosya boyutu. */

const SENARYOLAR = [
  ['varsayılan', {}],
  ['düz gövde düz yüzey', { profil: 'duz', desen: 'duz' }],
  ['fıçı + dalga', { profil: 'fici', desen: 'dalga', nervurSayisi: 40, dalgaSayisi: 12, bel: 18, altCap: 160, ustCap: 160 }],
  ['çan + faset', { profil: 'can', desen: 'faset', nervurSayisi: 14, altCap: 200, ustCap: 90 }],
  ['kum saati + burgu', { profil: 'kumsaati', desen: 'nervur', nervurSayisi: 48, burgu: 220, bel: 20 }],
  ['E14 küçük', { duyTipi: 'E14', altCap: 120, ustCap: 70, yukseklik: 150 }],
  ['en büyük ölçü', { altCap: 220, ustCap: 220, yukseklik: 254, desen: 'duz' }],
];

test('her tasarımda gövde ve montaj parçaları kapalı (su geçirmez) ağdır', () => {
  for (const [ad, ayar] of SENARYOLAR) {
    const p = normalizeAbajurConfig(ayar);
    const govde = manifoldKontrol(abajurGeometrisi(p, KALITE.uretim));
    assert.equal(govde.kapali, true, `${ad}: gövde kapalı değil (${govde.acikKenar} açık kenar, ${govde.tersSarim} ters sarım)`);

    for (const [i, parca] of montajParcalari(p, KALITE.uretim).entries()) {
      const k = manifoldKontrol(parca);
      assert.equal(k.kapali, true, `${ad}: montaj parçası ${i} kapalı değil`);
    }
  }
});

test('kabuk hacmi analitik integrale eşit', () => {
  // Düz profil + nervür deseninde kabuk hacmi kapalı formülle hesaplanabilir.
  const p = normalizeAbajurConfig({ profil: 'duz', desen: 'nervur', nervurSayisi: 22, derinlik: 3 });
  const geo = abajurGeometrisi(p, KALITE.uretim);

  const N = 40000;
  let alan = 0;
  for (let c = 0; c < N; c++) {
    const th = (c / N) * Math.PI * 2;
    const ro = disR(th, 0, p);
    const ri = Math.max(0.5, ro - p.cidar);
    alan += ((ro * ro - ri * ri) / 2) * ((Math.PI * 2) / N);
  }
  const analitik = (alan * p.yukseklik) / 1000;
  const olculen = hacimHesapla(geo) / 1000;
  assert.ok(
    Math.abs(olculen - analitik) / analitik < 0.005,
    `hacim sapması çok büyük: ölçülen ${olculen.toFixed(2)} cm³, analitik ${analitik.toFixed(2)} cm³`
  );
});

test('üretim çözünürlüğü istenen kiriş hatasını tutturur', () => {
  const p = normalizeAbajurConfig({ profil: 'can', altCap: 220, ustCap: 80, yukseklik: 240, desen: 'duz' });
  const { N, R } = cozunurluk(p, KALITE.uretim);

  // çevresel: gerçek eğri ile poligon kirişi arasındaki en büyük mesafe
  let enBuyuk = 0;
  for (const u of [0, 0.25, 0.5, 0.75, 1]) {
    for (let c = 0; c < N; c++) {
      const t0 = (c / N) * Math.PI * 2;
      const t1 = ((c + 1) / N) * Math.PI * 2;
      const r0 = disR(t0, u, p), r1 = disR(t1, u, p);
      const ax = r0 * Math.cos(t0), ay = r0 * Math.sin(t0);
      const bx = r1 * Math.cos(t1), by = r1 * Math.sin(t1);
      for (let j = 1; j < 8; j++) {
        const s = j / 8;
        const th = t0 + (t1 - t0) * s;
        const r = disR(th, u, p);
        enBuyuk = Math.max(enBuyuk, Math.hypot(r * Math.cos(th) - (ax + (bx - ax) * s), r * Math.sin(th) - (ay + (by - ay) * s)));
      }
    }
  }
  assert.ok(enBuyuk <= KALITE.uretim.kirisHatasi * 1.6, `çevresel kiriş hatası ${enBuyuk.toFixed(4)} mm çok yüksek`);
  assert.ok(R >= 8, 'satır sayısı çok düşük');
});

test('üçgenler dilimleyicide denetlenebilir ve boyanabilir oranda kalır', () => {
  // Düz profilde yüzey dikeyde doğrusal olduğu için satır sayısı doğruluğu
  // etkilemez; yine de 20 mm boyunda iğne üçgenler modeli gözle denetlemeyi
  // ve Bambu Studio'da dikiş/destek boyamayı imkânsız hale getiriyordu.
  for (const [ad, ayar] of SENARYOLAR) {
    const p = normalizeAbajurConfig(ayar);
    const { N, R } = cozunurluk(p, KALITE.uretim);
    const satirYuksekligi = p.yukseklik / R;
    const cevreselAdim = (2 * Math.PI * (p.altCap / 2)) / N;
    assert.ok(satirYuksekligi <= 4.5, `${ad}: satır yüksekliği ${satirYuksekligi.toFixed(1)} mm çok büyük`);
    assert.ok(
      satirYuksekligi / cevreselAdim <= 6,
      `${ad}: üçgen en/boy oranı ${(satirYuksekligi / cevreselAdim).toFixed(1)}:1 çok yüksek`
    );
  }
});

test('üst yaka desensizdir ve taşıyıcı ayak duvarı delmez', () => {
  // Yaka olmadan ayak ucu, desenin dalgalı yüzeyine oturuyordu: 12.5 mm
  // genişliğindeki ucun bir kenarı nervür tepesine, öbürü vadisine denk
  // gelip dış duvarı 1.6 mm'ye kadar delip çıkıyordu.
  for (const [ad, ayar] of SENARYOLAR) {
    const p = normalizeAbajurConfig(ayar);
    const duy = DUY_MONTAJ[p.duyTipi];

    // 1. üst halka gerçek bir daire mi?
    let min = Infinity, max = -Infinity;
    for (let c = 0; c < 360; c++) {
      const r = disR((c / 360) * Math.PI * 2, 1, p);
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    assert.ok(max - min < 0.01, `${ad}: üst halka dairesel değil (${(max - min).toFixed(2)} mm dalgalanma)`);

    // 2. ayak ucu, genişliği boyunca dış yüzeyin içinde mi kalıyor?
    const gomme = Math.min(AYAK_GOMME, p.cidar * 0.85);
    for (let i = 0; i < duy.ayakSayisi; i++) {
      const th = (i / duy.ayakSayisi) * Math.PI * 2;
      const rDis = disR(th, 1, p) - p.cidar + gomme;
      const yariAci = duy.ayakUc / 2 / rDis;
      for (let j = -8; j <= 8; j++) {
        const a = th + (yariAci * j) / 8;
        assert.ok(
          rDis <= disR(a, 1, p) - 0.02,
          `${ad}: ayak ${i} dış duvarı ${(rDis - disR(a, 1, p)).toFixed(2)} mm deliyor`
        );
      }
      // yeterince gömülü mü? (zayıf birleşim olmasın)
      assert.ok(gomme >= p.cidar * 0.6, `${ad}: ayak duvara yeterince gömülmüyor`);
    }
  }
});

test('duvar kalınlığı ekstrüzyon hattının tam katına oturur', () => {
  for (const istek of [0.6, 0.9, 1.2, 1.5, 2.0, 2.7, 4]) {
    const kirpilmis = cidarKirp(istek);
    const sayi = duvarSayisi(kirpilmis);
    assert.ok(sayi >= 2, `${istek} mm için duvar sayısı 2'nin altına düştü`);
    assert.ok(
      Math.abs(kirpilmis - sayi * HAT_GENISLIGI) < 0.005,
      `${istek} mm -> ${kirpilmis} mm, ${sayi} duvarın tam katı değil`
    );
  }
  // normalize edilen config de aynı kuralı uygular
  assert.equal(normalizeAbajurConfig({ cidar: 1.2 }).cidar, cidarKirp(1.2));
});

test('STL geçerli ikili biçimde ve doğru üçgen sayısıyla üretilir', () => {
  const p = normalizeAbajurConfig({});
  const { stl, ucgen, kontrol } = uret({ config: p });
  assert.equal(kontrol.kapali, true);
  const dv = new DataView(stl);
  assert.equal(dv.getUint32(80, true), ucgen);
  assert.equal(stl.byteLength, 84 + ucgen * 50, 'dosya uzunluğu üçgen sayısıyla uyuşmuyor');

  // her üçgenin normali birim uzunlukta ve gerçek yüzey normaliyle aynı olmalı
  for (let t = 0; t < Math.min(ucgen, 500); t++) {
    const o = 84 + t * 50;
    const nx = dv.getFloat32(o, true), ny = dv.getFloat32(o + 4, true), nz = dv.getFloat32(o + 8, true);
    assert.ok(Math.abs(Math.hypot(nx, ny, nz) - 1) < 1e-3, `üçgen ${t}: normal birim değil`);

    const v = [];
    for (let k = 0; k < 3; k++) {
      const b = o + 12 + k * 12;
      v.push([dv.getFloat32(b, true), dv.getFloat32(b + 4, true), dv.getFloat32(b + 8, true)]);
    }
    const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2];
    const wx = v[2][0] - v[0][0], wy = v[2][1] - v[0][1], wz = v[2][2] - v[0][2];
    const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
    const len = Math.hypot(cx, cy, cz);
    assert.ok(len > 0, `üçgen ${t}: sıfır alanlı üçgen dosyaya yazılmış`);
    assert.ok((cx / len) * nx + (cy / len) * ny + (cz / len) * nz > 0.99, `üçgen ${t}: normal sarımla uyuşmuyor`);
  }
});

test('model Z=0 üzerinde oturur ve XY düzleminde ortalanır', () => {
  const p = normalizeAbajurConfig({ profil: 'can', altCap: 210, ustCap: 90 });
  const { stl } = uret({ config: p });
  const dv = new DataView(stl);
  const ucgen = dv.getUint32(80, true);
  let minZ = Infinity, maxZ = -Infinity, minX = Infinity, maxX = -Infinity;
  for (let t = 0; t < ucgen; t++) {
    for (let k = 0; k < 3; k++) {
      const b = 84 + t * 50 + 12 + k * 12;
      const x = dv.getFloat32(b, true);
      const z = dv.getFloat32(b + 8, true);
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  assert.ok(Math.abs(minZ) < 0.02, `model tablaya oturmuyor (minZ=${minZ})`);
  assert.ok(Math.abs(minX + maxX) < 0.05, 'model X ekseninde ortalanmamış');
  assert.ok(maxZ <= TABLA.z - PAY.yukseklik + 0.01, 'model yazıcı yüksekliğini aşıyor');
});

test('en karmaşık tasarımda bile sıkıştırılmış STL Vercel sınırının altında kalır', () => {
  const zor = [
    { profil: 'fici', desen: 'dalga', nervurSayisi: 64, dalgaSayisi: 20, bel: 20, altCap: 150, ustCap: 150, yukseklik: 254 },
    { profil: 'kumsaati', desen: 'nervur', nervurSayisi: 64, burgu: 360, bel: 24, yukseklik: 254 },
    { profil: 'can', desen: 'faset', nervurSayisi: 64, altCap: 220, ustCap: 80, yukseklik: 254 },
  ];
  for (const ayar of zor) {
    const p = normalizeAbajurConfig(ayar);
    const { stl, ucgen } = uret({ config: p });
    const gz = zlib.gzipSync(Buffer.from(stl), { level: 6 }).length;
    assert.ok(ucgen <= KALITE.uretim.ucgenButcesi * 1.05, `üçgen bütçesi aşıldı: ${ucgen}`);
    assert.ok(gz < 4_000_000, `gzip'li STL çok büyük: ${(gz / 1048576).toFixed(2)} MB`);
  }
});

test('fiyat hesabı çözünürlükten bağımsız ve belirlenimci', () => {
  const ayar = { profil: 'fici', desen: 'nervur', nervurSayisi: 30, bel: 15, altCap: 180, ustCap: 170 };
  const a = quoteAbajur(ayar);
  const b = quoteAbajur(ayar);
  assert.equal(a.birim, b.birim, 'aynı config farklı fiyat üretti');

  const p = normalizeAbajurConfig(ayar);
  const kaba = olcum(p, KALITE.fiyat).hacimCm3;
  const ince = olcum(p, KALITE.uretim).hacimCm3;
  assert.ok(
    Math.abs(kaba - ince) / ince < 0.01,
    `fiyat çözünürlüğündeki hacim üretimden sapıyor: ${kaba.toFixed(2)} / ${ince.toFixed(2)} cm³`
  );
});

test('tablaya sığmayan tasarım fiyatlandırılmaz', () => {
  assert.throws(
    () => quoteAbajur({ altCap: 246, ustCap: 246, desen: 'nervur', derinlik: 12, nervurSayisi: 20 }),
    /ABAJUR_SIGMIYOR/
  );
});

test('geometri sürümü değişince iş emri uyarı verir', () => {
  const p = normalizeAbajurConfig({});
  const { uyarilar } = uret({ config: p, geoSurum: '1.0' });
  assert.ok(uyarilar.some(u => u.includes('1.0') && u.includes(GEO_SURUM)), 'sürüm uyarısı yok');

  const guncel = uret({ config: p, geoSurum: GEO_SURUM });
  assert.equal(guncel.uyarilar.length, 0, 'güncel sürümde gereksiz uyarı var');
});
