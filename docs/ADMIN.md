# Administrasjon av spørsmål

## Tilgang

Administratoren opprettes (eller får passordet oppdatert) automatisk ved oppstart fra miljøvariablene:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<minst 12 tegn>
```

Logg inn på `/admin` (lenke nederst på innstillingssiden). Rollen settes kun på serveren – den kan ikke oppnås ved å endre frontend.
Bruk et sterkt, unikt passord og hold `.env`/hemmeligheter utenfor Git.

## Spørsmålskilder

1. **Innebygd bank** – ca. 310 norske spørsmål i `apps/server/src/questions/bank.ts` (barn/familie/voksen). Endres i koden.
2. **Egne spørsmål** – opprettes, redigeres, (de)aktiveres og slettes på `/admin`. Aktive spørsmål blandes inn i alle **nye** spill.
3. **Open Trivia Database** – valgfritt per spill («engelske bonusspørsmål»). Lisens CC BY-SA 4.0; kilde vises på storskjermen. Alle eksterne spørsmål valideres (4 unike alternativer, lengdegrenser); ugyldige forkastes.

## Import

**CSV** (komma eller semikolon, UTF-8, overskriftsrad valgfri):

```csv
tekst,a,b,c,d,riktig,kategori,nivå,kilde
"Hva heter Norges høyeste fjell?",Galdhøpiggen,Snøhetta,Glittertind,Gaustatoppen,A,norge,familie,
```

- `riktig`: A–D (eller 1–4)
- `kategori`: generelt, geografi, historie, vitenskap, filmtv, musikk, sport, dyr, mat, teknologi, norge, voksen18, blandet
- `voksen18` brukes bare i spill der verten har valgt 18+ på voksennivå. Sett nivået til `voksen` på slike spørsmål.
- `nivå`: barn, familie, voksen

**JSON**:

```json
[
  { "text": "Hva er 2 + 2?", "options": ["4", "3", "5", "22"], "correct": "A", "category": "generelt", "difficulty": "barn", "source": "Egen" }
]
```

Trykk **Kontroller** først for å se feil per rad uten å lagre. Maks 2000 spørsmål og 1,5 MB per import.

## Kvalitetssikring

- Alle fire alternativer må være forskjellige; riktig svar må være entydig.
- Barnespørsmål bør være forståelige uten lesing av lange tekster.
- KI-genererte eller importerte spørsmål bør faktasjekkes av en person før bruk.
- Deaktiver i stedet for å slette hvis du er usikker – deaktiverte spørsmål brukes ikke.

## Drift

- `GET /api/health` – helsesjekk (antall rom, lagringstype).
- `GET /api/admin/stats` – aktive rom (krever admin).
