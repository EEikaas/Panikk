# Spilleregler

Alle tall er definert i `packages/shared/src/constants.ts` (`SCORING`, `TIMING`, `LENGTH_CONFIG`) og kan justeres etter testing.
Poengsummer kan aldri bli negative.

## Spillengde

| Lengde | Runder (inkl. finale) | Spørsmål per runde | Bomber | Finalemål |
|---|---|---|---|---|
| Kort | 3 | 6 | 2 | 7 steg |
| Normalt | 4–5 | 8 | 3 | 9 steg |
| Langt | 6 (alle) | 10 | 3 | 10 steg |

Rundene trekkes tilfeldig (uten gjentakelse) og spilles alltid i rekkefølgen Poengsamleren → Raskest på knappen → Poengtyven → Kakekrigen → Tikkende bombe → **Finalen sist**. Ingen spørsmål gjentas i samme spill.

## Rundene

**Poengsamleren** – alle svarer samtidig (15 s, 20 s på barnenivå). Riktig: 500 + fartsbonus opptil 500 (lineært med gjenværende tid). Feil/ingen svar: 0.

**Raskest på knappen** – 12 s til å buzze. Den første buzzen serveren mottar, får 7 s til å svare. Riktig: +600. Feil eller tidsavbrudd: −300 og utestengt fra spørsmålet; de andre får 7 nye sekunder til å buzze. Ingen buzz → fasit vises.

**Poengtyven** – alle svarer. Riktig: +200 og rett til å stjele. Hver tyv velger én motstander (10 s). Tyverier gjennomføres i rekkefølge etter svarfart; hver stjeler inntil 300, men aldri mer enn offeret har.

**Kakekrigen** – alle svarer. Riktig: +200 og én bløtkake. Treff: offeret −250 (aldri under 0), kasteren +100.

**Tikkende bombe** – én spiller har bomben og får spørsmål (10 s). Riktig: +100 og spilleren velger hvem bomben sendes til (6 s, ellers tilfeldig). Feil/ingen svar: beholder bomben, nytt spørsmål. Lunta (30–50 s, skjult) brenner bare mens bombeholderen svarer eller velger. Når den er brent ut: −500 til holderen, ny bombe starter hos en annen spiller. Er holderen frakoblet, flyttes bomben automatisk.

**Den store finalen** – alle starter med forsprang etter poeng: `round(3 × egne poeng / høyeste poeng)` steg. Alle svarer på hvert spørsmål; svartiden krymper fra 10 til 6 s.
- Riktig: +1 steg (+300 poeng). Raskeste riktige: +2 steg.
- Feil svar: −1 steg (aldri under 0). Ikke svart: 0.
- Første som når målet vinner. Når flere når målet samtidig, eller makstallet spørsmål er nådd, vinner den med flest steg.
- **Uavgjort → sudden death:** bare de som står likt svarer; raskeste riktige vinner. Ingen riktige → nytt spørsmål.
- Tar spørsmålene slutt: flest steg → flest poeng → lavest snittid → først påmeldt.

Vinneren av finalen vinner showet. Resultatlista sorteres etter vinner, finalesteg og poeng.

## Enspillermodus («Spill alene»)

- Én spiller mot 1–11 datastyrte motstandere som heter det samme som karakterene sine.
- Styrke: **Lett** (kan ca. 30 %, treg på knappen), **Middels** (ca. 55 %), **Vanskelig** (ca. 80 %, rask). Gjetter ellers tilfeldig.
- Showet starter med en gang og spilles i full mobilvisning. Omkamp starter også automatisk.
- Ingen andre kan bli med i et solorom, og solospill teller ikke på profiler eller topplister.

## Voksen 18+

- Egen kategori med spørsmål om fest, uteliv, drinker, dating og grov humor (58 spørsmål).
- Kan bare velges på nivå **Voksen**, og verten må bekrefte at alle spillere er over 18 år.
- Kommer **aldri** med i barne- eller familiespill, eller i voksenspill der kategorien ikke er valgt. Dette håndheves på serveren.
- Når den er valgt, får programlederen i tillegg frekkere kommentarer (omtrent annenhver gang), og lobbyen viser «🔞 Kun for voksne».
- Velges bare 18+, fylles det på med vanlige voksenspørsmål hvis showet trenger flere.
- Grensen for humoren: grovt og frekt, men ingen vitser om etnisitet, religion, kjønn, legning eller funksjonsevne.

## Spesielle situasjoner

| Situasjon | Regel |
|---|---|
| Spiller svarer ikke | Teller som ingen svar (0 poeng / ingen steg; bombe: beholder bomben). |
| Spiller mister nettet | Beholder plass, karakter og poeng. Spørsmålet lukkes når alle *tilkoblede* har svart. |
| Spiller forlater rommet | I lobbyen: fjernes. Under spill: markeres som «forlatt», kan ikke angripes, står i resultatlista. |
| Spiller kommer tilbake | Kobles automatisk til samme plass med hemmelig token. |
| Verten kobler fra | Spillet fortsetter; vertsrollen overføres etter 45 s. |
| Samtidige buzzertrykk | Serverens mottaksrekkefølge avgjør entydig. |
| Ekstern spørsmåls-API feiler | Den innebygde banken brukes. Riktig svar gjettes aldri. |
| For få spørsmål | Fyller på fra andre kategorier, deretter nabonivå (varsel vises i lobbyen). |
| Pause | Verten kan pause; under et spørsmål tar pausen effekt rett etter avsløringen. |
| Nye spillere etter start | Ikke tillatt (men storskjermer kan kobles til når som helst). |
