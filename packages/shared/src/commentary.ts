import type { CommentaryMood } from './types';

// Den usynlige programlederen. {name} = hovedperson, {target} = offer, {n} = tall.
// All humor skal være familievennlig.

export type Situation =
  | 'intro'
  | 'roundIntro'
  | 'buzz'
  | 'fastCorrect'
  | 'correct'
  | 'wrong'
  | 'allCorrect'
  | 'allWrong'
  | 'noAnswer'
  | 'streak'
  | 'steal'
  | 'noSteal'
  | 'pie'
  | 'bombStart'
  | 'bombPass'
  | 'bombKeep'
  | 'explode'
  | 'bigLead'
  | 'tight'
  | 'final'
  | 'finalClose'
  | 'tiebreak'
  | 'winner'
  | 'paused';

export const COMMENTARY: Record<Situation, { mood: CommentaryMood; lines: string[] }> = {
  intro: {
    mood: 'happy',
    lines: [
      'God kveld, studio! Gjør dere klare for PODIEPANIKK!',
      'Lysene er på, publikum er varmt, og deltakerne svetter allerede!',
      'Velkommen til kveldens show – her er ingen trygge. Ikke engang programlederen.',
      'Applaus for kveldens modige deltakere! De aner ikke hva som venter.',
    ],
  },
  roundIntro: {
    mood: 'drama',
    lines: [
      'Ny runde, nye muligheter – og nye måter å dumme seg ut på!',
      'Pust med magen. Nå blir det alvor!',
      'Publikum, hold dere fast i stolene!',
      'Reglene er enkle. Det er det ikke sikkert at spørsmålene er.',
      'Denne runden har knust drømmer før. Lykke til!',
    ],
  },
  buzz: {
    mood: 'drama',
    lines: [
      'Det var raskt! Men var det riktig?',
      '{name} slår til som et lyn!',
      'Fingeren til {name} var raskere enn hjernen. Kanskje.',
      '{name} trykket så hardt at knappen ba om fri.',
      'Pang! {name} er først ute!',
    ],
  },
  fastCorrect: {
    mood: 'happy',
    lines: [
      'Her er det noen som har øvd!',
      '{name} svarte før spørsmålet var ferdig lest. Imponerende!',
      'Lynrask og riktig – {name} er i slag!',
      'Det der gikk fortere enn en kanelbolle forsvinner på et lærerværelse!',
    ],
  },
  correct: {
    mood: 'happy',
    lines: [
      'Riktig! Publikum jubler!',
      'Helt korrekt – poengene ruller inn!',
      'Ja! Det satt som et skudd!',
      'Der kom kunnskapen frem fra gjemmestedet!',
      'Strålende! Poengtavla sier takk.',
    ],
  },
  wrong: {
    mood: 'sad',
    lines: [
      'Oi, det svir på poengtavlen!',
      'Det svaret kom fra hjertet. Ikke nødvendigvis fra hjernen.',
      'Modig! Feil, men modig.',
      'Den der kommer til å bli husket!',
      'Au da. Vi later som vi ikke så det.',
      '{name} tok sjansen – og sjansen tok {name}.',
    ],
  },
  allCorrect: {
    mood: 'happy',
    lines: [
      'Alle hadde rett! Er dette et geniklubbmøte?',
      'Full pott for hele gjengen – publikum er sjokkert!',
      'Enstemmig og korrekt. Hvem lekket fasiten?',
    ],
  },
  allWrong: {
    mood: 'funny',
    lines: [
      'Ingen hadde rett! Det var visst et vanskelig et.',
      'Total stillhet i studio. Man kunne hørt en mynt falle.',
      'Alle bommet! Vi sier det var spørsmålets feil.',
      'Null treff! Publikum ler – men de visste det ikke selv heller.',
    ],
  },
  noAnswer: {
    mood: 'funny',
    lines: [
      'Hallo? Er det noen der?',
      'Tiden er ute! Tenkepausen ble litt for lang.',
      'Stille som en bibliotekmus på ferie.',
    ],
  },
  streak: {
    mood: 'happy',
    lines: [
      '{name} har {n} riktige på rad! Noen stopp {name}!',
      '{n} på rad for {name}! Er det en quizmaskin vi har her?',
      '{name} er varm som en vaffeljern – {n} riktige på rad!',
    ],
  },
  steal: {
    mood: 'drama',
    lines: [
      'Det begynner å bli personlig!',
      '{name} stjeler fra {target}! Frekt – men helt lovlig.',
      '{target} sjekker lommene. Poengene er borte!',
      'Tyv, tyv, tyvetater! {name} forsyner seg hos {target}.',
    ],
  },
  noSteal: {
    mood: 'neutral',
    lines: ['Ingen tyver denne gangen – alle poeng er i god behold.', 'Tyvene tok seg en pause.'],
  },
  pie: {
    mood: 'funny',
    lines: [
      'SPLAT! {target} fikk kremen rett i fjeset!',
      '{name} sikter … og treffer {target}! Publikum hyler!',
      'Det var en bløtkake med ekstra krem, {target}!',
      '{target} smaker på nederlaget. Det smaker vanilje.',
    ],
  },
  bombStart: {
    mood: 'drama',
    lines: ['Bomben tikker hos {name}! Svar fort!', '{name} har fått bomben i fanget. Det lukter svidd!'],
  },
  bombPass: {
    mood: 'drama',
    lines: [
      '{name} sender bomben videre til {target}!',
      'Varm potet! {target} har den nå!',
      '{target} mottar en tikkende overraskelse fra {name}!',
    ],
  },
  bombKeep: {
    mood: 'funny',
    lines: ['Feil! Bomben blir hos {name}.', '{name} må holde på bomben litt til … det tikker!', 'Lunta brenner, {name}!'],
  },
  explode: {
    mood: 'funny',
    lines: [
      'KABOOM! {name} fikk en ny frisyre!',
      'Bomben smalt hos {name}! Hvem tok med brannslukningsapparatet?',
      'Det smalt! {name} ser ut som en skorsteinsfeier.',
    ],
  },
  bigLead: {
    mood: 'neutral',
    lines: [
      '{name} leder suverent. Kan noen ta igjen?',
      '{name} har en enorm ledelse – men nå kan alt skje!',
    ],
  },
  tight: {
    mood: 'drama',
    lines: ['Det er knivjevnt i toppen!', 'Bare noen få poeng skiller dem. Spenningen er til å ta og føle på!', 'Nå kan alt skje!'],
  },
  final: {
    mood: 'drama',
    lines: [
      'Dette er det store øyeblikket. FINALEN!',
      'Lysene dempes. Musikken stiger. Det er finaletid!',
      'Alt dere har gjort til nå, har ledet hit. Kjør!',
    ],
  },
  finalClose: {
    mood: 'drama',
    lines: ['{name} er nesten i mål!', 'Ett steg unna! {name} kjenner seiersduften!', 'Hold pusten – {name} nærmer seg målstreken!'],
  },
  tiebreak: {
    mood: 'drama',
    lines: ['Det står likt! Vi trenger et avgjørende spørsmål!', 'Uavgjort! Nå blir det sudden death – første riktige vinner!'],
  },
  winner: {
    mood: 'happy',
    lines: [
      'Vi har en vinner! Gratulerer, {name}!',
      '{name} er kveldens PODIEPANIKK-mester!',
      'Konfetti! Fanfare! {name} tar hjem seieren!',
    ],
  },
  paused: { mood: 'neutral', lines: ['Kort pause! Hent brus og pust litt.', 'Reklamepause! (Uten reklame.)'] },
};

