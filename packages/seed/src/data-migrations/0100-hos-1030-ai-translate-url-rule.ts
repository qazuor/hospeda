/**
 * @fileoverview
 * Data migration: 0100-hos-1030-ai-translate-url-rule
 *
 * Carries the HOS-1030 URL-preservation prompt rule into `ai_prompt_versions`
 * rows that already exist in a seeded environment.
 *
 * ## Why a migration is required at all
 *
 * `aiPrompts.seed.ts` inserts with `ON CONFLICT ... DO NOTHING` — deliberately,
 * so re-seeding never clobbers a prompt an admin edited from the panel. The
 * consequence is that editing `DEFAULT_PROMPTS` / `DEFAULT_RULES` in
 * `@repo/ai-core` reaches **fresh** databases only: staging and production
 * already hold their `feature='translate'` row and the seed leaves it
 * untouched. This is the HOS-25 dual-write rule — baseline edit for new
 * databases, numbered migration for the ones already seeded — and it applies
 * here even though no admin ever touched the row: staging and production both
 * carry a `translate` row seeded verbatim from `DEFAULT_PROMPTS`/`DEFAULT_RULES`
 * (`created_at` 2026-07-08), so a code-only prompt edit still reaches neither
 * without this migration. Same shape as `0070-hos-789-ai-prompt-brand-voice`,
 * which is the direct precedent this migration follows line for line.
 *
 * ## What was wrong
 *
 * `ai-translate.service.ts` sends field text to the model with no defense
 * against it rewriting the PATH segment of a URL — `[link](https://x.test/pagina)`
 * came back with the visible link text untouched but the destination rewritten
 * to `https://x.test/page` in English, a path that does not exist on the
 * host's own server. The PRIMARY fix (this same PR) is a placeholder
 * substitution in `ai-translate.service.ts` that removes every URL from the
 * text before the model ever sees it. This migration carries the SECONDARY,
 * defense-in-depth fix: an explicit "reproduce URLs verbatim" instruction
 * added to the `translate` feature's prompt, for the case the placeholder
 * defense is ever bypassed or extended to a path that doesn't call it.
 *
 * ## How the update is scoped
 *
 * Only the `translate` feature is touched — HOS-1030 changed nothing else.
 * `content` and `rules` are evaluated INDEPENDENTLY, because
 * `prompt-resolver.ts` resolves the two columns separately: an admin row may
 * carry an edited `content` and a still-default `rules` (or vice versa).
 * Treating them as one unit would skip the guardrail update on any row whose
 * prose was ever touched, or risk clobbering an edited `content` to update an
 * untouched `rules`.
 *
 * A column is rewritten only when it still holds the exact pre-HOS-1030
 * string. Anything an operator has reworded is left alone — same containment
 * rule as `0070-hos-789-ai-prompt-brand-voice` and
 * `0016-hos-171-freemonth-description`. That makes the migration idempotent
 * by construction: a second run matches nothing and reports zero.
 *
 * ## Both sides are frozen — nothing is imported from `@repo/ai-core`
 *
 * The `before` and `after` halves of the colocated
 * `0100-hos-1030-ai-translate-url-rule.data.json` were both produced by
 * EXECUTING `default-prompts.ts` (pre-change from git at `d81df29cf` — the
 * commit immediately before HOS-1030's prompt edit — post-change from the
 * working tree), never transcribed by hand.
 *
 * Importing `DEFAULT_PROMPTS` live from `@repo/ai-core` was the obvious
 * alternative and is a trap, exactly as `0070` documents: that package's
 * `exports` map resolves to `dist/`, not `src/`. A stale build would hand
 * this migration the pre-HOS-1030 strings, it would write them over
 * identical values, and it would report success — a silent no-op with a
 * green ledger entry and no way to tell from the output that anything went
 * wrong. Freezing removes the build from the equation entirely.
 *
 * The cost of freezing is that a later change to this prompt needs its own
 * numbered migration rather than riding along on this one. That is the
 * correct shape for a migration anyway: a record of one specific delta,
 * applied once.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, and, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0100-hos-1030-ai-translate-url-rule',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated snapshot of the `translate` prompt on both sides of the HOS-1030 edit. */
const DATA_PATH = path.resolve(__dirname, '0100-hos-1030-ai-translate-url-rule.data.json');

/** One side of the frozen snapshot: the `translate` feature's `content` and `rules`. */
interface PromptSnapshot {
    readonly prompts: { readonly translate: string };
    readonly rules: { readonly translate: string };
}

/** Shape of the colocated frozen payload. */
interface FrozenBaseline {
    readonly before: PromptSnapshot;
    readonly after: PromptSnapshot;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const { before, after } = JSON.parse(raw) as FrozenBaseline;

    const oldContent = before.prompts.translate;
    const oldRules = before.rules.translate;
    const newContent = after.prompts.translate;
    const newRules = after.rules.translate;

    let contentUpdated = 0;
    let rulesUpdated = 0;

    if (oldContent !== newContent) {
        const rows = await ctx.db
            .update(aiPromptVersions)
            .set({ content: newContent })
            .where(
                and(
                    eq(aiPromptVersions.feature, 'translate'),
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
                and(eq(aiPromptVersions.feature, 'translate'), eq(aiPromptVersions.rules, oldRules))
            )
            .returning({ id: aiPromptVersions.id });
        rulesUpdated = rows.length;
    }

    const total = contentUpdated + rulesUpdated;

    return {
        summary:
            total === 0
                ? 'The translate prompt already carries the HOS-1030 URL-preservation wording, or was operator-edited — no change.'
                : `Applied the HOS-1030 URL-preservation wording to ${contentUpdated} translate content column(s) and ${rulesUpdated} rules column(s).`,
        counts: { contentUpdated, rulesUpdated }
    };
}
