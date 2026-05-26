using FleetControlRH.Api.Data;
using FleetControlRH.Api.DTOs;
using FleetControlRH.Api.Extensions;
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
    private readonly NfceReaderService _nfceReaderService;

    public AbastecimentosController(AppDbContext db, NotaFiscalService notaFiscalService, NfceReaderService nfceReaderService)
    {
        _db = db;
        _notaFiscalService = notaFiscalService;
        _nfceReaderService = nfceReaderService;
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

        var abastecimentos = await query
            .OrderByDescending(x => x.DataAbastecimento)
            .ToListAsync();

        return Ok(abastecimentos);
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

        var erro = await ValidarAbastecimentoAsync(model, fotoNotaFiscal, exigirFoto: true, abastecimentoIdIgnorado: null);

        if (!string.IsNullOrWhiteSpace(erro))
            return BadRequest(new { mensagem = erro });

        var veiculo = await _db.Veiculos.FindAsync(model.VeiculoId);

        if (fotoNotaFiscal is { Length: > 0 })
            model.FotoNotaFiscalPath = await SalvarFotoAsync(fotoNotaFiscal);

        veiculo!.KmAtual = model.KmAtual;
        model.CriadoEm = DateTime.UtcNow;

        _db.Abastecimentos.Add(model);

        await _db.SaveChangesAsync();

        return Ok(model);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromForm] Abastecimento model, IFormFile? fotoNotaFiscal)
    {
        if (!UsuarioPodeEditarAbastecimento())
            return Forbid();

        var abastecimento = await _db.Abastecimentos.FindAsync(id);

        if (abastecimento == null)
            return NotFound();

        var exigirFoto = string.IsNullOrWhiteSpace(abastecimento.FotoNotaFiscalPath);

        var erro = await ValidarAbastecimentoAsync(model, fotoNotaFiscal, exigirFoto, id);

        if (!string.IsNullOrWhiteSpace(erro))
            return BadRequest(new { mensagem = erro });

        var veiculoIdAnterior = abastecimento.VeiculoId;

        abastecimento.VeiculoId = model.VeiculoId;
        abastecimento.MotoristaId = model.MotoristaId;
        abastecimento.DataAbastecimento = model.DataAbastecimento;
        abastecimento.KmAtual = model.KmAtual;
        abastecimento.Litros = model.Litros;
        abastecimento.ValorTotal = model.ValorTotal;
        abastecimento.Posto = model.Posto?.Trim();
        abastecimento.Observacao = model.Observacao;

        if (fotoNotaFiscal is { Length: > 0 })
            abastecimento.FotoNotaFiscalPath = await SalvarFotoAsync(fotoNotaFiscal);

        await RecalcularKmAtualVeiculoAsync(model.VeiculoId);

        if (veiculoIdAnterior != model.VeiculoId)
            await RecalcularKmAtualVeiculoAsync(veiculoIdAnterior);

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


    [HttpPost("analisar-nota-imagem-robusta")]
    public async Task<ActionResult<NotaFiscalAnaliseDto>> AnalisarNotaImagemRobusta(IFormFile fotoNotaFiscal)
    {
        if (fotoNotaFiscal == null || fotoNotaFiscal.Length == 0)
        {
            return BadRequest(new NotaFiscalAnaliseDto
            {
                Sucesso = false,
                Mensagem = "Envie a foto da nota fiscal inteira."
            });
        }

        var erroArquivo = ValidarFotoNotaFiscal(fotoNotaFiscal);

        if (!string.IsNullOrWhiteSpace(erroArquivo))
        {
            return BadRequest(new NotaFiscalAnaliseDto
            {
                Sucesso = false,
                Mensagem = erroArquivo
            });
        }

        var leitura = await _nfceReaderService.AnalisarImagemAsync(fotoNotaFiscal);

        var resultado = new NotaFiscalAnaliseDto
        {
            Sucesso = leitura.Sucesso,
            Mensagem = leitura.Mensagem ?? (leitura.Sucesso ? "NFC-e analisada com sucesso." : "Não foi possível analisar a NFC-e."),
            UrlConsulta = leitura.UrlConsulta,
            ChaveAcesso = leitura.ChaveAcesso,
            Posto = leitura.DadosExtraidos.Posto,
            Combustivel = leitura.DadosExtraidos.Combustivel,
            Litros = leitura.DadosExtraidos.Litros,
            ValorTotal = leitura.DadosExtraidos.ValorTotal,
            TextoExtraido = leitura.DadosExtraidos.TextoBruto ?? leitura.DadosExtraidos.TextoOcr
        };

        if (!string.IsNullOrWhiteSpace(resultado.UrlConsulta))
        {
            var dadosDoSite = await _notaFiscalService.AnalisarUrlAsync(resultado.UrlConsulta);

            if (dadosDoSite.Sucesso)
            {
                resultado.Sucesso = true;
                resultado.Posto ??= dadosDoSite.Posto;
                resultado.Combustivel ??= dadosDoSite.Combustivel;
                resultado.Litros ??= dadosDoSite.Litros;
                resultado.ValorTotal ??= dadosDoSite.ValorTotal;
                resultado.KmAtual ??= dadosDoSite.KmAtual;
                resultado.DataAbastecimento ??= dadosDoSite.DataAbastecimento;
                resultado.Placa ??= dadosDoSite.Placa;
                resultado.Motorista ??= dadosDoSite.Motorista;
                resultado.TextoExtraido ??= dadosDoSite.TextoExtraido;
            }
        }

        await VincularVeiculoMotoristaAsync(resultado);

        return Ok(new
        {
            resultado.Sucesso,
            resultado.Mensagem,
            metodo = leitura.Metodo,
            confianca = leitura.Confianca,
            resultado.VeiculoId,
            resultado.MotoristaId,
            resultado.UrlConsulta,
            resultado.ChaveAcesso,
            resultado.Placa,
            resultado.Motorista,
            resultado.Posto,
            resultado.Combustivel,
            resultado.Litros,
            resultado.ValorTotal,
            resultado.KmAtual,
            resultado.DataAbastecimento,
            resultado.TextoExtraido,
            dadosExtraidos = leitura.DadosExtraidos
        });
    }

    [HttpPost("ler-qrcode-imagem")]
    public async Task<IActionResult> LerQrCodeImagem(IFormFile imagemQrCode)
    {
        if (imagemQrCode == null || imagemQrCode.Length == 0)
        {
            return BadRequest(new
            {
                sucesso = false,
                mensagem = "Envie a imagem do QR Code."
            });
        }

        using var stream = imagemQrCode.OpenReadStream();

        var url = await _notaFiscalService.LerQrCodeDaImagemAsync(stream);

        if (string.IsNullOrWhiteSpace(url))
        {
            return Ok(new
            {
                sucesso = false,
                mensagem = "Não foi possível encontrar um QR Code válido na imagem."
            });
        }

        return Ok(new
        {
            sucesso = true,
            mensagem = "QR Code lido com sucesso.",
            url
        });
    }

    private async Task<string?> ValidarAbastecimentoAsync(
        Abastecimento model,
        IFormFile? fotoNotaFiscal,
        bool exigirFoto,
        int? abastecimentoIdIgnorado)
    {
        if (model.VeiculoId <= 0)
            return "Selecione um veículo.";

        if (model.MotoristaId <= 0)
            return "Selecione um motorista/técnico.";

        if (model.Litros <= 0)
            return "A quantidade de litros deve ser maior que zero.";

        if (model.ValorTotal <= 0)
            return "O valor total deve ser maior que zero.";

        if (model.KmAtual <= 0)
            return "O KM atual deve ser maior que zero.";

        if (model.DataAbastecimento > DateTime.Now.AddMinutes(5))
            return "A data do abastecimento não pode ser futura.";

        var veiculo = await _db.Veiculos.FindAsync(model.VeiculoId);

        if (veiculo == null || !veiculo.Ativo)
            return "Veículo inválido.";

        var motorista = await _db.Motoristas.FindAsync(model.MotoristaId);

        if (motorista == null || !motorista.Ativo)
            return "Motorista/técnico inválido.";

        var ultimoKm = await _db.Abastecimentos
            .Where(x => x.VeiculoId == model.VeiculoId && (!abastecimentoIdIgnorado.HasValue || x.Id != abastecimentoIdIgnorado.Value))
            .OrderByDescending(x => x.DataAbastecimento)
            .ThenByDescending(x => x.Id)
            .Select(x => (int?)x.KmAtual)
            .FirstOrDefaultAsync();

        var kmReferencia = ultimoKm ?? veiculo.KmAtual;

        if (model.KmAtual <= kmReferencia)
        {
            return $"O KM atual informado ({model.KmAtual}) deve ser maior que o KM anterior do veículo ({kmReferencia}).";
        }

        if (exigirFoto && (fotoNotaFiscal == null || fotoNotaFiscal.Length == 0))
            return "A foto da nota fiscal é obrigatória.";

        if (fotoNotaFiscal is { Length: > 0 })
        {
            var erroArquivo = ValidarFotoNotaFiscal(fotoNotaFiscal);

            if (!string.IsNullOrWhiteSpace(erroArquivo))
                return erroArquivo;
        }

        return null;
    }

    private static string? ValidarFotoNotaFiscal(IFormFile arquivo)
    {
        var extensao = Path.GetExtension(arquivo.FileName).ToLowerInvariant();

        var extensoesPermitidas = new[] { ".jpg", ".jpeg", ".png", ".webp" };

        if (!extensoesPermitidas.Contains(extensao))
            return "A foto da nota fiscal deve estar nos formatos JPG, JPEG, PNG ou WEBP.";

        const long tamanhoMaximo = 5 * 1024 * 1024;

        if (arquivo.Length > tamanhoMaximo)
            return "A foto da nota fiscal deve ter no máximo 5 MB.";

        return null;
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


    private bool UsuarioPodeEditarAbastecimento()
    {
        return User.IsInRole("Master") ||
               User.IsInRole("RH") ||
               User.TemPermissao("Abastecimentos.Editar");
    }

    private async Task RecalcularKmAtualVeiculoAsync(int veiculoId)
    {
        var veiculo = await _db.Veiculos.FindAsync(veiculoId);

        if (veiculo == null)
            return;

        var maiorKmAbastecimento = await _db.Abastecimentos
            .Where(x => x.VeiculoId == veiculoId)
            .Select(x => (int?)x.KmAtual)
            .MaxAsync();

        if (maiorKmAbastecimento.HasValue)
            veiculo.KmAtual = maiorKmAbastecimento.Value;
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
