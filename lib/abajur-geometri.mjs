/**
 * abajur-geometri.mjs — Abajur geometrisinin TEK kaynağı.
 *
 * Hem tarayıcıdaki konfigüratör (src/components/AbajurKonfigurator.jsx) hem de
 * sunucudaki STL üreticisi (lib/siparis-stl.mjs) bu dosyayı kullanır. Böylece
 * müşterinin gördüğü önizleme ile üretilen model matematiksel olarak aynıdır.
 *
 * Bu dosya SADECE `three` kullanır — node built-in'i, DOM veya React yok.
 *
 * Önizleme ile üretim arasındaki tek fark çözünürlüktür (bkz. KALITE):
 * şeklin kendisi aynı fonksiyonlardan çıkar.
 */

import * as THREE from "three";

/** Geometri sürümü. Şekli etkileyen her değişiklikte artır. */
export const GEO_SURUM = "3.0";

/* --------------------------- YAZICI PROFİLİ ---------------------------
   Yazıcı değişirse burayı güncelle; tüm sınırlar ve iş emri buradan türer.

   Bambu X2D   ana nozul  : 256 x 256 x 260   <-- kullanılan
   Bambu H2D   tek nozul  : 325 x 320 x 325
   Bambu X1C / P1S / A1   : 256 x 256 x 256
   Bambu A1 mini          : 180 x 180 x 180
   ---------------------------------------------------------------------- */
export const TABLA = { x: 256, y: 256, z: 260 };
export const PAY = { cap: 10, yukseklik: 6 };      // tablaya bırakılan emniyet payı (mm)
export const TABLA_CAP = Math.min(TABLA.x, TABLA.y);

export const NOZUL = 0.4;                 // mm
export const HAT_GENISLIGI = 0.42;        // mm — 0.4 nozulda varsayılan duvar hattı
export const KAT_YUKSEKLIGI = 0.2;        // mm
export const MIN_DUVAR_SAYISI = 2;        // tek duvar abajurda kırılgan ve şeffaf olur
export const MAKS_DUVAR_SAYISI = 6;

/** Duy standartları. Müşteri değiştiremez; bağlantı güvenliği buna bağlı. */
export const DUY_MONTAJ = {
  E27: {
    bogaz: 41, gecmeCap: 41.4, boyunH: 12, govdeEt: 3.2,
    omuzIc: 3.2, omuzEt: 3, halo: 1.8, ayakSayisi: 4, ayakEt: 4.2,
    ayakKok: 11, ayakBel: 5.6, ayakUc: 12.5, kivrim: 0.11, minUstCap: 72,
  },
  E14: {
    bogaz: 28, gecmeCap: 28.4, boyunH: 10, govdeEt: 2.8,
    omuzIc: 2.5, omuzEt: 2.6, halo: 1.5, ayakSayisi: 3, ayakEt: 3.6,
    ayakKok: 9, ayakBel: 4.6, ayakUc: 10.5, kivrim: 0.13, minUstCap: 58,
  },
};

export const AYAK_GOMME = 1.6;            // taşıyıcının gövde duvarına gömülme payı (mm)
export const YOGUNLUK = { PLA: 1.24, PETG: 1.27, "PLA Silk": 1.24 };

/* ---------------------------- KALİTE PROFİLİ --------------------------
   Çözünürlük artık sabit sayılardan değil, gerçek geometrik hata payından
   türetiliyor: "yüzey, ideal eğriden en fazla şu kadar sapsın".

   kirisHatasi  — mm. Üretimde 0.4 mm nozulun altında kalmalı.
   ucgenButcesi — üst sınır. Aşılırsa çözünürlük orantılı düşürülür; bu,
                  STL'in Vercel yanıt limitine dayanmasını engeller.
   ---------------------------------------------------------------------- */
