/**
 * AI safety and content-policy module (SPEC-173 T-019).
 *
 * Input sanitisation, output guardrails, prompt-injection defences, and
 * PII redaction before and after model invocations.
 *
 * Exports:
 * - `guardPromptInjection`     — syntactic sanitisation + injection detection.
 * - `DEFAULT_MAX_INPUT_LENGTH` — default truncation limit (10 000 chars).
 * - `scrubPii`                 — redact emails, phones, and cards for telemetry.
 *
 * @module ai-core/safety
 */

export {
    DEFAULT_MAX_INPUT_LENGTH,
    type GuardPromptInjectionInput,
    type GuardPromptInjectionResult,
    guardPromptInjection,
    type InjectionMatch,
    type InjectionSeverity
} from './injection-guard.js';

export {
    type PiiKind,
    type PiiRedaction,
    type ScrubPiiInput,
    type ScrubPiiResult,
    scrubPii
} from './pii-scrubber.js';
