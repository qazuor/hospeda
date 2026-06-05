/**
 * AI capability modules (SPEC-173 T-015).
 *
 * Higher-level, domain-oriented helpers built on top of the engine: text
 * generation, structured-object generation, intent extraction, content
 * moderation, and embeddings (V2 stub).
 *
 * Each capability module:
 * 1. Makes `locale` optional, filling `defaultLocale` when absent (FR-13).
 * 2. Delegates to the injected `AiEngine` (never touches providers directly,
 *    except `embed` which is a V2 stub).
 * 3. Never imports `@repo/db`, `ai`, or `@ai-sdk/*` (AC-4).
 *
 * The primary consumer of these helpers is {@link AiService} — external callers
 * should use `AiService` rather than these internals directly.
 *
 * @module ai-core/capabilities
 */

// generateText
export type {
    ExecuteGenerateTextInput,
    GenerateTextCapabilityInput,
    GenerateTextCapabilityOutput
} from './generate-text.capability.js';
export { executeGenerateText } from './generate-text.capability.js';

// generateObject
export type {
    ExecuteGenerateObjectInput,
    GenerateObjectCapabilityInput,
    GenerateObjectCapabilityOutput
} from './generate-object.capability.js';
export { executeGenerateObject } from './generate-object.capability.js';

// extractIntent
export type {
    ExecuteExtractIntentInput,
    ExtractIntentCapabilityInput,
    ExtractIntentCapabilityOutput
} from './extract-intent.capability.js';
export { executeExtractIntent } from './extract-intent.capability.js';

// moderate
export type {
    ExecuteModerateInput,
    ModerateCapabilityInput,
    ModerateCapabilityOutput
} from './moderate.capability.js';
export { executeModerate } from './moderate.capability.js';

// streamText (T-024)
export type {
    ExecuteStreamTextInput,
    StreamTextCapabilityInput
} from './stream-text.capability.js';
export { executeStreamText } from './stream-text.capability.js';

// embed (V2 stub)
export type {
    EmbedInput,
    EmbedOutput,
    EmbedProvider,
    ExecuteEmbedInput
} from './embed.capability.js';
export { executeEmbed } from './embed.capability.js';
