import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";

/* ------------------------------------------------------------------ *
 *  ABAJUR KONFİGÜRATÖRÜ
 *  Tek dosya, bağımlılık: react + three
 *
 *  Siteye gömerken:
 *    <AbajurKonfigurator
 *       onAddToCart={(payload) => sepeteEkle(payload)}
 *       baseUrl="https://siten.com/tasarla"
 *       fiyat={{ filamentKg: 780, makineSaat: 45, hazirlik: 60, kar: 55, kdv: 20 }}
 *    />
 *
 *  onAddToCart payload'ı: { config, ozet, fiyat, stlAdi } — kendi
 *  backend'ine bu JSON'u gönder, üretimde aynı parametrelerle modeli
 *  yeniden üret (geometri fonksiyonu deterministik).
 * ------------------------------------------------------------------ */

/* ---------------------------- SABİTLER ---------------------------- */

const MALZEMELER = {
  PLA: { ad: "PLA", yogunluk: 1.24, not: "Standart. Sıcak ampulle kullanma." },
  PETG: { ad: "PETG", yogunluk: 1.27, not: "Isıya dayanıklı, hafif şeffaf." },
  "PLA Silk": { ad: "PLA Silk", yogunluk: 1.24, not: "Parlak yüzey, ışığı yansıtır." },
};

const RENKLER = [
  { ad: "Kemik Beyazı", hex: "#EDE4D3", gecirgen: 0.9 },
  { ad: "Kum Beji", hex: "#D9C3A0", gecirgen: 0.85 },
  { ad: "Adaçayı", hex: "#8E9C87", gecirgen: 0.6 },
  { ad: "Terrakota", hex: "#B4593A", gecirgen: 0.55 },
  { ad: "Duman Grisi", hex: "#8A8681", gecirgen: 0.5 },
  { ad: "Kömür", hex: "#26241F", gecirgen: 0.15 },
];

const PROFILLER = [
  { id: "duz", ad: "Düz" },
  { id: "fici", ad: "Fıçı" },
  { id: "kumsaati", ad: "Kum saati" },
  { id: "can", ad: "Çan" },
];

const DESENLER = [
  { id: "duz", ad: "Düz" },
  { id: "nervur", ad: "Nervür" },
  { id: "dalga", ad: "Dalga" },
  { id: "faset", ad: "Faset" },
];

const MONTAJ = {
  boyun: { ad: "Entegre boyun", ek: 45 },
  halka: { ad: "Duy halkası ile", ek: 0 },
};

// Duy standartları — boyun geometrisi ve set fiyatı buradan gelir
const DUYLAR = {
  E27: { ad: "E27", bogaz: 41, min: 34, max: 52, ampulR: 18, setTL: 180 },
  E14: { ad: "E14", bogaz: 28, min: 22, max: 38, ampulR: 12, setTL: 150 },
};

const PAKETLER = {
  baslik: { ad: "Yalnızca başlık", aciklama: "Sadece basılmış abajur gövdesi." },
  set: { ad: "Duylu set", aciklama: "Abajur + duy + 1,5 m kablo + tavan askısı." },
};

// Boyun sabitleri (mm)
const BOYUN = {
  tolerans: 0.4,   // boğaza eklenen boşluk
  govdeEt: 3.0,    // boyun cidarı
  omuzIc: 3.0,     // omuzun içeri taşması
  omuzEt: 3.0,     // omuz kalınlığı
  kolGomme: 1.2,   // kolun gövde duvarına gömüldüğü mesafe
};

const VARSAYILAN = {
  paket: "set",
  duyTipi: "E27",
  profil: "duz",
  altCap: 190,
  ustCap: 190,
  yukseklik: 260,
  bel: 18,
  desen: "nervur",
  nervurSayisi: 22,
  derinlik: 3,
  burgu: 0,
  dalgaSayisi: 6,
  cidar: 1.2,
  malzeme: "PLA",
  renk: "Kemik Beyazı",
  montaj: "boyun",
  bogazCap: 41,
  boyunH: 12,
  kolSayisi: 4,
  kolKalinlik: 5,
  kelvin: 2700,
  adet: 1,
};

/* ------------------------- FİYAT TARİFESİ -------------------------
   Tüm para birimi ₺. Değiştirmek için TEK yer burası — ya bu nesneyi
   güncelle, ya `fiyat` prop'uyla ez, ya da `fiyatUrl` ile sunucudaki
   bir JSON dosyasından çek (kod dağıtmadan güncellemek için en pratiği).
   ------------------------------------------------------------------ */
const FIYAT = {
  guncelleme: "2026-08-13",

  // MALİYET KALEMLERİ
  filament: {            // ₺/kg — makara alış fiyatı
    PLA: 780,
    PETG: 975,
    "PLA Silk": 1014,
  },
  fire: 8,               // % — başarısız baskı, purge, destek payı
  makineSaat: 45,        // ₺/saat — amortisman + elektrik + nozul/bakım
  elIsciligi: 60,        // ₺/adet — dilimleme, tabla hazırlık, temizlik, paketleme
  boyunMontaj: 45,       // ₺/adet — entegre boyunlu modelde ek işçilik
  duy: { E27: 180, E14: 150 },  // ₺/adet — duy + kablo + askı alış maliyeti

  // KÂR VE VERGİ
  kar: 55,               // % — üretim maliyeti üzerine
  duyMarj: 35,           // % — hazır parçaya uygulanan ticari marj
  kdv: 20,               // %
};

/* Yazıcı hacmi — kendi makinene göre TEK yerden değiştir.
   Bambu X2D  ana nozul  : 256 x 256 x 260   <-- kullanılan
   Bambu X2D  yardımcı   : 235.5 x 256 x 256
   Bambu X2D  çift nozul : 235.5 x 256 x 256
   Bambu H2D  tek nozul  : 325 x 320 x 325
   Bambu X1C / P1S / A1  : 256 x 256 x 256
   Bambu A1 mini         : 180 x 180 x 180                             */
const TABLA = { x: 256, y: 256, z: 260 };
const PAY = { cap: 10, yukseklik: 6 };    // tablaya bırakılan emniyet payı (mm)
const TABLA_CAP = Math.min(TABLA.x, TABLA.y); // çapı kısa kenar sınırlar

// Geometri sürümü — sunucudaki üretici ile eşleşmeli (bkz. siparis-stl.mjs)
const GEO_SURUM = "1.0";

/* --------------------------- GEOMETRİ ----------------------------- */

function segmentSayisi(p) {
  if (p.desen === "faset") return Math.max(64, p.nervurSayisi * 6);
  if (p.desen === "duz") return 160;
  return Math.min(360, Math.max(144, p.nervurSayisi * 8));
}
function satirSayisi(p) {
  const egri = p.profil !== "duz" || p.desen === "dalga" || Math.abs(p.burgu) > 0.5;
  return egri ? 112 : 40;
}

