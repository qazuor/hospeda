/**
 * @file business-lines-notice-view.ts
 * @description The `BUSINESS_LINES_CHANGED` notice as Mi Cuenta renders it
 * (HOS-1875, DEC-FAC-056): a third party changed the listing's business lines.
 *
 * The web decides nothing: the lines and sections that moved arrive as catalog
 * ids, and this module only labels them. Line labels come from the existing
 * venue copy, section labels from the editor's section presentation. The lists
 * are joined with `Intl.ListFormat` (the same pattern `support-edits.ts` uses),
 * so "a y b" / "a and b" / "a e b" follow the page locale.
 */

import { toBcp47Locale } from '@repo/i18n/web';
import type { ListingNotice } from '@repo/schemas';
import { LISTING_SECTION_PRESENTATION } from '../editor/listing-section-presentation';
import { type CopyContext, formatNoticeInstant, type ListingNoticeView } from './listing-notices';

/** The notice narrowed to its kind. */
type BusinessLinesChangedNotice = Extract<ListingNotice, { kind: 'BUSINESS_LINES_CHANGED' }>;

/**
 * Section labels of both verticals whose catalog carries business lines. The
 * ids are disjoint (venue's `nightInfo`, experience's `practicalInfo`, …) and
 * the shared ones hold the same label key, so one merged map covers both
 * without branching on a vertical (G-FAC-05).
 */
const SECTION_PRESENTATION: Readonly<Record<string, { readonly labelKey: string } | undefined>> = {
    ...LISTING_SECTION_PRESENTATION.venue,
    ...LISTING_SECTION_PRESENTATION.experience
};

/** Joins labels the way the page locale reads a natural-language list. */
function joinLabels(labels: readonly string[], ctx: CopyContext): string {
    return new Intl.ListFormat(toBcp47Locale(ctx.locale), {
        style: 'long',
        type: 'conjunction'
    }).format(labels);
}

/** A business-line value → its existing venue label. */
function lineLabel(value: string, ctx: CopyContext): string {
    return ctx.t(`venue.owner.businessLines.${value}.label`, value);
}

/** A catalog section id → its editor label. */
function sectionLabel(id: string, ctx: CopyContext): string {
    const presentation = SECTION_PRESENTATION[id];
    return presentation ? ctx.t(presentation.labelKey, id) : id;
}

/**
 * Builds the view of a business-lines change notice.
 *
 * @param input.notice - The notice as the API returned it.
 * @param input.ctx - The translation context of the page.
 * @returns The view, or `null` when the instant cannot be read.
 */
export function buildBusinessLinesChangedView(input: {
    readonly notice: BusinessLinesChangedNotice;
    readonly ctx: CopyContext;
}): ListingNoticeView | null {
    const { notice, ctx } = input;
    const { t, locale } = ctx;
    const date = formatNoticeInstant({ iso: notice.at, locale });
    if (date === null) return null;

    const lines: string[] = [];
    if (notice.addedLines.length > 0) {
        lines.push(
            t('listing.notices.businessLinesChanged.added', undefined, {
                lines: joinLabels(
                    notice.addedLines.map((value) => lineLabel(value, ctx)),
                    ctx
                )
            })
        );
    }
    if (notice.removedLines.length > 0) {
        lines.push(
            t('listing.notices.businessLinesChanged.removed', undefined, {
                lines: joinLabels(
                    notice.removedLines.map((value) => lineLabel(value, ctx)),
                    ctx
                )
            })
        );
    }
    if (notice.shownSections.length > 0) {
        lines.push(
            t('listing.notices.businessLinesChanged.shownSections', undefined, {
                sections: joinLabels(
                    notice.shownSections.map((id) => sectionLabel(id, ctx)),
                    ctx
                )
            })
        );
    }
    if (notice.hiddenSections.length > 0) {
        lines.push(
            t('listing.notices.businessLinesChanged.hiddenSections', undefined, {
                sections: joinLabels(
                    notice.hiddenSections.map((id) => sectionLabel(id, ctx)),
                    ctx
                )
            }),
            t('listing.notices.businessLinesChanged.nothingDeleted')
        );
    }
    lines.push(t('listing.notices.businessLinesChanged.changedAt', undefined, { date }));

    return {
        kind: 'BUSINESS_LINES_CHANGED',
        tone: 'info',
        title: t('listing.notices.businessLinesChanged.title'),
        lines,
        reportFixed: null
    };
}
