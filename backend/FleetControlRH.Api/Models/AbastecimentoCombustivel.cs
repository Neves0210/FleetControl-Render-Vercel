using System.ComponentModel.DataAnnotations;

namespace FleetControlRH.Api.Models;

public class AbastecimentoCombustivel
{
    public int Id { get; set; }

    public int AbastecimentoId { get; set; }
    public Abastecimento? Abastecimento { get; set; }

    [Required]
    [MaxLength(80)]
    public string DescricaoCombustivel { get; set; } = string.Empty;

    [Range(typeof(decimal), "0.001", "999999999", ErrorMessage = "A quantidade de litros deve ser maior que zero.")]
    public decimal Litros { get; set; }

    [Range(typeof(decimal), "0.001", "999999999", ErrorMessage = "O valor unitario deve ser maior que zero.")]
    public decimal? ValorUnitario { get; set; }

    [Range(typeof(decimal), "0.01", "999999999", ErrorMessage = "O valor total deve ser maior que zero.")]
    public decimal ValorTotal { get; set; }

    public int Ordem { get; set; }
}
