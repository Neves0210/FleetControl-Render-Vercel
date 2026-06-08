namespace FleetControlRH.Api.Utils;

public static class DataHoraBrasil
{
    // Brasil aboliu o horário de verão em 2019; São Paulo é UTC-3 fixo.
    private static readonly TimeSpan OffsetPadrao = TimeSpan.FromHours(-3);

    public static DateTime Agora()
    {
        var utc = DateTime.UtcNow;

        try
        {
            var fuso = ObterFuso();
            var local = TimeZoneInfo.ConvertTimeFromUtc(utc, fuso);
            return DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        }
        catch (Exception) // tzdata ausente no container, etc.
        {
            return DateTime.SpecifyKind(utc.Add(OffsetPadrao), DateTimeKind.Unspecified);
        }
    }

    private static TimeZoneInfo ObterFuso()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo"); }      // Linux/Render
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("E. South America Standard Time"); // Windows
        }
    }
}