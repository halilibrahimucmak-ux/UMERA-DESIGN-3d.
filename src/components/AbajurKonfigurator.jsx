import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import {
  GEO_SURUM,
  TABLA,
  PAY,
  TABLA_CAP,
  DUY_MONTAJ,
  KALITE,
  DUVAR_SECENEKLERI,
  abajurGeometrisi,
  montajParcalari,
  birlestir,
  hacimHesapla,
  enBuyukYaricap,
  baskiYonu,
  duvarSayisi,
  cidarKirp,
  olcum,
  YOGUNLUK,
} from "../../lib/abajur-geometri.mjs";

/* ------------------------------------------------------------------ *
 *  ABAJUR KONFİGÜRATÖRÜ
 *
 *  Geometri bu dosyada DEĞİL: lib/abajur-geometri.mjs. Sunucudaki STL
 *  üreticisi de aynı modülü kullanır, dolayısıyla müşterinin döndürüp
 *  incelediği model ile basılan model aynı matematikten çıkar. Buradaki
 *  tek fark çözünürlük (KALITE.onizleme) ve gösterim amaçlı ışık
 *  hesabıdır.
 * ------------------------------------------------------------------ */

/* ---------------------------- SEÇENEKLER --------------------------- */

const MALZEMELER = {
  PLA: { ad: "PLA", not: "Mat, doğal doku. Yalnızca LED ampulle kullanın." },
  PETG: { ad: "PETG", not: "Isıya daha dayanıklı, ışığı biraz daha geçirir." },
  "PLA Silk": { ad: "PLA Silk", not: "Saten parlaklık, ışığı yansıtır." },
};

const RENKLER = [
  { ad: "Kemik Beyazı", hex: "#EDE4D3", gecirgen: 0.92 },
  { ad: "Kum Beji", hex: "#D9C3A0", gecirgen: 0.86 },
  { ad: "Adaçayı", hex: "#8E9C87", gecirgen: 0.62 },
  { ad: "Terrakota", hex: "#B4593A", gecirgen: 0.56 },
  { ad: "Duman Grisi", hex: "#8A8681", gecirgen: 0.5 },
  { ad: "Kömür", hex: "#26241F", gecirgen: 0.16 },
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

const DUYLAR = {
  E27: { ...DUY_MONTAJ.E27, ad: "E27", ampulR: 30, setTL: 180, aciklama: "Standart büyük duy" },
  E14: { ...DUY_MONTAJ.E14, ad: "E14", ampulR: 20, setTL: 150, aciklama: "İnce duy" },
};

const PAKETLER = {
  set: { ad: "Duylu set", aciklama: "Abajur + duy + 1,5 m kablo + tavan askısı", onerilen: true },
  baslik: { ad: "Yalnızca başlık", aciklama: "Sadece basılmış abajur gövdesi" },
};

/* Hazır tasarımlar — müşterinin ilk 10 saniyede güzel bir sonuç görmesi
   için. Yalnızca formu belirler; renk, malzeme ve ampul seçimi korunur. */
const SABLONLAR = [
  {
    id: "nordik", ad: "Nordik", not: "Yumuşak dikey çizgiler",
    form: { profil: "duz", desen: "nervur", nervurSayisi: 24, derinlik: 2.5, burgu: 0, altCap: 190, ustCap: 190, yukseklik: 250, bel: 0 },
  },
  {
    id: "fener", ad: "Fener", not: "Şişkin gövde, sıcak duruş",
    form: { profil: "fici", desen: "nervur", nervurSayisi: 18, derinlik: 4, burgu: 0, altCap: 170, ustCap: 150, yukseklik: 230, bel: 22 },
  },
  {
    id: "origami", ad: "Origami", not: "Keskin kırıklı yüzeyler",
    form: { profil: "duz", desen: "faset", nervurSayisi: 12, derinlik: 3, burgu: 0, altCap: 190, ustCap: 170, yukseklik: 240, bel: 0 },
  },
  {
    id: "sarmal", ad: "Sarmal", not: "Dönen nervürler",
    form: { profil: "duz", desen: "nervur", nervurSayisi: 28, derinlik: 3, burgu: 200, altCap: 180, ustCap: 180, yukseklik: 254, bel: 0 },
  },
  {
    id: "kumsaati", ad: "Kum Saati", not: "İnce belli zarif form",
    form: { profil: "kumsaati", desen: "duz", nervurSayisi: 20, derinlik: 2, burgu: 0, altCap: 200, ustCap: 200, yukseklik: 250, bel: 26 },
  },
  {
    id: "dalga", ad: "Dalga", not: "Yatay dalgalı doku",
    form: { profil: "duz", desen: "dalga", nervurSayisi: 20, derinlik: 4.5, burgu: 0, dalgaSayisi: 5, altCap: 190, ustCap: 190, yukseklik: 240, bel: 0 },
  },
];

const BOYUTLAR = [
  { id: "s", ad: "Küçük", not: "Ø150 × 190 mm", olcu: { altCap: 150, ustCap: 150, yukseklik: 190 } },
  { id: "m", ad: "Orta", not: "Ø190 × 240 mm", olcu: { altCap: 190, ustCap: 190, yukseklik: 240 } },
  { id: "l", ad: "Büyük", not: "Ø220 × 254 mm", olcu: { altCap: 220, ustCap: 220, yukseklik: 254 } },
];

const AMPUL_TONLARI = [
  { k: 2200, ad: "Mum" },
  { k: 2700, ad: "Sıcak" },
  { k: 3500, ad: "Doğal" },
  { k: 4500, ad: "Gün ışığı" },
];

const VARSAYILAN = {
  paket: "set",
  duyTipi: "E27",
  profil: "duz",
  altCap: 190,
  ustCap: 190,
  yukseklik: 250,
  bel: 18,
  desen: "nervur",
  nervurSayisi: 24,
  derinlik: 2.5,
  burgu: 0,
  dalgaSayisi: 6,
  cidar: 1.26,
  malzeme: "PLA",
  renk: "Kemik Beyazı",
  montaj: "boyun",
  bogazCap: 41,
  boyunH: 12,
  kolSayisi: 4,
  kolKalinlik: 4.2,
  kelvin: 2700,
  adet: 1,
};

function sabitDuyConfig(config) {
  const duyTipi = DUYLAR[config.duyTipi] ? config.duyTipi : "E27";
  const duy = DUYLAR[duyTipi];
  return {
    ...config,
    duyTipi,
    montaj: "boyun",
    bogazCap: duy.bogaz,
    boyunH: duy.boyunH,
    kolSayisi: duy.ayakSayisi,
    kolKalinlik: duy.ayakEt,
    cidar: cidarKirp(Number(config.cidar) || VARSAYILAN.cidar),
    ustCap: Math.max(Number(config.ustCap) || duy.minUstCap, duy.minUstCap),
  };
}

/* ------------------------- FİYAT TARİFESİ ------------------------- */

const FIYAT = {
  filament: { PLA: 780, PETG: 975, "PLA Silk": 1014 },
  fire: 8,
  makineSaat: 45,
  elIsciligi: 60,
  boyunMontaj: 45,
  duy: { E27: 180, E14: 150 },
  kar: 55,
  duyMarj: 35,
  kdv: 20,
};

/* ------------------------ GÖSTERİM: IŞIK -------------------------- */

/**
 * Duvardan geçen ışığı verteks başına hesaplar (yalnızca önizleme için).
 *
 * Gerçek abajurda parlaklık her yerde eşit değildir: ampule dik bakan
 * yüzeyler parlar, eğik yüzeylerde ışık daha kalın bir duvar kesitinden
 * geçmek zorunda kaldığı için söner. Burada Lambert kosinüsü + ters kare
 * yasası + Beer-Lambert sönümlemesi birlikte kullanılıyor; nervür
 * tepeleri kendiliğinden aydınlanıp yan yüzleri kararıyor.
 */
function isikHaritasiEkle(geo, p, gecirgen) {
  const pos = geo.attributes.position.array;
  const nor = geo.attributes.normal.array;
  const { N, R, OUT, IN } = geo.userData.bolum;
  const sayi = pos.length / 3;
  const isik = new Float32Array(sayi);

  const duy = DUYLAR[p.duyTipi] || DUYLAR.E27;
  const by = Math.max(p.yukseklik * 0.32, p.yukseklik - duy.boyunH - 45);
  const ref = Math.pow(p.altCap / 2, 2);
  // sönümleme boyu — kalın duvar ve koyu renk ışığı daha çok yutar
  const lambda = 0.55 + 1.35 * gecirgen;

  for (let r = 0; r <= R; r++) {
    for (let c = 0; c < N; c++) {
      const vi = OUT + r * N + c;
      const k = vi * 3;
      const dx = pos[k] - 0;
      const dy = pos[k + 1] - by;
      const dz = pos[k + 2] - 0;
      const d = Math.hypot(dx, dy, dz) || 1;
      const cos = Math.max(0, (nor[k] * dx + nor[k + 1] * dy + nor[k + 2] * dz) / d);
      // eğik geliş -> duvar içinde daha uzun yol
      const yol = p.cidar / Math.max(cos, 0.18);
      const gecis = Math.exp(-yol / lambda);
      isik[vi] = Math.min(2.2, ((cos / (d * d)) * ref * gecis) / 0.42);
      isik[IN + r * N + c] = 0.1; // iç yüzey doğrudan aydınlanıyor
    }
  }
  geo.setAttribute("aIsik", new THREE.BufferAttribute(isik, 1));
  return geo;
}

/* ------------------------ RENK / YARDIMCI ------------------------- */

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
    if (ham && ham.d && ham.k) return damga(JSON.stringify(ham.d)) === ham.k ? ham.d : null;
    return null;
  } catch {
    return null;
  }
};

