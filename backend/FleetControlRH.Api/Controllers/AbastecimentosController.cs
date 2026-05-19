using FleetControlRH.Api.Data;
using FleetControlRH.Api.DTOs;
using FleetControlRH.Api.Models;
using FleetControlRH.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
        var query = _db.Abastecimentos.Include(x => x.Veiculo).Include(x => x.Motorista).AsQueryable();
        if (veiculoId.HasValue) query = query.Where(x => x.VeiculoId == veiculoId.Value);
        if (motoristaId.HasValue) query = query.Where(x => x.MotoristaId == motoristaId.Value);
        return Ok(await query.OrderByDescending(x => x.DataAbastecimento).ToListAsync());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromForm] Abastecimento model, IFormFile? fotoNotaFiscal)
    {
        var veiculo = await _db.Veiculos.FindAsync(model.VeiculoId);
        if (veiculo == null || !veiculo.Ativo) return BadRequest(new { mensagem = "Veículo inválido." });
        if (model.KmAtual < veiculo.KmAtual) return BadRequest(new { mensagem = $"Alerta: o KM atual informado ({model.KmAtual}) está menor que o KM anterior registrado para este veículo ({veiculo.KmAtual})." });

        if (fotoNotaFiscal is { Length: > 0 }) model.FotoNotaFiscalPath = await SalvarFotoAsync(fotoNotaFiscal);

        veiculo.KmAtual = model.KmAtual;
        _db.Abastecimentos.Add(model);
        await _db.SaveChangesAsync();
        return Ok(model);
    }

    [HttpPost("analisar-nota")]
    public async Task<ActionResult<NotaFiscalAnaliseDto>> AnalisarNota(IFormFile? fotoNotaFiscal, [FromForm] string? urlConsulta)
    {
        NotaFiscalAnaliseDto resultado;

        if (!string.IsNullOrWhiteSpace(urlConsulta))
        {
            resultado = await _notaFiscalService.AnalisarUrlAsync(urlConsulta);
        }
        else if (fotoNotaFiscal != null && fotoNotaFiscal.Length > 0)
        {
            using var stream = fotoNotaFiscal.OpenReadStream();
            resultado = await _notaFiscalService.AnalisarAsync(stream);
        }
        else
        {
            return BadRequest(new NotaFiscalAnaliseDto
            {
                Sucesso = false,
                Mensagem = "Selecione uma imagem da nota fiscal ou cole a URL da NFC-e."
            });
        }

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

    private static async Task<string> SalvarFotoAsync(IFormFile arquivo)
    {
        var pasta = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "notas-fiscais");
        Directory.CreateDirectory(pasta);
        var extensao = Path.GetExtension(arquivo.FileName).ToLowerInvariant();
        var nome = $"nota-{DateTime.Now:yyyyMMddHHmmss}-{Guid.NewGuid():N}{extensao}";
        var caminho = Path.Combine(pasta, nome);
        await using var stream = new FileStream(caminho, FileMode.Create);
        await arquivo.CopyToAsync(stream);
        return $"/uploads/notas-fiscais/{nome}";
    }
}
