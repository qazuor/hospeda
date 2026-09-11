/**
 * AI-chat context assembler for GASTRONOMY listings (HOS-400).
 *
 * The restaurant counterpart of `accommodation-ai-context.ts`. It answers a
 * different set of questions and therefore carries different fields: what the
 * venue cooks, when it opens, what is on the carta and roughly what it costs.
 *
 * ## What is in here that the accommodation assembler does not have
 *
 * The carta, the menú del día and the venue agenda are ENTITLEMENT-GATED
 * content: the public routes withhold them from an owner whose plan does not
 * grant the key, and the service-core readers do not. So this assembler gates
 * them too, from the entitlement set the ROUTE resolved (see
 * `AssembleChatContextInput.ownerEntitlements`).
 *
 * Today that gate never fires — every commerce tier that grants `AI_CHAT` also
 * grants the carta keys — and it is written anyway, because "today's catalogue
 * happens to bundle them" is not a guarantee. The day the keys are split across
 * tiers differently, an assembler that trusted the coincidence would put paid
 * content inside the prompt of an owner who does not pay for it, invisibly:
 * nobody reads a system prompt.
 *
 * @module apps/api/services/ai-context/gastronomy-ai-context
 */

import { EntitlementKey } from '@repo/billing';
import {
    gastronomies,
    gastronomyFaqs,
    gastronomyMenuItems,
    gastronomyMenuSections,
    getDb
} from '@repo/db';
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
export const GASTRONOMY_DESCRIPTION_MAX_CHARS = 800;

/** Maximum FAQs included in the context block. */
export const GASTRONOMY_CONTEXT_FAQ_MAX = 10;

/**
 * Maximum menu items included, ACROSS all sections.
 *
 * A full carta can run to hundreds of dishes and would crowd out everything
 * else in the block — including the FAQs, which are where an owner answers the
 * questions the structured fields cannot. The cap is applied after ordering by
 * section then display order, so what survives is the top of the carta as the
 * owner arranged it, not an arbitrary slice.
 */
export const GASTRONOMY_CONTEXT_MENU_ITEM_MAX = 40;

/** Hard cap on each menu item's description in the context block. */
export const GASTRONOMY_MENU_ITEM_DESCRIPTION_MAX_CHARS = 160;

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

/** The gastronomy columns this assembler reads. */
export interface GastronomyContextRow {
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
}

/** One FAQ as the context block consumes it. */
export interface GastronomyContextFaq {
    readonly question: string;
    readonly answer: string;
}

/** One menu item, already joined to its section name. */
export interface GastronomyContextMenuItem {
    readonly sectionName: string | null;
    readonly name: string;
    readonly description: string | null;
    readonly priceCents: number | null;
    readonly isAvailable: boolean | null;
}

// ---------------------------------------------------------------------------
// Pure helper: buildGastronomyMarkdownContext
// ---------------------------------------------------------------------------

/**
 * Assembles the Markdown context block from pre-loaded gastronomy data.
 *
 * PURE — no I/O. Every owner-authored value goes through the shared fence.
 *
 * @param venue - The gastronomy row.
 * @param faqs - The venue's FAQs. Capped at {@link GASTRONOMY_CONTEXT_FAQ_MAX}.
 * @param menuItems - The carta, already gated by the caller. Pass an EMPTY array
 *   when the owner's plan does not grant `MANAGE_GASTRONOMY_MENU` — this function
 *   does not re-check, it renders what it is given.
 * @returns The Markdown block to prepend to the system message.
 */
