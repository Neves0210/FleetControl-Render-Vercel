using FleetControlRH.Api.Data;
using FleetControlRH.Api.DTOs;
using FleetControlRH.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetControlRH.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokenService;

    public AuthController(AppDbContext db, TokenService tokenService)
    {
        _db = db;
        _tokenService = tokenService;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var usuario = await _db.Usuarios
            .Include(x => x.Motorista)
            .FirstOrDefaultAsync(x => x.Email == request.Email && x.Ativo);

        if (usuario == null || !BCrypt.Net.BCrypt.Verify(request.Senha, usuario.SenhaHash))
        {
            return Unauthorized(new
            {
                mensagem = "E-mail ou senha inválidos."
            });
        }

        var token = _tokenService.GerarToken(usuario);

        return Ok(new
        {
            token,
            nome = usuario.Nome,
            email = usuario.Email,
            perfil = usuario.Perfil,
            motoristaId = usuario.MotoristaId,
            motorista = usuario.Motorista?.Nome
        });
    }
}