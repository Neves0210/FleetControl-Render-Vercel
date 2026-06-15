using System.ComponentModel.DataAnnotations;
using FleetControlRH.Api.Utils;

namespace FleetControlRH.Api.Models;

public class AuditoriaEvento
{
    public int Id { get; set; }

    [MaxLength(80)]
    public string Entidade { get; set; } = string.Empty;

    public int EntidadeId { get; set; }

    [MaxLength(40)]
    public string Acao { get; set; } = string.Empty;

    public int? UsuarioId { get; set; }

    [MaxLength(160)]
    public string? UsuarioNome { get; set; }

    [MaxLength(1000)]
    public string? Resumo { get; set; }

    public DateTime CriadoEm { get; set; } = DataHoraBrasil.Agora();
}
