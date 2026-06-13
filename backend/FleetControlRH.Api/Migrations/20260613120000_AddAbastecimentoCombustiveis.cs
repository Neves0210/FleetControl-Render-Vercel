using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FleetControlRH.Api.Migrations
{
    public partial class AddAbastecimentoCombustiveis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AbastecimentoCombustiveis",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AbastecimentoId = table.Column<int>(type: "integer", nullable: false),
                    DescricaoCombustivel = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Litros = table.Column<decimal>(type: "decimal(10,3)", nullable: false),
                    ValorUnitario = table.Column<decimal>(type: "decimal(10,3)", nullable: true),
                    ValorTotal = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AbastecimentoCombustiveis", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AbastecimentoCombustiveis_Abastecimentos_AbastecimentoId",
                        column: x => x.AbastecimentoId,
                        principalTable: "Abastecimentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AbastecimentoCombustiveis_AbastecimentoId",
                table: "AbastecimentoCombustiveis",
                column: "AbastecimentoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AbastecimentoCombustiveis");
        }
    }
}
