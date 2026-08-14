/**
 * siparis-stl.mjs — Sipariş konfigürasyonundan baskıya hazır STL üretir.
 *
 * Kullanım (komut satırı):
 *     node lib/siparis-stl.mjs siparis.json ./cikti
 *
 * Kullanım (sunucuda):
 *     import { uret } from "./siparis-stl.mjs";
 *     const { stl, isEmri, dosyaAdi } = uret(payload);
 *
 * Geometri artık burada DEĞİL: tek kaynak lib/abajur-geometri.mjs. Aynı dosyayı
 * tarayıcıdaki konfigüratör de kullandığı için önizleme ile üretim ayrışamaz.
 * Buradaki tek fark çözünürlük: üretim KALITE.uretim ile daha ince örneklenir.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  GEO_SURUM,
  TABLA,
  PAY,
  TABLA_CAP,
  DUY_MONTAJ,
  YOGUNLUK,
  KALITE,
  KAT_YUKSEKLIGI,
  HAT_GENISLIGI,
  NOZUL,
  disR,
  duvarSayisi,
  modelHazirla,
  stlBinary,
} from "./abajur-geometri.mjs";

export { GEO_SURUM, DUY_MONTAJ, TABLA, PAY, TABLA_CAP };

/* ----------------------- İLK KAT TEMAS ALANI -------------------------- */

/**
 * Model ters basıldığı için tablaya değen yüzey: üst halkanın kesiti +
 * duy boynunun halka kesiti + yaprak taşıyıcıların tabanı. Bu alan küçükse
 * brim şart olur; iş emrinde bunu söylemek gerekiyor.
 */
function ilkKatAlani(p) {
  const N = 360;
  const dTh = (Math.PI * 2) / N;
  let halka = 0;
  for (let c = 0; c < N; c++) {
    const th = c * dTh;
    const ro = disR(th, 1, p);
    const ri = Math.max(0.5, ro - p.cidar);
    halka += ((ro * ro - ri * ri) / 2) * dTh;
  }

  const duy = DUY_MONTAJ[p.duyTipi] || DUY_MONTAJ.E27;
  const rt = duy.gecmeCap / 2 + duy.govdeEt + duy.halo;
  const rs = duy.gecmeCap / 2 - duy.omuzIc;
  const boyun = Math.PI * (rt * rt - rs * rs);

  const ortalamaGenislik = (duy.ayakKok + duy.ayakBel + duy.ayakUc) / 3;
  const ayakUzunlugu = Math.max(0, disR(0, 1, p) - p.cidar - rt);
  const ayaklar = duy.ayakSayisi * ortalamaGenislik * ayakUzunlugu;

  return { halka, boyun, ayaklar, toplam: halka + boyun + ayaklar };
}

/* ------------------------------ ÜRETİCİ ------------------------------- */

