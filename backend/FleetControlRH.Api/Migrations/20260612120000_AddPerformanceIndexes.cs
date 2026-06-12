using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FleetControlRH.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Abastecimentos_VeiculoId_DataAbastecimento",
                table: "Abastecimentos",
                columns: new[] { "VeiculoId", "DataAbastecimento" });

            migrationBuilder.CreateIndex(
                name: "IX_Abastecimentos_MotoristaId_DataAbastecimento",
                table: "Abastecimentos",
                columns: new[] { "MotoristaId", "DataAbastecimento" });

            migrationBuilder.CreateIndex(
                name: "IX_UsosVeiculos_VeiculoId_DataInicio",
                table: "UsosVeiculos",
                columns: new[] { "VeiculoId", "DataInicio" });

            migrationBuilder.CreateIndex(
                name: "IX_UsosVeiculos_MotoristaId_DataInicio",
                table: "UsosVeiculos",
                columns: new[] { "MotoristaId", "DataInicio" });

            migrationBuilder.CreateIndex(
                name: "IX_ManutencoesVeiculos_VeiculoId_DataManutencao",
                table: "ManutencoesVeiculos",
                columns: new[] { "VeiculoId", "DataManutencao" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Abastecimentos_VeiculoId_DataAbastecimento",
                table: "Abastecimentos");

            migrationBuilder.DropIndex(
                name: "IX_Abastecimentos_MotoristaId_DataAbastecimento",
                table: "Abastecimentos");

            migrationBuilder.DropIndex(
                name: "IX_UsosVeiculos_VeiculoId_DataInicio",
                table: "UsosVeiculos");

            migrationBuilder.DropIndex(
                name: "IX_UsosVeiculos_MotoristaId_DataInicio",
                table: "UsosVeiculos");

            migrationBuilder.DropIndex(
                name: "IX_ManutencoesVeiculos_VeiculoId_DataManutencao",
                table: "ManutencoesVeiculos");
        }
    }
}
