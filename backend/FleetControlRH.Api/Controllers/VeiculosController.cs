using System.Security.Claims;
using FleetControlRH.Api.Data;
using FleetControlRH.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetControlRH.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VeiculosController : ControllerBase
{
    private readonly AppDbContext _db;

    public VeiculosController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] bool incluirInativos = false)
    {
        var query = _db.Veiculos.AsNoTracking().AsQueryable();

        if (!incluirInativos)
            query = query.Where(x => x.Ativo);

        var veiculos = await query.OrderBy(x => x.Modelo).ToListAsync();
        var ids = veiculos.Select(x => x.Id).ToList();

        var emUso = await _db.UsosVeiculos
            .AsNoTracking()
            .Where(x => ids.Contains(x.VeiculoId) && x.Status == StatusUsoVeiculo.EmUso)
            .Select(x => x.VeiculoId)
            .ToListAsync();

        var alertas = CalcularStatusManutencao(await _db.ManutencoesVeiculos
            .Include(x => x.Veiculo)
            .AsNoTracking()
            .Where(x => ids.Contains(x.VeiculoId))
            .ToListAsync());

        return Ok(veiculos.Select(x =>
        {
            var statusManutencao = alertas.GetValueOrDefault(x.Id);
            var statusOperacional = !x.Ativo
                ? "Inativo"
                : statusManutencao == "Vencida"
                    ? "Manutencao vencida"
                    : emUso.Contains(x.Id)
                        ? "Em uso"
                        : statusManutencao == "PrÃ³xima"
                            ? "Manutencao proxima"
                            : "Disponivel";

            return new
            {
                x.Id,
                x.Modelo,
                x.Placa,
                x.KmAtual,
                x.TipoCombustivel,
                x.Ativo,
                StatusOperacional = statusOperacional,
                StatusManutencao = statusManutencao
            };
        }));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _db.Veiculos
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        return item == null ? NotFound() : Ok(item);
    }

    [HttpGet("{id:int}/historico")]
    public async Task<IActionResult> Historico(int id)
    {
        var veiculo = await _db.Veiculos
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (veiculo == null)
            return NotFound();

        var abastecimentos = await _db.Abastecimentos
            .Include(x => x.Motorista)
            .Include(x => x.Combustiveis)
            .AsNoTracking()
            .Where(x => x.VeiculoId == id)
            .OrderByDescending(x => x.DataAbastecimento)
            .Select(x => new
            {
                x.Id,
                x.DataAbastecimento,
                x.KmAtual,
                x.Litros,
                x.ValorTotal,
                x.Posto,
                Motorista = x.Motorista != null ? x.Motorista.Nome : null,
                temFoto = x.FotoNotaFiscal != null,
                combustiveis = x.Combustiveis
                    .OrderBy(c => c.Ordem)
                    .Select(c => new { c.DescricaoCombustivel, c.Litros, c.ValorTotal })
            })
            .ToListAsync();

        var usosBase = await _db.UsosVeiculos
            .Include(x => x.Motorista)
            .AsNoTracking()
            .Where(x => x.VeiculoId == id)
            .OrderByDescending(x => x.DataInicio)
            .ToListAsync();

        var usos = usosBase.Select(x => new
        {
            x.Id,
            x.Status,
            x.DataInicio,
            x.DataFim,
            x.KmInicial,
            x.KmFinal,
            x.TempoUsoMinutos,
            Motorista = x.Motorista != null ? x.Motorista.Nome : null
        }).ToList();

        var manutencoes = await _db.ManutencoesVeiculos
            .AsNoTracking()
            .Where(x => x.VeiculoId == id)
            .OrderByDescending(x => x.DataManutencao)
            .Select(x => new
            {
                x.Id,
                x.Tipo,
                x.DataManutencao,
                x.KmManutencao,
                x.Descricao,
                x.Custo,
                x.ProximaManutencaoKm,
                x.ProximaManutencaoData,
                x.AnexoNome,
                temAnexo = x.AnexoArquivo != null
            })
            .ToListAsync();

        var auditoria = await _db.AuditoriaEventos
            .AsNoTracking()
            .Where(x => x.Resumo != null && x.Resumo.Contains($"Veiculo {id}"))
            .OrderByDescending(x => x.CriadoEm)
            .Take(20)
            .ToListAsync();

        return Ok(new
        {
            veiculo,
            resumo = new
            {
                abastecimentos = abastecimentos.Count,
                usos = usos.Count,
                manutencoes = manutencoes.Count,
                litros = abastecimentos.Sum(x => x.Litros),
                gasto = abastecimentos.Sum(x => x.ValorTotal) + manutencoes.Sum(x => x.Custo ?? 0)
            },
            abastecimentos,
            usos,
            manutencoes,
            auditoria
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create(Veiculo model)
    {
        var erro = ValidarVeiculo(model);

        if (!string.IsNullOrWhiteSpace(erro))
            return BadRequest(new { mensagem = erro });

        model.Placa = NormalizarPlaca(model.Placa);
        model.Modelo = model.Modelo.Trim();

        if (await _db.Veiculos.AnyAsync(x => x.Placa == model.Placa))
            return BadRequest(new { mensagem = "Ja existe veiculo cadastrado com esta placa." });

        model.Ativo = true;

        _db.Veiculos.Add(model);
        await _db.SaveChangesAsync();

        RegistrarAuditoria("Veiculo", model.Id, "Criar", $"{model.Modelo} - {model.Placa} | Veiculo {model.Id}");
        await _db.SaveChangesAsync();

        return Ok(model);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, Veiculo model)
    {
        var item = await _db.Veiculos.FindAsync(id);

        if (item == null)
            return NotFound();

        var erro = ValidarVeiculo(model);

        if (!string.IsNullOrWhiteSpace(erro))
            return BadRequest(new { mensagem = erro });

        var placa = NormalizarPlaca(model.Placa);

        if (await _db.Veiculos.AnyAsync(x => x.Placa == placa && x.Id != id))
            return BadRequest(new { mensagem = "Ja existe veiculo cadastrado com esta placa." });

        item.Modelo = model.Modelo.Trim();
        item.Placa = placa;
        item.KmAtual = model.KmAtual;
        item.TipoCombustivel = model.TipoCombustivel;
        item.Ativo = model.Ativo;

        RegistrarAuditoria("Veiculo", item.Id, "Editar", $"{item.Modelo} - {item.Placa} | Veiculo {item.Id}");

        await _db.SaveChangesAsync();

        return Ok(item);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.Veiculos.FindAsync(id);

        if (item == null)
            return NotFound();

        item.Ativo = false;

        RegistrarAuditoria("Veiculo", item.Id, "Remover", $"{item.Modelo} - {item.Placa} | Veiculo {item.Id}");

        await _db.SaveChangesAsync();

        return NoContent();
    }

    private static string? ValidarVeiculo(Veiculo model)
    {
        if (string.IsNullOrWhiteSpace(model.Modelo))
            return "O modelo do veiculo e obrigatorio.";

        if (string.IsNullOrWhiteSpace(model.Placa))
            return "A placa do veiculo e obrigatoria.";

        var placa = NormalizarPlaca(model.Placa);

        if (placa.Length < 7 || placa.Length > 8)
            return "Informe uma placa valida.";

        if (model.KmAtual < 0)
            return "O KM inicial nao pode ser negativo.";

        if (!Enum.IsDefined(typeof(TipoCombustivel), model.TipoCombustivel))
            return "Selecione um combustivel valido.";

        return null;
    }

    private static Dictionary<int, string> CalcularStatusManutencao(List<ManutencaoVeiculo> manutencoes)
    {
        const int limiteKmProximo = 500;
        const int limiteDiasProximo = 7;
        var hoje = DateTime.Now.Date;
        var resultado = new Dictionary<int, string>();

        foreach (var item in manutencoes)
        {
            int? kmRestante = item.ProximaManutencaoKm.HasValue
                ? item.ProximaManutencaoKm.Value - (item.Veiculo?.KmAtual ?? 0)
                : null;

            int? diasRestantes = item.ProximaManutencaoData.HasValue
                ? (int)(item.ProximaManutencaoData.Value.Date - hoje).TotalDays
                : null;

            var vencida = (kmRestante.HasValue && kmRestante.Value < 0) ||
                          (diasRestantes.HasValue && diasRestantes.Value < 0);

            var proxima = !vencida &&
                          ((kmRestante.HasValue && kmRestante.Value <= limiteKmProximo) ||
                           (diasRestantes.HasValue && diasRestantes.Value <= limiteDiasProximo));

            var status = vencida ? "Vencida" : proxima ? "PrÃ³xima" : "Em dia";
            if (!resultado.TryGetValue(item.VeiculoId, out var atual) ||
                atual == "Em dia" ||
                (atual == "PrÃ³xima" && status == "Vencida"))
            {
                resultado[item.VeiculoId] = status;
            }
        }

        return resultado;
    }

    private void RegistrarAuditoria(string entidade, int entidadeId, string acao, string? resumo)
    {
        var usuarioIdClaim = User.Claims.FirstOrDefault(x => x.Type == "UsuarioId" || x.Type == ClaimTypes.NameIdentifier)?.Value;
        var usuarioNome = User.Claims.FirstOrDefault(x => x.Type == ClaimTypes.Name)?.Value;

        _db.AuditoriaEventos.Add(new AuditoriaEvento
        {
            Entidade = entidade,
            EntidadeId = entidadeId,
            Acao = acao,
            UsuarioId = int.TryParse(usuarioIdClaim, out var usuarioId) ? usuarioId : null,
            UsuarioNome = usuarioNome,
            Resumo = resumo,
            CriadoEm = DateTime.UtcNow
        });
    }

    private static string NormalizarPlaca(string placa)
    {
        return (placa ?? string.Empty)
            .Replace("-", "")
            .Replace(" ", "")
            .Trim()
            .ToUpperInvariant();
    }
}
