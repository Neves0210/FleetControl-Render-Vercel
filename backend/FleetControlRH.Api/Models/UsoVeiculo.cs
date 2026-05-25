using System.ComponentModel.DataAnnotations;

namespace FleetControlRH.Api.Models;

public enum StatusUsoVeiculo
{
    EmUso = 1,
    Finalizado = 2
}

public class UsoVeiculo
{
    public int Id { get; set; }

    [Required]
    public int VeiculoId { get; set; }
    public Veiculo? Veiculo { get; set; }

    [Required]
    public int MotoristaId { get; set; }
    public Motorista? Motorista { get; set; }

    public int? UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    public DateTime DataInicio { get; set; } = DateTime.Now;
    public DateTime? DataFim { get; set; }

    [Range(0, int.MaxValue)]
    public int KmInicial { get; set; }

    [Range(0, int.MaxValue)]
    public int? KmFinal { get; set; }

    [MaxLength(500)]
    public string? ObservacaoInicio { get; set; }

    [MaxLength(500)]
    public string? ObservacaoFim { get; set; }

    public StatusUsoVeiculo Status { get; set; } = StatusUsoVeiculo.EmUso;

    public double? TempoUsoMinutos =>
        DataFim.HasValue
            ? Math.Round((DataFim.Value - DataInicio).TotalMinutes, 2)
            : null;
}
