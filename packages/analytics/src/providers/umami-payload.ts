/**
 * Pure mapper from a sanitized analytics event to an Umami `/api/batch` item
 * (HOS-2119, T-018). No network, no I/O.
 *
 * Rules measured on Umami 3.5.0 (spec HOS-2119 §5.5, §6.2):
 * - `payload.id` (Umami's distinct id) is emitted ONLY for a real user id, so the
 *   event lands in the same per-user session `uuid(…, id)` as that user's browser
 *   (revised 2026-11-17: a claimed anonymous fingerprint session leaked across
 *   accounts on a shared device). Anonymous and system events carry no `id`.
 * - Umami truncates over-limit values silently (HTTP 200) and rejects the WHOLE
 *   event for numbers with `|n| >= 1e15`, so everything is bounded here.
 */
import { isbot } from 'isbot';
import { z } from 'zod';

/** Umami runtime limits (measured). Values above them are cut or reject the event. */
export const UMAMI_LIMITS = {
    /** Max event name length. */
    eventName: 50,
    /** Max string value length. */
    stringValue: 500,
    /** Max data key length. */
    dataKey: 500,
    /** Max url length. */
    url: 500,
    /** Max distinct id length (Umami `payload.id`). */
    distinctId: 50,
    /** Max hostname length. */
    hostname: 100,
    /** Numbers with an absolute value at or above this reject the whole event. */
    maxAbsNumber: 1e15,
    /** Decimal places kept by `numeric(19,4)`. */
    decimals: 4
} as const;

/** IP of the synthetic visitor used by events with no visitor request. */
export const UMAMI_SYNTHETIC_IP = '127.0.0.1';

/**
 * Plain desktop Chrome User-Agent of the synthetic visitor. Umami filters bots
 * with `isbot` and drops those events with HTTP 200, so this string must carry
 * NO product suffix (a trailing `HospedaServer/1.0` matched `Server`) and none
 * of curl/node/api/bot/crawler markers.
 */
export const UMAMI_SYNTHETIC_USER_AGENT =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/**
 * Whether Umami would silently drop an event carrying this User-Agent (HTTP 200,
 * nothing stored). Umami 3.5.0 filters with `isbot` and has no extra rule: the
 * "api" substring in the spike doc is an `isbot` match, not a separate check.
 * Using the same detector at runtime (instead of a local regex) keeps real phones
 * such as "CUBOT" or "Rapido" on their own session. A visitor UA matching this is
 * replaced by {@link UMAMI_SYNTHETIC_USER_AGENT}.
 *
 * @param userAgent - Raw visitor User-Agent.
 * @returns `true` when Umami would treat it as a bot.
 */
function isUmamiDroppedUserAgent(userAgent: string): boolean {
    return isbot(userAgent);
}

/** Prefix of anonymous distinct ids, which are never forwarded. */
const ANONYMOUS_DISTINCT_ID_PREFIX = 'anon:';
/** Distinct id used by events with no user, never forwarded. */
const SERVER_DISTINCT_ID = 'api-server';

/** Zod schema of one Umami batch item (`type: 'event'`). */
export const UmamiBatchItemSchema = z.object({
    type: z.literal('event'),
    payload: z.object({
        website: z.string().min(1),
        id: z.string().min(1).max(UMAMI_LIMITS.distinctId).optional(),
        hostname: z.string().min(1).max(UMAMI_LIMITS.hostname),
        url: z.string().min(1).max(UMAMI_LIMITS.url),
        name: z
            .string()
            .min(1)
            .max(UMAMI_LIMITS.eventName)
            .refine((value) => value.trim().length > 0, 'Event name must not be blank'),
        data: z.record(
            z.string().min(1).max(UMAMI_LIMITS.dataKey),
            z.union([z.string().max(UMAMI_LIMITS.stringValue), z.number().finite()])
        ),
        ip: z.string().min(1),
        userAgent: z.string().min(1),
        timestamp: z.number().int().nonnegative().optional()
    })
});

/** An Umami batch item ready to be sent to `POST /api/batch`. */
export type UmamiBatchItem = z.infer<typeof UmamiBatchItemSchema>;

/** Flat Umami event data: dot-joined keys, string or number values. */
export type UmamiEventData = Record<string, string | number>;

/** Result of flattening properties. */
export interface FlattenForUmamiResult {
    /** Flat, limit-respecting data. */
    readonly data: UmamiEventData;
    /** Human-readable notes about anything dropped or truncated. */
    readonly warnings: string[];
}

/** Keys the mapper writes itself; a property with the same name is dropped. */
const RESERVED_KEYS: readonly string[] = ['user_id', 'event_uuid'];
/** Keys that must never become own data keys (prototype pollution hygiene). */
const FORBIDDEN_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

/**
 * Cuts a string to `max` UTF-16 units without leaving a lone high surrogate.
 */
