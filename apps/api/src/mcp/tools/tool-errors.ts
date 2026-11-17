/**
 * @file tool-errors.ts
 * @description Maps tool errors to the Spanish message the user sees
 * (HOS-2184 T-012, spec §8 "Tool responses and errors are in Spanish").
 *
 * Transport-agnostic: the MCP binding renders a {@link ToolFailure} as an
 * `isError` result, and HOS-2185 can send the same text over WhatsApp.
 *
 * Rules (API error contract, `apps/api/docs/error-contract.md`):
 * - A missing and a foreign resource produce the SAME message: the error
 *   contract answers "not found" for both, and so does a tool.
 * - The internal `message` of an error never reaches the user. It may carry
 *   ids, SQL or English internals. Only field names and validator messages
 *   from structured `details`, and Spanish `reasonMessages`, are shown.
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { ToolAction, ToolErrorCode, ToolErrorPayload } from './tool-definition';

/** Message for a missing or foreign resource. Identical for both on purpose. */
export const TOOL_NOT_FOUND_MESSAGE =
    'No encontrado: no existe o no pertenece a tu cuenta. Revisá el identificador.';

/** Message for anything unexpected. Says nothing about the cause. */
export const TOOL_UNEXPECTED_ERROR_MESSAGE =
    'Ocurrió un error inesperado en Hospeda. Probá de nuevo en unos minutos.';

/** Base message for invalid input; field details are appended. */
export const TOOL_VALIDATION_MESSAGE = 'Los datos enviados no son válidos';

/**
 * How an audit record classifies a failure: `denied` when Hospeda refused the
 * call (authorization, plan, limits), `error` when it could not carry it out.
 */
export type ToolFailureKind = 'denied' | 'error';

/** A refused or failed tool call, ready to show to the user. */
export interface ToolFailure {
    /** Audit classification. */
    readonly kind: ToolFailureKind;
    /** The code behind it; `UNEXPECTED` for a non-`ServiceError` throw. */
    readonly code: ToolErrorCode | 'UNEXPECTED';
    /** Spanish, user-facing. */
    readonly message: string;
    /** The caller must re-authenticate (MCP: `_meta['mcp/www_authenticate']`). */
    readonly requiresReauthentication: boolean;
    /** No specific mapping exists: the failure deserves a server-side log. */
    readonly unexpected: boolean;
    /** Portal page where the user can resolve it (HOS-2326). Absent when none helps. */
    readonly action?: ToolAction;
    /** Id of the help topic that explains it. */
    readonly helpTopicId?: string;
}

/** One mapped code: its message and audit classification. */
interface CodeMapping {
    readonly message: string;
    readonly kind: ToolFailureKind;
}

const RATE_LIMIT_MAPPING: CodeMapping = {
    message: 'Hiciste demasiadas solicitudes seguidas. Esperá un momento y volvé a intentar.',
    kind: 'denied'
};

const UNAVAILABLE_MAPPING: CodeMapping = {
    message:
        'Un servicio de Hospeda no está disponible en este momento. Probá de nuevo en unos minutos.',
    kind: 'error'
};

const NOT_FOUND_MAPPING: CodeMapping = { message: TOOL_NOT_FOUND_MESSAGE, kind: 'denied' };

/**
 * Codes with a specific message. Anything absent (INTERNAL_ERROR,
 * CONFIGURATION_ERROR, NOT_IMPLEMENTED, domain codes no tool expects) falls
 * back to {@link TOOL_UNEXPECTED_ERROR_MESSAGE} and is flagged `unexpected`.
 * VALIDATION_ERROR is handled apart because it carries field details.
 */
const CODE_MAPPINGS: Readonly<Partial<Record<ToolErrorCode, CodeMapping>>> = {
    [ServiceErrorCode.NOT_FOUND]: NOT_FOUND_MAPPING,
    [ServiceErrorCode.GONE]: NOT_FOUND_MAPPING,
    [ServiceErrorCode.UNAUTHORIZED]: {
        message: 'Tu conexión con Hospeda venció o fue revocada. Volvé a conectar tu cuenta.',
        kind: 'denied'
    },
    [ServiceErrorCode.FORBIDDEN]: {
        message: 'Tu cuenta no tiene permiso para hacer esta acción.',
        kind: 'denied'
    },
    [ServiceErrorCode.EMAIL_NOT_VERIFIED]: {
        message:
            'Tenés que verificar tu email en Hospeda antes de hacer esta acción. Revisá tu casilla o pedí un nuevo email desde tu panel.',
        kind: 'denied'
    },
    [ServiceErrorCode.ENTITLEMENT_REQUIRED]: {
        message: 'Tu plan de Hospeda no incluye esta acción.',
        kind: 'denied'
    },
    [ServiceErrorCode.LIMIT_REACHED]: {
        message: 'Llegaste al límite de tu plan para esta acción.',
        kind: 'denied'
    },
    [ServiceErrorCode.QUOTA_EXCEEDED]: RATE_LIMIT_MAPPING,
    RATE_LIMIT_EXCEEDED: RATE_LIMIT_MAPPING,
    [ServiceErrorCode.ALREADY_EXISTS]: {
        message: 'Eso ya existe en Hospeda; no hizo falta crearlo de nuevo.',
        kind: 'error'
    },
    [ServiceErrorCode.SERVICE_UNAVAILABLE]: UNAVAILABLE_MAPPING,
    [ServiceErrorCode.PROVIDER_ERROR]: UNAVAILABLE_MAPPING,
    [ServiceErrorCode.PROVIDER_RATE_LIMITED]: UNAVAILABLE_MAPPING,
    [ServiceErrorCode.PROVIDER_TIMEOUT]: UNAVAILABLE_MAPPING
};

