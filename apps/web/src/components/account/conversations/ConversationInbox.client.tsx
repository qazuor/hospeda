/**
 * @file ConversationInbox.client.tsx
 * @description The conversation list of BOTH inboxes on the account kit
 * (HOS-2481 guest, HOS-2482 owner). One island, `viewer` as the parameter.
 *
 * The page stays session-blind: the list is read here, in the browser, so the
 * region can show every state the kit requires (`AsyncRegion`). A failed read
 * is `ErrorState` with a retry, never the empty inbox (HOS-2422). The API is
 * paginated and every page is reachable through `Pagination` links, so no
 * conversation is silently dropped.
 */

import { ChatIcon } from '@repo/icons';
import { useCallback, useEffect, useState } from 'react';
import {
    AsyncRegion,
    type AsyncResult,
    CountPill,
    DataList,
    EmptyState,
    ErrorState,
    LinkButton,
    ListRow,
    LockedState,
    Pagination,
    Section,
    Skeleton,
    settleAsync,
    type ThreadViewer
} from '@/components/account/ui';
import { ownerConversationsApi, protectedConversationsApi } from '@/lib/api/endpoints-protected';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/** Conversations per page; the API paginates and every page is linked. */
export const INBOX_PAGE_SIZE = 20;

/** Product time zone: server and browser print the same date. */
const TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** BCP 47 tag per app locale for the row date. */
const INTL_LOCALE: Readonly<Record<SupportedLocale, string>> = {
    es: 'es-AR',
    en: 'en-US',
    pt: 'pt-BR'
};

/** One row of the inbox, whichever side reads it. */
export interface InboxRow {
    readonly id: string;
    /** Who or what the conversation is with. */
    readonly title: string;
    /** Secondary line (the listing, for the owner). */
    readonly meta?: string;
    readonly excerpt: string | null;
    readonly unreadCount: number;
    readonly lastActivityAt: string;
}

/** A loaded page of the inbox. */
export interface InboxPage {
    readonly rows: readonly InboxRow[];
    readonly totalPages: number;
}

/** Props of {@link ConversationInbox}. */
export interface ConversationInboxProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** Which inbox: the guest's or the owner's. */
    readonly viewer: ThreadViewer;
    /** Current page, 1-based (from the `?page=` query). */
    readonly page: number;
}

/** Help anchor of each inbox's list section. */
const INBOX_HELP_ID = {
    guest: 'section:messages.list',
    owner: 'section:messages.owner-list'
} as const;

/** Route of each inbox, relative to the locale. */
const INBOX_PATH: Readonly<Record<ThreadViewer, string>> = {
    guest: 'mi-cuenta/consultas',
    owner: 'mi-cuenta/consultas-propietario'
};

/**
 * Reads one page of the inbox for the given side. Rejects on any API failure,
 * so `settleAsync` turns it into the error state, never into an empty list.
 *
 * @param input - Options object.
 * @param input.viewer - Which inbox.
 * @param input.page - 1-based page.
 * @param input.guestFallback - Translated name for an owner row without a guest name.
 * @returns The rows and the page count.
 */
export async function loadInboxPage({
    viewer,
    page,
    guestFallback
}: {
    readonly viewer: ThreadViewer;
    readonly page: number;
    readonly guestFallback: string;
}): Promise<InboxPage> {
    if (viewer === 'owner') {
        const result = await ownerConversationsApi.list({ page, pageSize: INBOX_PAGE_SIZE });
        if (!result.ok) throw new Error(result.error.message);
        return {
            rows: result.data.items.map((item) => ({
                id: item.id,
                title: item.guestName || guestFallback,
                meta: item.accommodationName,
                excerpt: item.lastMessageExcerpt,
                unreadCount: item.unreadCount,
                lastActivityAt: item.lastActivityAt
            })),
            totalPages: result.data.pagination.totalPages
        };
    }
    const result = await protectedConversationsApi.list({ page, pageSize: INBOX_PAGE_SIZE });
    if (!result.ok) throw new Error(result.error.message);
    return {
        rows: result.data.items.map((item) => ({
            id: item.id,
            title: item.accommodationName,
            excerpt: item.lastMessageExcerpt,
            unreadCount: item.unreadCount,
            lastActivityAt: item.lastActivityAt
        })),
        totalPages: result.data.pagination.totalPages
    };
}

