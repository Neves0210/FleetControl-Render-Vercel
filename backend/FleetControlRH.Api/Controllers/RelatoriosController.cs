using FleetControlRH.Api.Data;
using FleetControlRH.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetControlRH.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RelatoriosController : ControllerBase
{
    private readonly AppDbContext _db;

    public RelatoriosController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("abastecimentos")]
    public async Task<IActionResult> Abastecimentos(
        [FromQuery] DateTime? dataInicio,
        [FromQuery] DateTime? dataFim,
        [FromQuery] int? veiculoId,
        [FromQuery] int? motoristaId)
    {
        if (!User.TemPermissao("Relatorios.Visualizar") &&
            !User.IsInRole("Master") &&
            !User.IsInRole("RH"))
        {
            return Forbid();
        }

        var query = _db.Abastecimentos
            .Include(x => x.Veiculo)
            .Include(x => x.Motorista)
            .AsQueryable();

        if (dataInicio.HasValue)
            query = query.Where(x => x.DataAbastecimento >= dataInicio.Value.Date);

        if (dataFim.HasValue)
        {
            var fim = dataFim.Value.Date.AddDays(1).AddTicks(-1);
            query = query.Where(x => x.DataAbastecimento <= fim);
        }

        if (veiculoId.HasValue)
            query = query.Where(x => x.VeiculoId == veiculoId.Value);

        if (motoristaId.HasValue)
            query = query.Where(x => x.MotoristaId == motoristaId.Value);

        var itens = await query
            .OrderByDescending(x => x.DataAbastecimento)
            .ToListAsync();

        var porVeiculo = itens
            .GroupBy(x => new
            {
                x.VeiculoId,
                Veiculo = x.Veiculo != null ? $"{x.Veiculo.Modelo} - {x.Veiculo.Placa}" : "Sem veículo"
            })
            .Select(g => new
            {
                veiculoId = g.Key.VeiculoId,
                veiculo = g.Key.Veiculo,
                quantidade = g.Count(),
                totalLitros = g.Sum(x => x.Litros),
                totalValor = g.Sum(x => x.ValorTotal),
                mediaLitros = g.Any() ? g.Average(x => x.Litros) : 0,
                mediaValor = g.Any() ? g.Average(x => x.ValorTotal) : 0
            })
            .OrderByDescending(x => x.totalValor)
            .ToList();

        var porMotorista = itens
            .GroupBy(x => new
            {
                x.MotoristaId,
                Motorista = x.Motorista != null ? x.Motorista.Nome : "Sem motorista"
            })
            .Select(g => new
            {
                motoristaId = g.Key.MotoristaId,
                motorista = g.Key.Motorista,
                quantidade = g.Count(),
                totalLitros = g.Sum(x => x.Litros),
                totalValor = g.Sum(x => x.ValorTotal),
                mediaLitros = g.Any() ? g.Average(x => x.Litros) : 0,
                mediaValor = g.Any() ? g.Average(x => x.ValorTotal) : 0
            })
            .OrderByDescending(x => x.totalValor)
            .ToList();

        return Ok(new
        {
            resumo = new
            {
                quantidade = itens.Count,
                totalLitros = itens.Sum(x => x.Litros),
                totalValor = itens.Sum(x => x.ValorTotal),
                mediaLitros = itens.Any() ? itens.Average(x => x.Litros) : 0,
                mediaValor = itens.Any() ? itens.Average(x => x.ValorTotal) : 0
            },
            porVeiculo,
            porMotorista,
            itens
        });
    }
}
