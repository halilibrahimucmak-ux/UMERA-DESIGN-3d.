import { DUY_MONTAJ, GEO_SURUM, uret } from './siparis-stl.mjs';

export const ABAJUR_FIYAT = {
  guncelleme: '2026-08-13',
  filament: { PLA: 780, PETG: 975, 'PLA Silk': 1014 },
  fire: 8,
  makineSaat: 45,
  elIsciligi: 60,
  boyunMontaj: 45,
  duy: { E27: 180, E14: 150 },
  kar: 55,
  duyMarj: 35,
  kdv: 20
};

const DEFAULTS = {
  paket: 'set', duyTipi: 'E27', profil: 'duz', altCap: 190, ustCap: 190,
  yukseklik: 254, bel: 18, desen: 'nervur', nervurSayisi: 22, derinlik: 3,
  burgu: 0, dalgaSayisi: 6, cidar: 1.2, malzeme: 'PLA', renk: 'Kemik Beyazı',
  montaj: 'boyun', bogazCap: 41, boyunH: 12, kolSayisi: 4,
  kolKalinlik: 4.2, kelvin: 2700, adet: 1
};

export const DUY_MONTAJLARI = DUY_MONTAJ;

const OPTIONS = {
  paket: ['baslik', 'set'],
  duyTipi: ['E27', 'E14'],
  profil: ['duz', 'fici', 'kumsaati', 'can'],
  desen: ['duz', 'nervur', 'dalga', 'faset'],
  malzeme: ['PLA', 'PETG', 'PLA Silk'],
  renk: ['Kemik Beyazı', 'Kum Beji', 'Adaçayı', 'Terrakota', 'Duman Grisi', 'Kömür'],
};

const RANGE = {
  altCap: [80, 246], ustCap: [46, 246], yukseklik: [80, 254], bel: [0, 60],
  nervurSayisi: [4, 64], derinlik: [0.5, 12], burgu: [-360, 360],
  dalgaSayisi: [1, 20], cidar: [0.6, 3], kelvin: [2200, 6000], adet: [1, 20]
};

function option(value, key) {
  return OPTIONS[key].includes(value) ? value : DEFAULTS[key];
}

function numberInRange(value, key) {
  const [min, max] = RANGE[key];
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULTS[key];
  return Math.max(min, Math.min(max, number));
}

export function normalizeAbajurConfig(input = {}) {
  const duyTipi = option(input.duyTipi, 'duyTipi');
  const duy = DUY_MONTAJLARI[duyTipi];
  return {
    paket: option(input.paket, 'paket'),
    duyTipi,
    profil: option(input.profil, 'profil'),
    altCap: numberInRange(input.altCap, 'altCap'),
    ustCap: Math.max(numberInRange(input.ustCap, 'ustCap'), duy.minUstCap),
    yukseklik: numberInRange(input.yukseklik, 'yukseklik'),
    bel: numberInRange(input.bel, 'bel'),
    desen: option(input.desen, 'desen'),
    nervurSayisi: Math.round(numberInRange(input.nervurSayisi, 'nervurSayisi')),
    derinlik: numberInRange(input.derinlik, 'derinlik'),
    burgu: numberInRange(input.burgu, 'burgu'),
    dalgaSayisi: Math.round(numberInRange(input.dalgaSayisi, 'dalgaSayisi')),
    cidar: numberInRange(input.cidar, 'cidar'),
    malzeme: option(input.malzeme, 'malzeme'),
    renk: option(input.renk, 'renk'),
    montaj: 'boyun',
    bogazCap: duy.bogaz,
    boyunH: duy.boyunH,
    kolSayisi: duy.ayakSayisi,
    kolKalinlik: duy.ayakEt,
    kelvin: numberInRange(input.kelvin, 'kelvin'),
    adet: Math.round(numberInRange(input.adet, 'adet'))
  };
}

const PROFILE_NAMES = { duz: 'Düz', fici: 'Fıçı', kumsaati: 'Kum saati', can: 'Çan' };
const PATTERN_NAMES = { duz: 'Düz', nervur: 'Nervür', dalga: 'Dalga', faset: 'Faset' };

export function quoteAbajur(input) {
  const config = normalizeAbajurConfig(input);
  const { gram, hacimCm3, isEmri } = uret({ config, geoSurum: GEO_SURUM });
  if (!isEmri.tablayaSigar) throw new Error('ABAJUR_SIGMIYOR');

  const t = ABAJUR_FIYAT;
  const sureSaat = (hacimCm3 * 1000) / 4 / 3600;
  const malzeme = (gram / 1000) * t.filament[config.malzeme] * (1 + t.fire / 100);
  const makine = sureSaat * t.makineSaat;
  const iscilik = t.elIsciligi;
  const boyun = config.montaj === 'boyun' ? t.boyunMontaj : 0;
  const uretim = malzeme + makine + iscilik + boyun;
  const kar = uretim * (t.kar / 100);
  const duyAlis = config.paket === 'set' ? t.duy[config.duyTipi] : 0;
  const duy = duyAlis * (1 + t.duyMarj / 100);
  const kdvsiz = uretim + kar + duy;
  const birim = Math.round(kdvsiz * (1 + t.kdv / 100));

  return {
    config,
    geoSurum: GEO_SURUM,
    birim,
    toplam: birim * config.adet,
    gram: Number(gram.toFixed(1)),
    sureSaat: Number(sureSaat.toFixed(2)),
    isEmri,
    name: `Kişiye Özel Abajur · ${PROFILE_NAMES[config.profil]}`,
    summary: `${PROFILE_NAMES[config.profil]} profil · ${PATTERN_NAMES[config.desen]} · Ø${config.altCap}/${config.ustCap} × ${config.yukseklik} mm · ${config.malzeme} · ${config.renk} · ${config.paket === 'set' ? `${config.duyTipi} set` : 'yalnızca başlık'}`
  };
}