// Yüksekliğe göre temel yarıçap (mm)
function temelR(u, p) {
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

// Desenin yarıçapa kattığı ek (mm) — daima >= 0
function desenR(theta, u, p) {
  const n = Math.max(3, Math.round(p.nervurSayisi));
  const tw = (p.burgu * Math.PI) / 180; // toplam burgu açısı, radyan
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

function disR(theta, u, p) {
  return Math.max(1, temelR(u, p) + desenR(theta, u, p));
}

/**
 * Tek parça, kapalı (manifold) kabuk üretir.
 * İç yüzey dış yüzeyi birebir takip eder -> her yerde sabit et kalınlığı,
 * vazo modu (tek duvar spiral) ile birebir uyumlu.
 */
function abajurGeometrisi(p) {
  const N = segmentSayisi(p);
  const R = satirSayisi(p);
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
      pos[i] = ro * cos;
      pos[i + 1] = y;
      pos[i + 2] = ro * sin;

      i = (IN + r * N + c) * 3;
      pos[i] = ri * cos;
      pos[i + 1] = y;
      pos[i + 2] = ri * sin;
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
      // iç yüzey — normal içeri (ters sarım)
      idx.push(ii(r, c), ii(r, c + 1), ii(r + 1, c));
      idx.push(ii(r, c + 1), ii(r + 1, c + 1), ii(r + 1, c));
    }
  }
  // üst halka (+y) ve alt halka (-y)
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

  /* Vertex başına "duvardan geçen ışık".
     Gerçek abajurda parlaklık her yerde eşit değildir: ampule bakan orta kuşak
     parlar, üst ve alt halkalara doğru söner. Ters kare yasası + Lambert
     kosinüsü + duvar kalınlığından kaynaklı sönümleme ile hesaplanıyor. */
  const isik = new Float32Array(vertSayisi);
  const by = H * 0.55;                       // ampul yüksekliği
  const ref = Math.pow(p.altCap / 2, 2);     // ~1 çıksın diye ölçek
  const gecis = Math.exp(-Math.max(0, w - 0.8) / 1.7); // kalın duvar az geçirir
  for (let r = 0; r <= R; r++) {
    for (let c = 0; c < N; c++) {
      const vi = OUT + r * N + c;
      const k = vi * 3;
      const x = pos[k], y = pos[k + 1], z = pos[k + 2];
      const dx = x, dy = y - by, dz = z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const d = Math.sqrt(d2) || 1;
      const rad = Math.hypot(x, z) || 1;
      const cos = Math.max(0, (x * dx + z * dz) / (rad * d)); // yüzeye geliş açısı
      isik[vi] = Math.min(1.6, ((cos / d2) * ref * gecis) / 1.0);
      isik[IN + r * N + c] = 0.08;            // iç yüzey zaten doğrudan aydınlanıyor
    }
  }
  geo.setAttribute("aIsik", new THREE.BufferAttribute(isik, 1));
  return geo;
}

/* ---------------- E27 BOYUN + KOLLAR ---------------- */

/**
 * (r, y) düzlemindeki kapalı bir profili Y ekseni etrafında döndürür.
 * Profil CCW sıralı olmalı -> normaller dışarı bakar. Sonuç kapalı katıdır.
 */
function profilDondur(nokta, N, yOfs = 0) {
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
  return g;
}

function birlestir(geoler) {
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

/**
 * E27 duy boynu + taşıyıcı kollar.
 * Gövdeyle kaynatılmaz; kollar duvarın içine gömülü ayrı kapalı katılardır.
 * Dilimleyici bunları birleştirir (union), baskıda tek parça çıkar.
 */
function montajGeometrisi(p) {
  if (p.montaj !== "boyun") return null;
  const H = p.yukseklik;
  const hh = p.boyunH;
  const ri = (p.bogazCap + BOYUN.tolerans) / 2;
  const ro = ri + BOYUN.govdeEt;
  const rs = ri - BOYUN.omuzIc;

  // Boyun profili — omuz üstte (ters baskıda tablaya bakar)
  const profil = [
    [rs, hh - BOYUN.omuzEt],
    [ri, hh - BOYUN.omuzEt],
    [ri, 0],
    [ro, 0],
    [ro, hh],
    [rs, hh],
  ];
  const boyun = profilDondur(profil, 96, H - hh);

  // Kollar
  const kollar = [];
  const n = Math.max(2, Math.round(p.kolSayisi));
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const rDis = disR(th, 1, p) - p.cidar + BOYUN.kolGomme;
    const rIc = ro - 1.0;
    const boy = rDis - rIc;
    if (boy <= 1) continue;
    const kutu = new THREE.BoxGeometry(boy, hh, p.kolKalinlik);
    const m = new THREE.Matrix4()
      .makeRotationY(-th)
      .setPosition(
        ((rIc + rDis) / 2) * Math.cos(th),
        H - hh / 2,
        ((rIc + rDis) / 2) * Math.sin(th)
      );
    kutu.applyMatrix4(m);
    kollar.push(kutu);
  }
  return birlestir([boyun, ...kollar]);
}

/** Baskı yönü ve en kötü sarkma açısı (dikeyden derece) */
function sarkmaAcisi(p, ters) {
  const H = p.yukseklik;
  let enBuyuk = 0;
  const N = 80;
  for (let i = 0; i < N; i++) {
    const u0 = i / N, u1 = (i + 1) / N;
    const r0 = temelR(u0, p), r1 = temelR(u1, p);
    const buyume = ters ? r0 - r1 : r1 - r0;
    if (buyume <= 0) continue;
    const a = (Math.atan2(buyume, (u1 - u0) * H) * 180) / Math.PI;
    if (a > enBuyuk) enBuyuk = a;
  }
  return enBuyuk;
}

function baskiYonu(p) {
  const ters = sarkmaAcisi(p, true);
  const duz = sarkmaAcisi(p, false);
  if (p.montaj === "boyun") return { ters: true, aci: ters, zorunlu: true };
  return ters <= duz ? { ters: true, aci: ters, zorunlu: false } : { ters: false, aci: duz, zorunlu: false };
}

// İşaretli hacim (mm³) — diverjans teoremi
function hacimHesapla(geo) {
  const pos = geo.attributes.position.array;
  const index = geo.index ? geo.index.array : Array.from({ length: pos.length / 3 }, (_, i) => i);
  let v = 0;
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3,
      b = index[i + 1] * 3,
      c = index[i + 2] * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
    const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2];
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return Math.abs(v);
}

/* ---------------------------- STL ---------------------------------- */

const ucgenSayisi = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

function stlBinary(geoler, imza = "") {
  const liste = geoler.filter(Boolean);
  const toplam = liste.reduce((s, g) => s + ucgenSayisi(g), 0);
  const buf = new ArrayBuffer(84 + toplam * 50);
  const dv = new DataView(buf);
  // 80 baytlık başlık — sızan dosyanın kaynağı buradan izlenir
  const bas = imza.slice(0, 79);
  for (let i = 0; i < bas.length; i++) dv.setUint8(i, bas.charCodeAt(i) & 0xff);
  dv.setUint32(80, toplam, true);
  let o = 84;
  for (const geo of liste) {
    const pos = geo.attributes.position.array;
    const nor = geo.attributes.normal.array;
    const idx = geo.index ? geo.index.array : null;
    const say = ucgenSayisi(geo) * 3;
    for (let i = 0; i < say; i += 3) {
      const a = (idx ? idx[i] : i) * 3;
      const b = (idx ? idx[i + 1] : i + 1) * 3;
      const c = (idx ? idx[i + 2] : i + 2) * 3;
      const nx = nor[a] + nor[b] + nor[c];
      const ny = nor[a + 1] + nor[b + 1] + nor[c + 1];
      const nz = nor[a + 2] + nor[b + 2] + nor[c + 2];
      const len = Math.hypot(nx, ny, nz) || 1;
      // three (Y yukarı) -> STL (Z yukarı): X ekseni etrafında -90°, sarım korunur
      dv.setFloat32(o, nx / len, true); dv.setFloat32(o + 4, -nz / len, true); dv.setFloat32(o + 8, ny / len, true);
      o += 12;
      for (const v of [a, b, c]) {
        dv.setFloat32(o, pos[v], true);
        dv.setFloat32(o + 4, -pos[v + 2], true);
        dv.setFloat32(o + 8, pos[v + 1], true);
        o += 12;
      }
      dv.setUint16(o, 0, true);
      o += 2;
    }
  }
  return buf;
}

