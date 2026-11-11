/**
 * @fileoverview
 * Data migration: 0165-hos-2102-chat-residual-rules
 *
 * HOS-2102 (residual sweep of gpt-5.4-nano) edits to the shared answer-quality
 * rules of the three listing-chat features (`chat`, `chat_venue`,
 * `chat_experience`), carried into `ai_prompt_versions` rows that already
 * exist in a seeded environment.
 *
 * ## Why a migration is required at all
 *
 * `aiPrompts.seed.ts` inserts with `ON CONFLICT ... DO NOTHING`, so editing
 * `DEFAULT_RULES` in `@repo/ai-core` reaches FRESH databases only; staging and
 * production keep the row they already hold (HOS-25 dual-write rule, same
 * shape as `0164-hos-2098-chat-venue-age-resolved-windows`).
 *
 * ## What changed
 *
 * Only the `rules` column, and only the block the three features share (the
 * answer-quality rules plus the voseo fragment). The residual sweep caught
 * nano quoting the rules' own Spanish example phrases back in English and
 * Portuguese answers, so:
 *
 * - the Spanish example phrases leave the rules: the availability closer
 *   example became English-only ("tell me your dates and I will tell you if
 *   there is room"), "¡De una!" is gone from the agreeing-opener examples, and
 *   every quoted fragment is language-neutral; the per-language group-answer
 *   close templates ("depende de cómo se repartan...", their English and
 *   Portuguese twins) moved into the reply-language instructions
 *   (`reply-language.ts`), with the rules demanding only that the close be
 *   written IN THE REPLY LANGUAGE in the model's own words;
 * - the over-capacity group answer is absolute: the ENTIRE answer is one
 *   short sentence — does not fit plus the total capacity — with no
 *   alternatives, no arithmetic, no "depends" and no questions back;
 * - when the listing does not inform pets, the answer may not write that pets
 *   are accepted, allowed, welcome or rejected: it may only say the listing
 *   does not inform it and to confirm with the place;
 * - `VOSEO_RULE` gained a scope sentence: its voseo examples apply ONLY to
 *   Spanish answers and are never copied into English or Portuguese ones.
 *
 * The `chat_venue` age clauses are untouched, and `content` did not change.
 *
 * ## How the update is scoped
 *
 * One UPDATE per feature, each rewriting `rules` only when it still holds the
 * EXACT string the previous migration wrote: `0164-hos-2098-...` for
 * `chat_venue`, `0162-hos-2100-...` for `chat` and `chat_experience`. A row an
 * operator reworded — or one those never reached — is left alone; a second
 * run matches nothing and reports zero.
 *
 * ## Both sides are frozen — nothing is imported from `@repo/ai-core`
 *
 * The colocated `.data.json` was produced by EXECUTING code, never transcribed
 * by hand: `before` is byte-copied from the last writer of each row (0162's
 * frozen `after` for `chat` and `chat_experience`, 0164's for `chat_venue`),
 * and `after` is `DEFAULT_RULES` evaluated from this branch's source.
 * Importing it live is the trap `0100` documents: the package resolves to its
 * build output, so a stale build would hand this migration the old strings.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, and, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0165-hos-2102-chat-residual-rules',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated snapshot of the three chat features' rules on both sides of HOS-2102. */
const DATA_PATH = path.resolve(__dirname, '0165-hos-2102-chat-residual-rules.data.json');

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
 * Rewrites each chat feature's `rules` from the exact string the previous migration wrote to the
 * HOS-2102 one, only on rows that still hold that exact string.
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
                ? 'The chat rules already carry the HOS-2102 clauses, or were operator-edited — no change.'
                : `Applied the HOS-2102 residual-chat rules fixes to ${total} chat rules column(s).`,
        counts
    };
}
