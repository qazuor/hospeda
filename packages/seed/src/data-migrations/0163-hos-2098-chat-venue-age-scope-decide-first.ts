/**
 * @fileoverview
 * Data migration: 0163-hos-2098-chat-venue-age-scope-decide-first
 *
 * Carries the HOS-2098 smoke fix of the `chat_venue` age-scope clauses into
 * `ai_prompt_versions` rows that already exist in a seeded environment.
 *
 * ## Why a migration is required at all
 *
 * `aiPrompts.seed.ts` inserts with `ON CONFLICT ... DO NOTHING`, so editing
 * `DEFAULT_RULES` in `@repo/ai-core` reaches FRESH databases only; staging and
 * production keep the row they already hold (HOS-25 dual-write rule, same
 * shape as `0161-hos-2098-chat-venue-age-scope-rules`).
 *
 * ## What changed
 *
 * Only the `chat_venue` `rules`. The staging smoke (10/11/2026, gpt-5.4-nano)
 * answered "no" to "¿puedo ir con mi hijo de 16 a las 22?" at a bar whose
 * minimum age applies from 00:00, and once said 21:30 fell inside the
 * restricted hours. Two causes, two edits:
 *
 * - the mandatory leading "no" came BEFORE the "first decide whether the asked
 *   time is covered" clause, so the model applied it to every minors question.
 *   The decision now comes first, the "no" applies only when the asked time,
 *   area or activity IS covered, and a time clearly outside a from-time or
 *   area scope gets an answer that starts with "sí" / "yes" / "sim";
 * - "from 00:00" was read as the start of the day. The rules now say it starts
 *   at midnight and give worked examples on both sides of a 00:00 and a 23:30
 *   scope.
 *
 * Every legal guardrail is unchanged: verbatim minimum age and legal notice,
 * no workaround, never "yes" for the covered part, the area text is only a
 * name. `content` did not change, and neither did `chat` or `chat_experience`.
 *
 * ## How the update is scoped
 *
 * One UPDATE, rewriting `rules` only when it still holds the EXACT string
 * `0162-hos-2100-chat-group-pet-rules` wrote for `chat_venue` (the last writer
 * of that row). A row an operator reworded is left alone; a second run matches
 * nothing and reports zero.
 *
 * After the UPDATE a SELECT lists the `chat_venue` rows that do not hold the
 * new string: each is logged as a warning with its prompt-version id and
 * counted under `chat_venue_operator_edited`. Those venues keep their edited
 * rules and do NOT get this fix until someone merges it by hand.
 *
 * ## Both sides are frozen — nothing is imported from `@repo/ai-core`
 *
 * The colocated `.data.json` was produced by EXECUTING code, never transcribed
 * by hand: `before` is 0162's frozen `after` for `chat_venue`, byte for byte,
 * and `after` is `DEFAULT_RULES.chat_venue` evaluated from the
 * `default-prompts.ts` source (the trap `0100` documents: the package resolves
 * to its build output, so a stale build would hand this migration old strings).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, and, eq, ne } from '@repo/db';
import { logger } from '../utils/logger.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0163-hos-2098-chat-venue-age-scope-decide-first',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated snapshot of the `chat_venue` rules on both sides of the fix. */
const DATA_PATH = path.resolve(
    __dirname,
    '0163-hos-2098-chat-venue-age-scope-decide-first.data.json'
);

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
 * Rewrites the `chat_venue` `rules` from the exact string 0162 wrote to the
 * decide-first one, only on rows that still hold that exact string.
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

        const edited = await ctx.db
            .select({ id: aiPromptVersions.id })
            .from(aiPromptVersions)
            .where(
                and(eq(aiPromptVersions.feature, feature), ne(aiPromptVersions.rules, newRules))
            );
        counts[`${feature}_operator_edited`] = edited.length;
        for (const { id } of edited) {
            logger.warn(
                `HOS-2098: skipped ai_prompt_versions ${id} (${feature}): its rules differ from the 0162 baseline (operator-edited), so it did NOT get the decide-first age-scope fix — merge it by hand.`
            );
        }
    }

    return {
        summary:
            total === 0
                ? 'The chat_venue rules already carry the HOS-2098 decide-first age-scope fix, or were operator-edited — no change.'
                : `Applied the HOS-2098 decide-first age-scope fix to ${total} chat_venue rules column(s).`,
        counts
    };
}
