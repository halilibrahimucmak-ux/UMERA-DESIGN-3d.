import {
  DUY_MONTAJ,
  GEO_SURUM,
  TABLA,
  PAY,
  TABLA_CAP,
  MIN_DUVAR_SAYISI,
  MAKS_DUVAR_SAYISI,
  HAT_GENISLIGI,
  cidarKirp,
  duvarSayisi,
  olcum,
  ortalamaYaricap,
  KALITE,
} from './abajur-geometri.mjs';
import { VARSAYILAN_TARIFE, tarifeBirlestir } from './abajur-tarife.js';
import { DELIK_DESENLERI, CUBUK_ARALIK, enAzCubukKalinligi } from './abajur-delik.mjs';

export { VARSAYILAN_TARIFE, tarifeBirlestir };

/* Fiyat tarifesi lib/abajur-tarife.js içinde tanımlıdır. Yönetici panelinden
   kaydedilen değerler varsayılanların üzerine biner; ABAJUR_FIYAT geriye dönük
   uyum için varsayılan tarifeye işaret eder. */
export const ABAJUR_FIYAT = VARSAYILAN_TARIFE;

export const DUY_MONTAJLARI = DUY_MONTAJ;
export { GEO_SURUM, TABLA, PAY, TABLA_CAP };

const DEFAULTS = {
  paket: 'set', duyTipi: 'E27', profil: 'duz', altCap: 190, ustCap: 190,
  yukseklik: 254, bel: 18, desen: 'nervur', nervurSayisi: 22, derinlik: 3,
  burgu: 0, dalgaSayisi: 6, cidar: 1.26, malzeme: 'PLA', renk: 'Kemik Beyazı',
  delik: 'yok', cubukKalinlik: 2.5, delikBoyu: 18, delikTohum: 1,
  montaj: 'boyun', bogazCap: 42, boyunH: 12, kolSayisi: 4,
  kolKalinlik: 4.2, kelvin: 2700, adet: 1
};

const OPTIONS = {
  paket: ['baslik', 'set'],
  duyTipi: ['E27', 'E14'],
  profil: ['duz', 'fici', 'kumsaati', 'can'],
  desen: ['duz', 'nervur', 'dalga', 'faset'],
  malzeme: ['PLA', 'PETG', 'PLA Silk'],
  delik: DELIK_DESENLERI,
  renk: ['Kemik Beyazı', 'Kum Beji', 'Adaçayı', 'Terrakota', 'Duman Grisi', 'Kömür'],
};

const RANGE = {
  altCap: [80, TABLA_CAP - PAY.cap], ustCap: [46, TABLA_CAP - PAY.cap],
  yukseklik: [80, TABLA.z - PAY.yukseklik], bel: [0, 60],
  nervurSayisi: [4, 64], derinlik: [0.5, 12], burgu: [-360, 360],
  dalgaSayisi: [1, 20],
  cidar: [MIN_DUVAR_SAYISI * HAT_GENISLIGI, MAKS_DUVAR_SAYISI * HAT_GENISLIGI],
  cubukKalinlik: CUBUK_ARALIK, delikBoyu: [8, 45], delikTohum: [1, 9999],
  kelvin: [2200, 6000], adet: [1, 20]
};

function option(value, key) {
  return OPTIONS[key].includes(value) ? value : DEFAULTS[key];
}

function numberInRange(value, key) {
  const [min, max] = RANGE[key];
  // "2,8" gibi yerel yazımı da kabul et; aksi halde sessizce varsayılana düşer
  const number = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : Number(value);
  if (!Number.isFinite(number)) return DEFAULTS[key];
  return Math.max(min, Math.min(max, number));
}

/**
 * Bu gövdede üretilebilecek en ince çubuk (mm). Daha incesi ızgarada
 * çözülemez ve kafes lif lif parçalanır; müşteriye böyle bir tasarım
 * kurdurmuyoruz.
 */
export function enAzCubuk(config) {
  return enAzCubukKalinligi(config.yukseklik, ortalamaYaricap(config), KALITE.uretim.delikButcesi);
}

export function normalizeAbajurConfig(input = {}) {
  const duyTipi = option(input.duyTipi, 'duyTipi');
  const duy = DUY_MONTAJLARI[duyTipi];
  const temel = {
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
    // duvar kalınlığı ekstrüzyon hattının tam katına oturur -> dilimleyicide
    // boşluk dolgusu oluşmaz, basılan et istenen ölçüyü tutar
    cidar: cidarKirp(numberInRange(input.cidar, 'cidar')),
    malzeme: option(input.malzeme, 'malzeme'),
    renk: option(input.renk, 'renk'),
    // delik deseni: gövdeyi gerçekten deler (bkz. lib/abajur-delik.mjs)
    delik: option(input.delik, 'delik'),
    cubukKalinlik: +numberInRange(input.cubukKalinlik, 'cubukKalinlik').toFixed(2),
    delikBoyu: Math.round(numberInRange(input.delikBoyu, 'delikBoyu')),
    delikTohum: Math.round(numberInRange(input.delikTohum, 'delikTohum')),
    montaj: 'boyun',
    bogazCap: duy.bogaz,
    boyunH: duy.boyunH,
    kolSayisi: duy.ayakSayisi,
    kolKalinlik: duy.ayakEt,
    kelvin: numberInRange(input.kelvin, 'kelvin'),
    adet: Math.round(numberInRange(input.adet, 'adet'))
  };

  // Çubuk alt sınırı gövde boyutuna bağlı: büyük gövdede ızgara daha kaba
  // kaldığı için daha kalın çubuk gerekir.
  if (temel.delik !== 'yok') {
    temel.cubukKalinlik = Math.max(temel.cubukKalinlik, enAzCubuk(temel));
  }
  return temel;
}

const PROFILE_NAMES = { duz: 'Düz', fici: 'Fıçı', kumsaati: 'Kum saati', can: 'Çan' };
const PATTERN_NAMES = { duz: 'Düz', nervur: 'Nervür', dalga: 'Dalga', faset: 'Faset' };

/**
 * @param input   abajur yapılandırması
 * @param tarife  yöneticinin kaydettiği tarife; verilmezse varsayılan kullanılır
 */
export function quoteAbajur(input, tarife) {
  const config = normalizeAbajurConfig(input);
  const { gram, hacimCm3, tablayaSigar, enBuyukCap } = olcum(config);
  if (!tablayaSigar) throw new Error('ABAJUR_SIGMIYOR');

  const t = tarife || VARSAYILAN_TARIFE;
  const sureSaat = (hacimCm3 * 1000) / Math.max(0.5, t.akisMm3s || 4) / 3600;
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
    hacimCm3: Number(hacimCm3.toFixed(1)),
    sureSaat: Number(sureSaat.toFixed(2)),
    enBuyukCap: Math.round(enBuyukCap),
    duvarSayisi: duvarSayisi(config.cidar),
    name: `Kişiye Özel Abajur · ${PROFILE_NAMES[config.profil]}`,
    summary: `${PROFILE_NAMES[config.profil]} profil · ${PATTERN_NAMES[config.desen]} · Ø${config.altCap}/${config.ustCap} × ${config.yukseklik} mm · ${config.malzeme} · ${config.renk} · ${config.paket === 'set' ? `${config.duyTipi} set` : 'yalnızca başlık'}`
  };
}
