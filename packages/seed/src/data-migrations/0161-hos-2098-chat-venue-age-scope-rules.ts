/**
 * @fileoverview
 * Data migration: 0161-hos-2098-chat-venue-age-scope-rules
 *
 * Carries the HOS-2098 minimum-age scope clauses of the `chat_venue` rules into
 * `ai_prompt_versions` rows that already exist in a seeded environment.
 *
 * ## Why a migration is required at all
 *
 * `aiPrompts.seed.ts` inserts with `ON CONFLICT ... DO NOTHING`, so editing
 * `DEFAULT_RULES` in `@repo/ai-core` reaches FRESH databases only; staging and
 * production keep the row they already hold (HOS-25 dual-write rule, same
 * shape as `0160-hos-2095-chat-answer-quality-rules-2`).
 *
 * ## What changed
 *
 * Only the `chat_venue` `rules`. A venue now stores WHERE or WHEN its minimum
 * age applies (`policies.minAgeScope`: all day, from a time, or one sector or
 * activity), and the chat context prints it as an "Alcance de la edad mínima"
 * line. The age clauses stop narrowing the minimum age from the owner's free
 * text: only that structured line may, and only a question clearly outside a
 * time or sector scope may get a "yes". An all-day scope, no scope, or an
 * unclear question keeps the conservative answer (minimum age + verbatim
 * legal notice + refer to the venue). `content` did not change, and neither
 * did `chat` or `chat_experience`.
 *
 * ## How the update is scoped
 *
 * One UPDATE, rewriting `rules` only when it still holds the EXACT string
 * `0160` wrote. A row an operator reworded is left alone; a second run matches
 * nothing and reports zero.
 *
 * ## Both sides are frozen — nothing is imported from `@repo/ai-core`
 *
 * The colocated `.data.json` was produced by EXECUTING code, never transcribed
 * by hand: `before` is 0160's frozen `after` for `chat_venue`, byte for byte,
 * and `after` is `DEFAULT_RULES.chat_venue` evaluated from the
 * `default-prompts.ts` source (the trap `0100` documents: the package resolves
 * to its build output, so a stale build would hand this migration old strings).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, and, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0161-hos-2098-chat-venue-age-scope-rules',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated snapshot of the `chat_venue` rules on both sides of HOS-2098. */
const DATA_PATH = path.resolve(__dirname, '0161-hos-2098-chat-venue-age-scope-rules.data.json');

/** The chat features this migration touches. */
export const CHAT_FEATURES = ['chat_venue'] as const;

/** One of {@link CHAT_FEATURES}. */
type ChatFeature = (typeof CHAT_FEATURES)[number];

/** One side of the frozen snapshot. */
interface RulesSnapshot {
    readonly rules: Readonly<Record<ChatFeature, string>>;
}

/** Shape of the colocated frozen payload. */
interface FrozenBaseline {
    readonly before: RulesSnapshot;
    readonly after: RulesSnapshot;
}

/**
 * Rewrites the `chat_venue` `rules` from the exact string 0160 wrote to the
 * HOS-2098 one, only on rows that still hold that exact string.
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
                ? 'The chat_venue rules already carry the HOS-2098 age-scope clauses, or were operator-edited — no change.'
                : `Applied the HOS-2098 age-scope rules to ${total} chat_venue rules column(s).`,
        counts
    };
}
