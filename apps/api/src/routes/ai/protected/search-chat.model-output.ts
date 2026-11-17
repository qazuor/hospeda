/**
 * Model-facing output schema and normalizer for the conversational AI search
 * intent extraction (HOS-2294).
 *
 * The `search` feature used to run WITHOUT OpenAI strict structured outputs,
 * because {@link SearchIntentOutputSchema} has optional and defaulted fields.
 * Without strict mode the model may rename a key (`guests` for `minGuests`) and
 * the lenient downstream parse silently drops it, so the filter is lost with no
 * error. HOS-2250 fixed the same defect for `accommodation_import`; this module
 * applies the same pattern to search:
 *
 * 1. {@link SearchIntentModelOutputSchema} is what `generateObject` is given.
 *    Every field is required and nullable, with no `.default()`, `.uuid()`,
 *    `.int()` or `min`/`max`, the only shape strict mode accepts. Strict mode
 *    pins the key names, so a renamed key can no longer reach the parse.
 * 2. {@link normalizeSearchModelOutput} turns the answer back into the
 *    "absent when unknown" shape the handler has always consumed and validates
 *    it against the canonical {@link SearchIntentEntitiesSchema}.
 *
 * **Invalid values never fail the whole search** (HOS-207: a schema that
 * rejected `radius: 0` 500'd the NL search for most queries). The model-facing
 * schema carries NO ranges, so the AI SDK cannot throw on an out-of-range
 * number. Ranges and formats are enforced afterwards, field by field, by the
 * canonical schema. A field that fails is dropped (and reported in
 * `droppedFields`); every other field survives. Before this module one bad
 * field made the bag parse fail and ALL filters were replaced by `{}`.
 *
 * @module apps/api/routes/ai/protected/search-chat.model-output
 */

import type { SearchIntentEntities } from '@repo/schemas';
import { SearchIntentEntitiesSchema } from '@repo/schemas';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Model-facing schema
// ---------------------------------------------------------------------------

/**
 * The entity slots the model may fill, each with its loose provider-side type.
 *
 * Keys MUST equal the keys of {@link SearchIntentEntitiesSchema}; a guard test
 * fails on drift in either direction. Enums are kept because strict mode
 * constrains decoding to them, so the model cannot emit an invalid member.
 * Everything else is a plain `string` / `number` / `boolean` / `string[]`: the
 * canonical schema owns ranges, UUID and integer checks.
 */
const AI_ENTITY_FIELDS = {
    locationType: SearchIntentEntitiesSchema.shape.locationType.unwrap(),
    city: z.string(),
    destinationId: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    radius: z.number(),
    expandToNearby: z.boolean(),
    accommodationType: SearchIntentEntitiesSchema.shape.accommodationType.unwrap(),
    minGuests: z.number(),
    maxGuests: z.number(),
    minBedrooms: z.number(),
    maxBedrooms: z.number(),
    minBathrooms: z.number(),
    maxBathrooms: z.number(),
    minPrice: z.number(),
    maxPrice: z.number(),
    currency: SearchIntentEntitiesSchema.shape.currency.unwrap(),
    minRating: z.number(),
    maxRating: z.number(),
    hasPool: z.boolean(),
    hasWifi: z.boolean(),
    allowsPets: z.boolean(),
    hasParking: z.boolean(),
    amenitySlugs: z.array(z.string()),
    featureSlugs: z.array(z.string()),
    attractionSlugs: z.array(z.string()),
    poiSlugs: z.array(z.string()),
    checkIn: z.string(),
    checkOut: z.string()
} as const;

/** A Zod shape whose every field is wrapped in `.nullable()`. */
type NullableShape<S extends Readonly<Record<string, z.ZodType>>> = {
    readonly [K in keyof S]: z.ZodNullable<S[K]>;
};

/**
 * Wraps every field of a Zod shape in `.nullable()`, keeping it required.
 *
 * @param input.shape - The source shape.
 * @returns `{ shape }` with every field `T | null`.
 */
function toNullableShape<S extends Readonly<Record<string, z.ZodType>>>(input: {
    readonly shape: S;
}): { readonly shape: NullableShape<S> } {
    const entries = Object.entries(input.shape).map(([key, field]) => [key, field.nullable()]);
    return { shape: Object.fromEntries(entries) as NullableShape<S> };
}