export function buildGastronomyMarkdownContext(
    venue: GastronomyContextRow,
    faqs: ReadonlyArray<GastronomyContextFaq>,
    menuItems: ReadonlyArray<GastronomyContextMenuItem>
): string {
    const cappedFaqs = faqs.slice(0, GASTRONOMY_CONTEXT_FAQ_MAX);
    const cappedItems = menuItems.slice(0, GASTRONOMY_CONTEXT_MENU_ITEM_MAX);
    const truncatedDescription = truncate(
        sanitizeOwnerDelimiters(venue.description),
        GASTRONOMY_DESCRIPTION_MAX_CHARS
    );

    // The directive is line 1 so it precedes every fence below it. `type` and
    // `priceRange` stay unfenced: both are closed enums, not owner free text.
    const lines: string[] = [
        OWNER_DATA_DIRECTIVE,
        '',
        `## Restaurante: ${fenceOwnerValue(venue.name)}`,
        `**Tipo de cocina**: ${venue.type}`,
        `**Resumen**: ${fenceOwnerValue(venue.summary)}`
    ];

    if (venue.priceRange) {
        lines.push(`**Rango de precios**: ${venue.priceRange}`);
    }

    // --- Opening hours ---
    const hours = formatOpeningHours(venue.openingHours);
    if (hours.length > 0) {
        lines.push('', '### Horarios');
        for (const line of hours) {
            lines.push(`- ${line}`);
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
                lines.push(`#### ${sanitizeOwnerDelimiters(currentSection ?? 'Otros')}`);
            }
            const price = item.priceCents == null ? '' : ` — $${Math.round(item.priceCents / 100)}`;
            // An unavailable dish is stated as unavailable rather than dropped:
            // "is X on the menu?" and "can I order X tonight?" are different
            // questions, and silently omitting the dish answers the first wrong.
            const availability = item.isAvailable === false ? ' (no disponible)' : '';
            lines.push(`**${sanitizeOwnerDelimiters(item.name)}**${price}${availability}`);
            if (item.description) {
                lines.push(
                    truncate(
                        sanitizeOwnerDelimiters(item.description),
                        GASTRONOMY_MENU_ITEM_DESCRIPTION_MAX_CHARS
                    )
                );
            }
            lines.push('');
        }
        lines.push(OWNER_DATA_DELIMITER_END);
        lines.push(
            'La carta y los precios son los que el local guardó por última vez, no datos en vivo.'
        );
    } else if (venue.menuUrl) {
        // No structured carta reached us — either the venue has none, or its
        // plan does not grant it. Either way the link is public information.
        lines.push('', '### Carta', 'El local publica su carta en un enlace externo.');
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
 * Renders the `opening_hours` JSONB into plain lines.
 *
 * The column is `Record<string, unknown>` — its shape is not guaranteed by a
 * schema at this layer — so anything that is not a string value is skipped
 * rather than stringified into `[object Object]`. Keys are sanitized too: they
 * are owner-influenced in principle.
 *
 * @param openingHours - The raw JSONB value.
 * @returns One `día: horario` line per readable entry; empty when unreadable.
 */
function formatOpeningHours(openingHours: Record<string, unknown> | null): string[] {
    if (!openingHours || typeof openingHours !== 'object') {
        return [];
    }
    const lines: string[] = [];
    for (const [day, value] of Object.entries(openingHours)) {
        if (typeof value === 'string' && value.trim().length > 0) {
            lines.push(`${sanitizeOwnerDelimiters(day)}: ${sanitizeOwnerDelimiters(value)}`);
        }
    }
    return lines;
}

// ---------------------------------------------------------------------------
// Async assembler
// ---------------------------------------------------------------------------

/**
 * Loads a gastronomy listing's context and assembles the system message.
 *
 * Throws `ServiceError(NOT_FOUND)` when the venue does not exist or is
 * soft-deleted, which the streaming route factory maps to a pre-stream 404.
 * Secondary reads (FAQs, carta) degrade to empty lists with a logged warning —
 * a chat request must not fail because one relation is unavailable.
 *
 * @param input - Actor, entity id, resolved prompt, locale, owner entitlements.
 * @returns The context block, system message and venue name.
 */
export async function assembleGastronomyContext(
    input: AssembleChatContextInput
): Promise<AssembleChatContextOutput> {
    const { entityId, resolvedPrompt, locale, ownerEntitlements } = input;
    const db = getDb();

    const rows = await db
        .select({
            id: gastronomies.id,
            name: gastronomies.name,
            summary: gastronomies.summary,
            description: gastronomies.description,
            type: gastronomies.type,
            priceRange: gastronomies.priceRange,
            menuUrl: gastronomies.menuUrl,
            openingHours: gastronomies.openingHours,
            averageRating: gastronomies.averageRating,
            reviewsCount: gastronomies.reviewsCount
        })
        .from(gastronomies)
        .where(and(eq(gastronomies.id, entityId), isNull(gastronomies.deletedAt)))
        .limit(1);

    const venue = rows[0];
    if (!venue) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Gastronomy '${entityId}' not found.`);
    }

    const [faqs, menuItems] = await Promise.all([
        safeLoadFaqs(entityId),
        // The carta is gated. `ownerEntitlements` is what the ROUTE resolved for
        // this owner in the same request — see the module docblock for why the
        // gate exists even though today's tiers make it unreachable.
        ownerEntitlements.has(EntitlementKey.MANAGE_GASTRONOMY_MENU)
            ? safeLoadMenuItems(entityId)
            : Promise.resolve([] as GastronomyContextMenuItem[])
    ]);

    const contextBlock = buildGastronomyMarkdownContext(venue, faqs, menuItems);

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
 * in the WHERE clause — BEFORE {@link GASTRONOMY_CONTEXT_FAQ_MAX}, which is
 * applied by the `.limit()` below it. Filtering after the cap instead would
 * let AI-disabled FAQs starve out FAQs that should reach the prompt (HOS-400,
 * adopting HOS-393 AC-11). A FAQ missing the field (pre-migration data) reads
 * as usable, matching the column's `DEFAULT true`.
 */
async function safeLoadFaqs(gastronomyId: string): Promise<GastronomyContextFaq[]> {
    try {
        const db = getDb();
        const rows = await db
            .select({ question: gastronomyFaqs.question, answer: gastronomyFaqs.answer })
            .from(gastronomyFaqs)
            .where(
                and(
                    eq(gastronomyFaqs.gastronomyId, gastronomyId),
                    isNull(gastronomyFaqs.deletedAt),
                    eq(gastronomyFaqs.lifecycleState, 'ACTIVE'),
                    eq(gastronomyFaqs.isUsableByAi, true)
                )
            )
            .orderBy(asc(gastronomyFaqs.displayOrder))
            .limit(GASTRONOMY_CONTEXT_FAQ_MAX);
        return rows;
    } catch (error) {
        apiLogger.warn(
            { gastronomyId, error: error instanceof Error ? error.message : String(error) },
            'gastronomy-ai-context: failed to load FAQs; continuing with empty list'
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
async function safeLoadMenuItems(gastronomyId: string): Promise<GastronomyContextMenuItem[]> {
    try {
        const db = getDb();
        const rows = await db
            .select({
                sectionName: gastronomyMenuSections.name,
                name: gastronomyMenuItems.name,
                description: gastronomyMenuItems.description,
                priceCents: gastronomyMenuItems.priceCents,
                isAvailable: gastronomyMenuItems.isAvailable
            })
            .from(gastronomyMenuItems)
            .leftJoin(
                gastronomyMenuSections,
                eq(gastronomyMenuItems.sectionId, gastronomyMenuSections.id)
            )
            .where(eq(gastronomyMenuItems.gastronomyId, gastronomyId))
            .orderBy(
                asc(gastronomyMenuSections.displayOrder),
                asc(gastronomyMenuItems.displayOrder)
            )
            .limit(GASTRONOMY_CONTEXT_MENU_ITEM_MAX);
        return rows;
    } catch (error) {
        apiLogger.warn(
            { gastronomyId, error: error instanceof Error ? error.message : String(error) },
            'gastronomy-ai-context: failed to load menu items; continuing with empty carta'
        );
        return [];
    }
}