export const KALITE = {
  // tarayıcı önizlemesi — akıcılık öncelikli, gölgeleme için satır tabanı yüksek
  onizleme: { kirisHatasi: 0.14, ucgenButcesi: 90_000, maksN: 360, maksR: 200, minN: 96, minR: 40, montajN: 72, maksSatirYuksekligi: 8 },
  // fiyat/ağırlık hesabı — yalnızca hacim gerekir, kaba örnekleme yeter
  fiyat: { kirisHatasi: 0.3, ucgenButcesi: 40_000, maksN: 192, maksR: 96, minN: 72, minR: 16, montajN: 48 },
  // baskıya giden dosya — 0.4 mm nozulun çok altında kiriş hatası.
  // Üçgen bütçesi, en karmaşık tasarımda bile gzip'li yanıtın Vercel'in
  // 4.5 MB sınırının altında kalmasını garanti eder (ölçüm: 150k -> ~2.5 MB).
  uretim: { kirisHatasi: 0.045, ucgenButcesi: 150_000, maksN: 640, maksR: 420, minN: 128, minR: 12, montajN: 128, maksSatirYuksekligi: 4 },
};

/* Boyun rozeti ve yaprak taşıyıcıların üçgen sayısı gövdeden bağımsızdır
   (montajN ve sabit ayak çözünürlüğü). Bütçeden peşinen düşülür. */
const MONTAJ_UCGEN_PAYI = 4_000;

/* ------------------------------ ŞEKİL --------------------------------- */

/** Yüksekliğe göre temel yarıçap (mm). u: 0 = alt halka, 1 = üst halka. */
export function temelR(u, p) {
  const rb = p.altCap / 2;
  const rt = p.ustCap / 2;
  switch (p.profil) {
    case "fici":
      return rb + (rt - rb) * u + p.bel * Math.sin(Math.PI * u);
    case "kumsaati":
      return rb + (rt - rb) * u - p.bel * Math.sin(Math.PI * u);
    case "can":
      return rt + (rb - rt) * Math.pow(1 - u, 2.2);
    default:
      return rb + (rt - rb) * u;
  }
}

/** Desenin yarıçapa kattığı ek (mm) — daima >= 0. */
export function desenR(theta, u, p) {
  const n = Math.max(3, Math.round(p.nervurSayisi));
  const tw = (p.burgu * Math.PI) / 180;
  const th = theta + tw * u;
  switch (p.desen) {
    case "nervur":
      return p.derinlik * 0.5 * (1 + Math.cos(n * th));
    case "dalga": {
      const k = Math.max(1, Math.round(p.dalgaSayisi));
      return p.derinlik * 0.25 * (1 + Math.cos(n * th)) * (1 + Math.cos(2 * Math.PI * k * u));
    }
    case "faset": {
      const s = (2 * Math.PI) / n;
      const off = ((th % s) + s) % s;
      const f = Math.cos(Math.PI / n) / Math.cos(off - s / 2);
      return temelR(u, p) * (f - 1) + p.derinlik * 0.001;
    }
    default:
      return 0;
  }
}

/** Dış yüzey yarıçapı (mm). */
export const disR = (theta, u, p) => Math.max(1, temelR(u, p) + desenR(theta, u, p));

/** Modelin en geniş dış yarıçapı (mm). */
export function enBuyukYaricap(p) {
  let en = 0;
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    for (let c = 0; c < 72; c++) {
      const th = (c / 72) * Math.PI * 2;
      const r = disR(th, u, p);
      if (r > en) en = r;
    }
  }
  return en;
}

/* --------------------------- ÇÖZÜNÜRLÜK ------------------------------ */

/** Çevresel yönde poligon kirişinin gerçek eğriden en büyük sapması (mm). */
function cevreselSapma(p, N, uSeviyeleri) {
  let en = 0;
  for (const u of uSeviyeleri) {
    for (let c = 0; c < N; c++) {
      const t0 = (c / N) * Math.PI * 2;
      const t1 = ((c + 1) / N) * Math.PI * 2;
      const r0 = disR(t0, u, p);
      const r1 = disR(t1, u, p);
      const ax = r0 * Math.cos(t0), ay = r0 * Math.sin(t0);
      const bx = r1 * Math.cos(t1), by = r1 * Math.sin(t1);
      for (let j = 1; j < 4; j++) {
        const s = j / 4;
        const th = t0 + (t1 - t0) * s;
        const r = disR(th, u, p);
        en = Math.max(en, Math.hypot(r * Math.cos(th) - (ax + (bx - ax) * s), r * Math.sin(th) - (ay + (by - ay) * s)));
      }
    }
  }
  return en;
}

