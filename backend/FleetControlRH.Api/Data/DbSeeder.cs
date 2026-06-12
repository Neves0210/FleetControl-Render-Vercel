using FleetControlRH.Api.Models;

namespace FleetControlRH.Api.Data;

public static class DbSeeder
{
    public static void Seed(AppDbContext db)
    {
        var adminEmail = Environment.GetEnvironmentVariable("SEED_ADMIN_EMAIL");
        var adminPassword = Environment.GetEnvironmentVariable("SEED_ADMIN_PASSWORD");

        if (!db.Usuarios.Any() &&
            !string.IsNullOrWhiteSpace(adminEmail) &&
            !string.IsNullOrWhiteSpace(adminPassword))
        {
            db.Usuarios.Add(new Usuario
            {
                Nome = "Administrador",
                Email = adminEmail.Trim().ToLowerInvariant(),
                SenhaHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                Perfil = PerfilUsuario.Master,
                Ativo = true
            });
        }

        var seedSampleData = string.Equals(
            Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
            "Development",
            StringComparison.OrdinalIgnoreCase);

        if (seedSampleData && !db.Veiculos.Any())
        {
            db.Veiculos.Add(new Veiculo
            {
                Modelo = "Veículo Teste",
                Placa = "GUI1L81",
                KmAtual = 38100,
                TipoCombustivel = TipoCombustivel.Etanol,
                Ativo = true
            });
        }

        if (seedSampleData && !db.Motoristas.Any())
        {
            db.Motoristas.Add(new Motorista
            {
                Nome = "Paulo",
                Documento = "",
                Cargo = "Técnico",
                Ativo = true
            });
        }

        db.SaveChanges();
    }
}
