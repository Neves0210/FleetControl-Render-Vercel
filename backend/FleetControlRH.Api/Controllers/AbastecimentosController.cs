using System.Security.Claims;
using FleetControlRH.Api.Data;
using FleetControlRH.Api.DTOs;
using FleetControlRH.Api.Models;
using FleetControlRH.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FleetControlRH.Api.Extensions;

namespace FleetControlRH.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AbastecimentosController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly NotaFiscalService _notaFiscalService;

    public AbastecimentosController(AppDbContext db, NotaFiscalService notaFiscalService)
    {
        _db = db;
        _notaFiscalService = notaFiscalService;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int? veiculoId, [FromQuery] int? motoristaId)
    {
        var query = _db.Abastecimentos
            .Include(x => x.Veiculo)
            .Include(x => x.Motorista)
            .AsQueryable();

        if (UsuarioEhTecnico())
        {
            var motoristaLogadoId = ObterMotoristaIdUsuarioLogado();

            if (!motoristaLogadoId.HasValue)
                return Ok(new List<Abastecimento>());

            query = query.Where(x => x.MotoristaId == motoristaLogadoId.Value);
        }
        else
        {
            if (motoristaId.HasValue)
                query = query.Where(x => x.MotoristaId == motoristaId.Value);
        }

        if (veiculoId.HasValue)
            query = query.Where(x => x.VeiculoId == veiculoId.Value);

        return Ok(await query.OrderByDescending(x => x.DataAbastecimento).ToListAsync());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromForm] Abastecimento model, IFormFile? fotoNotaFiscal)
    {
        if (UsuarioEhTecnico())
        {
            var motoristaLogadoId = ObterMotoristaIdUsuarioLogado();

            if (!motoristaLogadoId.HasValue)
                return Forbid();

            model.MotoristaId = motoristaLogadoId.Value;
        }

        var veiculo = await _db.Veiculos.FindAsync(model.VeiculoId);

        if (veiculo == null || !veiculo.Ativo)
            return BadRequest(new { mensagem = "Veículo inválido." });

        if (model.KmAtual < veiculo.KmAtual)
        {
            return BadRequest(new
            {
                mensagem = $"Alerta: o KM atual informado ({model.KmAtual}) está menor que o KM anterior registrado para este veículo ({veiculo.KmAtual})."
            });
        }

        if (fotoNotaFiscal is { Length: > 0 })
            model.FotoNotaFiscalPath = await SalvarFotoAsync(fotoNotaFiscal);

        veiculo.KmAtual = model.KmAtual;

        _db.Abastecimentos.Add(model);

        await _db.SaveChangesAsync();

        return Ok(model);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromForm] Abastecimento model, IFormFile? fotoNotaFiscal)
    {
        if (!User.TemPermissao("Abastecimentos.Editar"))
            return Forbid();
            
        var abastecimento = await _db.Abastecimentos.FindAsync(id);

        if (abastecimento == null)
            return NotFound();

        var veiculo = await _db.Veiculos.FindAsync(model.VeiculoId);

        if (veiculo == null || !veiculo.Ativo)
            return BadRequest(new { mensagem = "Veículo inválido." });

        abastecimento.VeiculoId = model.VeiculoId;
        abastecimento.MotoristaId = model.MotoristaId;
        abastecimento.DataAbastecimento = model.DataAbastecimento;
        abastecimento.KmAtual = model.KmAtual;
        abastecimento.Litros = model.Litros;
        abastecimento.ValorTotal = model.ValorTotal;
        abastecimento.Posto = model.Posto;
        abastecimento.Observacao = model.Observacao;

        if (fotoNotaFiscal is { Length: > 0 })
            abastecimento.FotoNotaFiscalPath = await SalvarFotoAsync(fotoNotaFiscal);

        await _db.SaveChangesAsync();

        return Ok(abastecimento);
    }

    [HttpPost("analisar-nota")]
    public async Task<ActionResult<NotaFiscalAnaliseDto>> AnalisarNota([FromForm] string? urlConsulta)
    {
        if (string.IsNullOrWhiteSpace(urlConsulta))
        {
            return BadRequest(new NotaFiscalAnaliseDto
            {
                Sucesso = false,
                Mensagem = "Informe o link da NFC-e."
            });
        }

        var resultado = await _notaFiscalService.AnalisarUrlAsync(urlConsulta);

        await VincularVeiculoMotoristaAsync(resultado);

        return Ok(resultado);
    }

    private async Task VincularVeiculoMotoristaAsync(NotaFiscalAnaliseDto resultado)
    {
        if (!string.IsNullOrWhiteSpace(resultado.Placa))
        {
            var placa = resultado.Placa.Replace("-", "").ToUpperInvariant();

            var veiculos = await _db.Veiculos.ToListAsync();

            var veiculo = veiculos.FirstOrDefault(x =>
                (x.Placa ?? string.Empty).Replace("-", "").ToUpperInvariant() == placa);

            resultado.VeiculoId = veiculo?.Id;
        }

        if (!string.IsNullOrWhiteSpace(resultado.Motorista))
        {
            var nome = resultado.Motorista.ToUpperInvariant();

            var motoristas = await _db.Motoristas.ToListAsync();

            var motorista = motoristas.FirstOrDefault(x =>
                (x.Nome ?? string.Empty).ToUpperInvariant().Contains(nome));

            resultado.MotoristaId = motorista?.Id;
        }
    }

    private bool UsuarioEhTecnico()
    {
        return User.IsInRole("Tecnico");
    }

    private int? ObterMotoristaIdUsuarioLogado()
    {
        var motoristaIdClaim = User.Claims.FirstOrDefault(x => x.Type == "MotoristaId")?.Value;

        return int.TryParse(motoristaIdClaim, out var motoristaId)
            ? motoristaId
            : null;
    }

    private static async Task<string> SalvarFotoAsync(IFormFile arquivo)
    {
        var pasta = Path.Combine(
            Directory.GetCurrentDirectory(),
            "wwwroot",
            "uploads",
            "notas-fiscais"
        );

        Directory.CreateDirectory(pasta);

        var extensao = Path.GetExtension(arquivo.FileName).ToLowerInvariant();
        var nome = $"nota-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}{extensao}";
        var caminho = Path.Combine(pasta, nome);

        await using var stream = new FileStream(caminho, FileMode.Create);

        await arquivo.CopyToAsync(stream);

        return $"/uploads/notas-fiscais/{nome}";
    }
}