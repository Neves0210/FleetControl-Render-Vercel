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

    public VeiculosController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var veiculos = await _db.Veiculos
            .AsNoTracking()
            .Where(x => x.Ativo)
            .OrderBy(x => x.Modelo)
            .ToListAsync();

        return Ok(veiculos);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _db.Veiculos
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        return item == null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Veiculo model)
    {
        var erro = ValidarVeiculo(model);

        if (!string.IsNullOrWhiteSpace(erro))
            return BadRequest(new { mensagem = erro });

        model.Placa = NormalizarPlaca(model.Placa);
        model.Modelo = model.Modelo.Trim();

        if (await _db.Veiculos.AnyAsync(x => x.Placa == model.Placa))
            return BadRequest(new { mensagem = "Já existe veículo cadastrado com esta placa." });

        model.Ativo = true;

        _db.Veiculos.Add(model);
        await _db.SaveChangesAsync();

        return Ok(model);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, Veiculo model)
    {
        var item = await _db.Veiculos.FindAsync(id);

        if (item == null)
            return NotFound();

        var erro = ValidarVeiculo(model);

        if (!string.IsNullOrWhiteSpace(erro))
            return BadRequest(new { mensagem = erro });

        var placa = NormalizarPlaca(model.Placa);

        if (await _db.Veiculos.AnyAsync(x => x.Placa == placa && x.Id != id))
            return BadRequest(new { mensagem = "Já existe veículo cadastrado com esta placa." });

        item.Modelo = model.Modelo.Trim();
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

        if (item == null)
            return NotFound();

        item.Ativo = false;

        await _db.SaveChangesAsync();

        return NoContent();
    }

    private static string? ValidarVeiculo(Veiculo model)
    {
        if (string.IsNullOrWhiteSpace(model.Modelo))
            return "O modelo do veículo é obrigatório.";

        if (string.IsNullOrWhiteSpace(model.Placa))
            return "A placa do veículo é obrigatória.";

        var placa = NormalizarPlaca(model.Placa);

        if (placa.Length < 7 || placa.Length > 8)
            return "Informe uma placa válida.";

        if (model.KmAtual < 0)
            return "O KM inicial não pode ser negativo.";

        if (!Enum.IsDefined(typeof(TipoCombustivel), model.TipoCombustivel))
            return "Selecione um combustível válido.";

        return null;
    }

    private static string NormalizarPlaca(string placa)
    {
        return (placa ?? string.Empty)
            .Replace("-", "")
            .Replace(" ", "")
            .Trim()
            .ToUpperInvariant();
    }
}
