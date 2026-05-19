using FleetControlRH.Api.Models;

namespace FleetControlRH.Api.DTOs;

public record LoginRequest(string Email, string Senha);
public record LoginResponse(string Token, string Nome, string Email, PerfilUsuario Perfil);
