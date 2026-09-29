-- gerceklesen_deger tablosuna veri kaynağı ayrımı ekle
-- 'Gerçek'  : KAP finansal tablo dipnotundan doğrudan alınan yıllık toplamdan dağıtılmış
-- 'Tahmini' : Gerçek veri açıklanmadığı için oran/varsayımla üretilmiş

ALTER TABLE gerceklesen_deger
ADD veri_kaynagi NVARCHAR(20) NOT NULL DEFAULT N'Gerçek';
GO

-- Sadece Enerji Giderleri kaleminin 2020-2025 arası satırlarını 'Tahmini' olarak işaretle
-- (2016-2019 enerji ve diğer tüm kalem/yıllar KAP dipnotundan gerçek veriye dayanıyor)
UPDATE gerceklesen_deger
SET veri_kaynagi = N'Tahmini'
WHERE yil >= 2020
  AND kalem_id IN (SELECT id FROM butce_kalemi WHERE ad = N'Enerji Giderleri');
GO

-- Kontrol: kalem ve kaynağa göre kaç satır var
SELECT bk.ad AS kalem, gd.veri_kaynagi, COUNT(*) AS satir_sayisi
FROM gerceklesen_deger gd
JOIN butce_kalemi bk ON bk.id = gd.kalem_id
GROUP BY bk.ad, gd.veri_kaynagi
ORDER BY bk.ad, gd.veri_kaynagi;
GO
