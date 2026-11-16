# Publisering på internett

Spillet trenger en server med **vedvarende WebSocket-tilkoblinger** (Socket.IO). Statisk hosting (Netlify/GitHub Pages alene) er ikke nok.
Anbefalt: **Fly.io** eller **Render** + administrert PostgreSQL. Begge gir HTTPS/WSS automatisk.

Kjør **én** serverinstans: rommene lever i serverens minne. (Horisontal skalering krever sticky sessions + delt romtilstand – ikke implementert.)

## Felles før publisering

1. Velg en lisens og legg den i repoet.
2. Sett hemmeligheter i plattformens hemmelighetslager – aldri i Git:
   - `ADMIN_PASSWORD` (minst 12 tegn)
   - `DATABASE_URL` (settes ofte automatisk av plattformen)
3. `NODE_ENV=production` gir sikre informasjonskapsler (Secure), HSTS og slår av testspillere.
4. Aktiver tofaktorautentisering på GitHub, Fly.io/Render og databaseleverandøren.

## Alternativ A: Fly.io

```bash
fly launch --no-deploy            # bruker fly.toml og Dockerfile
fly postgres create               # eller annen administrert Postgres
fly postgres attach <db-navn>     # setter DATABASE_URL
fly secrets set ADMIN_PASSWORD='<sterkt passord>'
fly deploy
```

Databasemigrasjonene kjøres automatisk ved oppstart (`prisma migrate deploy`). `auto_stop_machines` er slått av slik at pågående spill ikke avbrytes.

## Alternativ B: Render

1. Koble GitHub-repoet til Render og velg **New → Blueprint** (bruker `render.yaml`).
2. Sett `ADMIN_PASSWORD` i dashbordet.
3. Render bygger Docker-bildet, oppretter databasen og setter `DATABASE_URL`.

## Alternativ C: Egen server (VPS) med Docker

```bash
cp .env.example .env    # fyll inn ADMIN_PASSWORD, POSTGRES_PASSWORD
docker compose up -d --build
```

Sett en reverse proxy med TLS foran (Caddy/Nginx). Husk WebSocket-oppgradering for `/socket.io/`. Eksempel (Caddy):

```
podiepanikk.example.no {
  reverse_proxy localhost:3001
}
```

## Etter publisering

- Sjekk `https://<domene>/api/health`.
- Logg inn på `/admin` og kontroller spørsmålsbanken.
- Test et spill med mobiler på mobilnett (ikke bare Wi-Fi).
- Overvåk logger for `[http]`- og `[socket]`-feil.

## Personvern (GDPR)

- Ingen sporing, ingen tredjeparts skript/fonter, ingen e-post samles inn.
- Gjestenavn lagres ikke etter spillet. Innloggede brukeres resultater lagres; topplister er opt-in.
- Brukere kan slette profilen sin selv (resultater anonymiseres).
- Lag en personvernerklæring tilpasset din virksomhet før offentlig lansering, spesielt fordi barn kan delta.
