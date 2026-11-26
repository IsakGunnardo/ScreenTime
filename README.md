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

API:t lyssnar på `http://0.0.0.0:5080`. Databasen (`data/screentime.db`) skapas vid första start. Utan Anthropic-nyckel funkar allt, men AI-kollen är avstängd.

> **Har du kört en äldre version?** Radera `data/screentime.db` innan du startar, eftersom datamodellen har ändrats.

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

## Konton

- **Förälder** skapar konto med e-post och lösenord. Då skapas en **familj** med en familjekod (t.ex. `K7QP3X`) och fem startuppdrag.
- **Andra föräldern** skapar eget konto och kryssar i "Min partner har redan skapat familjen" och fyller i familjekoden.
- **Barn** läggs till av föräldern under *Familj* med namn, avatar, färg och en fyrsiffrig PIN. Barnet loggar in på sin egen enhet med familjekod, väljer sig själv och skriver sin PIN. Ingen e-post behövs.
- Föräldrar ser och godkänner bara sin egen familj. Barn ser bara sina egna uppdrag och kan inte godkänna något.
- Sessionen (JWT) sparas krypterat på telefonen (`expo-secure-store`): 30 dagar för föräldrar och 180 dagar för barn.

## Flödet

1. **Barn** loggar in → ser nivå, skärmtidssaldo, mynt, streak och dagens uppdrag.
2. Startar ett uppdrag → **tar ett foto med kameran** (inte från galleriet, så bevisen tas på plats).
3. Bilden krymps till max 1280 px och laddas upp. Om uppdraget har AI-koll skickar backend den till Claude, som svarar med `complete`, `confidence` och feedback till barn och förälder.
4. Barnet ser roboten svara direkt och kan ta en ny bild eller "Skicka ändå".
5. **Förälder** ser bild, AI-bedömning och belöning → Godkänn / Skicka tillbaka med kommentar / Neka.
6. Barnets skärm uppdateras (polling var 3:e sekund) → konfetti + belöning.

## Designregler (gäller all kod)

- **All data filtreras på familjen i token**, aldrig på id:n som klienten skickar. Barnhandlingar (`start/photo/submit`) kräver barnrollen och att uppdraget är barnets eget. Föräldrahandlingar kräver föräldrarollen och samma familj.
- Lösenord och PIN hashas med ASP.NET Identitys `PasswordHasher` (PBKDF2). Inloggning är begränsad till 10 försök per minut och IP.
- JWT och foto-URL:er signeras med en hemlig nyckel. Den hämtas från `Auth:SigningKey` (base64) eller skapas automatiskt i `data/signing.key`.
- **Foton serveras via signerade URL:er som gäller i 1 timme**, så att `<Image>` kan visa dem utan inloggningsheader och utan att de går att gissa.

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

Alla anrop utom `auth/*`, `config` och `photos` kräver `Authorization: Bearer <token>`.

| Metod | Väg | Roll | Vad |
|---|---|---|---|
| POST | `/api/auth/register` | – | `{ name, email, password, familyName?, joinCode? }` |
| POST | `/api/auth/login` | – | `{ email, password }` |
| GET | `/api/auth/family/{code}/children` | – | Barnen i en familj (för barnets inloggning) |
| POST | `/api/auth/child-login` | – | `{ familyCode, childId, pin }` |
| GET | `/api/me` | alla | Vem är inloggad |
| GET | `/api/family/children` | förälder | Barn med saldo, nivå och streak |
| POST | `/api/family/children` | förälder | `{ name, avatar, color, pin }` |
| PUT | `/api/family/children/{id}/pin` | förälder | `{ pin }` |
| GET | `/api/children/{id}/today` | barnet / förälder | Dagens uppdrag |
| GET | `/api/instances/{id}` | barnet / förälder | Ett uppdrag |
| POST | `/api/instances/{id}/start` | barn | Starta |
| POST | `/api/instances/{id}/photo` | barn | multipart `photo` (JPEG) → AI-koll |
| POST | `/api/instances/{id}/submit` | barn | Skicka till förälder |
| GET | `/api/parent/queue` | förälder | Väntande godkännanden |
| POST | `/api/instances/{id}/approve` | förälder | Godkänn (idempotent) |
| POST | `/api/instances/{id}/return` | förälder | `{ comment }` |
| POST | `/api/instances/{id}/reject` | förälder | `{ comment }` |
| GET | `/api/photos/{file}?exp=&sig=` | – | Bevisbild (signerad URL) |

## Medvetet inte med än

- Glömt lösenord, e-postverifiering, ta bort barn och redigera uppdrag.
- HTTPS. Kör bara på hemnätet tills backend ligger bakom TLS.
- SignalR. Polling används tills vidare.
- Lyckohjul, Smutsmonster, avatar-mognad och pengabelöning (se PRD v0.2).
- EF-migrations. `EnsureCreated` används i dev, så radera `data/screentime.db` om modellen ändras.
