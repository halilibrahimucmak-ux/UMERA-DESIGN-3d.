import { kargoAyari } from '../lib/kargo.js';

/**
 * Vitrinde gösterilmesi gereken herkese açık ayarlar.
 *
 * Kargo ücretini istemcinin bilmesi gerekiyor (fiyatın yanında ve sepette
 * gösteriliyor), ama sipariş toplamı buna göre HESAPLANMIYOR — onu sunucu
 * /api/orders içinde yeniden hesaplar. Burası yalnızca gösterim içindir.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const kargo = kargoAyari();
  // Kısa önbellek: ekranda gösterilen kargo ücreti ile siparişte tahsil edilen
  // tutarın ayrışmaması için. Ayar değişince en geç 1 dakikada yayılır.
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  return res.json({ kargo });
}
