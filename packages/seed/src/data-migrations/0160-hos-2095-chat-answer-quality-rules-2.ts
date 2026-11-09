/**
 * @fileoverview
 * Data migration: 0160-hos-2095-chat-answer-quality-rules-2
 *
 * Second round of the HOS-2095 answer-quality rules of the three listing-chat
 * features (`chat`, `chat_venue`, `chat_experience`), carried into
 * `ai_prompt_versions` rows that already exist in a seeded environment.
 *
 * ## Why a migration is required at all
 *
 * `aiPrompts.seed.ts` inserts with `ON CONFLICT ... DO NOTHING`, so editing
 * `DEFAULT_RULES` in `@repo/ai-core` reaches FRESH databases only; staging and
 * production keep the row they already hold (HOS-25 dual-write rule, same
 * shape as `0159-hos-2095-chat-answer-quality-rules`).
 *
 * ## What changed
 *
 * Only the `rules` column. A blind-graded sweep of 560 answers found, on the
 * cheapest model, availability closers ("decime las fechas y te digo si hay
 * lugar"), inventory dumps on group questions, facts stretched to a quantity
 * or a room the listing does not state, links to page sections that do not
 * exist, leaky off-topic declines, and English questions declined as
 * off-topic. All three features gain one clause per finding; `chat_venue`'s
 * mixed-venue age rule becomes a decision procedure (decide first whether the
 * asked activity is the restricted one) and stops attributing the age to
 * alcohol sales unless the ficha says so. `content` did not change.
 *
 * ## How the update is scoped
 *
 * One UPDATE per feature, each rewriting `rules` only when it still holds the
 * EXACT string `0159` wrote. A row an operator reworded — or one 0159 never
 * reached — is left alone; a second run matches nothing and reports zero.
 *
 * ## Both sides are frozen — nothing is imported from `@repo/ai-core`
 *
 * The colocated `.data.json` was produced by EXECUTING code, never transcribed
 * by hand: `before` is 0159's frozen `after`, byte for byte, and `after` is
 * `DEFAULT_RULES` evaluated from the `default-prompts.ts` source. Importing it
 * live is the trap `0100` documents: the package resolves to its build output,
 * so a stale build would hand this migration the old strings.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, and, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0160-hos-2095-chat-answer-quality-rules-2',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated snapshot of the three chat features' rules on both sides of round 2. */
const DATA_PATH = path.resolve(__dirname, '0160-hos-2095-chat-answer-quality-rules-2.data.json');

/** The chat features this migration touches, in update order. */
export const CHAT_FEATURES = ['chat', 'chat_venue', 'chat_experience'] as const;

/** One of {@link CHAT_FEATURES}. */
type ChatFeature = (typeof CHAT_FEATURES)[number];

/** One side of the frozen snapshot: each chat feature's `rules`. */
interface RulesSnapshot {
    readonly rules: Readonly<Record<ChatFeature, string>>;
}

/** Shape of the colocated frozen payload. */
interface FrozenBaseline {
    readonly before: RulesSnapshot;
    readonly after: RulesSnapshot;
}

/**
 * Rewrites each chat feature's `rules` from the exact string 0159 wrote to the
 * round 2 one, only on rows that still hold that exact string.
 *
 * @param ctx - Seed migration context (only `ctx.db` is used).
 * @returns Summary and per-feature counts of updated rows.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const { before, after } = JSON.parse(raw) as FrozenBaseline;

    const counts: Record<string, number> = {};
    let total = 0;

    for (const feature of CHAT_FEATURES) {
        const oldRules = before.rules[feature];
        const newRules = after.rules[feature];
        counts[feature] = 0;
        if (oldRules === newRules) continue;

        const rows = await ctx.db
            .update(aiPromptVersions)
            .set({ rules: newRules })
            .where(and(eq(aiPromptVersions.feature, feature), eq(aiPromptVersions.rules, oldRules)))
            .returning({ id: aiPromptVersions.id });
        counts[feature] = rows.length;
        total += rows.length;
    }

    return {
        summary:
            total === 0
                ? 'The chat rules already carry the HOS-2095 round 2 clauses, or were operator-edited — no change.'
                : `Applied the HOS-2095 round 2 answer-quality rules to ${total} chat rules column(s).`,
        counts
    };
}
