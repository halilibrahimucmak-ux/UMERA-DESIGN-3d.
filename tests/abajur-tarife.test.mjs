import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VARSAYILAN_TARIFE, tarifeBirlestir, kaydedilecekAlanlar, tarifeAlaniDogrula, tarifeOku
} from '../lib/abajur-tarife.js';
import { quoteAbajur } from '../lib/abajur.js';

test('kaydedilmiş değerler varsayılanın üzerine biner', () => {
  const t = tarifeBirlestir({ kar: 30, 'filament.PLA': 900, 'duy.E27': 200 });
  assert.equal(t.kar, 30);
  assert.equal(t.filament.PLA, 900);
  assert.equal(t.duy.E27, 200);
  // dokunulmayanlar varsayılanda kalır
  assert.equal(t.kdv, VARSAYILAN_TARIFE.kdv);
  assert.equal(t.filament.PETG, VARSAYILAN_TARIFE.filament.PETG);
  assert.equal(t.duy.E14, VARSAYILAN_TARIFE.duy.E14);
});

test('bozuk kayıt fiyatlandırmayı durdurmaz, alan varsayılanda kalır', () => {
  const t = tarifeBirlestir({ kar: 'abc', akisMm3s: null, bilinmeyenAlan: 5 });
  assert.equal(t.kar, VARSAYILAN_TARIFE.kar);
  assert.equal(t.akisMm3s, VARSAYILAN_TARIFE.akisMm3s);
  assert.equal(t.bilinmeyenAlan, undefined, 'bilinmeyen alan tarifeye sızmamalı');
  assert.ok(quoteAbajur({}, t).birim > 0);
});

test('uçuk değerler güvenli aralığa sıkıştırılır', () => {
  // akış sıfır olsaydı süre sonsuza giderdi
  assert.equal(tarifeBirlestir({ akisMm3s: 0 }).akisMm3s, 0.5);
  assert.equal(tarifeBirlestir({ akisMm3s: 9999 }).akisMm3s, 60);
  assert.equal(tarifeBirlestir({ kdv: 500 }).kdv, 100);
  assert.equal(tarifeBirlestir({ kar: -20 }).kar, 0);
});

test('virgüllü yazım kabul edilir', () => {
  assert.equal(tarifeAlaniDogrula('akisMm3s', '6,5').deger, 6.5);
  assert.equal(tarifeBirlestir({ akisMm3s: '8,2' }).akisMm3s, 8.2);
});

test('akış arttıkça fiyat düşer', () => {
  const yavas = quoteAbajur({}, tarifeBirlestir({ akisMm3s: 4 }));
  const hizli = quoteAbajur({}, tarifeBirlestir({ akisMm3s: 10 }));
  assert.ok(hizli.birim < yavas.birim, 'akış artınca fiyat düşmeliydi');
  assert.ok(hizli.sureSaat < yavas.sureSaat);
  // hacim aynı kalmalı — yalnızca süre varsayımı değişti
  assert.equal(hizli.gram, yavas.gram);
});

test('kaydedilecek alanlar doğrulanır', () => {
  const alanlar = kaydedilecekAlanlar({ kar: '35', 'filament.PLA': 820 });
  assert.deepEqual(alanlar, { kar: 35, 'filament.PLA': 820 });

  assert.throws(() => kaydedilecekAlanlar({ bilinmeyen: 5 }), /GECERSIZ_ALAN/);
  assert.throws(() => kaydedilecekAlanlar({ kar: 'abc' }), /GECERSIZ_DEGER/);
  assert.throws(() => kaydedilecekAlanlar({}), /GECERSIZ_DEGER/);
});

test('kaydedilecek alanlar da aralığa sıkıştırılır', () => {
  assert.deepEqual(kaydedilecekAlanlar({ akisMm3s: 0 }), { akisMm3s: 0.5 });
  assert.deepEqual(kaydedilecekAlanlar({ kdv: 999 }), { kdv: 100 });
});

test('tarifeOku iç içe alanları düz anahtarla verir', () => {
  const t = tarifeBirlestir({});
  assert.equal(tarifeOku(t, 'kar'), VARSAYILAN_TARIFE.kar);
  assert.equal(tarifeOku(t, 'filament.PLA'), VARSAYILAN_TARIFE.filament.PLA);
  assert.equal(tarifeOku(t, 'duy.E14'), VARSAYILAN_TARIFE.duy.E14);
});

test('tarife verilmezse varsayılanla aynı sonucu verir', () => {
  assert.equal(quoteAbajur({}).birim, quoteAbajur({}, tarifeBirlestir({})).birim);
});
