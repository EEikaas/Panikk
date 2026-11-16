# Status (16.11.2026)

Ærlig oversikt over hva som er implementert og hvordan det er verifisert.
✅ = implementert og verifisert · 🟡 = implementert, men ikke verifisert i ekte miljø · ❌ = ikke implementert

## Spillmotor og sanntid

| Funksjon | Status | Verifisering |
|---|---|---|
| Serverautoritativ tilstandsmaskin, alle seks runder | ✅ | 39 enhetstester (`engine.test.ts`) |
| Buzzer-rekkefølge, idempotente svar, frister, toleranse | ✅ | Enhetstester |
| Poengtyveri med grenser, kakekrig, bombe med lunte, finale + sudden death | ✅ | Enhetstester |
| Pause, «videre», omkamp, frakobling/gjenoppkobling, vertsoverføring | ✅ | Enhets- og integrasjonstester, nettleser |
| 2–12 spillere, 13. avvises, storskjerm teller ikke | ✅ | Integrasjonstest |
| 12 samtidige spillere (4 kontroller + 4 full mobil + 4 «fjernspillere» med 60–180 ms forsinkelse) | ✅ | Integrasjonstest + `npm run simulate` (kort og langt spill, 0 konsistensfeil) |
| Bytte visningsmodus midt i spillet | ✅ | Enhets- og integrasjonstest |
| Enspillermodus med tre styrkenivåer, autostart og omkamp | ✅ | Integrasjonstest (helt spill) + nettleser |
| Kategori «Voksen 18+» (58 spørsmål, frekk programleder, sperret utenfor voksennivå) | ✅ | Enhetstester for sperrer og kommentarer; spørsmålene er KI-laget og ikke faktasjekket |

## Klient

| Funksjon | Status | Verifisering |
|---|---|---|
| Forside med 3D, opprett spill, bli med (kode/QR/lenke) | ✅ | Testet i nettleser |
| Lobby (storskjerm og mobil), karaktervalg i roterbar 3D, klar, fjern spiller, testspillere | ✅ | Testet i nettleser |
| Storskjerm: 3D-studio, podier, LED-vegger, publikum, kamerastyring, overlegg | ✅ | Testet i nettleser (skjermbilder) |
| Full mobilvisning (stående format) | ✅ | Testet i nettleser med 375×812-emulering |
| Mobilkontroller (buzzer, fargeknapper, målvelger) | 🟡 | Bygget og typesjekket; logikken deles med full visning, men ikke visuelt gjennomgått |
| Helt spill fra lobby til seremoni og omkamp i nettleseren | ✅ | Gjennomført (storskjerm + mobilspiller + 4 bots), ingen konsollfeil |
| Effekter: kakekast, myntregn ved tyveri, bombe/eksplosjon, konfetti | 🟡 | Implementert; ikke fanget på skjermbilde |
| Lyd og musikk (syntetisert) | 🟡 | Koden kjører uten feil, men er ikke lyttet til |
| Haptikk | 🟡 | Kun Android/Chrome støtter vibrasjon; ikke testet på enhet |
| Profil, toppliste, administrasjon, innstillinger | 🟡 | API dekket av integrasjonstester; sidene er bygget, men ikke klikket gjennom i nettleser |
| Reservevisning uten WebGL, redusert bevegelse, kvalitetsnivåer | 🟡 | Implementert, ikke testet på enhet uten WebGL |

## Server, data og drift

| Funksjon | Status | Verifisering |
|---|---|---|
| Socket.IO + Express, Zod-validering, rate limiting, CSP/Helmet, CSRF-sjekk | ✅ | Integrasjonstester |
| Innlogging (scrypt, HttpOnly-sesjoner), roller kun fra server, sletting av profil | ✅ | Integrasjonstester |
| Admin: opprett/rediger/slett/aktiver spørsmål, CSV/JSON-import | ✅ | Integrasjonstester (API) |
| Minne/fil-lagring | ✅ | Tester |
| PostgreSQL via Prisma (`PrismaStore`) + migrasjon | 🟡 | Prisma-klient generert og migrasjon generert fra skjema, **men ikke kjørt mot en ekte database** |
| Ekstern spørsmålskilde (Open Trivia DB) | 🟡 | Validering og feilhåndtering testet med falske svar; ikke testet mot det ekte API-et |
| Dockerfile, docker-compose, Fly.io, Render, GitHub Actions | 🟡 | Skrevet, **ikke bygget/kjørt** (Docker var ikke tilgjengelig) |

## Gjenstår / kjente begrensninger

- Test på ekte iPhone (Safari) og Android (Chrome) over mobilnett.
- Kjør `docker compose up --build` og en publisering til Fly.io eller Render; verifiser PrismaStore mot PostgreSQL.
- Faktasjekk spørsmålsbanken (KI-assistert) før offentlig bruk.
- Spillengdene (10–15 / 20–30 / 35–50 min) er beregnede mål; juster `LENGTH_CONFIG`/`TIMING` etter testing med ekte spillere.
- Horisontal skalering (flere serverinstanser) støttes ikke – rom lever i minnet på én instans.
- Ingen automatisert nettleser-E2E-suite (f.eks. Playwright) i repoet ennå; E2E dekkes av Socket.IO-simulatoren.
- `packages/ui` fra oppdragsbeskrivelsen er ikke opprettet; UI-komponentene ligger i `apps/web/src/components`.
- Karakterene er prosedyrisk bygget av enkle 3D-former (ingen modellerte figurer).
- Velg lisens og skriv personvernerklæring før lansering.
