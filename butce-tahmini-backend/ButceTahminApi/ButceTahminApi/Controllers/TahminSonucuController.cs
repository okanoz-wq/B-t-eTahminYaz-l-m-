// Dosya konumu: ButceTahminApi/Controllers/TahminSonucuController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ButceTahminApi.Data;
using ButceTahminApi.Models;

namespace ButceTahminApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TahminSonucuController : ControllerBase
{
    private readonly ButceTahminContext _context;
    public TahminSonucuController(ButceTahminContext context) => _context = context;

    // GET api/tahminsonucu?kalemId=1&yil=2026&senaryo=Baz
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll(
        [FromQuery] int? kalemId, [FromQuery] int? yil, [FromQuery] string? senaryo)
    {
        var query = _context.TahminSonuclari
            .Include(t => t.ButceKalemi)
            .Include(t => t.Model)
            .AsQueryable();

        if (kalemId.HasValue) query = query.Where(t => t.KalemId == kalemId);
        if (yil.HasValue) query = query.Where(t => t.TahminYili == yil);
        if (!string.IsNullOrWhiteSpace(senaryo)) query = query.Where(t => t.Senaryo == senaryo);

        var sonuc = await query.OrderByDescending(t => t.UretimTarihi)
            .Select(t => new
            {
                t.Id,
                Kalem = t.ButceKalemi!.Ad,
                Model = t.Model!.Ad,
                t.TahminYili,
                t.Senaryo,
                t.TahminTutari,
                t.GuvenAraligiAlt,
                t.GuvenAraligiUst,
                t.UretimTarihi
            }).ToListAsync();

        return Ok(sonuc);
    }

    // POST api/tahminsonucu - Python model script'inden gelen sonucu kaydetmek icin
    [HttpPost]
    public async Task<ActionResult<TahminSonucu>> Create(TahminSonucu yeni)
    {
        yeni.UretimTarihi = DateTime.UtcNow;
        _context.TahminSonuclari.Add(yeni);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { kalemId = yeni.KalemId }, yeni);
    }

    // GET api/tahminsonucu/backtesting - model karsilastirma tablosu (kalem x model x MAPE/RMSE)
    [HttpGet("backtesting")]
    public async Task<ActionResult<IEnumerable<object>>> GetBacktesting()
    {
        var sonuc = await _context.TahminDogruluklari
            .Include(d => d.TahminSonucu!).ThenInclude(t => t!.ButceKalemi)
            .Include(d => d.TahminSonucu!).ThenInclude(t => t!.Model)
            .Select(d => new
            {
                Kalem = d.TahminSonucu!.ButceKalemi!.Ad,
                Model = d.TahminSonucu.Model!.Ad,
                d.Mape,
                d.Rmse,
                d.HesaplamaTarihi
            })
            .ToListAsync();

        return Ok(sonuc);
    }
}
