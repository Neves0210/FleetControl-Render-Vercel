using FleetControlRH.Api.Data;
using FleetControlRH.Api.DTOs;
using FleetControlRH.Api.Models;
using FleetControlRH.Api.Services;
using Microsoft.AspNetCore.RateLimiting;
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
    [EnableRateLimiting("Login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var usuario = await _db.Usuarios
            .Include(x => x.Motorista)
            .Include(x => x.Permissoes)
            .FirstOrDefaultAsync(x => x.Email == request.Email && x.Ativo);

        if (usuario == null || !BCrypt.Net.BCrypt.Verify(request.Senha, usuario.SenhaHash))
        {
            return Unauthorized(new
            {
                mensagem = "E-mail ou senha inválidos."
            });
        }

        var permissoesSalvas = usuario.Permissoes
            .Select(x => x.Permissao)
            .Distinct()
            .ToList();

        var permissoes = permissoesSalvas.Any() ? permissoesSalvas : usuario.Perfil switch
        {
            PerfilUsuario.Master => new List<string>
            {
                "Dashboard.Visualizar",
                "Dashboard.Personalizar",
                "Veiculos.Visualizar",
                "Motoristas.Visualizar",
                "Abastecimentos.Visualizar",
                "Abastecimentos.Criar",
                "Abastecimentos.Editar",
                "Abastecimentos.Liberar",
                "UsosVeiculos.Visualizar",
                "UsosVeiculos.Criar",
                "UsosVeiculos.Editar",
                "UsosVeiculos.Finalizar",
                "Manutencoes.Visualizar",
                "Manutencoes.Gerenciar",
                "Relatorios.Visualizar",
                "Relatorios.Exportar",
                "Usuarios.Visualizar",
                "Usuarios.Gerenciar"
            },
            PerfilUsuario.RH => new List<string>
            {
                "Dashboard.Visualizar",
                "Dashboard.Personalizar",
                "Veiculos.Visualizar",
                "Motoristas.Visualizar",
                "Abastecimentos.Visualizar",
                "Abastecimentos.Criar",
                "Abastecimentos.Editar",
                "Abastecimentos.Liberar",
                "UsosVeiculos.Visualizar",
                "UsosVeiculos.Criar",
                "UsosVeiculos.Editar",
                "UsosVeiculos.Finalizar",
                "Manutencoes.Visualizar",
                "Manutencoes.Gerenciar",
                "Relatorios.Visualizar",
                "Relatorios.Exportar"
            },
            PerfilUsuario.Tecnico => new List<string>
            {
                "Dashboard.Visualizar",
                "Abastecimentos.Visualizar",
                "Abastecimentos.Criar",
                "UsosVeiculos.Visualizar",
                "UsosVeiculos.Criar",
                "UsosVeiculos.Finalizar",
                "Manutencoes.Visualizar"
            },
            PerfilUsuario.Almoxarifado => new List<string>
            {
                "Dashboard.Visualizar",
                "Veiculos.Visualizar",
                "Abastecimentos.Visualizar",
                "Abastecimentos.Liberar",
                "Manutencoes.Visualizar",
                "Manutencoes.Gerenciar"
            },
            _ => usuario.Permissoes.Select(x => x.Permissao).ToList()
        };

        var token = _tokenService.GerarToken(usuario, permissoes);

        return Ok(new
        {
            token,
            nome = usuario.Nome,
            email = usuario.Email,
            perfil = usuario.Perfil,
            motoristaId = usuario.MotoristaId,
            motorista = usuario.Motorista?.Nome,
            permissoes
        });
    }
}