/** Codes treated as invalid input. */
const VALIDATION_CODES: ReadonlySet<ToolErrorCode> = new Set<ToolErrorCode>([
    ServiceErrorCode.VALIDATION_ERROR,
    ServiceErrorCode.INVALID_PAGINATION_PARAMS
]);

/** Upper bound of field details listed, so a huge payload stays readable. */
const MAX_FIELD_DETAILS = 10;

/** One field-level problem. */
interface FieldDetail {
    readonly field: string;
    readonly message: string;
}

/** Narrows to a plain object. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads `[{ path, message }]` (Zod issues). */
function readIssueList(details: unknown): FieldDetail[] {
    if (!Array.isArray(details)) {
        return [];
    }
    return details.flatMap((issue): FieldDetail[] => {
        if (!isRecord(issue) || typeof issue.message !== 'string') {
            return [];
        }
        const path = Array.isArray(issue.path) ? issue.path.map(String).join('.') : '';
        return [{ field: path, message: issue.message }];
    });
}

/** Reads `{ fieldErrors: { field: [messages] } }` (Zod `flatten()`). */
function readFlattened(details: Readonly<Record<string, unknown>>): FieldDetail[] {
    const { fieldErrors } = details;
    if (!isRecord(fieldErrors)) {
        return [];
    }
    return Object.entries(fieldErrors).flatMap(([field, messages]): FieldDetail[] =>
        Array.isArray(messages)
            ? messages
                  .filter((m): m is string => typeof m === 'string')
                  .map((message) => ({ field, message }))
            : []
    );
}

/**
 * Extracts field-level problems from a validation error's `details`. Accepts
 * the shapes service-core and Zod produce: an issue list, a `flatten()`
 * result, `{ issues }`, or `{ field, message? }`. Unknown shapes yield none.
 */
function extractFieldDetails(details: unknown): FieldDetail[] {
    if (Array.isArray(details)) {
        return readIssueList(details);
    }
    if (!isRecord(details)) {
        return [];
    }
    if (Array.isArray(details.issues)) {
        return readIssueList(details.issues);
    }
    const flattened = readFlattened(details);
    if (flattened.length > 0) {
        return flattened;
    }
    if (typeof details.field === 'string') {
        const message = typeof details.message === 'string' ? details.message : 'valor inválido';
        return [{ field: details.field, message }];
    }
    return [];
}

/**
 * Builds the validation message: the base sentence plus up to
 * {@link MAX_FIELD_DETAILS} `campo «x»: problema` entries.
 *
 * @param args - Validation `details`
 * @returns The Spanish message
 */
export function formatValidationMessage({ details }: { readonly details: unknown }): string {
    const fields = extractFieldDetails(details).slice(0, MAX_FIELD_DETAILS);
    if (fields.length === 0) {
        return `${TOOL_VALIDATION_MESSAGE}.`;
    }
    const parts = fields.map(({ field, message }) =>
        field ? `campo «${field}»: ${message}` : message
    );
    return `${TOOL_VALIDATION_MESSAGE}: ${parts.join('; ')}.`;
}

/** Arguments for {@link toToolFailure}. RO-RO. */
export interface ToToolFailureArgs {
    /** The error a handler returned or threw. */
    readonly error: ToolErrorPayload;
    /** The tool's per-reason Spanish messages. */
    readonly reasonMessages?: Readonly<Record<string, string>>;
}

/**
 * Maps a tool error to the failure shown to the user.
 *
 * Precedence: a matching `reasonMessages` entry, then validation (with field
 * details), then the code's mapping, then the generic unexpected message.
 * The payload's `helpTopicId` is kept; the portal `action` is never copied from
 * the payload: only the executor builds it, from a destination (`refusal-action.ts`).
 *
 * @param args - The error and the tool's reason messages
 * @returns The user-facing failure
 *
 * @example
 * ```typescript
 * toToolFailure({ error: { code: ServiceErrorCode.NOT_FOUND, message: 'Accommodation 42 not found' } });
 * // { kind: 'denied', code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE, ... }
 * ```
 */
export function toToolFailure({ error, reasonMessages }: ToToolFailureArgs): ToolFailure {
    const isValidation = VALIDATION_CODES.has(error.code);
    const mapping = CODE_MAPPINGS[error.code];
    const base = {
        code: error.code,
        requiresReauthentication: error.code === ServiceErrorCode.UNAUTHORIZED,
        ...(error.helpTopicId === undefined ? {} : { helpTopicId: error.helpTopicId })
    };

    const reasonMessage =
        error.reason !== undefined && reasonMessages !== undefined
            ? reasonMessages[error.reason]
            : undefined;
    if (reasonMessage !== undefined) {
        return {
            ...base,
            kind: mapping?.kind ?? (isValidation ? 'error' : 'denied'),
            message: reasonMessage,
            unexpected: false
        };
    }

    if (isValidation) {
        return {
            ...base,
            kind: 'error',
            message: formatValidationMessage({ details: error.details }),
            unexpected: false
        };
    }

    if (mapping) {
        return { ...base, kind: mapping.kind, message: mapping.message, unexpected: false };
    }

    return { ...base, kind: 'error', message: TOOL_UNEXPECTED_ERROR_MESSAGE, unexpected: true };
}

/**
 * The failure for a throw that is not a `ServiceError` (a bug, a driver
 * error). Generic by design.
 *
 * @returns The user-facing failure
 */
export function unexpectedToolFailure(): ToolFailure {
    return {
        kind: 'error',
        code: 'UNEXPECTED',
        message: TOOL_UNEXPECTED_ERROR_MESSAGE,
        requiresReauthentication: false,
        unexpected: true
    };
}
