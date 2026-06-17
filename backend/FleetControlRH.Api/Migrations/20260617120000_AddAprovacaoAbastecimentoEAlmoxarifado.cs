using System;
using FleetControlRH.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FleetControlRH.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260617120000_AddAprovacaoAbastecimentoEAlmoxarifado")]
    public partial class AddAprovacaoAbastecimentoEAlmoxarifado : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Abastecimentos",
                type: "integer",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddColumn<int>(
                name: "LiberadoPorUsuarioId",
                table: "Abastecimentos",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LiberadoEm",
                table: "Abastecimentos",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ObservacaoLiberacao",
                table: "Abastecimentos",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Abastecimentos_LiberadoPorUsuarioId",
                table: "Abastecimentos",
                column: "LiberadoPorUsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Abastecimentos_Status",
                table: "Abastecimentos",
                column: "Status");

            migrationBuilder.AddForeignKey(
                name: "FK_Abastecimentos_Usuarios_LiberadoPorUsuarioId",
                table: "Abastecimentos",
                column: "LiberadoPorUsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Abastecimentos_Usuarios_LiberadoPorUsuarioId",
                table: "Abastecimentos");

            migrationBuilder.DropIndex(
                name: "IX_Abastecimentos_LiberadoPorUsuarioId",
                table: "Abastecimentos");

            migrationBuilder.DropIndex(
                name: "IX_Abastecimentos_Status",
                table: "Abastecimentos");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Abastecimentos");

            migrationBuilder.DropColumn(
                name: "LiberadoPorUsuarioId",
                table: "Abastecimentos");

            migrationBuilder.DropColumn(
                name: "LiberadoEm",
                table: "Abastecimentos");

            migrationBuilder.DropColumn(
                name: "ObservacaoLiberacao",
                table: "Abastecimentos");
        }
    }
}
