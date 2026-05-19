using FleetControlRH.Api.Models;

namespace FleetControlRH.Api.Data;

public static class DbSeeder
{
    public static void Seed(AppDbContext db)
    {
        if (!db.Usuarios.Any())
        {
            db.Usuarios.Add(new Usuario
            {
                Nome = "Administrador",
                Email = "admin@fleet.local",
                SenhaHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                Perfil = PerfilUsuario.Master,
                Ativo = true
            });
        }

        if (!db.Veiculos.Any())
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

        if (!db.Motoristas.Any())
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
