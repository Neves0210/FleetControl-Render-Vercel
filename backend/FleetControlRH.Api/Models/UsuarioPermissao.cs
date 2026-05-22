namespace FleetControlRH.Api.Models;

public class UsuarioPermissao
{
    public int Id { get; set; }

    public int UsuarioId { get; set; }
    public Usuario Usuario { get; set; } = null!;

    public string Permissao { get; set; } = string.Empty;
}