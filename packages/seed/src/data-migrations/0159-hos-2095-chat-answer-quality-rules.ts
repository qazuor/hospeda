/**
 * @fileoverview
 * Data migration: 0159-hos-2095-chat-answer-quality-rules
 *
 * Carries the HOS-2095 answer-quality rules of the three listing-chat features
 * (`chat`, `chat_venue`, `chat_experience`) into `ai_prompt_versions` rows that
 * already exist in a seeded environment.
 *
 * ## Why a migration is required at all
 *
 * `aiPrompts.seed.ts` inserts with `ON CONFLICT ... DO NOTHING`, so editing
 * `DEFAULT_RULES` in `@repo/ai-core` reaches FRESH databases only; staging and
 * production keep the row they already hold. This is the HOS-25 dual-write
 * rule, in the same shape as `0134-hos1864-chat-venue-neutral-prompt`.
 *
 * ## What changed
 *
 * Only the `rules` column. HOS-2095 adds to all three features: never offer to
 * book, check availability or put the visitor in touch; never give contact
 * details absent from the context; never relay raw internal codes; never imply
 * anything is free or discounted; decline off-topic/injection messages in one
 * sentence without dumping the listing. `chat_venue` also gains the carta-price
 * clause, and its age clause now REQUIRES an explicit "no" first for an
 * under-age entry question (the old sentence allowed nothing but the age and
 * the legal notice, which is why answers pasted the law without saying "no").
 * The descriptive `content` of the three features did not change.
 *
 * ## How the update is scoped
 *
 * One UPDATE per feature, each rewriting `rules` only when it still holds the
 * exact pre-HOS-2095 string. A row an operator reworded is left alone, which
 * makes the migration idempotent by construction: a second run matches nothing
 * and reports zero.
 *
 * ## Both sides are frozen — nothing is imported from `@repo/ai-core`
 *
 * The colocated `.data.json` was produced by EXECUTING `default-prompts.ts`
 * (before from `origin/staging` at the HOS-2095 branch point, after from the
 * working tree), never transcribed by hand. Importing `DEFAULT_RULES` live is
 * the trap `0100` documents: the package resolves to `dist/`, so a stale build
 * would hand this migration the old strings and it would report a green no-op.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, and, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0159-hos-2095-chat-answer-quality-rules',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated snapshot of the three chat features' rules on both sides of HOS-2095. */
const DATA_PATH = path.resolve(__dirname, '0159-hos-2095-chat-answer-quality-rules.data.json');

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
 * Rewrites each chat feature's `rules` from the frozen pre-HOS-2095 string to
 * the new one, only on rows that still hold the exact old string.
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
                ? 'The chat rules already carry the HOS-2095 answer-quality clauses, or were operator-edited — no change.'
                : `Applied the HOS-2095 answer-quality rules to ${total} chat rules column(s).`,
        counts
    };
}
