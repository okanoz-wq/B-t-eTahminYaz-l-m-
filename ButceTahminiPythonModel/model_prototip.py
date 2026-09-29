"""
Butce Tahmin Yazilimi - Model Prototipi (Adim 1) - v3

Iki degisiklik:
1) Prophet Windows'ta cmdstanpy uzerinden surekli cakisti (VC++ Redistributable
   kurulu olmasina ragmen). Proje tanimi zaten "Prophet, statsmodels, veya
   scikit-learn" diyor; o yuzden ikinci model olarak scikit-learn tabanli
   RandomForestRegressor (lag + dissal degisken ozellikli, coklu-adim
   ozyinelemeli tahmin) kullaniyoruz. Prophet kurulumun ileride duzelirse
   asagidaki backtest_prophet fonksiyonu hala duruyor, istersen tekrar
   denenebilir.

2) 2021-2022 TL kur/enflasyon soku + 2023'te baslayan enflasyon muhasebesi
   gecisi ham TL serisinde modelin ogrenemeyecegi kadar sert, yapay bir
   sicrama yaratiyor. Bunu duzeltmek icin tum kalem tutarlarini TUFE ile
   "Aralik 2025 alim gucune" REEL hale getiriyoruz once. Dissal degiskenler
   de ayni sekilde reel kur / reel altin olarak kullaniliyor, ayrica yillik
   enflasyon orani (%) ayri bir dissal degisken olarak ekleniyor (ozellikle
   personel gideri icin anlamli).

Kurulum:
    pip install pandas numpy pyodbc statsmodels scikit-learn matplotlib
    (prophet kurulu kalabilir, zorunlu degil artik)
"""

import warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
import pyodbc
from statsmodels.tsa.statespace.sarimax import SARIMAX
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_percentage_error, mean_squared_error

CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=(localdb)\\MSSQLLocalDB;"
    "DATABASE=ButceTahmin;"
    "Trusted_Connection=yes;"
)

TEST_AY_SAYISI = 12


def veriyi_yukle():
    conn = pyodbc.connect(CONN_STR)
    kalem_df = pd.read_sql(
        """
        SELECT bk.ad AS kalem, gd.yil, gd.ay, gd.tutar
        FROM gerceklesen_deger gd
        JOIN butce_kalemi bk ON bk.id = gd.kalem_id
        ORDER BY bk.ad, gd.yil, gd.ay
        """,
        conn,
    )
    kalem_df["tarih"] = pd.to_datetime(
        kalem_df["yil"].astype(str) + "-" + kalem_df["ay"].astype(str) + "-01"
    )

    makro_df = pd.read_sql(
        """
        SELECT mt.ad AS gosterge, mg.tarih, mg.deger
        FROM makro_gosterge mg
        JOIN makro_gosterge_turu mt ON mt.id = mg.gosterge_turu_id
        ORDER BY mt.ad, mg.tarih
        """,
        conn,
    )
    conn.close()

    makro_df["tarih"] = pd.to_datetime(makro_df["tarih"])
    makro_wide = makro_df.pivot(index="tarih", columns="gosterge", values="deger").sort_index()
    makro_wide = makro_wide.ffill().bfill()

    return kalem_df, makro_wide


def reel_veri_hazirla(kalem_df, makro_wide, kalem_adi):
    """Nominal TL tutari TUFE ile reellestirir (deflator = son_TUFE / o_ayin_TUFE'si),
    reel kur / reel altin / yillik enflasyon oranini dissal degisken olarak dondurur."""
    tufe = makro_wide["Enflasyon"]
    deflator = tufe.iloc[-1] / tufe

    seri = kalem_df[kalem_df["kalem"] == kalem_adi].set_index("tarih")["tutar"].sort_index()
    df = pd.concat([seri.rename("y_nominal"), makro_wide, deflator.rename("deflator")], axis=1, join="inner")

    df["y"] = df["y_nominal"] * df["deflator"]
    df["reel_kur"] = df["USDTRY"] * df["deflator"]
    df["reel_altin"] = df["Altin"] * df["deflator"]
    df["enflasyon_yoy"] = tufe.pct_change(12) * 100
    df = df.dropna(subset=["y", "reel_kur", "reel_altin", "enflasyon_yoy"])
    df = df[["y", "reel_kur", "reel_altin", "enflasyon_yoy"]].asfreq("MS")
    return df


