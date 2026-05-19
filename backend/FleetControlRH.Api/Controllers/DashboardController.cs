using FleetControlRH.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetControlRH.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;
    public DashboardController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var valores = await _db.Abastecimentos.Select(x => new { x.Litros, x.ValorTotal }).ToListAsync();
        return Ok(new
        {
            veiculos = await _db.Veiculos.CountAsync(x => x.Ativo),
            motoristas = await _db.Motoristas.CountAsync(x => x.Ativo),
            abastecimentos = await _db.Abastecimentos.CountAsync(),
            totalLitros = valores.Sum(x => x.Litros),
            totalValor = valores.Sum(x => x.ValorTotal)
        });
    }
}
