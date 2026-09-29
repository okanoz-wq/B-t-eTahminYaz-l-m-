-- SSMS'te ButceTahmin veritabanina bagliyken calistir.
-- Sebep: tahmin_modeli tablosu ilk kurulumda ARIMA / Prophet olarak seed edilmisti,
-- ama Prophet Windows'ta cakistigi icin RandomForest'a, ARIMA da daha genel
-- versiyonu olan SARIMAX'e gectik. Asagidaki guncelleme, gercekte kullandigimiz
-- model adlariyla tabloyu hizalar (backtest_sonuclarini_kaydet.py bu adlarla
-- model_id eslestirmesi yapiyor).

UPDATE tahmin_modeli SET ad = N'SARIMAX' WHERE ad = N'ARIMA';
UPDATE tahmin_modeli SET ad = N'RandomForest' WHERE ad = N'Prophet';

SELECT * FROM tahmin_modeli;
-- Beklenen sonuc: HareketliOrtalama, SARIMAX, RandomForest (3 satir)
