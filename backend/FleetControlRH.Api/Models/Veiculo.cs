using System.ComponentModel.DataAnnotations;

namespace FleetControlRH.Api.Models;

public class Veiculo
{
    public int Id { get; set; }

    [Required(ErrorMessage = "O modelo é obrigatório.")]
    [MaxLength(120)]
    public string Modelo { get; set; } = string.Empty;

    [Required(ErrorMessage = "A placa é obrigatória.")]
    [MaxLength(10)]
    public string Placa { get; set; } = string.Empty;

    [Range(0, int.MaxValue, ErrorMessage = "O KM inicial não pode ser negativo.")]
    public int KmAtual { get; set; }

    public TipoCombustivel TipoCombustivel { get; set; }

    public bool Ativo { get; set; } = true;

    public ICollection<Abastecimento> Abastecimentos { get; set; } = new List<Abastecimento>();
}
