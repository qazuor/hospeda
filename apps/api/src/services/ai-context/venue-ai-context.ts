/**
 * AI-chat context assembler for VENUE listings (HOS-400, neutralized by HOS-1864).
 *
 * The venue counterpart of `accommodation-ai-context.ts`. A venue is a place to
 * eat or to go out — a restaurant, a café, a bar, a pub or a nightclub — so this
 * assembler carries the fields a visitor asks about: what kind of place it is,
 * when it opens, what is on the carta, what entry costs, the dress code, the
 * minimum age and roughly what it costs.
 *
 * ## What is in here that the accommodation assembler does not have
 *
 * The carta, the menú del día, the venue agenda and the `nightInfo` section are
 * ENTITLEMENT- AND BUSINESS-LINE-GATED content: the public routes withhold them
 * from an owner whose plan does not grant the key, and the service-core readers
 * do not. So this assembler gates them too, from the section availability the
 * route resolved for the listing — never from the venue type or the vertical.
 *
 * Today that gate never fires — every venue or experience tier that grants `AI_CHAT` also
 * grants the carta keys — and it is written anyway, because "today's catalogue
 * happens to bundle them" is not a guarantee. The day the keys are split across
 * tiers differently, an assembler that trusted the coincidence would put paid
 * content inside the prompt of an owner who does not pay for it, invisibly:
 * nobody reads a system prompt.
 *
 * @module apps/api/services/ai-context/venue-ai-context
 */

import { getDb, venueFaqs, venueMenuItems, venueMenuSections, venues } from '@repo/db';
import type { Locale } from '@repo/i18n';
import { ServiceErrorCode, type VenuePolicies } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger.js';
import { formatContextMoney, priceRangeLabel, venueTypeLabel } from './listing-labels.js';
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
import { toVenueNightContext, type VenueNightContext } from './venue-night-context.js';

// ---------------------------------------------------------------------------
// Context size caps
// ---------------------------------------------------------------------------

/**
 * Hard cap on the description length in the context block.
 * Raised from 800 by HOS-2095 — same reasoning as the accommodation cap.
 */
export const VENUE_DESCRIPTION_MAX_CHARS = 3000;

/**
 * Maximum FAQs included in the context block.
 * Raised from 10 by HOS-2095: FAQs are where the owner answers reservation and
 * policy questions the structured fields cannot, so they are the last thing cut.
 */
export const VENUE_CONTEXT_FAQ_MAX = 30;

/**
 * Maximum menu items included, ACROSS all sections.
 *
 * A full carta can run to hundreds of dishes and would crowd out everything
 * else in the block — including the FAQs, which are where an owner answers the
 * questions the structured fields cannot. The cap is applied after ordering by
 * section then display order, so what survives is the top of the carta as the
 * owner arranged it, not an arbitrary slice.
 */
export const VENUE_CONTEXT_MENU_ITEM_MAX = 40;

/** Hard cap on each menu item's description in the context block (160 → 120, HOS-2095 review). */
export const VENUE_MENU_ITEM_DESCRIPTION_MAX_CHARS = 120;

/** Hard cap on a menu item's name and a section's name (HOS-2095 review: were unbounded). */
const VENUE_MENU_NAME_MAX_CHARS = 100;

/** Hard cap on the venue name and summary (HOS-2095 review). */
const VENUE_SHORT_TEXT_MAX_CHARS = 300;

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

/** The venue columns this assembler reads. */
export interface VenueContextRow {
    readonly id: string;
    readonly name: string;
    readonly summary: string;
    readonly description: string;
    readonly type: string;
    readonly priceRange: string | null;
    readonly menuUrl: string | null;
    readonly openingHours: Record<string, unknown> | null;
    readonly averageRating: number | null;
    readonly reviewsCount: number | null;
    /** House rules (HOS-2060); optional so older callers and tests need not pass it. */
    readonly policies?: VenuePolicies | null;
}

