using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ButceTahminApi.Data;
using ButceTahminApi.Models;

namespace ButceTahminApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DepartmanController : ControllerBase
{
    private readonly ButceTahminContext _context;
    public DepartmanController(ButceTahminContext context) => _context = context;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Departman>>> GetAll() =>
        Ok(await _context.Departmanlar.ToListAsync());

    [HttpPost]
    public async Task<ActionResult<Departman>> Create(Departman yeni)
    {
        _context.Departmanlar.Add(yeni);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { id = yeni.Id }, yeni);
    }
}