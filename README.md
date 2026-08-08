# Umera Design 3D — Vercel Final

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

## Google Sheets
Kullanılacak Sheet ID:
`1tUMUbXKOVxvj0UsuvQpLJKxSGSsFjltNHzGheL8o-70`

İlk kullanımda API `Products` ve `Orders` sayfalarını ve başlıklarını otomatik oluşturur. Google Sheets'in herkese açık olması okuma için yeterli değildir; admin panelinin ürün/sipariş yazabilmesi için Google Cloud'daki service account e-posta adresini bu Sheet'e **Düzenleyici** olarak paylaşmalısın.

### Products sütunları
`id | urun | kategori | fiyat | stok | gorsel | aciklama | aktif | olusturma_tarihi`

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
```

`GOOGLE_PRIVATE_KEY` içindeki satır sonlarını Vercel'e genellikle `\\n` olarak girmek gerekir; kod bunları gerçek satır sonuna çevirir.

## Deploy
```bash
npm install
npm run build
```
Sonra GitHub repository'sini Vercel'e bağla ve Deploy et. Vercel'de yukarıdaki Environment Variables'ı ekleyip yeni deployment oluştur.

## Sipariş akışı
Müşteri ürünleri sepete ekler → sipariş popup'ında ad, telefon, e-posta, adres ve not girer → sipariş Vercel API üzerinden Google Sheets `Orders` sayfasına kaydedilir → WhatsApp varsa WhatsApp mesajı açılır, yoksa e-posta hazırlanır → müşteriye sipariş fişi gösterilir.

Not: WhatsApp ve mail uygulamasını açmak tarayıcı/cihaz davranışına bağlıdır. Siparişin yönetim kaydı API üzerinden Google Sheets'e ayrıca yazılır.


## Sipariş Yönetimi (güncel)

Admin panelindeki Sipariş Yönetimi bölümünden sipariş durumu değiştirilebilir. Durumlar Google Sheets `Orders` sayfasındaki `durum` sütununa yazılır: `Yeni`, `Onaylandı`, `Hazırlanıyor`, `Kargoya Hazır`, `Kargolandı`, `Tamamlandı`, `İptal`.

`Kargolandı + WhatsApp` veya `Tamamlandı + WhatsApp` butonu sipariş durumunu kaydeder ve müşterinin telefon numarasına göre WhatsApp Web/app üzerinde hazır mesajı açar. Tarayıcı güvenlikleri nedeniyle son `Gönder` işlemi WhatsApp tarafında kullanıcı tarafından onaylanır; bu sürüm WhatsApp Cloud API kullanmaz.

Siparişler `Orders` sayfasında şu sütunlarla tutulur: `siparis_no | tarih | musteri | telefon | email | adres | not | urunler | toplam | durum`.


## Özel Tasarım Talepleri

Özel Tasarım formu müşterinin JPG/PNG/WEBP görsellerini (en fazla 5 adet, her biri 3 MB) Vercel Blob'a yükler ve talebi Google Sheets'teki `CustomOrders` sayfasına kaydeder.

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
- Görsel dosya türleri JPG/PNG/WEBP ve dosya başına 3 MB ile sınırlandırılmıştır.

## Canlıya geçmeden önce

- Üretim ve teslimat sürelerini kendi operasyonuna göre güncelle.
- İade, iptal, kişiye özel ürün, KVKK/gizlilik ve mesafeli satış metinlerini hukuk/mali müşavir kontrolüyle ekle.
- Gerçek müşteri yorumu oluşmadan sahte yorum yayınlama.
- WhatsApp numarası ve şirket e-posta adresinin Vercel Production ortamında tanımlı olduğunu doğrula.