/** One FAQ as the context block consumes it. */
export interface VenueContextFaq {
    readonly question: string;
    readonly answer: string;
}

/** One menu item, already joined to its section name. */
export interface VenueContextMenuItem {
    readonly sectionName: string | null;
    readonly name: string;
    readonly description: string | null;
    readonly priceCents: number | null;
    readonly isAvailable: boolean | null;
}

// ---------------------------------------------------------------------------
// Pure helper: buildVenueMarkdownContext
// ---------------------------------------------------------------------------

/**
 * Assembles the Markdown context block from pre-loaded venue data.
 *
 * PURE — no I/O. Every owner-authored value goes through the shared fence.
 *
 * @param venue - The venue row.
 * @param faqs - The venue's FAQs. Capped at {@link VENUE_CONTEXT_FAQ_MAX}.
 * @param menuItems - The carta rows loaded for the listing.
 * @param includeMenu - Whether the menu section is available.
 * @param night - The resolved `nightInfo` section, or `null`/omitted when absent.
 * @param locale - Page locale for the closed-value labels and money (HOS-2095).
 * @returns The Markdown block to prepend to the system message.
 */
export function buildVenueMarkdownContext(
    venue: VenueContextRow,
    faqs: ReadonlyArray<VenueContextFaq>,
    menuItems: ReadonlyArray<VenueContextMenuItem>,
    includeMenu: boolean,
    night?: VenueNightContext | null,
    locale: Locale = 'es'
): string {
    const cappedFaqs = faqs.slice(0, VENUE_CONTEXT_FAQ_MAX);
    const cappedItems = includeMenu ? menuItems.slice(0, VENUE_CONTEXT_MENU_ITEM_MAX) : [];
    const truncatedDescription = truncateAtWord(
        sanitizeOwnerDelimiters(venue.description),
        VENUE_DESCRIPTION_MAX_CHARS
    );

    // The directive is line 1 so it precedes every fence below it. `type` and
    // `priceRange` stay unfenced: both are closed enums, not owner free text.
    // HOS-2095: both render as their localized label, never the raw enum.
    const lines: string[] = [
        OWNER_DATA_DIRECTIVE,
        '',
        `## Local: ${fenceOwnerValue(truncateAtWord(venue.name, VENUE_SHORT_TEXT_MAX_CHARS))}`,
        `**Tipo de local**: ${venueTypeLabel({ type: venue.type, locale }).label}`,
        `**Resumen**: ${fenceOwnerValue(truncateAtWord(venue.summary, VENUE_SHORT_TEXT_MAX_CHARS))}`
    ];

    if (venue.priceRange) {
        lines.push(
            `**Rango de precios**: ${priceRangeLabel({ priceRange: venue.priceRange, locale }).label}`
        );
    }

    // --- Opening hours (HOS-2095: real `OpeningHoursSchema` shape) ---
    const hours = buildOpeningHoursLines({ openingHours: venue.openingHours, locale });
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
            'Estos horarios son los que cargó el local, no información en vivo: pueden haber cambiado.'
        );
    }

    // --- Ratings ---
    if ((venue.reviewsCount ?? 0) > 0) {
        lines.push(
            '',
            '### Valoración',
            `**Rating promedio**: ${(venue.averageRating ?? 0).toFixed(2)}/5 (${venue.reviewsCount} reseñas)`
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

    // --- Carta (owner free text — fenced) ---
    if (cappedItems.length > 0) {
        lines.push('', '### Carta', OWNER_DATA_DELIMITER_START);
        let currentSection: string | null | undefined;
        for (const item of cappedItems) {
            if (item.sectionName !== currentSection) {
                currentSection = item.sectionName;
                lines.push(
                    `#### ${truncateAtWord(sanitizeOwnerDelimiters(currentSection ?? 'Otros'), VENUE_MENU_NAME_MAX_CHARS)}`
                );
            }
            const price =
                item.priceCents == null
                    ? ''
                    : ` — ${formatContextMoney({ amount: Math.round(item.priceCents / 100), locale }).text}`;
            // An unavailable dish is stated as unavailable rather than dropped:
            // "is X on the menu?" and "can I order X tonight?" are different
            // questions, and silently omitting the dish answers the first wrong.
            const availability = item.isAvailable === false ? ' (no disponible)' : '';
            lines.push(
                `**${truncateAtWord(sanitizeOwnerDelimiters(item.name), VENUE_MENU_NAME_MAX_CHARS)}**${price}${availability}`
            );
            if (item.description) {
                lines.push(
                    truncateAtWord(
                        sanitizeOwnerDelimiters(item.description),
                        VENUE_MENU_ITEM_DESCRIPTION_MAX_CHARS
                    )
                );
            }
            lines.push('');
        }
        lines.push(OWNER_DATA_DELIMITER_END);
        lines.push(
            'La carta y los precios son los que el local guardó por última vez, no datos en vivo. Los precios están en pesos argentinos (ARS).'
        );
    } else if (includeMenu && venue.menuUrl) {
        // An available menu may consist only of the external link.
        lines.push(
            '',
            '### Carta',
            `El local publica su carta en: ${fenceOwnerValue(venue.menuUrl)}`
        );
    }

    // --- Night out info (HOS-1864) ---
    // Closed enums, the age and the legal text stay unfenced; only the two
    // owner-authored notes are fenced, like the description above.
    if (night) {
        lines.push('', '### Info para salir');
        if (night.minAge !== null) {
            lines.push(`**Edad mínima**: ${night.minAge}`);
        }
        if (night.legalNotice) {
            lines.push(`**Aviso legal**: ${night.legalNotice}`);
        }
        if (night.entryLabel) {
            lines.push(`**Entrada**: ${night.entryLabel}`);
        }
        if (night.entryPriceFrom !== null) {
            lines.push(
                `**Precio de entrada desde**: ${formatContextMoney({ amount: night.entryPriceFrom, locale }).text}`
            );
        }
        if (night.dressCodeLabel) {
            lines.push(`**Código de vestimenta**: ${night.dressCodeLabel}`);
        }
        if (night.entryNote) {
            lines.push(
                OWNER_DATA_DELIMITER_START,
                sanitizeOwnerDelimiters(night.entryNote),
                OWNER_DATA_DELIMITER_END
            );
        }
        if (night.dressCodeNote) {
            lines.push(
                OWNER_DATA_DELIMITER_START,
                sanitizeOwnerDelimiters(night.dressCodeNote),
                OWNER_DATA_DELIMITER_END
            );
        }
    }

    // --- House rules (closed values only; night keys render with nightInfo) ---
    lines.push(...buildListingPoliciesLines({ policies: venue.policies }).lines);

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

// ---------------------------------------------------------------------------
// Async assembler
// ---------------------------------------------------------------------------

/**
 * Loads a venue listing's context and assembles the system message.
 *
 * Throws `ServiceError(NOT_FOUND)` when the venue does not exist or is
 * soft-deleted, which the streaming route factory maps to a pre-stream 404.
 * Secondary reads (FAQs, carta) degrade to empty lists with a logged warning —
 * a chat request must not fail because one relation is unavailable.
 *
 * @param input - Actor, entity id, resolved prompt, locale and listing states.
 * @returns The context block, system message and venue name.
 */
export async function assembleVenueContext(
    input: AssembleChatContextInput
): Promise<AssembleChatContextOutput> {
    const { entityId, resolvedPrompt, locale } = input;
    const db = getDb();

    const rows = await db
        .select({
            id: venues.id,
            name: venues.name,
            summary: venues.summary,
            description: venues.description,
            type: venues.type,
            priceRange: venues.priceRange,
            menuUrl: venues.menuUrl,
            openingHours: venues.openingHours,
            averageRating: venues.averageRating,
            reviewsCount: venues.reviewsCount,
            entryKind: venues.entryKind,
            entryNoteI18n: venues.entryNoteI18n,
            entryPriceFrom: venues.entryPriceFrom,
            policies: venues.policies
        })
        .from(venues)
        .where(and(eq(venues.id, entityId), isNull(venues.deletedAt)))
        .limit(1);

    const venue = rows[0];
    if (!venue) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Venue '${entityId}' not found.`);
    }

    const [faqs, menuItems] = await Promise.all([
        safeLoadFaqs(entityId),
        safeLoadMenuItems(entityId)
    ]);

    // Availability comes from the section map, never from the venue type or the
    // business lines (G-FAC-03, G-FAC-05). `nightInfo` may be `absent` for a
    // food-only line or `locked` by an entitlement; both resolve to `null`.
    const night = toVenueNightContext({
        row: venue,
        available: input.listingSections.get('nightInfo')?.state === 'available',
        locale
    });

    const contextBlock = buildVenueMarkdownContext(
        venue,
        faqs,
        menuItems,
        input.listingSections.get('menu')?.state === 'available',
        night,
        locale
    );

    return {
        contextBlock,
        systemMessage: buildChatSystemMessage(contextBlock, resolvedPrompt, locale),
        entityName: venue.name
    };
}

/**
 * Loads the venue's FAQs, ordered as the owner arranged them.
 *
 * Returns `[]` on any error, with a logged warning. Filters by `isUsableByAi`
 * in the WHERE clause — BEFORE {@link VENUE_CONTEXT_FAQ_MAX}, which is
 * applied by the `.limit()` below it. Filtering after the cap instead would
 * let AI-disabled FAQs starve out FAQs that should reach the prompt (HOS-400,
 * adopting HOS-393 AC-11). A FAQ missing the field (pre-migration data) reads
 * as usable, matching the column's `DEFAULT true`.
 */
async function safeLoadFaqs(venueId: string): Promise<VenueContextFaq[]> {
    try {
        const db = getDb();
        const rows = await db
            .select({ question: venueFaqs.question, answer: venueFaqs.answer })
            .from(venueFaqs)
            .where(
                and(
                    eq(venueFaqs.venueId, venueId),
                    isNull(venueFaqs.deletedAt),
                    eq(venueFaqs.lifecycleState, 'ACTIVE'),
                    eq(venueFaqs.isUsableByAi, true)
                )
            )
            .orderBy(asc(venueFaqs.displayOrder))
            .limit(VENUE_CONTEXT_FAQ_MAX);
        return rows;
    } catch (error) {
        apiLogger.warn(
            { venueId, error: error instanceof Error ? error.message : String(error) },
            'venue-ai-context: failed to load FAQs; continuing with empty list'
        );
        return [];
    }
}

/**
 * Loads the carta, ordered by section then item display order.
 *
 * Returns `[]` on any error, with a logged warning — the same graceful contract
 * the accommodation assembler applies to its secondary relations.
 */
async function safeLoadMenuItems(venueId: string): Promise<VenueContextMenuItem[]> {
    try {
        const db = getDb();
        const rows = await db
            .select({
                sectionName: venueMenuSections.name,
                name: venueMenuItems.name,
                description: venueMenuItems.description,
                priceCents: venueMenuItems.priceCents,
                isAvailable: venueMenuItems.isAvailable
            })
            .from(venueMenuItems)
            .leftJoin(venueMenuSections, eq(venueMenuItems.sectionId, venueMenuSections.id))
            .where(eq(venueMenuItems.venueId, venueId))
            .orderBy(asc(venueMenuSections.displayOrder), asc(venueMenuItems.displayOrder))
            .limit(VENUE_CONTEXT_MENU_ITEM_MAX);
        return rows;
    } catch (error) {
        apiLogger.warn(
            { venueId, error: error instanceof Error ? error.message : String(error) },
            'venue-ai-context: failed to load menu items; continuing with empty carta'
        );
        return [];
    }
}
