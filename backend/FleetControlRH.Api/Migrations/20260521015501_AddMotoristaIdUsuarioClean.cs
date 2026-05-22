using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FleetControlRH.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMotoristaIdUsuarioClean : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MotoristaId",
                table: "Usuarios",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Usuarios_MotoristaId",
                table: "Usuarios",
                column: "MotoristaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Usuarios_Motoristas_MotoristaId",
                table: "Usuarios",
                column: "MotoristaId",
                principalTable: "Motoristas",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Usuarios_Motoristas_MotoristaId",
                table: "Usuarios");

            migrationBuilder.DropIndex(
                name: "IX_Usuarios_MotoristaId",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "MotoristaId",
                table: "Usuarios");
        }
    }
}
