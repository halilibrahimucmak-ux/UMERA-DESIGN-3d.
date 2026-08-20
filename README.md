# Umera Design 3D — Vercel Final

## 3D abajur tasarım ve sipariş akışı

- Üst menüdeki **Abajur Tasarla** bağlantısı canlı Three.js yapılandırıcısını açar.
- Müşteri hazır bir tasarımla başlar (Nordik, Fener, Origami, Sarmal, Kum Saati, Dalga), boyut/renk/malzeme seçer ve isterse **Detaylı ayarlar** ile profil, desen, nervür ve duvar kalınlığına iner.
- Duy bağlantısı kullanıcı tarafından değiştirilemez: E27 Ø41,4 mm geçme ve dört kıvrımlı taşıyıcıyla; E14 Ø28,4 mm geçme ve üç kıvrımlı taşıyıcıyla sabit üretilir.
- Sepete ekleme sırasında `/api/abajur-price` seçimi sunucuda yeniden doğrular ve fiyatı aynı geometri üzerinden hesaplar.
- Siparişin tam üretim yapılandırması Google Sheets `Orders` sayfasındaki `yapilandirma_json` sütununda saklanır.
- Yönetici panelinde her abajur için **Baskıya Hazır STL** ve **İş emri** düğmeleri görünür. Müşteri STL dosyasına hiçbir noktada erişemez.

### Geometri tek kaynaktan gelir

`lib/abajur-geometri.mjs` şeklin tek tanımıdır. Hem tarayıcıdaki konfigüratör hem de sunucudaki STL üreticisi bu dosyayı içe aktarır; aralarındaki tek fark çözünürlüktür. Geometriyi değiştirirken artık iki dosyayı elle eşitlemek gerekmiyor.

Şekli etkileyen bir değişiklik yaptığında `GEO_SURUM` sabitini artır. Sipariş farklı bir sürümle verilmişse iş emri bunu uyarı olarak gösterir.

### Baskıya hazırlık

STL üretimi Bambu X2D için hazırlanmıştır ve şunları garanti eder:

- **Kapalı (su geçirmez) ağ.** Gövde ve her montaj parçası kenar bazında doğrulanır; sonuç iş emrinde raporlanır. Dilimleyicide onarım gerekmez.
- **Gerçek yüzey normalleri.** Facet normalleri üçgen düzleminden hesaplanır, köşe normali ortalamasından değil. Sıfır alanlı üçgenler dosyaya yazılmaz.
- **Hazır yerleşim.** Model ters çevrilir (boyun ve taşıyıcılar tablaya yatar, havada köprü kalmaz), Z=0'a oturtulur ve XY'de ortalanır. Dilimleyicide taşımaya gerek yoktur.
- **Hat genişliğine oturan duvar.** Duvar kalınlığı 0,42 mm'nin tam katına yuvarlanır (2–6 duvar). Böylece dilimleyici boşluk dolgusu üretmez ve basılan et istenen ölçüyü tutar.
- **Hata payına göre çözünürlük.** Üçgen sayısı sabit değil; yüzeyin ideal eğriden sapması üretimde 0,045 mm'nin altında tutulur — 0,4 mm nozulun çok altında.

İş emri, Bambu Studio için kat yüksekliği, duvar sayısı, dolgu, brim ve destek önerilerini; ayrıca ilk kat temas alanını ve tahmini ağırlığı verir.

Yazıcı değişirse `lib/abajur-geometri.mjs` içindeki `TABLA` sabitini güncelle; tüm ölçü sınırları ve uyarılar oradan türer.


### Taşıyıcı birleşimi ve üst yaka

Üst halkada, desenin yumuşakça sıfıra indiği ~14 mm yüksekliğinde desensiz bir yaka bandı vardır.
Yaprak taşıyıcılar gövdeye burada bağlanır.

Bu bant zorunlu: yaka olmadan ayak ucu, deseni takip eden dalgalı bir yüzeye oturuyordu. Ayak ucu
12,5 mm genişliğinde olduğu için bir kenarı nervür tepesine, öbür kenarı vadisine denk geliyor ve
uç dış duvarı 1,6 mm'ye kadar delip dışarı sivri bir çıkıntı olarak çıkıyordu. Yaka sayesinde üst halka
gerçek bir daire oluyor ve ayak tüm genişliği boyunca aynı yüzeye temiz oturuyor. Klasik
abajurlarda metal "spider" fitter da düz bir halkaya bağlanır; bu bant o rolü üstlenir.