export function uret(girdi, secenek = {}) {
  const payload = girdi && girdi.config ? girdi : { config: girdi };
  const p = payload.config;
  const kalite = secenek.kalite || KALITE.uretim;
  const uyarilar = [];

  if (payload.geoSurum && payload.geoSurum !== GEO_SURUM) {
    uyarilar.push(
      `Sipariş ${payload.geoSurum} geometri sürümüyle verildi, bu sunucu ${GEO_SURUM} üretiyor. ` +
        `Model müşterinin gördüğünden çok az farklı olabilir; basmadan önce ölçüleri kontrol et.`
    );
  }

  const hazir = modelHazirla(p, kalite);
  const { model, yon, hacimCm3, olcu, kontrol, cozunurluk } = hazir;

  const gram = hacimCm3 * (YOGUNLUK[p.malzeme] || 1.24);
  const sigar =
    olcu.en <= TABLA.x - PAY.cap &&
    olcu.boy <= TABLA.y - PAY.cap &&
    olcu.yukseklik <= TABLA.z - PAY.yukseklik;

  if (!kontrol.kapali) {
    uyarilar.push(
      `Ağ kapalı değil (${kontrol.govde.acikKenar} açık kenar). Dilimleyicide onarım gerekebilir.`
    );
  }

  const duvar = duvarSayisi(p.cidar);
  const beklenenCidar = +(duvar * HAT_GENISLIGI).toFixed(2);
  if (Math.abs(beklenenCidar - p.cidar) > 0.02) {
    uyarilar.push(
      `Duvar kalınlığı ${p.cidar} mm; dilimleyicide ${duvar} duvar = ${beklenenCidar} mm olarak basılacak.`
    );
  }

  const ilkKat = ilkKatAlani(p);
  const brimGerekli = ilkKat.toplam < 2600 || olcu.yukseklik / Math.max(olcu.en, 1) > 1.35;

  const ad = `abajur_${p.profil}_${Math.round(p.altCap)}x${Math.round(p.yukseklik)}_${p.desen}_${p.duyTipi}_${String(
    p.malzeme
  ).replace(/\s/g, "")}`;

  const stl = stlBinary([model], `UMERA ${ad} | GEO ${GEO_SURUM}`, { kirpma: secenek.kirpma !== false });
  const ucgen = new DataView(stl).getUint32(80, true);

  const isEmri = {
    dosya: `${ad}.stl`,
    olcu: `${olcu.en.toFixed(1)} x ${olcu.boy.toFixed(1)} x ${olcu.yukseklik.toFixed(1)} mm`,
    tablayaSigar: sigar,
    yonlendirme: yon.ters ? "Üst halka tablada (model ters çevrilmiş)" : "Alt halka tablada",
    modelHazir: "Model Z=0'da oturur ve XY'de ortalanmıştır; dilimleyicide taşımaya gerek yok",
    agKapali: kontrol.kapali ? "Evet — su geçirmez, onarım gerekmez" : "HAYIR — kontrol et",
    ucgenSayisi: ucgen,
    sarkma: `${yon.aci.toFixed(0)}° · ${yon.aci > 50 ? "kenarda destek gerekebilir" : "desteksiz basılır"}`,
    malzeme: p.malzeme,
    renk: p.renk,
    tahminiAgirlik: `${gram.toFixed(0)} g`,
    ilkKatTemas: `${Math.round(ilkKat.toplam)} mm² (halka ${Math.round(ilkKat.halka)} · boyun ${Math.round(
      ilkKat.boyun
    )} · taşıyıcı ${Math.round(ilkKat.ayaklar)})`,
    dilimleyici: {
      yazici: `Bambu X2D · ${NOZUL} mm nozul · tabla ${TABLA.x}×${TABLA.y}×${TABLA.z} mm`,
      mod: "Normal — vazo modu KAPALI (boyun ve taşıyıcılar tek konturu böler)",
      katYuksekligi: `${KAT_YUKSEKLIGI.toFixed(2)} mm`,
      duvar: `${duvar} duvar (${beklenenCidar} mm) — model duvarı hat genişliğinin tam katı, boşluk dolgusu oluşmaz`,
      dolgu: "%20 gyroid — yalnızca boyun ve taşıyıcı içinde oluşur, gövde duvarında dolgu yoktur",
      ustKat: "4",
      altKat: "4",
      tablaYapisma: brimGerekli
        ? "Brim 5 mm — ilk kat yalnızca ince halka temas ediyor, brimsiz basma"
        : "Brim gerekmiyor; yine de 3 mm brim güvenli",
      destek: yon.aci > 50 ? "Alt kenarda destek aç" : "Destek kapalı",
      not: "Boyun rozeti ve yaprak taşıyıcılar gövdeyle çakışan kapalı katılardır; dilimleyici birleştirir",
    },
    montaj: `${p.duyTipi} UMERA sabit rozet · geçme Ø${(DUY_MONTAJ[p.duyTipi] || DUY_MONTAJ.E27).gecmeCap} mm · ${
      (DUY_MONTAJ[p.duyTipi] || DUY_MONTAJ.E27).ayakSayisi
    } yaprak`,
    paket: p.paket === "set" ? `Duylu set — ${p.duyTipi} duy + kablo + askı ekle` : "Yalnızca başlık",
    cozunurluk: `${cozunurluk.N} çevresel × ${cozunurluk.R} dikey bölüm`,
    uyarilar,
  };

  return {
    stl,
    isEmri,
    dosyaAdi: `${ad}.stl`,
    gram,
    hacimCm3,
    ucgen,
    kontrol,
    olcu,
    uyarilar,
  };
}

/* --------------------------- KOMUT SATIRI ----------------------------- */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , girdiYolu, ciktiKlasoru = "."] = process.argv;
  if (!girdiYolu) {
    console.error("Kullanım: node lib/siparis-stl.mjs siparis.json [cikti-klasoru]");
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(girdiYolu, "utf8"));
  const { stl, isEmri, dosyaAdi } = uret(payload);

  fs.mkdirSync(ciktiKlasoru, { recursive: true });
  const stlYolu = path.join(ciktiKlasoru, dosyaAdi);
  fs.writeFileSync(stlYolu, Buffer.from(stl));
  fs.writeFileSync(
    path.join(ciktiKlasoru, dosyaAdi.replace(/\.stl$/, "-is-emri.json")),
    JSON.stringify(isEmri, null, 2)
  );

  console.log(`\n  ${stlYolu}  (${(stl.byteLength / 1024 / 1024).toFixed(2)} MB)\n`);
  for (const [k, v] of Object.entries(isEmri)) {
    if (Array.isArray(v)) {
      if (v.length) {
        console.log(`  ${k}:`);
        for (const s of v) console.log(`      - ${s}`);
      }
    } else if (typeof v === "object" && v !== null) {
      console.log(`  ${k}:`);
      for (const [k2, v2] of Object.entries(v)) console.log(`      ${k2}: ${v2}`);
    } else {
      console.log(`  ${k}: ${v}`);
    }
  }
  if (!isEmri.tablayaSigar) {
    console.error("\n  HATA: model tablaya sığmıyor, basma.\n");
    process.exit(2);
  }
  console.log("");
}
