// Dosya konumu: ButceTahminApi/Models/Entities.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ButceTahminApi.Models;

[Table("departman")]
public class Departman
{
    [Column("id")] public int Id { get; set; }
    [Column("ad")] public string Ad { get; set; } = null!;

    public ICollection<Kullanici>? Kullanicilar { get; set; }
    public ICollection<ButceKalemi>? ButceKalemleri { get; set; }
}

[Table("kullanici")]
public class Kullanici
{
    [Column("id")] public int Id { get; set; }
    [Column("ad_soyad")] public string AdSoyad { get; set; } = null!;
    [Column("email")] public string Email { get; set; } = null!;
    [Column("departman_id")] public int? DepartmanId { get; set; }
    [Column("rol")] public string Rol { get; set; } = null!;
    [Column("sifre_hash")] public string SifreHash { get; set; } = null!;
    [Column("olusturma_tarihi")] public DateTime OlusturmaTarihi { get; set; }

    public Departman? Departman { get; set; }
}

[Table("butce_kalemi")]
public class ButceKalemi
{
    [Column("id")] public int Id { get; set; }
    [Column("ad")] public string Ad { get; set; } = null!;
    [Column("departman_id")] public int? DepartmanId { get; set; }
    [Column("tur")] public string Tur { get; set; } = null!; // Gelir / Gider
    [Column("aciklama")] public string? Aciklama { get; set; }
    [Column("aktif_mi")] public bool AktifMi { get; set; } = true;
    [Column("olusturma_tarihi")] public DateTime OlusturmaTarihi { get; set; }

    public Departman? Departman { get; set; }
    public ICollection<GerceklesenDeger>? GerceklesenDegerler { get; set; }
    public ICollection<KalemGostergeAgirligi>? Agirliklar { get; set; }
    public ICollection<TahminSonucu>? TahminSonuclari { get; set; }
}

[Table("gerceklesen_deger")]
public class GerceklesenDeger
{
    [Column("id")] public int Id { get; set; }
    [Column("kalem_id")] public int KalemId { get; set; }
    [Column("yil")] public int Yil { get; set; }
    [Column("ay")] public int Ay { get; set; }
    [Column("tutar")] public decimal Tutar { get; set; }
    [Column("giris_tarihi")] public DateTime GirisTarihi { get; set; }
    [Column("veri_kaynagi")] public string VeriKaynagi { get; set; } = "Gerçek";

    public ButceKalemi? ButceKalemi { get; set; }
}

[Table("makro_gosterge_turu")]
public class MakroGostergeTuru
{
    [Column("id")] public int Id { get; set; }
    [Column("ad")] public string Ad { get; set; } = null!; // Enflasyon, USDTRY, Altin
    [Column("birim")] public string? Birim { get; set; }

    public ICollection<MakroGosterge>? Olcumler { get; set; }
    public ICollection<KalemGostergeAgirligi>? Agirliklar { get; set; }
}

[Table("makro_gosterge")]
public class MakroGosterge
{
    [Column("id")] public int Id { get; set; }
    [Column("gosterge_turu_id")] public int GostergeTuruId { get; set; }
    [Column("tarih")] public DateTime Tarih { get; set; }
    [Column("deger")] public decimal Deger { get; set; }
    [Column("kaynak")] public string Kaynak { get; set; } = null!;
    [Column("cekilme_tarihi")] public DateTime CekilmeTarihi { get; set; }

    public MakroGostergeTuru? Tur { get; set; }
}

[Table("kalem_gosterge_agirligi")]
public class KalemGostergeAgirligi
{
    [Column("id")] public int Id { get; set; }
    [Column("kalem_id")] public int KalemId { get; set; }
    [Column("gosterge_turu_id")] public int GostergeTuruId { get; set; }
    [Column("agirlik_katsayisi")] public decimal AgirlikKatsayisi { get; set; }

    public ButceKalemi? ButceKalemi { get; set; }
    public MakroGostergeTuru? GostergeTuru { get; set; }
}

[Table("tahmin_modeli")]
public class TahminModeli
{
    [Column("id")] public int Id { get; set; }
    [Column("ad")] public string Ad { get; set; } = null!; // ARIMA, Prophet, RandomForest...
    [Column("versiyon")] public string? Versiyon { get; set; }
    [Column("parametreler")] public string? Parametreler { get; set; }

    public ICollection<TahminSonucu>? TahminSonuclari { get; set; }
}

[Table("tahmin_sonucu")]
public class TahminSonucu
{
    [Column("id")] public int Id { get; set; }
    [Column("kalem_id")] public int KalemId { get; set; }
    [Column("model_id")] public int ModelId { get; set; }
    [Column("tahmin_yili")] public int TahminYili { get; set; }
    [Column("senaryo")] public string Senaryo { get; set; } = null!; // Iyimser / Kotumser / Baz
    [Column("tahmin_tutari")] public decimal TahminTutari { get; set; }
    [Column("guven_araligi_alt")] public decimal? GuvenAraligiAlt { get; set; }
    [Column("guven_araligi_ust")] public decimal? GuvenAraligiUst { get; set; }
    [Column("uretim_tarihi")] public DateTime UretimTarihi { get; set; }

    public ButceKalemi? ButceKalemi { get; set; }
    public TahminModeli? Model { get; set; }
    public ICollection<TahminDogruluk>? Dogruluklar { get; set; }
}

[Table("tahmin_dogruluk")]
public class TahminDogruluk
{
    [Column("id")] public int Id { get; set; }
    [Column("tahmin_sonucu_id")] public int TahminSonucuId { get; set; }
    [Column("gerceklesen_id")] public int GerceklesenId { get; set; }
    [Column("mape")] public decimal? Mape { get; set; }
    [Column("rmse")] public decimal? Rmse { get; set; }
    [Column("hesaplama_tarihi")] public DateTime HesaplamaTarihi { get; set; }

    public TahminSonucu? TahminSonucu { get; set; }
    public GerceklesenDeger? GerceklesenDeger { get; set; }
}
