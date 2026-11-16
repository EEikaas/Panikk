# Arkitektur

## Ett spill, tre visninger

```
            ┌──────────────── server (autoritativ) ────────────────┐
 klient ──► │ Socket.IO ─► Zod-validering ─► RoomManager ─► GameEngine │
 handlinger │                                   │ tick(now)            │
            │   ◄── personlig øyeblikksbilde ───┘ (per medlem)         │
            └──────────────────────────────────────────────────────────┘
                 │                  │                    │
           📺 Storskjerm      🎮 Kontroller        📱 Full mobil
           (ScreenView)     (ControllerView)     (FullMobileView)
```

- **`packages/game-engine`** er en ren, deterministisk tilstandsmaskin. All tid sendes inn som `now`, all tilfeldighet kommer fra en seedet RNG. Den har ingen nettverks- eller tidtakerkode og er derfor fullt enhetstestbar.
- **Serveren** eier tidtakerne: etter hver endring planlegges `setTimeout` til `engine.nextWakeAt()`. Klientene sender kun *handlinger* (`game:answer`, `game:buzz`, `game:target`, vertshandlinger).
- **Klientene** viser serverens øyeblikksbilde. De tre visningene er bare forskjellige React-komponenter over samme `PublicState`. Å bytte visning sender `player:update { view }`, som kun lagres for visning i lobbyen og aldri påvirker spillstatus.

## Tilstandsmaskin

```
LOBBY → INTRO → ROUND_INTRO → QUESTION ⇄ BUZZ_ANSWER (Raskest på knappen)
                                  ↓
                               REVEAL → TARGETING → ACTION_RESULT (tyv/kake/bombe)
                                  ↓            ↓
                          neste spørsmål  ←────┘
                                  ↓ (runden ferdig)
                              SCOREBOARD → ROUND_INTRO … → finale → CEREMONY → GAME_OVER
```

Faser med frist: alle unntatt `LOBBY` og `GAME_OVER`. Pause fryser fristen. Pause under et spørsmål blir «ventende» og tar effekt ved neste trygge fase.

## Sanntid og rettferdighet

| Krav | Løsning |
|---|---|
| Serveren bestemmer status, poeng, tid, buzzer | Alt skjer i `GameEngine` på serveren |
| Samme svar telles ikke to ganger | Hver handling har `actionId`; motoren husker `spiller:actionId`. Ett svar per spørsmål. |
| Buzzer-rekkefølge | Serverens mottaksrekkefølge. Node behandler hendelser sekvensielt, så «samtidige» trykk får alltid entydig rekkefølge. Klientens klokke brukes aldri. |
| Tregere nett | 300 ms toleranse etter fristen for svar som er underveis. Klienten måler klokkeavvik (4 målinger, laveste RTT) kun for å vise nedtelling. |
| Fasit lekker ikke | Øyeblikksbildet inneholder aldri riktig svar før `REVEAL`, og andre spilleres valg skjules til avsløringen. |
| Gjenoppkobling | Hver deltaker får et hemmelig token (32 byte). Token lagres per fane (sessionStorage) + reserve i localStorage. Ved nettbrudd kobler klienten automatisk til igjen med tokenet og får full status. |
| Frakoblede stopper ikke spillet | «Alle har svart» teller bare tilkoblede spillere. Frakoblet bombeholder får bomben flyttet. Frister løper uansett. |
| Vert forsvinner | Spillet fortsetter. Etter 45 s overføres vertsrollen til en annen tilkoblet deltaker. |

## Lagring

`Store`-grensesnittet har to implementasjoner:

- **PrismaStore** (PostgreSQL) – aktiveres når `DATABASE_URL` er satt. Migrasjoner i `apps/server/prisma/migrations`.
- **MemoryStore** – i minnet, valgfritt speilet til en JSON-fil (`DATA_FILE`). Brukes i utvikling og tester.

Rom og pågående spill lever i serverens minne (lav latens). Derfor: kjør én serverinstans, eller bruk «sticky sessions» + delt rom-tilstand hvis du skal skalere horisontalt (ikke implementert).

## Sikkerhet

- Helmet med streng CSP (kun egen opprinnelse; ingen tredjeparts fonter/skript), HSTS i produksjon.
- Zod-validering av alle socket- og HTTP-data. React escaper all tekst (ingen `dangerouslySetInnerHTML`).
- Passord: scrypt med salt. Sesjoner: tilfeldig token i `HttpOnly; SameSite=Lax; Secure`-kapsel, kun SHA-256-hash lagres.
- Roller settes aldri fra klienten; administrator opprettes fra miljøvariabler.
- CSRF-vern: endrende API-kall må komme fra samme opprinnelse.
- Rate limiting: HTTP (generelt + innlogging), socket-hendelser (token-bøtte per tilkobling), romoppretting og join per IP.
- Romkoder (5 tegn, uten forvekslbare tegn) utløper: 3 t uten start, 30 min uten tilkoblede, maks 8 t.
- Personvern: gjester lagres uten navn; topplister er opt-in og viser kun visningsnavn; profiler kan slettes (resultater anonymiseres). Ingen e-post samles inn.

## Ytelse i 3D

- Delte geometrier/materialer, instansiert LED-vegg (240 paneler), publikum (60–150) og konfetti.
- Automatisk kvalitet: lavere oppløsning og færre lys på mobil; `PerformanceMonitor` senker oppløsningen ved lav bildefrekvens.
- Ingen 3D-filer lastes ned – alt er prosedyregenerert. Three.js deles i egne, cachebare bunter.
- «Redusert bevegelse» respekteres; reservevisning uten WebGL (`StudioLite`).
