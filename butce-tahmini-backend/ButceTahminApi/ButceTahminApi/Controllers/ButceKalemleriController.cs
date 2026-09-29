// Dosya konumu: ButceTahminApi/Controllers/ButceKalemleriController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ButceTahminApi.Data;
using ButceTahminApi.Models;

namespace ButceTahminApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ButceKalemleriController : ControllerBase
{
    private readonly ButceTahminContext _context;
    public ButceKalemleriController(ButceTahminContext context) => _context = context;

    // GET api/butcekalemleri
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll([FromQuery] string? tur, [FromQuery] string? ara)
    {
        var query = _context.ButceKalemleri.Include(k => k.Departman).AsQueryable();
        if (!string.IsNullOrWhiteSpace(tur)) query = query.Where(k => k.Tur == tur);
        if (!string.IsNullOrWhiteSpace(ara)) query = query.Where(k => k.Ad.Contains(ara));

        var sonuc = await query.Select(k => new
        {
            k.Id,
            k.Ad,
            k.Tur,
            k.AktifMi,
            Departman = k.Departman != null ? k.Departman.Ad : null,
            SonYilToplam = k.GerceklesenDegerler!
                .Where(g => g.Yil == k.GerceklesenDegerler!.Max(x => x.Yil))
                .Sum(g => g.Tutar)
        }).ToListAsync();

        return Ok(sonuc);
    }

    // GET api/butcekalemleri/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ButceKalemi>> GetById(int id)
    {
        var kalem = await _context.ButceKalemleri
            .Include(k => k.Departman)
            .Include(k => k.GerceklesenDegerler!.OrderBy(g => g.Yil).ThenBy(g => g.Ay))
            .Include(k => k.Agirliklar!).ThenInclude(a => a.GostergeTuru)
            .FirstOrDefaultAsync(k => k.Id == id);

        if (kalem is null) return NotFound(new { mesaj = $"Kalem {id} bulunamadı." });
        return Ok(kalem);
    }

    // POST api/butcekalemleri
    [HttpPost]
    public async Task<ActionResult<ButceKalemi>> Create(ButceKalemi yeniKalem)
    {
        if (yeniKalem.Tur != "Gelir" && yeniKalem.Tur != "Gider")
            return BadRequest(new { mesaj = "Tur alanı 'Gelir' veya 'Gider' olmalı." });

        yeniKalem.OlusturmaTarihi = DateTime.UtcNow;
        _context.ButceKalemleri.Add(yeniKalem);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = yeniKalem.Id }, yeniKalem);
    }

    // PUT api/butcekalemleri/5
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ButceKalemi guncel)
    {
        var kalem = await _context.ButceKalemleri.FindAsync(id);
        if (kalem is null) return NotFound();

        kalem.Ad = guncel.Ad;
        kalem.Tur = guncel.Tur;
        kalem.Aciklama = guncel.Aciklama;
        kalem.DepartmanId = guncel.DepartmanId;
        kalem.AktifMi = guncel.AktifMi;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE api/butcekalemleri/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var kalem = await _context.ButceKalemleri.FindAsync(id);
        if (kalem is null) return NotFound();

        _context.ButceKalemleri.Remove(kalem);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
