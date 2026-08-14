/**
 * Site altındaki hukuki metinler.
 *
 * ÖNEMLİ: Bu metinler standart yapıda hazırlanmış TASLAKLARDIR. Yayına
 * almadan önce bir avukat ve mali müşavir kontrolünden geçirilmeli;
 * işletmenin gerçek süreçleriyle (teslim süresi, kargo firması, iade
 * adresi) uyumlu hale getirilmeli. Yanlış veya eksik bilgilendirme,
 * 6502 sayılı Kanun kapsamında idari yaptırım doğurabilir.
 *
 * Firma bilgileri koda değil ortam değişkenlerine yazılır; eksik
 * bırakılırsa metinlerde köşeli parantezli yer tutucular görünür ve
 * yönetici panelinde uyarı çıkar.
 */

const YER_TUTUCU = /\[[A-ZÇĞİÖŞÜ ]+\]/;

export function firmaBilgisi() {
  const al = (anahtar, yedek) => {
    const deger = String(import.meta.env[anahtar] || '').trim();
    return deger || yedek;
  };
  return {
    unvan: al('VITE_FIRMA_UNVAN', '[FİRMA UNVANI]'),
    adres: al('VITE_FIRMA_ADRES', '[FİRMA ADRESİ]'),
    vergi: al('VITE_FIRMA_VERGI', '[VERGİ DAİRESİ VE NUMARASI]'),
    mersis: al('VITE_FIRMA_MERSIS', ''),
    telefon: al('VITE_FIRMA_TEL', '[TELEFON]'),
    eposta: al('VITE_COMPANY_EMAIL', 'siparis@umeradesign3d.com'),
    iadeAdresi: al('VITE_FIRMA_IADE_ADRES', ''),
    teslimGun: al('VITE_TESLIM_GUN', '2-5 iş günü'),
  };
}

/** Metinlerde doldurulmamış yer tutucu kaldı mı? */
export function eksikBilgiVar(firma = firmaBilgisi()) {
  return Object.values(firma).some(deger => YER_TUTUCU.test(String(deger)));
}