/**
 * Dikey yönde poligon kirişinin gerçek profilden en büyük sapması (mm).
 * y, u ile doğrusal olduğundan kiriş üzerindeki karşılık gelen nokta da
 * u ile doğrusaldır; sapma tümüyle yarıçap yönündedir.
 */
function dikeySapma(p, R, thetalar) {
  let en = 0;
  for (const th of thetalar) {
    for (let i = 0; i < R; i++) {
      const u0 = i / R, u1 = (i + 1) / R;
      const r0 = disR(th, u0, p), r1 = disR(th, u1, p);
      for (let j = 1; j < 4; j++) {
        const s = j / 4;
        const u = u0 + (u1 - u0) * s;
        en = Math.max(en, Math.abs(disR(th, u, p) - (r0 + (r1 - r0) * s)));
      }
    }
  }
  return en;
}

/**
 * Verilen kalite hedefi için çevresel (N) ve dikey (R) bölüm sayısı.
 * Sayılar sabit değil, istenen kiriş hatasından türetilir; sonra üçgen
 * bütçesine sığdırılır.
 */
export function cozunurluk(p, kalite = KALITE.uretim) {
  const k = kalite;
  const n = Math.max(3, Math.round(p.nervurSayisi));
  const desenli = p.desen !== "duz";
  const faset = p.desen === "faset";

  // --- çevresel ---
  let N = faset ? n * 4 : Math.max(48, k.minN >> 1);
  while (N < k.maksN && cevreselSapma(p, N, [0, 0.35, 0.7, 1]) > k.kirisHatasi) {
    N = faset ? N + n * 2 : Math.ceil(N * 1.3);
  }
  // desen periyodu vertekslere tam otursun -> nervürler simetrik, fasetler keskin
  if (desenli) N = Math.ceil(N / n) * n;
  N = Math.min(k.maksN, Math.max(k.minN, N));

  // --- dikey ---
  const thetalar = [0, Math.PI / n, Math.PI / 2, Math.PI];
  let R = 8;
  while (R < k.maksR && dikeySapma(p, R, thetalar) > k.kirisHatasi) R = Math.ceil(R * 1.35);
  // burgu: satır adımı çevresel adımdan büyük olmamalı, yoksa desen merdivenlenir
  const burguRad = (Math.abs(p.burgu) * Math.PI) / 180;
  if (burguRad > 0) R = Math.max(R, Math.ceil((N * burguRad) / (2 * Math.PI)));

  /* Satır yüksekliği tavanı — doğruluk için DEĞİL, kullanılabilirlik için.
     Düz profilde yüzey dikeyde doğrusaldır, yani satır eklemek şekli hiç
     değiştirmez (ölçüldü: sapma R'den bağımsız 0.0365 mm). Ama 20 mm boyunda
     iğne gibi üçgenler üç pratik soruna yol açıyor:
       1. modeli dilimleyicide gözle denetlemek imkânsız hale geliyor,
       2. Bambu Studio'nun dikiş/destek/renk boyama araçları üçgen üzerinde
          çalıştığı için boyama kaba kalıyor,
       3. yüksek en/boy oranlı üçgenler bazı onarım ve boolean işlemlerinde
          sayısal sorun çıkarıyor.
     Bu yüzden satır yüksekliği sınırlanıyor; üçgen bütçesi yine üstte. */
  if (k.maksSatirYuksekligi) {
    R = Math.max(R, Math.ceil(p.yukseklik / k.maksSatirYuksekligi));
  }
  R = Math.min(k.maksR, Math.max(k.minR, R));

  // --- üçgen bütçesi ---
  // Bütçe modelin tamamı için; boyun ve taşıyıcılar için sabit bir pay
  // ayrılıp kalanı gövdeye veriliyor.
  const govdeButcesi = Math.max(20_000, k.ucgenButcesi - MONTAJ_UCGEN_PAYI);
  const say = (n1, r1) => 4 * n1 * (r1 + 1);
  if (say(N, R) > govdeButcesi) {
    const olcek = Math.sqrt(govdeButcesi / say(N, R));
    N = Math.max(desenli ? n * 3 : 64, Math.floor(N * olcek));
    // desen periyoduna oturtma daima AŞAĞI yuvarlanır, yoksa bütçe aşılır
    if (desenli) N = Math.max(n * 3, Math.floor(N / n) * n);
    R = Math.max(8, Math.floor(R * olcek));
    while (say(N, R) > govdeButcesi && R > 8) R--;
  }
  return { N, R, ucgen: say(N, R) };
}

