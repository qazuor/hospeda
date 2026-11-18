/**
 * @file ai-activity.ts
 * @description Pure helpers for the assistant history island (HOS-2348, spec
 * HOS-2335 §6.9). Client-safe: no env access and no network.
 *
 * The history lists what the user's AI assistants did on their behalf, read
 * from `GET /api/v1/protected/ai-connections/activity`. The API already
 * projects each row to an allowlist; these helpers turn it into what a row
 * shows, and never surface a raw tool name or error code.
 */

import { McpActivityOutcomeSchema, McpActivityOwnItemSchema } from '@repo/schemas';
import { z } from 'zod';
import { AI_CONNECTIONS_API_PATH } from './ai-assistants';

/** Path of the protected assistant activity list. */
export const AI_ACTIVITY_API_PATH = `${AI_CONNECTIONS_API_PATH}/activity`;

/** Result of a call, as the history filters it. */
export type AiActivityOutcome = z.infer<typeof McpActivityOutcomeSchema>;

/** Every outcome value, in filter order. */
export const AI_ACTIVITY_OUTCOMES: readonly AiActivityOutcome[] = McpActivityOutcomeSchema.options;

/** Input of {@link buildAiActivityUrl}. */
export interface BuildAiActivityUrlParams {
    /** API base URL (trailing slash tolerated). */
    readonly apiUrl: string;
    /** 1-based page. */
    readonly page: number;
    /** The "mostrar también lo que solo miró" toggle (D-12). Off sends nothing: writes only. */
    readonly includeReads: boolean;
    /** Only calls with this result. */
    readonly outcome?: AiActivityOutcome;
}

/**
 * Builds the URL of one page of the history. It never carries a user: the API
 * reads the session.
 *
 * @param params - API base, page, toggle and result filter.
 * @returns The absolute URL.
 *
 * @example
 * ```ts
 * buildAiActivityUrl({ apiUrl: 'https://api.x', page: 2, includeReads: true });
 * // 'https://api.x/api/v1/protected/ai-connections/activity?page=2&includeReads=true'
 * ```
 */
export function buildAiActivityUrl({
    apiUrl,
    page,
    includeReads,
    outcome
}: BuildAiActivityUrlParams): string {
    const query = new URLSearchParams({ page: String(page) });
    if (includeReads) query.set('includeReads', 'true');
    if (outcome !== undefined) query.set('outcome', outcome);
    return `${apiUrl.replace(/\/$/, '')}${AI_ACTIVITY_API_PATH}?${query.toString()}`;
}

/** The outcome of an item: a known one, or `unknown` for a value this web does not know. */
export type AiActivityItemOutcome = AiActivityOutcome | 'unknown';

/** Narrows a recorded outcome to a known one, or `unknown`. */
function toItemOutcome(value: string): AiActivityItemOutcome {
    return AI_ACTIVITY_OUTCOMES.find((outcome) => outcome === value) ?? 'unknown';
}

/**
 * One history item as the API serialises it. The API side is strict
 * (`McpActivityOwnItemSchema`, AC-C46); this side is tolerant on purpose, so a
 * web deployed behind a newer API still renders:
 * - an unknown key, top-level or inside `client` / `target`, is dropped;
 * - an outcome this web does not know reads as `unknown`;
 * - `target.url` is any string here, and `toSafeLink` keeps it only when it
 *   is an absolute http(s) URL.
 * The scalar fields reuse the shared schema, so their rules stay in one place.
 */
const AiActivityItemResponseSchema = z.object({
    id: McpActivityOwnItemSchema.shape.id,
    loggedAt: z.coerce.date(),
    tool: McpActivityOwnItemSchema.shape.tool,
    isWrite: McpActivityOwnItemSchema.shape.isWrite,
    outcome: z.string().transform(toItemOutcome),
    errorCode: McpActivityOwnItemSchema.shape.errorCode,
    step: McpActivityOwnItemSchema.shape.step,
    client: z.object({
        id: z.string().min(1),
        name: z.string().optional()
    }),
    target: z
        .object({
            type: z.string().min(1),
            id: z.string().min(1),
            label: z.string().optional(),
            url: z.string().optional()
        })
        .optional()
});

/** One validated history item. */
export type AiActivityItem = z.infer<typeof AiActivityItemResponseSchema>;

const AiActivityPageResponseSchema = z.object({
    /** Validated one by one in {@link parseAiActivityPage}. */
    items: z.array(z.unknown()),
    pagination: z.object({
        page: z.number().int().min(1),
        totalPages: z.number().int().min(0),
        total: z.number().int().min(0)
    })
});

/** Result of {@link parseAiActivityPage}. */
export type ParseAiActivityPageResult =
    | {
          readonly ok: true;
          readonly items: readonly AiActivityItem[];
          /** Items left out because they did not validate. */
          readonly dropped: number;
          readonly page: number;
          readonly totalPages: number;
      }
    | { readonly ok: false };

