/**
 * siparis-stl.mjs — Sipariş konfigürasyonundan baskıya hazır STL üretir.
 *
 * Kullanım (komut satırı):
 *     node siparis-stl.mjs siparis.json ./cikti
 *
 * Kullanım (sunucuda):
 *     import { uret } from "./siparis-stl.mjs";
 *     const { stl, isEmri, dosyaAdi } = uret(payload);
 *     fs.writeFileSync(dosyaAdi, Buffer.from(stl));
 *
 * Gereksinim: npm install three   (WebGL gerekmez, sadece geometri matematiği)
 *
 * ÖNEMLİ: Buradaki geometri fonksiyonları abajur-konfigurator.jsx ile
 * BİREBİR aynı olmalı. İkisinde de GEO_SURUM sabiti var; sipariş farklı
 * sürümle geldiyse betik uyarır. Geometriyi değiştirirsen iki dosyada da
 * değiştir ve sürümü artır.
 */

import * as THREE from "three";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const GEO_SURUM = "2.0";

const TABLA = { x: 256, y: 256, z: 260 };  // Bambu X2D, ana nozul
const PAY = { cap: 10, yukseklik: 6 };
const TABLA_CAP = Math.min(TABLA.x, TABLA.y);

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
const AYAK_GOMME = 1.6;
const YOGUNLUK = { PLA: 1.24, PETG: 1.27, "PLA Silk": 1.24 };

/* ----------------------------- GEOMETRİ ----------------------------- */

function segmentSayisi(p) {
  if (p.desen === "faset") return Math.max(64, p.nervurSayisi * 6);
  if (p.desen === "duz") return 160;
  return Math.min(360, Math.max(144, p.nervurSayisi * 8));
}

// Üretimde önizlemeden daha yüksek çözünürlük kullanılır
function satirSayisi(p) {
  const egri = p.profil !== "duz" || p.desen === "dalga" || Math.abs(p.burgu) > 0.5;
  return egri ? 220 : 48;
}

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

function desenR(theta, u, p) {
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

const disR = (theta, u, p) => Math.max(1, temelR(u, p) + desenR(theta, u, p));

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
      idx.push(oi(r, c), oi(r + 1, c), oi(r, c + 1));
      idx.push(oi(r, c + 1), oi(r + 1, c), oi(r + 1, c + 1));
      idx.push(ii(r, c), ii(r, c + 1), ii(r + 1, c));
      idx.push(ii(r, c + 1), ii(r + 1, c + 1), ii(r + 1, c));
    }
  }
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
  return geo;
}

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

function yaprakAyakGeometrisi(aci, rIc, rDis, yUst, duy) {
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

function montajGeometrisi(p) {
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
  const boyun = profilDondur(profil, 96, H - hh);

  const yapraklar = [];
  const n = duy.ayakSayisi;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const rDis = disR(th, 1, p) - p.cidar + AYAK_GOMME;
    const rIc = rt - 1.4;
    if (rDis - rIc <= 3) continue;
    yapraklar.push(yaprakAyakGeometrisi(th, rIc, rDis, H, duy));
  }
  return birlestir([boyun, ...yapraklar]);
}

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
  return { ters: true, aci: ters, zorunlu: true };
}

