using FleetControlRH.Api.Data;
using FleetControlRH.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FleetControlRH.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VeiculosController : ControllerBase
{
    private readonly AppDbContext _db;
    public VeiculosController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await _db.Veiculos.Where(x => x.Ativo).OrderBy(x => x.Modelo).ToListAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _db.Veiculos.FindAsync(id);
        return item == null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Veiculo model)
    {
        model.Placa = model.Placa.Replace("-", "").ToUpperInvariant();
        if (await _db.Veiculos.AnyAsync(x => x.Placa == model.Placa)) return BadRequest(new { mensagem = "Já existe veículo com esta placa." });
        _db.Veiculos.Add(model);
        await _db.SaveChangesAsync();
        return Ok(model);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, Veiculo model)
    {
        var item = await _db.Veiculos.FindAsync(id);
        if (item == null) return NotFound();
        var placa = model.Placa.Replace("-", "").ToUpperInvariant();
        if (await _db.Veiculos.AnyAsync(x => x.Placa == placa && x.Id != id)) return BadRequest(new { mensagem = "Já existe veículo com esta placa." });
        item.Modelo = model.Modelo;
        item.Placa = placa;
        item.KmAtual = model.KmAtual;
        item.TipoCombustivel = model.TipoCombustivel;
        item.Ativo = model.Ativo;
        await _db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.Veiculos.FindAsync(id);
        if (item == null) return NotFound();
        item.Ativo = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