/**
 * Validates the body of `GET /protected/ai-connections/activity`. The
 * envelope must be the expected one; each item is validated on its own, and
 * one that does not validate is left out (and counted in `dropped`) instead of
 * failing the whole page.
 *
 * @param params.body - Parsed JSON body (unknown shape).
 * @returns The page, or `{ ok: false }` when the envelope is not the expected one.
 */
export function parseAiActivityPage({
    body
}: {
    readonly body: unknown;
}): ParseAiActivityPageResult {
    if (
        typeof body !== 'object' ||
        body === null ||
        !('success' in body) ||
        body.success !== true
    ) {
        return { ok: false };
    }
    const parsed = AiActivityPageResponseSchema.safeParse('data' in body ? body.data : undefined);
    if (!parsed.success) return { ok: false };
    const items = parsed.data.items.flatMap((raw) => {
        const item = AiActivityItemResponseSchema.safeParse(raw);
        return item.success ? [item.data] : [];
    });
    return {
        ok: true,
        items,
        dropped: parsed.data.items.length - items.length,
        page: parsed.data.pagination.page,
        totalPages: parsed.data.pagination.totalPages
    };
}

/** The step of a two-step call, as the history shows it. */
export type AiActivityStep = 'preview' | 'commit';

/**
 * Normalises the recorded step. `reply_inquiry` rows written before HOS-2247
 * say `send`, later ones `commit`: both are the same confirmed write. Any
 * other value is not shown.
 *
 * @param params.step - The recorded step, if any.
 * @returns The step to show, or `undefined`.
 */
export function normalizeAiActivityStep({
    step
}: {
    readonly step?: string;
}): AiActivityStep | undefined {
    if (step === 'preview') return 'preview';
    if (step === 'commit' || step === 'send') return 'commit';
    return undefined;
}

/** What the result column says. */
export type AiActivityResult = 'done' | 'deniedByHospeda' | 'declinedByYou' | 'error' | 'unknown';

/** Error codes of a confirmation the user declined or cancelled (§5.7). */
const USER_DECLINE_CODES: ReadonlySet<string> = new Set(['USER_DECLINED', 'USER_CANCELLED']);

/**
 * The result of a call: done, refused by Hospeda, declined by the user in the
 * confirmation, failed, or unknown (an outcome this web does not know).
 *
 * @param params.outcome - The recorded outcome.
 * @param params.errorCode - The recorded error code, if any.
 * @returns The result to show.
 */
export function resolveAiActivityResult({
    outcome,
    errorCode
}: {
    readonly outcome: AiActivityItemOutcome;
    readonly errorCode?: string;
}): AiActivityResult {
    if (outcome === 'success') return 'done';
    if (outcome === 'error') return 'error';
    if (outcome === 'unknown') return 'unknown';
    return errorCode !== undefined && USER_DECLINE_CODES.has(errorCode)
        ? 'declinedByYou'
        : 'deniedByHospeda';
}

/** Target types that are listings (labelled with their name while owned). */
const LISTING_TARGET_TYPES: ReadonlySet<string> = new Set(['accommodation', 'venue', 'experience']);

/** What the target column shows. */
export type AiActivityTargetView =
    | { readonly kind: 'listing'; readonly label: string; readonly url?: string }
    | { readonly kind: 'listingUnavailable' }
    | { readonly kind: 'conversation'; readonly url?: string };

/**
 * Keeps a link only when it is an absolute http(s) URL. The API builds it
 * from the site URL; this is defence in depth, never trust.
 */
function toSafeLink(url: string | undefined): string | undefined {
    if (url === undefined) return undefined;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:'
            ? parsed.href
            : undefined;
    } catch {
        return undefined;
    }
}

/**
 * The target of an item. A listing the user still owns shows its name (and
 * its editor link); one they lost or that was deleted comes without a label
 * and shows neither name nor link (AC-C47). A conversation always reads
 * "Consulta de huésped", with the inquiry link only while it is theirs. Other targets
 * show nothing.
 *
 * @param params.target - The item's target, if any.
 * @returns What to show, or `undefined`.
 */
export function resolveAiActivityTarget({
    target
}: {
    readonly target?: AiActivityItem['target'];
}): AiActivityTargetView | undefined {
    if (target === undefined) return undefined;
    if (target.type === 'conversation') {
        const url = toSafeLink(target.url);
        return url === undefined ? { kind: 'conversation' } : { kind: 'conversation', url };
    }
    if (!LISTING_TARGET_TYPES.has(target.type)) return undefined;
    if (target.label === undefined) return { kind: 'listingUnavailable' };
    const url = toSafeLink(target.url);
    return url === undefined
        ? { kind: 'listing', label: target.label }
        : { kind: 'listing', label: target.label, url };
}
