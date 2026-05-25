namespace FleetControlRH.Api.DTOs;

public class IniciarUsoVeiculoDto
{
    public int VeiculoId { get; set; }
    public int MotoristaId { get; set; }
    public int KmInicial { get; set; }
    public string? ObservacaoInicio { get; set; }
}

public class FinalizarUsoVeiculoDto
{
    public int KmFinal { get; set; }
    public string? ObservacaoFim { get; set; }
}