/* ----------------------------- GÖVDE ---------------------------------- */

/**
 * Tek parça, kapalı (manifold) kabuk. İç yüzey dış yüzeyi birebir takip
 * eder -> her yerde sabit et kalınlığı.
 */
export function abajurGeometrisi(p, kalite = KALITE.uretim) {
  const { N, R } = cozunurluk(p, kalite);
  const H = p.yukseklik;
  const w = p.cidar;

  const vertSayisi = (R + 1) * N * 2;
  const pos = new Float32Array(vertSayisi * 3);
  const OUT = 0;
  const IN = (R + 1) * N;

  for (let r = 0; r <= R; r++) {
    const u = r / R;
    const y = u * H;
    for (let c = 0; c < N; c++) {
      const th = (c / N) * Math.PI * 2;
      const ro = disR(th, u, p);
      const ri = Math.max(0.5, ro - w);
      const cos = Math.cos(th);
      const sin = Math.sin(th);
      let i = (OUT + r * N + c) * 3;
      pos[i] = ro * cos; pos[i + 1] = y; pos[i + 2] = ro * sin;
      i = (IN + r * N + c) * 3;
      pos[i] = ri * cos; pos[i + 1] = y; pos[i + 2] = ri * sin;
    }
  }

  const idx = [];
  const oi = (r, c) => OUT + r * N + (c % N);
  const ii = (r, c) => IN + r * N + (c % N);
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < N; c++) {
      // dış yüzey — normal dışarı
      idx.push(oi(r, c), oi(r + 1, c), oi(r, c + 1));
      idx.push(oi(r, c + 1), oi(r + 1, c), oi(r + 1, c + 1));
      // iç yüzey — ters sarım, normal içeri
      idx.push(ii(r, c), ii(r, c + 1), ii(r + 1, c));
      idx.push(ii(r, c + 1), ii(r + 1, c + 1), ii(r + 1, c));
    }
  }
  // üst ve alt halka kapakları
  for (let c = 0; c < N; c++) {
    idx.push(oi(R, c), ii(R, c), ii(R, c + 1));
    idx.push(oi(R, c), ii(R, c + 1), oi(R, c + 1));
    idx.push(oi(0, c), ii(0, c + 1), ii(0, c));
    idx.push(oi(0, c), oi(0, c + 1), ii(0, c + 1));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.userData.bolum = { N, R, OUT, IN };
  return geo;
}

/* --------------------------- DUY ROZETİ ------------------------------- */

