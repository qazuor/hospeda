import { amenities, features, getDb, rAccommodationAmenity, rAccommodationFeature } from '@repo/db';
import { AccommodationService, type Actor } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { apiLogger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Constants — context size caps
// ---------------------------------------------------------------------------

/**
 * Hard cap on the description length included in the context block.
 * Per-call token spend is bounded by the model's input cap; the
 * 800-char budget keeps a 20-message exchange well under the engine
 * ceiling for the `chat` feature. Truncation is hard (no fuzzy
 * compression) and appends the `TRUNCATION_SUFFIX` marker.
 */
export const CONTEXT_DESCRIPTION_MAX_CHARS = 800;

/** Suffix appended to the truncated description to signal the cut. */
const TRUNCATION_SUFFIX = '…';

/** Maximum FAQs included in the context block (AC-2.2). */
export const CONTEXT_FAQ_MAX = 10;

/** Maximum amenities included in the context block (AC-2.2). */
export const CONTEXT_AMENITY_MAX = 20;

/** Maximum features included in the context block (AC-2.2). */
export const CONTEXT_FEATURE_MAX = 20;

/** Default fallback location suffix (the platform is Argentina-only in V1). */
const LOCATION_SUFFIX = ', Argentina';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Loose shape of an accommodation row + its relations loaded by `getById`. */
export interface AccommodationWithRelations {
    id: string;
    name: string;
    summary: string;
    description: string;
    type: string;
    destinationId: string;
    ownerId: string;
    destination?: { name: string } | null;
    faqs?: Array<{ question: string; answer: string }>;
}

/** Shape of an amenity or feature row used by the context assembler. */
export interface NameOnlyEntity {
    name: string;
}

/** Input contract for {@link assembleAccommodationContext}. */
export interface AssembleAccommodationContextInput {
    readonly actor: Actor;
    readonly accommodationId: string;
    readonly resolvedPrompt: string;
    readonly locale: 'es' | 'en' | 'pt';
}

/** Output contract for {@link assembleAccommodationContext}. */
export interface AssembleAccommodationContextOutput {
    /** The Markdown context block (assembled by {@link buildMarkdownContext}). */
    readonly contextBlock: string;
    /** The full system message (contextBlock + resolvedPrompt + chat instructions). */
    readonly systemMessage: string;
    /** Echo of the accommodation name (for future conversation-title generation). */
    readonly accommodationName: string;
}

// ---------------------------------------------------------------------------
// Pure helper: buildMarkdownContext
// ---------------------------------------------------------------------------

/**
 * Assembles the Markdown context block from pre-loaded accommodation data.
 *
 * PURE — no I/O, no side effects. All inputs are explicit; the function
 * does NOT reach out to the database. The async wrapper
 * ({@link assembleAccommodationContext}) is responsible for loading the
 * relations and any amenities/features not loaded by `getById`.
 *
 * @param accommodation - The accommodation row + `destination` + `faqs` relations.
 * @param faqs         - The accommodation's FAQs (from `getFaqs`).
 * @param amenities    - The accommodation's amenities (Drizzle join result).
 * @param features     - The accommodation's features (Drizzle join result).
 * @returns The Markdown block to be prepended to the system message.
 */
export function buildMarkdownContext(
    accommodation: AccommodationWithRelations,
    faqs: ReadonlyArray<{ question: string; answer: string }>,
    amenities: ReadonlyArray<NameOnlyEntity>,
    features: ReadonlyArray<NameOnlyEntity>
): string {
    const destinationName = accommodation.destination?.name ?? 'Unknown';
    const truncatedDescription = truncate(accommodation.description, CONTEXT_DESCRIPTION_MAX_CHARS);
    const cappedFaqs = faqs.slice(0, CONTEXT_FAQ_MAX);
    const cappedAmenities = amenities.slice(0, CONTEXT_AMENITY_MAX);
    const cappedFeatures = features.slice(0, CONTEXT_FEATURE_MAX);

    const lines: string[] = [
        `## Accommodation: ${accommodation.name}`,
        `**Type**: ${accommodation.type}`,
        `**Location**: ${destinationName}${LOCATION_SUFFIX}`,
        `**Summary**: ${accommodation.summary}`,
        '',
        '### Description',
        truncatedDescription
    ];

    if (cappedAmenities.length > 0) {
        lines.push('', '### Amenities');
        for (const a of cappedAmenities) {
            lines.push(`- ${a.name}`);
        }
    }

    if (cappedFeatures.length > 0) {
        lines.push('', '### Features');
        for (const f of cappedFeatures) {
            lines.push(`- ${f.name}`);
        }
    }

    lines.push(
        '',
        '### Base Pricing',
        'Pricing information is not available in the static context — direct confirmation required.',
        '',
        '### Location Details',
        'Latitude: not available in the static context',
        'Longitude: not available in the static context'
    );

    if (cappedFaqs.length > 0) {
        lines.push('', '### FAQs');
        for (const faq of cappedFaqs) {
            lines.push(`**Q: ${faq.question}**`);
            lines.push(`A: ${faq.answer}`);
            lines.push('');
        }
    }

    return lines.join('\n').trimEnd();
}

/**
 * Truncates `text` to `maxChars` characters, appending the truncation
 * suffix when the cut occurs. Returns the original string when it fits.
 */
function truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
        return text;
    }
    return text.slice(0, maxChars) + TRUNCATION_SUFFIX;
}

