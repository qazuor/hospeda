/**
 * Chat-capability filter for detected AI provider models (HOS-94 T-006, OQ-1).
 *
 * Given the raw model id strings returned by a provider's list-models
 * endpoint (see `listProviderModels` in `@repo/ai-core`), classifies each id
 * into one of three buckets:
 *
 * - **Hidden** — matches a known non-chat family (embeddings, speech-to-text,
 *   text-to-speech, image generation, moderation, an explicitly deprecated
 *   marker, realtime/audio conversational endpoints, code-specialized
 *   variants, web-search-augmented variants, or deep-research agents).
 *   Excluded from the result entirely.
 * - **Chat (confident)** — matches a known chat/text-generation family
 *   (`gpt-*`, `o1`/`o3`/`o4-*`, `claude-*`, `gemini-*`, `llama*`, ...).
 *   Returned with `uncertain: false`.
 * - **Uncertain** — does not confidently match either list. Per the OQ-1
 *   owner decision ("denylist + uncertain bucket"), these are **kept** (not
 *   dropped) and tagged `uncertain: true` so the operator can review and
 *   enable them manually in the admin UI.
 *
 * This module is a **pure, provider-agnostic function**: it has no I/O, no
 * provider SDK dependency, and no knowledge of `KNOWN_PROVIDERS` (the merge
 * with the curated catalog is a separate concern, see T-007). It operates
 * purely on id strings, which keeps it trivially unit-testable and reusable
 * across every provider family (OpenAI, Anthropic, Gemini, Ollama, and
 * OpenAI-compatible providers all funnel through the same classifier).
 *
 * @module services/ai-sync-models-filter
 */

// ---------------------------------------------------------------------------
// Denylist — known non-chat model families (hidden, never surfaced)
// ---------------------------------------------------------------------------

/**
 * Patterns matching model ids that are confidently NOT chat/text-generation
 * capable. Matched case-insensitively against the raw id.
 *
 * Each pattern documents the provider family it targets so the list stays
 * auditable as providers add new non-chat model lines.
 */
const DENYLIST_PATTERNS: readonly RegExp[] = [
    // OpenAI / compatible text-embedding models (e.g. text-embedding-3-large,
    // text-embedding-ada-002) and any other "embedding" family.
    /text-embedding/i,
    /embedding/i,
    // Speech-to-text (Whisper family, e.g. whisper-1).
    /whisper/i,
    // Text-to-speech (e.g. tts-1, tts-1-hd, gpt-4o-mini-tts).
    /(^|[^a-z])tts([^a-z]|$)/i,
    // Image generation (e.g. dall-e-2, dall-e-3).
    /dall-?e/i,
    // Moderation endpoints (e.g. text-moderation-latest, omni-moderation-2024-...).
    /moderation/i,
    // Explicitly deprecated markers some providers surface inline.
    /deprecated/i,
    // Audio / realtime transcription helpers that are not chat models.
    /transcribe/i,
    // Image models beyond dall-e (e.g. gpt-image-1, stable-diffusion-*).
    /gpt-image/i,
    /stable-diffusion/i,
    // Video generation models (e.g. sora).
    /^sora/i,
    // Realtime speech-to-speech / voice-conversation models (e.g.
    // gpt-realtime, gpt-realtime-mini) — audio I/O, not text chat.
    /gpt-realtime/i,
    // Standalone audio-in/audio-out chat models (e.g. gpt-audio,
    // gpt-audio-mini) — same rationale as gpt-realtime above.
    /gpt-audio/i,
    // Code/agentic-coding-specialized variants (e.g. gpt-5-codex,
    // gpt-5.1-codex-max) — built for the Codex CLI/agentic coding harness,
    // not general text chat.
    /-codex/i,
    // Web-search-augmented variants (e.g. gpt-4o-search-preview,
    // gpt-5-search-api) — retrieval-augmented search endpoints, distinct
    // from plain chat completion.
    /-search-preview/i,
    /-search-api/i,
    // Deep-research agent models (e.g. o4-mini-deep-research) — long-running
    // multi-step research agents, not interactive chat.
    /-deep-research/i
];

// ---------------------------------------------------------------------------
// Allowlist — known chat/text-generation model families (confident pass)
// ---------------------------------------------------------------------------

/**
 * Patterns matching model ids that are confidently chat/text-generation
 * capable. Matched case-insensitively against the raw id. Anything NOT
 * matched here (and not denylisted above) falls into the "uncertain" bucket
 * rather than being dropped — see the module doc / OQ-1.
 */
