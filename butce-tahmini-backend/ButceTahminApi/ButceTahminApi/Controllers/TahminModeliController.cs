using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ButceTahminApi.Data;
using ButceTahminApi.Models;

namespace ButceTahminApi.Controllers;



[ApiController]
[Route("api/[controller]")]
public class TahminModeliController : ControllerBase
{
    private readonly ButceTahminContext _context;
    public TahminModeliController(ButceTahminContext context) => _context = context;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TahminModeli>>> GetAll() =>
        Ok(await _context.TahminModelleri.ToListAsync());
}
