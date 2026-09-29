import { trFormat } from './animations.js';

// ONEMLI: gerceklesen_deger.tutar ve tahmin_sonucu.tahmin_tutari veritabaninda
// KAP finansal tablolarindaki gibi "Bin TL" biriminde tutuluyor (orn. Hammadde
// 2025 toplami = 319.477.743 "bin TL" = 319,48 milyar TL). Milyar TL'ye
// cevirmek icin 1.000.000'a bolmek gerekiyor.
export function toMilyar(binTlDegeri) {
  if (binTlDegeri === null || binTlDegeri === undefined) return null;
  return binTlDegeri / 1_000_000;
}

export function paraMilyar(binTlDegeri, decimals = 1) {
  const milyar = toMilyar(binTlDegeri);
  if (milyar === null || Number.isNaN(milyar)) return '—';
  return trFormat(milyar, decimals) + ' mlyr ₺';
}

export function yuzde(deger, decimals = 1) {
  if (deger === null || deger === undefined || Number.isNaN(deger)) return '—';
  return '%' + trFormat(deger, decimals);
}
