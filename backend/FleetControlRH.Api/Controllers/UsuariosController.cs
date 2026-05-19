using FleetControlRH.Api.Data;
using FleetControlRH.Api.DTOs;
using FleetControlRH.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetControlRH.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Master")]
public class UsuariosController : ControllerBase
{
    private readonly AppDbContext _db;
    public UsuariosController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await _db.Usuarios.OrderBy(x => x.Nome).Select(x => new
    {
        x.Id, x.Nome, x.Email, x.Perfil, x.Ativo, x.CriadoEm
    }).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create(UsuarioCreateDto dto)
    {
        if (await _db.Usuarios.AnyAsync(x => x.Email == dto.Email)) return BadRequest(new { mensagem = "E-mail já cadastrado." });
        var usuario = new Usuario { Nome = dto.Nome, Email = dto.Email, SenhaHash = BCrypt.Net.BCrypt.HashPassword(dto.Senha), Perfil = dto.Perfil };
        _db.Usuarios.Add(usuario);
        await _db.SaveChangesAsync();
        return Ok(new { usuario.Id, usuario.Nome, usuario.Email, usuario.Perfil, usuario.Ativo });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UsuarioUpdateDto dto)
    {
        var usuario = await _db.Usuarios.FindAsync(id);
        if (usuario == null) return NotFound();
        if (await _db.Usuarios.AnyAsync(x => x.Email == dto.Email && x.Id != id)) return BadRequest(new { mensagem = "E-mail já cadastrado." });
        usuario.Nome = dto.Nome;
        usuario.Email = dto.Email;
        usuario.Perfil = dto.Perfil;
        usuario.Ativo = dto.Ativo;
        if (!string.IsNullOrWhiteSpace(dto.Senha)) usuario.SenhaHash = BCrypt.Net.BCrypt.HashPassword(dto.Senha);
        await _db.SaveChangesAsync();
        return Ok(new { usuario.Id, usuario.Nome, usuario.Email, usuario.Perfil, usuario.Ativo });
    }
}