/**
 * Ekstra kommentarer KUN for spill der 18+-kategorien er slått på.
 * Grov og frekk humor om fyll, bakrus, kropp og spillerne selv – men aldri om
 * etnisitet, religion, kjønn, legning eller funksjonsevne.
 */
export const COMMENTARY_ADULT: Partial<Record<Situation, string[]>> = {
  intro: [
    'God kveld! Glassene er fulle, hjernene … tja. Velkommen til 18+-utgaven!',
    'Mamma er ikke invitert i kveld. La oss sette i gang!',
    'Kveldens deltakere har lovet å oppføre seg. Ingen tror på dem.',
  ],
  roundIntro: ['Ny runde! Rekker dere en tur på baren først? Nei.', 'Pust ut, ta en slurk, og prøv å se edru ut.'],
  buzz: ['{name} trykket raskere enn en dårlig unnskyldning på nachspiel.', '{name} trykket som om det var siste runde i baren!'],
  fastCorrect: ['{name} svarte fortere enn en bartender på happy hour!', 'Lynrask og riktig – {name} har tydeligvis ikke drukket ennå.'],
  correct: ['Riktig! Noen har visst lest etiketten på flaska.', 'Edru nok til å svare riktig. Imponerende!', 'Riktig! Det fortjener en skål.'],
  wrong: [
    'Feil! Har du allerede drukket opp vorspielet, {name}?',
    'Det svaret var like dårlig som en kebab klokka tre om natta.',
    '{name} svarer som en som nettopp kom fra nachspiel.',
    'Feil – men selvtilliten var det ingenting i veien med.',
  ],
  allWrong: ['Ingen hadde rett! Har hele studioet tømmermenn?', 'Null riktige. Noen har byttet ut kaffen med akevitt.'],
  streak: ['{name} har {n} riktige på rad – noen må fylle glasset til {name} før det blir kjedelig!'],
  steal: [
    '{name} stjeler fra {target} uten skam – akkurat som siste pils i kjøleskapet.',
    '{target} ble ranet. Igjen. Kanskje på tide å bytte venner?',
  ],
  pie: ['SPLAT! {target} ser ut som morgenen etter julebordet.', '{target} fikk det rett i trynet. Publikum ler, mamma hadde grått.'],
  explode: ['KABOOM! {name} eksploderte som magen dagen etter tacofredag.', 'Det smalt hos {name}. Hold for nesen!'],
  bigLead: ['{name} leder så mye at de andre burde vurdere å bestikke programlederen.'],
  winner: ['{name} vinner! Neste runde spanderes av taperen.', '{name} er kveldens mester. Resten kan gå hjem og skamme seg.'],
};

export function fillCommentary(text: string, vars: { name?: string; target?: string; n?: number }): string {
  return text
    .replace(/\{name\}/g, vars.name ?? 'noen')
    .replace(/\{target\}/g, vars.target ?? 'noen')
    .replace(/\{n\}/g, String(vars.n ?? ''));
}
