using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FleetControlRH.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace FleetControlRH.Api.Services;

public class TokenService
{
    private readonly IConfiguration _configuration;

    public TokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GerarToken(Usuario usuario)
    {
        var jwtKey =
            _configuration["Jwt:Key"]
            ?? Environment.GetEnvironmentVariable("JWT__Key")
            ?? "FleetControlRH_JWT_SECRET_LOCAL_DEVELOPMENT_KEY";

        var jwtIssuer =
            _configuration["Jwt:Issuer"]
            ?? "FleetControlRH";

        var jwtAudience =
            _configuration["Jwt:Audience"]
            ?? "FleetControlRH";

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
            new Claim(ClaimTypes.Name, usuario.Nome),
            new Claim(ClaimTypes.Email, usuario.Email),
            new Claim(ClaimTypes.Role, usuario.Perfil.ToString()),
            new Claim("Perfil", ((int)usuario.Perfil).ToString())
        };

        if (usuario.MotoristaId.HasValue)
        {
            claims.Add(new Claim("MotoristaId", usuario.MotoristaId.Value.ToString()));
        }

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtKey)
        );

        var credentials = new SigningCredentials(
            key,
            SecurityAlgorithms.HmacSha256
        );

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}