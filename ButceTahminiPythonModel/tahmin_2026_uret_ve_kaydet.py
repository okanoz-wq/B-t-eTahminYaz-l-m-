"""
2026 icin GERCEK ileri-tahmin (forward forecast) uretir ve veritabanina yazar.

Onceki adimlarda (model_prototip.py / backtest_sonuclarini_kaydet.py) sadece
backtest yaptik: modelleri 2016-2024 ile egitip BILDIGIMIZ 2025'i tahmin edip
gercekle karsilastirdik (MAPE/RMSE). Bu script farkli: modelleri TUM 10 yillik
veriyle (2016-2025) egitip, HENUZ GERCEKLESMEMIS 2026'yi ileriye dogru tahmin
ediyor. Bu, projenin asil istenen ciktisidir.

Dissal degisken varsayimi (Baz senaryo):
  Gelecekteki reel_kur, reel_altin ve enflasyon_yoy icin gercek 2026 verisi
  yok. Baz senaryo olarak, bu uc degiskenin SON 12 AYIN ORTALAMASINDA sabit
  kaldigini varsayiyoruz (reel doviz kurunun ve reel altin fiyatinin uzun
  vadede ortalamaya donme egiliminde oldugu bulgusuna dayanan standart bir
  baz senaryo yaklasimidir - akademik literatürde "random walk" varsayimina
  yakin, en azindan asiri iyimser/kotumser bir varsayim yapmiyoruz).

Tahminler REEL (Aralik 2025 alim gucu / TL) olarak birakiliyor ve boyle
kaydediliyor - 2026'nin gercek enflasyonunu simdiden varsaymak yerine, sabit
fiyatlarla (enflasyondan arindirilmis) bir tahmin sunmak metodolojik olarak
daha savunulabilir. Backtest tablosu da ayni birimde (reel) raporlandigi icin
tutarli.

DB semasinda tahmin_sonucu yil bazli tek deger tuttugu icin (aylik kolon yok),
12 aylik tahmin ic hesapta uretiliyor ama DB'ye YILLIK TOPLAM olarak yaziliyor.

Guven araligi: ilgili modelin backtest MAPE'i kullanilarak yaklasik olarak
tahmin +/- (MAPE/100)*tahmin seklinde hesaplaniyor (mape bulunamazsa %15
varsayilan bant kullanilir).

Ayrim: tahmin_yili=2025 + senaryo='Baz' satirlari BACKTEST kayitlaridir (bilinen
gecmisi test etmek icin, tahmin_dogruluk cocuk kayitlari vardir). Bu script'in
urettigi tahmin_yili=2026 + senaryo='Baz' satirlari ise GERCEK ileri-tahmindir
(henuz gerceklesmedigi icin tahmin_dogruluk kaydi yoktur).

ONKOSUL: guncelle_model_adlari.sql ve backtest_sonuclarini_kaydet.py'yi daha
once calistirmis olman lazim (model_id eslesmesi ve guven araligi icin MAPE).

Tekrar calistirirsan 2026 icin yeni satirlar eklenir (eskiler silinmez).
Tekrar calistirmadan once SSMS'te temizlemek istersen:
    DELETE FROM tahmin_sonucu WHERE tahmin_yili = 2026;
"""

from datetime import datetime

import numpy as np
import pandas as pd
import pyodbc
from statsmodels.tsa.statespace.sarimax import SARIMAX
from sklearn.ensemble import RandomForestRegressor

from model_prototip import (
    veriyi_yukle,
    reel_veri_hazirla,
    EXOG_KOLONLAR,
    AY_KOLONLARI,
    log_donustur,
    _ay_dummy,
    _ozellik_seti_olustur,
    _x_olustur,
)

CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=(localdb)\\MSSQLLocalDB;"
    "DATABASE=ButceTahmin;"
    "Trusted_Connection=yes;"
)

TAHMIN_AY_SAYISI = 12
TAHMIN_YILI = 2026


def gelecek_exog_olustur(veri, ay_sayisi=TAHMIN_AY_SAYISI):
    """Baz senaryo: son 12 ayin ortalamasinda sabit kalan dissal degiskenler."""
    son_12_ay = veri[EXOG_KOLONLAR].iloc[-12:]
    ortalama = son_12_ay.mean()

    son_tarih = veri.index[-1]
    gelecek_tarihler = pd.date_range(son_tarih + pd.offsets.MonthBegin(1), periods=ay_sayisi, freq="MS")

    exog = pd.DataFrame({kolon: ortalama[kolon] for kolon in EXOG_KOLONLAR}, index=gelecek_tarihler)
    return exog


def ileri_tahmin_sarimax(veri):
    log_veri = log_donustur(veri)
    gelecek_exog = gelecek_exog_olustur(veri)
    gelecek_exog_log = gelecek_exog.copy()
    gelecek_exog_log["reel_kur"] = np.log1p(gelecek_exog["reel_kur"])
    gelecek_exog_log["reel_altin"] = np.log1p(gelecek_exog["reel_altin"])

    model = SARIMAX(
        log_veri["y"], exog=log_veri[EXOG_KOLONLAR],
        order=(1, 1, 1), seasonal_order=(1, 1, 1, 12),
        enforce_stationarity=False, enforce_invertibility=False,
    )
    sonuc = model.fit(disp=False)
    log_tahmin = sonuc.forecast(steps=TAHMIN_AY_SAYISI, exog=gelecek_exog_log[EXOG_KOLONLAR])
    tahmin = np.expm1(log_tahmin)
    tahmin.index = gelecek_exog.index
    return tahmin


