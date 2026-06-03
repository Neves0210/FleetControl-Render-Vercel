using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FleetControlRH.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFotoNotaFiscalBytes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "FotoNotaFiscal",
                table: "Abastecimentos",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoNotaFiscalContentType",
                table: "Abastecimentos",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FotoNotaFiscal",
                table: "Abastecimentos");

            migrationBuilder.DropColumn(
                name: "FotoNotaFiscalContentType",
                table: "Abastecimentos");
        }
    }
}
