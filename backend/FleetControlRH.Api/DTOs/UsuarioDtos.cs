using FleetControlRH.Api.Models;

namespace FleetControlRH.Api.DTOs;

public record UsuarioCreateDto(
    string Nome,
    string Email,
    string Senha,
    PerfilUsuario Perfil,
    int? MotoristaId
);

public record UsuarioUpdateDto(
    string Nome,
    string Email,
    string? Senha,
    PerfilUsuario Perfil,
    int? MotoristaId,
    bool Ativo
);