using FleetControlRH.Api.Models;

namespace FleetControlRH.Api.DTOs;

public record UsuarioCreateDto(string Nome, string Email, string Senha, PerfilUsuario Perfil);
public record UsuarioUpdateDto(string Nome, string Email, string? Senha, PerfilUsuario Perfil, bool Ativo);
