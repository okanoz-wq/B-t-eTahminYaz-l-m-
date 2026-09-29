// Dosya konumu: ButceTahminApi/Controllers/GerceklesenDegerController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ButceTahminApi.Data;
using ButceTahminApi.Models;

namespace ButceTahminApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GerceklesenDegerController : ControllerBase
{
    private readonly ButceTahminContext _context;
    public GerceklesenDegerController(ButceTahminContext context) => _context = context;

    // GET api/gerceklesendeger?kalemId=1&yil=2025
    [HttpGet]
    public async Task<ActionResult<IEnumerable<GerceklesenDeger>>> GetAll(
        [FromQuery] int? kalemId, [FromQuery] int? yil)
    {
        var query = _context.GerceklesenDegerler.AsQueryable();
        if (kalemId.HasValue) query = query.Where(g => g.KalemId == kalemId);
        if (yil.HasValue) query = query.Where(g => g.Yil == yil);

        var sonuc = await query.OrderBy(g => g.Yil).ThenBy(g => g.Ay).ToListAsync();
        return Ok(sonuc);
    }

    // POST api/gerceklesendeger
    [HttpPost]
    public async Task<ActionResult<GerceklesenDeger>> Create(GerceklesenDeger yeni)
    {
        var kalemVarMi = await _context.ButceKalemleri.AnyAsync(k => k.Id == yeni.KalemId);
        if (!kalemVarMi) return BadRequest(new { mesaj = $"KalemId {yeni.KalemId} bulunamadı." });

        var mukerrer = await _context.GerceklesenDegerler
            .AnyAsync(g => g.KalemId == yeni.KalemId && g.Yil == yeni.Yil && g.Ay == yeni.Ay);
        if (mukerrer) return Conflict(new { mesaj = "Bu kalem için bu ay/yıl zaten kayıtlı." });

        yeni.GirisTarihi = DateTime.UtcNow;
        _context.GerceklesenDegerler.Add(yeni);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { kalemId = yeni.KalemId }, yeni);
    }

    // DELETE api/gerceklesendeger/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var kayit = await _context.GerceklesenDegerler.FindAsync(id);
        if (kayit is null) return NotFound();
        _context.GerceklesenDegerler.Remove(kayit);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
