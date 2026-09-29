from evds import evdsAPI
import pandas as pd

pd.set_option("display.max_rows", None)
pd.set_option("display.max_colwidth", None)

EVDS_API_KEY = "MwCNDFI4Zm"
evds = evdsAPI(EVDS_API_KEY)

print("===== 2502 ALTIN İSTATİSTİKLERİ alt başlıkları =====")
alt = evds.get_sub_categories(2502)
print(alt.to_string())

for _, satir in alt.iterrows():
    kod = satir.get("DATAGROUP_CODE")
    ad = satir.get("DATAGROUP_NAME")
    if not kod:
        continue
    print(f"\n--- {kod} ({ad}) serileri ---")
    try:
        seriler = evds.get_series(kod)
        print(seriler[["SERIE_CODE", "SERIE_NAME"]].to_string())
    except Exception as e:
        print("hata:", e)