Ayak ucu ayrıca duvar kalınlığının %85'i kadar gömülür: güçlü bir kaynaşma sağlar ama dış yüzeyin
içinde kalır, yüzeyde kabartı bırakmaz.

### Vercel 4,5 MB sınırı

Vercel serverless fonksiyonlarında istek ve yanıt gövdesi 4,5 MB ile sınırlıdır. İki yönde de çözüldü:

**İndirme (STL).** Eskiden karmaşık tasarımlar 20 MB'a kadar STL üretiyordu ve indirme sessizce başarısız oluyordu. Şimdi:
- çözünürlük hata payından türetilir ve 150.000 üçgenlik bütçeye sığdırılır,
- yanıt gzip ile gönderilir (tarayıcı şeffaf biçimde açar, diske tam STL iner),
- yine de sınıra yaklaşılırsa dosya bir kez daha düşük bütçeyle üretilir.

Ölçülen en kötü durum: 6,9 MB STL → **2,5 MB** ağ üzerinde.

**Yükleme (görseller).** Fotoğraflar `src/lib/gorsel.js` ile gönderilmeden önce tarayıcıda uzun kenarı 2000 px'e indirilip WebP'ye çevrilir; EXIF dönüşü uygulanır. 12 MP telefon fotoğrafı tipik olarak 200–500 KB'a iner, yani gövde sınıra hiç yaklaşmaz. Müşteri artık dosya boyutuyla uğraşmaz. Sunucudaki 3 MB kontrolü ikinci savunma hattı olarak durur.

### Testler

```bash
npm test
```

Geometri testleri kapalı ağ, analitik hacim doğrulaması, kiriş hatası, duvar yuvarlaması, STL ikili biçimi, tabla yerleşimi ve sıkıştırılmış dosya boyutunu kontrol eder.

### Orders sütunları

`siparis_no | tarih | musteri | telefon | email | adres | not | urunler | toplam | durum | yapilandirma_json`

> Mevcut `Orders` sayfasında yeni K sütunu ve başlığı uygulama tarafından otomatik olarak eklenir.

Bu sürüm SQL/PostgreSQL veya müşteri üyeliği kullanmaz. Ürün ve sipariş verileri Google Sheets'te tutulur; görseller Vercel Blob'a yüklenir. Frontend ve API aynı Vercel projesindedir.

## Özellikler
- Umera logosu optimize edilmiş `/public/logo-hero.webp` ve `/public/logo-mark.webp` dosyalarıyla kullanılır.
- Müşteri admin panelini görmez.
- Logo 3 saniye içinde 5 kez tıklanınca gizli admin giriş ekranı açılır.
- Admin oturumu HttpOnly + Secure cookie içinde 8 saatlik JWT ile korunur.
- Admin parolası yalnızca bcrypt hash olarak environment variable'da tutulur.
- Admin ürün ekler, düzenler, siler; stok/fiyat/kategori/açıklama değiştirir.
- Admin panelinden görsel yüklenir ve Vercel Blob URL'si Google Sheets'e yazılır.
- Ürünler Google Sheets `Products` sayfasından okunur.
- Siparişler Google Sheets `Orders` sayfasına kaydedilir.
- Dashboard toplam ürün, toplam sipariş, aylık sipariş, toplam ciro ve bekleyen sipariş gösterir.
- Sipariş müşterinin seçtiği WhatsApp veya e-posta kanalına fiş formatında gönderilir.
- Müşteri üyeliği ve SQL yoktur.
- Ana sayfada güven şeridi, öne çıkan ürünler, özel tasarım süreci ve sık sorulan sorular bulunur.
- Ürün kartlarında üretim süresi, siparişe göre üretim ve ürün detay ekranı gösterilir.
- Sipariş API tarafında ürün fiyatı ve stok yeniden kontrol edilir; istemciden gönderilen fiyat doğrudan kabul edilmez.
- Sipariş, özel talep, görsel yükleme ve admin girişinde temel hız sınırlaması bulunur.

## Havale / EFT ile ödeme

