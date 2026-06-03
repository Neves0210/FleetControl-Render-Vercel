using System.Text;
using FleetControlRH.Api.Data;
using FleetControlRH.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Http.Features;

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

var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
var postgresConnection = builder.Configuration.GetConnectionString("PostgresConnection");
var sqliteConnection = builder.Configuration.GetConnectionString("DefaultConnection");

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
    );
});

builder.Services.AddScoped<TokenService>();
builder.Services.AddHttpClient<NotaFiscalService>();
builder.Services.AddHttpClient<NfceReaderService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactApp", policy =>
    {
        var origins = (Environment.GetEnvironmentVariable("AllowedOrigins") ?? "http://localhost:5173")
            .Split(",", StringSplitOptions.RemoveEmptyEntries);

        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
    ?? builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("JWT key não configurada.");

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

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 25 * 1024 * 1024;
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

app.UseStaticFiles();
// app.UseCors("Frontend");
app.UseCors("ReactApp");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok", app = "FleetControlRH.Api" }));
app.Run();
