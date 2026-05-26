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

        var inicio = dataInicio?.Date;
        var fim = dataFim?.Date.AddDays(1).AddTicks(-1);

        var abastecimentosQuery = _db.Abastecimentos
            .Include(x => x.Veiculo)
            .Include(x => x.Motorista)
            .AsQueryable();

        if (inicio.HasValue)
            abastecimentosQuery = abastecimentosQuery.Where(x => x.DataAbastecimento >= inicio.Value);

        if (fim.HasValue)
            abastecimentosQuery = abastecimentosQuery.Where(x => x.DataAbastecimento <= fim.Value);

        if (veiculoId.HasValue)
            abastecimentosQuery = abastecimentosQuery.Where(x => x.VeiculoId == veiculoId.Value);

        if (motoristaId.HasValue)
            abastecimentosQuery = abastecimentosQuery.Where(x => x.MotoristaId == motoristaId.Value);

        var abastecimentos = await abastecimentosQuery
            .OrderByDescending(x => x.DataAbastecimento)
            .ToListAsync();

        var usosQuery = _db.UsosVeiculos
            .Include(x => x.Veiculo)
            .Include(x => x.Motorista)
            .AsQueryable();

        if (inicio.HasValue)
            usosQuery = usosQuery.Where(x => x.DataInicio >= inicio.Value);

        if (fim.HasValue)
            usosQuery = usosQuery.Where(x => x.DataInicio <= fim.Value);

        if (veiculoId.HasValue)
            usosQuery = usosQuery.Where(x => x.VeiculoId == veiculoId.Value);

        if (motoristaId.HasValue)
            usosQuery = usosQuery.Where(x => x.MotoristaId == motoristaId.Value);

        var usos = await usosQuery
            .OrderByDescending(x => x.DataInicio)
            .ToListAsync();

        var manutencoesQuery = _db.ManutencoesVeiculos
            .Include(x => x.Veiculo)
            .AsQueryable();

        if (inicio.HasValue)
            manutencoesQuery = manutencoesQuery.Where(x => x.DataManutencao >= inicio.Value);

        if (fim.HasValue)
            manutencoesQuery = manutencoesQuery.Where(x => x.DataManutencao <= fim.Value);

        if (veiculoId.HasValue)
            manutencoesQuery = manutencoesQuery.Where(x => x.VeiculoId == veiculoId.Value);

        var manutencoes = await manutencoesQuery
            .OrderByDescending(x => x.DataManutencao)
            .ToListAsync();

        var hoje = DateTime.Now.Date;

        var manutencoesAlertas = manutencoes
            .Select(x =>
            {
                var kmAtual = x.Veiculo?.KmAtual ?? 0;

                int? kmRestante = x.ProximaManutencaoKm.HasValue
                    ? x.ProximaManutencaoKm.Value - kmAtual
                    : null;

                int? diasRestantes = x.ProximaManutencaoData.HasValue
                    ? (int)(x.ProximaManutencaoData.Value.Date - hoje).TotalDays
                    : null;

                var vencida =
                    (kmRestante.HasValue && kmRestante.Value < 0) ||
                    (diasRestantes.HasValue && diasRestantes.Value < 0);

                var proxima =
                    !vencida &&
                    (
                        (kmRestante.HasValue && kmRestante.Value <= 500) ||
                        (diasRestantes.HasValue && diasRestantes.Value <= 7)
                    );

                return new
                {
                    manutencao = x,
                    status = vencida ? "Vencida" : proxima ? "Próxima" : "Em dia",
                    kmRestante,
                    diasRestantes
                };
            })
            .ToList();

        var porVeiculo = abastecimentos
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

        var porMotorista = abastecimentos
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

        var usoPorVeiculo = usos
            .GroupBy(x => new
            {
                x.VeiculoId,
                Veiculo = x.Veiculo != null ? $"{x.Veiculo.Modelo} - {x.Veiculo.Placa}" : "Sem veículo"
            })
            .Select(g => new
            {
                veiculoId = g.Key.VeiculoId,
                veiculo = g.Key.Veiculo,
                quantidadeUsos = g.Count(),
                tempoTotalMinutos = g.Sum(x => x.DataFim.HasValue ? (x.DataFim.Value - x.DataInicio).TotalMinutes : 0),
                kmRodado = g.Sum(x => x.KmFinal.HasValue ? x.KmFinal.Value - x.KmInicial : 0)
            })
            .OrderByDescending(x => x.tempoTotalMinutos)
            .ToList();

        var usoPorMotorista = usos
            .GroupBy(x => new
            {
                x.MotoristaId,
                Motorista = x.Motorista != null ? x.Motorista.Nome : "Sem motorista"
            })
            .Select(g => new
            {
                motoristaId = g.Key.MotoristaId,
                motorista = g.Key.Motorista,
                quantidadeUsos = g.Count(),
                tempoTotalMinutos = g.Sum(x => x.DataFim.HasValue ? (x.DataFim.Value - x.DataInicio).TotalMinutes : 0),
                kmRodado = g.Sum(x => x.KmFinal.HasValue ? x.KmFinal.Value - x.KmInicial : 0)
            })
            .OrderByDescending(x => x.tempoTotalMinutos)
            .ToList();

        return Ok(new
        {
            resumo = new
            {
                quantidade = abastecimentos.Count,
                totalLitros = abastecimentos.Sum(x => x.Litros),
                totalValor = abastecimentos.Sum(x => x.ValorTotal),
                mediaLitros = abastecimentos.Any() ? abastecimentos.Average(x => x.Litros) : 0,
                mediaValor = abastecimentos.Any() ? abastecimentos.Average(x => x.ValorTotal) : 0,

                quantidadeUsos = usos.Count,
                tempoTotalUsoMinutos = usos.Sum(x => x.DataFim.HasValue ? (x.DataFim.Value - x.DataInicio).TotalMinutes : 0),
                kmTotalRodado = usos.Sum(x => x.KmFinal.HasValue ? x.KmFinal.Value - x.KmInicial : 0),

                quantidadeManutencoes = manutencoes.Count,
                manutencoesProximas = manutencoesAlertas.Count(x => x.status == "Próxima"),
                manutencoesVencidas = manutencoesAlertas.Count(x => x.status == "Vencida"),
                custoTotalManutencoes = manutencoes.Sum(x => x.Custo ?? 0)
            },
            abastecimentos = new
            {
                porVeiculo,
                porMotorista,
                itens = abastecimentos
            },
            usos = new
            {
                porVeiculo = usoPorVeiculo,
                porMotorista = usoPorMotorista,
                itens = usos
            },
            manutencoes = new
            {
                feitas = manutencoes,
                proximas = manutencoesAlertas
                    .Where(x => x.status == "Próxima")
                    .Select(x => new
                    {
                        x.manutencao.Id,
                        x.manutencao.VeiculoId,
                        x.manutencao.Veiculo,
                        x.manutencao.Tipo,
                        x.manutencao.DataManutencao,
                        x.manutencao.KmManutencao,
                        x.manutencao.Descricao,
                        x.manutencao.Custo,
                        x.manutencao.ProximaManutencaoKm,
                        x.manutencao.ProximaManutencaoData,
                        x.status,
                        x.kmRestante,
                        x.diasRestantes
                    }),
                vencidas = manutencoesAlertas
                    .Where(x => x.status == "Vencida")
                    .Select(x => new
                    {
                        x.manutencao.Id,
                        x.manutencao.VeiculoId,
                        x.manutencao.Veiculo,
                        x.manutencao.Tipo,
                        x.manutencao.DataManutencao,
                        x.manutencao.KmManutencao,
                        x.manutencao.Descricao,
                        x.manutencao.Custo,
                        x.manutencao.ProximaManutencaoKm,
                        x.manutencao.ProximaManutencaoData,
                        x.status,
                        x.kmRestante,
                        x.diasRestantes
                    })
            }
        });
    }
}
