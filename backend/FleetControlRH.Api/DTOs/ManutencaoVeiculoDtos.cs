using FleetControlRH.Api.Utils;

namespace FleetControlRH.Api.DTOs;

public class ManutencaoVeiculoDto
{
    public int VeiculoId { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public DateTime DataManutencao { get; set; } = DataHoraBrasil.Agora();
    public int KmManutencao { get; set; }
    public string? Descricao { get; set; }
    public decimal? Custo { get; set; }
    public int? ProximaManutencaoKm { get; set; }
    public DateTime? ProximaManutencaoData { get; set; }
}

public class AlertaManutencaoDto
{
    public int ManutencaoId { get; set; }
    public int VeiculoId { get; set; }
    public string Veiculo { get; set; } = string.Empty;
    public string Placa { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public int KmAtual { get; set; }
    public int? ProximaManutencaoKm { get; set; }
    public DateTime? ProximaManutencaoData { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? KmRestante { get; set; }
    public int? DiasRestantes { get; set; }
}
