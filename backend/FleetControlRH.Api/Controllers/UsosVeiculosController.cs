using FleetControlRH.Api.Data;
using FleetControlRH.Api.DTOs;
using FleetControlRH.Api.Extensions;
using FleetControlRH.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FleetControlRH.Api.Utils;

namespace FleetControlRH.Api.Controllers;

[ApiController]
[Route("api/usos-veiculos")]
[Authorize]
public class UsosVeiculosController : ControllerBase
{
    private readonly AppDbContext _db;

    public UsosVeiculosController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int? veiculoId, [FromQuery] int? motoristaId, [FromQuery] bool somenteAtivos = false)
    {
        var query = _db.UsosVeiculos
            .Include(x => x.Veiculo)
            .Include(x => x.Motorista)
            .Include(x => x.Usuario)
            .AsQueryable();

        if (UsuarioEhTecnico())
        {
            var motoristaLogadoId = ObterMotoristaIdUsuarioLogado();

            if (!motoristaLogadoId.HasValue)
                return Ok(new List<UsoVeiculo>());

            query = query.Where(x => x.MotoristaId == motoristaLogadoId.Value);
        }
        else if (motoristaId.HasValue)
        {
            query = query.Where(x => x.MotoristaId == motoristaId.Value);
        }

        if (veiculoId.HasValue)
            query = query.Where(x => x.VeiculoId == veiculoId.Value);

        if (somenteAtivos)
            query = query.Where(x => x.Status == StatusUsoVeiculo.EmUso);

        var usos = await query
            .OrderByDescending(x => x.DataInicio)
            .ToListAsync();

        return Ok(usos);
    }

    [HttpGet("veiculos-disponiveis")]
    public async Task<IActionResult> VeiculosDisponiveis()
    {
        var veiculosEmUso = await _db.UsosVeiculos
            .Where(x => x.Status == StatusUsoVeiculo.EmUso)
            .Select(x => x.VeiculoId)
            .ToListAsync();

        var veiculos = await _db.Veiculos
            .Where(x => x.Ativo && !veiculosEmUso.Contains(x.Id))
            .OrderBy(x => x.Modelo)
            .ToListAsync();

        return Ok(veiculos);
    }

    [HttpPost("iniciar")]
    public async Task<IActionResult> Iniciar([FromBody] IniciarUsoVeiculoDto dto)
    {
        if (!User.TemPermissao("UsosVeiculos.Criar"))
            return Forbid();

        if (dto.VeiculoId <= 0)
            return BadRequest(new { mensagem = "Selecione um veículo." });

        if (dto.KmInicial < 0)
            return BadRequest(new { mensagem = "O KM inicial não pode ser negativo." });

        var veiculo = await _db.Veiculos.FindAsync(dto.VeiculoId);

        if (veiculo == null || !veiculo.Ativo)
            return BadRequest(new { mensagem = "Veículo inválido." });

        var jaEmUso = await _db.UsosVeiculos.AnyAsync(x =>
            x.VeiculoId == dto.VeiculoId &&
            x.Status == StatusUsoVeiculo.EmUso);

        if (jaEmUso)
            return BadRequest(new { mensagem = "Este veículo já está em uso por outro técnico." });

        var motoristaId = dto.MotoristaId;

        if (UsuarioEhTecnico())
        {
            var motoristaLogadoId = ObterMotoristaIdUsuarioLogado();

            if (!motoristaLogadoId.HasValue)
                return Forbid();

            motoristaId = motoristaLogadoId.Value;
        }

        if (motoristaId <= 0)
            return BadRequest(new { mensagem = "Selecione um motorista/técnico." });

        var motorista = await _db.Motoristas.FindAsync(motoristaId);

        if (motorista == null || !motorista.Ativo)
            return BadRequest(new { mensagem = "Motorista/técnico inválido." });

        var tecnicoJaUsando = await _db.UsosVeiculos.AnyAsync(x =>
            x.MotoristaId == motoristaId &&
            x.Status == StatusUsoVeiculo.EmUso);

        if (tecnicoJaUsando)
            return BadRequest(new { mensagem = "Este técnico já possui um veículo em uso. Finalize o uso atual antes de iniciar outro." });

        if (dto.KmInicial < veiculo.KmAtual)
            return BadRequest(new { mensagem = $"O KM inicial ({dto.KmInicial}) não pode ser menor que o KM atual do veículo ({veiculo.KmAtual})." });

        var uso = new UsoVeiculo
        {
            VeiculoId = dto.VeiculoId,
            MotoristaId = motoristaId,
            UsuarioId = ObterUsuarioIdLogado(),
            KmInicial = dto.KmInicial,
            ObservacaoInicio = dto.ObservacaoInicio?.Trim(),
            DataInicio = DataHoraBrasil.Agora(),
            Status = StatusUsoVeiculo.EmUso
        };

        _db.UsosVeiculos.Add(uso);

        await _db.SaveChangesAsync();

        return Ok(uso);
    }

    [HttpPut("{id:int}/finalizar")]
    public async Task<IActionResult> Finalizar(int id, [FromBody] FinalizarUsoVeiculoDto dto)
    {
        var uso = await _db.UsosVeiculos
            .Include(x => x.Veiculo)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (uso == null)
            return NotFound();

        if (uso.Status != StatusUsoVeiculo.EmUso)
            return BadRequest(new { mensagem = "Este uso já foi finalizado." });

        if (UsuarioEhTecnico())
        {
            var motoristaLogadoId = ObterMotoristaIdUsuarioLogado();

            if (!motoristaLogadoId.HasValue || uso.MotoristaId != motoristaLogadoId.Value)
                return Forbid();
        }

        if (!User.TemPermissao("UsosVeiculos.Finalizar"))
            return Forbid();

        if (dto.KmFinal <= uso.KmInicial)
            return BadRequest(new { mensagem = $"O KM final ({dto.KmFinal}) deve ser maior que o KM inicial ({uso.KmInicial})." });

        uso.KmFinal = dto.KmFinal;
        uso.ObservacaoFim = dto.ObservacaoFim?.Trim();
        uso.DataFim = DataHoraBrasil.Agora();
        uso.Status = StatusUsoVeiculo.Finalizado;

        if (uso.Veiculo != null && dto.KmFinal > uso.Veiculo.KmAtual)
            uso.Veiculo.KmAtual = dto.KmFinal;

        await _db.SaveChangesAsync();

        return Ok(uso);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Editar(int id, [FromBody] EditarUsoVeiculoDto dto)
    {
        if (!UsuarioPodeEditarUsoVeiculo())
            return Forbid();

        var uso = await _db.UsosVeiculos
            .Include(x => x.Veiculo)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (uso == null)
            return NotFound();

        if (UsuarioEhTecnico())
        {
            var motoristaLogadoId = ObterMotoristaIdUsuarioLogado();

            if (!motoristaLogadoId.HasValue || uso.MotoristaId != motoristaLogadoId.Value)
                return Forbid();

            dto.MotoristaId = motoristaLogadoId.Value;
        }

        var erro = await ValidarEdicaoAsync(uso, dto);

        if (!string.IsNullOrWhiteSpace(erro))
            return BadRequest(new { mensagem = erro });

        var veiculoIdAnterior = uso.VeiculoId;

        uso.VeiculoId = dto.VeiculoId;
        uso.MotoristaId = dto.MotoristaId;
        uso.KmInicial = dto.KmInicial;
        uso.ObservacaoInicio = dto.ObservacaoInicio?.Trim();
        uso.ObservacaoFim = dto.ObservacaoFim?.Trim();

        if (uso.Status == StatusUsoVeiculo.Finalizado)
            uso.KmFinal = dto.KmFinal;
        else
            uso.KmFinal = null;

        await _db.SaveChangesAsync();

        await RecalcularKmAtualVeiculoAsync(uso.VeiculoId);

        if (veiculoIdAnterior != uso.VeiculoId)
            await RecalcularKmAtualVeiculoAsync(veiculoIdAnterior);

        await _db.SaveChangesAsync();

        return Ok(uso);
    }

    private async Task<string?> ValidarEdicaoAsync(UsoVeiculo uso, EditarUsoVeiculoDto dto)
    {
        if (dto.VeiculoId <= 0)
            return "Selecione um veiculo.";

        if (dto.MotoristaId <= 0)
            return "Selecione um motorista/tecnico.";

        if (dto.KmInicial < 0)
            return "O KM inicial nao pode ser negativo.";

        var veiculo = await _db.Veiculos.FindAsync(dto.VeiculoId);

        if (veiculo == null || !veiculo.Ativo)
            return "Veiculo invalido.";

        var motorista = await _db.Motoristas.FindAsync(dto.MotoristaId);

        if (motorista == null || !motorista.Ativo)
            return "Motorista/tecnico invalido.";

        if (uso.Status == StatusUsoVeiculo.EmUso)
        {
            var veiculoJaEmUso = await _db.UsosVeiculos.AnyAsync(x =>
                x.Id != uso.Id &&
                x.VeiculoId == dto.VeiculoId &&
                x.Status == StatusUsoVeiculo.EmUso);

            if (veiculoJaEmUso)
                return "Este veiculo ja esta em uso por outro tecnico.";

            var tecnicoJaUsando = await _db.UsosVeiculos.AnyAsync(x =>
                x.Id != uso.Id &&
                x.MotoristaId == dto.MotoristaId &&
                x.Status == StatusUsoVeiculo.EmUso);

            if (tecnicoJaUsando)
                return "Este tecnico ja possui um veiculo em uso.";

            if (uso.VeiculoId != dto.VeiculoId && dto.KmInicial < veiculo.KmAtual)
                return $"O KM inicial ({dto.KmInicial}) nao pode ser menor que o KM atual do veiculo ({veiculo.KmAtual}).";
        }

        if (uso.Status == StatusUsoVeiculo.Finalizado)
        {
            if (!dto.KmFinal.HasValue)
                return "Informe o KM final.";

            if (dto.KmFinal.Value <= dto.KmInicial)
                return $"O KM final ({dto.KmFinal.Value}) deve ser maior que o KM inicial ({dto.KmInicial}).";
        }

        return null;
    }

    private bool UsuarioPodeEditarUsoVeiculo()
    {
        return User.IsInRole("Master") ||
               User.IsInRole("RH") ||
               User.TemPermissao("UsosVeiculos.Editar");
    }

    private async Task RecalcularKmAtualVeiculoAsync(int veiculoId)
    {
        var veiculo = await _db.Veiculos.FindAsync(veiculoId);

        if (veiculo == null)
            return;

        var maiorKmUso = await _db.UsosVeiculos
            .Where(x => x.VeiculoId == veiculoId && x.KmFinal.HasValue)
            .Select(x => x.KmFinal)
            .MaxAsync();

        var maiorKmAbastecimento = await _db.Abastecimentos
            .Where(x => x.VeiculoId == veiculoId)
            .Select(x => (int?)x.KmAtual)
            .MaxAsync();

        var maiorKm = new[] { maiorKmUso, maiorKmAbastecimento }
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .DefaultIfEmpty(veiculo.KmAtual)
            .Max();

        veiculo.KmAtual = maiorKm;
    }

    private bool UsuarioEhTecnico()
    {
        return User.IsInRole("Tecnico");
    }

    private int? ObterMotoristaIdUsuarioLogado()
    {
        var motoristaIdClaim = User.Claims.FirstOrDefault(x => x.Type == "MotoristaId")?.Value;

        return int.TryParse(motoristaIdClaim, out var motoristaId)
            ? motoristaId
            : null;
    }

    private int? ObterUsuarioIdLogado()
    {
        var usuarioIdClaim = User.Claims.FirstOrDefault(x => x.Type == "UsuarioId")?.Value;

        return int.TryParse(usuarioIdClaim, out var usuarioId)
            ? usuarioId
            : null;
    }
}
