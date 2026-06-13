using System.Security.Claims;
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
            .AsNoTracking()
            .AsQueryable();

        if (veiculoId.HasValue)
            query = query.Where(x => x.VeiculoId == veiculoId.Value);

        var lista = await query
            .OrderByDescending(x => x.DataManutencao)
            .Select(x => new ManutencaoConsultaRow
            {
                Id = x.Id,
                VeiculoId = x.VeiculoId,
                Veiculo = x.Veiculo == null ? null : new Veiculo
                {
                    Id = x.Veiculo.Id,
                    Modelo = x.Veiculo.Modelo,
                    Placa = x.Veiculo.Placa,
                    KmAtual = x.Veiculo.KmAtual,
                    TipoCombustivel = x.Veiculo.TipoCombustivel,
                    Ativo = x.Veiculo.Ativo
                },
                Tipo = x.Tipo,
                DataManutencao = x.DataManutencao,
                KmManutencao = x.KmManutencao,
                Descricao = x.Descricao,
                Custo = x.Custo,
                ProximaManutencaoKm = x.ProximaManutencaoKm,
                ProximaManutencaoData = x.ProximaManutencaoData,
                CriadoEm = x.CriadoEm
            })
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

        return Ok(lista.Select(x => new
        {
            x.Id,
            x.VeiculoId,
            x.Veiculo,
            x.Tipo,
            x.DataManutencao,
            x.KmManutencao,
            x.Descricao,
            x.Custo,
            x.ProximaManutencaoKm,
            x.ProximaManutencaoData,
            x.CriadoEm,
            anexoNome = (string?)null,
            temAnexo = false
        }));
    }

    [HttpGet("alertas")]
    public async Task<IActionResult> Alertas()
    {
        if (!User.TemPermissao("Manutencoes.Visualizar"))
            return Forbid();

        var manutencoes = await _db.ManutencoesVeiculos
            .AsNoTracking()
            .Where(x => x.ProximaManutencaoKm.HasValue || x.ProximaManutencaoData.HasValue)
            .Select(x => new ManutencaoConsultaRow
            {
                Id = x.Id,
                VeiculoId = x.VeiculoId,
                Veiculo = x.Veiculo == null ? null : new Veiculo
                {
                    Id = x.Veiculo.Id,
                    Modelo = x.Veiculo.Modelo,
                    Placa = x.Veiculo.Placa,
                    KmAtual = x.Veiculo.KmAtual,
                    TipoCombustivel = x.Veiculo.TipoCombustivel,
                    Ativo = x.Veiculo.Ativo
                },
                Tipo = x.Tipo,
                DataManutencao = x.DataManutencao,
                KmManutencao = x.KmManutencao,
                Descricao = x.Descricao,
                Custo = x.Custo,
                ProximaManutencaoKm = x.ProximaManutencaoKm,
                ProximaManutencaoData = x.ProximaManutencaoData,
                CriadoEm = x.CriadoEm
            })
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
    public async Task<IActionResult> Create([FromForm] ManutencaoVeiculoDto dto, IFormFile? anexo)
    {
        if (!User.TemPermissao("Manutencoes.Gerenciar"))
            return Forbid();

        var erro = await ValidarAsync(dto, anexo);

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

        if (anexo is { Length: > 0 })
            await AplicarAnexoAsync(model, anexo);

        _db.ManutencoesVeiculos.Add(model);
        await _db.SaveChangesAsync();

        RegistrarAuditoria("ManutencaoVeiculo", model.Id, "Criar", $"{model.Tipo} | Veiculo {model.VeiculoId}");
        await _db.SaveChangesAsync();

        return Ok(model);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromForm] ManutencaoVeiculoDto dto, IFormFile? anexo)
    {
        if (!User.TemPermissao("Manutencoes.Gerenciar"))
            return Forbid();

        var model = await _db.ManutencoesVeiculos.FindAsync(id);

        if (model == null)
            return NotFound();

        var erro = await ValidarAsync(dto, anexo);

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

        if (anexo is { Length: > 0 })
            await AplicarAnexoAsync(model, anexo);

        RegistrarAuditoria("ManutencaoVeiculo", model.Id, "Editar", $"{model.Tipo} | Veiculo {model.VeiculoId}");

        await _db.SaveChangesAsync();

        return Ok(model);
    }

    [HttpGet("{id:int}/anexo")]
    public async Task<IActionResult> ObterAnexo(int id)
    {
        if (!User.TemPermissao("Manutencoes.Visualizar"))
            return Forbid();

        var anexo = await _db.ManutencoesVeiculos
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new { x.AnexoArquivo, x.AnexoContentType, x.AnexoNome })
            .FirstOrDefaultAsync();

        if (anexo?.AnexoArquivo == null || anexo.AnexoArquivo.Length == 0)
            return NotFound();

        return File(
            anexo.AnexoArquivo,
            anexo.AnexoContentType ?? "application/octet-stream",
            anexo.AnexoNome ?? $"manutencao-{id}");
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!User.TemPermissao("Manutencoes.Gerenciar"))
            return Forbid();

        var model = await _db.ManutencoesVeiculos.FindAsync(id);

        if (model == null)
            return NotFound();

        RegistrarAuditoria("ManutencaoVeiculo", model.Id, "Remover", $"{model.Tipo} | Veiculo {model.VeiculoId}");

        _db.ManutencoesVeiculos.Remove(model);

        await _db.SaveChangesAsync();

        return Ok();
    }

    private async Task<string?> ValidarAsync(ManutencaoVeiculoDto dto, IFormFile? anexo)
    {
        if (dto.VeiculoId <= 0)
            return "Selecione um veiculo.";

        var veiculo = await _db.Veiculos.FindAsync(dto.VeiculoId);

        if (veiculo == null || !veiculo.Ativo)
            return "Veiculo invalido.";

        if (string.IsNullOrWhiteSpace(dto.Tipo))
            return "Informe o tipo de manutencao.";

        if (dto.DataManutencao > DateTime.Now.AddMinutes(5))
            return "A data da manutencao nao pode ser futura.";

        if (dto.KmManutencao < 0)
            return "O KM da manutencao nao pode ser negativo.";

        if (dto.KmManutencao > veiculo.KmAtual + 10000)
            return $"O KM da manutencao parece muito acima do KM atual do veiculo ({veiculo.KmAtual}).";

        if (dto.Custo.HasValue && dto.Custo < 0)
            return "O custo nao pode ser negativo.";

        if (dto.ProximaManutencaoKm.HasValue && dto.ProximaManutencaoKm.Value <= dto.KmManutencao)
            return "O KM da proxima manutencao deve ser maior que o KM da manutencao atual.";

        if (dto.ProximaManutencaoData.HasValue && dto.ProximaManutencaoData.Value.Date < dto.DataManutencao.Date)
            return "A data da proxima manutencao nao pode ser anterior a data da manutencao atual.";

        if (anexo is { Length: > 0 })
        {
            var erroAnexo = ValidarAnexo(anexo);
            if (!string.IsNullOrWhiteSpace(erroAnexo))
                return erroAnexo;
        }

        return null;
    }

    private static string? ValidarAnexo(IFormFile arquivo)
    {
        const long tamanhoMaximo = 8 * 1024 * 1024;
        if (arquivo.Length > tamanhoMaximo)
            return "O anexo da manutencao deve ter no maximo 8 MB.";

        var extensao = Path.GetExtension(arquivo.FileName).ToLowerInvariant();
        var permitidas = new[] { ".jpg", ".jpeg", ".png", ".webp", ".pdf" };

        if (!permitidas.Contains(extensao))
            return "O anexo deve estar em JPG, PNG, WEBP ou PDF.";

        return null;
    }

    private static async Task AplicarAnexoAsync(ManutencaoVeiculo model, IFormFile arquivo)
    {
        using var ms = new MemoryStream();
        await arquivo.CopyToAsync(ms);
        model.AnexoArquivo = ms.ToArray();
        model.AnexoContentType = string.IsNullOrWhiteSpace(arquivo.ContentType)
            ? "application/octet-stream"
            : arquivo.ContentType;
        model.AnexoNome = Path.GetFileName(arquivo.FileName);
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

    private static List<AlertaManutencaoDto> CalcularAlertas(List<ManutencaoConsultaRow> manutencoes)
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
                    ? "PrÃ³xima"
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

    private class ManutencaoConsultaRow
    {
        public int Id { get; set; }
        public int VeiculoId { get; set; }
        public Veiculo? Veiculo { get; set; }
        public string Tipo { get; set; } = string.Empty;
        public DateTime DataManutencao { get; set; }
        public int KmManutencao { get; set; }
        public string? Descricao { get; set; }
        public decimal? Custo { get; set; }
        public int? ProximaManutencaoKm { get; set; }
        public DateTime? ProximaManutencaoData { get; set; }
        public DateTime CriadoEm { get; set; }
    }
}
