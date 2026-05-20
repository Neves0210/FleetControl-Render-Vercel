using System.ComponentModel.DataAnnotations;

namespace FleetControlRH.Api.Models;

public class Usuario
{
    public int Id { get; set; }
    [Required, MaxLength(120)] public string Nome { get; set; } = string.Empty;
    [Required, MaxLength(160)] public string Email { get; set; } = string.Empty;
    [Required] public string SenhaHash { get; set; } = string.Empty;
    public PerfilUsuario Perfil { get; set; } = PerfilUsuario.Tecnico;
    public bool Ativo { get; set; } = true;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