function truncate(input: { value: string; max: number }): string {
    if (input.value.length <= input.max) return input.value;
    let cut = input.value.slice(0, input.max);
    const last = cut.charCodeAt(cut.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
    return cut;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function isBlank(value: string | undefined): boolean {
    return value === undefined || value.trim().length === 0;
}

/** Joins array entries; non-primitive and non-finite entries are dropped with a warning. */
function arrayToString(input: {
    items: readonly unknown[];
    path: string;
    warnings: string[];
}): string {
    const parts: string[] = [];
    for (const item of input.items) {
        if (item === null || item === undefined) continue;
        if (item instanceof Date) {
            if (Number.isNaN(item.getTime())) {
                input.warnings.push(`Dropped invalid Date entry in array "${input.path}"`);
            } else {
                parts.push(item.toISOString());
            }
        } else if (typeof item === 'number' && !Number.isFinite(item)) {
            input.warnings.push(`Dropped non-finite number entry in array "${input.path}"`);
        } else if (
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean'
        ) {
            parts.push(String(item));
        } else {
            input.warnings.push(`Dropped non-primitive entry in array "${input.path}"`);
        }
    }
    return parts.join(',');
}

/**
 * Flattens sanitized properties into Umami event data.
 *
 * Total: a bad property is dropped with a warning and never throws. Nested
 * plain objects become dot keys, arrays become comma-joined strings (only
 * primitive finite entries survive), booleans become `'true'`/`'false'`,
 * null/undefined are dropped, numbers are rounded to 4 decimals (non-finite
 * and `|n| >= 1e15` are dropped), strings and keys are truncated to Umami's
 * limits (never splitting a surrogate pair). Also dropped with a warning:
 * empty keys, invalid Dates, cyclic objects, unsupported value types,
 * prototype-polluting keys and the reserved `user_id`/`event_uuid`. When two
 * properties map to the same key the last one wins, with a warning.
 *
 * @param input.properties - Already sanitized event properties.
 * @returns Flat data plus warnings.
 *
 * @example
 * ```ts
 * flattenForUmami({ properties: { a: { b: true }, roles: ['X', 'Y'] } }).data
 * // { 'a.b': 'true', roles: 'X,Y' }
 * ```
 */
export function flattenForUmami(input: {
    properties: Readonly<Record<string, unknown>>;
}): FlattenForUmamiResult {
    const built: Record<string, string | number> = Object.create(null);
    const warnings: string[] = [];
    const ancestors = new WeakSet<object>();

    const put = (path: string, segment: string, value: unknown, depth: number): void => {
        if (value === null || value === undefined) return;
        if (segment.length === 0) {
            warnings.push(`Dropped property under "${path}": empty key`);
            return;
        }
        if (isPlainObject(value)) {
            if (ancestors.has(value)) {
                warnings.push(`Dropped property "${path}": cyclic reference`);
                return;
            }
            ancestors.add(value);
            for (const [key, child] of Object.entries(value)) {
                put(`${path}.${key}`, key, child, depth + 1);
            }
            ancestors.delete(value);
            return;
        }
        const key = truncate({ value: path, max: UMAMI_LIMITS.dataKey });
        if (key !== path) warnings.push(`Truncated data key "${key.slice(0, 40)}..."`);
        if (FORBIDDEN_KEYS.includes(segment)) {
            warnings.push(`Dropped property "${key.slice(0, 40)}": forbidden key`);
            return;
        }
        if (depth === 0 && RESERVED_KEYS.includes(key)) {
            warnings.push(`Dropped property "${key}": reserved key set by the mapper`);
            return;
        }
        let out: string | number;
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || Math.abs(value) >= UMAMI_LIMITS.maxAbsNumber) {
                warnings.push(`Dropped property "${key}": number out of Umami range`);
                return;
            }
            const factor = 10 ** UMAMI_LIMITS.decimals;
            out = Math.round(value * factor) / factor;
        } else if (typeof value === 'boolean') {
            out = value ? 'true' : 'false';
        } else if (typeof value === 'string') {
            out = value;
        } else if (Array.isArray(value)) {
            out = arrayToString({ items: value, path: key, warnings });
        } else if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) {
                warnings.push(`Dropped property "${key}": invalid Date`);
                return;
            }
            out = value.toISOString();
        } else {
            warnings.push(`Dropped property "${key}": unsupported value type`);
            return;
        }
        if (typeof out === 'string' && out.length > UMAMI_LIMITS.stringValue) {
            warnings.push(`Truncated value of property "${key}"`);
            out = truncate({ value: out, max: UMAMI_LIMITS.stringValue });
        }
        if (key in built) {
            warnings.push(`Key collision on "${key.slice(0, 40)}": last value wins`);
        }
        built[key] = out;
    };

    for (const [key, value] of Object.entries(input.properties)) put(key, key, value, 0);
    // Plain-object copy so consumers (and Zod) never see a null-prototype record.
    return { data: Object.fromEntries(Object.entries(built)), warnings };
}

