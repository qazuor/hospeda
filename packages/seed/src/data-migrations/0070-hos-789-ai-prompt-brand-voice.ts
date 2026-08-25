/**
 * @fileoverview
 * Data migration: 0070-hos-789-ai-prompt-brand-voice
 *
 * Carries the HOS-789 brand-voice corrections into `ai_prompt_versions` rows
 * that already exist in a seeded environment.
 *
 * ## Why a migration is required at all
 *
 * `aiPrompts.seed.ts` inserts with `ON CONFLICT ... DO NOTHING` — deliberately,
 * so re-seeding never clobbers a prompt an admin edited from the panel. The
 * consequence is that editing `DEFAULT_PROMPTS` / `DEFAULT_RULES` in
 * `@repo/ai-core` reaches **fresh** databases only: staging and production
 * already hold their nine rows and the seed leaves them untouched. This is the
 * HOS-25 dual-write rule — baseline edit for new databases, numbered migration
 * for the ones already seeded.
 *
 * ## What was wrong
 *
 * Three product invariants the generated text kept breaking (smoke of 25/08,
 * reproduced identically on staging and production — the nine prompts hashed
 * the same on both):
 *
 * 1. **Register.** The AI tuteaba ("Imagina", "Ven", "déjate") while every
 *    human-authored string in the product voseas ("Mejorá", "Subí", "Elegí").
 *    The AI's output is what gets published on a host's listing.
 * 2. **Proper names.** `translate` rendered "Cheroga Casa Quinta" as "Cheroga
 *    Country House" in English while leaving the Portuguese intact — same
 *    field, same call, opposite criteria. A listing's commercial name is how a
 *    guest finds it; translating it makes it a different business.
 * 3. **Vocabulary.** It called an accommodation "el destino", a word this
 *    product already spends on a concrete geographic entity with its own page
 *    and its own required form field.
 *
 * ## How the update is scoped
 *
 * `content` and `rules` are evaluated **independently**, each against its own
 * frozen pre-HOS-789 value, because `prompt-resolver.ts` resolves the two
 * columns separately: an admin row may carry an edited `content` and a
 * still-default `rules`. Treating them as one unit would skip the guardrail
 * update on any row whose prose was ever touched.
 *
 * A column is rewritten only when it still holds the exact pre-HOS-789 string.
 * Anything an operator has reworded is left alone — same containment rule as
 * `0016-hos-171-freemonth-description`. That makes the migration idempotent by
 * construction: a second run matches nothing and reports zero.
 *
 * ## Both sides are frozen — nothing is imported from `@repo/ai-core`
 *
 * The `before` and `after` halves of the colocated
 * `0070-hos-789-ai-prompt-brand-voice.data.json` were both produced by
 * EXECUTING the respective module (pre-change from git, post-change from the
 * working tree), never transcribed by hand.
 *
 * Importing `DEFAULT_PROMPTS` live from `@repo/ai-core` was the obvious
 * alternative and is a trap: that package's `exports` map resolves to `dist/`,
 * not `src/`. A stale build would hand this migration the pre-HOS-789 strings,
 * it would write them over identical values, and it would report success —
 * a silent no-op with a green ledger entry and no way to tell from the output
 * that anything went wrong. Freezing removes the build from the equation
 * entirely, and matches `0016-hos-171-freemonth-description`, which freezes
 * both its stale and its corrected string for the same reason.
 *
 * The cost of freezing is that a later change to these prompts needs its own
 * numbered migration rather than riding along on this one. That is the correct
 * shape for a migration anyway: a record of one specific delta, applied once.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, and, eq } from '@repo/db';
import type { AiFeature } from '@repo/schemas';
import { AiFeatureSchema } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0070-hos-789-ai-prompt-brand-voice',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated snapshot of the prompts on both sides of the HOS-789 edit. */
const DATA_PATH = path.resolve(__dirname, '0070-hos-789-ai-prompt-brand-voice.data.json');

/** One side of the frozen snapshot: every feature's `content` and `rules`. */
interface PromptSnapshot {
    readonly prompts: Record<string, string>;
    readonly rules: Record<string, string>;
}

/** Shape of the colocated frozen payload. */
interface FrozenBaseline {
    readonly before: PromptSnapshot;
    readonly after: PromptSnapshot;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const { before, after } = JSON.parse(raw) as FrozenBaseline;

    let contentUpdated = 0;
    let rulesUpdated = 0;
    let skipped = 0;

    for (const feature of AiFeatureSchema.options as readonly AiFeature[]) {
        const oldContent = before.prompts[feature];
        const oldRules = before.rules[feature];
        const newContent = after.prompts[feature];
        const newRules = after.rules[feature];

        // A feature present in the enum but absent from the frozen snapshot was
        // added after HOS-789; it has no stale value to correct.
        if (
            oldContent === undefined ||
            oldRules === undefined ||
            newContent === undefined ||
            newRules === undefined
        ) {
            skipped++;
            continue;
        }

        if (oldContent !== newContent) {
            const rows = await ctx.db
                .update(aiPromptVersions)
                .set({ content: newContent })
                .where(
                    and(
                        eq(aiPromptVersions.feature, feature),
                        eq(aiPromptVersions.content, oldContent)
                    )
                )
                .returning({ id: aiPromptVersions.id });
            contentUpdated += rows.length;
        }

        if (oldRules !== newRules) {
            const rows = await ctx.db
                .update(aiPromptVersions)
                .set({ rules: newRules })
                .where(
                    and(eq(aiPromptVersions.feature, feature), eq(aiPromptVersions.rules, oldRules))
                )
                .returning({ id: aiPromptVersions.id });
            rulesUpdated += rows.length;
        }
    }

    const total = contentUpdated + rulesUpdated;

    return {
        summary:
            total === 0
                ? 'AI prompts already carry the HOS-789 brand-voice wording, or were operator-edited — no change.'
                : `Applied the HOS-789 brand-voice wording to ${contentUpdated} prompt content column(s) and ${rulesUpdated} rules column(s).`,
        counts: { contentUpdated, rulesUpdated, skipped }
    };
}