const CHAT_ALLOWLIST_PATTERNS: readonly RegExp[] = [
    // OpenAI GPT family (gpt-3.5-turbo, gpt-4, gpt-4o, gpt-4.1, gpt-5, ...).
    /^gpt-/i,
    // OpenAI reasoning family (o1, o1-mini, o3, o3-mini, o4-mini, ...).
    /^o[134](-|$)/i,
    // OpenAI chat-branded aliases (chatgpt-4o-latest, ...).
    /^chatgpt/i,
    // Anthropic Claude family (claude-3-5-sonnet, claude-3-opus, ...).
    /^claude-/i,
    // Google Gemini family (gemini-1.5-pro, gemini-2.0-flash, ...).
    /^gemini-/i,
    // Meta Llama family (llama-3.1-70b, llama3, ...).
    /^llama/i,
    // Mistral family (mistral-large-latest, mistral-7b, mixtral-8x7b, ...).
    /^mistral/i,
    /^mixtral/i,
    // DeepSeek family (deepseek-chat, deepseek-r1, ...).
    /^deepseek/i,
    // Alibaba Qwen family (qwen2.5-72b-instruct, qwen-turbo, ...).
    /^qwen/i,
    // Cohere Command family (command-r-plus, ...).
    /^command-/i,
    // Zhipu GLM family (glm-4, ...).
    /^glm-/i,
    // Moonshot Kimi family (moonshot-v1-8k, kimi-...).
    /^moonshot/i,
    /^kimi/i,
    // Microsoft Phi family (phi-3-mini, ...).
    /^phi-/i,
    // Amazon Nova family (nova-pro-v1, ...).
    /^nova-/i,
    // xAI Grok family (grok-2, grok-beta, ...).
    /^grok/i
];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Input for {@link filterChatCapableModels}.
 */
export interface FilterChatCapableModelsInput {
    /** Raw model id strings as returned by a provider's list-models endpoint. */
    readonly ids: readonly string[];
    /**
     * Optional provider identifier (e.g. `'openai'`, `'anthropic'`). Not used
     * by the shared denylist/allowlist today, but accepted so a future
     * per-provider nuance can be layered in without changing the call
     * signature that T-008 depends on.
     */
    readonly providerId?: string;
}

/**
 * A single classified model, ready to be merged with the curated catalog
 * (T-007) and mapped into `AiProviderModelSchema` (`@repo/schemas`).
 */
export interface ClassifiedModel {
    /** Raw model identifier, unchanged. */
    readonly id: string;
    /**
     * `true` when the classifier could not confidently place this id in
     * either the denylist or the chat allowlist (OQ-1's "uncertain" bucket).
     * `false` means it confidently matched a known chat family.
     */
    readonly uncertain: boolean;
}

/**
 * Output of {@link filterChatCapableModels}.
 */
export interface FilterChatCapableModelsResult {
    /**
     * Surfaced models (confident chat matches + uncertain ones). Denylisted
     * ids are excluded entirely and do not appear here.
     */
    readonly models: readonly ClassifiedModel[];
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

/**
 * Classifies raw provider model ids into chat-capable (confident) vs.
 * uncertain, hiding known non-chat families entirely.
 *
 * Pure and provider-agnostic: no I/O, no dependency on `KNOWN_PROVIDERS` or
 * any provider SDK. Duplicate ids in the input are de-duplicated (first
 * occurrence wins), and input order is otherwise preserved.
 *
 * @param input - Raw model ids (and optional provider id, reserved for
 * future per-provider nuance).
 * @returns The filtered/classified model list, denylisted ids excluded.
 *
 * @example
 * ```ts
 * filterChatCapableModels({
 *   ids: ['gpt-4o', 'text-embedding-3-large', 'whisper-1', 'weird-new-model-x'],
 * });
 * // {
 * //   models: [
 * //     { id: 'gpt-4o', uncertain: false },
 * //     { id: 'weird-new-model-x', uncertain: true },
 * //   ],
 * // }
 * ```
 */
export function filterChatCapableModels(
    input: FilterChatCapableModelsInput
): FilterChatCapableModelsResult {
    const seen = new Set<string>();
    const models: ClassifiedModel[] = [];

    for (const id of input.ids) {
        if (seen.has(id)) {
            continue;
        }
        seen.add(id);

        if (isDenylisted(id)) {
            continue;
        }

        models.push({ id, uncertain: !isConfidentChatModel(id) });
    }

    return { models };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether a model id matches a known non-chat family.
 *
 * @param id - Raw model id.
 * @returns `true` if the id should be hidden entirely.
 */
function isDenylisted(id: string): boolean {
    return DENYLIST_PATTERNS.some((pattern) => pattern.test(id));
}

/**
 * Checks whether a model id confidently matches a known chat/text-generation
 * family.
 *
 * @param id - Raw model id.
 * @returns `true` if the id should be classified as confidently chat-capable.
 */
function isConfidentChatModel(id: string): boolean {
    return CHAT_ALLOWLIST_PATTERNS.some((pattern) => pattern.test(id));
}