Müşteri siparişi verdikten sonra sipariş fişinde banka, alıcı adı, IBAN, tutar ve
**açıklamaya yazılacak sipariş numarası** görünür; her biri tek tıkla kopyalanır.
Ödemeyi siparişle eşleştirmenin tek yolu açıklamadaki sipariş numarasıdır.

Ortam değişkenleri (IBAN'ı koda veya depoya koyma):

```text
ODEME_IBAN=TR...
ODEME_ALICI=Hesap sahibinin tam adı
ODEME_BANKA=Banka adı
```

`ODEME_ALICI`, müşterinin havale ekranında göreceği isimle birebir aynı olmalı; farklı bir
isim güveni zedeler ve ödemenin iptaline yol açabilir.

IBAN, ISO 7064 mod-97 sağlamasından geçirilir. Sağlama tutmazsa ödeme kartı müşteriye
**gösterilmez** ve yönetici panelinde kırmızı uyarı çıkar — yanlış hesaba para gitmesini
önlemek için.

### Sipariş durumları

`Yeni | Ödeme Bekleniyor | Ödeme Alındı | Onaylandı | Hazırlanıyor | Kargoya Hazır | Kargolandı | Tamamlandı | İptal`

- **Ödeme Bekleniyor** seçildiğinde müşteriye giden bildirim IBAN'ı da içerir (e-postada
  ödeme kartı olarak, WhatsApp'ta metin olarak).
- **Ödeme Alındı** seçildiğinde müşteri ödemenin ulaştığını öğrenir.
- Sipariş listesinde ödeme bekleyen satırlarda **Ödeme bilgisi gönder** düğmesi çıkar; müşterinin
  WhatsApp'ına IBAN, tutar ve sipariş numarasını hazır mesaj olarak açar.
- Dashboard'da **Bekleyen Tahsilat** toplamı görünür.

> WhatsApp Business Cloud API şablonları serbest metin kabul etmez; onaylı şablon yalnızca
> durum adını taşır. IBAN'ın otomatik WhatsApp mesajında da geçmesini istiyorsan ödeme için
> ayrı bir şablon onaylatman gerekir. Resend ile giden e-posta IBAN'ı zaten içerir.

## Site altındaki hukuki metinler

Site altında dört belge bulunur: Mesafeli Satış Sözleşmesi, Cayma Hakkı / İptal ve İade
Koşulları, KVKK Aydınlatma Metni, Teslimat ve Kargo. Metinler `src/lib/hukuk.js` içindedir;
sipariş formundaki onay kutusu bunlara bağlıdır.

> **Bu metinler taslaktır.** Standart yapıda hazırlanmıştır ama yayına almadan önce bir
> avukat ve mali müşavir kontrolünden geçirilmeli, işletmenin gerçek süreçleriyle (teslim
> süresi, kargo firması, iade adresi) uyumlu hale getirilmelidir. Eksik veya yanlış
> bilgilendirme 6502 sayılı Kanun kapsamında idari yaptırım doğurabilir.

Havale ile satışta müşteri ürünü görmeden ödeme yaptığı için iki nokta özellikle önemli:

- **Kişiye özel üretimde cayma hakkı.** Mesafeli Sözleşmeler Yönetmeliği m.15/1-(b) uyarınca
  tüketicinin istekleri doğrultusunda hazırlanan mallar cayma hakkı kapsamı dışındadır. Bu
  istisna hem iade metninde hem de sipariş formunda müşteriye açıkça gösterilir; sipariş
  öncesi bilgilendirme yapılmazsa istisnaya dayanılamaz.
- **Üretim başlamadan ücretsiz iptal.** Metinler, ödeme alınmış ama üretim başlamamış
  siparişlerde ücretsiz iptal ve 14 gün içinde iade taahhüdü içerir.

Firma bilgileri ortam değişkenlerinden gelir:

```text
VITE_FIRMA_UNVAN=Firma Unvanı
VITE_FIRMA_ADRES=Tam adres
VITE_FIRMA_VERGI=Vergi Dairesi / 1234567890
VITE_FIRMA_MERSIS=
VITE_FIRMA_TEL=+90 5XX XXX XX XX
VITE_TESLIM_GUN=2-5 iş günü
```

Eksik bırakılırsa metinlerde köşeli parantezli yer tutucular görünür ve yönetici panelinde
kırmızı uyarı çıkar. `VITE_` önekli değişkenler derleme anında paket içine gömüldüğü için
değiştirdikten sonra yeniden dağıtım gerekir.

## Ürün görselleri ve renk seçenekleri

Bir ürüne en fazla 12 görsel eklenebilir ve her görsele bir **renk/varyant etiketi**
verilebilir ("Kemik Beyazı", "Terrakota"…). İlk sıradaki görsel kapaktır.

Yönetici panelinde dosya seçiciden birden fazla fotoğraf aynı anda seçilebilir. Yüklenen
her görsel için etiket kutusu, sıralama okları (← →) ve sil düğmesi çıkar; kapak, oklarla
sıra değiştirilerek belirlenir.

Müşteri tarafında:

- Ürün kartında birden fazla görsel varsa **"N seçenek"** rozeti görünür.
- Ürün detayında büyük görselin altında etiketli küçük görsel şeridi olur.
- Görsele tıklanınca tam ekran açılır; ok tuşları ve ekrandaki oklarla gezilir, altta
  sayaç ve küçük görsel şeridi bulunur.

### Veri saklama

`Products` sayfasına **`gorseller`** (J) sütunu eklendi; `[{url, etiket}]` biçiminde JSON
tutar. Sütun uygulama tarafından otomatik oluşturulur.

Eski `gorsel` (F) sütunu kapak görseli olarak yazılmaya devam eder. Yalnızca `gorsel`
dolu olan eski kayıtlar tek görselli ürün gibi sorunsuz çalışır — geriye dönük uyum
için `gorseller` boşsa `gorsel` alanına düşülür.

Görseller yüklenmeden önce tarayıcıda küçültülüp WebP'ye çevrilir (bkz. Vercel 4,5 MB
sınırı), yani 12 görsellik bir ürün bile toplamda birkaç MB yer kaplar.

