/**
 * duy-test.mjs — Duy geçme çapı test parçası üretir.
 *
 * Abajurun tepesindeki delik, duyun plastik gövdesine geçer. Bu gövdenin
 * çapı markadan markaya değişir; yanlış tahmin edilirse ya duy hiç girmez
 * ya da boşta kalır. 6 saatlik bir abajuru riske atmak yerine, gerçek
 * boyun profilinin farklı çaplarda basılmış küçük halkalarını dene.
 *
 * Kullanım:
 *   node scripts/duy-test.mjs                     E27, 41.0-43.0 mm
 *   node scripts/duy-test.mjs E14                 E14, varsayılan aralık
 *   node scripts/duy-test.mjs E27 41.5 43.5 0.4   tip, en az, en çok, adım
 *
 * Çıktı: cikti/duy-test-<tip>.stl  (tek plakada, soldan sağa artan çapta)
 * Her halkanın yanındaki nokta sayısı sırasını gösterir: 1 nokta = en küçük.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

import { DUY_MONTAJ, TABLA, PAY, profilDondur, birlestir, stlBinary } from '../lib/abajur-geometri.mjs';

const [, , tipArg = 'E27', enAzArg, enCokArg, adimArg] = process.argv;

const tip = DUY_MONTAJ[tipArg] ? tipArg : 'E27';
const duy = DUY_MONTAJ[tip];

// Varsayılan aralık: tablodaki geçme çapının 0.4 altından 2 mm üstüne
const enAz = Number(enAzArg) || +(duy.gecmeCap - 0.4).toFixed(1);
const enCok = Number(enCokArg) || +(duy.gecmeCap + 1.6).toFixed(1);
const adim = Number(adimArg) || 0.4;

const capLar = [];
for (let c = enAz; c <= enCok + 1e-6; c += adim) capLar.push(+c.toFixed(2));

const TABAN_ET = 1.2;   // halkaları bir arada tutan ince plaka
const ARALIK = 6;       // halkalar arası boşluk (mm)
const PIM_CAP = 2.4;    // sıra göstergesi noktaları

/** Gerçek boyun profilinin tek halkası (abajur gövdesi olmadan). */
function halka(gecmeCap) {
  const hh = duy.boyunH;
  const ri = gecmeCap / 2;
  const ro = ri + duy.govdeEt;
  const rt = ro + duy.halo;
  const rs = ri - duy.omuzIc;

  // lib/abajur-geometri.mjs içindeki montaj profilinin aynısı
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
  return { geo: profilDondur(profil, 128, TABAN_ET), disR: rt };
}

/** Kaç numaralı halka olduğunu gösteren noktalar. */
function pimler(sayi, x, z) {
  const g = [];
  for (let i = 0; i < sayi; i++) {
    const p = new THREE.CylinderGeometry(PIM_CAP / 2, PIM_CAP / 2, 1.0, 12);
    p.translate(x, TABAN_ET + 0.5, z + i * (PIM_CAP + 1.6));
    g.push(p);
  }
  return g;
}

/* Tablaya sığdır: halkaları satırlara böl. Bir satırın genişliği
   yazıcı tablasını aşarsa alt satıra geçilir. */
const enBuyukR = Math.max(...capLar.map(c => c / 2 + duy.govdeEt + duy.halo));
const hucreGen = enBuyukR * 2 + ARALIK;
const kullanilabilir = TABLA.x - PAY.cap - 10;
const sutun = Math.max(1, Math.min(capLar.length, Math.floor(kullanilabilir / hucreGen)));
const satirSayisi = Math.ceil(capLar.length / sutun);
const satirDerinlik = enBuyukR * 2 + 16; // pimler için pay

const parcalar = [];
for (const [i, cap] of capLar.entries()) {
  const s = Math.floor(i / sutun);
  const k = i % sutun;
  const x = k * hucreGen + enBuyukR;
  const z = s * satirDerinlik + enBuyukR;
  const { geo, disR } = halka(cap);
  geo.translate(x, 0, z);
  parcalar.push(geo);
  parcalar.push(...pimler(i + 1, x, z + disR + 3));
}

// Taban plakası
const genislik = sutun * hucreGen - ARALIK + 8;
const derinlik = satirSayisi * satirDerinlik + 6;
const taban = new THREE.BoxGeometry(genislik, TABAN_ET, derinlik);
taban.translate(genislik / 2 - 4, TABAN_ET / 2, derinlik / 2 - 4);
parcalar.push(taban);

const model = birlestir(parcalar);
model.computeBoundingBox();
const bb = model.boundingBox;
model.applyMatrix4(new THREE.Matrix4().makeTranslation(
  -(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2
));
model.computeVertexNormals();

const stl = stlBinary([model], `UMERA duy gecme testi ${tip}`);
const klasor = 'cikti';
fs.mkdirSync(klasor, { recursive: true });
const dosya = path.join(klasor, `duy-test-${tip}.stl`);
fs.writeFileSync(dosya, Buffer.from(stl));

model.computeBoundingBox();
const son = model.boundingBox;
console.log(`\n  ${dosya}  (${(stl.byteLength / 1024).toFixed(0)} KB)`);
const en = son.max.x - son.min.x;
const boy = son.max.z - son.min.z;
const sigar = en <= TABLA.x - PAY.cap && boy <= TABLA.y - PAY.cap;
console.log(`  olcu: ${en.toFixed(0)} x ${boy.toFixed(0)} x ${(son.max.y - son.min.y).toFixed(0)} mm  (${sutun} sutun x ${satirSayisi} satir)`);
if (!sigar) console.log(`  UYARI: tablaya sigmiyor (${TABLA.x}x${TABLA.y}) — araligi daralt`);
console.log(`  tablodaki mevcut deger: ${duy.gecmeCap} mm\n`);
console.log('  nokta   gecme capi');
console.log('  -----   ----------');
for (const [i, cap] of capLar.entries()) {
  const isaret = cap === duy.gecmeCap ? '  <- su anki' : '';
  console.log(`  ${String(i + 1).padStart(3)}     ${cap.toFixed(1)} mm${isaret}`);
}
console.log(`
  Baski: 0.2 mm kat, 3 duvar, %15 dolgu, destek YOK.
  Duyu her halkaya sirayla gecir. Elle bastirinca giren ve
  cevirince donmeyen ilk halka dogru olcudur.
`);
