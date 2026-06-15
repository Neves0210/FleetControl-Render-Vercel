using System.ComponentModel.DataAnnotations;
using FleetControlRH.Api.Utils;

namespace FleetControlRH.Api.Models;

public enum StatusManutencaoVeiculo
{
    EmDia = 1,
    Proxima = 2,
    Vencida = 3
}

public class ManutencaoVeiculo
{
    public int Id { get; set; }

    [Required]
    public int VeiculoId { get; set; }
    public Veiculo? Veiculo { get; set; }

    [Required(ErrorMessage = "O tipo de manutenção é obrigatório.")]
    [MaxLength(120)]
    public string Tipo { get; set; } = string.Empty;

    public DateTime DataManutencao { get; set; } = DataHoraBrasil.Agora();

    [Range(0, int.MaxValue, ErrorMessage = "O KM da manutenção não pode ser negativo.")]
    public int KmManutencao { get; set; }

    [MaxLength(1000)]
    public string? Descricao { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "O custo não pode ser negativo.")]
    public decimal? Custo { get; set; }

    public int? ProximaManutencaoKm { get; set; }

    public DateTime? ProximaManutencaoData { get; set; }

    [MaxLength(180)]
    public string? AnexoNome { get; set; }

    [MaxLength(120)]
    public string? AnexoContentType { get; set; }

    public byte[]? AnexoArquivo { get; set; }

    public DateTime CriadoEm { get; set; } = DataHoraBrasil.Agora();
}
