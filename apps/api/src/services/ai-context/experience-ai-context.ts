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
 * deliberately. This assembler honours it from the entitlement set the ROUTE
 * resolved, for the reason the gastronomy assembler gates the carta: today every
 * commerce tier granting `AI_CHAT` also grants the directions, and that is a
 * property of the current catalogue rather than a guarantee.
 *
 * @module apps/api/services/ai-context/experience-ai-context
 */

import { EntitlementKey } from '@repo/billing';
import { experienceFaqs, experiences, getDb } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger.js';
import {
    buildChatSystemMessage,
    fenceOwnerValue,
    OWNER_DATA_DELIMITER_END,
    OWNER_DATA_DELIMITER_START,
    OWNER_DATA_DIRECTIVE,
    sanitizeOwnerDelimiters,
    truncate
} from './owner-data-fence.js';
import type { AssembleChatContextInput, AssembleChatContextOutput } from './types.js';

// ---------------------------------------------------------------------------
// Context size caps
// ---------------------------------------------------------------------------

/** Hard cap on the description length in the context block. */
export const EXPERIENCE_DESCRIPTION_MAX_CHARS = 800;

/** Maximum FAQs included in the context block. */
export const EXPERIENCE_CONTEXT_FAQ_MAX = 10;

/**
 * Hard cap on each free-text logistics field (what to bring, requirements,
 * cancellation policy, directions).
 *
 * Smaller than the description budget on purpose: there are four of them, and a
 * verbose cancellation policy must not be able to crowd out the FAQs.
 */
export const EXPERIENCE_LOGISTICS_MAX_CHARS = 400;

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
    /** The cancellation policy IS a single free-text paragraph, unlike the two above. */
    readonly cancellationPolicy: string | null;
    readonly acceptsPrivateGroups: boolean | null;
    readonly averageRating: number | null;
    readonly reviewsCount: number | null;
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
 * @param includeDirections - Whether the owner's plan grants
 *   `MANAGE_EXPERIENCE_DIRECTIONS`. When `false` the directions field is omitted
 *   entirely; this function does not re-check the entitlement, it renders what
 *   the caller decided.
 * @returns The Markdown block to prepend to the system message.
 */
export function buildExperienceMarkdownContext(
    experience: ExperienceContextRow,
    faqs: ReadonlyArray<ExperienceContextFaq>,
    includeDirections: boolean
): string {
    const cappedFaqs = faqs.slice(0, EXPERIENCE_CONTEXT_FAQ_MAX);
    const truncatedDescription = truncate(
        sanitizeOwnerDelimiters(experience.description),
        EXPERIENCE_DESCRIPTION_MAX_CHARS
    );

    // `type` stays unfenced: it is a closed enum, not owner free text.
    const lines: string[] = [
        OWNER_DATA_DIRECTIVE,
        '',
        `## Experiencia: ${fenceOwnerValue(experience.name)}`,
        `**Tipo**: ${experience.type}`,
        `**Resumen**: ${fenceOwnerValue(experience.summary)}`
    ];

    // --- Logistics: the block this vertical exists for ---
    const logistics: string[] = [];
    if (experience.durationMinutes != null) {
        logistics.push(`**Duración**: ${formatDuration(experience.durationMinutes)}`);
    }
    if (experience.acceptsPrivateGroups != null) {
        logistics.push(
            `**Grupos privados**: ${experience.acceptsPrivateGroups ? 'sí, los acepta' : 'no'}`
        );
    }
    if (logistics.length > 0) {
        lines.push('', '### Datos prácticos', ...logistics);
    }

    // --- Pricing ---
    if (experience.isPriceOnRequest) {
        lines.push('', '### Precio', 'El precio se consulta con el prestador.');
    } else if (experience.priceFrom != null) {
        const unit = experience.priceUnit ? ` ${experience.priceUnit}` : '';
        lines.push('', '### Precio', `**Desde**: $${experience.priceFrom}${unit}`);
    }

    // --- Meeting point (owner free text — fenced) ---
    if (experience.meetingPoint) {
        lines.push(
            '',
            '### Punto de encuentro',
            OWNER_DATA_DELIMITER_START,
            truncate(
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
                    `${index + 1}. ${truncate(sanitizeOwnerDelimiters(step), EXPERIENCE_LOGISTICS_MAX_CHARS)}`
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
                    `- ${truncate(sanitizeOwnerDelimiters(item), EXPERIENCE_LOGISTICS_MAX_CHARS)}`
                );
            }
            lines.push(OWNER_DATA_DELIMITER_END);
        }
    }

    // --- Cancellation policy (a single paragraph, unlike the two lists above) ---
    if (experience.cancellationPolicy) {
        lines.push(
            '',
            '### Política de cancelación',
            OWNER_DATA_DELIMITER_START,
            truncate(
                sanitizeOwnerDelimiters(experience.cancellationPolicy),
                EXPERIENCE_LOGISTICS_MAX_CHARS
            ),
            OWNER_DATA_DELIMITER_END
        );
    }

    // --- FAQs (owner free text — fenced) ---
    if (cappedFaqs.length > 0) {
        lines.push('', '### Preguntas frecuentes', OWNER_DATA_DELIMITER_START);
        for (const faq of cappedFaqs) {
            lines.push(`**P: ${sanitizeOwnerDelimiters(faq.question)}**`);
            lines.push(`R: ${sanitizeOwnerDelimiters(faq.answer)}`);
            lines.push('');
        }
        lines.push(OWNER_DATA_DELIMITER_END);
    }

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
 * @param input - Actor, entity id, resolved prompt, locale, owner entitlements.
 * @returns The context block, system message and experience name.
 */
export async function assembleExperienceContext(
    input: AssembleChatContextInput
): Promise<AssembleChatContextOutput> {
    const { entityId, resolvedPrompt, locale, ownerEntitlements } = input;
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
            cancellationPolicy: experiences.cancellationPolicy,
            acceptsPrivateGroups: experiences.acceptsPrivateGroups,
            averageRating: experiences.averageRating,
            reviewsCount: experiences.reviewsCount
        })
        .from(experiences)
        .where(and(eq(experiences.id, entityId), isNull(experiences.deletedAt)))
        .limit(1);

    const experience = rows[0];
    if (!experience) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Experience '${entityId}' not found.`);
    }

    const faqs = await safeLoadFaqs(entityId);

    const contextBlock = buildExperienceMarkdownContext(
        experience,
        faqs,
        ownerEntitlements.has(EntitlementKey.MANAGE_EXPERIENCE_DIRECTIONS)
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
