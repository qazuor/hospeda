/**
 * @file field-errors.ts
 * @description Pure, framework-agnostic mapping utilities that turn a Zod
 * validation failure or an API 400 error payload into a flat
 * `Record<fieldPath, message>` (HOS-190 slice 2).
 *
 * Consolidates the ad hoc `extractFieldErrors` copy-pasted across
 * `ContactForm.client.tsx`, `ContributionForm.client.tsx`,
 * `CommerceLead.client.tsx` and `PromotionForm.client.tsx` (all four only read
 * `issue.path[0]`, so a nested schema field silently loses its error), plus
 * `parseZodErrors` in `ProfileEditForm.helpers.ts` (same `path[0]`-only
 * limitation, but adds i18n resolution + `{{min}}`/`{{max}}` interpolation).
 *
 * `zodIssuesToFieldErrors` keeps the full dotted path (`contactInfo.mobilePhone`,
 * not just `contactInfo`) so nested schemas map correctly, and keeps the i18n
 * resolution optional so the function stays pure/testable without a `t`.
 *
 * ## The real API 400 shape (HOS-190 slice 2, step 1 investigation)
 *
 * There are TWO distinct shapes a web form can receive on a 400, and they are
 * NOT interchangeable:
 *
 * 1. **Hono/Zod route-level validation** (`createRouter()`'s `defaultHook` in
 *    `apps/api/src/utils/create-app.ts:80-104`) — only fires for routes wired
 *    with the route factory's `requestBody`/`requestParams`/`requestQuery`
 *    option. Body: `{ success: false, error: { code: 'VALIDATION_ERROR',
 *    messageKey, details: TransformedValidationError[], summary,
 *    userFriendlyMessage } }` where each `details[]` entry
 *    (`apps/api/src/utils/zod-error-transformer.ts:243-273`) is
 *    `{ field: string /* dotted path *\/, messageKey: string /* i18n key *\/,
 *    zodMessage, userFriendlyMessage, code, params?, suggestion }`.
 * 2. **`ServiceError` thrown from a handler** (e.g.
 *    `apps/api/src/routes/contact/submit.ts:102-109` manually does
 *    `ContactSubmitSchema.safeParse(rawBody)` and throws
 *    `new ServiceError(ServiceErrorCode.VALIDATION_ERROR, message,
 *    parsed.error.flatten())` on failure) — routed through
 *    `handleRouteError`/`createErrorHandler` in
 *    `apps/api/src/utils/response-helpers.ts`, which matches
 *    `errorResponseSchema` (`apps/api/src/schemas/response-schemas.ts:31-46`):
 *    `{ success: false, error: { code, message, details?, reason? } }`. Crucially,
 *    `details` is gated behind `env.HOSPEDA_API_DEBUG_ERRORS`
 *    (`response-helpers.ts:452`) — and that flag is REQUIRED to be `false` in
 *    production (`apps/api/src/utils/env.ts:161-166` fails validation if it's
 *    `true` outside dev/test). **In production, every `ServiceError`-driven 400
 *    has `details: undefined`.**
 *
 * All four forms studied for this slice (ContactForm/ContributionForm/
 * ChangePasswordForm/ConversationReply) hit routes that throw `ServiceError`
 * (contact) or a manual `.parse()` (change-password) — i.e. shape 2 — and
 * NONE of them attempt to read `error.details` back into field errors; they
 * only ever show `error.message`/`error.code` as a form-level banner via
 * `translateApiError`. That is not an oversight to "fix" here: in production
 * there is usually nothing in `details` to map. `apiErrorToFieldErrors` below
 * still attempts the mapping (defensively, for the routes that DO wire shape
 * 1, or a non-prod debug session), but callers MUST always keep the banner
 * fallback — see `useZodForm.handleApiError`.
 */

import { resolveValidationMessage } from '@repo/i18n/web';
import type { TranslationFn } from '@/lib/api-errors';

/** Flat map of field path (dot-notation, e.g. `contactInfo.mobilePhone`) → message. */
export type FieldErrors = Record<string, string>;

/**
 * Minimal shape of a Zod issue this module reads. Matches both `ZodIssue`
 * (from a live `ZodError`) and the plain-object issues Zod attaches
 * `minimum`/`maximum` to on `too_small`/`too_big` codes.
 */
