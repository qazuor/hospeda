/**
 * Umami limits guard for every analytics catalog event (HOS-2119, T-017, AC-4).
 *
 * Measured against Umami 3.5.0 in the 2026-11-15 spike (spec HOS-2119 §5.5):
 * - event name: max 50 chars;
 * - property key: max 500 chars;
 * - string property value: max 500 chars (an enum/literal longer than that can
 *   never be sent whole);
 * - numeric property value: stored as numeric(19,4), so |n| >= 1e15 answers
 *   HTTP 400 and the WHOLE event is lost;
 * - there is NO property-count limit (measured), so none is asserted here and
 *   no soft cap of our own is added.
 *
 * Numbers rule: a numeric field is "bounded" only when its Zod schema carries
 * effective bounds with |min| and |max| both below 1e15. `z.number().int()`
 * alone gets the safe-integer bounds (~9e15), which is NOT bounded enough. The
 * set of currently-unbounded numeric fields must equal
 * `REVIEWED_UNBOUNDED_NUMBERS`, so a NEW unbounded number fails this test and
 * the existing ones stay visible. The Umami adapter also guards at runtime
 * (T-018), which is why these reviewed fields (counts, durations, minor-unit
 * amounts) are accepted here.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AnalyticsEventSchemas } from '../src/catalog.js';
import { AnalyticsGlobalPropertiesSchema, AnalyticsPersonPropertiesSchema } from '../src/shared.js';

const MAX_EVENT_NAME_LENGTH = 50;
const MAX_KEY_LENGTH = 500;
const MAX_STRING_VALUE_LENGTH = 500;
const MAX_ABS_NUMBER = 1e15;

/** Reviewed numeric fields that are not bounded below 1e15 (`event.path`). */
const REVIEWED_UNBOUNDED_NUMBERS: readonly string[] = [
    // `<global>` / `<person>` are the shared property schemas (src/shared.ts), not events.
    '<person>.accommodation_count',
    'accommodation_import_completed.prefilled_field_count',
    'admin_whats_new_modal_closed.entry_count',
    'admin_whats_new_modal_shown.entry_count',
    'admin_whats_new_panel_opened.unseen_count',
    'ai_chat_cap_reached.message_count',
    'ai_chat_message_sent.message_count',
    'ai_chat_opened.message_count',
    'ai_chat_response_completed.completion_tokens',
    'ai_chat_response_completed.prompt_tokens',
    'ai_search_failed.error_status',
    'ai_search_fallback_keyword.confidence',
    'ai_search_intent_applied.confidence',
    'ai_search_intent_applied.extracted_slot_count',
    'ai_search_performed.query_length',
    'billing_charge_declined.amount_minor',
    'billing_charge_succeeded.amount_minor',
    'billing_checkout_abandoned.seconds_in_pending',
    'billing_checkout_started.amount_minor',
    'billing_grace_entered.days_of_grace',
    'billing_plan_changed.from_amount_minor',
    'billing_plan_changed.to_amount_minor',
    'billing_subscription_activated.amount_minor',
    'billing_subscription_cancelled.lifetime_days',
    'billing_subscription_recovered.days_in_state',
    'billing_subscription_suspended.days_in_grace',
    'review_submitted.average_rating',
    'search_performed.adult_count',
    'search_performed.child_count',
    'search_performed.filter_count',
    'search_performed.query_length',
    'search_performed.result_count',
    'trial_converted.days_into_trial',
    'trial_converted.days_since_expiry',
    'trial_expired.trial_days',
    'trial_started.trial_days'
];

interface WalkResult {
    readonly keys: string[];
    readonly strings: { path: string; value: string }[];
    readonly unboundedNumbers: string[];
}

type AnyZod = z.ZodType;

/** Minimal view of Zod 4's internal definition used by the walker. */
interface ZodInternals {
    readonly _zod: {
        readonly def: {
            readonly type: string;
            readonly entries?: Record<string, unknown>;
            readonly values?: readonly unknown[];
            readonly options?: readonly AnyZod[];
            readonly element?: AnyZod;
            readonly innerType?: AnyZod;
            readonly in?: AnyZod;
        };
    };
}