function indir(veri, ad, tip) {
  const blob = new Blob([veri], { type: tip });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ad;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------ RENK / YARDIMCI -------------------------- */

// Kelvin -> RGB (Tanner Helland yaklaşımı)
function kelvinRGB(k) {
  const t = k / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
    b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332);
    g = 288.12 * Math.pow(t - 60, -0.0755);
    b = 255;
  }
  const c = (x) => Math.min(255, Math.max(0, Math.round(x)));
  return `#${[c(r), c(g), c(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Basit bütünlük damgası. Şifreleme DEĞİL — sadece bozuk/elle kurcalanmış
// linkleri eler. Gerçek doğrulama sunucuda HMAC ile yapılmalı.
function damga(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const b64enc = (o) => {
  const govde = JSON.stringify(o);
  const paket = JSON.stringify({ d: o, k: damga(govde) });
  return btoa(unescape(encodeURIComponent(paket))).replace(/=+$/, "");
};
const b64dec = (s) => {
  try {
    const ham = JSON.parse(decodeURIComponent(escape(atob(s + "=".repeat((4 - (s.length % 4)) % 4)))));
    if (ham && ham.d && ham.k) {
      return damga(JSON.stringify(ham.d)) === ham.k ? ham.d : null;
    }
    return null;
  } catch {
    return null;
  }
};

const tl = (n) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n);

/** Masaüstü mü? Yerleşim mobilde tamamen değişiyor. */
function useGenisEkran() {
  const [genis, setGenis] = useState(
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const f = (e) => setGenis(e.matches);
    mq.addEventListener ? mq.addEventListener("change", f) : mq.addListener(f);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", f) : mq.removeListener(f));
  }, []);
  return genis;
}

/** iOS'ta 100vh adres çubuğunun altında kalıyor; dvh varsa onu kullan. */
const TAM_YUKSEKLIK =
  typeof CSS !== "undefined" && CSS.supports?.("height", "100dvh")
    ? "calc(100dvh - 78px)"
    : "calc(100vh - 78px)";

/* --------------------------- TEMA --------------------------------- */

const T = {
  oda: "#100E0C",
  panel: "#1A1613",
  panel2: "#221D19",
  cizgi: "#332C26",
  yazi: "#EFE7DD",
  soluk: "#9B8F84",
  uyari: "#E0A44C",
  hata: "#D9705A",
};
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/* ------------------------ UI PARÇALARI ---------------------------- */

function Etiket({ children, sag }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <span
        style={{ fontFamily: MONO, color: T.soluk, fontSize: 10, letterSpacing: "0.18em" }}
        className="uppercase"
      >
        {children}
      </span>
      {sag != null && (
        <span style={{ fontFamily: MONO, color: T.yazi, fontSize: 12 }}>{sag}</span>
      )}
    </div>
  );
}

function Kaydirac({ etiket, birim, deger, min, max, adim = 1, onChange, accent }) {
  return (
    <div className="mb-5">
      <Etiket sag={`${deger}${birim || ""}`}>{etiket}</Etiket>
      <input
        type="range"
        min={min}
        max={max}
        step={adim}
        value={deger}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
        style={{ accentColor: accent, height: 22 }}
        aria-label={etiket}
      />
    </div>
  );
}

function Secim({ etiket, secenekler, deger, onChange, accent }) {
  return (
    <div className="mb-5">
      <Etiket>{etiket}</Etiket>
      <div className="flex flex-wrap gap-1">
        {secenekler.map((s) => {
          const aktif = s.id === deger;
          return (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              className="px-3 py-2 transition-colors"
              style={{
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.04em",
                color: aktif ? T.oda : T.yazi,
                background: aktif ? accent : T.panel2,
                border: `1px solid ${aktif ? accent : T.cizgi}`,
                borderRadius: 2,
              }}
            >
              {s.ad}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AyarSatiri({ ad, deger, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <span style={{ fontFamily: MONO, fontSize: 11, color: T.soluk }}>{ad}</span>
      <input
        type="number"
        step="1"
        value={deger}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-24 px-2 py-1 text-right"
        style={{
          fontFamily: MONO, fontSize: 12, background: T.oda, color: T.yazi,
          border: `1px solid ${T.cizgi}`, borderRadius: 2,
        }}
      />
    </div>
  );
}

function Bolum({ no, baslik, children }) {
  return (
    <section className="px-5 py-6" style={{ borderTop: `1px solid ${T.cizgi}` }}>
      <div className="flex items-baseline gap-3 mb-5">
        <span style={{ fontFamily: MONO, fontSize: 10, color: T.soluk }}>{no}</span>
        <h3
          className="uppercase"
          style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: T.yazi }}
        >
          {baslik}
        </h3>
      </div>
      {children}
    </section>
  );
}

/* ------------------------- ANA BİLEŞEN ---------------------------- */

export default function AbajurKonfigurator({
  onAddToCart,
  baseUrl = "https://siteniz.com/abajur-tasarla",
  fiyat: fiyatProp,
  fiyatUrl = null,          // ör. "/fiyat.json" — tarife buradan çekilir
  /* GÜVENLİK — bkz. KURULUM.md
     "kapali": müşteri STL alamaz (varsayılan, önerilen)
     "sunucu": butona basınca onStlIstegi çağrılır, dosyayı backend üretir
     "acik":   tarayıcıda üretip indirir — yalnızca iç kullanım için */
  stlIndirme = "kapali",
  onStlIstegi,
  filigran = null,
  yoneticiPaneli = false,   // fiyat parametreleri paneli — müşteride KAPALI
}) {
  const [p, setP] = useState(() => {
    if (typeof window !== "undefined" && window.location.hash.startsWith("#d=")) {
      const d = b64dec(window.location.hash.slice(3));
      if (d && d.yukseklik) return { ...VARSAYILAN, ...d };
    }
    return VARSAYILAN;
  });
  const [isik, setIsik] = useState(true);
  const [otoDon, setOtoDon] = useState(true);
  const [fiyatAyar, setFiyatAyar] = useState(() => ({
    ...FIYAT,
    ...(fiyatProp || {}),
    filament: { ...FIYAT.filament, ...(fiyatProp?.filament || {}) },
    duy: { ...FIYAT.duy, ...(fiyatProp?.duy || {}) },
  }));

  // Tarifeyi sunucudaki JSON'dan çek — kod dağıtmadan fiyat güncellemek için
  useEffect(() => {
    if (!fiyatUrl) return;
    let iptal = false;
    fetch(fiyatUrl, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        if (iptal || !j) return;
        setFiyatAyar((o) => ({
          ...o,
          ...j,
          filament: { ...o.filament, ...(j.filament || {}) },
          duy: { ...o.duy, ...(j.duy || {}) },
        }));
      })
      .catch(() => {
        /* ulaşılamazsa yerleşik tarife kullanılır */
      });
    return () => {
      iptal = true;
    };
  }, [fiyatUrl]);

  const [ayarAcik, setAyarAcik] = useState(false);
  const [bildirim, setBildirim] = useState("");
  const genis = useGenisEkran();

  const set = useCallback((k, v) => setP((o) => ({ ...o, [k]: v })), []);

  const accent = useMemo(() => kelvinRGB(p.kelvin), [p.kelvin]);
  const renk = useMemo(() => RENKLER.find((r) => r.ad === p.renk) || RENKLER[0], [p.renk]);
  const duy = DUYLAR[p.duyTipi] || DUYLAR.E27;

  // Duy değişince boğaz çapı o standardın aralığına taşınır
  const duyDegistir = useCallback((v) => {
    const d = DUYLAR[v];
    setP((o) => ({
      ...o,
      duyTipi: v,
      bogazCap: o.duyTipi === v ? o.bogazCap : d.bogaz,
    }));
  }, []);

  /* ---------- geometri + ölçüm ---------- */
  const { geo, montajGeo, hacim, enBuyukCap } = useMemo(() => {
    const g = abajurGeometrisi(p);
    const mg = montajGeometrisi(p);
    g.computeBoundingBox();
    const bb = g.boundingBox;
    return {
      geo: g,
      montajGeo: mg,
      hacim: (hacimHesapla(g) + (mg ? hacimHesapla(mg) : 0)) / 1000, // cm³
      enBuyukCap: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z),
    };
  }, [p]);

  const yon = useMemo(() => baskiYonu(p), [p]);

  /* Kaydıraç sınırları tabladan türetilir; desen derinliği ve fıçı beli
     dış çapı büyüttüğü için o pay peşinen düşülür. Böylece "sığmıyor"
     hatasını kullanıcı hiç görmez — seçemez. */
  const sinir = useMemo(() => {
    const desenPay = p.desen === "duz" || p.desen === "faset" ? 0 : p.derinlik;
    const belPay = p.profil === "fici" ? p.bel : 0;
    const capTavan = Math.max(80, Math.floor(TABLA_CAP - PAY.cap - 2 * (desenPay + belPay)));
    const enBuyukCapAyari = Math.max(p.altCap, p.ustCap);
    return {
      capMax: capTavan,
      yukseklikMax: TABLA.z - PAY.yukseklik,
      derinlikMax: Math.max(
        0.5,
        Math.min(12, (TABLA_CAP - PAY.cap - enBuyukCapAyari) / 2 - belPay)
      ),
      belMax: Math.max(
        0,
        Math.min(60, (TABLA_CAP - PAY.cap - enBuyukCapAyari) / 2 - desenPay)
      ),
    };
  }, [p.desen, p.derinlik, p.profil, p.bel, p.altCap, p.ustCap]);

  // Sınır daralınca mevcut değerleri içeri çek
  useEffect(() => {
    setP((o) => {
      const y = {
        altCap: Math.min(o.altCap, sinir.capMax),
        ustCap: Math.min(o.ustCap, sinir.capMax),
        yukseklik: Math.min(o.yukseklik, sinir.yukseklikMax),
        derinlik: Math.min(o.derinlik, sinir.derinlikMax),
        bel: Math.min(o.bel, sinir.belMax),
      };
      const degisti = Object.keys(y).some((k) => y[k] !== o[k]);
      return degisti ? { ...o, ...y } : o;
    });
  }, [sinir]);

  const mal = MALZEMELER[p.malzeme];
  const gram = hacim * mal.yogunluk;
  const sureSaat = useMemo(() => {
    const akis = 4.0; // mm³/s efektif (0.4 nozul, 0.2 kat, tek duvar)
    return (hacim * 1000) / akis / 3600;
  }, [hacim]);

  const fiyatDetay = useMemo(() => {
    const t = fiyatAyar;
    const kgFiyat = t.filament[p.malzeme] ?? t.filament.PLA;

    // --- MALİYET ---
    const malzemeTL = (gram / 1000) * kgFiyat * (1 + t.fire / 100);
    const makineTL = sureSaat * t.makineSaat;
    const iscilikTL = t.elIsciligi;
    const boyunTL = p.montaj === "boyun" ? t.boyunMontaj : 0;
    const uretimMaliyeti = malzemeTL + makineTL + iscilikTL + boyunTL;

    // --- KÂR ---
    const karTL = uretimMaliyeti * (t.kar / 100);

    // --- HAZIR PARÇA (ayrı marj) ---
    const duyAlis = p.paket === "set" ? (t.duy[p.duyTipi] ?? 0) : 0;
    const duyTL = duyAlis * (1 + t.duyMarj / 100);

    const kdvsiz = uretimMaliyeti + karTL + duyTL;
    const kdvTL = kdvsiz * (t.kdv / 100);
    const birim = kdvsiz + kdvTL;

    return {
      malzemeTL, makineTL, iscilikTL, boyunTL, duyAlis,
      uretimMaliyeti, karTL, duyTL, kdvsiz, kdvTL,
      toplamMaliyet: uretimMaliyeti + duyAlis,
      birim,
      toplam: birim * p.adet,
    };
  }, [gram, sureSaat, fiyatAyar, p.malzeme, p.montaj, p.paket, p.duyTipi, p.adet]);

  /* ---------- doğrulama ---------- */
  const uyarilar = useMemo(() => {
    const u = [];
    if (p.montaj === "boyun") {
      const boyunDis = p.bogazCap + BOYUN.tolerans + 2 * BOYUN.govdeEt;
      if (p.ustCap < boyunDis + 16)
        u.push({ tip: "hata", m: `${p.duyTipi} boynu için üst çap en az ${Math.ceil(boyunDis + 16)} mm olmalı.` });
      if (p.boyunH < 8)
        u.push({ tip: "uyari", m: "Boyun 8 mm'den kısa olursa duy halkası kavramaz." });
      if (p.kolSayisi < 3)
        u.push({ tip: "uyari", m: "3'ten az kol boynu eğrilmeye açık bırakır." });
      if (yon.aci > 50)
        u.push({ tip: "uyari", m: `Ters baskıda ${yon.aci.toFixed(0)}° sarkma var; alt kenar destek isteyebilir.` });
    }
    if (p.yukseklik > TABLA.z - PAY.yukseklik)
      u.push({ tip: "hata", m: `Yükseklik yazıcıya sığmıyor (max ${TABLA.z - PAY.yukseklik} mm).` });
    if (enBuyukCap > TABLA_CAP - PAY.cap)
      u.push({ tip: "hata", m: `Çap tablaya sığmıyor (max ${TABLA_CAP - PAY.cap} mm).` });
    if (p.cidar < 0.9) u.push({ tip: "uyari", m: "0,9 mm altı duvar kırılgan olur." });
    if (p.cidar > 2.4) u.push({ tip: "uyari", m: "Kalın duvar ışığı geçirmez, süre ve maliyet artar." });
    if (p.desen !== "duz" && p.derinlik > p.altCap / 8)
      u.push({ tip: "uyari", m: "Desen derinliği gövdeye göre fazla; sarkma riski." });
    if (Math.abs(p.burgu) > 0 && p.desen === "faset")
      u.push({ tip: "uyari", m: "Faset + burgu kombinasyonu yüzeyi bozabilir." });
    if (p.malzeme === "PLA")
      u.push({ tip: "uyari", m: "PLA yalnızca LED ampulle kullanılmalı." });
    return u;
  }, [p, enBuyukCap, yon]);

  const hataVar = uyarilar.some((u) => u.tip === "hata");

  /* ---------- three.js sahnesi ---------- */
  const kap = useRef(null);
  const ref = useRef({});

  useEffect(() => {
    const el = kap.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(T.oda);
    scene.fog = new THREE.FogExp2(T.oda, 0.00042);

    const camera = new THREE.PerspectiveCamera(35, 1, 1, 6000);
    // preserveDrawingBuffer: false -> canvas.toDataURL() boş döner,
    // sayfadan programatik ekran görüntüsü alınamaz
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.draggable = false;
    const engelle = (e) => e.preventDefault();
    renderer.domElement.addEventListener("contextmenu", engelle);
    renderer.domElement.draggable = false;
    const onMenu = (e) => e.preventDefault();
    renderer.domElement.addEventListener("contextmenu", onMenu);

    // Kapalı oda — ışık zemine, duvarlara ve tavana yayılsın
    const odaMat = new THREE.MeshStandardMaterial({
      color: 0x2a241e,
      roughness: 0.95,
      metalness: 0,
      side: THREE.BackSide,
    });
    const oda = new THREE.Mesh(new THREE.BoxGeometry(4200, 2600, 3600), odaMat);
    oda.position.set(0, 1240, 0);
    oda.receiveShadow = true;
    scene.add(oda);

    // Ortam haritası — yansımalar olmadan malzeme plastik görünüyor
    try {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 128;
      const g2 = c.getContext("2d");
      const grd = g2.createLinearGradient(0, 0, 0, 128);
      grd.addColorStop(0, "#3b4450");   // tavan tarafı, soğuk
      grd.addColorStop(0.5, "#2a2622");
      grd.addColorStop(1, "#171310");   // zemin tarafı, sıcak koyu
      g2.fillStyle = grd;
      g2.fillRect(0, 0, 256, 128);
      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      pmrem.dispose();
    } catch (e) {
      /* ortam haritası olmadan da çalışır */
    }

    const ortam = new THREE.AmbientLight(0xffffff, 0.06);
    scene.add(ortam);
    const hemi = new THREE.HemisphereLight(0x8fa6c0, 0x1a1512, 0.18);
    scene.add(hemi);
    const anahtar = new THREE.DirectionalLight(0xffffff, 0.35);
    anahtar.position.set(-380, 520, 420);
    scene.add(anahtar);

    // Ampul — mesafeye göre sönümlenen ana kaynak
    const ampulIsik = new THREE.PointLight(0xffffff, 2.4, 1600, 2.0);
    ampulIsik.castShadow = true;
    ampulIsik.shadow.mapSize.set(1024, 1024);
    ampulIsik.shadow.bias = -0.004;
    ampulIsik.shadow.camera.near = 2;
    ampulIsik.shadow.camera.far = 2600;
    scene.add(ampulIsik);

    // Dolgu — tek noktasal kaynağın sert gölgesini yumuşatır (gölge üretmez)
    const dolgu = new THREE.PointLight(0xffffff, 0.5, 2200, 2.0);
    scene.add(dolgu);

    const ampul = new THREE.Mesh(
      new THREE.SphereGeometry(18, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    scene.add(ampul);

    // Ampul parlaması — açıklıklardan görünür, duvar arkasında kalınca gizlenir
    const pc = document.createElement("canvas");
    pc.width = pc.height = 128;
    const pg = pc.getContext("2d");
    const rg = pg.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, "rgba(255,255,255,0.9)");
    rg.addColorStop(0.25, "rgba(255,255,255,0.35)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    pg.fillStyle = rg;
    pg.fillRect(0, 0, 128, 128);
    const parlama = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(pc),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    parlama.scale.set(240, 240, 1);
    scene.add(parlama);

    const govdeMat = new THREE.MeshStandardMaterial({
      color: 0xede4d3,
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide,
      envMapIntensity: 0.5,
    });
    // Emissive'i vertex başına hesaplanan geçiş miktarıyla çarp
    govdeMat.onBeforeCompile = (sh) => {
      sh.vertexShader =
        "attribute float aIsik;\nvarying float vIsik;\n" +
        sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vIsik = aIsik;");
      sh.fragmentShader =
        "varying float vIsik;\n" +
        sh.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vIsik;"
        );
    };
    const govde = new THREE.Mesh(new THREE.BufferGeometry(), govdeMat);
    govde.castShadow = true;
    govde.receiveShadow = true;
    scene.add(govde);

    const montajMat = new THREE.MeshStandardMaterial({
      color: 0xede4d3,
      roughness: 0.6,
      metalness: 0.05,
      flatShading: true,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide,
    });
    const montajMesh = new THREE.Mesh(new THREE.BufferGeometry(), montajMat);
    montajMesh.castShadow = true;
    montajMesh.receiveShadow = true;
    scene.add(montajMesh);

    // yörünge kontrolü (elle)
    const kam = { theta: 0.6, phi: 1.32, dist: 900, hedef: 130 };
    let surukle = null;
    let pinch = null;
    let etkilesim = false;

    const yerlestir = () => {
      const x = kam.dist * Math.sin(kam.phi) * Math.sin(kam.theta);
      const y = kam.dist * Math.cos(kam.phi) + kam.hedef;
      const z = kam.dist * Math.sin(kam.phi) * Math.cos(kam.theta);
      camera.position.set(x, y, z);
      camera.lookAt(0, kam.hedef, 0);
    };

    // Nesneyi dikey VE yatay olarak görüş alanına sığdırır.
    // Dar/kısa ekranlarda mesafe otomatik artar.
    const cerceve = () => {
      const { H, R } = ref.current.olcek || { H: 260, R: 100 };
      const yariFov = (camera.fov * Math.PI) / 180 / 2;
      const dikey = H / 2 / Math.tan(yariFov);
      const yatay = R / (Math.tan(yariFov) * Math.max(0.35, camera.aspect));
      kam.hedef = H * 0.45;
      kam.dist = Math.min(1500, Math.max(200, Math.max(dikey, yatay) * 1.35 + R));
      yerlestir();
    };

    const dom = renderer.domElement;
    const onDown = (e) => {
      dom.setPointerCapture?.(e.pointerId);
      surukle = { x: e.clientX, y: e.clientY };
      etkilesim = true;
      ref.current.durdur?.();
    };
    const onMove = (e) => {
      if (!surukle) return;
      kam.theta -= (e.clientX - surukle.x) * 0.008;
      kam.phi = Math.min(Math.PI - 0.25, Math.max(0.25, kam.phi - (e.clientY - surukle.y) * 0.006));
      surukle = { x: e.clientX, y: e.clientY };
      yerlestir();
    };
    const onUp = () => { surukle = null; };
    const onWheel = (e) => {
      e.preventDefault();
      kam.dist = Math.min(1500, Math.max(200, kam.dist * (1 + Math.sign(e.deltaY) * 0.09)));
      yerlestir();
    };
    const onTouch = (e) => {
      if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (pinch) {
          kam.dist = Math.min(1500, Math.max(200, kam.dist * (pinch / d)));
          yerlestir();
        }
        pinch = d;
        surukle = null;
      }
    };
    const onTouchEnd = () => { pinch = null; };

    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointercancel", onUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("touchmove", onTouch, { passive: true });
    dom.addEventListener("touchend", onTouchEnd);

    const olcu = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h);          // CSS boyutu da güncellensin
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      cerceve();
    };
    olcu();
    const ro = new ResizeObserver(olcu);
    ro.observe(el);

    const azalt = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf;
    const dongu = () => {
      raf = requestAnimationFrame(dongu);
      if (ref.current.otoDon && !surukle && !azalt) {
        kam.theta += 0.0022;
        yerlestir();
      }
      renderer.render(scene, camera);
    };
    yerlestir();
    dongu();

    ref.current = {
      ...ref.current, scene, camera, renderer, govde, govdeMat, montajMesh, montajMat, ampulIsik, dolgu, ampul, parlama,
      ortam, hemi, anahtar, kam, yerlestir, cerceve, etkilesim: () => etkilesim,
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointercancel", onUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("touchmove", onTouch);
      dom.removeEventListener("touchend", onTouchEnd);
      dom.removeEventListener("contextmenu", engelle);
      dom.removeEventListener("contextmenu", onMenu);
      renderer.dispose();
      if (dom.parentNode) dom.parentNode.removeChild(dom);
    };
  }, []);

  // geometri güncelle
  useEffect(() => {
    const s = ref.current;
    if (!s.govde) return;
    s.govde.geometry.dispose();
    s.govde.geometry = geo;
    s.govdeMat.flatShading = p.desen === "faset";
    s.govdeMat.needsUpdate = true;

    s.montajMesh.geometry.dispose();
    s.montajMesh.geometry = montajGeo || new THREE.BufferGeometry();
    s.montajMesh.visible = !!montajGeo;

    s.ampulIsik.position.set(0, p.yukseklik * 0.55, 0);
    s.dolgu.position.set(0, p.yukseklik * 0.3, 0);
    s.ampul.position.set(0, p.yukseklik * 0.55, 0);
    s.parlama.position.set(0, p.yukseklik * 0.55, 0);

    const k = new THREE.Color(accent);
    s.ampulIsik.color = k;
    s.dolgu.color = k;
    s.ampul.material.color = k;
    s.parlama.material.color = k;

    s.olcek = { H: p.yukseklik, R: enBuyukCap / 2 };
    s.cerceve();
  }, [geo, montajGeo, p.yukseklik, p.desen, accent, enBuyukCap]);

  // renk / ışık durumu
  useEffect(() => {
    const s = ref.current;
    if (!s.govdeMat) return;
    s.govdeMat.color = new THREE.Color(renk.hex);
    if (s.montajMat) s.montajMat.color = new THREE.Color(renk.hex);
    const k = new THREE.Color(accent);
    if (isik) {
      // Duvardan geçen ışık ampul renginin malzeme renginden süzülmüş hali
      s.govdeMat.emissive = k.clone().multiply(new THREE.Color(renk.hex));
      s.govdeMat.emissiveIntensity = 1.15 * renk.gecirgen;
      s.ampulIsik.intensity = 2.4;
      s.dolgu.intensity = 0.5;
      s.ampul.visible = true;
      s.parlama.visible = true;
      s.ortam.intensity = 0.05;
      s.anahtar.intensity = 0.22;
      s.hemi.intensity = 0.1;
      s.renderer.toneMappingExposure = 1.0;
    } else {
      s.govdeMat.emissive = new THREE.Color(0x000000);
      s.govdeMat.emissiveIntensity = 0;
      s.ampulIsik.intensity = 0;
      s.dolgu.intensity = 0;
      s.ampul.visible = false;
      s.parlama.visible = false;
      s.ortam.intensity = 0.25;
      s.anahtar.intensity = 1.0;
      s.hemi.intensity = 0.5;
      s.renderer.toneMappingExposure = 1.25;
    }
    s.govdeMat.needsUpdate = true;
  }, [isik, renk, accent, p.cidar]);

  useEffect(() => {
    ref.current.otoDon = otoDon;
    ref.current.durdur = () => setOtoDon(false);
  }, [otoDon]);

  /* ---------- aksiyonlar ---------- */
  const bildir = (m) => {
    setBildirim(m);
    setTimeout(() => setBildirim(""), 2600);
  };

  const dosyaAdi = `abajur_${p.profil}_${p.altCap}x${p.yukseklik}_${p.desen}`;

  const paket = () => ({
    surum: 2,
    config: p,
    ozet: {
      gram: +gram.toFixed(1),
      hacimCm3: +hacim.toFixed(1),
      sureSaat: +sureSaat.toFixed(2),
      enBuyukCapMm: Math.round(enBuyukCap),
      baskiYonu: yon.ters ? "ters" : "duz",
      sarkmaAcisi: +yon.aci.toFixed(1),
      vazoModu: p.montaj !== "boyun",
    },
    // SADECE GÖSTERİM — sunucu fiyatı config'ten yeniden hesaplamalı
    fiyatGosterim: {
      birim: Math.round(fiyatDetay.birim),
      toplam: Math.round(fiyatDetay.toplam),
      paraBirimi: "TRY",
    },
    stlAdi: `${dosyaAdi}.stl`,
    link: `${baseUrl}#d=${b64enc(p)}`,
  });

  const stlAksiyonu = () => {
    if (stlIndirme === "sunucu") {
      if (onStlIstegi) onStlIstegi(paket());
      bildir("Dosya talebi gönderildi.");
      return;
    }
    const imza = `${filigran || "abajur"} | ${new Date().toISOString().slice(0, 10)} | ${b64enc(p).slice(0, 24)}`;
    indir(stlBinary([geo, montajGeo], imza), `${dosyaAdi}.stl`, "model/stl");
    bildir("STL indirildi.");
  };

  const linkKopyala = () => {
    const link = `${baseUrl}#d=${b64enc(p)}`;
    const yedek = () => {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(() => bildir("Tasarım linki kopyalandı."), () => { yedek(); bildir("Tasarım linki kopyalandı."); });
    } else {
      yedek();
      bildir("Tasarım linki kopyalandı.");
    }
  };

  const sepete = async () => {
    const payload = paket();
    try {
      if (onAddToCart) await onAddToCart(payload);
      else console.log("SEPET →", payload);
      bildir(`${p.adet} adet sepete eklendi.`);
    } catch (error) {
      bildir(error?.message || "Sepete eklenemedi.");
    }
  };

  /* ---------- render ---------- */
  return (
    <div
      className="w-full flex"
      style={{
        background: T.oda,
        color: T.yazi,
        fontFamily: SANS,
        flexDirection: genis ? "row" : "column",
        minHeight: TAM_YUKSEKLIK,
        overflowX: "hidden",
      }}
    >
      {/* SAHNE */}
      <div
        className="relative"
        style={
          genis
            ? { flex: 1, minHeight: 0 }
            : {
                height: TAM_YUKSEKLIK === "100dvh" ? "46dvh" : "46vh",
                minHeight: 260,
                position: "sticky",
                top: 0,
                zIndex: 10,
                flexShrink: 0,
                borderBottom: `1px solid ${T.cizgi}`,
              }
        }
      >
        <div ref={kap} className="absolute inset-0" style={{ overflow: "hidden" }} />

        <div className="absolute top-0 left-0 p-4 pointer-events-none" style={{ maxWidth: "72%" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.22em", color: T.soluk }} className="uppercase mb-1">
            Baskı abajur · tasarla
          </div>
          <div style={{ fontSize: genis ? 30 : 21, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
            Işığın biçimini <span style={{ color: accent }}>sen kur</span>
          </div>
        </div>

        {filigran && (
          <div
            className="absolute pointer-events-none select-none"
            style={{
              right: 12,
              top: 12,
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.28)",
              textTransform: "uppercase",
            }}
          >
            {filigran}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-4 gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setIsik((v) => !v)}
              className="px-3 py-2"
              style={{
                fontFamily: MONO, fontSize: 11, borderRadius: 2,
                border: `1px solid ${isik ? accent : T.cizgi}`,
                background: isik ? accent : "rgba(0,0,0,0.35)",
                color: isik ? T.oda : T.yazi,
              }}
            >
              {isik ? "Işık açık" : "Işık kapalı"}
            </button>
            <button
              onClick={() => setOtoDon((v) => !v)}
              className="px-3 py-2"
              style={{
                fontFamily: MONO, fontSize: 11, borderRadius: 2,
                border: `1px solid ${T.cizgi}`, background: "rgba(0,0,0,0.35)", color: T.soluk,
              }}
            >
              {otoDon ? "Dönüşü durdur" : "Döndür"}
            </button>
          </div>
          <div className="text-right" style={{ fontFamily: MONO, fontSize: 10, color: T.soluk, lineHeight: 1.7 }}>
            <div>Ø{Math.round(enBuyukCap)} × {p.yukseklik} mm</div>
            <div>{gram.toFixed(0)} g · ~{sureSaat.toFixed(1)} sa</div>
          </div>
        </div>

        {bildirim && (
          <div
            className="absolute top-5 right-5 px-4 py-2"
            style={{ fontFamily: MONO, fontSize: 11, background: accent, color: T.oda, borderRadius: 2 }}
            role="status"
          >
            {bildirim}
          </div>
        )}
      </div>

      {/* KONTROL RAYI */}
      <div
        className="w-full"
        style={
          genis
            ? {
                width: 384,
                flexShrink: 0,
                background: T.panel,
                borderLeft: `1px solid ${T.cizgi}`,
                maxHeight: TAM_YUKSEKLIK,
                overflowY: "auto",
              }
            : { background: T.panel }
        }
      >
        <Bolum no="01" baslik="Paket">
          <div className="flex flex-col gap-2 mb-4">
            {Object.entries(PAKETLER).map(([id, pk]) => {
              const aktif = p.paket === id;
              return (
                <button
                  key={id}
                  onClick={() => set("paket", id)}
                  className="text-left px-4 py-3"
                  style={{
                    border: `1px solid ${aktif ? accent : T.cizgi}`,
                    background: aktif ? "rgba(255,255,255,0.04)" : "transparent",
                    borderRadius: 2,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span style={{ fontSize: 14, fontWeight: 700, color: aktif ? accent : T.yazi }}>
                      {pk.ad}
                    </span>
                    {id === "set" && (
                      <span style={{ fontFamily: MONO, fontSize: 11, color: T.soluk }}>
                        +{tl(DUYLAR[p.duyTipi].setTL * 1.35)} ₺
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: T.soluk, marginTop: 4 }}>
                    {pk.aciklama}
                  </div>
                </button>
              );
            })}
          </div>
          <Secim
            etiket="Duy standardı"
            secenekler={Object.keys(DUYLAR).map((k) => ({ id: k, ad: k }))}
            deger={p.duyTipi}
            onChange={duyDegistir}
            accent={accent}
          />
          <div style={{ fontFamily: MONO, fontSize: 10, color: T.soluk, lineHeight: 1.6 }}>
            {p.paket === "set"
              ? `Sete ${p.duyTipi} duy takılır. Boyun ölçüsü buna göre kurulur.`
              : `Boyun ${p.duyTipi} duyuna göre ölçülendirilir, duy sete dahil değildir.`}
          </div>
        </Bolum>

        <Bolum no="02" baslik="Gövde">
          <Secim etiket="Profil" secenekler={PROFILLER} deger={p.profil} onChange={(v) => set("profil", v)} accent={accent} />
          <Kaydirac etiket="Alt çap" birim=" mm" deger={p.altCap} min={80} max={sinir.capMax} onChange={(v) => set("altCap", v)} accent={accent} />
          <Kaydirac etiket="Üst çap" birim=" mm" deger={p.ustCap} min={46} max={sinir.capMax} onChange={(v) => set("ustCap", v)} accent={accent} />
          <Kaydirac etiket="Yükseklik" birim=" mm" deger={p.yukseklik} min={80} max={sinir.yukseklikMax} onChange={(v) => set("yukseklik", v)} accent={accent} />
          {(p.profil === "fici" || p.profil === "kumsaati") && (
            <Kaydirac etiket="Bel miktarı" birim=" mm" deger={p.bel} min={0} max={sinir.belMax} onChange={(v) => set("bel", v)} accent={accent} />
          )}
        </Bolum>

        <Bolum no="03" baslik="Yüzey">
          <Secim etiket="Desen" secenekler={DESENLER} deger={p.desen} onChange={(v) => set("desen", v)} accent={accent} />
          {p.desen !== "duz" && (
            <>
              <Kaydirac etiket={p.desen === "faset" ? "Yüz sayısı" : "Nervür sayısı"} deger={p.nervurSayisi} min={4} max={64} onChange={(v) => set("nervurSayisi", v)} accent={accent} />
              {p.desen !== "faset" && (
                <Kaydirac etiket="Derinlik" birim=" mm" deger={p.derinlik} min={0.5} max={sinir.derinlikMax} adim={0.5} onChange={(v) => set("derinlik", v)} accent={accent} />
              )}
              <Kaydirac etiket="Burgu" birim="°" deger={p.burgu} min={-360} max={360} adim={5} onChange={(v) => set("burgu", v)} accent={accent} />
              {p.desen === "dalga" && (
                <Kaydirac etiket="Dalga sayısı" deger={p.dalgaSayisi} min={1} max={20} onChange={(v) => set("dalgaSayisi", v)} accent={accent} />
              )}
            </>
          )}
          <Kaydirac etiket="Duvar kalınlığı" birim=" mm" deger={p.cidar} min={0.6} max={3} adim={0.1} onChange={(v) => set("cidar", v)} accent={accent} />
        </Bolum>

        <Bolum no="04" baslik="Malzeme ve ışık">
          <Secim
            etiket="Filament"
            secenekler={Object.keys(MALZEMELER).map((k) => ({ id: k, ad: k }))}
            deger={p.malzeme}
            onChange={(v) => set("malzeme", v)}
            accent={accent}
          />
          <div className="mb-5">
            <Etiket sag={p.renk}>Renk</Etiket>
            <div className="flex flex-wrap gap-2">
              {RENKLER.map((r) => (
                <button
                  key={r.ad}
                  onClick={() => set("renk", r.ad)}
                  title={r.ad}
                  aria-label={r.ad}
                  style={{
                    width: 34, height: 34, background: r.hex, borderRadius: 2,
                    outline: p.renk === r.ad ? `2px solid ${accent}` : "none",
                    outlineOffset: 2,
                    border: `1px solid ${T.cizgi}`,
                  }}
                />
              ))}
            </div>
          </div>
          <Secim
            etiket="Montaj"
            secenekler={Object.entries(MONTAJ).map(([id, m]) => ({ id, ad: m.ad }))}
            deger={p.montaj}
            onChange={(v) => set("montaj", v)}
            accent={accent}
          />
          {p.montaj === "boyun" && (
            <div className="mb-5 p-3" style={{ background: T.panel2, borderRadius: 2 }}>
              <Kaydirac
                etiket="Boğaz çapı"
                birim=" mm"
                deger={p.bogazCap}
                min={duy.min}
                max={duy.max}
                adim={0.5}
                onChange={(v) => set("bogazCap", v)}
                accent={accent}
              />
              <Kaydirac etiket="Boyun yüksekliği" birim=" mm" deger={p.boyunH} min={6} max={30} onChange={(v) => set("boyunH", v)} accent={accent} />
              <Kaydirac etiket="Kol sayısı" deger={p.kolSayisi} min={2} max={8} onChange={(v) => set("kolSayisi", v)} accent={accent} />
              <Kaydirac etiket="Kol kalınlığı" birim=" mm" deger={p.kolKalinlik} min={3} max={12} adim={0.5} onChange={(v) => set("kolKalinlik", v)} accent={accent} />
              <div style={{ fontFamily: MONO, fontSize: 10, color: T.soluk, lineHeight: 1.6 }}>
                Duy içeriden geçirilir, duy halkası omuza oturur. {p.duyTipi} için tipik
                boğaz {duy.bogaz} mm; kendi duyunu ölçüp gireceksen modele{" "}
                {BOYUN.tolerans} mm boşluk eklenir.
              </div>
            </div>
          )}
          <Kaydirac etiket="Ampul rengi" birim=" K" deger={p.kelvin} min={2200} max={6000} adim={100} onChange={(v) => set("kelvin", v)} accent={accent} />
        </Bolum>

        {uyarilar.length > 0 && (
          <div className="px-5 py-4" style={{ borderTop: `1px solid ${T.cizgi}` }}>
            {uyarilar.map((u, i) => (
              <div key={i} className="flex gap-2 mb-2" style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.5 }}>
                <span style={{ color: u.tip === "hata" ? T.hata : T.uyari }}>{u.tip === "hata" ? "×" : "!"}</span>
                <span style={{ color: u.tip === "hata" ? T.hata : T.uyari }}>{u.m}</span>
              </div>
            ))}
          </div>
        )}

        <Bolum no="05" baslik="Üretim özeti">
          <div style={{ fontFamily: MONO, fontSize: 12 }}>
            {[
              ["Ölçü", `Ø${Math.round(enBuyukCap)} × ${p.yukseklik} mm`],
              ["Malzeme hacmi", `${hacim.toFixed(1)} cm³`],
              ["Ağırlık", `${gram.toFixed(0)} g`],
              ["Baskı süresi", `~${sureSaat.toFixed(1)} saat`],
              [
                "Duvar",
                `${p.cidar.toFixed(1)} mm · ${p.montaj === "boyun" ? "normal mod" : "vazo modu uyumlu"}`,
              ],
              [
                "Baskı yönü",
                `${yon.ters ? "Ters — üst halka tablada" : "Düz — alt halka tablada"}${yon.zorunlu ? " (zorunlu)" : ""}`,
              ],
              ["Sarkma", `en fazla ${yon.aci.toFixed(0)}° · ${yon.aci > 50 ? "destek gerekebilir" : "desteksiz"}`],
              [
                "Montaj",
                p.montaj === "boyun" ? `${p.duyTipi} · Ø${p.bogazCap} boğaz · ${p.kolSayisi} kol` : "Duy halkası ile",
              ],
              ["Not", mal.not],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2" style={{ borderBottom: `1px solid ${T.cizgi}` }}>
                <span style={{ color: T.soluk }}>{k}</span>
                <span className="text-right">{v}</span>
              </div>
            ))}
          </div>

          {yoneticiPaneli && (
          <button
            onClick={() => setAyarAcik((v) => !v)}
            className="mt-4"
            style={{ fontFamily: MONO, fontSize: 10, color: T.soluk, letterSpacing: "0.1em" }}
          >
            {ayarAcik ? "− " : "+ "}FİYAT PARAMETRELERİ (yönetici)
          </button>
          )}
          {yoneticiPaneli && ayarAcik && (
            <div className="mt-3 p-3" style={{ background: T.panel2, borderRadius: 2 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: T.soluk, letterSpacing: "0.14em" }} className="uppercase mb-2">
                Maliyet kalemleri
              </div>
              {Object.keys(MALZEMELER).map((m) => (
                <AyarSatiri
                  key={m}
                  ad={`${m} ₺/kg`}
                  deger={fiyatAyar.filament[m]}
                  onChange={(v) => setFiyatAyar((o) => ({ ...o, filament: { ...o.filament, [m]: v } }))}
                />
              ))}
              {[
                ["fire", "Fire payı %"],
                ["makineSaat", "Makine ₺/saat"],
                ["elIsciligi", "El işçiliği ₺/adet"],
                ["boyunMontaj", "Boyun montajı ₺"],
              ].map(([k, ad]) => (
                <AyarSatiri
                  key={k}
                  ad={ad}
                  deger={fiyatAyar[k]}
                  onChange={(v) => setFiyatAyar((o) => ({ ...o, [k]: v }))}
                />
              ))}
              {Object.keys(DUYLAR).map((d) => (
                <AyarSatiri
                  key={d}
                  ad={`${d} duy seti ₺`}
                  deger={fiyatAyar.duy[d]}
                  onChange={(v) => setFiyatAyar((o) => ({ ...o, duy: { ...o.duy, [d]: v } }))}
                />
              ))}

              <div style={{ fontFamily: MONO, fontSize: 10, color: T.soluk, letterSpacing: "0.14em" }} className="uppercase mt-4 mb-2">
                Kâr ve vergi
              </div>
              {[
                ["kar", "Üretim kârı %"],
                ["duyMarj", "Duy marjı %"],
                ["kdv", "KDV %"],
              ].map(([k, ad]) => (
                <AyarSatiri
                  key={k}
                  ad={ad}
                  deger={fiyatAyar[k]}
                  onChange={(v) => setFiyatAyar((o) => ({ ...o, [k]: v }))}
                />
              ))}

              <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.cizgi}`, fontFamily: MONO, fontSize: 11 }}>
                {[
                  ["Filament", fiyatDetay.malzemeTL],
                  ["Makine", fiyatDetay.makineTL],
                  ["El işçiliği", fiyatDetay.iscilikTL],
                  ["Boyun montajı", fiyatDetay.boyunTL],
                  ["ÜRETİM MALİYETİ", fiyatDetay.uretimMaliyeti],
                  ["Kâr", fiyatDetay.karTL],
                  ["Duy seti (marjlı)", fiyatDetay.duyTL],
                  ["KDV", fiyatDetay.kdvTL],
                  ["SATIŞ", fiyatDetay.birim],
                ].map(([k, v]) => {
                  const vurgu = k === k.toUpperCase();
                  return (
                    <div key={k} className="flex justify-between py-1">
                      <span style={{ color: vurgu ? T.yazi : T.soluk }}>{k}</span>
                      <span style={{ color: vurgu ? accent : T.yazi }}>{tl(v)} ₺</span>
                    </div>
                  );
                })}
                <div className="flex justify-between py-1 mt-1" style={{ borderTop: `1px solid ${T.cizgi}` }}>
                  <span style={{ color: T.soluk }}>Brüt kâr</span>
                  <span style={{ color: T.yazi }}>
                    {tl(fiyatDetay.kdvsiz - fiyatDetay.toplamMaliyet)} ₺ ·{" "}
                    {((1 - fiyatDetay.toplamMaliyet / fiyatDetay.kdvsiz) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div style={{ fontFamily: MONO, fontSize: 10, color: T.soluk, lineHeight: 1.6 }} className="mt-3">
                Buradaki değişiklikler yalnızca bu oturumda geçerli. Kalıcı güncelleme
                için `fiyatUrl` ile sunucudaki JSON'u düzenle.
              </div>
            </div>
          )}
        </Bolum>

        {/* SEPET */}
        <div
          className="px-5 py-5 sticky"
          style={{
            bottom: 0,
            zIndex: 20,
            background: T.panel,
            borderTop: `1px solid ${T.cizgi}`,
            boxShadow: genis ? "none" : "0 -12px 24px rgba(0,0,0,0.45)",
          }}
        >
          <div className="flex items-end justify-between mb-4">
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: T.soluk, letterSpacing: "0.18em" }} className="uppercase">
                Toplam · KDV dahil
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em" }}>
                {tl(fiyatDetay.toplam)} <span style={{ fontSize: 18, color: accent }}>₺</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: T.soluk }}>
                birim {tl(fiyatDetay.birim)} ₺
              </div>
            </div>
            <div className="flex items-center" style={{ border: `1px solid ${T.cizgi}`, borderRadius: 2 }}>
              <button onClick={() => set("adet", Math.max(1, p.adet - 1))} className="px-3 py-2" style={{ color: T.soluk }} aria-label="Azalt">−</button>
              <span className="px-2" style={{ fontFamily: MONO, fontSize: 14 }}>{p.adet}</span>
              <button onClick={() => set("adet", Math.min(20, p.adet + 1))} className="px-3 py-2" style={{ color: T.soluk }} aria-label="Artır">+</button>
            </div>
          </div>

          <button
            onClick={sepete}
            disabled={hataVar}
            className="w-full py-4 mb-2"
            style={{
              fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: "0.14em",
              textTransform: "uppercase", borderRadius: 2,
              background: hataVar ? T.panel2 : accent,
              color: hataVar ? T.soluk : T.oda,
              cursor: hataVar ? "not-allowed" : "pointer",
            }}
          >
            {hataVar ? "Ölçüleri düzelt" : "Sepete ekle"}
          </button>

          <div className="flex flex-wrap gap-2">
            {stlIndirme !== "kapali" && (
              <button
                onClick={stlAksiyonu}
                disabled={hataVar}
                className="flex-1 py-3"
                style={{ fontFamily: MONO, fontSize: 11, border: `1px solid ${T.cizgi}`, color: hataVar ? T.soluk : T.yazi, borderRadius: 2 }}
              >
                {stlIndirme === "sunucu" ? "Dosya iste" : "STL indir"}
              </button>
            )}
            <button
              onClick={linkKopyala}
              className="flex-1 py-3"
              style={{ fontFamily: MONO, fontSize: 11, border: `1px solid ${T.cizgi}`, color: T.yazi, borderRadius: 2 }}
            >
              Tasarımı paylaş
            </button>
            <button
              onClick={() => setP(VARSAYILAN)}
              className="py-3 px-3"
              style={{ fontFamily: MONO, fontSize: 11, border: `1px solid ${T.cizgi}`, color: T.soluk, borderRadius: 2 }}
            >
              Sıfırla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
