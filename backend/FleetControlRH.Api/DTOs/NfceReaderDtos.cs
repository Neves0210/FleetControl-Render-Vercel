using System.Text.Json.Serialization;

namespace FleetControlRH.Api.DTOs;

public class NfceReaderResponseDto
{
    [JsonPropertyName("sucesso")]
    public bool Sucesso { get; set; }

    [JsonPropertyName("metodo")]
    public string Metodo { get; set; } = string.Empty;

    [JsonPropertyName("chaveAcesso")]
    public string? ChaveAcesso { get; set; }

    [JsonPropertyName("urlConsulta")]
    public string? UrlConsulta { get; set; }

    [JsonPropertyName("dadosExtraidos")]
    public NfceDadosExtraidosDto DadosExtraidos { get; set; } = new();

    [JsonPropertyName("confianca")]
    public double Confianca { get; set; }

    [JsonPropertyName("mensagem")]
    public string? Mensagem { get; set; }
}

public class NfceDadosExtraidosDto
{
    [JsonPropertyName("posto")]
    public string? Posto { get; set; }

    [JsonPropertyName("valorTotal")]
    public decimal? ValorTotal { get; set; }

    [JsonPropertyName("litros")]
    public decimal? Litros { get; set; }

    [JsonPropertyName("combustivel")]
    public string? Combustivel { get; set; }

    [JsonPropertyName("textoBruto")]
    public string? TextoBruto { get; set; }

    [JsonPropertyName("erroConsulta")]
    public string? ErroConsulta { get; set; }

    [JsonPropertyName("textoOcr")]
    public string? TextoOcr { get; set; }

    [JsonPropertyName("tempoProcessamentoSegundos")]
    public double? TempoProcessamentoSegundos { get; set; }
}
