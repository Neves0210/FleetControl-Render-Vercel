using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FleetControlRH.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditoriaEventos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UsosVeiculos_MotoristaId",
                table: "UsosVeiculos");

            migrationBuilder.DropIndex(
                name: "IX_UsosVeiculos_VeiculoId",
                table: "UsosVeiculos");

            migrationBuilder.DropIndex(
                name: "IX_ManutencoesVeiculos_VeiculoId",
                table: "ManutencoesVeiculos");

            migrationBuilder.DropIndex(
                name: "IX_Abastecimentos_MotoristaId",
                table: "Abastecimentos");

            migrationBuilder.DropIndex(
                name: "IX_Abastecimentos_VeiculoId",
                table: "Abastecimentos");

            migrationBuilder.AddColumn<byte[]>(
                name: "AnexoArquivo",
                table: "ManutencoesVeiculos",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AnexoContentType",
                table: "ManutencoesVeiculos",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AnexoNome",
                table: "ManutencoesVeiculos",
                type: "character varying(180)",
                maxLength: 180,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AuditoriaEventos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Entidade = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    EntidadeId = table.Column<int>(type: "integer", nullable: false),
                    Acao = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    UsuarioId = table.Column<int>(type: "integer", nullable: true),
                    UsuarioNome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Resumo = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditoriaEventos", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditoriaEventos_Entidade_EntidadeId_CriadoEm",
                table: "AuditoriaEventos",
                columns: new[] { "Entidade", "EntidadeId", "CriadoEm" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditoriaEventos");

            migrationBuilder.DropColumn(
                name: "AnexoArquivo",
                table: "ManutencoesVeiculos");

            migrationBuilder.DropColumn(
                name: "AnexoContentType",
                table: "ManutencoesVeiculos");

            migrationBuilder.DropColumn(
                name: "AnexoNome",
                table: "ManutencoesVeiculos");

            migrationBuilder.CreateIndex(
                name: "IX_UsosVeiculos_MotoristaId",
                table: "UsosVeiculos",
                column: "MotoristaId");

            migrationBuilder.CreateIndex(
                name: "IX_UsosVeiculos_VeiculoId",
                table: "UsosVeiculos",
                column: "VeiculoId");

            migrationBuilder.CreateIndex(
                name: "IX_ManutencoesVeiculos_VeiculoId",
                table: "ManutencoesVeiculos",
                column: "VeiculoId");

            migrationBuilder.CreateIndex(
                name: "IX_Abastecimentos_MotoristaId",
                table: "Abastecimentos",
                column: "MotoristaId");

            migrationBuilder.CreateIndex(
                name: "IX_Abastecimentos_VeiculoId",
                table: "Abastecimentos",
                column: "VeiculoId");
        }
    }
}
