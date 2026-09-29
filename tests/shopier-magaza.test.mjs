import test from 'node:test';
import assert from 'node:assert/strict';
import { magazayiAyristir } from '../lib/shopier-magaza.js';

/* Gerçek vitrin işaretlemesinin küçültülmüş hali: iki ürün, bir de şablonun
   gizli "placeholder" kartı. Kart sınıfı ve data-price biçimi olduğu gibi. */
const HTML = `
<div class="product-card placeholder addable-placeholder !hidden"><a href="#"></a></div>
<div class="product-card shopier--product-card product-card-store">
  <a  href="https://www.shopier.com/UmeraDesign/51324068" data-back-id="51324068">
    <div class="product-card-image-container"><picture>
      <img src="https://cdn.shopier.app/pictures_mid/A.jpeg" alt="Umera Curve &amp; Masa Lambası" title="Umera Curve &amp; Masa Lambası">
    </picture></div>
    <div class="product-card-body">
      <div class="product-card-badges product-card-badges-store"><span class="badge">Yeni</span></div>
      <div class="product-card-title">Umera Curve</div>
      <div class="product-card-price"><div class="price" data-price="1.499,00 TL">
        <span class="price-value">1.499</span><span class="price-currency">TL</span></div></div>
    </div>
  </a>
</div>
<div class="product-card shopier--product-card product-card-store">
  <a  href="https://www.shopier.com/UmeraDesign/51254657" data-back-id="51254657">
    <img src="https://cdn.shopier.app/pictures_mid/B.jpeg" alt="Mızmız Ördek">
    <div class="product-card-badges"><span class="badge">Tükendi</span></div>
    <div class="product-card-price"><div class="price" data-price="599,50 TL"></div></div>
  </a>
</div>`;

test('vitrin sayfasından ürünler çıkarılır', () => {
  const u = magazayiAyristir(HTML, 'UmeraDesign');
  assert.equal(u.length, 2, 'gizli placeholder kart ürün sayılmamalı');
  assert.equal(u[0].name, 'Umera Curve & Masa Lambası', 'HTML varlığı çözülmeli');
  assert.equal(u[0].price, 1499, 'binlik ayraçlı fiyat doğru okunmalı');
  assert.equal(u[0].image, 'https://cdn.shopier.app/pictures_mid/A.jpeg');
  assert.equal(u[0].shopierUrl, 'https://www.shopier.com/UmeraDesign/51324068');
  assert.equal(u[0].kaynak, 'shopier');
  assert.equal(u[0].id, 'shopier:51324068', 'Sheets UUID’leriyle çakışmasın diye önekli');
});

test('kuruşlu fiyat korunur', () => {
  const u = magazayiAyristir(HTML, 'UmeraDesign');
  assert.equal(u[1].price, 599.5, 'gösterilen tutar Shopier’de ödenenle aynı olmalı');
  assert.equal(u[1].fiyatBilinmiyor, false);
});

test('tükenen ürün stok sıfır gelir', () => {
  const u = magazayiAyristir(HTML, 'UmeraDesign');
  assert.equal(u[0].stock, 1, 'Yeni rozeti tükendi sayılmamalı');
  assert.equal(u[1].stock, 0);
});

test('bozuk ya da boş girdi çökertmez', () => {
  assert.deepEqual(magazayiAyristir('', 'UmeraDesign'), []);
  assert.deepEqual(magazayiAyristir(HTML, ''), []);
  assert.deepEqual(magazayiAyristir('<div>hiç ürün yok</div>', 'UmeraDesign'), []);
  // Şablon değişirse sessizce boş dönmeli; site kendi ürünleriyle çalışsın.
  assert.deepEqual(magazayiAyristir('<div class="urun-karti">x</div>', 'UmeraDesign'), []);
});

test('aynı ürün iki kez listelenmez', () => {
  const u = magazayiAyristir(HTML + HTML, 'UmeraDesign');
  assert.equal(u.length, 2);
});

test('adı olmayan kart atlanır', () => {
  const eksik = `<div class="product-card shopier--product-card">
    <a href="https://www.shopier.com/UmeraDesign/1"><div class="product-card-price"><div data-price="10,00 TL"></div></div></a></div>`;
  assert.deepEqual(magazayiAyristir(eksik, 'UmeraDesign'), []);
});
