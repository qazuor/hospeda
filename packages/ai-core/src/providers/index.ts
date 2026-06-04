/**
 * AI provider adapters module.
 *
 * Wraps vendor SDKs (OpenAI, Anthropic, Google, etc.) behind a uniform
 * interface so the rest of the package is provider-agnostic.
 *
 * Exports:
 * - `AiProvider`         — the SDK-free interface every adapter implements.
 * - `StreamTextResult`   — return type of `AiProvider.streamText`.
 * - `EmbedInput`         — input type for `AiProvider.embed` (V2 stub).
 * - `EmbedOutput`        — output type for `AiProvider.embed` (V2 stub).
 * - `NotImplementedError`— error thrown by V1 stubs of V2 methods.
 * - `StubProvider`       — deterministic test provider (§5.14, R-6).
 *
 * @module ai-core/providers
 */

export type {
    AiProvider,
    EmbedInput,
    EmbedOutput,
    StreamTextResult
} from './ai-provider.interface.js';
export { NotImplementedError } from './ai-provider.interface.js';
export { StubProvider } from './stub.provider.js';
