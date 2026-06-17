/**
 * AI-extraction helpers for the accommodation import route (SPEC-222 T-020).
 *
 * This module holds the *pure* pieces of Strategy B (AI-assisted extraction):
 * the structured-output Zod schema the model must fill, the user-turn prompt
 * builder, and the mapper that converts the model's flat object into the loose
 * {@link RawExtraction} bag the import pipeline consumes.
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
// AI output schema
// ---------------------------------------------------------------------------

/**
 * Flat structured-output schema the AI provider must fill for Strategy B.
 *
 * Every field is optional — the model returns only what is explicitly present
 * in the page text. Values are intentionally loose (strings/numbers); the
 * downstream `mapRawToDraft` step coerces and validates each field against the
 * canonical `AccommodationImportDraftSchema` and drops anything invalid, so
 * this schema does not need to enforce enum membership or formats itself.
 *
 * `type` is a free string here; `mapRawToDraft` validates it against the 13
 * `AccommodationTypeEnum` values and drops it if it does not match.
 */
export const AccommodationImportAiOutputSchema = z.object({
    name: z.string().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    type: z.string().optional(),
    capacity: z.number().optional(),
    bedrooms: z.number().optional(),
    beds: z.number().optional(),
    bathrooms: z.number().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    street: z.string().optional(),
    streetNumber: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    amenityNames: z.array(z.string()).optional(),
    locality: z.string().optional(),
    country: z.string().optional()
});

/** Inferred type for the AI structured output. */
export type AccommodationImportAiOutput = z.infer<typeof AccommodationImportAiOutputSchema>;

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
    return `Extract the structured accommodation data that is explicitly present in the following listing page text. Return only fields you can find; omit anything not clearly stated. Never include guest reviews, ratings, or opinions.\n\nPAGE TEXT:\n${text}`;
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
 * @param response - The pipeline response.
 * @param gate - The AI gate flag mutated by the `aiExtract` port.
 * @returns The response, possibly with an augmented `message`.
 */
export function applyAiGateNotice(
    response: AccommodationImportResponse,
    gate: AiGateState
): AccommodationImportResponse {
    if (gate.blockedReason === null) {
        return response;
    }
    const note = gate.blockedReason === 'quota' ? MSG_AI_QUOTA : MSG_AI_ENTITLEMENT;
    const message = [response.message, note].filter(Boolean).join(' ');
    return { ...response, message };
}