export function hukukMetinleri(firma = firmaBilgisi()) {
  const satici = [
    `Unvan: ${firma.unvan}`,
    `Adres: ${firma.adres}`,
    `Vergi dairesi / numarası: ${firma.vergi}`,
    firma.mersis ? `MERSİS: ${firma.mersis}` : '',
    `Telefon: ${firma.telefon}`,
    `E-posta: ${firma.eposta}`,
  ].filter(Boolean);

  return [
    {
      id: 'mesafeli',
      baslik: 'Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme',
      bolumler: [
        {
          baslik: 'Satıcı bilgileri',
          maddeler: satici,
        },
        {
          baslik: 'Sözleşmenin konusu',
          paragraf:
            'Bu sözleşme, alıcının satıcıya ait internet sitesi üzerinden elektronik ortamda ' +
            'siparişini verdiği, aşağıda nitelikleri ve satış fiyatı belirtilen ürünün satışı ve ' +
            'teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve ' +
            'Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve ' +
            'yükümlülüklerini düzenler.',
        },
        {
          baslik: 'Ürün ve fiyat',
          paragraf:
            'Ürünün türü, miktarı, marka/modeli, rengi, ölçüleri ve satış bedeli, sipariş ' +
            'onaylandığı andaki haliyle sipariş fişinde ve sipariş kaydında yer alır. Listelenen ' +
            'fiyatlar KDV dahildir. Kişiye özel tasarlanan ürünlerde fiyat, müşterinin seçtiği ' +
            'ölçü, malzeme ve donanıma göre sipariş anında hesaplanır.',
        },
        {
          baslik: 'Ödeme',
          paragraf:
            'Ödeme, sipariş sonrasında müşteriye bildirilen banka hesabına havale/EFT yoluyla ' +
            'yapılır. Havale açıklamasına sipariş numarasının yazılması gerekir; ödeme, sipariş ' +
            'ile bu numara üzerinden eşleştirilir. Ödeme satıcı hesabına geçmeden üretim ' +
            'başlatılmaz. Sipariş tarihinden itibaren 7 gün içinde ödemesi yapılmayan siparişler ' +
            'satıcı tarafından iptal edilebilir.',
        },
        {
          baslik: 'Teslimat',
          paragraf:
            `Ürün, ödemenin satıcı hesabına geçmesinin ardından ${firma.teslimGun} içinde üretilerek ` +
            'kargoya verilir. Kişiye özel üretim ve yoğunluk durumlarında bu süre uzayabilir; ' +
            'böyle bir durumda müşteri bilgilendirilir. Kargo süresi bu sürelere dahil değildir. ' +
            'Teslimat, siparişte belirtilen adrese yapılır.',
        },
        {
          baslik: 'Yürürlük',
          paragraf:
            'Müşteri, sipariş formunu onaylamakla bu sözleşmenin tüm koşullarını ve ön ' +
            'bilgilendirmeyi okuduğunu, anladığını ve kabul ettiğini beyan eder. Uyuşmazlıklarda ' +
            'Ticaret Bakanlığınca ilan edilen parasal sınırlar dahilinde Tüketici Hakem Heyetleri ' +
            've Tüketici Mahkemeleri yetkilidir.',
        },
      ],
    },

    {
      id: 'iade',
      baslik: 'Cayma Hakkı, İptal ve İade Koşulları',
      bolumler: [
        {
          baslik: 'Kişiye özel üretim ürünlerde cayma hakkı',
          vurgu: true,
          paragraf:
            'Abajur tasarım stüdyosunda oluşturulan ürünler ile özel tasarım talepleri, ' +
            'müşterinin seçtiği ölçü, form, desen, renk ve donanıma göre yalnızca o sipariş için ' +
            'üretilir; stokta bulunmaz ve başka bir müşteriye satılamaz. Mesafeli Sözleşmeler ' +
            'Yönetmeliği’nin 15/1-(b) maddesi uyarınca, tüketicinin istekleri veya kişisel ' +
            'ihtiyaçları doğrultusunda hazırlanan mallar cayma hakkı kapsamı dışındadır. ' +
            'Bu nedenle üretime başlanmış kişiye özel siparişlerde cayma hakkı kullanılamaz.',
        },
        {
          baslik: 'Üretime başlanmadan iptal',
          paragraf:
            'Siparişin durumu “Ödeme Alındı” aşamasına geçmiş ancak üretim henüz başlamamışsa, ' +
            'müşteri siparişini ücretsiz iptal edebilir ve ödediği tutar 14 gün içinde aynı ' +
            'hesaba iade edilir. İptal talebi, sipariş numarasıyla birlikte WhatsApp veya ' +
            'e-posta yoluyla iletilmelidir.',
        },
        {
          baslik: 'Stoktan satılan ürünlerde cayma hakkı',
          paragraf:
            'Katalogdan satılan, kişiselleştirilmemiş ürünlerde tüketici, teslim tarihinden ' +
            'itibaren 14 gün içinde gerekçe göstermeksizin cayma hakkını kullanabilir. Ürünün ' +
            'kutusu, ambalajı ve varsa standart aksesuarları eksiksiz ve hasarsız olmalıdır. ' +
            'İade kargo bedeli, cayma hakkının kullanıldığı hallerde tüketiciye aittir. Bedel, ' +
            'ürün satıcıya ulaştıktan sonra 14 gün içinde iade edilir.',
        },
        {
          baslik: 'Ayıplı, hasarlı veya hatalı ürün',
          paragraf:
            'Ürün kırık, eksik, hatalı üretilmiş veya siparişten farklı geldiyse, teslim ' +
            'tarihinden itibaren 7 gün içinde fotoğrafla birlikte bildirilmesi halinde ürün ' +
            'ücretsiz olarak yenilenir veya bedeli iade edilir. Bu durumda kargo bedeli ' +
            'satıcıya aittir. Kargo kaynaklı hasarlarda, teslim alırken kargo görevlisine ' +
            'tutanak tutturulması süreci hızlandırır.',
        },
        {
          baslik: 'Ürünün doğası',
          paragraf:
            'Ürünler 3D baskı yöntemiyle katman katman üretilir. Yüzeyde ince katman izleri ' +
            'bulunması üretim yönteminin doğal sonucudur ve ayıp sayılmaz. Ekranda görülen renk ' +
            'ile gerçek renk arasında, ekran kalibrasyonuna bağlı farklar olabilir.',
        },
      ],
    },

    {
      id: 'kvkk',
      baslik: 'Gizlilik ve KVKK Aydınlatma Metni',
      bolumler: [
        {
          baslik: 'Veri sorumlusu',
          paragraf:
            `6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu ` +
            `${firma.unvan}’dir. İletişim: ${firma.eposta}`,
        },
        {
          baslik: 'İşlenen veriler ve amacı',
          maddeler: [
            'Ad soyad, telefon, e-posta ve teslimat adresi — siparişin oluşturulması, üretilmesi, teslim edilmesi ve sipariş hakkında bilgilendirme yapılması amacıyla.',
            'Sipariş içeriği ve tasarım yapılandırması — ürünün üretilebilmesi ve satış sonrası destek verilebilmesi amacıyla.',
            'Özel tasarım talebiyle gönderilen görseller ve açıklamalar — talebin değerlendirilmesi ve fiyatlandırılması amacıyla.',
            'Ödeme açıklamasındaki sipariş numarası — ödemenin siparişle eşleştirilmesi amacıyla. Kart bilgisi toplanmaz ve saklanmaz.',
          ],
        },
        {
          baslik: 'Hukuki sebep ve aktarım',
          paragraf:
            'Veriler, sözleşmenin kurulması ve ifası ile satıcının hukuki yükümlülüklerini ' +
            'yerine getirmesi hukuki sebeplerine dayanılarak işlenir. Veriler; siparişin ' +
            'teslimi için kargo firmasıyla, bildirim gönderimi için mesajlaşma ve e-posta ' +
            'servis sağlayıcılarıyla, kayıtların tutulması için bulut hizmet sağlayıcılarıyla ' +
            'sınırlı olarak paylaşılır. Pazarlama amacıyla üçüncü kişilere satılmaz veya ' +
            'devredilmez.',
        },
        {
          baslik: 'Saklama süresi',
          paragraf:
            'Sipariş ve fatura kayıtları, ilgili mevzuatta öngörülen yasal saklama süreleri ' +
            'boyunca; özel tasarım görselleri, talep sonuçlandıktan sonra makul bir süre ' +
            'saklanır ve ardından silinir.',
        },
        {
          baslik: 'Haklarınız',
          paragraf:
            'KVKK’nın 11. maddesi uyarınca kişisel verilerinize erişme, düzeltilmesini veya ' +
            `silinmesini isteme ve işlemeye itiraz etme haklarına sahipsiniz. Taleplerinizi ` +
            `${firma.eposta} adresine iletebilirsiniz.`,
        },
        {
          baslik: 'Çerezler',
          paragraf:
            'Sitede reklam veya takip çerezi kullanılmaz. Sepetiniz, sayfayı yenilediğinizde ' +
            'kaybolmaması için yalnızca kendi tarayıcınızda saklanır ve sunucuya gönderilmez.',
        },
      ],
    },

    {
      id: 'teslimat',
      baslik: 'Teslimat ve Kargo',
      bolumler: [
        {
          baslik: 'Üretim ve gönderim süresi',
          paragraf:
            `Ödemenin hesaba geçmesinin ardından ürün ${firma.teslimGun} içinde üretilip kargoya ` +
            'verilir. Kişiye özel ölçülerde ve yoğun dönemlerde süre uzayabilir; bu durumda ' +
            'sipariş numaranız üzerinden bilgilendirilirsiniz.',
        },
        {
          baslik: 'Takip',
          paragraf:
            'Siparişinizin durumu her aşamada (ödeme alındı, hazırlanıyor, kargoya hazır, ' +
            'kargolandı) size WhatsApp veya e-posta ile bildirilir. Sipariş numaranızla ' +
            'bizimle iletişime geçerek de bilgi alabilirsiniz.',
        },
        {
          baslik: 'Teslim alırken',
          paragraf:
            'Paketi kargo görevlisinin yanında kontrol etmenizi öneririz. Pakette ezilme, ' +
            'yırtılma veya ıslanma varsa tutanak tutturmadan teslim almayın; tutanaklı ' +
            'bildirimlerde ürün ücretsiz yenilenir.',
        },
        {
          baslik: 'Ürün güvenliği',
          vurgu: true,
          paragraf:
            'Abajur gövdeleri PLA veya PETG filamentten üretilir. Bu malzemeler ısıya sınırlı ' +
            'dayanım gösterdiğinden ürün yalnızca LED ampul ile kullanılmalıdır. Akkor, ' +
            'halojen veya yüksek watajlı ampul kullanılması gövdede deformasyona yol açar ve ' +
            'yangın riski oluşturur; bu şekilde kullanımdan doğan zararlar garanti kapsamı ' +
            'dışındadır. Elektrik bağlantısının yetkili bir kişi tarafından yapılması ' +
            'önerilir.',
        },
      ],
    },
  ];
}
