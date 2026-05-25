using FleetControlRH.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FleetControlRH.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Veiculo> Veiculos => Set<Veiculo>();
    public DbSet<Motorista> Motoristas => Set<Motorista>();
    public DbSet<Abastecimento> Abastecimentos => Set<Abastecimento>();
    public DbSet<UsuarioPermissao> UsuarioPermissoes => Set<UsuarioPermissao>();
    public DbSet<UsoVeiculo> UsosVeiculos => Set<UsoVeiculo>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Usuario>()
            .HasIndex(x => x.Email)
            .IsUnique();
            
        modelBuilder.Entity<Veiculo>() 
            .HasIndex(x => x.Placa)
            .IsUnique();

        modelBuilder.Entity<Abastecimento>()
            .Property(x => x.Litros)
            .HasColumnType("decimal(10,3)");

        modelBuilder.Entity<Abastecimento>()
            .Property(x => x.ValorTotal)   
            .HasColumnType("decimal(10,2)");

        modelBuilder.Entity<UsuarioPermissao>()
            .HasIndex(x => new { x.UsuarioId, x.Permissao })
            .IsUnique();


        modelBuilder.Entity<UsoVeiculo>()
            .HasOne(x => x.Veiculo)
            .WithMany()
            .HasForeignKey(x => x.VeiculoId);

        modelBuilder.Entity<UsoVeiculo>()
            .HasOne(x => x.Motorista)
            .WithMany()
            .HasForeignKey(x => x.MotoristaId);

        modelBuilder.Entity<UsoVeiculo>()
            .HasOne(x => x.Usuario)
            .WithMany()
            .HasForeignKey(x => x.UsuarioId);

        modelBuilder.Entity<UsuarioPermissao>()
            .HasOne(x => x.Usuario)
            .WithMany(x => x.Permissoes)
            .HasForeignKey(x => x.UsuarioId);
    }
}
