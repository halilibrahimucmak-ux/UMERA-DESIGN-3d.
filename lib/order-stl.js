import { uret } from './siparis-stl.mjs';
import { KALITE } from './abajur-geometri.mjs';
import { normalizeAbajurConfig } from './abajur.js';

function safeFilePart(value) {
  return String(value || 'siparis')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'siparis';
}

export function createOrderStl(order, configurationIndex, secenek = {}) {
  const index = Number(configurationIndex);
  if (!Number.isInteger(index) || index < 0) throw new Error('GECERSIZ_YAPILANDIRMA');
  const configuration = order?.configurations?.[index];
  if (!configuration?.config) throw new Error('YAPILANDIRMA_BULUNAMADI');

  const kalite = secenek.ucgenButcesi
    ? { ...KALITE.uretim, ucgenButcesi: secenek.ucgenButcesi }
    : KALITE.uretim;

  /* Siparişte saklanan yapılandırma doğrudan kullanılmaz: eski siparişler
     bugün üretilemeyecek değerler içerebilir (ör. hat genişliğinin katı
     olmayan 0.6 mm duvar, o zamanki sınırlarla girilmiş ölçüler). Güncel
     üretim kurallarından geçirip nelerin değiştiğini iş emrinde bildiriyoruz. */
  const ham = { ...configuration.config, adet: configuration.quantity || 1 };
  const config = normalizeAbajurConfig(ham);

  const duzeltmeler = [];
  for (const alan of ['cidar', 'altCap', 'ustCap', 'yukseklik', 'derinlik', 'bel', 'nervurSayisi', 'dalgaSayisi', 'burgu']) {
    const eski = Number(ham[alan]);
    if (!Number.isFinite(eski)) continue;
    if (Math.abs(eski - config[alan]) > 0.005) {
      duzeltmeler.push(`${alan}: ${eski} -> ${config[alan]} (üretim sınırlarına çekildi)`);
    }
  }

  const result = uret(
    { config, geoSurum: configuration.geoSurum },
    { kalite, ekUyarilar: duzeltmeler }
  );
  const orderNo = safeFilePart(order.orderNo);
  const socket = safeFilePart(config.duyTipi || 'duy');
  return {
    ...result,
    fileName: `${orderNo}-abajur-${index + 1}-${socket}.stl`
  };
}

