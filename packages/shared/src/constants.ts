import type { CategoryId, Difficulty, DisplayMode, GameLength, RoundType } from './types';

export const GAME_NAME = 'PODIEPANIKK!';
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

export const ANSWER_COLORS = [
  { id: 'red', name: 'Rød', hex: '#ff3b4f', dark: '#b3122a' },
  { id: 'blue', name: 'Blå', hex: '#2f8cff', dark: '#1554b3' },
  { id: 'green', name: 'Grønn', hex: '#22c55e', dark: '#127a39' },
  { id: 'yellow', name: 'Gul', hex: '#ffcc00', dark: '#b38f00' },
] as const;

export const CATEGORIES: { id: CategoryId; name: string; emoji: string }[] = [
  { id: 'generelt', name: 'Generell kunnskap', emoji: '💡' },
  { id: 'geografi', name: 'Geografi', emoji: '🌍' },
  { id: 'historie', name: 'Historie', emoji: '🏛️' },
  { id: 'vitenskap', name: 'Natur og vitenskap', emoji: '🔬' },
  { id: 'filmtv', name: 'Film og TV', emoji: '🎬' },
  { id: 'musikk', name: 'Musikk', emoji: '🎵' },
  { id: 'sport', name: 'Sport', emoji: '⚽' },
  { id: 'dyr', name: 'Dyr og natur', emoji: '🐾' },
  { id: 'mat', name: 'Mat og drikke', emoji: '🍕' },
  { id: 'teknologi', name: 'Teknologi', emoji: '💻' },
  { id: 'norge', name: 'Norge', emoji: '🇳🇴' },
  { id: 'voksen18', name: 'Voksen 18+', emoji: '🔞' },
  { id: 'blandet', name: 'Blandet', emoji: '🎲' },
];

/**
 * 18+-kategorien (fest, uteliv og grov humor) brukes KUN når verten har valgt den eksplisitt,
 * og bare på voksennivå. Den kommer aldri inn i barne- eller familiespill.
 */
export const ADULT_CATEGORY = 'voksen18' as const;
export const isAdultGame = (s: { difficulty: string; categories: string[] }) => s.difficulty === 'voksen' && s.categories.includes(ADULT_CATEGORY);

export const DIFFICULTIES: { id: Difficulty; name: string; description: string }[] = [
  { id: 'barn', name: 'Barn', description: 'Morsomme og forståelige spørsmål for de yngste.' },
  { id: 'familie', name: 'Familie', description: 'Lette og middels spørsmål – alle kan være med.' },
  { id: 'voksen', name: 'Voksen', description: 'Mer krevende spørsmål for skjerpede hjerner.' },
];

export const LENGTHS: { id: GameLength; name: string; description: string }[] = [
  { id: 'kort', name: 'Kort', description: 'Ca. 10–15 min · 3 runder' },
  { id: 'normal', name: 'Normalt', description: 'Ca. 20–30 min · 4–5 runder' },
  { id: 'lang', name: 'Langt', description: 'Ca. 35–50 min · alle 6 runder' },
];

export const DISPLAY_MODES: { id: DisplayMode; name: string; description: string }[] = [
  { id: 'screen', name: 'Storskjerm + mobilkontrollere', description: 'Denne skjermen blir TV-studioet. Spillerne bruker mobilen som kontroller.' },
  { id: 'mobile', name: 'Hele spillet på mobil', description: 'Alle spiller på egen mobil – ingen TV nødvendig.' },
  { id: 'mixed', name: 'Kombinert', description: 'Noen spiller foran TV-en, andre på mobil hjemmefra. Alle i samme rom.' },
];

export const BOT_LEVELS: { id: 'lett' | 'middels' | 'vanskelig'; name: string; description: string }[] = [
  { id: 'lett', name: 'Lett', description: 'Motstanderne gjetter ofte og er trege på knappen.' },
  { id: 'middels', name: 'Middels', description: 'En jevn kamp – de kan en del, men ikke alt.' },
  { id: 'vanskelig', name: 'Vanskelig', description: 'Kjappe quizkonger. Du må være skjerpet!' },
];