/** Input of {@link mapToUmamiBatchItem}. */
export interface MapToUmamiBatchItemInput {
    /** Event name (snake_case). */
    readonly event: string;
    /** Properties already sanitized by `prepareAnalyticsEvent`. */
    readonly properties: Readonly<Record<string, unknown>>;
    /** Hospeda distinct id; only a real user id is forwarded, as `data.user_id` and `payload.id`. */
    readonly distinctId?: string;
    /** Dedup uuid, forwarded as `data.event_uuid`. */
    readonly uuid?: string;
    /** Event time: Date, ISO string or epoch milliseconds. */
    readonly timestamp?: Date | string | number;
    /** Umami website id. */
    readonly websiteId: string;
    /** Host of the surface the event describes. */
    readonly hostname: string;
    /** Visitor network identity, so the event joins the browser session. */
    readonly visitor?: { readonly ip: string; readonly userAgent: string };
    /** Page url when known; defaults to the virtual `/_server/<event>`. */
    readonly url?: string;
}

/** Output of {@link mapToUmamiBatchItem}. */
export interface MapToUmamiBatchItemResult {
    /** Item to put in the `/api/batch` array. */
    readonly item: UmamiBatchItem;
    /** Anything dropped or truncated; the client should log it once. */
    readonly warnings: string[];
}

function isRealUserId(distinctId: string | undefined): distinctId is string {
    return (
        distinctId !== undefined &&
        distinctId.length > 0 &&
        distinctId !== SERVER_DISTINCT_ID &&
        !distinctId.startsWith(ANONYMOUS_DISTINCT_ID_PREFIX)
    );
}

/**
 * Maps one sanitized analytics event to a validated Umami batch item.
 *
 * Emits `payload.id` only for a real user id (anonymous and system ids never).
 * See the module docs for the measured rules.
 *
 * @param input - Event, sanitized properties and delivery context.
 * @returns The batch item and any warnings.
 * @throws {ZodError} Only if the event name is empty or whitespace (or, as a caller
 *   configuration bug, `websiteId`/`hostname` is empty). Every bad property,
 *   timestamp, visitor or url degrades with a warning instead.
 *
 * @example
 * ```ts
 * const { item } = mapToUmamiBatchItem({
 *   event: 'sign_up_completed',
 *   properties: { locale: 'es' },
 *   distinctId: 'user-1',
 *   websiteId,
 *   hostname: 'hospeda.com.ar'
 * });
 * ```
 */
export function mapToUmamiBatchItem(input: MapToUmamiBatchItemInput): MapToUmamiBatchItemResult {
    const { data, warnings } = flattenForUmami({ properties: input.properties });
    const userId = isRealUserId(input.distinctId) ? input.distinctId : undefined;
    if (userId !== undefined) {
        data['user_id'] = truncate({ value: input.distinctId, max: UMAMI_LIMITS.stringValue });
    }
    if (input.uuid !== undefined) {
        data['event_uuid'] = truncate({ value: input.uuid, max: UMAMI_LIMITS.stringValue });
    }

    const name = truncate({ value: input.event, max: UMAMI_LIMITS.eventName });
    if (name !== input.event) warnings.push(`Truncated event name "${name}"`);

    let timestamp: number | undefined;
    if (input.timestamp !== undefined) {
        const ms = new Date(input.timestamp).getTime();
        if (Number.isFinite(ms) && ms >= 0) {
            timestamp = Math.floor(ms / 1000);
        } else {
            warnings.push(`Ignored invalid timestamp for event "${name}"`);
        }
    }

    const rawIp = input.visitor?.ip;
    const rawUserAgent = input.visitor?.userAgent;
    const visitorIp = rawIp !== undefined && !isBlank(rawIp) ? rawIp : UMAMI_SYNTHETIC_IP;
    const visitorUserAgent =
        rawUserAgent !== undefined &&
        !isBlank(rawUserAgent) &&
        !isUmamiDroppedUserAgent(rawUserAgent)
            ? rawUserAgent
            : UMAMI_SYNTHETIC_USER_AGENT;

    const item = UmamiBatchItemSchema.parse({
        type: 'event',
        payload: {
            website: input.websiteId,
            ...(userId === undefined
                ? {}
                : { id: truncate({ value: userId, max: UMAMI_LIMITS.distinctId }) }),
            hostname: truncate({ value: input.hostname, max: UMAMI_LIMITS.hostname }),
            url: truncate({
                value:
                    input.url !== undefined && !isBlank(input.url) ? input.url : `/_server/${name}`,
                max: UMAMI_LIMITS.url
            }),
            name,
            data,
            ip: visitorIp,
            userAgent: visitorUserAgent,
            ...(timestamp === undefined ? {} : { timestamp })
        }
    });
    return { item, warnings };
}
