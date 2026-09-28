import test from 'node:test';
import assert from 'node:assert/strict';

import { shopierUrunuCevir, shopierAktif, fiyatOku } from '../lib/shopier.js';

const HAM = {
  id: '696547',
  title: 'Sarkıt Abajur',
  description: '<p>El yapımı <b>3D baskı</b> abajur.</p><br>Kargo bize ait&nbsp;!',
  type: 'physical',
  url: 'https://www.shopier.com/696547',
  dateCreated: '2026-07-21T13:24:51+0300',
  priceData: { currency: 'TRY', price: '1200', vatPercent: 20, discount: false, shippingPrice: '0' },
  stockStatus: 'inStock',
  stockQuantity: 5,
  shippingPayer: 'sellerPays',
  categories: [{ id: '1', title: 'Aydınlatma' }],
  media: [
    { id: 'b', type: 'image', url: 'https://cdn/2.jpg', placement: 2 },
    { id: 'a', type: 'image', url: 'https://cdn/1.jpg', placement: 1 },
  ],
};

test('Shopier ürünü site katalog biçimine çevrilir', () => {
  const u = shopierUrunuCevir(HAM);
  assert.equal(u.name, 'Sarkıt Abajur');
  assert.equal(u.category, 'Aydınlatma');
  assert.equal(u.price, 1200);
  assert.equal(u.stock, 5);
  assert.equal(u.kaynak, 'shopier');
  assert.equal(u.shopierUrl, 'https://www.shopier.com/696547');
  assert.equal(u.kargoSaticiOdiyor, true);
  assert.equal(u.minAdet, 1, 'Shopier ürününde site minimumu uygulanmaz');
});

test('id site ürünleriyle çakışmaz', () => {
  // Sheets tarafı UUID kullanıyor; ön ek olmadan ikisi karışabilirdi.
  assert.equal(shopierUrunuCevir(HAM).id, 'shopier:696547');
});

test('görseller sıraya dizilir, ana görsel başa gelir', () => {
  const u = shopierUrunuCevir(HAM);
  assert.deepEqual(u.images.map(g => g.url), ['https://cdn/1.jpg', 'https://cdn/2.jpg']);
  assert.equal(u.image, 'https://cdn/1.jpg');
});

test('görsel olmayan medya listelenmez', () => {
  const u = shopierUrunuCevir({ ...HAM, media: [
    { id: 'v', type: 'video', url: 'https://cdn/v.mp4', placement: 1 },
    { id: 'a', type: 'image', url: 'https://cdn/1.jpg', placement: 2 },
  ] });
  assert.deepEqual(u.images.map(g => g.url), ['https://cdn/1.jpg']);
});

test('indirimli üründe ödenecek tutar gösterilir', () => {
  /* Müşteri Shopier'de indirimli tutarı ödüyor; kartta liste fiyatı yazsaydı
     siteden gördüğü fiyatla ödediği tutar tutmazdı. */
  const u = shopierUrunuCevir({
    ...HAM,
    priceData: { ...HAM.priceData, discount: true, price: '1200', discountedPrice: '899' },
  });
  assert.equal(u.price, 899);
  assert.equal(u.listePrice, 1200, 'üstü çizili liste fiyatı da taşınmalı');
});

test('indirim yokken liste fiyatı gösterilmez', () => {
  assert.equal(shopierUrunuCevir(HAM).listePrice, 0);
});

test('tükenen ürün stok sıfır gelir', () => {
  const u = shopierUrunuCevir({ ...HAM, stockStatus: 'outOfStock', stockQuantity: 0 });
  assert.equal(u.stock, 0);
});

test('sınırsız stokta ürün satılabilir görünür', () => {
  // Shopier sınırsız stokta stockQuantity=0 döndürebiliyor; "Tükendi"
  // kararını stockStatus veriyor.
  const u = shopierUrunuCevir({ ...HAM, stockStatus: 'inStock', stockQuantity: 0 });
  assert.ok(u.stock > 0, 'stokta olan ürün tükendi görünmemeli');
});

test('açıklamadaki HTML düz metne indirgenir', () => {
  const u = shopierUrunuCevir(HAM);
  assert.ok(!/[<>]/.test(u.description), `HTML kalmış: ${u.description}`);
  assert.match(u.description, /El yapımı 3D baskı abajur/);
  assert.match(u.description, /Kargo bize ait !/);
});


test('para birimi korunur', () => {
  assert.equal(shopierUrunuCevir(HAM).paraBirimi, 'TRY');
  assert.equal(shopierUrunuCevir({ ...HAM, priceData: { ...HAM.priceData, currency: 'USD' } }).paraBirimi, 'USD');
});

test('eksik alanlar güvenli varsayılana düşer', () => {
  const u = shopierUrunuCevir({ id: '1', url: 'https://www.shopier.com/1' });
  assert.equal(u.name, 'Ürün');
  assert.equal(u.category, 'Shopier');
  assert.equal(u.images.length, 0);
  assert.equal(u.description, '');
});

test('anahtar yoksa Shopier kapalı sayılır', () => {
  const onceki = process.env.SHOPIER_TOKEN;
  delete process.env.SHOPIER_TOKEN;
  assert.equal(shopierAktif(), false);
  process.env.SHOPIER_TOKEN = 'test';
  assert.equal(shopierAktif(), true);
  if (onceki === undefined) delete process.env.SHOPIER_TOKEN;
  else process.env.SHOPIER_TOKEN = onceki;
});

test('fiyat metni her yazım biçiminde doğru okunur', () => {
  /* Shopier fiyatı metin olarak veriyor ve belgede biçimi yazmıyor. Yanlış
     okunması müşteriye yanlış fiyat göstermek demek; ölçülen kusur: binlik
     ayraçlı "1.299,50" değeri 0 TL görünüyordu. */
  const beklenen = [
    ['1200', 1200], ['1200.00', 1200], ['899.90', 899.9], ['899,90', 899.9],
    ['1.299,50', 1299.5], ['1,299.50', 1299.5],
    ['1.200', 1200], ['1,200', 1200],
    ['12.345.678,90', 12345678.9],
    ['1.5', 1.5], ['0', 0], [1500, 1500], ['₺1.250', 1250],
  ];
  for (const [girdi, cikti] of beklenen) {
    assert.equal(fiyatOku(girdi), cikti, `${JSON.stringify(girdi)} yanlış okundu`);
  }
});

test('okunamayan fiyat sıfır değil, bilinmiyor sayılır', () => {
  for (const kotu of ['', 'abc', null, undefined, NaN]) {
    assert.equal(fiyatOku(kotu), null, `${JSON.stringify(kotu)} null olmalı`);
  }
  const u = shopierUrunuCevir({ id: '9', url: 'https://www.shopier.com/9', priceData: { price: 'sorunuz' } });
  assert.equal(u.fiyatBilinmiyor, true, 'kartta 0 TL yazmamalı');
});

test('fiyatı okunan üründe bilinmiyor işareti kalkar', () => {
  const u = shopierUrunuCevir({ id: '9', url: 'https://www.shopier.com/9', priceData: { price: '1.299,50', currency: 'TRY' } });
  assert.equal(u.fiyatBilinmiyor, false);
  assert.equal(u.price, 1299.5);
});
