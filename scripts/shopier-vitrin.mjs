/**
 * Shopier vitrinini depoya gömülü kataloğa çevirir.
 *
 * Neden gerekiyor: Shopier bu hesapta ürün API'sini 403 ile reddediyor ve
 * vitrin sayfası da Cloudflare arkasında veri merkezi IP'lerini engelliyor —
 * Vercel'den (iad1 ve fra1 denendi) 403 dönüyor, normal bir bilgisayardan
 * 200 dönüyor. Bu yüzden ürünler elle çalıştırılan bu betikle alınıp
 * depoya yazılıyor.
 *
 * Kullanım:  npm run shopier:yenile
 * Sonra üretilen dosyayı commit'leyip push'la.
 *
 * Sunucu her istekte önce API'yi, sonra vitrini deniyor; ikisi de
 * çalışmazsa buradaki anlık görüntüyü kullanıyor. Shopier erişimi açtığında
 * bu dosya kendiliğinden devre dışı kalır.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { magazayiAyristir, magazaAdi } from '../lib/shopier-magaza.js';

const kok = path.dirname(fileURLToPath(import.meta.url));
const hedef = path.join(kok, '..', 'data', 'shopier-vitrin.js');

const magaza = magazaAdi();
const adres = `https://www.shopier.com/${magaza}`;

const yanit = await fetch(adres, {
  headers: {
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'tr-TR,tr;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  },
});
if (!yanit.ok) {
  console.error(`Vitrin okunamadi: HTTP ${yanit.status}. Bu bilgisayardan shopier.com aciliyor mu?`);
  process.exit(1);
}

const urunler = magazayiAyristir(await yanit.text(), magaza);
if (!urunler.length) {
  console.error('Sayfa alindi ama hic urun cikarilamadi. Shopier vitrin sablonu degismis olabilir.');
  process.exit(1);
}

const govde = `/* ÜRETİLMİŞ DOSYA — elle düzenleme; \`npm run shopier:yenile\` ile yenile.
   Kaynak: ${adres}
   Alındığı an: ${new Date().toISOString()}

   Shopier ürün API'si bu hesapta 403 veriyor ve vitrin sayfası Vercel'in
   IP'lerini engelliyor; bu yüzden katalog buradaki anlık görüntüden
   besleniyor. Fiyat değişirse bu dosyayı yenile — müşteri ödemeyi
   Shopier'de yaptığı için tahsil edilen tutar her hâlükârda Shopier'deki
   güncel fiyattır. */
export const GUNCELLEME = ${JSON.stringify(new Date().toISOString())};
export const VITRIN = ${JSON.stringify(urunler, null, 2)};
`;

fs.writeFileSync(hedef, govde);
console.log(`${urunler.length} urun yazildi -> ${path.relative(process.cwd(), hedef)}`);
for (const u of urunler) console.log(`  ${String(u.price).padStart(6)} TL  ${u.name}`);
