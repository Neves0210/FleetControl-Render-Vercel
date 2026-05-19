using System.ComponentModel.DataAnnotations;

namespace FleetControlRH.Api.Models;

public class Abastecimento
{
    public int Id { get; set; }
    public int VeiculoId { get; set; }
    public Veiculo? Veiculo { get; set; }
    public int MotoristaId { get; set; }
    public Motorista? Motorista { get; set; }
    public DateTime DataAbastecimento { get; set; } = DateTime.Now;
    public int KmAtual { get; set; }
    public decimal Litros { get; set; }
    public decimal ValorTotal { get; set; }
    [MaxLength(160)] public string? Posto { get; set; }
    [MaxLength(500)] public string? Observacao { get; set; }
    public string? FotoNotaFiscalPath { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.Now;
}