EXOG_KOLONLAR = ["reel_kur", "reel_altin", "enflasyon_yoy"]


def log_donustur(veri):
    log_veri = veri.copy()
    log_veri["y"] = np.log1p(veri["y"])
    log_veri["reel_kur"] = np.log1p(veri["reel_kur"])
    log_veri["reel_altin"] = np.log1p(veri["reel_altin"])
    # enflasyon_yoy zaten yuzde, kucuk ve pozitif, oldugu gibi birakiyoruz
    return log_veri


def backtest_sarimax(veri):
    log_veri = log_donustur(veri)
    egitim = log_veri.iloc[:-TEST_AY_SAYISI]
    test = log_veri.iloc[-TEST_AY_SAYISI:]
    test_gercek = veri["y"].iloc[-TEST_AY_SAYISI:]

    model = SARIMAX(
        egitim["y"], exog=egitim[EXOG_KOLONLAR],
        order=(1, 1, 1), seasonal_order=(1, 1, 1, 12),
        enforce_stationarity=False, enforce_invertibility=False,
    )
    sonuc = model.fit(disp=False)
    log_tahmin = sonuc.forecast(steps=TEST_AY_SAYISI, exog=test[EXOG_KOLONLAR])
    tahmin = np.expm1(log_tahmin)

    mape = mean_absolute_percentage_error(test_gercek, tahmin) * 100
    rmse = np.sqrt(mean_squared_error(test_gercek, tahmin))
    return tahmin, mape, rmse


AY_KOLONLARI = [f"ay_{i}" for i in range(1, 13)]


def _ay_dummy(ay_no):
    """Verilen ay numarasi (1-12) icin tek satirlik one-hot sozluk dondurur."""
    return {f"ay_{i}": (1.0 if i == ay_no else 0.0) for i in range(1, 13)}


def _ozellik_seti_olustur(veri):
    df = veri.copy()
    for i in range(1, 13):
        df[f"ay_{i}"] = (df.index.month == i).astype(float)
    df["y_lag1"] = df["y"].shift(1)
    df["y_lag12"] = df["y"].shift(12)
    return df


def _x_olustur(alt_df, ozellikler):
    taban = {
        "reel_kur": np.log1p(alt_df["reel_kur"]),
        "reel_altin": np.log1p(alt_df["reel_altin"]),
        "enflasyon_yoy": alt_df["enflasyon_yoy"],
        "y_lag1": np.log1p(alt_df["y_lag1"]),
        "y_lag12": np.log1p(alt_df["y_lag12"]),
    }
    for kolon in AY_KOLONLARI:
        taban[kolon] = alt_df[kolon]
    x = pd.DataFrame(taban, index=alt_df.index)
    return x[ozellikler]


def backtest_random_forest(veri):
    df = _ozellik_seti_olustur(veri).dropna()
    ozellikler = ["reel_kur", "reel_altin", "enflasyon_yoy"] + AY_KOLONLARI + ["y_lag1", "y_lag12"]

    egitim = df.iloc[:-TEST_AY_SAYISI]
    test_index = df.iloc[-TEST_AY_SAYISI:].index

    X_egitim = _x_olustur(egitim, ozellikler)
    y_egitim = np.log1p(egitim["y"])

    model = RandomForestRegressor(n_estimators=400, max_depth=7, min_samples_leaf=2, random_state=42)
    model.fit(X_egitim, y_egitim)

    # ozyinelemeli (recursive) coklu adim tahmin: bir onceki tahmini bir sonraki lag olarak kullan
    gecmis_y = df["y"].copy()
    tahminler = []
    for tarih in test_index:
        satir = df.loc[tarih]
        lag1_tarih = tarih - pd.offsets.MonthBegin(1)
        lag12_tarih = tarih - pd.offsets.MonthBegin(12)
        y_lag1 = gecmis_y.get(lag1_tarih, np.nan)
        y_lag12 = gecmis_y.get(lag12_tarih, np.nan)

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
        gecmis_y.loc[tarih] = tahmin_deger  # bir sonraki adimin lag1'i icin

    tahmin_serisi = pd.Series(tahminler, index=test_index)
    test_gercek = veri["y"].loc[test_index]

    mape = mean_absolute_percentage_error(test_gercek, tahmin_serisi) * 100
    rmse = np.sqrt(mean_squared_error(test_gercek, tahmin_serisi))
    return tahmin_serisi, mape, rmse


