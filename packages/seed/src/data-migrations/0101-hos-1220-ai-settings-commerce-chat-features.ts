/**
 * @fileoverview
 * Data migration: 0101-hos-1220-ai-settings-commerce-chat-features
 *
 * Adds the `chat_gastronomy` and `chat_experience` keys to the `features` map of
 * the `'global'` row in `ai_settings`. HOS-400 widened the `AiFeature` enum with
 * those two members; `AiFeaturesMapSchema` is a FULL `z.record` over that enum,
 * so from that commit on every stored blob that lacks them fails validation.
 *
 * ## Why this is an outage and not a missing default
 *
 * `readAiSettings` parses the stored blob through `AiSettingsValueSchema` and
 * THROWS `AiSettingsParseError` when it does not validate. It sits upstream of
 * `resolveConfig` → `createConfiguredAiService`, so the throw takes down every
 * AI feature at once — text improve, translate, the three chats, post
 * generation, support and AI search all answer 400 before doing any work. The
 * blob is one document and the parse is all-or-nothing: two keys nobody had
 * configured yet disabled the seven that were.
 *
 * Measured on 2026-09-07: staging and production BOTH hold exactly the same
 * seven keys (`accommodation_import`, `chat`, `post_generate`, `search`,
 * `support`, `text_improve`, `translate`). Staging is down because it has the
 * code; production is intact only because it does not have it yet, and breaks
 * the moment the batch is promoted.
 *
 * ## Why it reads and writes the row DIRECTLY
 *
 * The obvious implementation — `readAiSettings()`, spread, `writeAiSettings()` —
 * cannot work: `readAiSettings` throws on precisely the blob this migration
 * exists to repair. So the row is selected raw, the `features` object is patched
 * as plain JSON, and the result is written with a direct `update`.
 *
 * The schema is still enforced, just at the other end: the PATCHED blob is
 * validated through `AiSettingsValueSchema` before the write, and the migration
 * THROWS if it does not pass. A blob that is still invalid for some unrelated
 * reason therefore fails loudly here instead of being written and leaving the AI
 * layer down with a migration ledgered as applied.
 *
 * ## Where the two new configs come from
 *
 * They are cloned from the row's existing `chat` entry. Per HOS-400 the three
 * chats are the SAME product — the split exists so each vertical's monthly quota
 * counts its own `ai_usage` rows — so the vertical chats must inherit the
 * provider, model, fallback chain, params and kill-switch state the operator
 * already chose for accommodation chat. Cloning also means an operator who had
 * deliberately switched chat OFF does not silently get two enabled features.
 *
 * When `chat` itself is absent (a blob narrower than any environment measured),
 * the fallback is the admin UI's own default: disabled, routed at `stub`. That
 * configures nothing real and calls no provider — it only makes the document
 * parse again.
 *
 * ## Dual-write counterpart
 *
 * There is no `src/data/**` fixture for this blob to update: `aiSettings.seed.ts`
 * deliberately never SYNTHESISES an `ai_settings` row (a valid blob needs a
 * complete providers/features map, which the seed has no business inventing) and
 * only merges `costCeilings` into a row an operator already created. The blob's
 * real baseline is the admin settings page's `DEFAULT_SETTINGS`, which this PR
 * fixes in the same change — it had been left at seven features by HOS-400, so
 * the operator could neither see nor configure the two new ones.
 *
 * ## No column dependency, hence no `meta.requiresColumns`
 *
 * `ai_settings.value` is a long-existing JSONB column. HOS-400 shipped no
 * structural migration; the whole change lives inside the blob.
 *
 * ## Idempotency
 *
 * The row is written only when at least one of the two keys is missing. A re-run
 * finds both present and returns without touching the row, so an operator who
 * has since tuned either vertical chat through the admin editor keeps their
 * values.
 *
 * ## `destructive` flag decision
 *
 * `false`. Two additive keys on one JSON object; every other key of the blob is
 * read back and preserved verbatim.
 *
 * ## Cache note
 *
 * `@repo/ai-core` caches the resolved config in-process with a TTL. This
 * migration runs in the seed CLI, a different process from the API, so calling
 * `invalidateConfigCache()` here would clear a cache nobody reads. A running API
 * picks the repaired blob up when its own TTL lapses (or on its next restart) —
 * there is nothing to invalidate remotely.
 */
