export default function MaintenancePage() {
  return (
    <div className="maintenancePage">
      <div className="maintenanceGlow maintenanceGlowOne" />
      <div className="maintenanceGlow maintenanceGlowTwo" />

      <main className="maintenanceCard">
        <img
          src="/logo-hero.webp"
          alt="UMERA Design 3D"
          className="maintenanceLogo"
        />

        <div className="maintenanceEyebrow">UMERA DESIGN 3D</div>

        <h1 className="maintenanceTitle">
          Çok Yakında
          <span>Buradayız.</span>
        </h1>

        <p className="maintenanceText">
          UMERA Design 3D koleksiyonu ve kişiye özel üretim hizmetimiz
          hazırlanıyor. Çok yakında sipariş almaya başlayacağız.
        </p>

        <div className="maintenanceBadges">
          <span>Kişiye özel üretim</span>
          <span>3D tasarım</span>
          <span>Türkiye geneli gönderim</span>
        </div>

        <p className="maintenanceCopyright">
          © 2026 UMERA Design 3D — Tüm hakları saklıdır.
        </p>
      </main>
    </div>
  );
}
