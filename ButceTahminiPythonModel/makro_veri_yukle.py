"""
TCMB EVDS'ten enflasyon (TUFE), USD/TRY kuru ve altin fiyatini aylik
olarak ceker ve MSSQL 'ButceTahmin' veritabanindaki 'makro_gosterge'
tablosuna yazar.

Kurulum (bir kere calistir):
    pip install evds pandas pyodbc

Gereksinim: Bilgisayarinda "ODBC Driver 17 for SQL Server" kurulu olmali
(SQL Server Management Studio kurulumuyla genelde beraber gelir).

Not: EVDS_API_KEY asagida hazir. Github'a/paylasima koyacaksan
     bu dosyayi degil, anahtari .env / ortam degiskenine tasi.
"""

from evds import evdsAPI
import pandas as pd
import pyodbc

EVDS_API_KEY = "MwCNDFI4Zm"
START_DATE = "01-01-2016"
END_DATE = "31-12-2025"

# MSSQL baglanti bilgisi - LocalDB (Visual Studio / SSMS ile gelen varsayilan
# gelistirici instance'i) icin. SSMS'te "(localdb)\MSSQLLocalDB" ile baglandiysan
# bu haliyle calisir.
CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=(localdb)\\MSSQLLocalDB;"
    "DATABASE=ButceTahmin;"
    "Trusted_Connection=yes;"
)

evds = evdsAPI(EVDS_API_KEY)


def main():
    seri_kodlari = {
        "Enflasyon": "TP.FE.OKTG01",   # TUFE genel endeks
        "USDTRY": "TP.DK.USD.A.YTL",   # USD/TRY alis
        "Altin": "TP.MK.KUL.YTL",      # Kulce Altin Satis Fiyati (TL/Gr) - Ankara Kuyumcular ve Saatciler Odasi
    }

    print("Veri cekiliyor:", seri_kodlari)
    df = evds.get_data(
        list(seri_kodlari.values()),
        startdate=START_DATE,
        enddate=END_DATE,
        frequency=5,          # 5 = Aylik
        aggregation_types="avg",
    )
    print(df.head())
    print("Kolonlar:", list(df.columns))

    # Tarih kolonunu bul (genelde 'Tarih' adinda gelir, format 'YYYY-M')
    tarih_kolon = next((c for c in df.columns if "tarih" in c.lower()), df.columns[0])
    df[tarih_kolon] = pd.to_datetime(df[tarih_kolon], format="%Y-%m", errors="coerce")
    # bazi surumlerde farkli format gelebilir, olmazsa genel coz
    if df[tarih_kolon].isna().all():
        df[tarih_kolon] = pd.to_datetime(df[tarih_kolon], dayfirst=True, errors="coerce")

    conn = pyodbc.connect(CONN_STR)
    cursor = conn.cursor()

    # makro_gosterge_turu tablosundaki isim -> id eslemesi
    tur_id = {}
    for ad in seri_kodlari.keys():
        cursor.execute("SELECT id FROM makro_gosterge_turu WHERE ad = ?", ad)
        row = cursor.fetchone()
        if row:
            tur_id[ad] = row[0]
        else:
            print(f"UYARI: makro_gosterge_turu icinde '{ad}' yok, atlaniyor.")

    eklenen = 0
    for ad, kod in seri_kodlari.items():
        if ad not in tur_id:
            continue
        aday_kolonlar = [kod, kod.replace(".", "_")]
        veri_kolon = next((c for c in aday_kolonlar if c in df.columns), None)
        if veri_kolon is None:
            print(f"UYARI: '{ad}' icin kolon bulunamadi. Mevcut kolonlar: {list(df.columns)}")
            continue

        for _, satir in df.iterrows():
            tarih = satir[tarih_kolon]
            deger = satir[veri_kolon]
            if pd.isna(tarih) or pd.isna(deger):
                continue
            cursor.execute(
                """
                IF NOT EXISTS (
                    SELECT 1 FROM makro_gosterge
                    WHERE gosterge_turu_id = ? AND tarih = ?
                )
                INSERT INTO makro_gosterge (gosterge_turu_id, tarih, deger, kaynak)
                VALUES (?, ?, ?, N'TCMB EVDS')
                """,
                tur_id[ad], tarih.date(),
                tur_id[ad], tarih.date(), float(deger),
            )
            eklenen += 1

    conn.commit()
    print(f"Tamamlandi. {eklenen} satir islendi (mevcut olanlar atlandi).")


if __name__ == "__main__":
    main()