export const ROUND_INFO: Record<RoundType, { name: string; description: string; short: string }> = {
  fastest: {
    name: 'Raskest på knappen',
    short: 'Trykk på buzzeren først!',
    description: 'Trykk på den røde knappen før alle andre. Den raskeste får svare. Riktig gir +600, feil gir −300 og de andre får en ny sjanse.',
  },
  collector: {
    name: 'Poengsamleren',
    short: 'Svar riktig – og fort!',
    description: 'Alle svarer samtidig. Riktig svar gir 500 poeng, og jo raskere du er, desto større bonus (opptil +500).',
  },
  thief: {
    name: 'Poengtyven',
    short: 'Svar riktig og stjel poeng!',
    description: 'Svar riktig for +200 og retten til å stjele opptil 300 poeng fra en motstander du velger selv.',
  },
  bomb: {
    name: 'Tikkende bombe',
    short: 'Ikke sitt med bomben!',
    description: 'Den som har bomben må svare riktig for å sende den videre. Når lunta brenner ut, smeller det – og det koster 500 poeng!',
  },
  pie: {
    name: 'Kakekrigen',
    short: 'Svar riktig – kast kake!',
    description: 'Riktig svar gir +200 og en bløtkake å kaste. Den som blir truffet mister 250 poeng, kasteren får +100.',
  },
  final: {
    name: 'Den store finalen',
    short: 'Først til mål vinner!',
    description: 'Alle løper mot målstreken. Riktig svar = ett steg frem, raskeste riktige = to steg. Feil = ett steg tilbake. Ledende spillere får forsprang!',
  },
};

/** Naturlig progresjon: rundene spilles alltid i denne rekkefølgen. Finalen er alltid sist. */
export const ROUND_ORDER: RoundType[] = ['collector', 'fastest', 'thief', 'pie', 'bomb', 'final'];

export interface LengthConfig {
  minRounds: number; // inkludert finale
  maxRounds: number;
  questionsPerRound: number;
  bombsPerRound: number;
  finalGoal: number;
  finalMaxQuestions: number;
}

export const LENGTH_CONFIG: Record<GameLength, LengthConfig> = {
  kort: { minRounds: 3, maxRounds: 3, questionsPerRound: 6, bombsPerRound: 2, finalGoal: 7, finalMaxQuestions: 14 },
  normal: { minRounds: 4, maxRounds: 5, questionsPerRound: 8, bombsPerRound: 3, finalGoal: 9, finalMaxQuestions: 18 },
  lang: { minRounds: 6, maxRounds: 6, questionsPerRound: 10, bombsPerRound: 3, finalGoal: 10, finalMaxQuestions: 22 },
};

export const SCORING = {
  collectorBase: 500,
  collectorSpeedMax: 500,
  fastestCorrect: 600,
  fastestWrong: 300,
  thiefCorrect: 200,
  stealAmount: 300,
  pieCorrect: 200,
  pieHit: 250,
  pieThrowerBonus: 100,
  bombCorrect: 100,
  bombExplode: 500,
  finalCorrectPoints: 300,
  finalHeadStartMax: 3,
} as const;

/** Varigheter i millisekunder (før timeScale). */
export const TIMING = {
  intro: 7000,
  roundIntro: 8000,
  question: 15000,
  questionKids: 20000,
  buzzWindow: 12000,
  buzzReopen: 7000,
  buzzAnswer: 7000,
  bombQuestion: 10000,
  bombFuseMin: 30000,
  bombFuseMax: 50000,
  finalQuestionStart: 10000,
  finalQuestionMin: 6000,
  reveal: 5000,
  revealShort: 2500,
  targeting: 10000,
  bombTargeting: 6000,
  actionResult: 4500,
  scoreboard: 7000,
  ceremony: 16000,
  /** Nettverkstoleranse: svar som ankommer litt etter fristen godtas fortsatt. */
  answerGrace: 300,
  hostTransferAfter: 45000,
} as const;