def ileri_tahmin_random_forest(veri):
    df = _ozellik_seti_olustur(veri).dropna()
    ozellikler = ["reel_kur", "reel_altin", "enflasyon_yoy"] + AY_KOLONLARI + ["y_lag1", "y_lag12"]

    X_egitim = _x_olustur(df, ozellikler)
    y_egitim = np.log1p(df["y"])

    model = RandomForestRegressor(n_estimators=400, max_depth=7, min_samples_leaf=2, random_state=42)
    model.fit(X_egitim, y_egitim)

    gelecek_exog = gelecek_exog_olustur(veri)
    gecmis_y = df["y"].copy()
    tahminler = []
    for tarih in gelecek_exog.index:
        lag1_tarih = tarih - pd.offsets.MonthBegin(1)
        lag12_tarih = tarih - pd.offsets.MonthBegin(12)
        y_lag1 = gecmis_y.get(lag1_tarih, np.nan)
        y_lag12 = gecmis_y.get(lag12_tarih, np.nan)

        satir = gelecek_exog.loc[tarih]
        taban = {
            "reel_kur": np.log1p(satir["reel_kur"]),
            "reel_altin": np.log1p(satir["reel_altin"]),
            "enflasyon_yoy": satir["enflasyon_yoy"],
            "y_lag1": np.log1p(y_lag1),
            "y_lag12": np.log1p(y_lag12),
        }
        taban.update(_ay_dummy(tarih.month))
        x = pd.DataFrame([taban])[ozellikler]

        log_tahmin = model.predict(x)[0]
        tahmin_deger = np.expm1(log_tahmin)
        tahminler.append(tahmin_deger)
        gecmis_y.loc[tarih] = tahmin_deger

    return pd.Series(tahminler, index=gelecek_exog.index)


def ileri_tahmin_hareketli_ortalama(veri, pencere=12):
    y = veri["y"]
    gelecek_tarihler = pd.date_range(y.index[-1] + pd.offsets.MonthBegin(1), periods=TAHMIN_AY_SAYISI, freq="MS")
    gecmis = y.copy()
    tahminler = []
    for tarih in gelecek_tarihler:
        tahmin = gecmis.iloc[-pencere:].mean()
        tahminler.append(tahmin)
        gecmis.loc[tarih] = tahmin
    return pd.Series(tahminler, index=gelecek_tarihler)


MODEL_FONKSIYONLARI = {
    "HareketliOrtalama": ileri_tahmin_hareketli_ortalama,
    "SARIMAX": ileri_tahmin_sarimax,
    "RandomForest": ileri_tahmin_random_forest,
}


def main():
    kalem_df, makro_wide = veriyi_yukle()
    kalemler = kalem_df["kalem"].unique()

    conn = pyodbc.connect(CONN_STR)
    cur = conn.cursor()

    kalem_id_map = {ad: id_ for id_, ad in cur.execute("SELECT id, ad FROM butce_kalemi")}
    model_id_map = {ad: id_ for id_, ad in cur.execute("SELECT id, ad FROM tahmin_modeli")}

    mape_map = {}
    for kalem_adi_r, model_adi_r, mape_r in cur.execute(
        """
        SELECT bk.ad, tm.ad, td.mape
        FROM tahmin_dogruluk td
        JOIN tahmin_sonucu ts ON ts.id = td.tahmin_sonucu_id
        JOIN butce_kalemi bk ON bk.id = ts.kalem_id
        JOIN tahmin_modeli tm ON tm.id = ts.model_id
        WHERE ts.tahmin_yili = 2025
        """
    ):
        mape_map[(kalem_adi_r, model_adi_r)] = float(mape_r)

    toplam_kayit = 0

    for kalem_adi in kalemler:
        if kalem_adi not in kalem_id_map:
            continue
        kalem_id = kalem_id_map[kalem_adi]

        veri = reel_veri_hazirla(kalem_df, makro_wide, kalem_adi)
        if len(veri) < 36:
            continue

        print(f"\n{kalem_adi} -> {TAHMIN_YILI} tahmini:")
        for model_adi, fonksiyon in MODEL_FONKSIYONLARI.items():
            if model_adi not in model_id_map:
                continue
            model_id = model_id_map[model_adi]

            try:
                tahmin_serisi = fonksiyon(veri)
            except Exception as e:
                print(f"  {model_adi} hata: {e}")
                continue

            tahmin_tutari = float(tahmin_serisi.sum())  # reel (Aralik-2025 TL), yillik toplam
            mape = mape_map.get((kalem_adi, model_adi))
            bant = (mape / 100.0) if mape else 0.15
            alt = tahmin_tutari * (1 - bant)
            ust = tahmin_tutari * (1 + bant)

            cur.execute(
                """
                INSERT INTO tahmin_sonucu
                    (kalem_id, model_id, tahmin_yili, senaryo, tahmin_tutari,
                     guven_araligi_alt, guven_araligi_ust, uretim_tarihi)
                VALUES (?, ?, ?, N'Baz', ?, ?, ?, ?)
                """,
                kalem_id, model_id, TAHMIN_YILI, tahmin_tutari, alt, ust, datetime.utcnow(),
            )
            conn.commit()
            toplam_kayit += 1
            print(f"  {model_adi:<18} -> {tahmin_tutari:,.0f} TL (reel, Aralik-2025 bazinda)  [+/- %{(bant*100):.1f}]")

    cur.close()
    conn.close()
    print(f"\nTamamlandi. {toplam_kayit} adet {TAHMIN_YILI} tahmini tahmin_sonucu tablosuna yazildi.")


if __name__ == "__main__":
    main()
