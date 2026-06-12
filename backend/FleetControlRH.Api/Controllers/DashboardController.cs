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
            .AsNoTracking()
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

        var resumo = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                veiculos = g.Select(x => x.VeiculoId).Distinct().Count(),
                motoristas = g.Select(x => x.MotoristaId).Distinct().Count(),
                abastecimentos = g.Count(),
                totalLitros = g.Sum(x => x.Litros),
                totalValor = g.Sum(x => x.ValorTotal)
            })
            .FirstOrDefaultAsync();

        var ultimos = await query
            .OrderByDescending(x => x.DataAbastecimento)
            .Take(5)
            .Select(x => new
            {
                x.Id,
                x.VeiculoId,
                x.Veiculo,
                x.MotoristaId,
                x.Motorista,
                x.KmAtual,
                x.Litros,
                x.ValorTotal,
                x.Posto,
                x.DataAbastecimento,
                x.CriadoEm,
                temFoto = x.FotoNotaFiscal != null
            })
            .ToListAsync();

        return Ok(new
        {
            veiculos = resumo?.veiculos ?? 0,
            motoristas = resumo?.motoristas ?? 0,
            abastecimentos = resumo?.abastecimentos ?? 0,
            totalLitros = resumo?.totalLitros ?? 0,
            totalValor = resumo?.totalValor ?? 0,
            ultimos
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
