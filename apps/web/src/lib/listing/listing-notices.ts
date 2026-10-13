/**
 * @file listing-notices.ts
 * @description The owner's listing notices in Mi Cuenta (HOS-1492, V8a.1b):
 * rows 8/9, 18, 20, 24, 30 and 31 of `V/19` §4, and the unpublish
 * confirmation lines of rows 2 and 25.
 *
 * The surface only READS what the core resolved (AC:V8a:1). Every decision —
 * why a listing is `PURGED`, whether an archive returns on its own, whether a
 * listing sits out by surplus — was taken by
 * `GET /api/v1/protected/publish/listing-notices/{vertical}`. This module maps
 * each `ListingNotice` to its copy through ONE exhaustive `Record` keyed by
 * `kind`, and never compares a status or a destination outside of it.
 *
 * A failed read is "no notices" (never an invented one): see
 * {@link indexListingNotices}.
 */

import type {
    ListingNotice,
    ListingNoticeKind,
    ListingNoticesItem,
    ListingNoticesResponse,
    PublicationStatusEnum
} from '@repo/schemas';
import type { PublishVerticalSlug } from '../api/endpoints-protected';
import type { ApiResult } from '../api/types';
import { formatDate } from '../format-utils';
import type { PluralTranslationFn, SupportedLocale, TranslationFn } from '../i18n';

/** The market's time zone: instants are dated as the owner lives them. */
const SITE_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Visual weight of a notice. */
export type ListingNoticeTone = 'danger' | 'warning' | 'info';

/** One notice ready to render. */
export interface ListingNoticeView {
    /** The notice kind it came from (for test ids). */
    readonly kind: ListingNoticeKind;
    /** Visual weight. */
    readonly tone: ListingNoticeTone;
    /** Heading. */
    readonly title: string;
    /** Body lines, in order. */
    readonly lines: readonly string[];
    /**
     * Row 30 only: the "I fixed it" button. `reportedAt` is the ISO instant the
     * owner already reported the fix, or `null` while they have not.
     */
    readonly reportFixed: { readonly reportedAt: string | null } | null;
}

/** Translation context shared by every view builder. */
interface CopyContext {
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    readonly tPlural: PluralTranslationFn;
    /** Recurring add-ons on the listing (H7): read, never computed here. */
    readonly recurringListingAddons: number;
}

/** Each notice narrowed by its kind. */
type NoticeByKind = { readonly [K in ListingNoticeKind]: Extract<ListingNotice, { kind: K }> };

/** One builder per kind; `null` renders nothing. */
type NoticeViewBuilders = {
    readonly [K in ListingNoticeKind]: (
        notice: NoticeByKind[K],
        ctx: CopyContext
    ) => ListingNoticeView | null;
};

/**
 * Formats an ISO instant as a long local date (day, month, year) in the site
 * time zone.
 *
 * @param params.iso - ISO-8601 instant.
 * @param params.locale - The page locale.
 * @returns The date label, or `null` when the instant cannot be read.
 */
export function formatNoticeInstant({
    iso,
    locale
}: {
    readonly iso: string;
    readonly locale: SupportedLocale;
}): string | null {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return formatDate({
        date,
        locale,
        options: { day: 'numeric', month: 'long', year: 'numeric', timeZone: SITE_TIME_ZONE }
    });
}

