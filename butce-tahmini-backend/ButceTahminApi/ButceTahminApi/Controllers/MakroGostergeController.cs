// Dosya konumu: ButceTahminApi/Controllers/MakroGostergeController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ButceTahminApi.Data;

namespace ButceTahminApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MakroGostergeController : ControllerBase
{
    private readonly ButceTahminContext _context;
    public MakroGostergeController(ButceTahminContext context) => _context = context;

    // GET api/makrogosterge/son - her gösterge turunun en guncel degeri (dashboard karti icin)
    [HttpGet("son")]
    public async Task<ActionResult<IEnumerable<object>>> GetSonDegerler()
    {
        var turler = await _context.MakroGostergeTurleri.ToListAsync();
        var sonuc = new List<object>();

        foreach (var tur in turler)
        {
            var son = await _context.MakroGostergeler
                .Where(m => m.GostergeTuruId == tur.Id)
                .OrderByDescending(m => m.Tarih)
                .FirstOrDefaultAsync();

            if (son is not null)
            {
                sonuc.Add(new
                {
                    Gosterge = tur.Ad,
                    Birim = tur.Birim,
                    son.Deger,
                    son.Tarih,
                    son.Kaynak,
                    son.CekilmeTarihi
                });
            }
        }
        return Ok(sonuc);
    }

    // GET api/makrogosterge?gosterge=Enflasyon&baslangic=2016-01-01&bitis=2025-12-31
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetTarihce(
        [FromQuery] string? gosterge, [FromQuery] DateTime? baslangic, [FromQuery] DateTime? bitis)
    {
        var query = _context.MakroGostergeler.Include(m => m.Tur).AsQueryable();
        if (!string.IsNullOrWhiteSpace(gosterge)) query = query.Where(m => m.Tur!.Ad == gosterge);
        if (baslangic.HasValue) query = query.Where(m => m.Tarih >= baslangic);
        if (bitis.HasValue) query = query.Where(m => m.Tarih <= bitis);

        var sonuc = await query.OrderBy(m => m.Tarih)
            .Select(m => new { m.Tarih, Gosterge = m.Tur!.Ad, m.Deger })
            .ToListAsync();

        return Ok(sonuc);
    }
}
