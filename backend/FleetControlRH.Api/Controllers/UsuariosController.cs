using FleetControlRH.Api.Data;
using FleetControlRH.Api.DTOs;
using FleetControlRH.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FleetControlRH.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Master")]
public class UsuariosController : ControllerBase
{
    private readonly AppDbContext _db;

    public UsuariosController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var usuarios = await _db.Usuarios
            .Include(x => x.Motorista)
            .Include(x => x.Permissoes)
            .AsNoTracking()
            .OrderBy(x => x.Nome)
            .Select(x => new
            {
                x.Id,
                x.Nome,
                x.Email,
                x.Perfil,
                x.MotoristaId,
                Motorista = x.Motorista != null ? x.Motorista.Nome : null,
                x.Ativo,
                x.CriadoEm,
                Permissoes = x.Permissoes.Select(p => p.Permissao).ToList()
            })
            .ToListAsync();

        return Ok(usuarios);
    }

    [HttpPost]
    public async Task<IActionResult> Create(UsuarioCreateDto dto)
    {
        var erro = ValidarUsuarioCreate(dto);

        if (!string.IsNullOrWhiteSpace(erro))
            return BadRequest(new { mensagem = erro });

        var email = dto.Email.Trim().ToLowerInvariant();

        if (await _db.Usuarios.AnyAsync(x => x.Email.ToLower() == email))
            return BadRequest(new { mensagem = "E-mail já cadastrado." });

        if (dto.MotoristaId.HasValue)
        {
            var motoristaExiste = await _db.Motoristas.AnyAsync(x => x.Id == dto.MotoristaId.Value && x.Ativo);

            if (!motoristaExiste)
                return BadRequest(new { mensagem = "Motorista/técnico vinculado ao usuário é inválido." });
        }

        var usuario = new Usuario
        {
            Nome = dto.Nome.Trim(),
            Email = email,
            SenhaHash = BCrypt.Net.BCrypt.HashPassword(dto.Senha),
            Perfil = dto.Perfil,
            MotoristaId = dto.MotoristaId,
            Ativo = true
        };

        _db.Usuarios.Add(usuario);
        await _db.SaveChangesAsync();

        foreach (var permissao in (dto.Permissoes ?? new List<string>()).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct())
        {
            _db.UsuarioPermissoes.Add(new UsuarioPermissao
            {
                UsuarioId = usuario.Id,
                Permissao = permissao
            });
        }

        await _db.SaveChangesAsync();

        RegistrarAuditoria("Usuario", usuario.Id, "Criar", $"{usuario.Nome} | {usuario.Email}");
        await _db.SaveChangesAsync();

        return Ok(new
        {
            usuario.Id,
            usuario.Nome,
            usuario.Email,
            usuario.Perfil,
            usuario.MotoristaId,
            usuario.Ativo
        });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UsuarioUpdateDto dto)
    {
        var usuario = await _db.Usuarios
            .Include(x => x.Permissoes)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (usuario == null)
            return NotFound();

        var erro = ValidarUsuarioUpdate(dto);

        if (!string.IsNullOrWhiteSpace(erro))
            return BadRequest(new { mensagem = erro });

        var email = dto.Email.Trim().ToLowerInvariant();

        if (await _db.Usuarios.AnyAsync(x => x.Email.ToLower() == email && x.Id != id))
            return BadRequest(new { mensagem = "E-mail já cadastrado." });

        if (dto.MotoristaId.HasValue)
        {
            var motoristaExiste = await _db.Motoristas.AnyAsync(x => x.Id == dto.MotoristaId.Value && x.Ativo);

            if (!motoristaExiste)
                return BadRequest(new { mensagem = "Motorista/técnico vinculado ao usuário é inválido." });
        }

        usuario.Nome = dto.Nome.Trim();
        usuario.Email = email;
        usuario.Perfil = dto.Perfil;
        usuario.MotoristaId = dto.MotoristaId;
        usuario.Ativo = dto.Ativo;

        if (!string.IsNullOrWhiteSpace(dto.Senha))
        {
            usuario.SenhaHash =
                BCrypt.Net.BCrypt.HashPassword(dto.Senha);
        }

        _db.UsuarioPermissoes.RemoveRange(usuario.Permissoes);

        foreach (var permissao in (dto.Permissoes ?? new List<string>()).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct())
        {
            _db.UsuarioPermissoes.Add(
                new UsuarioPermissao
                {
                    UsuarioId = usuario.Id,
                    Permissao = permissao
                });
        }

        await _db.SaveChangesAsync();

        RegistrarAuditoria("Usuario", usuario.Id, "Editar", $"{usuario.Nome} | {usuario.Email}");
        await _db.SaveChangesAsync();

        return Ok(new
        {
            usuario.Id,
            usuario.Nome,
            usuario.Email,
            usuario.Perfil,
            usuario.MotoristaId,
            usuario.Ativo,
            Permissoes = dto.Permissoes
        });
    }

    private static string? ValidarUsuarioCreate(UsuarioCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nome))
            return "O nome do usuário é obrigatório.";

        if (string.IsNullOrWhiteSpace(dto.Email))
            return "O e-mail do usuário é obrigatório.";

        if (!dto.Email.Contains('@') || !dto.Email.Contains('.'))
            return "Informe um e-mail válido.";

        if (string.IsNullOrWhiteSpace(dto.Senha) || dto.Senha.Length < 4)
            return "A senha deve ter no mínimo 4 caracteres.";

        if (!Enum.IsDefined(typeof(PerfilUsuario), dto.Perfil))
            return "Selecione um perfil válido.";

        return null;
    }

    private static string? ValidarUsuarioUpdate(UsuarioUpdateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nome))
            return "O nome do usuário é obrigatório.";

        if (string.IsNullOrWhiteSpace(dto.Email))
            return "O e-mail do usuário é obrigatório.";

        if (!dto.Email.Contains('@') || !dto.Email.Contains('.'))
            return "Informe um e-mail válido.";

        if (!string.IsNullOrWhiteSpace(dto.Senha) && dto.Senha.Length < 4)
            return "A senha deve ter no mínimo 4 caracteres.";

        if (!Enum.IsDefined(typeof(PerfilUsuario), dto.Perfil))
            return "Selecione um perfil válido.";

        return null;
    }

    private void RegistrarAuditoria(string entidade, int entidadeId, string acao, string? resumo)
    {
        var usuarioIdClaim = User.Claims.FirstOrDefault(x => x.Type == "UsuarioId" || x.Type == ClaimTypes.NameIdentifier)?.Value;
        var usuarioNome = User.Claims.FirstOrDefault(x => x.Type == ClaimTypes.Name)?.Value;

        _db.AuditoriaEventos.Add(new AuditoriaEvento
        {
            Entidade = entidade,
            EntidadeId = entidadeId,
            Acao = acao,
            UsuarioId = int.TryParse(usuarioIdClaim, out var usuarioId) ? usuarioId : null,
            UsuarioNome = usuarioNome,
            Resumo = resumo,
            CriadoEm = DateTime.UtcNow
        });
    }
}
