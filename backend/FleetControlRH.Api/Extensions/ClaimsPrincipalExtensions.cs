using System.Security.Claims;

namespace FleetControlRH.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static bool TemPermissao(this ClaimsPrincipal user, string permissao)
    {
        return user.Claims.Any(x =>
            x.Type == "Permissao" &&
            x.Value == permissao);
    }
}