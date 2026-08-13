import { uret } from './siparis-stl.mjs';

function safeFilePart(value) {
  return String(value || 'siparis')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'siparis';
}

export function createOrderStl(order, configurationIndex) {
  const index = Number(configurationIndex);
  if (!Number.isInteger(index) || index < 0) throw new Error('GECERSIZ_YAPILANDIRMA');
  const configuration = order?.configurations?.[index];
  if (!configuration?.config) throw new Error('YAPILANDIRMA_BULUNAMADI');

  const result = uret({
    config: { ...configuration.config, adet: configuration.quantity || 1 },
    geoSurum: configuration.geoSurum
  });
  const orderNo = safeFilePart(order.orderNo);
  const socket = safeFilePart(configuration.config.duyTipi || 'duy');
  return {
    ...result,
    fileName: `${orderNo}-abajur-${index + 1}-${socket}.stl`
  };
}

