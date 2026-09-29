// Dosya konumu: ButceTahminApi/Data/ButceTahminContext.cs
using Microsoft.EntityFrameworkCore;
using ButceTahminApi.Models;

namespace ButceTahminApi.Data;

public class ButceTahminContext : DbContext
{
    public ButceTahminContext(DbContextOptions<ButceTahminContext> options) : base(options) { }

    public DbSet<Departman> Departmanlar => Set<Departman>();
    public DbSet<Kullanici> Kullanicilar => Set<Kullanici>();
    public DbSet<ButceKalemi> ButceKalemleri => Set<ButceKalemi>();
    public DbSet<GerceklesenDeger> GerceklesenDegerler => Set<GerceklesenDeger>();
    public DbSet<MakroGostergeTuru> MakroGostergeTurleri => Set<MakroGostergeTuru>();
    public DbSet<MakroGosterge> MakroGostergeler => Set<MakroGosterge>();
    public DbSet<KalemGostergeAgirligi> KalemGostergeAgirliklari => Set<KalemGostergeAgirligi>();
    public DbSet<TahminModeli> TahminModelleri => Set<TahminModeli>();
    public DbSet<TahminSonucu> TahminSonuclari => Set<TahminSonucu>();
    public DbSet<TahminDogruluk> TahminDogruluklari => Set<TahminDogruluk>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Kullanici>()
            .HasOne(k => k.Departman)
            .WithMany(d => d.Kullanicilar)
            .HasForeignKey(k => k.DepartmanId);

        modelBuilder.Entity<ButceKalemi>()
            .HasOne(bk => bk.Departman)
            .WithMany(d => d.ButceKalemleri)
            .HasForeignKey(bk => bk.DepartmanId);

        modelBuilder.Entity<GerceklesenDeger>()
            .HasOne(gd => gd.ButceKalemi)
            .WithMany(bk => bk.GerceklesenDegerler)
            .HasForeignKey(gd => gd.KalemId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MakroGosterge>()
            .HasOne(mg => mg.Tur)
            .WithMany(t => t.Olcumler)
            .HasForeignKey(mg => mg.GostergeTuruId);

        modelBuilder.Entity<KalemGostergeAgirligi>()
            .HasOne(a => a.ButceKalemi)
            .WithMany(bk => bk.Agirliklar)
            .HasForeignKey(a => a.KalemId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<KalemGostergeAgirligi>()
            .HasOne(a => a.GostergeTuru)
            .WithMany(t => t.Agirliklar)
            .HasForeignKey(a => a.GostergeTuruId);

        modelBuilder.Entity<TahminSonucu>()
            .HasOne(ts => ts.ButceKalemi)
            .WithMany(bk => bk.TahminSonuclari)
            .HasForeignKey(ts => ts.KalemId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TahminSonucu>()
            .HasOne(ts => ts.Model)
            .WithMany(m => m.TahminSonuclari)
            .HasForeignKey(ts => ts.ModelId);

        modelBuilder.Entity<TahminDogruluk>()
            .HasOne(td => td.TahminSonucu)
            .WithMany(ts => ts.Dogruluklar)
            .HasForeignKey(td => td.TahminSonucuId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TahminDogruluk>()
            .HasOne(td => td.GerceklesenDeger)
            .WithMany()
            .HasForeignKey(td => td.GerceklesenId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
