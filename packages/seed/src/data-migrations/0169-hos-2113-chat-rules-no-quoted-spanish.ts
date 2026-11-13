/**
 * @fileoverview
 * Data migration: 0169-hos-2113-chat-rules-no-quoted-spanish
 *
 * HOS-2113 (residual sweep of gpt-5.4-nano) edits to the shared answer-quality
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
 * Only the `rules` column. The sweep showed that gpt-5.4-nano can copy quoted
 * prohibited Spanish examples from its own instructions, so negative examples
 * are now described by category rather than reproduced verbatim:
 *
 * - pet acceptance, off-topic openers, English/Portuguese language hygiene,
 *   over-capacity alternatives, and the forbidden Spanish register are
 *   described without quoting the prohibited terms;
 * - the age-answer first-word and permission wording descriptions are
 *   language-neutral;
 * - all positive answer examples and the existing rule logic remain unchanged.
 *
 * `content` did not change.
 *
 * ## How the update is scoped
 *
 * One UPDATE per feature, each rewriting `rules` only when it still holds the
 * EXACT string the previous migration wrote: `0165-hos-2102-chat-residual-rules` for
 * all three chat features. A row an
 * operator reworded — or one those never reached — is left alone; a second
 * run matches nothing and reports zero.
 *
 * ## Both sides are frozen — nothing is imported from `@repo/ai-core`
 *
 * The colocated `.data.json` was produced by EXECUTING code, never transcribed
 * by hand: `before` is byte-copied from 0165's frozen `after`, and `after` is
 * `DEFAULT_RULES` evaluated from this branch's source.
 * Importing it live is the trap `0100` documents: the package resolves to its
 * build output, so a stale build would hand this migration the old strings.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, and, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0169-hos-2113-chat-rules-no-quoted-spanish',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated snapshot of the three chat features' rules on both sides of HOS-2113. */
const DATA_PATH = path.resolve(__dirname, '0169-hos-2113-chat-rules-no-quoted-spanish.data.json');

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
 * HOS-2113 one, only on rows that still hold that exact string.
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
                ? 'The chat rules already carry the HOS-2113 clauses, or were operator-edited — no change.'
                : `Applied the HOS-2113 residual-chat rules fixes to ${total} chat rules column(s).`,
        counts
    };
}
