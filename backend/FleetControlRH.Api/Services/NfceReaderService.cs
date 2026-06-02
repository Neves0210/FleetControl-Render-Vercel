using System.Net.Http.Headers;
using System.Text.Json;
using FleetControlRH.Api.DTOs;

namespace FleetControlRH.Api.Services;

public class NfceReaderService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public NfceReaderService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _httpClient.Timeout = TimeSpan.FromSeconds(120);
    }

    public async Task<NfceReaderResponseDto> AnalisarImagemAsync(IFormFile fotoNotaFiscal)
    {
        var baseUrl =
            Environment.GetEnvironmentVariable("NFCE_READER_URL") ??
            _configuration["NfceReader:BaseUrl"];

        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return new NfceReaderResponseDto
            {
                Sucesso = false,
                Metodo = "Configuracao",
                Mensagem = "NFCE_READER_URL não configurada."
            };
        }

        try
        {
            await using var memoryStream = new MemoryStream();

            await fotoNotaFiscal.CopyToAsync(memoryStream);

            var imageBytes = memoryStream.ToArray();

            using var content = new MultipartFormDataContent();

            using var imageContent = new ByteArrayContent(imageBytes);

            imageContent.Headers.ContentType = new MediaTypeHeaderValue(
                string.IsNullOrWhiteSpace(fotoNotaFiscal.ContentType)
                    ? "image/jpeg"
                    : fotoNotaFiscal.ContentType
            );

            content.Add(
                imageContent,
                "file",
                string.IsNullOrWhiteSpace(fotoNotaFiscal.FileName)
                    ? "nota-fiscal.jpg"
                    : fotoNotaFiscal.FileName
            );

            var endpoint = $"{baseUrl.TrimEnd('/')}/api/nfce/analisar-imagem";

            using var response = await _httpClient.PostAsync(endpoint, content);

            var json = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                return new NfceReaderResponseDto
                {
                    Sucesso = false,
                    Metodo = "ErroHttp",
                    Mensagem = $"Erro no microserviço NFC-e: {(int)response.StatusCode} - {json}"
                };
            }

            var result = JsonSerializer.Deserialize<NfceReaderResponseDto>(
                json,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }
            );

            return result ?? new NfceReaderResponseDto
            {
                Sucesso = false,
                Metodo = "RespostaInvalida",
                Mensagem = "O microserviço NFC-e retornou uma resposta inválida."
            };
        }
        catch (TaskCanceledException)
        {
            return new NfceReaderResponseDto
            {
                Sucesso = false,
                Metodo = "Timeout",
                Mensagem = "A leitura da NFC-e demorou demais. Tente uma foto mais próxima, nítida e bem iluminada."
            };
        }
        catch (HttpRequestException ex)
        {
            return new NfceReaderResponseDto
            {
                Sucesso = false,
                Metodo = "ErroConexao",
                Mensagem = "Não foi possível conectar ao leitor NFC-e: " + ex.Message
            };
        }
        catch (Exception ex)
        {
            return new NfceReaderResponseDto
            {
                Sucesso = false,
                Metodo = "ErroInterno",
                Mensagem = "Erro ao chamar o leitor NFC-e: " + ex.Message
            };
        }
    }
    public async Task<bool> AquecerAsync()
    {
        var baseUrl = Environment.GetEnvironmentVariable("NFCE_READER_URL")
                    ?? _configuration["NfceReader:BaseUrl"];

        if (string.IsNullOrWhiteSpace(baseUrl)) return false;

        try
        {
            using var resp = await _httpClient.GetAsync($"{baseUrl.TrimEnd('/')}/health");
            return resp.IsSuccessStatusCode;
        }
        catch
        {
            return false; // se o serviço ainda está acordando, não tem problema
        }
    }
}