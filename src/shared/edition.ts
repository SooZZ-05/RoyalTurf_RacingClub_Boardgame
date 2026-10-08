import { z } from 'zod';
import raw from '../data/edition.json';
import type { Card, Edition, EditionStatus, FullEdition, PublishedEdition } from './types';

const text = z.string().trim().min(1);
const move = z.number().int().min(0).max(100);
const amount = z.number().int().nonnegative();
const editionShape = {
  id: text,
  version: text,
  verified: z.literal(true),
  verification: z.object({ reviewer: text, date: z.iso.date(), sources: z.array(text).min(1) }),
  cards: z
    .array(
      z.object({
        id: text,
        deck: z.enum(['base', 'historical']),
        horse: z.number().int().min(0).max(6).nullable(),
        names: z.object({ 'zh-Hant': text, en: text }),
        moves: z.object({ head: move, cap: move, carrot: move, shoe: move }),
        evidence: text,
      }),
    )
    .length(49),
  rules: z.object({
    trackLength: z.number().int().positive().max(100),
    finishDistance: z.number().int().positive().max(200),
    paceDistance: z.number().int().positive(),
    payout: z.tuple([
      z.array(amount).length(5),
      z.array(amount).length(5),
      z.array(amount).length(5),
    ]),
    paceBonus: amount,
    lastPenalty: amount,
    paceRequiresPodium: z.boolean(),
    lastTie: z.enum(['all', 'none']),
    penaltyAfterWinnings: z.boolean(),
    laterStarter: z.enum(['totalMoney', 'raceWinnings']),
    sharedVictory: z.literal(true),
    evidence: z.record(text, text),
  }),
};
const validateEdition = (
  edition: { cards: Card[]; rules: Edition['rules'] },
  ctx: z.RefinementCtx,
) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (new Set(edition.cards.map((c) => c.id)).size !== 49) fail('Card IDs must be unique');
  const base = edition.cards.filter((c) => c.deck === 'base');
  if (base.length !== 21 || edition.cards.filter((c) => c.deck === 'historical').length !== 28)
    fail('Expected 21 base and 28 historical cards');
  for (let color = 0; color < 7; color++)
    if (base.filter((c) => c.horse === color).length !== 3)
      fail(`Expected three base cards for horse ${color}`);
  for (const card of edition.cards)
    if (Object.values(card.moves).every((n) => n === 0))
      fail(`Card cannot have zero movement on every face: ${card.id}`);
  if (edition.rules.paceDistance >= edition.rules.finishDistance)
    fail('Pace position must precede finish');
  const required = [
    'trackLength',
    'finishDistance',
    'paceDistance',
    'payout',
    'paceRequiresPodium',
    'lastTie',
    'penaltyAfterWinnings',
    'laterStarter',
    'sharedVictory',
    'deckHandling',
    'occupancy',
  ];
  for (const key of required)
    if (!edition.rules.evidence[key]) fail(`Missing rule evidence: ${key}`);
};
export const editionSchema = z.object(editionShape).superRefine(validateEdition);
export const publishedEditionSchema = z
  .object({ ...editionShape, verified: z.literal(false), sourceBacked: z.literal(true) })
  .superRefine(validateEdition);

export function parseEdition(input: unknown): Edition {
  return editionSchema.parse(input);
}
export function parsePublishedEdition(input: unknown): PublishedEdition {
  return publishedEditionSchema.parse(input);
}
const certified = editionSchema.safeParse(raw);
const published = publishedEditionSchema.safeParse(raw);
export const EDITION: FullEdition | null = certified.success
  ? certified.data
  : published.success
    ? published.data
    : null;
const metadata = raw as { id: string; version: string; missing?: unknown };
export const EDITION_STATUS: EditionStatus = {
  ready: EDITION !== null,
  verified: EDITION?.verified ?? false,
  id: metadata.id,
  version: metadata.version,
  missing: EDITION?.verified
    ? []
    : Array.isArray(metadata.missing) && metadata.missing.every((m) => typeof m === 'string')
      ? metadata.missing
      : ['Edition data failed validation'],
  limitedProfiles: EDITION === null,
  supportedDecks: EDITION ? ['base', 'historical'] : ['base'],
};
