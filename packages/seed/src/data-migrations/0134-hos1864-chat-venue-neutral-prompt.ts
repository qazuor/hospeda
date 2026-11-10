/**
 * @fileoverview
 * Data migration: 0134-hos1864-chat-venue-neutral-prompt
 *
 * Carries the HOS-1864 neutral venue chat prompt and its hard age/alcohol
 * rules into `ai_prompt_versions` rows that already exist in a seeded
 * environment.
 *
 * ## Why a migration is required at all
 *
 * `aiPrompts.seed.ts` inserts with `ON CONFLICT ... DO NOTHING` — deliberately,
 * so re-seeding never clobbers a prompt an admin edited from the panel. The
 * consequence is that editing `DEFAULT_PROMPTS` / `DEFAULT_RULES` in
 * `@repo/ai-core` reaches **fresh** databases only: staging and production
 * already hold their `feature='chat_venue'` row and the seed leaves it
 * untouched. This is the HOS-25 dual-write rule — baseline edit for new
 * databases, numbered migration for the ones already seeded. Same shape as
 * `0100-hos-1030-ai-translate-url-rule`, which follows `0070-hos-789` line for
 * line; this migration follows `0100` the same way, scoped to `chat_venue`.
 *
 * ## What changed
 *
 * HOS-1864 replaces the restaurant-scoped venue prompt with a neutral one (a
 * place to eat OR to go out: restaurant, café, bar, pub or nightclub) and adds
 * the DEC-FAC-053 hard rules to `DEFAULT_RULES.chat_venue`: never state or
 * imply that someone below the ficha's minimum age may enter, never coach
 * anyone around that age, repeat the minimum age and the legal notice verbatim,
 * and refer the visitor to the venue. The clause lives ONLY in `rules`; the
 * prompt names the minimum age as a topic and carries no prohibition.
 *
 * `content` and `rules` are BOTH in the snapshot because
 * `prompt-resolver.ts` resolves the two columns independently: a row may carry
 * an operator-edited `content` next to a still-default `rules`, or vice versa.
 *
 * ## How the update is scoped
 *
 * Only `feature = 'chat_venue'` is touched. `content` and `rules` are
 * evaluated INDEPENDENTLY, each rewritten only when it still holds the exact
 * pre-HOS-1864 string. Anything an operator has reworded is left alone, which
 * makes the migration idempotent by construction: a second run matches nothing
 * and reports zero.
 *
 * ## Both sides are frozen — nothing is imported from `@repo/ai-core`
 *
 * The `before` and `after` halves of the colocated
 * `0134-hos1864-chat-venue-neutral-prompt.data.json` were produced by
 * EXECUTING `default-prompts.ts` (before from the epic tip
 * `origin/epic/HOS-1787-comer-y-salir`, after from the working tree), never
 * transcribed by hand. Importing `DEFAULT_PROMPTS` live was the obvious
 * alternative and is a trap, exactly as `0100` documents: that package's
 * `exports` map resolves to `dist/`, so a stale build would hand this
 * migration the pre-change strings and it would report a green no-op.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, and, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0134-hos1864-chat-venue-neutral-prompt',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated snapshot of the `chat_venue` prompt on both sides of the HOS-1864 edit. */
const DATA_PATH = path.resolve(__dirname, '0134-hos1864-chat-venue-neutral-prompt.data.json');

/** One side of the frozen snapshot: the `chat_venue` feature's `content` and `rules`. */
interface PromptSnapshot {
    readonly prompts: { readonly chat_venue: string };
    readonly rules: { readonly chat_venue: string };
}

/** Shape of the colocated frozen payload. */
interface FrozenBaseline {
    readonly before: PromptSnapshot;
    readonly after: PromptSnapshot;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const { before, after } = JSON.parse(raw) as FrozenBaseline;

    const oldContent = before.prompts.chat_venue;
    const oldRules = before.rules.chat_venue;
    const newContent = after.prompts.chat_venue;
    const newRules = after.rules.chat_venue;

    let contentUpdated = 0;
    let rulesUpdated = 0;

    if (oldContent !== newContent) {
        const rows = await ctx.db
            .update(aiPromptVersions)
            .set({ content: newContent })
            .where(
                and(
                    eq(aiPromptVersions.feature, 'chat_venue'),
                    eq(aiPromptVersions.content, oldContent)
                )
            )
            .returning({ id: aiPromptVersions.id });
        contentUpdated = rows.length;
    }

    if (oldRules !== newRules) {
        const rows = await ctx.db
            .update(aiPromptVersions)
            .set({ rules: newRules })
            .where(
                and(
                    eq(aiPromptVersions.feature, 'chat_venue'),
                    eq(aiPromptVersions.rules, oldRules)
                )
            )
            .returning({ id: aiPromptVersions.id });
        rulesUpdated = rows.length;
    }

    const total = contentUpdated + rulesUpdated;

    return {
        summary:
            total === 0
                ? 'The chat_venue prompt already carries the HOS-1864 neutral wording and age rules, or was operator-edited — no change.'
                : `Applied the HOS-1864 neutral wording to ${contentUpdated} chat_venue content column(s) and the age/alcohol rules to ${rulesUpdated} rules column(s).`,
        counts: { contentUpdated, rulesUpdated }
    };
}