/** (r, y) düzlemindeki kapalı profili Y ekseni etrafında döndürür. */
export function profilDondur(nokta, N, yOfs = 0) {
  const M = nokta.length;
  const pos = new Float32Array(M * N * 3);
  for (let i = 0; i < M; i++) {
    const [r, y] = nokta[i];
    for (let c = 0; c < N; c++) {
      const th = (c / N) * Math.PI * 2;
      const k = (i * N + c) * 3;
      pos[k] = r * Math.cos(th);
      pos[k + 1] = y + yOfs;
      pos[k + 2] = r * Math.sin(th);
    }
  }
  const idx = [];
  const id = (i, c) => (i % M) * N + (c % N);
  for (let i = 0; i < M; i++)
    for (let c = 0; c < N; c++) {
      idx.push(id(i, c), id(i + 1, c), id(i, c + 1));
      idx.push(id(i, c + 1), id(i + 1, c), id(i + 1, c + 1));
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Merkezden gövdeye uzanan kıvrımlı, ortası incelen yaprak taşıyıcı. */
export function yaprakAyakGeometrisi(aci, rIc, rDis, yUst, duy) {
  const N = 10;
  const pos = new Float32Array((N + 1) * 4 * 3);
  const yumusat = (v) => v * v * (3 - 2 * v);
  const yaz = (i, j, x, y, z) => {
    const k = (i * 4 + j) * 3;
    pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
  };

  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = rIc + (rDis - rIc) * t;
    const a = aci + duy.kivrim * Math.sin(Math.PI * t);
    const genislik = t <= 0.5
      ? duy.ayakKok + (duy.ayakBel - duy.ayakKok) * yumusat(t * 2)
      : duy.ayakBel + (duy.ayakUc - duy.ayakBel) * yumusat((t - 0.5) * 2);
    const yari = genislik / 2;
    const cx = r * Math.cos(a), cz = r * Math.sin(a);
    const tx = -Math.sin(a), tz = Math.cos(a);
    const kalinlik = duy.ayakEt * (0.82 + 0.18 * Math.sin(Math.PI * t));
    const yAlt = yUst - kalinlik;
    yaz(i, 0, cx + tx * yari, yUst, cz + tz * yari);
    yaz(i, 1, cx - tx * yari, yUst, cz - tz * yari);
    yaz(i, 2, cx + tx * yari, yAlt, cz + tz * yari);
    yaz(i, 3, cx - tx * yari, yAlt, cz - tz * yari);
  }

  const idx = [];
  const id = (i, j) => i * 4 + j;
  for (let i = 0; i < N; i++) {
    const j = i + 1;
    idx.push(id(i, 0), id(i, 1), id(j, 0), id(i, 1), id(j, 1), id(j, 0));
    idx.push(id(i, 2), id(j, 2), id(i, 3), id(i, 3), id(j, 2), id(j, 3));
    idx.push(id(i, 2), id(i, 0), id(j, 2), id(i, 0), id(j, 0), id(j, 2));
    idx.push(id(i, 1), id(i, 3), id(j, 1), id(i, 3), id(j, 3), id(j, 1));
  }
  idx.push(id(0, 0), id(0, 2), id(0, 1), id(0, 1), id(0, 2), id(0, 3));
  idx.push(id(N, 0), id(N, 1), id(N, 2), id(N, 1), id(N, 3), id(N, 2));

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Duy boynu + yaprak taşıyıcılar. Ölçüler E14/E27 tablosundan sabit gelir. */
export function montajParcalari(p, kalite = KALITE.uretim) {
  const duy = DUY_MONTAJ[p.duyTipi] || DUY_MONTAJ.E27;
  const H = p.yukseklik;
  const hh = duy.boyunH;
  const ri = duy.gecmeCap / 2;
  const ro = ri + duy.govdeEt;
  const rt = ro + duy.halo;
  const rs = ri - duy.omuzIc;

  const profil = [
    [rs, hh - duy.omuzEt],
    [ri, hh - duy.omuzEt],
    [ri, 0],
    [ro - 0.6, 0],
    [ro, 1.2],
    [ro, hh - duy.ayakEt - 1],
    [rt, hh - duy.ayakEt],
    [rt, hh],
    [rs, hh],
  ];
  const parcalar = [profilDondur(profil, kalite.montajN, H - hh)];

  const n = duy.ayakSayisi;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const rDis = disR(th, 1, p) - p.cidar + AYAK_GOMME;
    const rIc = rt - 1.4;
    if (rDis - rIc <= 3) continue;
    parcalar.push(yaprakAyakGeometrisi(th, rIc, rDis, H, duy));
  }
  return parcalar;
}

/** Montaj parçalarını tek geometride birleştirir. */
export function montajGeometrisi(p, kalite = KALITE.uretim) {
  return birlestir(montajParcalari(p, kalite));
}

export function birlestir(geoler) {
  const parcalar = geoler.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
  const n = parcalar.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3);
  let o = 0;
  for (const g of parcalar) {
    pos.set(g.attributes.position.array, o);
    o += g.attributes.position.array.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/* ------------------------- ÖLÇÜM / KONTROL ---------------------------- */

/** İşaretli hacim (mm³) — diverjans teoremi. */
export function hacimHesapla(geo) {
  const pos = geo.attributes.position.array;
  const index = geo.index ? geo.index.array : null;
  const say = index ? index.length : pos.length / 3;
  let v = 0;
  for (let i = 0; i < say; i += 3) {
    const a = (index ? index[i] : i) * 3;
    const b = (index ? index[i + 1] : i + 1) * 3;
    const c = (index ? index[i + 2] : i + 2) * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
    const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2];
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return Math.abs(v);
}

/**
 * Kapalılık (watertight) kontrolü: kapalı ve yönlü bir yüzeyde her kenar
 * tam iki üçgende, zıt yönlerde bir kez görünür. Dilimleyicinin "onarım"
 * yapmadan basabilmesi için gereken tek koşul budur.
 */
export function manifoldKontrol(geo) {
  const pos = geo.attributes.position.array;
  const index = geo.index ? geo.index.array : null;
  const say = index ? index.length : pos.length / 3;

  // konum bazlı kaynaklama — indekssiz geometride de çalışsın
  const anahtar = new Map();
  const dugum = (v) => {
    const k = `${Math.round(pos[v] * 1000)},${Math.round(pos[v + 1] * 1000)},${Math.round(pos[v + 2] * 1000)}`;
    let id = anahtar.get(k);
    if (id === undefined) { id = anahtar.size; anahtar.set(k, id); }
    return id;
  };

  const kenar = new Map();
  let dejenere = 0;
  for (let i = 0; i < say; i += 3) {
    const a = dugum((index ? index[i] : i) * 3);
    const b = dugum((index ? index[i + 1] : i + 1) * 3);
    const c = dugum((index ? index[i + 2] : i + 2) * 3);
    if (a === b || b === c || a === c) { dejenere++; continue; }
    for (const [x, y] of [[a, b], [b, c], [c, a]]) {
      const k = x < y ? `${x}:${y}` : `${y}:${x}`;
      const yon = x < y ? 1 : -1;
      const mevcut = kenar.get(k) || { say: 0, denge: 0 };
      mevcut.say++;
      mevcut.denge += yon;
      kenar.set(k, mevcut);
    }
  }

  let acik = 0;
  let tersSarim = 0;
  for (const v of kenar.values()) {
    if (v.say !== 2) acik++;
    else if (v.denge !== 0) tersSarim++;
  }
  return {
    kapali: acik === 0 && tersSarim === 0 && dejenere === 0,
    acikKenar: acik,
    tersSarim,
    dejenereUcgen: dejenere,
    kenarSayisi: kenar.size,
  };
}

/** Ters baskıda (üst halka tablada) en büyük sarkma açısı — dikeyden derece. */
export function sarkmaAcisi(p, ters) {
  const H = p.yukseklik;
  let enBuyuk = 0;
  const N = 160;
  const thetalar = [0, Math.PI / Math.max(3, Math.round(p.nervurSayisi)), Math.PI / 2];
  for (const th of thetalar) {
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N;
      const r0 = disR(th, u0, p), r1 = disR(th, u1, p);
      const buyume = ters ? r0 - r1 : r1 - r0;
      if (buyume <= 0) continue;
      const a = (Math.atan2(buyume, (u1 - u0) * H) * 180) / Math.PI;
      if (a > enBuyuk) enBuyuk = a;
    }
  }
  return enBuyuk;
}

/**
 * Baskı yönü. Boyun ve yaprak taşıyıcılar üst halkada olduğu için model
 * daima ters basılır: o parçalar tablaya yatar, havada köprü kalmaz.
 */
export function baskiYonu(p) {
  return { ters: true, aci: sarkmaAcisi(p, true), zorunlu: true };
}

/* ----------------------- ÜRETİM PARAMETRELERİ ------------------------- */

/** Duvar kalınlığını tam sayıda ekstrüzyon hattına oturtur. */
export function duvarSayisi(cidar) {
  return Math.min(MAKS_DUVAR_SAYISI, Math.max(MIN_DUVAR_SAYISI, Math.round(cidar / HAT_GENISLIGI)));
}

/**
 * Dilimleyicinin boşluk doldurmadan tam duvar basabilmesi için kalınlığı
 * hat genişliğinin katına yuvarlar. 1.2 mm -> 1.26 mm (3 duvar) gibi.
 */
export function cidarKirp(cidar) {
  return +(duvarSayisi(cidar) * HAT_GENISLIGI).toFixed(2);
}

export const DUVAR_SECENEKLERI = Array.from(
  { length: MAKS_DUVAR_SAYISI - MIN_DUVAR_SAYISI + 1 },
  (_, i) => {
    const sayi = MIN_DUVAR_SAYISI + i;
    return { sayi, mm: +(sayi * HAT_GENISLIGI).toFixed(2) };
  }
);

/* -------------------------------- STL --------------------------------- */

const ucgenSayisi = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

/**
 * Float32'nin düşük mantis bitlerini sıfırlar. 250 mm'lik bir parçada
 * kalan hata ~0.004 mm (nozulun yüzde biri) ama tekrar eden sıfır baytlar
 * gzip oranını ciddi biçimde artırır.
 */
const KIRPMA_MASKESI = 0xffffff00;
const kirpBuf = new ArrayBuffer(4);
const kirpF32 = new Float32Array(kirpBuf);
const kirpU32 = new Uint32Array(kirpBuf);
function kirp(v) {
  kirpF32[0] = v;
  kirpU32[0] &= KIRPMA_MASKESI;
  return kirpF32[0];
}

/**
 * Binary STL. Normaller köşe normallerinin ortalamasından değil, üçgenin
 * kendi düzleminden (çapraz çarpım) hesaplanır — dilimleyicilerin yön
 * tespiti bunu bekler. Sıfır alanlı üçgenler atılır.
 *
 * three (Y yukarı) -> STL (Z yukarı) dönüşümü: (x, y, z) -> (x, -z, y)
 */
export function stlBinary(geoler, baslik = "abajur", { kirpma = true } = {}) {
  const liste = geoler.filter(Boolean);

  // 1. geçiş: geçerli üçgenleri topla
  const ucgenler = [];
  for (const geo of liste) {
    const pos = geo.attributes.position.array;
    const idx = geo.index ? geo.index.array : null;
    const say = ucgenSayisi(geo) * 3;
    for (let i = 0; i < say; i += 3) {
      const a = (idx ? idx[i] : i) * 3;
      const b = (idx ? idx[i + 1] : i + 1) * 3;
      const c = (idx ? idx[i + 2] : i + 2) * 3;

      const ax = pos[a], ay = -pos[a + 2], az = pos[a + 1];
      const bx = pos[b], by = -pos[b + 2], bz = pos[b + 1];
      const cx = pos[c], cy = -pos[c + 2], cz = pos[c + 1];

      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz);
      if (!(len > 1e-12)) continue; // dejenere üçgen — dosyaya yazma

      ucgenler.push([nx / len, ny / len, nz / len, ax, ay, az, bx, by, bz, cx, cy, cz]);
    }
  }

  const buf = new ArrayBuffer(84 + ucgenler.length * 50);
  const dv = new DataView(buf);
  const bas = String(baslik).slice(0, 79);
  for (let i = 0; i < bas.length; i++) dv.setUint8(i, bas.charCodeAt(i) & 0x7f);
  dv.setUint32(80, ucgenler.length, true);

  let o = 84;
  const yaz = kirpma ? kirp : (v) => v;
  for (const t of ucgenler) {
    dv.setFloat32(o, t[0], true); dv.setFloat32(o + 4, t[1], true); dv.setFloat32(o + 8, t[2], true);
    o += 12;
    for (let v = 3; v < 12; v += 3) {
      dv.setFloat32(o, yaz(t[v]), true);
      dv.setFloat32(o + 4, yaz(t[v + 1]), true);
      dv.setFloat32(o + 8, yaz(t[v + 2]), true);
      o += 12;
    }
    dv.setUint16(o, 0, true);
    o += 2;
  }
  return buf;
}

