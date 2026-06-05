/**
 * @repo/ai-core — Provider-agnostic AI infrastructure for the Hospeda platform.
 *
 * Exports are organised into sub-modules that will be populated in subsequent
 * tasks (T-002 onwards):
 *
 * - `providers`   — Vendor SDK adapters (OpenAI, Anthropic, Google…)
 * - `engine`      — Prompt orchestration, streaming, and retries
 * - `capabilities`— High-level domain helpers (text generation, moderation…)
 * - `config`      — Env-validated configuration and model defaults
 * - `usage`       — Token/cost tracking and observability
 * - `safety`      — Input sanitisation and output guardrails
 * - `storage`     — Conversation history and embedding persistence
 * - `types`       — Shared provider-agnostic type definitions
 *
 * Named exports only — no default export.
 *
 * @module ai-core
 */

export * from './providers/index.js';
export * from './engine/index.js';
export * from './capabilities/index.js';
export * from './config/index.js';
export * from './usage/index.js';
export * from './safety/index.js';
export * from './storage/index.js';
export * from './types/index.js';
