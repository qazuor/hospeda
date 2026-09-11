import { z } from 'zod';

/**
 * AI provider and feature schemas (SPEC-173).
 *
 * Defines the provider identifier enum, the four V1 AI features, and the
 * optional model-parameter bag used across all AI configuration surfaces.
 *
 * **Append-only policy**: once a value ships, members of the enums may only be
 * added. Removals require a three-phase migration (mark deprecated, migrate
 * stored rows, remove). The `stub` provider is the deterministic test provider
 * (§5.14) and MUST always be present.
 */

// ---------------------------------------------------------------------------
// Provider identifier
// ---------------------------------------------------------------------------

/**
 * AI provider identifier — any non-empty string up to 100 characters.
 *
 * Well-known built-in identifiers: `openai`, `anthropic`, `stub`.
 * Custom provider IDs (e.g. `ollama`, `groq`, `deepseek`) are supported
 * when backed by an OpenAI-compatible baseURL credential.
 *
 * The schema intentionally accepts arbitrary strings so that new providers
 * can be added without schema changes. Validation of whether a provider
 * actually has a registered adapter or credential happens at the engine
 * layer, not here.
 */
export const AiProviderIdSchema = z.string().min(1).max(100);

/** TypeScript type for an AI provider identifier. */
export type AiProviderId = z.infer<typeof AiProviderIdSchema>;

// ---------------------------------------------------------------------------
// Feature
// ---------------------------------------------------------------------------

/**
 * The V1 AI feature identifiers.
 *
 * These are the runtime keys used for routing, usage metering, kill-switches,
 * and cost ceilings. They intentionally omit the `ai_` prefix used by the
 * entitlement/limit keys in `@repo/billing` — the context here is already AI.
 *
 * Mapping to `@repo/billing` entitlement gates (Q2, §5.7):
 * - `text_improve`         → `ai_text_improve`
 * - `chat`                 → `ai_chat`
 * - `chat_gastronomy`      → `ai_chat` (read from the GASTRONOMY subscription)
 * - `chat_experience`      → `ai_chat` (read from the EXPERIENCE subscription)
 * - `search`               → `ai_search`
 * - `support`              → `ai_support`
 * - `translate`            → `ai_translate`
 * - `accommodation_import` → `ai_accommodation_import`
 * - `post_generate`        → n/a (admin-only; permission-gated via PermissionEnum.POST_CREATE)
 *
 * ## Why the chat has three features and one entitlement (HOS-400)
 *
 * `chat`, `chat_gastronomy` and `chat_experience` are the SAME product gated by
 * the SAME entitlement key (`ai_chat`). They are separate `AiFeature` values for
 * one reason: this enum is the metering axis. Monthly quota is enforced by
 * counting `ai_usage` rows keyed by `(userId, feature)`, so two verticals
 * sharing a feature value share a counter no matter how many distinct
 * `LimitKey`s point at them — and a per-vertical cap over a pooled count is two
 * numbers reading the same bucket.
 *
 * That matters because an owner can hold several domains at once: someone who
 * is a host AND a restaurateur would otherwise spend their accommodation chat
 * budget on gastronomy traffic, which is precisely the cross-domain leak
 * SPEC-239 isolates against. One feature per vertical is what makes
 * `MAX_AI_CHAT_GASTRONOMY_PER_MONTH` count only gastronomy chats.
 *
 * Splitting by ENTITLEMENT instead was rejected: `ai_chat` is one capability
 * that different subscriptions grant, and duplicating it per vertical would put
 * the same product in three places in the catalogue for a bookkeeping reason.
 */
export const AiFeatureSchema = z.enum([
    'text_improve',
    'chat',
    'chat_gastronomy',
    'chat_experience',
    'search',
    'support',
    'translate',
    'accommodation_import',
    'post_generate'
]);

/** TypeScript type for a supported AI feature. */
export type AiFeature = z.infer<typeof AiFeatureSchema>;

// ---------------------------------------------------------------------------
// Model parameters
// ---------------------------------------------------------------------------

/**
 * Optional inference-time parameters forwarded to the provider.
 *
 * All fields are optional — omitting a field means the provider default applies.
 * Bounds are conservative and aligned with the Vercel AI SDK surface:
 *
 * - `temperature`: sampling randomness. 0 = deterministic, 2 = maximum
 *   entropy. Most providers support [0, 1]; the wider [0, 2] bound is used to
 *   cover Anthropic's accepted range without rejecting valid configs.
 * - `maxTokens`: upper bound on generated tokens (positive integer). The
 *   practical per-model ceiling is enforced at the provider adapter layer, not
 *   here — this schema only rejects obviously invalid values (≤ 0).
 * - `topP`: nucleus sampling mass [0, 1]. Do NOT set both `temperature` and
 *   `topP` simultaneously — the Vercel AI SDK documents this as conflicting.
 *   Enforcement of the mutual-exclusion is left to the engine layer; the schema
 *   validates each field independently.
 *
 * **Decision (owner-approved 2026-06-04)**: keep params minimal — `temperature`,
 * `maxTokens`, `topP` only. `topK`/`presencePenalty`/`frequencyPenalty` (exposed
 * by the AI SDK) are intentionally omitted (YAGNI); add them via additive
 * extension if and when a child spec actually needs them.
 */
export const AiModelParamsSchema = z.object({
    /**
     * Sampling temperature in [0, 2].
     * Lower values → more focused/deterministic; higher → more creative.
     */
    temperature: z.number().min(0).max(2).optional(),
    /**
     * Maximum number of tokens the model may generate.
     * Must be a positive integer. Provider-specific hard caps apply beyond this.
     */
    maxTokens: z.number().int().min(1).optional(),
    /**
     * Nucleus sampling probability mass in [0, 1].
     * Controls the cumulative probability cutoff for token selection.
     */
    topP: z.number().min(0).max(1).optional()
});

/** TypeScript type for optional AI model parameters. */
export type AiModelParams = z.infer<typeof AiModelParamsSchema>;
