/**
 * AI-extraction helpers for the accommodation import route (SPEC-222 T-020).
 *
 * This module holds the *pure* pieces of Strategy B (AI-assisted extraction):
 * the structured-output Zod schema the model must fill (strict: every field
 * required and nullable, HOS-2250), the `null`-to-absent normalizer, the
 * downstream parse schema, the user-turn prompt builder, and the mapper that
 * converts the model's flat object into the loose {@link RawExtraction} bag the
 * import pipeline consumes.
 *
 * Keeping these here (separate from the route wiring) keeps the route file thin
 * and lets the unit/integration tests (T-021) assert on the prompt and the
 * mapping in isolation, without standing up the full Hono route.
 *
 * **Hard rule (SPEC-222)**: the output schema deliberately omits every
 * review/rating-shaped field. The model is also instructed (via the engine's
 * `accommodation_import` guardrail prompt) never to emit reviews or ratings.
 * Image URLs are intentionally NOT requested from the model — those are sourced
 * from the structured extractors only, to avoid hallucinated links.
 *
 * @module apps/api/routes/accommodation/protected/import-from-url.ai
 */

import type { AccommodationImportResponse } from '@repo/schemas';
import type { RawExtraction } from '@repo/service-core';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// AI output schemas
// ---------------------------------------------------------------------------

/**
 * The fields the model may fill for Strategy B, each with its loose value type.
 *
 * This is the single source of both schemas below: the model-facing one (every
 * field required and nullable, for OpenAI strict structured outputs) and the
 * downstream parse (every field optional). Values are intentionally loose
 * (strings/numbers); the downstream `mapRawToDraft` step coerces and validates
 * each field against the canonical `AccommodationImportDraftSchema` and drops
 * anything invalid, so neither schema enforces enum membership or formats.
 *
 * `type` is a free string here; `mapRawToDraft` validates it against the 13
 * `AccommodationTypeEnum` values and drops it if it does not match.
 *
 * Keep every entry free of `.optional()`, `.default()`, refinements, formats,
 * unions and records: strict mode rejects or ignores them (HOS-2250). The
 * strict-shape test converts the model-facing schema with the AI SDK and fails
 * if an object level is missing a `required` key or `additionalProperties: false`.
 */
