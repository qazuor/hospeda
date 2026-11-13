import { getDb, venueFaqs, venueMenuItems, venueMenuSections } from '@repo/db';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger.js';
import type { VenueContextFaq, VenueContextMenuItem } from './venue-ai-context.js';

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
export async function safeLoadFaqs(venueId: string, faqLimit: number): Promise<VenueContextFaq[]> {
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
            .limit(faqLimit);
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
export async function safeLoadMenuItems(
    venueId: string,
    itemLimit: number
): Promise<VenueContextMenuItem[]> {
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
            .limit(itemLimit);
        return rows;
    } catch (error) {
        apiLogger.warn(
            { venueId, error: error instanceof Error ? error.message : String(error) },
            'venue-ai-context: failed to load menu items; continuing with empty carta'
        );
        return [];
    }
}
