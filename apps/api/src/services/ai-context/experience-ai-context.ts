/**
 * AI-chat context assembler for EXPERIENCE listings (HOS-400).
 *
 * The excursion counterpart of `accommodation-ai-context.ts`. What a prospective
 * participant asks is not what a guest asks: how long it takes, how demanding it
 * is, where and when it leaves from, what to bring, and what happens if they
 * cancel. Those are the fields this block spends its tokens on.
 *
 * ## The meeting-point split
 *
 * `meetingPoint` (where it is) is `-basico` content. `meetingPointDirections`
 * (how to GET there, and the map that draws it) is gated behind
 * `MANAGE_EXPERIENCE_DIRECTIONS` from `-pro` upward — HOS-1049 drew that line
 * deliberately. This assembler honours its resolved trait state, for the
 * reason the venue assembler gates the carta: today every
 * venue or experience tier granting `AI_CHAT` also grants the directions, and that is a
 * property of the current catalogue rather than a guarantee.
 *
 * @module apps/api/services/ai-context/experience-ai-context
 */

import { experienceFaqs, experiences, getDb } from '@repo/db';
import type { Locale } from '@repo/i18n';
import { type ExperiencePolicies, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger.js';
import {
    buildListingAmenityLines,
    type ListingContextAmenity,
    safeLoadListingAmenities
} from './listing-amenities-context.js';
import {
    experiencePriceUnitLabel,
    experienceTypeLabel,
    formatContextMoney
} from './listing-labels.js';
import { buildListingPoliciesLines } from './listing-policies-context.js';
import { buildOpeningHoursLines } from './opening-hours-context.js';
import {
    buildChatSystemMessage,
    buildFencedFaqLines,
    fenceOwnerValue,
    OWNER_DATA_DELIMITER_END,
    OWNER_DATA_DELIMITER_START,
    OWNER_DATA_DIRECTIVE,
    sanitizeOwnerDelimiters,
    truncateAtWord
} from './owner-data-fence.js';
import type { AssembleChatContextInput, AssembleChatContextOutput } from './types.js';

// ---------------------------------------------------------------------------
// Context size caps
// ---------------------------------------------------------------------------

/**
 * Hard cap on the description length in the context block.
 * Raised from 800 by HOS-2095 — same reasoning as the accommodation cap.
 */
export const EXPERIENCE_DESCRIPTION_MAX_CHARS = 3000;

/** Maximum FAQs included in the context block (raised from 10 by HOS-2095). */
export const EXPERIENCE_CONTEXT_FAQ_MAX = 30;

/**
 * Hard cap on each free-text logistics field (what to bring, requirements,
 * cancellation policy, directions).
 *
 * Smaller than the description budget on purpose: there are four of them, and a
 * verbose cancellation policy must not be able to crowd out the FAQs.
 */
export const EXPERIENCE_LOGISTICS_MAX_CHARS = 400;

/** Hard cap on the experience name and summary (HOS-2095 review). */
const EXPERIENCE_SHORT_TEXT_MAX_CHARS = 300;

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

/** The experience columns this assembler reads. */
export interface ExperienceContextRow {
    readonly id: string;
    readonly name: string;
    readonly summary: string;
    readonly description: string;
    readonly type: string;
    readonly durationMinutes: number | null;
    /** Base price in CENTAVOS (integer), as the column stores it. */
    readonly priceFrom: number | null;
    readonly priceUnit: string | null;
    readonly isPriceOnRequest: boolean | null;
    readonly meetingPoint: string | null;
    /**
     * The directions are an ORDERED LIST of steps, not a paragraph (HOS-1049).
     * Rendered as a numbered list so the model relays them in order rather than
     * flattening "cross the bridge, then turn left" into prose that loses the
     * sequence.
     */
    readonly meetingPointDirections: readonly string[] | null;
    /**
     * What to bring — an ORDERED LIST of items, not a paragraph. Same shape (and
     * same reason) as {@link meetingPointDirections}: a bulleted list survives
     * relaying, a flattened sentence loses items.
     */
    readonly whatToBring: readonly string[] | null;
    /** Requirements — an ORDERED LIST, same shape as {@link whatToBring}. */
    readonly requirements: readonly string[] | null;
    /**
     * House rules (HOS-2060). `cancellation` IS a single free-text paragraph,
     * unlike the two lists above; `privateGroups` is a yes/no.
     */
    readonly policies: ExperiencePolicies | null;
    readonly averageRating: number | null;
    readonly reviewsCount: number | null;
    /**
     * Weekly schedule (`OpeningHoursSchema`). Optional so older callers and
     * tests need not pass it; HOS-2095 added it because the block had no
     * schedule at all and "¿qué días salen?" was unanswerable.
     */
    readonly openingHours?: unknown;
}

/** One FAQ as the context block consumes it. */
export interface ExperienceContextFaq {
    readonly question: string;
    readonly answer: string;
}

// ---------------------------------------------------------------------------
// Pure helper: buildExperienceMarkdownContext
// ---------------------------------------------------------------------------

/**
 * Assembles the Markdown context block from pre-loaded experience data.
 *
 * PURE — no I/O. Every owner-authored value goes through the shared fence.
 *
 * @param experience - The experience row.
 * @param faqs - Its FAQs, capped at {@link EXPERIENCE_CONTEXT_FAQ_MAX}.
 * @param includeDirections - Whether `meetingPoint.directions` is available.
 *   When `false` the directions field is omitted entirely; this function does
 *   not re-check availability, it renders what
 *   the caller decided.
 * @param locale - Page locale for the closed-value labels and money (HOS-2095).
 * @param amenities - The experience's amenities (HOS-2100); omitted means none.
 * @returns The Markdown block to prepend to the system message.
 */
export function buildExperienceMarkdownContext(
    experience: ExperienceContextRow,
    faqs: ReadonlyArray<ExperienceContextFaq>,
    includeDirections: boolean,
    locale: Locale = 'es',
    amenities: ReadonlyArray<ListingContextAmenity> = []
): string {
    const cappedFaqs = faqs.slice(0, EXPERIENCE_CONTEXT_FAQ_MAX);
    const truncatedDescription = truncateAtWord(
        sanitizeOwnerDelimiters(experience.description),
        EXPERIENCE_DESCRIPTION_MAX_CHARS
    );

    // `type` stays unfenced: it is a closed enum, not owner free text. HOS-2095:
    // rendered as its localized label, never the raw enum.
    const lines: string[] = [
        OWNER_DATA_DIRECTIVE,
        '',
        `## Experiencia: ${fenceOwnerValue(truncateAtWord(experience.name, EXPERIENCE_SHORT_TEXT_MAX_CHARS))}`,
        `**Tipo**: ${experienceTypeLabel({ type: experience.type, locale }).label}`,
        `**Resumen**: ${fenceOwnerValue(truncateAtWord(experience.summary, EXPERIENCE_SHORT_TEXT_MAX_CHARS))}`
    ];

    // --- Logistics: the block this vertical exists for ---
    const logistics: string[] = [];
    if (experience.durationMinutes != null) {
        logistics.push(`**Duración**: ${formatDuration(experience.durationMinutes)}`);
    }
    const policies = experience.policies ?? {};
    if (policies.privateGroups != null) {
        logistics.push(`**Grupos privados**: ${policies.privateGroups ? 'sí, los acepta' : 'no'}`);
    }
    if (logistics.length > 0) {
        lines.push('', '### Datos prácticos', ...logistics);
    }

    // --- Pricing ---
    if (experience.isPriceOnRequest) {
        lines.push('', '### Precio', 'El precio se consulta con el prestador.');
    } else if (experience.priceFrom != null) {
        // HOS-2095: `priceFrom` is centavos. It used to be rendered as-is, so the
        // model quoted 100x the real price.
        const amount = formatContextMoney({
            amount: Math.round(experience.priceFrom / 100),
            locale
        }).text;
        const unit = experience.priceUnit
            ? ` ${experiencePriceUnitLabel({ unit: experience.priceUnit, locale }).label}`
            : '';
        lines.push('', '### Precio', `**Desde**: ${amount}${unit}`);
    }

    // --- Opening hours (HOS-2095: real `OpeningHoursSchema` shape) ---
    const hours = buildOpeningHoursLines({ openingHours: experience.openingHours, locale });
    if (hours.lines.length > 0 || hours.notes) {
        lines.push('', '### Horarios');
        for (const line of hours.lines) {
            lines.push(`- ${line}`);
        }
        if (hours.notes) {
            lines.push(
                OWNER_DATA_DELIMITER_START,
                sanitizeOwnerDelimiters(hours.notes),
                OWNER_DATA_DELIMITER_END
            );
        }
        lines.push(
            'Estos horarios son los que cargó el prestador, no información en vivo: pueden haber cambiado.'
        );
    }

    // --- Meeting point (owner free text — fenced) ---
    if (experience.meetingPoint) {
        lines.push(
            '',
            '### Punto de encuentro',
            OWNER_DATA_DELIMITER_START,
            truncateAtWord(
                sanitizeOwnerDelimiters(experience.meetingPoint),
                EXPERIENCE_LOGISTICS_MAX_CHARS
            ),
            OWNER_DATA_DELIMITER_END
        );
        const directions = experience.meetingPointDirections ?? [];
        if (includeDirections && directions.length > 0) {
            lines.push('**Cómo llegar**:', OWNER_DATA_DELIMITER_START);
            directions.forEach((step, index) => {
                lines.push(
                    `${index + 1}. ${truncateAtWord(sanitizeOwnerDelimiters(step), EXPERIENCE_LOGISTICS_MAX_CHARS)}`
                );
            });
            lines.push(OWNER_DATA_DELIMITER_END);
        }
    }

    // --- Ratings ---
    if ((experience.reviewsCount ?? 0) > 0) {
        lines.push(
            '',
            '### Valoración',
            `**Rating promedio**: ${(experience.averageRating ?? 0).toFixed(2)}/5 (${experience.reviewsCount} reseñas)`
        );
    }

    // --- Description (owner free text — fenced) ---
    lines.push(
        '',
        '### Descripción',
        OWNER_DATA_DELIMITER_START,
        truncatedDescription,
        OWNER_DATA_DELIMITER_END
    );

    // --- Requirements / what to bring (owner free text LISTS — fenced) ---
    for (const [heading, items] of [
        ['Requisitos', experience.requirements ?? []],
        ['Qué llevar', experience.whatToBring ?? []]
    ] as const) {
        if (items.length > 0) {
            lines.push('', `### ${heading}`, OWNER_DATA_DELIMITER_START);
            for (const item of items) {
                lines.push(
                    `- ${truncateAtWord(sanitizeOwnerDelimiters(item), EXPERIENCE_LOGISTICS_MAX_CHARS)}`
                );
            }
            lines.push(OWNER_DATA_DELIMITER_END);
        }
    }

    // --- Cancellation policy (a single paragraph, unlike the two lists above) ---
    if (policies.cancellation) {
        lines.push(
            '',
            '### Política de cancelación',
            OWNER_DATA_DELIMITER_START,
            truncateAtWord(
                sanitizeOwnerDelimiters(policies.cancellation),
                EXPERIENCE_LOGISTICS_MAX_CHARS
            ),
            OWNER_DATA_DELIMITER_END
        );
    }

    // --- Amenities (closed catalog values, localized; HOS-2100) ---
    lines.push(...buildListingAmenityLines({ amenities, locale }).lines);

    // --- House rules (closed values; the cancellation paragraph is above) ---
    lines.push(...buildListingPoliciesLines({ policies }).lines);

    // --- FAQs (owner free text — fenced; answers cut and section budgeted, HOS-2095) ---
    lines.push(
        ...buildFencedFaqLines({
            heading: 'Preguntas frecuentes',
            faqs: cappedFaqs,
            questionPrefix: 'P',
            answerPrefix: 'R'
        }).lines
    );

    return lines.join('\n').trimEnd();
}

/**
 * Renders a duration in minutes as a human phrase.
 *
 * The model is told "2 h 30 min" rather than "150": it reads back to the visitor
 * in the shape they asked the question in, and it removes a unit conversion the
 * model could get wrong.
 *
 * @param minutes - Duration in minutes.
 * @returns e.g. `'45 min'`, `'2 h'`, `'2 h 30 min'`.
 */
function formatDuration(minutes: number): string {
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// ---------------------------------------------------------------------------
// Async assembler
// ---------------------------------------------------------------------------

/**
 * Loads an experience's context and assembles the system message.
 *
 * Throws `ServiceError(NOT_FOUND)` when the experience does not exist or is
 * soft-deleted, mapped by the streaming factory to a pre-stream 404. The FAQ read
 * degrades to an empty list with a logged warning.
 *
 * @param input - Actor, entity id, resolved prompt, locale and listing states.
 * @returns The context block, system message and experience name.
 */
export async function assembleExperienceContext(
    input: AssembleChatContextInput
): Promise<AssembleChatContextOutput> {
    const { entityId, resolvedPrompt, locale } = input;
    const db = getDb();

    const rows = await db
        .select({
            id: experiences.id,
            name: experiences.name,
            summary: experiences.summary,
            description: experiences.description,
            type: experiences.type,
            durationMinutes: experiences.durationMinutes,
            priceFrom: experiences.priceFrom,
            priceUnit: experiences.priceUnit,
            isPriceOnRequest: experiences.isPriceOnRequest,
            meetingPoint: experiences.meetingPoint,
            meetingPointDirections: experiences.meetingPointDirections,
            whatToBring: experiences.whatToBring,
            requirements: experiences.requirements,
            policies: experiences.policies,
            averageRating: experiences.averageRating,
            reviewsCount: experiences.reviewsCount,
            openingHours: experiences.openingHours
        })
        .from(experiences)
        .where(and(eq(experiences.id, entityId), isNull(experiences.deletedAt)))
        .limit(1);

    const experience = rows[0];
    if (!experience) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Experience '${entityId}' not found.`);
    }

    const [faqs, amenities] = await Promise.all([
        safeLoadFaqs(entityId),
        safeLoadListingAmenities({ vertical: 'experience', listingId: entityId })
    ]);

    const contextBlock = buildExperienceMarkdownContext(
        experience,
        faqs,
        input.listingSections.get('meetingPoint')?.traits.get('directions') === 'available',
        locale,
        amenities
    );

    return {
        contextBlock,
        systemMessage: buildChatSystemMessage(contextBlock, resolvedPrompt, locale),
        entityName: experience.name
    };
}

/**
 * Loads the experience's FAQs, ordered as the provider arranged them.
 *
 * Returns `[]` on any error, with a logged warning. Filters by `isUsableByAi`
 * in the WHERE clause — BEFORE {@link EXPERIENCE_CONTEXT_FAQ_MAX}, which is
 * applied by the `.limit()` below it. Filtering after the cap instead would
 * let AI-disabled FAQs starve out FAQs that should reach the prompt (HOS-400,
 * adopting HOS-393 AC-11). A FAQ missing the field (pre-migration data) reads
 * as usable, matching the column's `DEFAULT true`.
 */
async function safeLoadFaqs(experienceId: string): Promise<ExperienceContextFaq[]> {
    try {
        const db = getDb();
        const rows = await db
            .select({ question: experienceFaqs.question, answer: experienceFaqs.answer })
            .from(experienceFaqs)
            .where(
                and(
                    eq(experienceFaqs.experienceId, experienceId),
                    isNull(experienceFaqs.deletedAt),
                    eq(experienceFaqs.lifecycleState, 'ACTIVE'),
                    eq(experienceFaqs.isUsableByAi, true)
                )
            )
            .orderBy(asc(experienceFaqs.displayOrder))
            .limit(EXPERIENCE_CONTEXT_FAQ_MAX);
        return rows;
    } catch (error) {
        apiLogger.warn(
            { experienceId, error: error instanceof Error ? error.message : String(error) },
            'experience-ai-context: failed to load FAQs; continuing with empty list'
        );
        return [];
    }
}
