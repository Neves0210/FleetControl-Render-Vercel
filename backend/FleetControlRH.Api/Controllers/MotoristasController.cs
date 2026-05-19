using FleetControlRH.Api.Data;
using FleetControlRH.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetControlRH.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MotoristasController : ControllerBase
{
    private readonly AppDbContext _db;
    public MotoristasController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await _db.Motoristas.Where(x => x.Ativo).OrderBy(x => x.Nome).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create(Motorista model)
    {
        _db.Motoristas.Add(model);
        await _db.SaveChangesAsync();
        return Ok(model);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, Motorista model)
    {
        var item = await _db.Motoristas.FindAsync(id);
        if (item == null) return NotFound();
        item.Nome = model.Nome;
        item.Documento = model.Documento;
        item.Telefone = model.Telefone;
        item.Cargo = model.Cargo;
        item.Ativo = model.Ativo;
        await _db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.Motoristas.FindAsync(id);
        if (item == null) return NotFound();
        item.Ativo = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
