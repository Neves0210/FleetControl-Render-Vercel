using System.Text;
using FleetControlRH.Api.Data;
using FleetControlRH.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.RateLimiting;
using Npgsql;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(BuildDatabaseConnectionString(builder.Configuration));
});

builder.Services.AddScoped<TokenService>();
builder.Services.AddHttpClient<NotaFiscalService>();
builder.Services.AddHttpClient<NfceReaderService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactApp", policy =>
    {
        var origins = BuildAllowedOrigins(builder.Configuration);

        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
    ?? builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("JWT key não configurada.");

if (builder.Environment.IsProduction() && jwtKey.Contains("TROCAR", StringComparison.OrdinalIgnoreCase))
{
    throw new InvalidOperationException("Configure uma JWT_KEY segura no ambiente de producao.");
}

if (jwtKey.Length < 32)
{
    throw new InvalidOperationException("JWT_KEY deve ter pelo menos 32 caracteres.");
}

var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "FleetControlRH",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "FleetControlRHUsers",
            IssuerSigningKey = key
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("Login", limiter =>
    {
        limiter.PermitLimit = 5;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 5 * 1024 * 1024;
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    DbSeeder.Seed(db);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.Use(async (context, next) =>
{
    context.Response.Headers.TryAdd("X-Content-Type-Options", "nosniff");
    context.Response.Headers.TryAdd("X-Frame-Options", "DENY");
    context.Response.Headers.TryAdd("Referrer-Policy", "no-referrer");
    await next();
});

app.UseStaticFiles();
// app.UseCors("Frontend");
app.UseCors("ReactApp");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok", app = "FleetControlRH.Api" }));
app.Run();

static string BuildDatabaseConnectionString(IConfiguration configuration)
{
    var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");

    if (!string.IsNullOrWhiteSpace(databaseUrl))
    {
        return BuildPostgresConnectionString(databaseUrl);
    }

    var postgresConnection = configuration.GetConnectionString("PostgresConnection");
    if (!string.IsNullOrWhiteSpace(postgresConnection))
    {
        return postgresConnection;
    }

    return configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("Connection string nao configurada.");
}

static string[] BuildAllowedOrigins(IConfiguration configuration)
{
    var configuredOrigins = (configuration["AllowedOrigins"] ?? string.Empty)
        .Split(",", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    var origins = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "http://localhost:5173",
        "https://fleet-control-render-vercel.vercel.app"
    };

    foreach (var origin in configuredOrigins)
    {
        origins.Add(origin);
    }

    return origins.ToArray();
}

static string BuildPostgresConnectionString(string value)
{
    var connection = value.Trim().Trim('"', '\'');

    if (connection.Contains('=') || connection.Contains(';'))
    {
        return connection;
    }

    return ConvertDatabaseUrlToConnectionString(connection);
}

static string ConvertDatabaseUrlToConnectionString(string databaseUrl)
{
    var uri = new Uri(databaseUrl);
    var userInfo = uri.UserInfo.Split(':', 2);

    var builder = new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Database = uri.AbsolutePath.TrimStart('/'),
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty,
        SslMode = SslMode.Require
    };

    return builder.ConnectionString;
}
