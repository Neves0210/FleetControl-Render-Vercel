using System.ComponentModel.DataAnnotations;

namespace FleetControlRH.Api.Models;

public class Motorista
{
    public int Id { get; set; }
    [Required, MaxLength(120)] public string Nome { get; set; } = string.Empty;
    [MaxLength(30)] public string? Documento { get; set; }
    [MaxLength(30)] public string? Telefone { get; set; }
    [MaxLength(80)] public string? Cargo { get; set; }
    public bool Ativo { get; set; } = true;
    public ICollection<Abastecimento> Abastecimentos { get; set; } = new List<Abastecimento>();
}
