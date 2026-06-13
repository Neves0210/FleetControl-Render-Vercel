using FleetControlRH.Api.Data;
using FleetControlRH.Api.DTOs;
using FleetControlRH.Api.Extensions;
using FleetControlRH.Api.Models;
using FleetControlRH.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

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
            .Include(x => x.Combustiveis)
            .AsNoTracking()
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
                x.Observacao,
                x.DataAbastecimento,
                x.CriadoEm,
                combustiveis = x.Combustiveis
                    .OrderBy(c => c.Ordem)
                    .Select(c => new
                    {
                        c.Id,
                        c.DescricaoCombustivel,
                        c.Litros,
                        c.ValorUnitario,
                        c.ValorTotal,
                        c.Ordem
                    })
                    .ToList(),
                temFoto = x.FotoNotaFiscal != null
            })
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

        NormalizarCombustiveis(model);

        var erro = await ValidarAbastecimentoAsync(model, fotoNotaFiscal, exigirFoto: true, abastecimentoIdIgnorado: null);

        if (!string.IsNullOrWhiteSpace(erro))
            return BadRequest(new { mensagem = erro });

        var veiculo = await _db.Veiculos.FindAsync(model.VeiculoId);

        if (fotoNotaFiscal is { Length: > 0 })
        {
            var (bytes, contentType) = await LerFotoAsync(fotoNotaFiscal);
            model.FotoNotaFiscal = bytes;
            model.FotoNotaFiscalContentType = contentType;
        }

        veiculo!.KmAtual = model.KmAtual;
        model.CriadoEm = DateTime.UtcNow;

        _db.Abastecimentos.Add(model);

        await _db.SaveChangesAsync();

        RegistrarAuditoria("Abastecimento", model.Id, "Criar", $"Veiculo {model.VeiculoId} | Motorista {model.MotoristaId} | {model.ValorTotal:C}");
        await _db.SaveChangesAsync();

        return Ok(model);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromForm] Abastecimento model, IFormFile? fotoNotaFiscal)
    {
        if (!UsuarioPodeEditarAbastecimento())
            return Forbid();

        var abastecimento = await _db.Abastecimentos
            .Include(x => x.Combustiveis)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (abastecimento == null)
            return NotFound();

        var exigirFoto = abastecimento.FotoNotaFiscal == null || abastecimento.FotoNotaFiscal.Length == 0;

        NormalizarCombustiveis(model);

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
        abastecimento.Combustiveis.Clear();

        foreach (var combustivel in model.Combustiveis)
        {
            abastecimento.Combustiveis.Add(combustivel);
        }

        if (fotoNotaFiscal is { Length: > 0 })
        {
            var (bytes, contentType) = await LerFotoAsync(fotoNotaFiscal);
            abastecimento.FotoNotaFiscal = bytes;
            abastecimento.FotoNotaFiscalContentType = contentType;
        }

        await RecalcularKmAtualVeiculoAsync(model.VeiculoId);

        if (veiculoIdAnterior != model.VeiculoId)
            await RecalcularKmAtualVeiculoAsync(veiculoIdAnterior);

        await _db.SaveChangesAsync();

        RegistrarAuditoria("Abastecimento", abastecimento.Id, "Editar", $"Veiculo {abastecimento.VeiculoId} | Motorista {abastecimento.MotoristaId} | {abastecimento.ValorTotal:C}");
        await _db.SaveChangesAsync();

        return Ok(abastecimento);
    }

    [HttpGet("{id:int}/foto")]
    public async Task<IActionResult> ObterFoto(int id)
    {
        var foto = await _db.Abastecimentos
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new { x.FotoNotaFiscal, x.FotoNotaFiscalContentType })
            .FirstOrDefaultAsync();

        if (foto?.FotoNotaFiscal == null || foto.FotoNotaFiscal.Length == 0)
            return NotFound();

        return File(foto.FotoNotaFiscal, foto.FotoNotaFiscalContentType ?? "image/jpeg");
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

    [HttpGet("aquecer-leitor")]
    public async Task<IActionResult> AquecerLeitor()
    {
        var ok = await _nfceReaderService.AquecerAsync();
        return Ok(new { ok });
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
            Combustiveis = leitura.DadosExtraidos.Combustiveis
                .Select(x => new NotaFiscalCombustivelDto
                {
                    Tipo = x.Tipo,
                    Litros = x.Litros,
                    ValorUnitario = x.ValorUnitario,
                    ValorTotal = x.ValorTotal
                })
                .ToList(),
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
                if (resultado.Combustiveis.Count == 0 && dadosDoSite.Combustiveis.Count > 0)
                    resultado.Combustiveis = dadosDoSite.Combustiveis;
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
            resultado.Combustiveis,
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

        if (model.Combustiveis.Count == 0)
            return "Informe ao menos um combustivel do abastecimento.";

        foreach (var combustivel in model.Combustiveis)
        {
            if (string.IsNullOrWhiteSpace(combustivel.DescricaoCombustivel))
                return "Informe o tipo de combustivel.";

            if (combustivel.DescricaoCombustivel.Length > 80)
                return "O tipo de combustivel deve ter no maximo 80 caracteres.";

            if (combustivel.Litros <= 0)
                return "A quantidade de litros do combustivel deve ser maior que zero.";

            if (combustivel.ValorTotal <= 0)
                return "O valor do combustivel deve ser maior que zero.";

            if (combustivel.ValorUnitario.HasValue && combustivel.ValorUnitario <= 0)
                return "O valor unitario do combustivel deve ser maior que zero.";
        }

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

    private static void NormalizarCombustiveis(Abastecimento model)
    {
        var combustiveis = model.Combustiveis
            .Where(x => !string.IsNullOrWhiteSpace(x.DescricaoCombustivel) || x.Litros > 0 || x.ValorTotal > 0)
            .Select((x, index) => new AbastecimentoCombustivel
            {
                DescricaoCombustivel = (x.DescricaoCombustivel ?? string.Empty).Trim().ToUpperInvariant(),
                Litros = decimal.Round(x.Litros, 3),
                ValorUnitario = x.ValorUnitario.HasValue ? decimal.Round(x.ValorUnitario.Value, 3) : CalcularValorUnitario(x.Litros, x.ValorTotal),
                ValorTotal = decimal.Round(x.ValorTotal, 2),
                Ordem = index + 1
            })
            .ToList();

        if (combustiveis.Count == 0 && model.Litros > 0 && model.ValorTotal > 0)
        {
            combustiveis.Add(new AbastecimentoCombustivel
            {
                DescricaoCombustivel = "NAO INFORMADO",
                Litros = decimal.Round(model.Litros, 3),
                ValorUnitario = CalcularValorUnitario(model.Litros, model.ValorTotal),
                ValorTotal = decimal.Round(model.ValorTotal, 2),
                Ordem = 1
            });
        }

        model.Combustiveis = combustiveis;
        model.Litros = combustiveis.Sum(x => x.Litros);
        model.ValorTotal = combustiveis.Sum(x => x.ValorTotal);
    }

    private static decimal? CalcularValorUnitario(decimal litros, decimal valorTotal)
    {
        if (litros <= 0 || valorTotal <= 0)
            return null;

        return decimal.Round(valorTotal / litros, 3);
    }

    private static string? ValidarFotoNotaFiscal(IFormFile arquivo)
    {
        var extensao = Path.GetExtension(arquivo.FileName).ToLowerInvariant();

        var extensoesPermitidas = new[] { ".jpg", ".jpeg", ".png", ".webp" };

        if (!extensoesPermitidas.Contains(extensao))
            return "A foto da nota fiscal deve estar nos formatos JPG, JPEG, PNG ou WEBP.";

        var contentTypesPermitidos = new[] { "image/jpeg", "image/png", "image/webp" };

        if (string.IsNullOrWhiteSpace(arquivo.ContentType) ||
            !contentTypesPermitidos.Contains(arquivo.ContentType.ToLowerInvariant()))
            return "O tipo do arquivo enviado nao e uma imagem permitida.";

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

            var veiculo = await _db.Veiculos
                .AsNoTracking()
                .FirstOrDefaultAsync(x => (x.Placa ?? string.Empty).Replace("-", "").ToUpper() == placa);

            resultado.VeiculoId = veiculo?.Id;
        }

        if (!string.IsNullOrWhiteSpace(resultado.Motorista))
        {
            var nome = resultado.Motorista.ToUpperInvariant();

            var motorista = await _db.Motoristas
                .AsNoTracking()
                .FirstOrDefaultAsync(x => (x.Nome ?? string.Empty).ToUpper().Contains(nome));

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

    private static async Task<(byte[] bytes, string contentType)> LerFotoAsync(IFormFile arquivo)
    {
        using var ms = new MemoryStream();
        await arquivo.CopyToAsync(ms);
        var contentType = string.IsNullOrWhiteSpace(arquivo.ContentType) ? "image/jpeg" : arquivo.ContentType;
        return (ms.ToArray(), contentType);
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
}
