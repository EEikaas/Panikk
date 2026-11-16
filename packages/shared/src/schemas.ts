import { z } from 'zod';
import { CHARACTER_IDS } from './characters';
import { MAX_PLAYERS, MIN_PLAYERS } from './constants';

export const categoryIdSchema = z.enum([
  'generelt',
  'geografi',
  'historie',
  'vitenskap',
  'filmtv',
  'musikk',
  'sport',
  'dyr',
  'mat',
  'teknologi',
  'norge',
  'voksen18',
  'blandet',
]);
export const difficultySchema = z.enum(['barn', 'familie', 'voksen']);
export const lengthSchema = z.enum(['kort', 'normal', 'lang']);
export const displayModeSchema = z.enum(['screen', 'mobile', 'mixed']);
export const viewModeSchema = z.enum(['controller', 'full']);

export const settingsSchema = z.object({
  displayMode: displayModeSchema,
  difficulty: difficultySchema,
  length: lengthSchema,
  maxPlayers: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS),
  categories: z.array(categoryIdSchema).max(12).default([]),
  useExternal: z.boolean().default(false),
  solo: z.boolean().optional(),
  botLevel: z.enum(['lett', 'middels', 'vanskelig']).optional(),
  timeScale: z.number().min(0.005).max(1).optional(),
}).refine((s) => !s.categories.includes('voksen18') || s.difficulty === 'voksen', {
  message: '18+-kategorien kan bare brukes på voksennivå',
  path: ['categories'],
});

// Fjern kontrolltegn og trim. React escaper all tekst ved visning (XSS-vern).
const cleanText = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(1).max(max));

export const playerNameSchema = cleanText(16);
export const characterIdSchema = z.string().refine((id) => CHARACTER_IDS.includes(id), 'Ukjent karakter');
export const roomCodeSchema = z
  .string()
  .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .pipe(z.string().length(5));
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,80}$/);
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{4,64}$/);
const actionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/);

export const createRoomSchema = z.object({
  settings: settingsSchema,
  as: z.enum(['screen', 'player']),
  name: playerNameSchema.optional(),
  characterId: characterIdSchema.optional(),
  /** Solomodus: antall datastyrte motstandere. */
  opponents: z.number().int().min(1).max(11).optional(),
});

export const joinRoomSchema = z.object({
  code: roomCodeSchema,
  as: z.enum(['screen', 'player']),
  name: playerNameSchema.optional(),
  characterId: characterIdSchema.optional(),
  token: tokenSchema.optional(),
  view: viewModeSchema.optional(),
});

export const playerUpdateSchema = z.object({
  name: playerNameSchema.optional(),
  characterId: characterIdSchema.optional(),
  ready: z.boolean().optional(),
  view: viewModeSchema.optional(),
});

export const answerSchema = z.object({
  actionId: actionIdSchema,
  questionId: z.string().min(1).max(80),
  choice: z.number().int().min(0).max(3),
});
export const buzzSchema = z.object({ actionId: actionIdSchema, questionId: z.string().min(1).max(80) });
export const targetSchema = z.object({ actionId: actionIdSchema, targetId: idSchema });
export const kickSchema = z.object({ playerId: idSchema });
export const pauseSchema = z.object({ paused: z.boolean() });

export const questionInputSchema = z.object({
  text: cleanText(300),
  options: z.tuple([cleanText(120), cleanText(120), cleanText(120), cleanText(120)]).refine(
    (o) => new Set(o.map((x) => x.toLowerCase())).size === 4,
    'Alle fire svaralternativer må være forskjellige',
  ),
  correctIndex: z.number().int().min(0).max(3),
  category: categoryIdSchema,
  difficulty: difficultySchema,
  language: z.enum(['nb', 'en']).default('nb'),
  source: z.string().max(200).optional(),
  active: z.boolean().default(true),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type PlayerUpdateInput = z.infer<typeof playerUpdateSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;

export interface Ack<T = Record<string, unknown>> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface JoinAckData {
  code: string;
  memberId: string;
  token: string;
  playerId: string | null;
}
