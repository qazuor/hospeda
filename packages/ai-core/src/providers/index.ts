/**
 * AI provider adapters module.
 *
 * Wraps vendor SDKs (OpenAI, Anthropic, Google, etc.) behind a uniform
 * interface so the rest of the package is provider-agnostic.
 *
 * Exports:
 * - `AiProvider`          — the SDK-free interface every adapter implements.
 * - `StreamTextResult`    — return type of `AiProvider.streamText`.
 * - `EmbedInput`          — input type for `AiProvider.embed` (V2 stub).
 * - `EmbedOutput`         — output type for `AiProvider.embed` (V2 stub).
 * - `NotImplementedError` — error thrown by V1 stubs of V2 methods.
 * - `StubProvider`        — deterministic test provider (§5.14, R-6).
 * - `OpenAiAdapter`       — Vercel AI SDK v6 adapter for OpenAI (T-013).
 * - `OpenAiAdapterOptions`— constructor options for `OpenAiAdapter`.
 * - `AnthropicAdapter`    — Vercel AI SDK v6 adapter for Anthropic (T-013).
 * - `AnthropicAdapterOptions` — constructor options for `AnthropicAdapter`.
 * - `listProviderModels` — standalone list-models fetcher (HOS-94, T-003),
 *   decoupled from the `AiProvider` interface. Plain REST `fetch`, no AI SDK.
 * - `ProviderFamily`, `ListProviderModelsInput`, `ListProviderModelsResult` —
 *   supporting types for `listProviderModels`.
 * - `resolveProviderFamily` — resolves a provider id to its HTTP-shape family.
 * - `ListModelsError` and subclasses — typed failures from `listProviderModels`.
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
export type {
    ListProviderModelsInput,
    ListProviderModelsResult,
    ProviderFamily
} from './list-models.js';
export {
    ListModelsAuthError,
    ListModelsError,
    ListModelsRateLimitError,
    ListModelsUnsupportedProviderError,
    ListModelsUpstreamError,
    listProviderModels,
    resolveProviderFamily
} from './list-models.js';
export { StubProvider } from './stub.provider.js';
export type { AnthropicAdapterOptions } from './vercel-anthropic.adapter.js';
export { AnthropicAdapter } from './vercel-anthropic.adapter.js';
export type { OpenAiAdapterOptions } from './vercel-openai.adapter.js';
export { OpenAiAdapter } from './vercel-openai.adapter.js';
