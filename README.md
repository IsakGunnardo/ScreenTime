# ScreenTime

Familjeapp där barn gör hushållsuppdrag, fotar dem som bevis och tjänar skärmtid. En AI tittar på bilden och ger barnet direkt feedback ("Jag ser några glas kvar"), men **föräldern godkänner alltid**.

```
app/       Expo / React Native (TypeScript, expo-router)
backend/   .NET 10 Web API (C#, EF Core + SQLite)
```

## Kom igång

### 1. Backend

Kräver .NET 10 SDK (`dotnet --list-sdks`).

```bash
cd backend/ScreenTime.Api

# Lägg in din Anthropic-nyckel (sparas utanför repot, hamnar aldrig i appen)
dotnet user-secrets set "Anthropic:ApiKey" "sk-ant-..."

dotnet run
```

API:t lyssnar på `http://0.0.0.0:5080`. Databasen (`data/screentime.db`) skapas och fylls med två barn (Elsa, Leo) och fem sysslor vid första start. Utan nyckel funkar allt, men AI-kollen är avstängd.

Alternativ till user-secrets: miljövariabeln `ANTHROPIC_API_KEY`.
Modell och tröskel ställs i `appsettings.json` → `Anthropic:Model` / `Anthropic:MinConfidence`.

### 2. App

```bash
cd app
npm install
npx expo start
```

Skanna QR-koden med **Expo Go** på telefonen. Appen hittar själv backend på samma IP som din Mac (port 5080), så telefon och Mac måste vara på samma wifi. Vill du peka någon annanstans: `EXPO_PUBLIC_API_URL=http://192.168.1.20:5080 npx expo start`.

Kameran fungerar bara på riktig telefon (inte i iOS-simulatorn).

## Flödet

1. **Barn** väljer sig själv → ser nivå, skärmtidssaldo, mynt, streak och dagens uppdrag.
2. Startar ett uppdrag → **tar ett foto med kameran** (inte från galleriet, så bevisen tas på plats).
3. Bilden krymps till max 1280 px och laddas upp. Om uppdraget har AI-koll skickar backend den till Claude, som svarar med `complete`, `confidence` och feedback till barn och förälder.
4. Barnet ser roboten svara direkt och kan ta en ny bild eller "Skicka ändå".
5. **Förälder** ser bild, AI-bedömning och belöning → Godkänn / Skicka tillbaka med kommentar / Neka.
6. Barnets skärm uppdateras (polling var 3:e sekund) → konfetti + belöning.

## Designregler (gäller all kod)

- **AI är rådgivande, aldrig beslutande.** Bara föräldern kan godkänna.
- AI-svar under `MinConfidence` (0,6) visas inte, och då gäller vanligt manuellt flöde. Fel från AI-anropet faller också tillbaka tyst.
- AI-mallar är fördefinierade (`VerificationTemplates`). Föräldrar skriver aldrig fri prompt.
- Text på bilden behandlas aldrig som instruktioner (står i systemprompten).
- **Foton raderas automatiskt efter 7 dagar** (`PhotoCleanupService`). Bara JPEG, max 8 MB.
- **Ledger, inte kolumner.** Saldo = summan av `LedgerEntry`. Godkännande är en transaktion och idempotent (unikt index på `ChoreInstanceId + Currency + Type`).
- Belöningen snapshotas på `ChoreInstance` när dagens uppdrag skapas.
- Statusmaskin: `Available → InProgress → Submitted → Approved | Returned | Rejected`, och `Returned → InProgress`.
- "Idag" räknas i Europe/Stockholm.

## API

| Metod | Väg | Vad |
|---|---|---|
| GET | `/api/config` | `{ aiEnabled }` |
| GET | `/api/children` | Barn med saldo, nivå, streak |
| GET | `/api/children/{id}/today` | Barnets dagliga uppdrag (skapas vid behov) |
| GET | `/api/instances/{id}` | Ett uppdrag |
| POST | `/api/instances/{id}/start` | Starta |
| POST | `/api/instances/{id}/photo` | multipart `photo` (JPEG) → AI-koll |
| POST | `/api/instances/{id}/submit` | Skicka till förälder |
| GET | `/api/parent/queue` | Väntande godkännanden |
| POST | `/api/instances/{id}/approve` | Godkänn (idempotent) |
| POST | `/api/instances/{id}/return` | `{ comment }` |
| POST | `/api/instances/{id}/reject` | `{ comment }` |
| GET | `/api/photos/{file}` | Bevisbild |

## Medvetet inte med än

- Inloggning och familjekonton. Rollen väljs på startskärmen, så kör bara på hemnätet.
- SignalR. Polling används tills vidare.
- Lyckohjul, Smutsmonster, avatar-mognad och pengabelöning (se PRD v0.2).
- EF-migrations. `EnsureCreated` används i dev, så radera `data/screentime.db` om modellen ändras.