const tl = (n) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Math.round(n));

function useGenisEkran() {
  const [genis, setGenis] = useState(
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const f = (e) => setGenis(e.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return genis;
}

/* ------------------------ UI PARÇALARI ---------------------------- */

function Etiket({ children, sag, ipucu }) {
  return (
    <div className="akEtiket">
      <span>
        {children}
        {ipucu && <em title={ipucu}>?</em>}
      </span>
      {sag != null && <b>{sag}</b>}
    </div>
  );
}

function Kaydirac({ etiket, birim, deger, min, max, adim = 1, onChange, accent, ipucu }) {
  const ilerleme = max > min ? ((deger - min) / (max - min)) * 100 : 0;
  return (
    <div className="akAlan">
      <Etiket sag={`${deger}${birim || ""}`} ipucu={ipucu}>{etiket}</Etiket>
      <input
        type="range"
        min={min}
        max={max}
        step={adim}
        value={deger}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="abajurRange"
        style={{ "--range-accent": accent, "--range-progress": `${Math.max(0, Math.min(100, ilerleme))}%` }}
        aria-label={etiket}
      />
    </div>
  );
}

function Secim({ etiket, secenekler, deger, onChange, accent, ipucu }) {
  return (
    <div className="akAlan">
      {etiket && <Etiket ipucu={ipucu}>{etiket}</Etiket>}
      <div className="akChips">
        {secenekler.map((s) => {
          const aktif = s.id === deger;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={aktif ? "akChip aktif" : "akChip"}
              style={aktif ? { background: accent, borderColor: accent } : undefined}
              aria-pressed={aktif}
            >
              {s.ad}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Bolum({ no, baslik, children, aciklama }) {
  return (
    <section className="akBolum">
      <div className="akBolumBas">
        <span>{no}</span>
        <h3>{baslik}</h3>
      </div>
      {aciklama && <p className="akBolumNot">{aciklama}</p>}
      {children}
    </section>
  );
}

/* ------------------------- ANA BİLEŞEN ---------------------------- */

export default function AbajurKonfigurator({
  onAddToCart,
  baseUrl = "",
  fiyat: fiyatProp,
  fiyatUrl = null,
  stlIndirme = "kapali",
  onStlIstegi,
  filigran = null,
  yoneticiPaneli = false,
  onBildirim,
}) {
  const [p, setP] = useState(() => {
    if (typeof window !== "undefined" && window.location.hash.startsWith("#d=")) {
      const d = b64dec(window.location.hash.slice(3));
      if (d && d.yukseklik) return sabitDuyConfig({ ...VARSAYILAN, ...d });
    }
    return sabitDuyConfig(VARSAYILAN);
  });
  const [isik, setIsik] = useState(true);
  const [otoDon, setOtoDon] = useState(true);
  const [ortam, setOrtam] = useState(true);
  const [detay, setDetay] = useState(false);
  const [sepetteBekle, setSepetteBekle] = useState(false);
  const [bildirim, setBildirim] = useState("");
  const [sablon, setSablon] = useState("");
  const [fiyatAyar, setFiyatAyar] = useState(() => ({
    ...FIYAT,
    ...(fiyatProp || {}),
    filament: { ...FIYAT.filament, ...(fiyatProp?.filament || {}) },
    duy: { ...FIYAT.duy, ...(fiyatProp?.duy || {}) },
  }));
  const genis = useGenisEkran();

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
      .catch(() => {});
    return () => { iptal = true; };
  }, [fiyatUrl]);

  const set = useCallback((k, v) => {
    setP((o) => ({ ...o, [k]: v }));
    setSablon("");
  }, []);

  const accent = useMemo(() => kelvinRGB(p.kelvin), [p.kelvin]);
  const renk = useMemo(() => RENKLER.find((r) => r.ad === p.renk) || RENKLER[0], [p.renk]);
  const duy = DUYLAR[p.duyTipi] || DUYLAR.E27;

  const duyDegistir = useCallback((v) => {
    const d = DUYLAR[v];
    setP((o) => sabitDuyConfig({ ...o, duyTipi: v, ustCap: Math.max(o.ustCap, d.minUstCap) }));
  }, []);

  const sablonUygula = useCallback((s) => {
    setP((o) => sabitDuyConfig({ ...o, ...s.form }));
    setSablon(s.id);
  }, []);

  const boyutUygula = useCallback((b) => {
    setP((o) => sabitDuyConfig({ ...o, ...b.olcu }));
  }, []);

  const aktifBoyut = useMemo(() => {
    const b = BOYUTLAR.find(
      (x) => Math.abs(x.olcu.altCap - p.altCap) < 6 && Math.abs(x.olcu.yukseklik - p.yukseklik) < 8
    );
    return b?.id || "";
  }, [p.altCap, p.yukseklik]);

  /* ---------- geometri ---------- */
  const { geo, montajGeo, hacim, enBuyukCap } = useMemo(() => {
    const g = isikHaritasiEkle(abajurGeometrisi(p, KALITE.onizleme), p, renk.gecirgen);
    const parcalar = montajParcalari(p, KALITE.onizleme);
    const mg = toCreasedNormals(birlestir(parcalar), Math.PI / 3);
    const hacimMm3 = hacimHesapla(g) + parcalar.reduce((s, x) => s + hacimHesapla(x), 0);
    return {
      geo: g,
      montajGeo: mg,
      hacim: hacimMm3 / 1000,
      enBuyukCap: enBuyukYaricap(p) * 2,
    };
  }, [p, renk.gecirgen]);

  const yon = useMemo(() => baskiYonu(p), [p]);

  /* Kaydıraç sınırları tabladan türetilir; desen derinliği ve fıçı beli dış
     çapı büyüttüğü için o pay peşinen düşülür — müşteri "sığmıyor" hatasını
     hiç görmez, o değeri seçemez. */
  const sinir = useMemo(() => {
    const desenPay = p.desen === "duz" || p.desen === "faset" ? 0 : p.derinlik;
    const belPay = p.profil === "fici" ? p.bel : 0;
    const capTavan = Math.max(80, Math.floor(TABLA_CAP - PAY.cap - 2 * (desenPay + belPay)));
    const enBuyukCapAyari = Math.max(p.altCap, p.ustCap);
    return {
      capMax: capTavan,
      yukseklikMax: TABLA.z - PAY.yukseklik,
      derinlikMax: Math.max(0.5, Math.min(12, (TABLA_CAP - PAY.cap - enBuyukCapAyari) / 2 - belPay)),
      belMax: Math.max(0, Math.min(60, (TABLA_CAP - PAY.cap - enBuyukCapAyari) / 2 - desenPay)),
    };
  }, [p.desen, p.derinlik, p.profil, p.bel, p.altCap, p.ustCap]);

  useEffect(() => {
    setP((o) => {
      const y = {
        altCap: Math.min(o.altCap, sinir.capMax),
        ustCap: Math.min(o.ustCap, sinir.capMax),
        yukseklik: Math.min(o.yukseklik, sinir.yukseklikMax),
        derinlik: Math.min(o.derinlik, sinir.derinlikMax),
        bel: Math.min(o.bel, sinir.belMax),
      };
      return Object.keys(y).some((k) => y[k] !== o[k]) ? { ...o, ...y } : o;
    });
  }, [sinir]);

  const mal = MALZEMELER[p.malzeme];
  const gram = hacim * (YOGUNLUK[p.malzeme] || 1.24);
  const sureSaat = useMemo(() => (hacim * 1000) / 4.0 / 3600, [hacim]);

  /* Fiyat, önizleme geometrisinden DEĞİL, sunucunun kullandığı kalite
     profilinden hesaplanır. Aksi halde iki taraf birkaç lira ayrışıyor ve
     müşteri stüdyoda gördüğü tutardan farklı bir tutarla sepete ekliyor. */
  const fiyatDetay = useMemo(() => {
    const t = fiyatAyar;
    const { gram: fiyatGram, hacimCm3 } = olcum(p, KALITE.fiyat);
    const kgFiyat = t.filament[p.malzeme] ?? t.filament.PLA;
    const malzemeTL = (fiyatGram / 1000) * kgFiyat * (1 + t.fire / 100);
    const makineTL = ((hacimCm3 * 1000) / 4 / 3600) * t.makineSaat;
    const iscilikTL = t.elIsciligi;
    const boyunTL = t.boyunMontaj;
    const uretimMaliyeti = malzemeTL + makineTL + iscilikTL + boyunTL;
    const karTL = uretimMaliyeti * (t.kar / 100);
    const duyAlis = p.paket === "set" ? (t.duy[p.duyTipi] ?? 0) : 0;
    const duyTL = duyAlis * (1 + t.duyMarj / 100);
    const kdvsiz = uretimMaliyeti + karTL + duyTL;
    // sunucudaki quoteAbajur ile birebir aynı yuvarlama
    const birim = Math.round(kdvsiz * (1 + t.kdv / 100));
    return { malzemeTL, makineTL, duyTL, birim, toplam: birim * p.adet };
  }, [p, fiyatAyar]);

  /* ---------- doğrulama ---------- */
  const uyarilar = useMemo(() => {
    const u = [];
    if (p.ustCap < duy.minUstCap)
      u.push({ tip: "hata", m: `${p.duyTipi} duy bağlantısı için üst çap en az ${duy.minUstCap} mm olmalı.` });
    if (p.yukseklik > TABLA.z - PAY.yukseklik)
      u.push({ tip: "hata", m: `Yükseklik yazıcıya sığmıyor (en fazla ${TABLA.z - PAY.yukseklik} mm).` });
    if (enBuyukCap > TABLA_CAP - PAY.cap)
      u.push({ tip: "hata", m: `Çap yazıcıya sığmıyor (en fazla ${TABLA_CAP - PAY.cap} mm).` });
    if (yon.aci > 50)
      u.push({ tip: "uyari", m: `Form oldukça yayvan; alt kenarda destek izi kalabilir.` });
    if (p.desen !== "duz" && p.derinlik > p.altCap / 8)
      u.push({ tip: "uyari", m: "Desen derinliği gövdeye göre fazla, hatlar sertleşebilir." });
    if (Math.abs(p.burgu) > 0 && p.desen === "faset")
      u.push({ tip: "uyari", m: "Faset ile burgu bir arada yüzeyi bozabilir." });
    if (p.malzeme === "PLA")
      u.push({ tip: "bilgi", m: "PLA gövde yalnızca LED ampulle kullanılmalıdır." });
    if (renk.gecirgen < 0.3)
      u.push({ tip: "bilgi", m: "Koyu renk ışığı az geçirir; aydınlatma yerine atmosfer verir." });
    return u;
  }, [p, enBuyukCap, yon, duy, renk]);

  const hataVar = uyarilar.some((u) => u.tip === "hata");

  /* ---------- three.js sahnesi ---------- */
  const kap = useRef(null);
  const ref = useRef({});

  useEffect(() => {
    const el = kap.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0b0a);
    scene.fog = new THREE.FogExp2(0x0d0b0a, 0.00035);

    const camera = new THREE.PerspectiveCamera(34, 1, 1, 12000);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
      });
    } catch {
      el.innerHTML = '<div class="akSahneHata">Tarayıcınız 3D önizlemeyi desteklemiyor.</div>';
      return;
    }

    const dokunmatik = window.matchMedia?.("(pointer: coarse)").matches;
    const cihazPikselOrani = window.devicePixelRatio || 1;
    renderer.setPixelRatio(dokunmatik ? Math.min(2, cihazPikselOrani) : Math.min(2.25, cihazPikselOrani));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.0;
    el.appendChild(renderer.domElement);
    const dom = renderer.domElement;
    dom.style.display = "block";
    dom.style.width = "100%";
    dom.style.height = "100%";
    dom.style.touchAction = "none";
    dom.draggable = false;
    const onMenu = (e) => e.preventDefault();
    dom.addEventListener("contextmenu", onMenu);

    /* --- post-process: bloom sıcak ampul parıltısını verir --- */
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.75, 0.72);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    /* --- oda --- */
    const ZEMIN_Y = -760;
    const TAVAN_Y = 1500;

    const odaMat = new THREE.MeshStandardMaterial({
      color: 0x1e1a17,
      roughness: 0.96,
      metalness: 0,
      side: THREE.BackSide,
    });
    const oda = new THREE.Mesh(new THREE.BoxGeometry(5200, TAVAN_Y - ZEMIN_Y + 400, 5200), odaMat);
    oda.position.set(0, (TAVAN_Y + ZEMIN_Y) / 2, 0);
    oda.receiveShadow = true;
    scene.add(oda);

    const zemin = new THREE.Mesh(
      new THREE.CircleGeometry(2200, 96),
      new THREE.MeshStandardMaterial({ color: 0x2b241d, roughness: 0.78, metalness: 0.02 })
    );
    zemin.rotation.x = -Math.PI / 2;
    zemin.position.y = ZEMIN_Y + 1;
    zemin.receiveShadow = true;
    scene.add(zemin);

    /* --- ortam haritası (yansımalar olmadan plastik cansız görünür) --- */
    try {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 128;
      const g2 = c.getContext("2d");
      const grd = g2.createLinearGradient(0, 0, 0, 128);
      grd.addColorStop(0, "#414a56");
      grd.addColorStop(0.45, "#2b2723");
      grd.addColorStop(1, "#141110");
      g2.fillStyle = grd;
      g2.fillRect(0, 0, 256, 128);
      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      pmrem.dispose();
    } catch { /* ortam haritası olmadan da çalışır */ }

    const ortamIsik = new THREE.AmbientLight(0xffffff, 0.05);
    scene.add(ortamIsik);
    const hemi = new THREE.HemisphereLight(0x91a8c4, 0x1b1512, 0.16);
    scene.add(hemi);
    const anahtar = new THREE.DirectionalLight(0xffffff, 0.3);
    anahtar.position.set(-420, 620, 480);
    scene.add(anahtar);

    /* --- ampul ---
       Sahne mm ölçeğinde ve ampul ile gövde arasında ~95 mm, ampul ile
       zemin arasında ~900 mm var. Fiziksel 1/d² ile bu iki mesafe aynı
       pozlamada tutulamıyor: iç yüzeyi doğru yakan şiddet zemini tamamen
       karartıyor, zemini aydınlatan şiddet iç yüzeyi patlatıyor. Bu yüzden
       sönümleme üssü 1 alınıyor (görsel amaçlı bilinçli sapma); ışığın
       gövdedeki asıl dağılımını zaten verteks başına hesaplanan
       Beer-Lambert geçirgenliği belirliyor. */
    const ampulIsik = new THREE.PointLight(0xffffff, 320, 0, 1);
    ampulIsik.castShadow = true;
    ampulIsik.shadow.mapSize.set(1024, 1024);
    ampulIsik.shadow.bias = -0.0035;
    ampulIsik.shadow.camera.near = 4;
    ampulIsik.shadow.camera.far = 4000;
    scene.add(ampulIsik);

    const dolgu = new THREE.PointLight(0xffffff, 95, 0, 1);
    scene.add(dolgu);

    const ampulGrup = new THREE.Group();
    const ampulMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 3.4,
      roughness: 0.3,
    });
    const ampulCam = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), ampulMat);
    ampulCam.scale.set(1, 1.12, 1);
    ampulGrup.add(ampulCam);
    const ampulDuy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.7, 1.1, 20),
      new THREE.MeshStandardMaterial({ color: 0xb9b2a6, roughness: 0.45, metalness: 0.8 })
    );
    ampulGrup.add(ampulDuy);
    scene.add(ampulGrup);

    /* --- kablo ve tavan rozeti --- */
    const kabloMat = new THREE.MeshStandardMaterial({ color: 0x171412, roughness: 0.72 });
    const kablo = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1, 12), kabloMat);
    scene.add(kablo);
    const tavanRozet = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 10, 32), kabloMat);
    tavanRozet.position.y = TAVAN_Y - 6;
    scene.add(tavanRozet);

    /* --- gövde --- */
    const govdeMat = new THREE.MeshStandardMaterial({
      color: 0xede4d3,
      roughness: 0.68,
      metalness: 0.0,
      side: THREE.DoubleSide,
      envMapIntensity: 0.45,
    });
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
      roughness: 0.55,
      metalness: 0.04,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide,
    });
    const montajMesh = new THREE.Mesh(new THREE.BufferGeometry(), montajMat);
    montajMesh.castShadow = true;
    montajMesh.receiveShadow = true;
    scene.add(montajMesh);

    /* --- kamera kontrolü --- */
    const kam = { theta: 0.62, phi: 1.36, dist: 900, hedef: 130 };
    let surukle = null;
    let pinch = null;

    const yerlestir = () => {
      const x = kam.dist * Math.sin(kam.phi) * Math.sin(kam.theta);
      const y = kam.dist * Math.cos(kam.phi) + kam.hedef;
      const z = kam.dist * Math.sin(kam.phi) * Math.cos(kam.theta);
      camera.position.set(x, y, z);
      camera.lookAt(0, kam.hedef, 0);
    };

    const cerceve = () => {
      const { H, R } = ref.current.olcek || { H: 250, R: 100 };
      const yariFov = (camera.fov * Math.PI) / 180 / 2;
      const dikey = (H * 1.15) / 2 / Math.tan(yariFov);
      const yatay = R / (Math.tan(yariFov) * Math.max(0.35, camera.aspect));
      kam.hedef = H * 0.46;
      kam.dist = Math.min(2200, Math.max(240, Math.max(dikey, yatay) * 1.32 + R));
      yerlestir();
    };

    const onDown = (e) => {
      dom.setPointerCapture?.(e.pointerId);
      surukle = { x: e.clientX, y: e.clientY };
      ref.current.durdur?.();
    };
    const onMove = (e) => {
      if (!surukle) return;
      kam.theta -= (e.clientX - surukle.x) * 0.008;
      kam.phi = Math.min(Math.PI - 0.22, Math.max(0.22, kam.phi - (e.clientY - surukle.y) * 0.006));
      surukle = { x: e.clientX, y: e.clientY };
      yerlestir();
    };
    const onUp = () => { surukle = null; };
    const onWheel = (e) => {
      e.preventDefault();
      kam.dist = Math.min(2200, Math.max(240, kam.dist * (1 + Math.sign(e.deltaY) * 0.09)));
      yerlestir();
    };
    const onTouch = (e) => {
      if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (pinch) {
          kam.dist = Math.min(2200, Math.max(240, kam.dist * (pinch / d)));
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
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloom.resolution.set(w, h);
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
        kam.theta += 0.0021;
        yerlestir();
      }
      composer.render();
    };
    yerlestir();
    dongu();

    ref.current = {
      ...ref.current, scene, camera, renderer, composer, bloom, govde, govdeMat,
      montajMesh, montajMat, ampulIsik, dolgu, ampulGrup, ampulCam, ampulMat, ampulDuy,
      kablo, tavanRozet, zemin, oda, ortamIsik, hemi, anahtar, kam, yerlestir, cerceve,
      TAVAN_Y, ZEMIN_Y,
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
      dom.removeEventListener("contextmenu", onMenu);
      composer.dispose();
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
    s.montajMesh.geometry = montajGeo;

    const duyBilgi = DUYLAR[p.duyTipi] || DUYLAR.E27;
    const ampulY = Math.max(p.yukseklik * 0.32, p.yukseklik - duyBilgi.boyunH - 45);
    s.ampulIsik.position.set(0, ampulY, 0);
    s.dolgu.position.set(0, p.yukseklik * 0.26, 0);
    s.ampulGrup.position.set(0, ampulY, 0);
    s.ampulCam.scale.set(duyBilgi.ampulR, duyBilgi.ampulR * 1.12, duyBilgi.ampulR);
    s.ampulDuy.scale.setScalar(duyBilgi.ampulR);
    s.ampulDuy.position.y = duyBilgi.ampulR * 1.35;

    // kablo: boyun üstünden tavana
    const kabloAlt = p.yukseklik;
    const kabloBoy = s.TAVAN_Y - kabloAlt;
    s.kablo.scale.set(1, kabloBoy, 1);
    s.kablo.position.set(0, kabloAlt + kabloBoy / 2, 0);

    const k = new THREE.Color(accent);
    s.ampulIsik.color = k;
    s.dolgu.color = k;
    s.ampulMat.color = k;
    s.ampulMat.emissive = k;

    s.olcek = { H: p.yukseklik, R: enBuyukCap / 2 };
    s.cerceve();
  }, [geo, montajGeo, p.yukseklik, p.desen, p.duyTipi, accent, enBuyukCap]);

  // renk / ışık durumu
  useEffect(() => {
    const s = ref.current;
    if (!s.govdeMat) return;
    s.govdeMat.color = new THREE.Color(renk.hex);
    if (s.montajMat) s.montajMat.color = new THREE.Color(renk.hex);
    const k = new THREE.Color(accent);
    if (isik) {
      s.govdeMat.emissive = k.clone().multiply(new THREE.Color(renk.hex));
      s.govdeMat.emissiveIntensity = 1.25 * renk.gecirgen;
      s.ampulIsik.intensity = 320;
      s.dolgu.intensity = 95;
      s.ampulGrup.visible = true;
      s.ortamIsik.intensity = 0.045;
      s.anahtar.intensity = 0.2;
      s.hemi.intensity = 0.1;
      s.bloom.strength = 0.62;
      s.renderer.toneMappingExposure = 1.0;
    } else {
      s.govdeMat.emissive = new THREE.Color(0x000000);
      s.govdeMat.emissiveIntensity = 0;
      s.ampulIsik.intensity = 0;
      s.dolgu.intensity = 0;
      s.ampulGrup.visible = false;
      s.ortamIsik.intensity = 0.3;
      s.anahtar.intensity = 1.15;
      s.hemi.intensity = 0.55;
      s.bloom.strength = 0.12;
      s.renderer.toneMappingExposure = 1.35;
    }
    s.govdeMat.needsUpdate = true;
  }, [isik, renk, accent]);

  // ortam görünürlüğü
  useEffect(() => {
    const s = ref.current;
    if (!s.zemin) return;
    s.zemin.visible = ortam;
    s.kablo.visible = ortam;
    s.tavanRozet.visible = ortam;
    s.oda.visible = ortam;
  }, [ortam]);

  useEffect(() => {
    ref.current.otoDon = otoDon;
    ref.current.durdur = () => setOtoDon(false);
  }, [otoDon]);

  /* ---------- aksiyonlar ---------- */
  const bildir = useCallback((m) => {
    if (onBildirim) onBildirim(m);
    setBildirim(m);
    setTimeout(() => setBildirim(""), 2600);
  }, [onBildirim]);

  const dosyaAdi = `abajur_${p.profil}_${p.altCap}x${p.yukseklik}_${p.desen}_${p.duyTipi}`;

  const paket = () => ({
    surum: 4,
    geoSurum: GEO_SURUM,
    config: sabitDuyConfig(p),
    ozet: {
      gram: +gram.toFixed(1),
      hacimCm3: +hacim.toFixed(1),
      sureSaat: +sureSaat.toFixed(2),
      enBuyukCapMm: Math.round(enBuyukCap),
      duvarSayisi: duvarSayisi(p.cidar),
      baskiYonu: yon.ters ? "ters" : "duz",
      sarkmaAcisi: +yon.aci.toFixed(1),
    },
    fiyatGosterim: {
      birim: Math.round(fiyatDetay.birim),
      toplam: Math.round(fiyatDetay.toplam),
      paraBirimi: "TRY",
    },
    stlAdi: `${dosyaAdi}.stl`,
    link: `${baseUrl}#d=${b64enc(p)}`,
  });

  const linkKopyala = async () => {
    const link = `${baseUrl}#d=${b64enc(p)}`;
    try {
      await navigator.clipboard.writeText(link);
      bildir("Tasarım linki kopyalandı.");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      bildir("Tasarım linki kopyalandı.");
    }
  };

  const sepete = async () => {
    if (hataVar || sepetteBekle) return;
    setSepetteBekle(true);
    try {
      const payload = paket();
      if (onAddToCart) await onAddToCart(payload);
      bildir(`${p.adet} adet sepete eklendi.`);
    } catch (error) {
      bildir(error?.message || "Sepete eklenemedi.");
    } finally {
      setSepetteBekle(false);
    }
  };

  const sifirla = () => {
    setP(sabitDuyConfig(VARSAYILAN));
    setSablon("");
    bildir("Tasarım sıfırlandı.");
  };

  /* ---------- render ---------- */
  return (
    <div className={genis ? "akKok genis" : "akKok"}>
      {/* SAHNE */}
      <div className="akSahne">
        <div ref={kap} className="akTuval" />

        <div className="akSahneUst">
          <div className="akEyebrow">CANLI 3D ÖNİZLEME</div>
          <div className="akSahneBaslik">
            Işığın biçimini <span style={{ color: accent }}>sen kur</span>
          </div>
        </div>

        {filigran && <div className="akFiligran">{filigran}</div>}

        <div className="akSahneAlt">
          <div className="akSahneDugmeler">
            <button
              type="button"
              onClick={() => setIsik((v) => !v)}
              className={isik ? "akMiniBtn aktif" : "akMiniBtn"}
              style={isik ? { background: accent, borderColor: accent } : undefined}
            >
              {isik ? "Işık açık" : "Işık kapalı"}
            </button>
            <button type="button" onClick={() => setOtoDon((v) => !v)} className="akMiniBtn">
              {otoDon ? "Dönüşü durdur" : "Döndür"}
            </button>
            <button type="button" onClick={() => setOrtam((v) => !v)} className="akMiniBtn">
              {ortam ? "Stüdyo" : "Oda"}
            </button>
          </div>
          <div className="akSahneOlcu">
            <div>Ø{Math.round(enBuyukCap)} × {p.yukseklik} mm</div>
            <div>{gram.toFixed(0)} g · ~{sureSaat.toFixed(1)} sa baskı</div>
          </div>
        </div>

        {bildirim && <div className="akBildirim" style={{ background: accent }} role="status">{bildirim}</div>}
      </div>

      {/* KONTROL RAYI */}
      <div className="akRay">
        <Bolum no="01" baslik="Hazır tasarımlar" aciklama="Bir tanesine dokun, üzerinde istediğin gibi oyna.">
          <div className="akSablonlar">
            {SABLONLAR.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => sablonUygula(s)}
                className={sablon === s.id ? "akSablon aktif" : "akSablon"}
                style={sablon === s.id ? { borderColor: accent } : undefined}
              >
                <b style={sablon === s.id ? { color: accent } : undefined}>{s.ad}</b>
                <span>{s.not}</span>
              </button>
            ))}
          </div>
        </Bolum>

        <Bolum no="02" baslik="Boyut">
          <div className="akBoyutlar">
            {BOYUTLAR.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => boyutUygula(b)}
                className={aktifBoyut === b.id ? "akBoyut aktif" : "akBoyut"}
                style={aktifBoyut === b.id ? { borderColor: accent, color: accent } : undefined}
              >
                <b>{b.ad}</b>
                <span>{b.not}</span>
              </button>
            ))}
          </div>
          {!aktifBoyut && (
            <p className="akNot">Özel ölçü: Ø{Math.max(p.altCap, p.ustCap)} × {p.yukseklik} mm</p>
          )}
        </Bolum>

        <Bolum no="03" baslik="Renk ve malzeme">
          <div className="akAlan">
            <Etiket sag={p.renk}>Renk</Etiket>
            <div className="akRenkler">
              {RENKLER.map((r) => (
                <button
                  key={r.ad}
                  type="button"
                  onClick={() => set("renk", r.ad)}
                  title={r.ad}
                  aria-label={r.ad}
                  aria-pressed={p.renk === r.ad}
                  className="akRenk"
                  style={{
                    background: r.hex,
                    outline: p.renk === r.ad ? `2px solid ${accent}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
          <Secim
            etiket="Filament"
            secenekler={Object.keys(MALZEMELER).map((k) => ({ id: k, ad: k }))}
            deger={p.malzeme}
            onChange={(v) => set("malzeme", v)}
            accent={accent}
          />
          <p className="akNot">{mal.not}</p>

          <div className="akAlan">
            <Etiket
              sag={`${p.kelvin} K`}
              ipucu="Ampulün ışık rengi. Düşük değer sıcak sarı, yüksek değer beyaz ışıktır."
            >
              Ampul ışığı
            </Etiket>
            <div className="akChips">
              {AMPUL_TONLARI.map((t) => (
                <button
                  key={t.k}
                  type="button"
                  onClick={() => set("kelvin", t.k)}
                  className={p.kelvin === t.k ? "akChip aktif" : "akChip"}
                  style={p.kelvin === t.k ? { background: accent, borderColor: accent } : undefined}
                >
                  {t.ad}
                </button>
              ))}
            </div>
          </div>
        </Bolum>

        <Bolum no="04" baslik="Paket">
          <div className="akPaketler">
            {Object.entries(PAKETLER).map(([id, pk]) => {
              const aktif = p.paket === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("paket", id)}
                  className={aktif ? "akPaket aktif" : "akPaket"}
                  style={aktif ? { borderColor: accent } : undefined}
                >
                  <div className="akPaketBas">
                    <span style={aktif ? { color: accent } : undefined}>
                      {pk.ad}
                      {pk.onerilen && <i>önerilen</i>}
                    </span>
                    {id === "set" && <b>+{tl(fiyatDetay.duyTL)} ₺</b>}
                  </div>
                  <small>{pk.aciklama}</small>
                </button>
              );
            })}
          </div>
          <Secim
            etiket="Duy standardı"
            secenekler={Object.keys(DUYLAR).map((k) => ({ id: k, ad: `${k} · ${DUYLAR[k].aciklama}` }))}
            deger={p.duyTipi}
            onChange={duyDegistir}
            accent={accent}
            ipucu="E27 evlerde en yaygın duy tipidir. E14 daha ince, küçük abajurlarda kullanılır."
          />
          <p className="akNot">
            Duy bağlantısı {p.duyTipi} standardına göre otomatik kurulur (geçme Ø{duy.gecmeCap} mm,
            {" "}{duy.ayakSayisi} taşıyıcı) ve üretim güvenliği için değiştirilemez.
          </p>
        </Bolum>

        {/* DETAYLI AYARLAR */}
        <div className="akDetayAc">
          <button type="button" onClick={() => setDetay((v) => !v)} aria-expanded={detay}>
            {detay ? "− Detaylı ayarları gizle" : "+ Detaylı ayarlar (form, desen, duvar)"}
          </button>
        </div>

        {detay && (
          <>
            <Bolum no="05" baslik="Gövde formu">
              <Secim etiket="Profil" secenekler={PROFILLER} deger={p.profil} onChange={(v) => set("profil", v)} accent={accent} />
              <Kaydirac etiket="Yükseklik" birim=" mm" deger={p.yukseklik} min={80} max={sinir.yukseklikMax} onChange={(v) => set("yukseklik", v)} accent={accent} />
              <Kaydirac etiket="Alt çap" birim=" mm" deger={p.altCap} min={80} max={sinir.capMax} onChange={(v) => set("altCap", v)} accent={accent} />
              <Kaydirac etiket="Üst çap" birim=" mm" deger={p.ustCap} min={duy.minUstCap} max={sinir.capMax} onChange={(v) => set("ustCap", v)} accent={accent} />
              {(p.profil === "fici" || p.profil === "kumsaati") && (
                <Kaydirac etiket="Bel miktarı" birim=" mm" deger={p.bel} min={0} max={sinir.belMax} onChange={(v) => set("bel", v)} accent={accent} />
              )}
            </Bolum>

            <Bolum no="06" baslik="Yüzey deseni">
              <Secim etiket="Desen" secenekler={DESENLER} deger={p.desen} onChange={(v) => set("desen", v)} accent={accent} />
              {p.desen !== "duz" && (
                <>
                  <Kaydirac
                    etiket={p.desen === "faset" ? "Yüz sayısı" : "Nervür sayısı"}
                    deger={p.nervurSayisi} min={4} max={64}
                    onChange={(v) => set("nervurSayisi", v)} accent={accent}
                  />
                  {p.desen !== "faset" && (
                    <Kaydirac etiket="Derinlik" birim=" mm" deger={p.derinlik} min={0.5} max={sinir.derinlikMax} adim={0.5} onChange={(v) => set("derinlik", v)} accent={accent} />
                  )}
                  <Kaydirac etiket="Burgu" birim="°" deger={p.burgu} min={-360} max={360} adim={5} onChange={(v) => set("burgu", v)} accent={accent} />
                  {p.desen === "dalga" && (
                    <Kaydirac etiket="Dalga sayısı" deger={p.dalgaSayisi} min={1} max={20} onChange={(v) => set("dalgaSayisi", v)} accent={accent} />
                  )}
                </>
              )}
            </Bolum>

            <Bolum
              no="07"
              baslik="Duvar kalınlığı"
              aciklama="Kalınlık, yazıcının bastığı hat genişliğinin tam katı seçilir; böylece istenen et payı birebir çıkar."
            >
              <div className="akDuvarlar">
                {DUVAR_SECENEKLERI.map((d) => {
                  const aktif = duvarSayisi(p.cidar) === d.sayi;
                  return (
                    <button
                      key={d.sayi}
                      type="button"
                      onClick={() => set("cidar", d.mm)}
                      className={aktif ? "akDuvar aktif" : "akDuvar"}
                      style={aktif ? { borderColor: accent, color: accent } : undefined}
                    >
                      <b>{d.sayi} duvar</b>
                      <span>{d.mm.toFixed(2).replace(".", ",")} mm</span>
                    </button>
                  );
                })}
              </div>
              <p className="akNot">
                {duvarSayisi(p.cidar) <= 2
                  ? "İnce duvar en çok ışığı geçirir, gövde daha narindir."
                  : duvarSayisi(p.cidar) >= 5
                    ? "Kalın duvar ışığı kısar; malzeme ve baskı süresi artar."
                    : "Işık geçirgenliği ile sağlamlık arasında dengeli seçim."}
              </p>
            </Bolum>
          </>
        )}

        {uyarilar.length > 0 && (
          <div className="akUyarilar">
            {uyarilar.map((u, i) => (
              <div key={i} className={`akUyari ${u.tip}`}>
                <span>{u.tip === "hata" ? "×" : u.tip === "uyari" ? "!" : "i"}</span>
                <span>{u.m}</span>
              </div>
            ))}
          </div>
        )}

        <Bolum no={detay ? "08" : "05"} baslik="Üretim özeti">
          <div className="akOzet">
            {[
              ["Dış ölçü", `Ø${Math.round(enBuyukCap)} × ${p.yukseklik} mm`],
              ["Ağırlık", `${gram.toFixed(0)} g`],
              ["Baskı süresi", `~${sureSaat.toFixed(1)} saat`],
              ["Duvar", `${duvarSayisi(p.cidar)} duvar · ${p.cidar.toFixed(2).replace(".", ",")} mm`],
              ["Duy", `${p.duyTipi} · Ø${duy.gecmeCap} mm geçme · ${duy.ayakSayisi} taşıyıcı`],
              ["Paket", PAKETLER[p.paket].ad],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>
          {yoneticiPaneli && (
            <p className="akNot">
              Geometri sürümü {GEO_SURUM} · önizleme {KALITE.onizleme.kirisHatasi} mm, üretim{" "}
              {KALITE.uretim.kirisHatasi} mm kiriş hatası
            </p>
          )}
        </Bolum>

        {/* SEPET */}
        <div className="akSepet">
          <div className="akSepetUst">
            <div>
              <div className="akEyebrow">Toplam · KDV dahil</div>
              <div className="akTutar">
                {tl(fiyatDetay.toplam)} <span style={{ color: accent }}>₺</span>
              </div>
              <div className="akNot">birim {tl(fiyatDetay.birim)} ₺</div>
            </div>
            <div className="akAdet">
              <button type="button" onClick={() => set("adet", Math.max(1, p.adet - 1))} aria-label="Azalt">−</button>
              <span>{p.adet}</span>
              <button type="button" onClick={() => set("adet", Math.min(20, p.adet + 1))} aria-label="Artır">+</button>
            </div>
          </div>

          <button
            type="button"
            onClick={sepete}
            disabled={hataVar || sepetteBekle}
            className="akSepetBtn"
            style={{ background: hataVar ? undefined : accent }}
          >
            {hataVar ? "Ölçüleri düzelt" : sepetteBekle ? "Ekleniyor…" : "Sepete ekle"}
          </button>

          <div className="akSepetAlt">
            {stlIndirme === "sunucu" && (
              <button type="button" onClick={() => { onStlIstegi?.(paket()); bildir("Dosya talebi gönderildi."); }} disabled={hataVar}>
                Dosya iste
              </button>
            )}
            <button type="button" onClick={linkKopyala}>Tasarımı paylaş</button>
            <button type="button" onClick={sifirla}>Sıfırla</button>
          </div>
        </div>
      </div>
    </div>
  );
}
