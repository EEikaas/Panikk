# 🎤 PODIEPANIKK!

Et 3D-gameshow i nettleseren for **2–12 spillere** – med buzzere, poengtyveri, tikkende bomber, bløtkaker og en dramatisk finale.
Spill foran TV-en med mobilen som kontroller, spill hele showet på mobilen, eller kombiner begge i samme rom.

> Inspirert av energien i klassiske TV-quizspill, men med eget navn, egne figurer, egen grafikk og eget (syntetisert) lydbilde.

## Innhold

- [Kom i gang lokalt](#kom-i-gang-lokalt)
- [Slik spiller du](#slik-spiller-du)
- [Arkitektur](docs/ARKITEKTUR.md)
- [Spilleregler](docs/SPILLREGLER.md)
- [Administrasjon av spørsmål](docs/ADMIN.md)
- [Publisering på internett](docs/PUBLISERING.md)
- [Status: hva er ferdig, hva gjenstår](docs/STATUS.md)

## Kom i gang lokalt

Krav: **Node.js 20 eller nyere** (testet med 22 LTS).

**Enklest på Windows:** dobbeltklikk på **`Start PODIEPANIKK.bat`**. Den installerer det som trengs første gang, bygger siste versjon, viser adressen mobilene skal bruke og åpner nettleseren. Lukk vinduet for å stoppe spillet.

```bash
npm install
npm run dev
```

- Nettleserklient (Vite): http://localhost:5173
- Server (API + Socket.IO): http://localhost:3001

Mobiler på samme Wi-Fi kan koble seg til via PC-ens IP-adresse, f.eks. `http://192.168.1.20:5173` (Vite skriver ut adressen).
QR-koden i lobbyen bruker adressen du åpnet storskjermen med – åpne derfor storskjermen via IP-adressen, ikke `localhost`, når mobiler skal skanne.

Uten database lagres profiler og resultater i `data/podiepanikk-dev.json`. For PostgreSQL, se [Publisering](docs/PUBLISERING.md).

### Produksjonsbygg lokalt

```bash
npm run build
npm start
```

Serveren leverer da både API, sanntid og den ferdigbygde frontenden på http://localhost:3001.

### Docker (app + PostgreSQL)

```bash
cp .env.example .env   # sett ADMIN_PASSWORD (minst 12 tegn)
docker compose up --build
```

## Tester og simulator

```bash
npm test            # enhetstester (spillmotor) + integrasjonstester (Socket.IO/HTTP)
npm run typecheck   # TypeScript for alle pakker
npm run simulate    # fullt spill med 12 automatiske spillere mot en ekte server
npm run simulate -- --length lang --speed 0.05
```

Simulatoren starter en server, kobler til 1 storskjerm + 12 spillere (4 mobilkontrollere, 4 full mobilvisning og 4 «fjernspillere» med 60–180 ms forsinkelse), lar én spiller miste nettet og koble til igjen, lar én bytte visningsmodus, og kontrollerer at alle 13 klienter ender med identisk spillstatus.

I lobbyen kan verten også trykke **🤖 + Testspiller** for å fylle rommet med datastyrte spillere (slått av i produksjon med mindre `ALLOW_BOTS=true`).

## Slik spiller du

1. **Storskjermen** (TV/PC): Forsiden → *Start et nytt show* → velg modus, nivå og lengde → *Opprett rom*.
2. **Spillerne** skanner QR-koden (eller går til forsiden → *Bli med* → romkode).
3. Velg navn og karakter, trykk **Klar**.
4. Verten trykker **Start showet!** når minst to er klare.

**Alene?** Trykk **🎮 Spill alene** på forsiden, velg antall motstandere og hvor flinke de skal være – showet starter med en gang.

Under spillet kan hver spiller bytte mellom 🎮 *kontroller* og 📱 *full visning* i toppfeltet uten å miste noe.
Verten kan **pause** (tar effekt mellom spørsmål) og **hoppe videre** i visningsfaser.

## Prosjektstruktur

```
apps/
  server/          Node.js + Express + Socket.IO + Prisma (API, sanntid, rom, bots, lagring)
  web/             React + Vite + Three.js / React Three Fiber (alle visninger)
packages/
  shared/          Felles typer, Zod-skjemaer, regler, karakterer, kommentarbibliotek
  game-engine/     Serverautoritativ, deterministisk spillmotor (ren TypeScript, fullt testet)
docs/              Dokumentasjon
```

## Lisens og innhold

Kildekoden har foreløpig ingen lisens – velg en (f.eks. MIT) før du publiserer repoet offentlig.
All grafikk er prosedyregenerert i koden, og all lyd/musikk syntetiseres i nettleseren. Engelske bonusspørsmål hentes (valgfritt) fra Open Trivia Database under CC BY-SA 4.0, med kildehenvisning ved hvert spørsmål.

> ⚠️ Spørsmålsbanken og regelteksten er laget med hjelp av KI. Kontroller fakta før spillet brukes offentlig – spørsmål kan rettes og nye legges til via administrasjonssiden.
