namespace FleetControlRH.Api.DTOs;

public class NotaFiscalAnaliseDto
{
    public bool Sucesso { get; set; }
    public string Mensagem { get; set; } = string.Empty;

    public int? VeiculoId { get; set; }
    public int? MotoristaId { get; set; }

    public string? UrlConsulta { get; set; }
    public string? ChaveAcesso { get; set; }

    public string? Placa { get; set; }
    public string? Motorista { get; set; }
    public string? Posto { get; set; }
    public string? Combustivel { get; set; }

    public decimal? Litros { get; set; }
    public decimal? ValorTotal { get; set; }
    public int? KmAtual { get; set; }
    public DateTime? DataAbastecimento { get; set; }

    public string? TextoExtraido { get; set; }
}