// ---------------------------------------------------------------------------
// Pure helper: buildChatSystemMessage
// ---------------------------------------------------------------------------

/**
 * Assembles the full system message: contextBlock + separator + resolvedPrompt
 * + the chat-specific safety instructions.
 *
 * PURE — no I/O. The output is what the model sees on every call. The
 * chat-instructions block is the SINGLE source of the price-disclaimer
 * marker instruction (Q-R5/AC-2.3) and the "unrelated to this specific
 * accommodation" decline phrase (AC-2.3).
 *
 * @param contextBlock   - The Markdown context (from {@link buildMarkdownContext}).
 * @param resolvedPrompt - The prompt resolved by `resolveSystemPrompt({ feature: 'chat' })`.
 * @param locale         - The user's locale (interpolated into the language instruction).
 * @returns The system message to prepend to the messages array sent to the engine.
 */
export function buildChatSystemMessage(
    contextBlock: string,
    resolvedPrompt: string,
    locale: 'es' | 'en' | 'pt'
): string {
    return [
        contextBlock,
        '',
        '---',
        '',
        resolvedPrompt,
        '',
        IMPORTANT_INSTRUCTIONS_PREFIX,
        '- Answer questions ONLY based on the accommodation information provided above.',
        '  If the information is not in the context, say "No tengo esa información disponible."',
        `- You MUST respond in the user's language: locale is "${locale}".`,
        '- If asked about prices or availability, answer from the data above if present,',
        '  then append the exact marker "---price-disclaimer---" on its own line at the',
        '  END of your response. Never append this marker for answers unrelated to price',
        '  or availability.',
        '- For availability/booking confirmation requests you cannot answer from the data,',
        "  redirect the user to contact the accommodation through the platform's messaging",
        '  feature.',
        '- Do NOT invent amenities, features, pricing, or availability data not present in',
        '  the context above. Prefer saying "no tengo esa información" over guessing.',
        '- Politely decline questions unrelated to this specific accommodation.',
        '- Never claim that information provided is real-time or guaranteed.'
    ].join('\n');
}

/**
 * Section header for the chat-instructions block. Exported as a constant
 * so unit tests can assert on the assembled structure if needed.
 */
const IMPORTANT_INSTRUCTIONS_PREFIX = 'IMPORTANT INSTRUCTIONS FOR THIS CONVERSATION:';

// ---------------------------------------------------------------------------
// Async wrapper: assembleAccommodationContext
// ---------------------------------------------------------------------------

/**
 * Loads the accommodation context from the database and assembles the
 * full system message. The function does ALL the I/O; the helpers above
 * are pure.
 *
 * Throws `ServiceError(NOT_FOUND)` when the accommodation does not exist
 * (route catches and returns 404 pre-stream). Logs `apiLogger.warn` for
 * non-fatal failures (FAQs/amenities/features load errors) and continues
 * with empty arrays — the chat request must not fail because of a missing
 * secondary relation.
 *
 * @param input - The actor, accommodation ID, resolved prompt, and locale.
 * @returns The context block, full system message, and the accommodation name.
 */