function walk(schema: AnyZod, path: string, out: WalkResult): void {
    const def = (schema as unknown as ZodInternals)._zod.def;
    switch (def.type) {
        case 'object': {
            const shape = (schema as unknown as { shape: Record<string, AnyZod> }).shape;
            for (const [key, child] of Object.entries(shape)) {
                out.keys.push(key);
                walk(child, path ? `${path}.${key}` : key, out);
            }
            return;
        }
        case 'enum':
            for (const value of Object.values(def.entries ?? {})) {
                if (typeof value === 'string') out.strings.push({ path, value });
            }
            return;
        case 'literal':
            for (const value of def.values ?? []) {
                if (typeof value === 'string') out.strings.push({ path, value });
            }
            return;
        case 'union':
            for (const option of def.options ?? []) walk(option, path, out);
            return;
        case 'array':
            if (def.element) walk(def.element, path, out);
            return;
        case 'optional':
        case 'nullable':
        case 'default':
        case 'prefault':
        case 'readonly':
        case 'nonoptional':
            if (def.innerType) walk(def.innerType, path, out);
            return;
        case 'pipe':
            if (def.in) walk(def.in, path, out);
            return;
        case 'number': {
            const { minValue, maxValue } = schema as unknown as {
                minValue: number | null;
                maxValue: number | null;
            };
            const bounded =
                minValue !== null &&
                maxValue !== null &&
                Math.abs(minValue) < MAX_ABS_NUMBER &&
                Math.abs(maxValue) < MAX_ABS_NUMBER;
            if (!bounded) out.unboundedNumbers.push(path);
            return;
        }
        case 'string':
        case 'boolean':
        case 'null':
        case 'undefined':
            // Carry no length/number risk we assert on (free strings are bounded at runtime).
            return;
        default:
            throw new Error(
                `Limits walker does not know Zod type "${def.type}" at "${path}". ` +
                    'Teach walk() about it so its numbers/strings are checked.'
            );
    }
}

const events = Object.entries(AnalyticsEventSchemas) as [string, AnyZod][];

function collect(name: string, schema: AnyZod): WalkResult {
    const out: WalkResult = { keys: [], strings: [], unboundedNumbers: [] };
    walk(schema, name, out);
    return out;
}

describe('Umami limits for the analytics catalog', () => {
    it('should have events to check', () => {
        expect(events.length).toBeGreaterThan(0);
    });

    it(`should keep every event name <= ${MAX_EVENT_NAME_LENGTH} chars`, () => {
        const offenders = events
            .map(([name]) => name)
            .filter((name) => name.length > MAX_EVENT_NAME_LENGTH)
            .map((name) => `event "${name}" is ${name.length} chars`);
        expect(offenders, offenders.join('; ')).toEqual([]);
    });

    it(`should keep every property key <= ${MAX_KEY_LENGTH} chars`, () => {
        const offenders: string[] = [];
        for (const [name, schema] of events) {
            for (const key of collect(name, schema).keys) {
                if (key.length > MAX_KEY_LENGTH) {
                    offenders.push(
                        `event "${name}" key "${key.slice(0, 40)}..." is ${key.length} chars`
                    );
                }
            }
        }
        for (const key of Object.keys(AnalyticsGlobalPropertiesSchema.shape)) {
            if (key.length > MAX_KEY_LENGTH)
                offenders.push(`global key "${key}" is ${key.length} chars`);
        }
        expect(offenders, offenders.join('; ')).toEqual([]);
    });

    it(`should keep every enum/literal string value <= ${MAX_STRING_VALUE_LENGTH} chars`, () => {
        const offenders: string[] = [];
        const globals = collect('<global>', AnalyticsGlobalPropertiesSchema);
        const all = [...events.map(([name, schema]) => collect(name, schema)), globals].flatMap(
            (r) => r.strings
        );
        for (const { path, value } of all) {
            if (value.length > MAX_STRING_VALUE_LENGTH) {
                offenders.push(
                    `"${path}" value "${value.slice(0, 40)}..." is ${value.length} chars`
                );
            }
        }
        expect(offenders, offenders.join('; ')).toEqual([]);
    });

    it('should throw on a Zod type the walker does not know', () => {
        const record = z.record(z.string(), z.number());
        expect(() => collect('fake_event', z.object({ bag: record }))).toThrow(
            /"record" at "fake_event.bag"/
        );
    });

    it('should match the reviewed allowlist of numeric fields not bounded below 1e15', () => {
        const actual = [
            ...events.flatMap(([name, schema]) => collect(name, schema).unboundedNumbers),
            ...collect('<global>', AnalyticsGlobalPropertiesSchema).unboundedNumbers,
            ...collect('<person>', AnalyticsPersonPropertiesSchema).unboundedNumbers
        ];
        const unreviewed = actual.filter((p) => !REVIEWED_UNBOUNDED_NUMBERS.includes(p));
        const stale = REVIEWED_UNBOUNDED_NUMBERS.filter((p) => !actual.includes(p));
        expect(
            { unreviewed: [...new Set(unreviewed)].sort(), stale: stale.sort() },
            'unreviewed = new unbounded numbers (|n| >= 1e15 makes Umami 400 the whole event); stale = allowlist entries no longer unbounded'
        ).toEqual({ unreviewed: [], stale: [] });
    });
});
