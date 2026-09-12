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
import { delikAlaniFonksiyonu, delikIzgaraAdimi, DELIK_DESENLERI } from "./abajur-delik.mjs";

/** Geometri sürümü. Şekli etkileyen her değişiklikte artır. */
export const GEO_SURUM = "3.5";

/**
 * Üst yaka yüksekliği (mm) — desenin sıfıra indiği bant.
 *
 * Yaprak taşıyıcılar gövdeye burada bağlanır. Yaka olmadan ayak ucu, deseni
 * takip eden dalgalı bir yüzeye oturuyordu: ayak 12.5 mm genişliğinde olduğu
 * için bir kenarı nervür tepesine, öbür kenarı vadisine denk geliyor ve uç
 * dış duvarı 1.6 mm'ye kadar delip dışarı çıkıyordu. Desen üst bantta
 * yumuşakça sönünce üst halka gerçek bir daire oluyor, ayak tüm genişliği
 * boyunca aynı yüzeye temiz oturuyor. Klasik abajurlarda metal "spider"
 * fitter da düz bir halkaya bağlanır; bu bant o rolü üstlenir.
 */
export const YAKA_YUKSEKLIGI = 14;

/** Delik konturu köşeye tam oturmasın diye kullanılan sıfırdan kaçış (mm). */
const DELIK_EPS = 0.02;

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
    // bogaz: duyun plastik gövdesinin ölçülen çapı
    // gecmeCap: basılan delik = bogaz + baskı toleransı (0.4 mm)
    bogaz: 42, gecmeCap: 42.4, boyunH: 12, govdeEt: 3.2,
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
  onizleme: { kirisHatasi: 0.14, ucgenButcesi: 90_000, delikButcesi: 190_000, maksN: 360, maksR: 200, delikMaksN: 520, delikMaksR: 340, minN: 96, minR: 40, montajN: 72, maksSatirYuksekligi: 8 },
  // fiyat/ağırlık hesabı — yalnızca hacim gerekir, kaba örnekleme yeter
  /* Kafesli gövdede kaba ızgara malzemeyi %7'ye kadar yanlış kestiriyordu
     (ölçüldü): müşteri ya fazla ödüyor ya satıcı zarar ediyordu. Delik
     bütçesi ayrı tutulunca sapma %1.3'e iniyor, ölçüm ~45 ms sürüyor. */
  fiyat: { kirisHatasi: 0.3, ucgenButcesi: 40_000, delikButcesi: 140_000, maksN: 192, maksR: 96, delikMaksN: 520, delikMaksR: 340, minN: 72, minR: 16, montajN: 48 },
  // baskıya giden dosya — 0.4 mm nozulun çok altında kiriş hatası.
  // Üçgen bütçesi, en karmaşık tasarımda bile gzip'li yanıtın Vercel'in
  // 4.5 MB sınırının altında kalmasını garanti eder (ölçüm: 150k -> ~2.5 MB).
  uretim: { kirisHatasi: 0.045, ucgenButcesi: 150_000, delikButcesi: 210_000, maksN: 640, maksR: 420, delikMaksN: 900, delikMaksR: 560, minN: 128, minR: 12, montajN: 128, maksSatirYuksekligi: 4 },
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

/**
 * Üst yakada deseni yumuşakça sıfıra indiren çarpan.
 * u = 1 (üst halka) -> 0 ; yakanın altında -> 1.
 */
