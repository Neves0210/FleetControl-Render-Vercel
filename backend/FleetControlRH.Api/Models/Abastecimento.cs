using System.ComponentModel.DataAnnotations;
using FleetControlRH.Api.Utils;

namespace FleetControlRH.Api.Models;

public enum StatusAbastecimento
{
    PendenteLiberacao = 1,
    Liberado = 2,
    Reprovado = 3
}

public class Abastecimento
{
    public int Id { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Selecione um veículo.")]
    public int VeiculoId { get; set; }

    public Veiculo? Veiculo { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Selecione um motorista/técnico.")]
    public int MotoristaId { get; set; }

    public Motorista? Motorista { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "O KM atual deve ser maior que zero.")]
    public int KmAtual { get; set; }

    [Range(typeof(decimal), "0.001", "999999999", ErrorMessage = "A quantidade de litros deve ser maior que zero.")]
    public decimal Litros { get; set; }

    [Range(typeof(decimal), "0.01", "999999999", ErrorMessage = "O valor total deve ser maior que zero.")]
    public decimal ValorTotal { get; set; }

    [MaxLength(160)]
    public string? Posto { get; set; }

    [MaxLength(500)]
    public string? Observacao { get; set; }

    public string? FotoNotaFiscalPath { get; set; }

    public DateTime DataAbastecimento { get; set; } = DataHoraBrasil.Agora();

    public DateTime CriadoEm { get; set; } = DataHoraBrasil.Agora();

    public byte[]? FotoNotaFiscal { get; set; }
    public string? FotoNotaFiscalContentType { get; set; }

    public StatusAbastecimento Status { get; set; } = StatusAbastecimento.PendenteLiberacao;

    public int? LiberadoPorUsuarioId { get; set; }
    public Usuario? LiberadoPorUsuario { get; set; }

    public DateTime? LiberadoEm { get; set; }

    [MaxLength(500)]
    public string? ObservacaoLiberacao { get; set; }

    public ICollection<AbastecimentoCombustivel> Combustiveis { get; set; } = new List<AbastecimentoCombustivel>();
}