const AI_OUTPUT_FIELDS = {
    name: z.string(),
    summary: z.string(),
    description: z.string(),
    type: z.string(),
    capacity: z.number(),
    bedrooms: z.number(),
    beds: z.number(),
    bathrooms: z.number(),
    latitude: z.number(),
    longitude: z.number(),
    street: z.string(),
    streetNumber: z.string(),
    price: z.number(),
    currency: z.string(),
    phone: z.string(),
    website: z.string(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    amenityNames: z.array(z.string()),
    locality: z.string(),
    country: z.string()
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
 * Schema SENT to the model (`generateObject`) for Strategy B (HOS-2250).
 *
 * Every field is required and nullable, the only shape OpenAI structured
 * outputs accept in strict mode. Strict mode is what stops the model from
 * renaming keys (`maxGuests` for `capacity`, `amenities` for `amenityNames`,
 * `pricePerNight` for `price`, `address` for `street`): without it the parse
 * below silently dropped those keys and the import lost the data. The model
 * answers `null` for anything not on the page; {@link nullFieldsToUndefined}
 * turns that into an absent field before {@link AccommodationImportAiOutputSchema}.
 */
export const AccommodationImportAiModelOutputSchema = z.object(
    toNullableShape({ shape: AI_OUTPUT_FIELDS }).shape
);

/** Inferred type of the model-facing output (every field present, `null` when unknown). */
export type AccommodationImportAiModelOutput = z.infer<
    typeof AccommodationImportAiModelOutputSchema
>;

/**
 * Downstream parse of the model's answer, after {@link nullFieldsToUndefined}.
 *
 * Every field is optional: the pipeline treats a missing field as "not found".
 * The AI SDK has already validated the answer against
 * {@link AccommodationImportAiModelOutputSchema}; this parse keeps the route's
 * own contract (and tolerates a provider that omits a key instead of sending
 * `null`).
 */
export const AccommodationImportAiOutputSchema = z.object(AI_OUTPUT_FIELDS).partial();

/** Inferred type for the parsed AI output (absent when not found). */
export type AccommodationImportAiOutput = z.infer<typeof AccommodationImportAiOutputSchema>;

/**
 * Turns the strict model answer back into the "absent when unknown" shape the
 * import pipeline has always consumed: every object key whose value is `null`
 * is dropped, recursively (nested objects, and objects inside arrays). Every
 * other value is kept as is, including `0`, `''`, `false` and empty arrays, so
 * the pipeline sees real values exactly as before. Array items that are `null`
 * are kept (dropping them would shift positions); the downstream parse rejects
 * them.
 *
 * @param input.value - The raw object the model returned.
 * @returns `{ value }`, a new value with the `null` fields removed.
 */
export function nullFieldsToUndefined(input: { readonly value: unknown }): {
    readonly value: unknown;
} {
    const strip = (node: unknown): unknown => {
        if (Array.isArray(node)) return node.map(strip);
        if (typeof node !== 'object' || node === null) return node;
        const kept = Object.entries(node)
            .filter(([, child]) => child !== null)
            .map(([key, child]) => [key, strip(child)] as const);
        return Object.fromEntries(kept);
    };
    return { value: strip(input.value) };
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Builds the user turn sent to the `accommodation_import` AI capability.
 *
 * The system prompt and guardrails (extract-only, no reviews/ratings, JSON-only)
 * are owned by the engine and resolved from `DEFAULT_PROMPTS['accommodation_import']`
 * before the provider call. This function only supplies the page text to analyse.
 *
 * @param text - The stripped, length-capped plain text of the listing page.
 * @returns The user turn string for the AI provider.
 */
export function buildImportAiPrompt(text: string): string {
    return `Extract the structured accommodation data that is explicitly present in the following listing page text. Set every field you cannot find to null; never guess a value. Never include guest reviews, ratings, or opinions.\n\nPAGE TEXT:\n${text}`;
}

// ---------------------------------------------------------------------------
// Mapper: AI output -> RawExtraction
// ---------------------------------------------------------------------------

/**
 * Converts the flat AI output object into a {@link RawExtraction} with every
 * candidate field tagged `source: 'ai'` and `sourcePlatform: 'generic'`.
 *
 * Nested groups (location/price/contactInfo/extraInfo/seo) are emitted only
 * when at least one of their sub-fields is present. The coordinates value
 * mirrors the structured extractors' `{ lat, long }` shape so `mapRawToDraft`
 * handles AI and structured coordinates identically.
 *
 * @param o - The validated AI output object.
 * @returns A `RawExtraction` ready to be merged into the structured gaps.
 */
export function mapAiOutputToRawExtraction(o: AccommodationImportAiOutput): RawExtraction {
    const ai = <T>(value: T | undefined) =>
        value === undefined ? undefined : { value, source: 'ai' as const };

    const coordinates =
        o.latitude !== undefined && o.longitude !== undefined
            ? { value: { lat: o.latitude, long: o.longitude }, source: 'ai' as const }
            : undefined;

    const street = ai(o.street);
    const number = ai(o.streetNumber);
    const location =
        coordinates !== undefined || street !== undefined || number !== undefined
            ? { coordinates, street, number }
            : undefined;

    const price = ai(o.price);
    const currency = ai(o.currency);
    const priceGroup =
        price !== undefined || currency !== undefined ? { price, currency } : undefined;

    const mobilePhone = ai(o.phone);
    const website = ai(o.website);
    const contactInfo =
        mobilePhone !== undefined || website !== undefined ? { mobilePhone, website } : undefined;

    const capacity = ai(o.capacity);
    const bedrooms = ai(o.bedrooms);
    const beds = ai(o.beds);
    const bathrooms = ai(o.bathrooms);
    const extraInfo =
        capacity !== undefined ||
        bedrooms !== undefined ||
        beds !== undefined ||
        bathrooms !== undefined
            ? { capacity, bedrooms, beds, bathrooms }
            : undefined;

    const seoTitle = ai(o.seoTitle);
    const seoDescription = ai(o.seoDescription);
    const seo =
        seoTitle !== undefined || seoDescription !== undefined
            ? { title: seoTitle, description: seoDescription }
            : undefined;

    return {
        sourcePlatform: 'generic',
        ...(ai(o.name) !== undefined && { name: ai(o.name) }),
        ...(ai(o.summary) !== undefined && { summary: ai(o.summary) }),
        ...(ai(o.description) !== undefined && { description: ai(o.description) }),
        ...(ai(o.type) !== undefined && { type: ai(o.type) }),
        ...(location !== undefined && { location }),
        ...(priceGroup !== undefined && { price: priceGroup }),
        ...(contactInfo !== undefined && { contactInfo }),
        ...(extraInfo !== undefined && { extraInfo }),
        ...(seo !== undefined && { seo }),
        ...(o.amenityNames !== undefined &&
            o.amenityNames.length > 0 && { amenityNames: o.amenityNames }),
        ...(o.locality !== undefined && { scrapedLocality: o.locality }),
        ...(o.country !== undefined && { scrapedCountry: o.country })
    };
}

// ---------------------------------------------------------------------------
// AI gate state + user-facing notice
// ---------------------------------------------------------------------------

/** Notice appended when AI extraction was skipped because the plan lacks it. */
export const MSG_AI_ENTITLEMENT =
    'La extracción asistida por IA no está incluida en tu plan, así que solo completamos los datos disponibles sin IA. Revisá y completá los campos faltantes.';

/** Notice appended when AI extraction was skipped because the quota is spent. */
export const MSG_AI_QUOTA =
    'Alcanzaste el límite mensual de extracción con IA, así que solo completamos los datos disponibles sin IA. Revisá y completá los campos faltantes.';

/**
 * Mutable flag set by the route's `aiExtract` port when Strategy B was needed
 * but the host's plan/quota blocked it. Read by the handler after the pipeline
 * runs to decide whether to append an informational notice. `null` means either
 * AI was never needed or it ran (or failed for a non-plan reason).
 */
export interface AiGateState {
    blockedReason: 'entitlement' | 'quota' | null;
}

/**
 * Appends an informational notice to the response when Strategy B was needed
 * but the host's plan/quota blocked it.
 *
 * `gate.blockedReason` is set ONLY when `GenericAdapter` actually invoked the
 * `aiExtract` port (i.e. structured extraction was sparse and AI was needed)
 * and the plan/quota blocked it — so when it is non-null the notice is always
 * relevant, regardless of whether the resulting draft is `partial`. (The
 * "partial" flag and the "AI was needed" threshold are different: a draft can
 * have name+summary+type — `partial: false` — yet still have been blocked from
 * AI enrichment of description/amenities/coordinates.)
 *
 * No-op when the response already carries a machine-readable `failureCode`
 * (SPEC-258 C.1): a classified failure leaves `message` undefined on purpose so
 * the client renders the localized failure-mode text, and an AI-gate notice must
 * not overwrite that contract. The collision is rare but reachable (e.g. the
 * generic adapter returns `nothing_found` after the AI port was invoked and the
 * plan/quota blocked it).
 *
 * @param response - The pipeline response.
 * @param gate - The AI gate flag mutated by the `aiExtract` port.
 * @returns The response, possibly with an augmented `message`.
 */
export function applyAiGateNotice(
    response: AccommodationImportResponse,
    gate: AiGateState
): AccommodationImportResponse {
    if (gate.blockedReason === null || response.failureCode !== undefined) {
        return response;
    }
    const note = gate.blockedReason === 'quota' ? MSG_AI_QUOTA : MSG_AI_ENTITLEMENT;
    const message = [response.message, note].filter(Boolean).join(' ');
    return { ...response, message };
}
