import { z } from 'zod';
import { BOARD_THEME_IDS, DEFAULT_BOARD_THEME } from './types';
const horse = z.number().int().min(0).max(6);
export const boardThemeSchema = z.enum(BOARD_THEME_IDS);
export const settingsSchema = z
  .object({
    deck: z.enum(['base', 'historical']),
    hidden: z.boolean(),
    crowded: z.boolean(),
    alternative: z.boolean(),
  })
  .strict();
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('boardTheme'), boardTheme: boardThemeSchema }).strict(),
  z.object({ type: z.literal('pause'), paused: z.boolean() }).strict(),
  z.object({ type: z.literal('settings'), settings: settingsSchema }).strict(),
  z.object({ type: z.literal('addBot') }).strict(),
  z.object({ type: z.literal('removeBot'), seatId: z.string().max(100) }).strict(),
  z.object({ type: z.literal('start') }).strict(),
  z.object({ type: z.literal('startDemo') }).strict(),
  z.object({ type: z.literal('startSeries') }).strict(),
  z.object({ type: z.literal('bet'), horseId: horse, chipId: z.string().max(100) }).strict(),
  z.object({ type: z.literal('roll') }).strict(),
  z.object({ type: z.literal('move'), horseId: horse }).strict(),
  z.object({ type: z.literal('nextRace') }).strict(),
  z.object({ type: z.literal('rematch') }).strict(),
  z.object({ type: z.literal('replace'), seatId: z.string().max(100) }).strict(),
]);
export const envelopeSchema = z
  .object({
    commandId: z.string().uuid(),
    expectedRevision: z.number().int().nonnegative(),
    command: commandSchema,
  })
  .strict();
export const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .refine((s) => !/[\u0000-\u001f\u007f]/.test(s));
export const createSchema = z.object({
  name: nameSchema,
  bots: z.number().int().min(0).max(5),
  settings: settingsSchema,
  boardTheme: boardThemeSchema.default(DEFAULT_BOARD_THEME),
});
export const joinSchema = z.object({ name: nameSchema });