function hacimHesapla(geo) {
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

/* -------------------------------- STL -------------------------------- */

const ucgenSayisi = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

function stlBinary(geoler, baslik = "abajur") {
  const liste = geoler.filter(Boolean);
  const toplam = liste.reduce((s, g) => s + ucgenSayisi(g), 0);
  const buf = new ArrayBuffer(84 + toplam * 50);
  const dv = new DataView(buf);
  const bas = new Uint8Array(buf, 0, 80);
  for (let i = 0; i < Math.min(79, baslik.length); i++) bas[i] = baslik.charCodeAt(i) & 0x7f;
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
      // three (Y yukarı) -> STL (Z yukarı): X ekseni etrafında -90°
      dv.setFloat32(o, nx / len, true);
      dv.setFloat32(o + 4, -nz / len, true);
      dv.setFloat32(o + 8, ny / len, true);
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

/* ----------------------------- ÜRETİCİ ------------------------------ */

export function uret(girdi) {
  const payload = girdi.config ? girdi : { config: girdi };
  const p = payload.config;

  if (payload.geoSurum && payload.geoSurum !== GEO_SURUM) {
    console.warn(
      `UYARI: sipariş geometri sürümü ${payload.geoSurum}, bu betik ${GEO_SURUM}. ` +
        `Model siparişte görülenden farklı çıkabilir.`
    );
  }

  const govde = abajurGeometrisi(p);
  const montaj = montajGeometrisi(p);
  const yon = baskiYonu(p);

  // Tek gövdede birleştir, sonra baskı yönüne çevir
  const model = birlestir([govde, montaj]);
  if (yon.ters) model.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));
  model.computeBoundingBox();
  const bb = model.boundingBox;
  // Tablaya otur ve XY'de ortala
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

  const hacimCm3 = hacimHesapla(model) / 1000;
  const gram = hacimCm3 * (YOGUNLUK[p.malzeme] || 1.24);
  const en = son.max.x - son.min.x;
  const boy = son.max.z - son.min.z;
  const yuk = son.max.y - son.min.y;

  const sigar = en <= TABLA.x - PAY.cap && boy <= TABLA.y - PAY.cap && yuk <= TABLA.z - PAY.yukseklik;
  const vazo = false;
  const duvarSayisi = Math.max(1, Math.round(p.cidar / 0.42));

  const ad = `abajur_${p.profil}_${p.altCap}x${p.yukseklik}_${p.desen}_${p.duyTipi}_${p.malzeme.replace(/\s/g, "")}`;
  const stl = stlBinary([model], `${ad} | GEO ${GEO_SURUM}`);

  const isEmri = {
    dosya: `${ad}.stl`,
    olcu: `${en.toFixed(1)} x ${boy.toFixed(1)} x ${yuk.toFixed(1)} mm`,
    tablayaSigar: sigar,
    yonlendirme: yon.ters ? "Üst halka tablada (model ters çevrilmiş)" : "Alt halka tablada",
    modelHazir: "Model Z=0'da oturur ve XY'de ortalanmıştır, dilimleyicide taşımaya gerek yok",
    sarkma: `${yon.aci.toFixed(0)}° · ${yon.aci > 50 ? "kenara destek gerekebilir" : "desteksiz"}`,
    malzeme: p.malzeme,
    renk: p.renk,
    tahminiAgirlik: `${gram.toFixed(0)} g`,
    dilimleyici: vazo
      ? {
          mod: "Vazo modu (spiral vase) AÇIK",
          duvar: `Tek duvar — akış ${p.cidar.toFixed(1)} mm olacak şekilde ayarla`,
          dolgu: "%0",
          ustKat: "0",
          altKat: "3",
          katYuksekligi: "0,2 mm",
        }
      : {
          mod: "Normal (vazo modu KAPALI — boyun kolları tek konturu bozar)",
          duvar: `${duvarSayisi} duvar (${p.cidar.toFixed(1)} mm)`,
          dolgu: "%0",
          ustKat: "3",
          altKat: "3",
          katYuksekligi: "0,2 mm",
          not: "Sabit duy rozeti ve yaprak taşıyıcılar gövdeyle çakışan kapalı katılardır; dilimleyici birleştirir",
        },
    montaj: `${p.duyTipi} UMERA sabit rozet · geçme Ø${(DUY_MONTAJ[p.duyTipi] || DUY_MONTAJ.E27).gecmeCap} mm · ${(DUY_MONTAJ[p.duyTipi] || DUY_MONTAJ.E27).ayakSayisi} yaprak`,
    paket: p.paket === "set" ? `Duylu set — ${p.duyTipi} duy + kablo + askı ekle` : "Yalnızca başlık",
  };

  return { stl, isEmri, dosyaAdi: `${ad}.stl`, gram, hacimCm3 };
}

/* --------------------------- KOMUT SATIRI --------------------------- */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , girdiYolu, ciktiKlasoru = "."] = process.argv;
  if (!girdiYolu) {
    console.error("Kullanım: node siparis-stl.mjs siparis.json [cikti-klasoru]");
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

  console.log(`\n  ${stlYolu}  (${(stl.byteLength / 1024 / 1024).toFixed(1)} MB)\n`);
  for (const [k, v] of Object.entries(isEmri)) {
    if (typeof v === "object") {
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