export interface ZodIssueLike {
    readonly path: ReadonlyArray<PropertyKey>;
    readonly message: string;
    readonly minimum?: number | bigint;
    readonly maximum?: number | bigint;
}

/**
 * Maps Zod validation issues to a flat `FieldErrors` record keyed by the
 * FULL dotted field path (supports nested schemas, e.g.
 * `contactInfo.mobilePhone`, unlike the `path[0]`-only helpers it replaces).
 *
 * When `t` is omitted, each value is the raw `issue.message` — by repo
 * convention (see `@repo/schemas`) this is usually already an i18n key such
 * as `'zodError.contact.firstName.min'`, left untranslated for the caller to
 * resolve (or render as-is in a pinch).
 *
 * When `t` is provided, each message is resolved through
 * `resolveValidationMessage` (mapping `zodError.*`/`validationError.*` keys to
 * `validation.*` translations) with `{{min}}`/`{{max}}` interpolation params
 * extracted from `too_small`/`too_big` issues — the same behavior
 * `parseZodErrors` had, now available for any schema, not just profile-edit.
 *
 * Only the FIRST issue per field is kept (matches prior behavior).
 *
 * @param issues - Issues array from a Zod `safeParse` failure (`result.error.issues`).
 * @param t - Optional translation function (`TranslationFn` — `(key, fallback?, params?) => string`).
 * @returns Flat map of dotted field path → message.
 */
export function zodIssuesToFieldErrors(
    issues: ReadonlyArray<ZodIssueLike>,
    t?: TranslationFn
): FieldErrors {
    const errors: FieldErrors = {};

    for (const issue of issues) {
        const key = issue.path.map(String).join('.');
        if (!key || errors[key]) continue;

        if (!t) {
            errors[key] = issue.message;
            continue;
        }

        const params: Record<string, unknown> = {};
        if (issue.minimum !== undefined) params.min = Number(issue.minimum);
        if (issue.maximum !== undefined) params.max = Number(issue.maximum);

        errors[key] = resolveValidationMessage({
            key: issue.message,
            t: (k, p) => t(k, undefined, p),
            params
        });
    }

    return errors;
}

/** Minimal shape this module reads off a single `error.details[]` entry. */
interface ApiFieldErrorDetail {
    readonly field?: unknown;
    readonly path?: unknown;
    readonly messageKey?: unknown;
    readonly message?: unknown;
}

/** Minimal shape this module reads off an API error payload. */
export interface ApiErrorWithDetails {
    readonly details?: unknown;
}

/**
 * Maps an API error's `details` to a flat `FieldErrors` record, when the API
 * actually sent per-field details (see the module doc for when it does and
 * does not — in production, most `ServiceError`-driven 400s will NOT).
 *
 * Defensively accepts either the route-factory `defaultHook` shape
 * (`{ field, messageKey }`, dotted-string `field`) or a generic Zod-issue-like
 * shape (`{ path, message }`, array `path`). Any entry missing a resolvable
 * field or message is skipped; a non-array/absent `details` returns `{}`.
 *
 * Returning `{}` is the expected common case — callers MUST treat an empty
 * result as "no field-level errors available" and fall back to a form-level
 * banner (e.g. via `translateApiError`), never as "the request was fine".
 *
 * @param apiError - The API error payload (or `null`/`undefined`).
 * @returns Flat map of dotted field path → message; `{}` when no per-field details exist.
 */
export function apiErrorToFieldErrors(
    apiError: ApiErrorWithDetails | null | undefined
): FieldErrors {
    const errors: FieldErrors = {};
    const details = apiError?.details;

    if (!Array.isArray(details)) {
        return errors;
    }

    for (const raw of details) {
        if (!raw || typeof raw !== 'object') continue;
        const detail = raw as ApiFieldErrorDetail;

        const field =
            typeof detail.field === 'string'
                ? detail.field
                : Array.isArray(detail.path)
                  ? detail.path.map(String).join('.')
                  : undefined;

        const message =
            typeof detail.messageKey === 'string'
                ? detail.messageKey
                : typeof detail.message === 'string'
                  ? detail.message
                  : undefined;

        if (field && message && !errors[field]) {
            errors[field] = message;
        }
    }

    return errors;
}