/**
 * Formats the last-activity date of a row.
 *
 * @param input - Options object.
 * @param input.iso - ISO instant.
 * @param input.locale - App locale.
 * @returns A short date, or the raw value when it is not a date.
 */
function formatRowDate({
    iso,
    locale
}: {
    readonly iso: string;
    readonly locale: SupportedLocale;
}) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: TIME_ZONE
    }).format(date);
}

/**
 * The inbox list with its loading, error, empty and ready states.
 *
 * @param props - See {@link ConversationInboxProps}.
 * @returns The inbox section with its async region.
 */
export function ConversationInbox({ locale, viewer, page }: ConversationInboxProps) {
    const t = createT(locale);
    const [state, setState] = useState<AsyncResult<InboxPage>>({ status: 'loading' });
    const guestFallback = t('conversations.senderLabels.guest');

    const load = useCallback(async () => {
        setState({ status: 'loading' });
        const next = await settleAsync({
            load: () => loadInboxPage({ viewer, page, guestFallback }),
            retry: () => void load(),
            // Empty only when there is no conversation at all; a page past the
            // end still shows the pagination back.
            isEmpty: (data) => data.rows.length === 0 && page === 1
        });
        setState(next);
    }, [viewer, page, guestFallback]);

    useEffect(() => {
        void load();
    }, [load]);

    const basePath = buildUrl({ locale, path: INBOX_PATH[viewer] });
    const threadHref = (id: string) => buildUrl({ locale, path: `${INBOX_PATH[viewer]}/${id}` });

    return (
        <Section
            title={t('conversations.inbox.sectionTitle')}
            helpId={INBOX_HELP_ID[viewer]}
        >
            <AsyncRegion
                state={state}
                loading={() => (
                    <Skeleton
                        locale={locale}
                        lines={4}
                    />
                )}
                error={({ retry }) => (
                    <ErrorState
                        locale={locale}
                        onRetry={retry}
                        title={t('conversations.inbox.loadError.title')}
                        description={t('conversations.inbox.loadError.body')}
                    />
                )}
                empty={() =>
                    viewer === 'guest' ? (
                        <EmptyState
                            icon={
                                <ChatIcon
                                    size={28}
                                    aria-hidden={true}
                                />
                            }
                            title={t('conversations.empty.guestInboxTitle')}
                            description={t('conversations.empty.guestInbox')}
                            action={
                                <LinkButton
                                    href={buildUrl({ locale, path: 'alojamientos' })}
                                    variant="secondary"
                                >
                                    {t('conversations.empty.guestInboxCta')}
                                </LinkButton>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={
                                <ChatIcon
                                    size={28}
                                    aria-hidden={true}
                                />
                            }
                            title={t('conversations.empty.ownerInboxTitle')}
                            description={t('conversations.empty.ownerInbox')}
                        />
                    )
                }
                locked={(reason) => (
                    <LockedState
                        reason={reason}
                        locale={locale}
                    />
                )}
                ready={(data) => (
                    <>
                        <DataList
                            label={t(
                                viewer === 'guest'
                                    ? 'conversations.inbox.guestListLabel'
                                    : 'conversations.inbox.ownerListLabel'
                            )}
                        >
                            {data.rows.map((row) => (
                                <ListRow
                                    key={row.id}
                                    href={threadHref(row.id)}
                                    title={row.title}
                                    meta={row.meta}
                                    description={
                                        row.excerpt ? row.excerpt.slice(0, 200) : undefined
                                    }
                                    emphasis={row.unreadCount > 0}
                                    trailing={
                                        <>
                                            <time dateTime={row.lastActivityAt}>
                                                {formatRowDate({ iso: row.lastActivityAt, locale })}
                                            </time>
                                            {row.unreadCount > 0 && (
                                                <CountPill
                                                    count={row.unreadCount}
                                                    variant="solid"
                                                    label={t(
                                                        'conversations.inbox.unreadCount',
                                                        undefined,
                                                        {
                                                            count: row.unreadCount
                                                        }
                                                    )}
                                                />
                                            )}
                                        </>
                                    }
                                />
                            ))}
                        </DataList>
                        {(data.totalPages > 1 || data.rows.length === 0) && (
                            <Pagination
                                locale={locale}
                                page={Math.min(page, Math.max(data.totalPages, 1))}
                                pageCount={Math.max(data.totalPages, 1)}
                                hrefFor={(target) => `${basePath}?page=${target}`}
                            />
                        )}
                    </>
                )}
            />
        </Section>
    );
}