export function yakaCarpani(u, p) {
  const yaka = Math.min(YAKA_YUKSEKLIGI, p.yukseklik * 0.22);
  if (yaka <= 0) return 1;
  const t = Math.min(1, Math.max(0, ((1 - u) * p.yukseklik) / yaka));
  return t * t * (3 - 2 * t); // smoothstep — geçiş çizgisi belli olmasın
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

/** Dış yüzey yarıçapı (mm). Desen üst yakada sönümlenir. */
export const disR = (theta, u, p) =>
  Math.max(1, temelR(u, p) + desenR(theta, u, p) * yakaCarpani(u, p));

/**
 * Yarıçap yönündeki kalınlığın, yüzeye DİK kalınlığı sabit tutması için
 * çarpılması gereken ölçek.
 *
 * Duvar yarıçap yönünde sabit kalınlıkta kesilirse, yüzey dikeyden saptıkça
 * dike bakan gerçek et incelir: dik_et = cidar × cos(eğim). Dalgalı veya
 * çan profilli tasarımlarda bu 0.42 mm hat genişliğinin altına inip
 * dilimleyicinin o katmanı hiç basmamasına yol açıyordu ("boş katman").
 *
 * Parametrik yüzey P(θ,u) = (r·cosθ, u·H, r·sinθ) için normalin yarıçap
 * yönüyle açısı kapalı formülle çıkar:
 *     cos(α) = 1 / sqrt(1 + (r_θ/r)² + (r_u/H)²)
 * Dolayısıyla yarıçap yönündeki kalınlık bu ifadenin tersiyle çarpılır.
 *
 * Neredeyse yatay yüzeylerde ölçek sonsuza gideceği için üst sınır var;
 * sınıra dayanıldığında iş emri uyarı verir.
 */
export const ET_OLCEK_TAVANI = 6;

export function etOlcegi(theta, u, p, ro) {
  const dTheta = 1e-3;
  const du = 5e-4;
  const rT = (disR(theta + dTheta, u, p) - disR(theta - dTheta, u, p)) / (2 * dTheta);
  const u0 = Math.max(0, u - du);
  const u1 = Math.min(1, u + du);
  const rU = (disR(theta, u1, p) - disR(theta, u0, p)) / (u1 - u0);
  const olcek = Math.sqrt(1 + (rT / Math.max(1, ro)) ** 2 + (rU / p.yukseklik) ** 2);
  return Math.min(ET_OLCEK_TAVANI, olcek);
}

/** Gövdenin ortalama yarıçapı — delik desenini açarken ölçek buradan gelir. */
export function ortalamaYaricap(p) {
  let toplam = 0;
  const n = 24;
  for (let i = 0; i <= n; i++) toplam += temelR(i / n, p);
  return toplam / (n + 1);
}

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

  /* --- delik deseni ızgarayı da belirler ---
     Çubuk bir hücreden darsa yer yer hiç örneklenmez ve kafes lif lif
     parçalanır (ölçüldü: çubuk/hücre 0.57 iken tamamen kopuk). Gereken
     adım çubuk kalınlığından türer; çubuğun alt sınırı normalizasyonda
     zorlandığı için bu istek bütçeye sığar. */
  const delikli = p.delik && p.delik !== "yok" && DELIK_DESENLERI.includes(p.delik);
  if (delikli) {
    const adim = delikIzgaraAdimi(p.cubukKalinlik);
    const cevre = 2 * Math.PI * ortalamaYaricap(p);
    N = Math.max(N, Math.ceil(cevre / adim));
    R = Math.max(R, Math.ceil(p.yukseklik / adim));
    if (desenli) N = Math.ceil(N / n) * n;
    N = Math.min(k.delikMaksN || k.maksN, N);
    R = Math.min(k.delikMaksR || k.maksR, R);
  }

  // --- üçgen bütçesi ---
  // Bütçe modelin tamamı için; boyun ve taşıyıcılar için sabit bir pay
  // ayrılıp kalanı gövdeye veriliyor.
  // Delikli modelde hücrelerin çoğu boş kalır; aynı üçgen sayısıyla çok
  // daha ince ızgara taşınabildiği için bütçe ayrı tutuluyor.
  const toplamButce = delikli ? (k.delikButcesi || k.ucgenButcesi) : k.ucgenButcesi;
  const govdeButcesi = Math.max(20_000, toplamButce - MONTAJ_UCGEN_PAYI);
  /* Delikli modelde sınır hücreleri kırpılmış yüzey + yan duvar ürettiği
     için gerçek üçgen sayısı hücre tahmininin ~1.25 katı çıkıyor (ölçüldü).
     Bütçeyi bu çarpanla kıyasla, yoksa dosya Vercel sınırını aşıyor. */
  const say = (n1, r1) => 4 * n1 * (r1 + 1) * (delikli ? 1.3 : 1);
  if (say(N, R) > govdeButcesi) {
    const olcek = Math.sqrt(govdeButcesi / say(N, R));
    N = Math.max(desenli ? n * 3 : 64, Math.floor(N * olcek));
    // desen periyoduna oturtma daima AŞAĞI yuvarlanır, yoksa bütçe aşılır
    if (desenli) N = Math.max(n * 3, Math.floor(N / n) * n);
    R = Math.max(8, Math.floor(R * olcek));
    while (say(N, R) > govdeButcesi && R > 8) R--;
  }
  return { N, R, ucgen: Math.round(say(N, R)) };
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

  /* Delik deseni varsa gövde artık her yerde kapalı değil. Kabuğu
     hücre hücre "katı" bölgesine kırparak açıyoruz: hücrenin dört
     köşesindeki işaretli uzaklığa bakılıp kenar tam sıfır geçtiği
     noktadan kesiliyor. Böylece delik kenarları ızgaraya takılıp
     merdivenlenmiyor, çubuk kalınlığı da milimetrik tutuluyor. */
  const delik = delikAlaniFonksiyonu(p, Math.min(YAKA_YUKSEKLIGI, H * 0.22), ortalamaYaricap(p));

  const pos = [];
  /** (θ,u) noktasının dış ve iç köşe indekslerini üretir. */
  const noktaEkle = (th, u) => {
    const ro = disR(th, u, p);
    // yüzeye dik et her yerde w kalsın diye yarıçap yönünde daha kalın kes
    const ri = Math.max(0.5, ro - w * etOlcegi(th, u, p, ro));
    const cos = Math.cos(th);
    const sin = Math.sin(th);
    const y = u * H;
    const o = pos.length / 3;
    pos.push(ro * cos, y, ro * sin);
    const i = pos.length / 3;
    pos.push(ri * cos, y, ri * sin);
    return [o, i];
  };

  const gridO = new Int32Array((R + 1) * N);
  const gridI = new Int32Array((R + 1) * N);
  const F = delik ? new Float64Array((R + 1) * N) : null;
  for (let r = 0; r <= R; r++) {
    const u = r / R;
    for (let c = 0; c < N; c++) {
      const th = (c / N) * Math.PI * 2;
      const [o, i] = noktaEkle(th, u);
      gridO[r * N + c] = o;
      gridI[r * N + c] = i;
      if (F) {
        let fv = delik.f(th, u);
        /* Alan bir ızgara köşesinde sıfıra çok yaklaşırsa o köşeye bakan
           kenarların kesişimi köşeye yapışır; iki komşu kenar mikron
           mertebesinde ayrı iki düğüm üretir ve "aynı nokta mı" sorusu
           yuvarlamaya kalır — ağ orada açılır (ölçüldü: fıçı gövde + elmas
           kafes, 4 açık kenar). Alan gerçek bir işaretli uzaklık olduğu için
           buradaki eşik doğrudan milimetre: köşeyi katı sayıp 0.02 mm
           uzaklaştırıyoruz. Bu, kaynak toleransının (0.001 mm) 20 katı, yani
           kesişimler kesinlikle ayrı düğümler; çubuk kalınlığının ise binde
           dördü, baskıda ölçülemez. */
        if (fv > -DELIK_EPS && fv < DELIK_EPS) fv = DELIK_EPS;
        F[r * N + c] = fv;
      }
    }
  }

  const idx = [];
  const oi = (r, c) => gridO[r * N + ((c % N) + N) % N];
  const ii = (r, c) => gridI[r * N + ((c % N) + N) % N];

  if (!delik) {
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
  } else {
    /* Kenar kesişimleri iki komşu hücre arasında PAYLAŞILIR: aynı kenar
       iki hücrede farklı noktadan kesilirse ağda çatlak kalır. Bu yüzden
       kesişimler kenar başına bir kez, tek yönde hesaplanıyor. */
    const kesYatayO = new Int32Array((R + 1) * N).fill(-1); // (r,c)-(r,c+1)
    const kesYatayI = new Int32Array((R + 1) * N).fill(-1);
    const kesDikeyO = new Int32Array(R * N).fill(-1);       // (r,c)-(r+1,c)
    const kesDikeyI = new Int32Array(R * N).fill(-1);
    const kesCaprazO = new Int32Array(R * N).fill(-1);      // (r+1,c)-(r,c+1)
    const kesCaprazI = new Int32Array(R * N).fill(-1);

    const yatayKesisim = (r, c) => {
      const c2 = (c + 1) % N;
      const a = F[r * N + c];
      const b = F[r * N + c2];
      if ((a >= 0) === (b >= 0)) return null;
      const k = r * N + c;
      if (kesYatayO[k] < 0) {
        const t = a / (a - b);
        const th = ((c + t) / N) * Math.PI * 2;
        const [o, i] = noktaEkle(th, r / R);
        kesYatayO[k] = o;
        kesYatayI[k] = i;
      }
      return [kesYatayO[k], kesYatayI[k]];
    };

    const dikeyKesisim = (r, c) => {
      const cc = ((c % N) + N) % N;
      const a = F[r * N + cc];
      const b = F[(r + 1) * N + cc];
      if ((a >= 0) === (b >= 0)) return null;
      const k = r * N + cc;
      if (kesDikeyO[k] < 0) {
        const t = a / (a - b);
        const th = (cc / N) * Math.PI * 2;
        const [o, i] = noktaEkle(th, (r + t) / R);
        kesDikeyO[k] = o;
        kesDikeyI[k] = i;
      }
      return [kesDikeyO[k], kesDikeyI[k]];
    };

    /* Hücrenin köşegeni: iki üçgen bunu paylaşır, kesişim tek yerden gelmeli. */
    const caprazKesisim = (r, c) => {
      const c2 = (c + 1) % N;
      const a = F[(r + 1) * N + c];
      const b = F[r * N + c2];
      if ((a >= 0) === (b >= 0)) return null;
      const k = r * N + c;
      if (kesCaprazO[k] < 0) {
        const t = a / (a - b);
        // köşegen: (r+1,c) -> (r,c+1)
        const th = ((c + t) / N) * Math.PI * 2;
        const u = (r + 1 - t) / R;
        const [o, i] = noktaEkle(th, u);
        kesCaprazO[k] = o;
        kesCaprazI[k] = i;
      }
      return [kesCaprazO[k], kesCaprazI[k]];
    };

    /* Üçgeni f>=0 yarı düzlemine kırpar ve yüzey + delik duvarını basar.
       Dörtgen yerine üçgen kırpılıyor: dörtgende çapraz iki köşe katı,
       diğer ikisi delik olduğunda ("eyer" hücresi) konturun iki ayrı
       parçası tek poligona bağlanıp ağda çatlak bırakıyordu. Üçgende
       bu belirsizlik yok. */
    /* Kontur noktası bir köşeye çok yaklaştığında iki tepe aynı düğüme
       kaynıyor ve sıfır alanlı üçgen çıkıyor. Bunlar baskıda zararsız ama
       ağ kontrolünü kirletiyor; kaynaklanmış konum aynıysa hiç basma. */
/* Karşılaştırma Math.fround ile: pos burada çift duyarlıklı tutuluyor ama
       tampona (ve dilimleyiciye) float32 yazılıyor. Çift duyarlıkta "aynı",
       float32'de "ayrı" çıkan bir çift varsa üreteç üçgeni atar, dışarıdan
       bakan kenarı açık görür — tam böyle bir çift ölçüldü (y = 40.0005;
       çift duyarlıkta 40001, float32'de 40000). */
    const ayniDugum = (a, b) => {
      const i = a * 3, j = b * 3;
      const yuvarla = (v) => Math.round(Math.fround(v) * 1000);
      return yuvarla(pos[i]) === yuvarla(pos[j])
        && yuvarla(pos[i + 1]) === yuvarla(pos[j + 1])
        && yuvarla(pos[i + 2]) === yuvarla(pos[j + 2]);
    };
    const ucgenEkle = (a, b, c) => {
      if (a === b || b === c || a === c) return;
      if (ayniDugum(a, b) || ayniDugum(b, c) || ayniDugum(a, c)) return;
      idx.push(a, b, c);
    };

    const kirpUcgen = (k0, k1, k2, kes01, kes12, kes20) => {
      const koseler = [k0, k1, k2];
      const kesler = [kes01, kes12, kes20];
      const cikti = [];
      for (let e = 0; e < 3; e++) {
        const su = koseler[e];
        const son = koseler[(e + 1) % 3];
        if (su.f >= 0) cikti.push(su);
        if ((su.f >= 0) !== (son.f >= 0)) {
          const kes = kesler[e]();
          if (kes) cikti.push({ f: 0, o: kes[0], i: kes[1], s: true });
        }
      }
      if (cikti.length < 3) return;
      for (let k = 1; k + 1 < cikti.length; k++) {
        ucgenEkle(cikti[0].o, cikti[k].o, cikti[k + 1].o);     // dış yüzey
        ucgenEkle(cikti[0].i, cikti[k + 1].i, cikti[k].i);     // iç yüzey (ters)
      }
      for (let k = 0; k < cikti.length; k++) {
        const P = cikti[k];
        const Q = cikti[(k + 1) % cikti.length];
        if (!P.s || !Q.s) continue;                            // delik yan duvarı
        ucgenEkle(P.o, P.i, Q.o);
        ucgenEkle(Q.o, P.i, Q.i);
      }
    };

    for (let r = 0; r < R; r++) {
      for (let c = 0; c < N; c++) {
        const c2 = (c + 1) % N;
        const fA = F[r * N + c];
        const fB = F[(r + 1) * N + c];
        const fC = F[(r + 1) * N + c2];
        const fD = F[r * N + c2];

        // Dört köşe de katıysa hücreyi olduğu gibi bas (hızlı yol)
        if (fA >= 0 && fB >= 0 && fC >= 0 && fD >= 0) {
          idx.push(oi(r, c), oi(r + 1, c), oi(r, c + 1));
          idx.push(oi(r, c + 1), oi(r + 1, c), oi(r + 1, c + 1));
          idx.push(ii(r, c), ii(r, c + 1), ii(r + 1, c));
          idx.push(ii(r, c + 1), ii(r + 1, c + 1), ii(r + 1, c));
          continue;
        }
        if (fA < 0 && fB < 0 && fC < 0 && fD < 0) continue; // tamamen delik

        /* Sınır hücresi: dolu haldeki iki üçgenin aynısını kırp.
           A=(r,c) B=(r+1,c) C=(r+1,c+1) D=(r,c+1) */
        const kA = { f: fA, o: oi(r, c), i: ii(r, c), s: false };
        const kB = { f: fB, o: oi(r + 1, c), i: ii(r + 1, c), s: false };
        const kC = { f: fC, o: oi(r + 1, c + 1), i: ii(r + 1, c + 1), s: false };
        const kD = { f: fD, o: oi(r, c + 1), i: ii(r, c + 1), s: false };

        // T1 = A,B,D   kenarlar: A->B dikey(c), B->D köşegen, D->A yatay(r)
        kirpUcgen(kA, kB, kD,
          () => dikeyKesisim(r, c),
          () => caprazKesisim(r, c),
          () => yatayKesisim(r, c));

        // T2 = D,B,C   kenarlar: D->B köşegen, B->C yatay(r+1), C->D dikey(c+1)
        kirpUcgen(kD, kB, kC,
          () => caprazKesisim(r, c),
          () => yatayKesisim(r + 1, c),
          () => dikeyKesisim(r, c + 1));
      }
    }
  }

  // üst ve alt halka kapakları — bantlar katı olduğu için hep geçerli
  for (let c = 0; c < N; c++) {
    idx.push(oi(R, c), ii(R, c), ii(R, c + 1));
    idx.push(oi(R, c), ii(R, c + 1), oi(R, c + 1));
    idx.push(oi(0, c), ii(0, c + 1), ii(0, c));
    idx.push(oi(0, c), oi(0, c + 1), ii(0, c + 1));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  /* Köşe dizilimi: noktaEkle her çağrıda önce dış sonra iç köşeyi ekler,
     yani tampon OUT, IN, OUT, IN... diye ilerler (ADIM = 2). Delikli
     modelde ızgara köşelerinin ardından delik kenarı köşeleri geliyor;
     bu yüzden köşeler (satır, sütun) ile DEĞİL, bu adımla taranmalı. */
  geo.userData.bolum = {
    N, R, OUT: 0, IN: 1, ADIM: 2,
    delikli: Boolean(delik), delikBilgi: delik?.bilgi || null,
  };
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
  /* Ayak ucu duvarın içine girer ama dışına ÇIKMAZ. Sabit 1.6 mm gömme
     ince duvarda dış yüzeyi delip yüzeyde kabartı bırakıyordu; kalınlığın
     %85'i hem güçlü bir kaynaşma veriyor hem de uç dış yüzeyin biraz
     içinde kalıyor (çakışan yüzey oluşmuyor). */
  const gomme = Math.min(AYAK_GOMME, p.cidar * 0.85);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const rDis = disR(th, 1, p) - p.cidar + gomme;
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
