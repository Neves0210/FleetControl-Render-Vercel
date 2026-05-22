using System.Globalization;
using System.Text.RegularExpressions;
using FleetControlRH.Api.DTOs;
using HtmlAgilityPack;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using ZXing;
using ZXing.Common;

namespace FleetControlRH.Api.Services;

public class NotaFiscalService
{
    private readonly HttpClient _httpClient;

    public NotaFiscalService(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(20);
        if (!_httpClient.DefaultRequestHeaders.UserAgent.Any())
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 FleetControlRH/1.0");
    }

    public async Task<NotaFiscalAnaliseDto> AnalisarAsync(Stream imagemStream)
    {
        var url = LerQrCode(imagemStream);

        if (string.IsNullOrWhiteSpace(url))
        {
            return new NotaFiscalAnaliseDto
            {
                Sucesso = false,
                Mensagem = "QR Code não encontrado. Use a opção de colar a URL da NFC-e como alternativa."
            };
        }

        return await AnalisarUrlAsync(url);
    }

    public async Task<NotaFiscalAnaliseDto> AnalisarUrlAsync(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return new NotaFiscalAnaliseDto
            {
                Sucesso = false,
                Mensagem = "URL da NFC-e não informada."
            };
        }

        url = url.Trim();

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return new NotaFiscalAnaliseDto
            {
                Sucesso = false,
                Mensagem = "URL da NFC-e inválida."
            };
        }

        try
        {
            var html = await _httpClient.GetStringAsync(uri);
            return ExtrairDadosDoHtml(html, url);
        }
        catch (Exception ex)
        {
            return new NotaFiscalAnaliseDto
            {
                Sucesso = false,
                Mensagem = "Não foi possível consultar a NFC-e: " + ex.Message,
                UrlConsulta = url
            };
        }
    }

    private string? LerQrCode(Stream stream)
    {
        stream.Position = 0;
        using var original = Image.Load<Rgba32>(stream);
        original.Mutate(x => x.AutoOrient());

        // Tenta a imagem inteira e recortes prováveis do QR Code.
        var tentativas = new List<Image<Rgba32>>();
        tentativas.Add(original.Clone());

        var w = original.Width;
        var h = original.Height;

        // Recorte da metade inferior, onde geralmente fica o QR Code da NFC-e.
        tentativas.Add(original.Clone(ctx => ctx.Crop(new Rectangle(0, h / 3, w, h - (h / 3)))));

        // Recorte inferior esquerdo, padrão mais comum nas notas impressas.
        tentativas.Add(original.Clone(ctx => ctx.Crop(new Rectangle(0, h / 3, Math.Max(1, w / 2), h - (h / 3)))));

        // Recorte central/inferior mais amplo.
        tentativas.Add(original.Clone(ctx => ctx.Crop(new Rectangle(0, h / 4, w, h - (h / 4)))));

        foreach (var img in tentativas)
        {
            using (img)
            {
                foreach (var scale in new[] { 1, 2, 3, 4 })
                {
                    using var clone = img.Clone(ctx =>
                    {
                        ctx.Resize(img.Width * scale, img.Height * scale);
                        ctx.Grayscale();
                        ctx.Contrast(1.4f);
                    });

                    var result = DecodificarQr(clone);
                    if (!string.IsNullOrWhiteSpace(result))
                        return result;
                }
            }
        }

        return null;
    }

    private static string? DecodificarQr(Image<Rgba32> image)
    {
        var pixels = new byte[image.Width * image.Height];
        var rgbaPixels = new Rgba32[image.Width * image.Height];
        image.CopyPixelDataTo(rgbaPixels);

        for (var i = 0; i < rgbaPixels.Length; i++)
        {
            var p = rgbaPixels[i];
            pixels[i] = (byte)((p.R + p.G + p.B) / 3);
        }

        var source = new RGBLuminanceSource(
            pixels,
            image.Width,
            image.Height,
            RGBLuminanceSource.BitmapFormat.Gray8);

        var reader = new BarcodeReaderGeneric
        {
            AutoRotate = true,
            Options = new DecodingOptions
            {
                TryHarder = true,
                TryInverted = true,
                PossibleFormats = new List<BarcodeFormat> { BarcodeFormat.QR_CODE }
            }
        };

        var result = reader.Decode(source);
        return result?.Text;
    }

    private NotaFiscalAnaliseDto ExtrairDadosDoHtml(string html, string url)
    {
        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        var texto = HtmlEntity.DeEntitize(doc.DocumentNode.InnerText ?? string.Empty);
        texto = NormalizarTexto(texto);

        var resultado = AnalisarTexto(texto);
        resultado.UrlConsulta = url;
        resultado.ChaveAcesso = ExtrairChaveAcesso(url, texto);
        resultado.Mensagem = resultado.Sucesso
            ? "NFC-e consultada com sucesso. Confira os dados antes de salvar."
            : resultado.Mensagem;

        return resultado;
    }

    public NotaFiscalAnaliseDto AnalisarTexto(string texto)
    {
        texto = NormalizarTexto(texto);

        return new NotaFiscalAnaliseDto
        {
            Sucesso = true,
            Mensagem = "Nota analisada. Confira os dados antes de salvar.",
            TextoExtraido = texto,
            Placa = ExtrairPlaca(texto),
            Motorista = ExtrairMotorista(texto),
            Posto = ExtrairPosto(texto),
            Combustivel = ExtrairCombustivel(texto),
            Litros = ExtrairLitros(texto),
            ValorTotal = ExtrairValorTotal(texto),
            KmAtual = ExtrairKm(texto),
            DataAbastecimento = ExtrairData(texto)
        };
    }

    // Mantido para compatibilidade com testes antigos por nome de arquivo.
    public NotaFiscalAnaliseDto AnalisarNomeArquivo(string nomeArquivo)
    {
        var texto = nomeArquivo.Replace("_", " ").Replace("-", " ");
        var resultado = AnalisarTexto(texto);
        resultado.Mensagem = "Análise feita por nome do arquivo.";
        return resultado;
    }

    private static string NormalizarTexto(string texto)
    {
        texto = Regex.Replace(texto ?? string.Empty, @"\s+", " ");
        return texto.Trim();
    }

    private static string? ExtrairChaveAcesso(string url, string texto)
    {
        var urlMatch = Regex.Match(url, @"p=([0-9]{44})", RegexOptions.IgnoreCase);
        if (urlMatch.Success) return urlMatch.Groups[1].Value;

        var textoMatch = Regex.Match(texto, @"\b([0-9]{44})\b");
        return textoMatch.Success ? textoMatch.Groups[1].Value : null;
    }

    private static string? ExtrairPlaca(string texto)
    {
        var match = Regex.Match(texto, @"(?i)\bPLACA\s*[:\-]?\s*([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\b");
        if (match.Success) return match.Groups[1].Value.ToUpperInvariant();

        match = Regex.Match(texto, @"\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\b", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value.ToUpperInvariant() : null;
    }

    private static string? ExtrairMotorista(string texto)
    {
        var match = Regex.Match(texto, @"(?i)MOTORISTA\s*[:\-]?\s*([A-ZÀ-ÿ\s]+?)(?:\s*\||\s*OPERADOR|\s*TRIB|\s*$)");
        return match.Success ? match.Groups[1].Value.Trim() : null;
    }

    private static string? ExtrairPosto(string texto)
    {
        var match = Regex.Match(texto, @"(?i)(POSTO\s+[A-ZÀ-ÿ0-9\s\.]+?\s+(?:LTDA|ME|EIRELI|S\/A|SA))");
        if (match.Success) return Limpar(match.Groups[1].Value);

        match = Regex.Match(texto, @"(?i)(POSTO\s+[A-ZÀ-ÿ0-9\s\.]{5,80})");
        return match.Success ? Limpar(match.Groups[1].Value) : null;
    }

    private static string? ExtrairCombustivel(string texto)
    {
        var match = Regex.Match(texto, @"(?i)(ETANOL\s+COMUM|ETANOL|GASOLINA\s+COMUM|GASOLINA|DIESEL\s+S?10|DIESEL\s+S?500|DIESEL)");
        return match.Success ? Limpar(match.Groups[1].Value).ToUpperInvariant() : null;
    }

    private static decimal? ExtrairLitros(string texto)
    {
        var patterns = new[]
        {
            // Padrão real da NFC-e SP:
            // Qtde.:44,251 UN: L
            @"(?i)Qtde\.?\s*:\s*(\d{1,5}[,.]\d{1,3})\s*UN\s*:\s*L",

            // Produto + quantidade
            // ETANOL COMUM ... Qtde.:44,251 UN: L
            @"(?i)(ETANOL|GASOLINA|DIESEL|ALCOOL|ÁLCOOL).*?Qtde\.?\s*:\s*(\d{1,5}[,.]\d{1,3})",

            // Fallback
            @"(?i)\b(\d{1,5}[,.]\d{3})\b\s*UN\s*:\s*L"
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(texto, pattern, RegexOptions.Singleline);

            if (!match.Success)
                continue;

            foreach (Group group in match.Groups)
            {
                var valor = group.Value.Trim();

                if (Regex.IsMatch(valor, @"^\d{1,5}[,.]\d{1,3}$") &&
                    TryParseDecimalBr(valor, out var litros))
                {
                    return litros;
                }
            }
        }

        return null;
    }

    private static decimal? ExtrairValorTotal(string texto)
    {
        var patterns = new[]
        {
            @"(?i)Valor\s*total\s*R?\$?\s*(\d{1,6}[,.]\d{2})",
            @"(?i)Valor\s*a\s*Pagar\s*R?\$?\s*(\d{1,6}[,.]\d{2})",
            @"(?i)VALOR\s*PAGO\s*R?\$?\s*(\d{1,6}[,.]\d{2})",
            @"(?i)Valor\s*da\s*Nota\s*R?\$?\s*(\d{1,6}[,.]\d{2})",
            @"(?i)Total\s*R?\$?\s*(\d{1,6}[,.]\d{2})"
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(texto, pattern);
            if (match.Success && TryParseDecimalBr(match.Groups[1].Value, out var value))
                return value;
        }

        var valores = Regex.Matches(texto, @"\b\d{1,6}[,.]\d{2}\b")
            .Select(x => TryParseDecimalBr(x.Value, out var value) ? value : 0)
            .Where(x => x > 20 && x < 5000)
            .ToList();

        return valores.Count > 0 ? valores.Max() : null;
    }

    private static int? ExtrairKm(string texto)
    {
        var patterns = new[]
        {
            @"(?i)\bKM\s*[:\-]?\s*(\d{3,8})\b",
            @"(?i)PLACA\s*[:\-]?\s*[A-Z0-9]{7}\s*\|?\s*KM\s*[:\-]?\s*(\d{3,8})\b",
            @"(?i)\b(\d{3,8})\s*MED\b"
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(texto, pattern, RegexOptions.Singleline);
            if (match.Success && int.TryParse(match.Groups[1].Value, out var value))
                return value;
        }

        return null;
    }

    private static DateTime? ExtrairData(string texto)
    {
        var patterns = new[]
        {
            @"\b(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})\b",
            @"\b(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})\b",
            @"\b(\d{2}/\d{2}/\d{4})\b"
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(texto, pattern);
            if (!match.Success) continue;

            var value = match.Groups[1].Value;
            var formats = new[] { "dd/MM/yyyy HH:mm:ss", "dd/MM/yyyy HH:mm", "dd/MM/yyyy" };
            if (DateTime.TryParseExact(value, formats, new CultureInfo("pt-BR"), DateTimeStyles.None, out var data))
                return data;
        }

        return null;
    }

    private static bool TryParseDecimalBr(string? valor, out decimal resultado)
    {
        resultado = 0;

        if (string.IsNullOrWhiteSpace(valor))
            return false;

        valor = valor.Trim();

        if (valor.Contains(','))
        {
            valor = valor.Replace(".", "").Replace(",", ".");
        }

        return decimal.TryParse(
            valor,
            NumberStyles.Any,
            CultureInfo.InvariantCulture,
            out resultado
        );
    }

    private static string Limpar(string valor)
        {
            return Regex.Replace(valor, @"\s+", " ").Trim();
        }
    public async Task<string?> LerQrCodeDaImagemAsync(Stream imagemStream)
        {
            await Task.CompletedTask;

            return LerQrCode(imagemStream);
        }
}