/** Formats a calendar date (`YYYY-MM-DD`) without shifting it across zones. */
function formatCalendarDate({
    value,
    locale
}: {
    readonly value: string;
    readonly locale: SupportedLocale;
}): string | null {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    return formatDate({
        date,
        locale,
        options: { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
    });
}

/** Where a lifted moderation left the listing (row 30); `null` = not a lift target. */
const LIFTED_RETURNED_TO_KEY: Readonly<Record<PublicationStatusEnum, string | null>> = {
    PUBLISHED: 'listing.notices.lifted.returnedTo.PUBLISHED',
    DRAFT: 'listing.notices.lifted.returnedTo.DRAFT',
    UNPUBLISHED_BY_BILLING: 'listing.notices.lifted.returnedTo.UNPUBLISHED_BY_BILLING',
    ARCHIVED: 'listing.notices.lifted.returnedTo.ARCHIVED',
    MODERATED: null,
    PURGED: null
};

/** Whether the lift left the listing a draft, so publishing is the owner's call. */
const LIFTED_TO_DRAFT: Readonly<Record<PublicationStatusEnum, boolean>> = {
    PUBLISHED: false,
    DRAFT: true,
    UNPUBLISHED_BY_BILLING: false,
    ARCHIVED: false,
    MODERATED: false,
    PURGED: false
};

/** The recurring add-ons line, only when the read counted any (H7). */
function recurringLine({
    key,
    ctx
}: {
    readonly key: string;
    readonly ctx: CopyContext;
}): string[] {
    const count = ctx.recurringListingAddons;
    return count > 0 ? [ctx.tPlural(key, count, { count })] : [];
}

/**
 * The exhaustive kind → view map. Adding a kind to the schema fails the
 * typecheck here until its copy exists.
 */
const NOTICE_VIEW: NoticeViewBuilders = {
    // Row 20: it existed, and its content was deleted for inactivity.
    PURGED_BY_INACTIVITY: (_notice, { t }) => ({
        kind: 'PURGED_BY_INACTIVITY',
        tone: 'danger',
        title: t('listing.notices.purgedByInactivity.title'),
        lines: [t('listing.notices.purgedByInactivity.body')],
        reportFixed: null
    }),
    // Row 31: deleted, what was deleted, and that it does not come back.
    PURGED_FROM_MODERATION: (_notice, { t }) => ({
        kind: 'PURGED_FROM_MODERATION',
        tone: 'danger',
        title: t('listing.notices.purgedFromModeration.title'),
        lines: [
            t('listing.notices.purgedFromModeration.body'),
            t('listing.notices.purgedFromModeration.what'),
            t('listing.notices.neverReturns')
        ],
        reportFixed: null
    }),
    // Any other PB12: deleted, and it does not come back.
    PURGED: (_notice, { t }) => ({
        kind: 'PURGED',
        tone: 'danger',
        title: t('listing.notices.purged.title'),
        lines: [t('listing.notices.purged.body'), t('listing.notices.neverReturns')],
        reportFixed: null
    }),
    // Row 18.
    ARCHIVED: (notice, ctx) => {
        const { t, locale } = ctx;
        const date =
            notice.deletionAnnouncedAt === null
                ? null
                : formatNoticeInstant({ iso: notice.deletionAnnouncedAt, locale });
        return {
            kind: 'ARCHIVED',
            tone: 'warning',
            title: t('listing.notices.archived.title'),
            lines: [
                t('listing.notices.archived.nothingDeleted'),
                ...recurringLine({ key: 'listing.notices.archived.recurring', ctx }),
                t('listing.notices.archived.canSeeAndExport'),
                ...(notice.returnsOnItsOwn
                    ? [
                          t('listing.notices.archived.returnsOnItsOwn'),
                          t('listing.notices.restitution.criterion')
                      ]
                    : []),
                t('listing.notices.archived.backToDraft'),
                ...(date === null
                    ? []
                    : [t('listing.notices.archived.deletionDate', undefined, { date })])
            ],
            reportFixed: null
        };
    },
    // Row 24.
    MODERATED: (notice, ctx) => {
        const { t } = ctx;
        return {
            kind: 'MODERATED',
            tone: 'warning',
            title: t('listing.notices.moderated.title'),
            lines: [
                ...(notice.reason === null
                    ? []
                    : [t('listing.notices.reason', undefined, { reason: notice.reason })]),
                t('listing.notices.moderated.hidden'),
                t('listing.notices.moderated.canDo'),
                ...recurringLine({ key: 'listing.notices.moderated.recurring', ctx })
            ],
            reportFixed: null
        };
    },
    // Row 30, the request: reason, suggested date, still visible, and the button.
    FIX_REQUESTED: (notice, { t, locale }) => {
        const suggested =
            notice.suggestedDate === null
                ? null
                : formatCalendarDate({ value: notice.suggestedDate, locale });
        return {
            kind: 'FIX_REQUESTED',
            tone: 'info',
            title: t('listing.notices.fixRequest.title'),
            lines: [
                t('listing.notices.reason', undefined, { reason: notice.reason }),
                ...(suggested === null
                    ? []
                    : [
                          t('listing.notices.fixRequest.suggestedDate', undefined, {
                              date: suggested
                          })
                      ]),
                t('listing.notices.fixRequest.stillVisible')
            ],
            reportFixed: { reportedAt: notice.ownerReportedFixedAt }
        };
    },
    // Row 30, the lift: where it went and, if back to draft, that publishing is theirs.
    MODERATION_LIFTED: (notice, { t }) => {
        const returnedKey = LIFTED_RETURNED_TO_KEY[notice.returnedTo];
        if (returnedKey === null) return null;
        return {
            kind: 'MODERATION_LIFTED',
            tone: 'info',
            title: t('listing.notices.lifted.title'),
            lines: [
                t(returnedKey),
                ...(LIFTED_TO_DRAFT[notice.returnedTo]
                    ? [t('listing.notices.lifted.draftIsYours')]
                    : []),
                ...(notice.fixRequestOpen ? [t('listing.notices.lifted.fixRequestOpen')] : [])
            ],
            reportFixed: null
        };
    },
    // Rows 8 and 9: the criterion, what was done (no window) and the recurring boosts.
    SURPLUS: (_notice, ctx) => {
        const { t } = ctx;
        return {
            kind: 'SURPLUS',
            tone: 'info',
            title: t('listing.notices.surplusTitle'),
            lines: [
                t('listing.notices.surplus.criterion'),
                t('listing.notices.surplus.noWindowDone'),
                ...(ctx.recurringListingAddons > 0
                    ? [t('listing.notices.surplus.recurringFeatured')]
                    : [])
            ],
            reportFixed: null
        };
    }
};

/** Dispatches one notice to its builder (correlated by kind). */
function buildOne<K extends ListingNoticeKind>({
    kind,
    notice,
    ctx
}: {
    readonly kind: K;
    readonly notice: NoticeByKind[K];
    readonly ctx: CopyContext;
}): ListingNoticeView | null {
    return NOTICE_VIEW[kind](notice, ctx);
}

/**
 * Builds the views of one listing's notices, in the order the read returned.
 *
 * @param params.locale - The page locale.
 * @param params.t - Translation function bound to the locale.
 * @param params.tPlural - Plural translation function bound to the locale.
 * @param params.item - The listing's entry of the read, or `undefined` when the
 *   read failed or did not include it (then nothing renders).
 * @returns The views; empty when there is nothing to say.
 */
export function buildListingNoticeViews({
    locale,
    t,
    tPlural,
    item
}: {
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    readonly tPlural: PluralTranslationFn;
    readonly item: ListingNoticesItem | undefined;
}): readonly ListingNoticeView[] {
    if (item === undefined) return [];
    const ctx: CopyContext = {
        locale,
        t,
        tPlural,
        recurringListingAddons: item.recurringListingAddons
    };
    return item.notices
        .map((notice) => buildOne({ kind: notice.kind, notice, ctx }))
        .filter((view): view is ListingNoticeView => view !== null);
}

/** Result of {@link indexListingNotices}. RO-RO. */
export interface ListingNoticesIndex {
    /** Whether the read succeeded. */
    readonly ok: boolean;
    /** Whether the owner's trial in the vertical is running; `null` when unknown. */
    readonly trialRunning: boolean | null;
    /** Each listing's entry, by listing id. Empty on a failed read. */
    readonly byListingId: ReadonlyMap<string, ListingNoticesItem>;
}

/** The index of a read that did not happen or failed: no notices, unknown trial. */
export const EMPTY_LISTING_NOTICES_INDEX: ListingNoticesIndex = {
    ok: false,
    trialRunning: null,
    byListingId: new Map()
};

/**
 * Indexes the listing-notices read by listing id. A failed read (or a body
 * without items) yields no notices and an unknown trial: the cards render
 * without notices, never with an invented one.
 *
 * @param params.result - The `publishApi.listingNotices` result.
 * @returns The index.
 */
export function indexListingNotices({
    result
}: {
    readonly result: ApiResult<ListingNoticesResponse>;
}): ListingNoticesIndex {
    if (!result.ok || !Array.isArray(result.data?.items)) return EMPTY_LISTING_NOTICES_INDEX;
    return {
        ok: true,
        trialRunning: result.data.trialRunning === true,
        byListingId: new Map(result.data.items.map((item) => [item.listingId, item]))
    };
}

/** The extra lines of the unpublish confirmation (rows 2 and 25). RO-RO. */
export interface UnpublishConfirmNotes {
    /** Row 2: the trial clock keeps running. `undefined` when not in trial or unknown. */
    readonly trialNote?: string;
    /** Row 25: the recurring boosts keep being charged. `undefined` without any. */
    readonly recurringNote?: string;
}

/**
 * The unpublish confirmation lines read from the listing-notices read. With
 * an unknown trial or no item (failed read), nothing is added: today's
 * confirmation, never an invented line.
 *
 * @param params.t - Translation function bound to the locale.
 * @param params.tPlural - Plural translation function bound to the locale.
 * @param params.trialRunning - From the read; `null` when unknown.
 * @param params.item - The listing's entry of the read, if any.
 * @returns The lines to add.
 */
export function buildUnpublishConfirmNotes({
    t,
    tPlural,
    trialRunning,
    item
}: {
    readonly t: TranslationFn;
    readonly tPlural: PluralTranslationFn;
    readonly trialRunning: boolean | null;
    readonly item: ListingNoticesItem | undefined;
}): UnpublishConfirmNotes {
    const count = item?.recurringListingAddons ?? 0;
    return {
        ...(trialRunning === true
            ? { trialNote: t('host.properties.card.unpublishTrialNote') }
            : {}),
        ...(count > 0
            ? {
                  recurringNote: tPlural('host.properties.card.unpublishRecurringNote', count, {
                      count
                  })
              }
            : {})
    };
}

/** Row 21: the vertical's name inside "you need a {vertical} subscription". */
const SUBSCRIBE_TO_PUBLISH_VERTICAL_KEY: Readonly<Record<PublishVerticalSlug, string>> = {
    accommodation: 'host.properties.card.subscribeToPublish.vertical.accommodation',
    gastronomy: 'host.properties.card.subscribeToPublish.vertical.gastronomy',
    experience: 'host.properties.card.subscribeToPublish.vertical.experience'
};

/** The row 21 notice copy. RO-RO. */
export interface SubscribeToPublishCopy {
    /** "Subscribe to publish". */
    readonly title: string;
    /** "Your listing is still unpublished. To publish it you need a {vertical} subscription." */
    readonly body: string;
}

/**
 * Row 21 (AC:V8a:4): what the publish surfaces say when publishing needs a
 * subscription in the vertical. Only the copy: WHEN it shows is decided by
 * `resolvePublishAffordance` (`kind: 'checkout'`) or by the server's
 * `subscription_required` rejection, never here. The no-plans case (row 29)
 * never reaches it.
 *
 * @param params.t - Translation function bound to the locale.
 * @param params.vertical - The listing's vertical.
 * @returns The title and body.
 */
export function buildSubscribeToPublishCopy({
    t,
    vertical
}: {
    readonly t: TranslationFn;
    readonly vertical: PublishVerticalSlug;
}): SubscribeToPublishCopy {
    return {
        title: t('host.properties.card.subscribeToPublish.title'),
        body: t('host.properties.card.subscribeToPublish.body', undefined, {
            vertical: t(SUBSCRIBE_TO_PUBLISH_VERTICAL_KEY[vertical])
        })
    };
}
