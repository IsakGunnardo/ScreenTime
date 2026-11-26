# ---------- Bygg ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ScreenTime.Api/ScreenTime.Api.csproj ScreenTime.Api/
RUN dotnet restore ScreenTime.Api/ScreenTime.Api.csproj
COPY ScreenTime.Api/ ScreenTime.Api/
RUN dotnet publish ScreenTime.Api/ScreenTime.Api.csproj -c Release -o /out --no-restore

# ---------- Kör ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0
# tzdata behövs för att "idag" ska räknas i Europe/Stockholm.
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends tzdata \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out .
# data/ (databas, foton, signeringsnyckel) monteras som volym. Skapas här så att volymen ärver rätt ägare.
RUN mkdir -p /app/data && chown -R app:app /app/data
USER app
ENV ASPNETCORE_URLS=http://+:5080 \
    TZ=Europe/Stockholm
EXPOSE 5080
ENTRYPOINT ["dotnet", "ScreenTime.Api.dll"]