export async function assembleAccommodationContext(
    input: AssembleAccommodationContextInput
): Promise<AssembleAccommodationContextOutput> {
    const { actor, accommodationId, resolvedPrompt, locale } = input;

    // Lazy construction — no service context needed because we only call the
    // public `getById` + `getFaqs` reads. The route layer already enforces
    // authentication + authorization on the request, so we pass through the
    // actor verbatim.
    const accommodationService = new AccommodationService({} as never);

    // 1. Load the accommodation + base relations (destination/owner/reviews/faqs).
    //    `getById` THROWS `ServiceError(NOT_FOUND, ...)` when the row is missing,
    //    so the resolved value is always a non-null entity. The return type is
    //    declared as `ServiceOutput<TEntity | null>` to satisfy the Result contract,
    //    but the throw-on-null behavior (base.crud.read.ts:155-160) means the cast
    //    is safe. The intermediate `unknown` hop widens the Result<T> shape to
    //    the relation-augmented view we need downstream.
    const accommodation = (await accommodationService.getById(
        actor,
        accommodationId
    )) as unknown as AccommodationWithRelations;

    // 2. Load FAQs via the dedicated method (graceful — non-fatal on error).
    const faqs = await safeLoadFaqs(accommodationService, actor, accommodationId);

    // 3. Load amenities + features via direct Drizzle queries against the
    //    join tables (graceful — non-fatal on error, empty array on failure).
    //    The locale is forwarded so the I18nText `name` field is resolved to
    //    a single string in the user's language (fallback: 'es').
    const [amenitiesList, featuresList] = await Promise.all([
        safeLoadAmenities(accommodationId, locale),
        safeLoadFeatures(accommodationId, locale)
    ]);

    // 4. Assemble.
    const contextBlock = buildMarkdownContext(accommodation, faqs, amenitiesList, featuresList);
    const systemMessage = buildChatSystemMessage(contextBlock, resolvedPrompt, locale);

    return {
        contextBlock,
        systemMessage,
        accommodationName: accommodation.name
    };
}

// ---------------------------------------------------------------------------
// Async helpers (graceful fallbacks)
// ---------------------------------------------------------------------------

/**
 * Loads FAQs for the given accommodation, falling back to `[]` on any
 * error. Logs the failure with `apiLogger.warn` so ops can investigate.
 */
async function safeLoadFaqs(
    service: { getFaqs: (actor: Actor, input: { accommodationId: string }) => Promise<unknown> },
    actor: Actor,
    accommodationId: string
): Promise<Array<{ question: string; answer: string }>> {
    try {
        const result = (await service.getFaqs(actor, { accommodationId })) as {
            faqs?: Array<{ question: string; answer: string }>;
        } | null;
        return result?.faqs ?? [];
    } catch (error) {
        apiLogger.warn(
            { accommodationId, error: error instanceof Error ? error.message : String(error) },
            'accommodation-ai-context: failed to load FAQs; continuing with empty list'
        );
        return [];
    }
}

/**
 * Loads the first 20 amenities for the given accommodation via Drizzle
 * direct. Returns `[]` on any error (graceful — the chat request must
 * not fail because the amenities join is missing or the DB is flaky).
 *
 * The `name` column is `I18nText` (jsonb) and is resolved to a single
 * string in the requested `locale`, falling back to the Spanish
 * translation when the requested locale is missing.
 */
async function safeLoadAmenities(
    accommodationId: string,
    locale: 'es' | 'en' | 'pt'
): Promise<NameOnlyEntity[]> {
    try {
        const db = getDb();
        const rows = await db
            .select({ name: amenities.name })
            .from(rAccommodationAmenity)
            .innerJoin(amenities, eq(rAccommodationAmenity.amenityId, amenities.id))
            .where(eq(rAccommodationAmenity.accommodationId, accommodationId))
            .limit(CONTEXT_AMENITY_MAX);
        return rows.map((r) => ({ name: r.name[locale] ?? r.name.es }));
    } catch (error) {
        apiLogger.warn(
            { accommodationId, error: error instanceof Error ? error.message : String(error) },
            'accommodation-ai-context: failed to load amenities; continuing with empty list'
        );
        return [];
    }
}

/**
 * Loads the first 20 features for the given accommodation via Drizzle
 * direct. Returns `[]` on any error (graceful — same rationale as
 * {@link safeLoadAmenities}). The `name` column is `I18nText` and is
 * resolved to a single string in the requested `locale`, falling back
 * to Spanish when the requested locale is missing.
 */
async function safeLoadFeatures(
    accommodationId: string,
    locale: 'es' | 'en' | 'pt'
): Promise<NameOnlyEntity[]> {
    try {
        const db = getDb();
        const rows = await db
            .select({ name: features.name })
            .from(rAccommodationFeature)
            .innerJoin(features, eq(rAccommodationFeature.featureId, features.id))
            .where(eq(rAccommodationFeature.accommodationId, accommodationId))
            .limit(CONTEXT_FEATURE_MAX);
        return rows.map((r) => ({ name: r.name[locale] ?? r.name.es }));
    } catch (error) {
        apiLogger.warn(
            { accommodationId, error: error instanceof Error ? error.message : String(error) },
            'accommodation-ai-context: failed to load features; continuing with empty list'
        );
        return [];
    }
}