/**
 * Schema SENT to the model (`generateObject`) for the search intent
 * extraction (HOS-2294). Every field, at every level, is required and
 * nullable. The model answers `null` for any slot the query does not state.
 *
 * `confidence` and `isNewSearch` are nullable too: `null` confidence is read
 * as `0` (forces the keyword fallback, as the old `.default(0)` did) and `null`
 * `isNewSearch` stays "the model said nothing" (the three-state contract of
 * {@link SearchIntentOutputSchema}).
 */
export const SearchIntentModelOutputSchema = z.object({
    confidence: z.number().nullable(),
    isNewSearch: z.boolean().nullable(),
    entities: z.object(toNullableShape({ shape: AI_ENTITY_FIELDS }).shape)
});

/** Inferred type of the model-facing output (every field present, `null` when unknown). */
export type SearchIntentModelOutput = z.infer<typeof SearchIntentModelOutputSchema>;

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

/** Result of {@link normalizeSearchModelOutput}. */
export interface NormalizedSearchModelOutput {
    /** Self-assessed confidence clamped to [0, 1]; `0` when missing or not a finite number. */
    readonly confidence: number;
    /** The model's refine-vs-new answer; `undefined` when it said nothing (`null`/missing). */
    readonly isNewSearch: boolean | undefined;
    /** Entity slots that passed the canonical schema, `null` slots removed. */
    readonly entities: SearchIntentEntities;
    /** Slot names the canonical schema rejected (out of range, bad UUID, wrong type) and unknown keys. */
    readonly droppedFields: readonly string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Turns the strict model answer back into the entity bag the search handler
 * consumes, per field decision (never all-or-nothing):
 *
 * - `null` slot: absent (same as the model omitting it before strict mode).
 * - Slot valid against the canonical schema: kept verbatim, including `0`,
 *   `false` and `radius: 0` (a sentinel handled downstream).
 * - Slot invalid (range, UUID, integer, type): dropped and listed in
 *   `droppedFields`. The rest of the search still runs.
 * - Key not in the canonical schema: dropped and listed in `droppedFields`.
 * - `confidence`: clamped to [0, 1]; `null`/missing/non-number becomes `0`.
 * - `isNewSearch`: kept only when boolean, so `undefined` stays distinguishable
 *   from an explicit `false`.
 *
 * @param input.value - The raw object returned by `generateObject`.
 * @returns `{ confidence, isNewSearch, entities, droppedFields }`.
 */
export function normalizeSearchModelOutput(input: {
    readonly value: unknown;
}): NormalizedSearchModelOutput {
    const root = isRecord(input.value) ? input.value : {};

    const rawConfidence = root.confidence;
    const confidence =
        typeof rawConfidence === 'number' && Number.isFinite(rawConfidence)
            ? Math.min(1, Math.max(0, rawConfidence))
            : 0;
    const isNewSearch = typeof root.isNewSearch === 'boolean' ? root.isNewSearch : undefined;

    const rawEntities = isRecord(root.entities) ? root.entities : {};
    const present = Object.entries(rawEntities).filter(
        ([, slot]) => slot !== null && slot !== undefined
    );

    // Fast path: the whole bag is valid.
    const whole = SearchIntentEntitiesSchema.safeParse(Object.fromEntries(present));
    if (whole.success) {
        const known = new Set(Object.keys(SearchIntentEntitiesSchema.shape));
        const unknown = present.map(([key]) => key).filter((key) => !known.has(key));
        return { confidence, isNewSearch, entities: whole.data, droppedFields: unknown };
    }

    // Slow path: keep what is valid, drop what is not.
    const shape: Readonly<Record<string, z.ZodType>> = SearchIntentEntitiesSchema.shape;
    const kept: Record<string, unknown> = {};
    const droppedFields: string[] = [];
    for (const [key, slot] of present) {
        const field = shape[key];
        const parsed = field === undefined ? undefined : field.safeParse(slot);
        if (parsed?.success) {
            kept[key] = parsed.data;
        } else {
            droppedFields.push(key);
        }
    }
    return {
        confidence,
        isNewSearch,
        entities: SearchIntentEntitiesSchema.parse(kept),
        droppedFields
    };
}
