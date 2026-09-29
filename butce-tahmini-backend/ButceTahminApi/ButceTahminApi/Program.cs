// Dosya konumu: ButceTahminApi/Program.cs
// Visual Studio'nun oluşturduğu varsayılan Program.cs içeriğinin tamamını
// bununla değiştir.
using Microsoft.EntityFrameworkCore;
using ButceTahminApi.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(opt =>
{
    // ButceKalemi <-> GerceklesenDeger gibi karşılıklı navigasyon
    // ozelliklerinin JSON serilestirmede sonsuz donguye girmesini engeller.
    opt.JsonSerializerOptions.ReferenceHandler =
        System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

builder.Services.AddDbContext<ButceTahminContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("ButceTahminDb")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

//app.UseHttpsRedirection();
app.UseCors("ReactFrontend");
app.UseAuthorization();
app.MapControllers();

app.Run();