import { aiSettings, eq, SYSTEM_USER_ID } from '@repo/db';
import { AiSettingsKeySchema, AiSettingsValueSchema } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0101-hos-1220-ai-settings-commerce-chat-features',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The two feature keys HOS-400 added to the `AiFeature` enum.
 *
 * Spelled as literals rather than derived from `AiFeatureSchema.options`: a
 * migration records the delta it applied on the day it ran, and must keep
 * describing that delta even after a later enum change adds a tenth member.
 */
const NEW_FEATURE_KEYS = ['chat_gastronomy', 'chat_experience'] as const;

/** The key of the existing feature the two new ones are cloned from. */
const SOURCE_FEATURE_KEY = 'chat';

/**
 * Fallback config used only when the stored blob has no `chat` entry to clone.
 *
 * Mirrors the admin settings page's `DEFAULT_SETTINGS`: disabled, routed at the
 * `stub` provider. It calls no real provider and spends nothing — its only job
 * is to make the document parse again so the other features come back.
 */
const FALLBACK_FEATURE_CONFIG = {
    enabled: false,
    primaryProvider: 'stub',
    fallbackChain: [],
    model: 'gpt-4o-mini',
    params: {}
} as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const key = AiSettingsKeySchema.value;

    // Raw select: readAiSettings() would throw on the very blob being repaired.
    const rows = await ctx.db
        .select({ value: aiSettings.value })
        .from(aiSettings)
        .where(eq(aiSettings.key, key))
        .limit(1);

    const row = rows[0];
    if (!row) {
        return {
            summary: `HOS-1220: no ai_settings '${key}' row exists — nothing to repair.`,
            counts: { featuresAdded: 0 }
        };
    }

    const blob = row.value as Record<string, unknown>;
    const features =
        blob.features && typeof blob.features === 'object'
            ? ({ ...blob.features } as Record<string, unknown>)
            : {};

    const missing = NEW_FEATURE_KEYS.filter((featureKey) => !(featureKey in features));

    if (missing.length === 0) {
        return {
            summary: 'HOS-1220: both commerce chat features already present — no change.',
            counts: { featuresAdded: 0 }
        };
    }

    // Clone the operator's own chat configuration: the three chats are one
    // product split only for metering, so the vertical ones must inherit the
    // provider, model and kill-switch state already chosen for accommodation.
    const source = features[SOURCE_FEATURE_KEY];
    const template =
        source && typeof source === 'object'
            ? (source as Record<string, unknown>)
            : FALLBACK_FEATURE_CONFIG;

    for (const featureKey of missing) {
        features[featureKey] = { ...template };
    }

    const patched = { ...blob, features };

    // The schema is enforced here rather than by writeAiSettings(). A blob that
    // is still invalid for an unrelated reason must fail loudly now, not be
    // written and leave the AI layer down with this migration ledgered applied.
    const parsed = AiSettingsValueSchema.safeParse(patched);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .slice(0, 5)
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
        throw new Error(
            `HOS-1220: patched ai_settings blob still fails AiSettingsValueSchema — refusing to write. Issues: ${issues}`
        );
    }

    await ctx.db
        .update(aiSettings)
        .set({
            value: parsed.data as Record<string, unknown>,
            updatedBy: SYSTEM_USER_ID,
            updatedAt: new Date()
        })
        .where(eq(aiSettings.key, key));

    const clonedFrom =
        source && typeof source === 'object'
            ? `cloned from '${SOURCE_FEATURE_KEY}'`
            : 'stub default';

    return {
        summary: `HOS-1220: added ${missing.join(', ')} to ai_settings.features (${clonedFrom}).`,
        counts: { featuresAdded: missing.length }
    };
}