def backtest_hareketli_ortalama(veri, pencere=12):
    """Basit baseline: son N ayin ortalamasini bir sonraki ayin tahmini olarak kullanir,
    ozyinelemeli olarak TEST_AY_SAYISI kadar ileri tasir. Dissal degisken kullanmaz -
    proje yol haritasindaki 'once hareketli ortalama ile basla' adimi budur."""
    y = veri["y"]
    train = y.iloc[:-TEST_AY_SAYISI].copy()
    test_index = y.iloc[-TEST_AY_SAYISI:].index

    gecmis = train.copy()
    tahminler = []
    for tarih in test_index:
        tahmin = gecmis.iloc[-pencere:].mean()
        tahminler.append(tahmin)
        gecmis.loc[tarih] = tahmin

    tahmin_serisi = pd.Series(tahminler, index=test_index)
    test_gercek = y.loc[test_index]

    mape = mean_absolute_percentage_error(test_gercek, tahmin_serisi) * 100
    rmse = np.sqrt(mean_squared_error(test_gercek, tahmin_serisi))
    return tahmin_serisi, mape, rmse


def main():
    kalem_df, makro_wide = veriyi_yukle()
    kalemler = kalem_df["kalem"].unique()
    sonuclar = []

    for kalem_adi in kalemler:
        print(f"\n{'=' * 60}\nKALEM: {kalem_adi}\n{'=' * 60}")
        veri = reel_veri_hazirla(kalem_df, makro_wide, kalem_adi)
        if len(veri) < TEST_AY_SAYISI + 24:
            print("  Yetersiz veri, atlaniyor.")
            continue

        try:
            _, mape_ho, rmse_ho = backtest_hareketli_ortalama(veri)
            print(f"  Hareketli Ortalama   -> MAPE: %{mape_ho:.2f}   RMSE: {rmse_ho:,.0f}")
            sonuclar.append({"kalem": kalem_adi, "model": "HareketliOrtalama", "MAPE": mape_ho, "RMSE": rmse_ho})
        except Exception as e:
            print("  Hareketli Ortalama hata:", e)

        try:
            _, mape_s, rmse_s = backtest_sarimax(veri)
            print(f"  SARIMAX (reel)       -> MAPE: %{mape_s:.2f}   RMSE: {rmse_s:,.0f}")
            sonuclar.append({"kalem": kalem_adi, "model": "SARIMAX", "MAPE": mape_s, "RMSE": rmse_s})
        except Exception as e:
            print("  SARIMAX hata:", e)

        try:
            _, mape_r, rmse_r = backtest_random_forest(veri)
            print(f"  RandomForest (reel)  -> MAPE: %{mape_r:.2f}   RMSE: {rmse_r:,.0f}")
            sonuclar.append({"kalem": kalem_adi, "model": "RandomForest", "MAPE": mape_r, "RMSE": rmse_r})
        except Exception as e:
            print("  RandomForest hata:", e)

    sonuc_df = pd.DataFrame(sonuclar)
    print("\n\n===== KARSILASTIRMA TABLOSU (reel / Aralik-2025 TL bazinda) =====")
    print(sonuc_df.to_string(index=False))
    sonuc_df.to_csv("backtesting_sonuclari.csv", index=False, encoding="utf-8-sig")
    print("\nbacktesting_sonuclari.csv dosyasina kaydedildi.")


if __name__ == "__main__":
    main()
