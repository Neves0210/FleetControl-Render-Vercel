using System.ComponentModel.DataAnnotations;

namespace FleetControlRH.Api.Models;

public class Veiculo
{
    public int Id { get; set; }
    [Required, MaxLength(120)] public string Modelo { get; set; } = string.Empty;
    [Required, MaxLength(10)] public string Placa { get; set; } = string.Empty;
    public int KmAtual { get; set; }
    public TipoCombustivel TipoCombustivel { get; set; }
    public bool Ativo { get; set; } = true;
    public ICollection<Abastecimento> Abastecimentos { get; set; } = new List<Abastecimento>();
}
