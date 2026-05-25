using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FleetControlRH.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUsoVeiculo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UsosVeiculos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    VeiculoId = table.Column<int>(type: "integer", nullable: false),
                    MotoristaId = table.Column<int>(type: "integer", nullable: false),
                    UsuarioId = table.Column<int>(type: "integer", nullable: true),
                    DataInicio = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DataFim = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    KmInicial = table.Column<int>(type: "integer", nullable: false),
                    KmFinal = table.Column<int>(type: "integer", nullable: true),
                    ObservacaoInicio = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ObservacaoFim = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsosVeiculos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UsosVeiculos_Motoristas_MotoristaId",
                        column: x => x.MotoristaId,
                        principalTable: "Motoristas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UsosVeiculos_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_UsosVeiculos_Veiculos_VeiculoId",
                        column: x => x.VeiculoId,
                        principalTable: "Veiculos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UsosVeiculos_MotoristaId",
                table: "UsosVeiculos",
                column: "MotoristaId");

            migrationBuilder.CreateIndex(
                name: "IX_UsosVeiculos_UsuarioId",
                table: "UsosVeiculos",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_UsosVeiculos_VeiculoId",
                table: "UsosVeiculos",
                column: "VeiculoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UsosVeiculos");
        }
    }
}