## Google Sheets
Kullanılacak Sheet ID:
`1tUMUbXKOVxvj0UsuvQpLJKxSGSsFjltNHzGheL8o-70`

İlk kullanımda API `Products` ve `Orders` sayfalarını ve başlıklarını otomatik oluşturur. Google Sheets'in herkese açık olması okuma için yeterli değildir; admin panelinin ürün/sipariş yazabilmesi için Google Cloud'daki service account e-posta adresini bu Sheet'e **Düzenleyici** olarak paylaşmalısın.

### Products sütunları
`id | urun | kategori | fiyat | stok | gorsel | aciklama | aktif | olusturma_tarihi | gorseller`

### Orders sütunları
`siparis_no | tarih | musteri | telefon | email | adres | not | urunler | toplam | durum`

## Google service account
1. Google Cloud Console'da bir proje oluştur.
2. Google Sheets API'yi etkinleştir.
3. Service Account oluştur.
4. JSON anahtarını indir.
5. JSON içindeki `client_email` ve `private_key` değerlerini Vercel Environment Variables'a koy.
6. Service account e-posta adresini Google Sheet'te Düzenleyici olarak paylaş.

## Vercel Blob
Vercel dashboard'da **Public Blob Store** oluştur. Bu projede önerilen değişken `UMERA_PUBLIC_READ_WRITE_TOKEN` değeridir. Admin ürün görselleri ve müşteri özel tasarım görselleri bu store'a yüklenir.

## Admin şifresi
Plaintext şifreyi GitHub'a veya kodun içine koyma.

Yerelde:
```bash
npm install
npm run hash-password -- "GucluBirSifreBuraya"
```
Çıkan bcrypt hash'i Vercel'de `ADMIN_PASSWORD_HASH` olarak kaydet.

Ayrıca:
- `ADMIN_USERNAME`
- `JWT_SECRET` (en az 32 karakter, rastgele)

## Vercel Environment Variables
```text
GOOGLE_SHEET_ID=1tUMUbXKOVxvj0UsuvQpLJKxSGSsFjltNHzGheL8o-70
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=...
JWT_SECRET=...
UMERA_PUBLIC_STORE_ID=...
UMERA_PUBLIC_READ_WRITE_TOKEN=...
VITE_WHATSAPP_NUMBER=905XXXXXXXXX
VITE_COMPANY_EMAIL=siparis@umeradesign3d.com
VITE_SITE_OPEN=true
```

`VITE_SITE_OPEN` varsayılan olarak açıktır. Bakım ekranını göstermek istersen Vercel'de bu değeri `false` yap.