/**
 * Fiyat ve uyarılar için hafif ölçüm: STL üretmeden hacim, ağırlık ve dış
 * ölçü. Kaba örnekleme kullanır çünkü kabuk hacmi çözünürlükle hızla
 * yakınsar; aynı kalite profili her yerde kullanıldığı için sonuç
 * belirlenimcidir (aynı config -> aynı fiyat).
 */
export function olcum(p, kalite = KALITE.fiyat) {
  const govde = abajurGeometrisi(p, kalite);
  const montajlar = montajParcalari(p, kalite);
  const hacimMm3 = hacimHesapla(govde) + montajlar.reduce((s, g) => s + hacimHesapla(g), 0);

  const kutu = new THREE.Box3();
  govde.computeBoundingBox();
  kutu.copy(govde.boundingBox);
  for (const g of montajlar) {
    g.computeBoundingBox();
    kutu.union(g.boundingBox);
  }

  const en = kutu.max.x - kutu.min.x;
  const boy = kutu.max.z - kutu.min.z;
  const yukseklik = kutu.max.y - kutu.min.y;

  govde.dispose();
  for (const g of montajlar) g.dispose();

  return {
    hacimCm3: hacimMm3 / 1000,
    gram: (hacimMm3 / 1000) * (YOGUNLUK[p.malzeme] || 1.24),
    olcu: { en, boy, yukseklik },
    enBuyukCap: Math.max(en, boy),
    tablayaSigar:
      en <= TABLA.x - PAY.cap && boy <= TABLA.y - PAY.cap && yukseklik <= TABLA.z - PAY.yukseklik,
  };
}

