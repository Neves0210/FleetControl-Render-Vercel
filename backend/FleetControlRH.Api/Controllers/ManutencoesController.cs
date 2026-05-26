using FleetControlRH.Api.Data;
using FleetControlRH.Api.DTOs;
using FleetControlRH.Api.Extensions;
using FleetControlRH.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetControlRH.Api.Controllers;

[ApiController]
[Route("api/manutencoes")]
[Authorize]
public class ManutencoesController : ControllerBase
{
    private readonly AppDbContext _db;

    public ManutencoesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int? veiculoId, [FromQuery] string? status)
    {
        if (!User.TemPermissao("Manutencoes.Visualizar"))
            return Forbid();

        var query = _db.ManutencoesVeiculos
            .Include(x => x.Veiculo)
            .AsQueryable();

        if (veiculoId.HasValue)
            query = query.Where(x => x.VeiculoId == veiculoId.Value);

        var lista = await query
            .OrderByDescending(x => x.DataManutencao)
            .ToListAsync();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var alertas = CalcularAlertas(lista);
            var ids = alertas
                .Where(x => x.Status.Equals(status, StringComparison.OrdinalIgnoreCase))
                .Select(x => x.ManutencaoId)
                .ToHashSet();

            lista = lista.Where(x => ids.Contains(x.Id)).ToList();
        }

        return Ok(lista);
    }

    [HttpGet("alertas")]
    public async Task<IActionResult> Alertas()
    {
        if (!User.TemPermissao("Manutencoes.Visualizar"))
            return Forbid();

        var manutencoes = await _db.ManutencoesVeiculos
            .Include(x => x.Veiculo)
            .Where(x => x.ProximaManutencaoKm.HasValue || x.ProximaManutencaoData.HasValue)
            .ToListAsync();

        var alertas = CalcularAlertas(manutencoes)
            .Where(x => x.Status != "Em dia")
            .OrderByDescending(x => x.Status == "Vencida")
            .ThenBy(x => x.KmRestante ?? int.MaxValue)
            .ThenBy(x => x.DiasRestantes ?? int.MaxValue)
            .ToList();

        return Ok(alertas);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ManutencaoVeiculoDto dto)
    {
        if (!User.TemPermissao("Manutencoes.Gerenciar"))
            return Forbid();

        var erro = await ValidarAsync(dto, null);

        if (!string.IsNullOrWhiteSpace(erro))
            return BadRequest(new { mensagem = erro });

        var model = new ManutencaoVeiculo
        {
            VeiculoId = dto.VeiculoId,
            Tipo = dto.Tipo.Trim(),
            DataManutencao = dto.DataManutencao,
            KmManutencao = dto.KmManutencao,
            Descricao = dto.Descricao?.Trim(),
            Custo = dto.Custo,
            ProximaManutencaoKm = dto.ProximaManutencaoKm,
            ProximaManutencaoData = dto.ProximaManutencaoData,
            CriadoEm = DateTime.UtcNow
        };

        _db.ManutencoesVeiculos.Add(model);

        await _db.SaveChangesAsync();

        return Ok(model);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] ManutencaoVeiculoDto dto)
    {
        if (!User.TemPermissao("Manutencoes.Gerenciar"))
            return Forbid();

        var model = await _db.ManutencoesVeiculos.FindAsync(id);

        if (model == null)
            return NotFound();

        var erro = await ValidarAsync(dto, id);

        if (!string.IsNullOrWhiteSpace(erro))
            return BadRequest(new { mensagem = erro });

        model.VeiculoId = dto.VeiculoId;
        model.Tipo = dto.Tipo.Trim();
        model.DataManutencao = dto.DataManutencao;
        model.KmManutencao = dto.KmManutencao;
        model.Descricao = dto.Descricao?.Trim();
        model.Custo = dto.Custo;
        model.ProximaManutencaoKm = dto.ProximaManutencaoKm;
        model.ProximaManutencaoData = dto.ProximaManutencaoData;

        await _db.SaveChangesAsync();

        return Ok(model);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!User.TemPermissao("Manutencoes.Gerenciar"))
            return Forbid();

        var model = await _db.ManutencoesVeiculos.FindAsync(id);

        if (model == null)
            return NotFound();

        _db.ManutencoesVeiculos.Remove(model);

        await _db.SaveChangesAsync();

        return Ok();
    }

    private async Task<string?> ValidarAsync(ManutencaoVeiculoDto dto, int? idIgnorado)
    {
        if (dto.VeiculoId <= 0)
            return "Selecione um veículo.";

        var veiculo = await _db.Veiculos.FindAsync(dto.VeiculoId);

        if (veiculo == null || !veiculo.Ativo)
            return "Veículo inválido.";

        if (string.IsNullOrWhiteSpace(dto.Tipo))
            return "Informe o tipo de manutenção.";

        if (dto.DataManutencao > DateTime.Now.AddMinutes(5))
            return "A data da manutenção não pode ser futura.";

        if (dto.KmManutencao < 0)
            return "O KM da manutenção não pode ser negativo.";

        if (dto.KmManutencao > veiculo.KmAtual + 10000)
            return $"O KM da manutenção parece muito acima do KM atual do veículo ({veiculo.KmAtual}).";

        if (dto.Custo.HasValue && dto.Custo < 0)
            return "O custo não pode ser negativo.";

        if (dto.ProximaManutencaoKm.HasValue && dto.ProximaManutencaoKm.Value <= dto.KmManutencao)
            return "O KM da próxima manutenção deve ser maior que o KM da manutenção atual.";

        if (dto.ProximaManutencaoData.HasValue && dto.ProximaManutencaoData.Value.Date < dto.DataManutencao.Date)
            return "A data da próxima manutenção não pode ser anterior à data da manutenção atual.";

        return null;
    }

    private static List<AlertaManutencaoDto> CalcularAlertas(List<ManutencaoVeiculo> manutencoes)
    {
        const int limiteKmProximo = 500;
        const int limiteDiasProximo = 7;

        var hoje = DateTime.Now.Date;

        return manutencoes.Select(x =>
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
                    (kmRestante.HasValue && kmRestante.Value <= limiteKmProximo) ||
                    (diasRestantes.HasValue && diasRestantes.Value <= limiteDiasProximo)
                );

            var status = vencida
                ? "Vencida"
                : proxima
                    ? "Próxima"
                    : "Em dia";

            return new AlertaManutencaoDto
            {
                ManutencaoId = x.Id,
                VeiculoId = x.VeiculoId,
                Veiculo = x.Veiculo?.Modelo ?? "",
                Placa = x.Veiculo?.Placa ?? "",
                Tipo = x.Tipo,
                KmAtual = kmAtual,
                ProximaManutencaoKm = x.ProximaManutencaoKm,
                ProximaManutencaoData = x.ProximaManutencaoData,
                Status = status,
                KmRestante = kmRestante,
                DiasRestantes = diasRestantes
            };
        }).ToList();
    }
}