`GOOGLE_PRIVATE_KEY` içindeki satır sonlarını Vercel'e genellikle `\\n` olarak girmek gerekir; kod bunları gerçek satır sonuna çevirir.

## Deploy
```bash
npm install
npm run build
```
Sonra GitHub repository'sini Vercel'e bağla ve Deploy et. Vercel'de yukarıdaki Environment Variables'ı ekleyip yeni deployment oluştur.

## Sipariş akışı
Müşteri ürünleri sepete ekler → sipariş formunda ad, telefon, e-posta, adres ve not girer → sipariş Vercel API üzerinden Google Sheets `Orders` sayfasına kaydedilir → **sipariş fişi ve ödeme bilgileri gösterilir** → müşteri isterse WhatsApp veya e-posta ile bildirim gönderir.

Yönlendirme kendiliğinden yapılmaz. Eskiden sipariş sonrası WhatsApp otomatik açılıyordu; fiş arkada kalıyor ve müşteri IBAN'ı hiç görmeden gidebiliyordu. Ayrıca `window.open` bir `await` sonrası çağrıldığı için mobil tarayıcılar bunu pop-up olarak engelleyebiliyordu. Şimdi ödeme bilgisi dört ayrı yerde duruyor: fiş ekranı, WhatsApp mesajının içi (müşterinin kendi sohbet geçmişinde kalır), `localStorage` (sayfa üstündeki şeritten 21 gün geri çağrılabilir) ve satıcının panelindeki `Ödeme bilgisi gönder` düğmesi.

Not: Sipariş, müşteri hiçbir bildirim göndermese bile Google Sheets'e kaydedilir; WhatsApp/e-posta yalnızca kolaylıktır.


## Sipariş Yönetimi (güncel)

Admin panelindeki Sipariş Yönetimi bölümünden sipariş durumu değiştirilebilir. Durumlar Google Sheets `Orders` sayfasındaki `durum` sütununa yazılır: `Yeni`, `Onaylandı`, `Hazırlanıyor`, `Kargoya Hazır`, `Kargolandı`, `Tamamlandı`, `İptal`.

Sipariş durumu `Onaylandı`, `Hazırlanıyor`, `Kargoya Hazır`, `Kargolandı`, `Tamamlandı` veya `İptal` olarak değiştirildiğinde müşteri bildirimi otomatik tetiklenir. WhatsApp Business Cloud API ve/veya Resend ayarlıysa mesaj doğrudan gönderilir. Hiçbir otomatik kanal ayarlı değilse admin ekranı müşterinin numarası için hazır WhatsApp mesajını açar; son `Gönder` işlemi kullanıcı tarafından onaylanır. Aynı durum yeniden seçilirse yinelenen bildirim gönderilmez.

### Otomatik durum bildirimi

Resend ile e-posta göndermek için Vercel ortam değişkenlerine `RESEND_API_KEY` ve doğrulanmış alan adını kullanan `ORDER_NOTIFICATION_FROM` ekleyin.

WhatsApp Business Cloud API ile otomatik mesaj göndermek için `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_STATUS_TEMPLATE_NAME`, `WHATSAPP_STATUS_TEMPLATE_LANGUAGE` ve isteğe bağlı `WHATSAPP_GRAPH_VERSION` değerlerini ekleyin. Onaylı şablonun gövdesindeki değişkenler sırasıyla müşteri adı (`{{1}}`), sipariş numarası (`{{2}}`) ve durum (`{{3}}`) olmalıdır. Örnek: `Merhaba {{1}}, {{2}} numaralı siparişinizin durumu {{3}} olarak güncellendi.`

Siparişler `Orders` sayfasında şu sütunlarla tutulur: `siparis_no | tarih | musteri | telefon | email | adres | not | urunler | toplam | durum | yapilandirma_json`.


## Özel Tasarım Talepleri

Özel Tasarım formu müşterinin JPG/PNG/WEBP görsellerini (en fazla 5 adet) Vercel Blob'a yükler. Görseller gönderilmeden önce tarayıcıda küçültülür, bu yüzden müşteri için dosya boyutu sınırı yoktur ve talebi Google Sheets'teki `CustomOrders` sayfasına kaydeder.

`CustomOrders` sütunları:
`talep_no | tarih | musteri | telefon | email | aciklama | olcu | renk | adet | gorseller | durum | teklif | not`

