"""
Backtest sonuclarini (MAPE/RMSE + o donemin tahmin tutari) veritabanina yazar.

model_prototip.py'daki fonksiyonlari oldugu gibi tekrar kullanir (import eder),
tek eklenen adim: her modelin ureettigi 12 aylik REEL (Aralik-2025 TL) tahmin
serisini TUFE ile nominal TL'ye geri cevirip yillik toplam olarak
tahmin_sonucu.tahmin_tutari kolonuna, MAPE/RMSE'yi de tahmin_dogruluk tablosuna
yazar. API bunlari zaten hazir olan GET /api/tahminsonucu/backtesting
endpoint'inden okuyacak.

Dogrudan pyodbc ile yaziyoruz (API'nin ayakta olmasina bagimli olmasin diye) -
tıpkı makro_veri_yukle.py'nin yaptigi gibi.

ONKOSUL: guncelle_model_adlari.sql'i SSMS'te calistirmis olman lazim
(ARIMA -> SARIMAX, Prophet -> RandomForest), yoksa model_id eslesmesi
bulunamaz ve o model atlanir.

Not: Script'i tekrar calistirirsan tahmin_sonucu / tahmin_dogruluk tablolarina
yeni satirlar eklenir (eskiler silinmez). Demo icin sorun degil, istersen
calistirmadan once SSMS'te:
    DELETE FROM tahmin_dogruluk; DELETE FROM tahmin_sonucu WHERE senaryo = N'Baz';
diyerek temizleyebilirsin.

Not 2: tahmin_sonucu.senaryo kolonunda bir CHECK constraint var (sadece
Iyimser / Kotumser / Baz kabul ediyor), o yuzden backtest kayitlarini
N'Baz' (varsayilan/orta senaryo) olarak isaretliyoruz.
"""

from datetime import datetime

import pyodbc

from model_prototip import (
    veriyi_yukle,
    reel_veri_hazirla,
    backtest_hareketli_ortalama,
    backtest_sarimax,
    backtest_random_forest,
)

CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=(localdb)\\MSSQLLocalDB;"
    "DATABASE=ButceTahmin;"
    "Trusted_Connection=yes;"
)

MODEL_FONKSIYONLARI = {
    "HareketliOrtalama": backtest_hareketli_ortalama,
    "SARIMAX": backtest_sarimax,
    "RandomForest": backtest_random_forest,
}


def main():
    kalem_df, makro_wide = veriyi_yukle()
    tufe = makro_wide["Enflasyon"]
    kalemler = kalem_df["kalem"].unique()

    conn = pyodbc.connect(CONN_STR)
    cur = conn.cursor()

    kalem_id_map = {ad: id_ for id_, ad in cur.execute("SELECT id, ad FROM butce_kalemi")}
    model_id_map = {ad: id_ for id_, ad in cur.execute("SELECT id, ad FROM tahmin_modeli")}

    eksik_modeller = set(MODEL_FONKSIYONLARI) - set(model_id_map)
    if eksik_modeller:
        print(f"UYARI: tahmin_modeli tablosunda bulunamayan modeller: {eksik_modeller}")
        print("       guncelle_model_adlari.sql'i calistirdin mi? Bu modeller atlanacak.\n")

    toplam_kayit = 0

    for kalem_adi in kalemler:
        if kalem_adi not in kalem_id_map:
            print(f"UYARI: '{kalem_adi}' butce_kalemi tablosunda yok, atlaniyor.")
            continue
        kalem_id = kalem_id_map[kalem_adi]

        veri = reel_veri_hazirla(kalem_df, makro_wide, kalem_adi)
        if len(veri) < 24 + 12:
            print(f"{kalem_adi}: yetersiz veri, atlaniyor.")
            continue

        test_index = veri.index[-12:]
        tahmin_yili = int(test_index[-1].year)

        aralik_satir = cur.execute(
            "SELECT id FROM gerceklesen_deger WHERE kalem_id = ? AND yil = ? AND ay = 12",
            kalem_id, tahmin_yili,
        ).fetchone()
        if aralik_satir is None:
            print(f"UYARI: {kalem_adi} icin {tahmin_yili}-12 gerceklesen_deger bulunamadi, atlaniyor.")
            continue
        gerceklesen_id = aralik_satir[0]

        print(f"\n{kalem_adi} ({tahmin_yili}):")
        for model_adi, fonksiyon in MODEL_FONKSIYONLARI.items():
            if model_adi not in model_id_map:
                continue
            model_id = model_id_map[model_adi]

            try:
                tahmin_serisi, mape, rmse = fonksiyon(veri)
            except Exception as e:
                print(f"  {model_adi} hata: {e}")
                continue

            # reel (Aralik-2025 TL) tahminleri nominal TL'ye geri cevir, yillik topla
            nominal_tahmin = tahmin_serisi * (tufe.loc[tahmin_serisi.index] / tufe.iloc[-1])
            tahmin_tutari = float(nominal_tahmin.sum())

            cur.execute(
                """
                INSERT INTO tahmin_sonucu
                    (kalem_id, model_id, tahmin_yili, senaryo, tahmin_tutari,
                     guven_araligi_alt, guven_araligi_ust, uretim_tarihi)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, N'Baz', ?, NULL, NULL, ?)
                """,
                kalem_id, model_id, tahmin_yili, tahmin_tutari, datetime.utcnow(),
            )
            tahmin_sonucu_id = cur.fetchone()[0]

            cur.execute(
                """
                INSERT INTO tahmin_dogruluk
                    (tahmin_sonucu_id, gerceklesen_id, mape, rmse, hesaplama_tarihi)
                VALUES (?, ?, ?, ?, ?)
                """,
                tahmin_sonucu_id, gerceklesen_id, float(mape), float(rmse), datetime.utcnow(),
            )
            conn.commit()
            toplam_kayit += 1
            print(f"  {model_adi:<18} -> kaydedildi (id={tahmin_sonucu_id}, MAPE=%{mape:.2f}, RMSE={rmse:,.0f}, tahmin_tutari={tahmin_tutari:,.0f})")

    cur.close()
    conn.close()
    print(f"\nTamamlandi. {toplam_kayit} model sonucu tahmin_sonucu + tahmin_dogruluk tablolarina yazildi.")


if __name__ == "__main__":
    main()