/* ---------------------------- MODEL KURULUMU -------------------------- */

/**
 * Baskıya hazır model: gövde + montaj birleşik, ters çevrilmiş, Z=0'a
 * oturtulmuş ve XY'de ortalanmış. Dilimleyicide taşıma gerekmez.
 */
export function modelHazirla(p, kalite = KALITE.uretim) {
  const govde = abajurGeometrisi(p, kalite);
  const montajlar = montajParcalari(p, kalite);
  const yon = baskiYonu(p);

  const govdeKontrol = manifoldKontrol(govde);
  const montajKontrol = montajlar.map(manifoldKontrol);

  const model = birlestir([govde, ...montajlar]);
  if (yon.ters) model.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));
  model.computeBoundingBox();
  const bb = model.boundingBox;
  model.applyMatrix4(
    new THREE.Matrix4().makeTranslation(
      -(bb.min.x + bb.max.x) / 2,
      -bb.min.y,
      -(bb.min.z + bb.max.z) / 2
    )
  );
  model.computeVertexNormals();
  model.computeBoundingBox();
  const son = model.boundingBox;

  // hacim parça parça hesaplanır; birleşik ağda boyun gövdeyle çakışır ve
  // çakışan bölge iki kez sayılır
  const hacimMm3 = hacimHesapla(govde) + montajlar.reduce((s, g) => s + hacimHesapla(g), 0);

  return {
    model,
    govde,
    montajlar,
    yon,
    hacimCm3: hacimMm3 / 1000,
    olcu: {
      en: son.max.x - son.min.x,
      boy: son.max.z - son.min.z,
      yukseklik: son.max.y - son.min.y,
    },
    kontrol: {
      govde: govdeKontrol,
      montaj: montajKontrol,
      kapali: govdeKontrol.kapali && montajKontrol.every((k) => k.kapali),
    },
    cozunurluk: cozunurluk(p, kalite),
  };
}