Durumlar:
`Yeni | İnceleniyor | Fiyat Verildi | Onaylandı | Üretimde | Tamamlandı | İptal`

Admin panelinde özel tasarım talepleri görüntülenebilir, fotoğraflar açılabilir, durum ve teklif değiştirilebilir ve müşteriye WhatsApp bilgilendirmesi hazırlanabilir.

Gerekli Vercel Blob değişkenleri:
`UMERA_PUBLIC_STORE_ID` ve `UMERA_PUBLIC_READ_WRITE_TOKEN`.

## Bu sürümde yapılan vitrin ve satış geliştirmeleri

- Hero alanındaki `3D` rozeti logodan ayrıldı; logo metniyle üst üste binmez.
- Hero alanı kısaltıldı ve ziyaretçinin ürünlere daha hızlı ulaşması sağlandı.
- “Çok Tercih Edilenler” bölümü eklendi.
- Ürün detay popup'ı, tahmini üretim süresi, malzeme/renk ve paketleme bilgileri eklendi.
- Özel tasarım süreci 4 adım halinde açıklandı.
- Güven şeridi, sabit WhatsApp iletişim butonu ve SSS bölümü eklendi.
- Admin butonu yalnızca doğrulanmış admin oturumunda görünür; ziyaretçilerde görünmez.
- Sipariş kaydı başarısız olursa WhatsApp/e-posta açılmaz ve sepet silinmez.
- Google Sheets formül enjeksiyonuna karşı müşteri metinleri güvenli hücre metnine çevrilir.
- Görsel dosya türleri JPG/PNG/WEBP ile sınırlıdır; büyük fotoğraflar yüklenmeden önce tarayıcıda küçültülür.

## Canlıya geçmeden önce

- Üretim ve teslimat sürelerini kendi operasyonuna göre güncelle.
- İade, iptal, kişiye özel ürün, KVKK/gizlilik ve mesafeli satış metinlerini hukuk/mali müşavir kontrolüyle ekle.
- Gerçek müşteri yorumu oluşmadan sahte yorum yayınlama.
- WhatsApp numarası ve şirket e-posta adresinin Vercel Production ortamında tanımlı olduğunu doğrula.

## Bu sürümde yapılan teknik iyileştirmeler

- Geometri tek modüle (`lib/abajur-geometri.mjs`) taşındı; konfigüratör ile üretici arasındaki kopya kod ve sessizce ayrışma riski ortadan kalktı.
- STL çözünürlüğü sabit sayılar yerine ölçülen kiriş hatasından türetiliyor. Tipik tasarımlarda dosya 2,5 MB'tan 0,4–0,9 MB'a indi, en karmaşık tasarımda 20 MB'tan 6,9 MB'a.
- STL facet normalleri gerçek üçgen düzleminden hesaplanıyor; dejenere üçgenler eleniyor.
- Ağ kapalılığı (watertight) her üretimde doğrulanıp iş emrinde raporlanıyor.
- Duvar kalınlığı ekstrüzyon hattının tam katına oturuyor.
- Hacim ve ağırlık hesabı analitik integralle doğrulandı. Not: önceki sürüm ağırlığı olduğundan düşük bildiriyordu; fiyatlar buna bağlı olarak bir miktar yükselir.
- Fiyat hesabı artık tam STL üretmiyor; `/api/abajur-price` yanıtı milisaniyeler içinde dönüyor.
- Konfigüratör hazır tasarım şablonları, boyut ön ayarları ve basit/detaylı mod ile yeniden kurgulandı.
- Sahne gerçek bir sarkıt olarak kuruluyor: kablo, tavan rozeti, zemin, temas gölgesi, bloom ve AgX ton eşleme. Duvardan geçen ışık Beer-Lambert sönümlemesiyle hesaplandığı için nervür tepeleri parlıyor, yan yüzler kararıyor.
- `alert()` yerine biriken bildirimler; sepet `localStorage`'da kalıcı.
- Konfigüratör ayrı pakete alındı: ana paket 767 KB'tan 241 KB'a (gzip 76 KB) indi.
- Katalogda yükleme iskeletleri, ağ hatalarında anlaşılır mesajlar.
- Yönetici panelinde her tasarım için Bambu Studio ayarlarını gösteren **İş emri** ekranı.
