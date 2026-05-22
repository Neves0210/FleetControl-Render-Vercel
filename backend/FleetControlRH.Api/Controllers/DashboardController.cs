using FleetControlRH.Api.Data;
using FleetControlRH.Api.Models;
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

    public DashboardController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int? veiculoId, [FromQuery] int? motoristaId)
    {
        var query = _db.Abastecimentos
            .Include(x => x.Veiculo)
            .Include(x => x.Motorista)
            .AsQueryable();

        if (User.IsInRole("Tecnico"))
        {
            var motoristaLogadoId = ObterMotoristaIdUsuarioLogado();

            if (!motoristaLogadoId.HasValue)
            {
                return Ok(new
                {
                    veiculos = 0,
                    motoristas = 0,
                    abastecimentos = 0,
                    totalLitros = 0,
                    totalValor = 0,
                    ultimos = new List<Abastecimento>()
                });
            }

            query = query.Where(x => x.MotoristaId == motoristaLogadoId.Value);
        }
        else
        {
            if (motoristaId.HasValue)
                query = query.Where(x => x.MotoristaId == motoristaId.Value);
        }

        if (veiculoId.HasValue)
            query = query.Where(x => x.VeiculoId == veiculoId.Value);

        var abastecimentos = await query
            .OrderByDescending(x => x.DataAbastecimento)
            .ToListAsync();

        return Ok(new
        {
            veiculos = abastecimentos.Select(x => x.VeiculoId).Distinct().Count(),
            motoristas = abastecimentos.Select(x => x.MotoristaId).Distinct().Count(),
            abastecimentos = abastecimentos.Count,
            totalLitros = abastecimentos.Sum(x => x.Litros),
            totalValor = abastecimentos.Sum(x => x.ValorTotal),
            ultimos = abastecimentos.Take(5)
        });
    }

    private int? ObterMotoristaIdUsuarioLogado()
    {
        var motoristaIdClaim = User.Claims.FirstOrDefault(x => x.Type == "MotoristaId")?.Value;

        return int.TryParse(motoristaIdClaim, out var motoristaId)
            ? motoristaId
            : null;
    }
}