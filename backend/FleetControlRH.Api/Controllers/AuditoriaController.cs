using FleetControlRH.Api.Data;
using FleetControlRH.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetControlRH.Api.Controllers;

[ApiController]
[Route("api/auditoria")]
[Authorize]
public class AuditoriaController : ControllerBase
{
    private readonly AppDbContext _db;

    public AuditoriaController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] DateTime? dataInicio,
        [FromQuery] DateTime? dataFim,
        [FromQuery] string? entidade,
        [FromQuery] int? usuarioId,
        [FromQuery] string? busca)
    {
        if (!UsuarioPodeVerAuditoria())
            return Forbid();

        var inicio = dataInicio?.Date;
        var fim = dataFim?.Date.AddDays(1).AddTicks(-1);

        var query = _db.AuditoriaEventos
            .AsNoTracking()
            .AsQueryable();

        if (inicio.HasValue)
            query = query.Where(x => x.CriadoEm >= inicio.Value);

        if (fim.HasValue)
            query = query.Where(x => x.CriadoEm <= fim.Value);

        if (!string.IsNullOrWhiteSpace(entidade))
            query = query.Where(x => x.Entidade == entidade);

        if (usuarioId.HasValue)
            query = query.Where(x => x.UsuarioId == usuarioId.Value);

        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = busca.Trim().ToLower();
            query = query.Where(x =>
                x.Acao.ToLower().Contains(termo) ||
                (x.UsuarioNome != null && x.UsuarioNome.ToLower().Contains(termo)) ||
                (x.Resumo != null && x.Resumo.ToLower().Contains(termo)) ||
                x.Entidade.ToLower().Contains(termo));
        }

        var eventos = await query
            .OrderByDescending(x => x.CriadoEm)
            .Take(500)
            .Select(x => new
            {
                x.Id,
                x.Entidade,
                x.EntidadeId,
                x.Acao,
                x.UsuarioId,
                x.UsuarioNome,
                x.Resumo,
                x.CriadoEm
            })
            .ToListAsync();

        var entidades = await _db.AuditoriaEventos
            .AsNoTracking()
            .Select(x => x.Entidade)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync();

        return Ok(new
        {
            total = eventos.Count,
            limite = 500,
            entidades,
            itens = eventos
        });
    }

    private bool UsuarioPodeVerAuditoria()
    {
        return User.IsInRole("Master") ||
               User.IsInRole("RH") ||
               User.TemPermissao("Auditoria.Visualizar");
    }
}
