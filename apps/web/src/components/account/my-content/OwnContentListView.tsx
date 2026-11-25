/**
 * @file OwnContentListView.tsx
 * @description The events and posts own-content lists on the kit (HOS-2505):
 * `MyContentList` + one `ContentCard` per item with its three status axes.
 *
 * Server-rendered with no hydration: the page reads the list with the session
 * cookie and hands the result in. The only interactive piece, the retry of a
 * failed read, arrives as `errorRegion` (a small island). Without permission
 * the body is a `LockedState` with `reason.kind = 'permission'` (D9 «sin
 * acceso único»): never a redirect, never the form.
 */

import { AddIcon } from '@repo/icons';
import type { ReactNode } from 'react';
import {
    ContentCard,
    EmptyState,
    LinkButton,
    MyContentList,
    type MyContentListState
} from '@/components/account/ui';
import { buildAccountPageHref } from '@/lib/account-pagination';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { buildContentStatuses } from './content-status';

/** Which authored entity the list shows. */
export type OwnContentKind = 'events' | 'posts';

/** One item of the list, already transformed by the page. */
export interface OwnContentListItem {
    readonly id: string;
    /** Post title or event name. */
    readonly title: string;
    readonly moderationState: string;
    readonly visibility: string;
    readonly lifecycleState: string;
}

/** What the page read. */
export type OwnContentListStatus = 'ready' | 'empty' | 'error' | 'locked';

/** Props of {@link OwnContentListView}. */
export interface OwnContentListViewProps {
    readonly locale: SupportedLocale;
    readonly kind: OwnContentKind;
    readonly status: OwnContentListStatus;
    readonly items: readonly OwnContentListItem[];
    /** Current page, 1-based. */
    readonly page: number;
    /** Total pages, at least 1. */
    readonly pageCount: number;
    /** The page «?». */
    readonly help?: ReactNode;
    /** The retry island shown when `status` is `error`. */
    readonly errorRegion?: ReactNode;
}

/** Route segment of each kind. */
const BASE_PATH: Readonly<Record<OwnContentKind, string>> = {
    events: 'mi-cuenta/eventos',
    posts: 'mi-cuenta/publicaciones'
};

/**
 * Renders the own-content list page body.
 *
 * @param props - See {@link OwnContentListViewProps}.
 * @returns The `MyContentList` template.
 */
export function OwnContentListView({
    locale,
    kind,
    status,
    items,
    page,
    pageCount,
    help,
    errorRegion
}: OwnContentListViewProps) {
    const t = createT(locale);
    const basePath = BASE_PATH[kind];
    const createHref = buildUrl({ locale, path: `${basePath}/nuevo` });
    const copy = `account.myContent.contentList.${kind}`;

    const state: MyContentListState =
        status === 'locked'
            ? {
                  status: 'locked',
                  reason: {
                      kind: 'permission',
                      feature: t(`${copy}.locked.feature`),
                      description: t(`${copy}.locked.description`),
                      helpHref: buildUrl({ locale, path: 'colaborar/editores' })
                  }
              }
            : { status };

    return (
        <MyContentList
            locale={locale}
            title={t(`account.myContent.${kind}.list.title`)}
            description={t(`account.myContent.${kind}.list.subtitle`)}
            help={help}
            createAction={
                // HOS-2611: one solid primary per screen. The empty state owns
                // the «create» action, so the header drops it there.
                status === 'ready' ? (
                    <LinkButton href={createHref}>
                        <AddIcon
                            size="sm"
                            aria-hidden="true"
                        />
                        {t(`${copy}.create`)}
                    </LinkButton>
                ) : undefined
            }
            sectionTitle={t(`${copy}.sectionTitle`)}
            helpId={kind === 'events' ? 'section:content.events' : 'section:content.posts'}
            listLabel={t(`account.myContent.${kind}.list.title`)}
            state={state}
            errorRegion={errorRegion}
            empty={
                <EmptyState
                    title={t(`account.myContent.${kind}.list.empty`)}
                    action={
                        <LinkButton href={createHref}>
                            <AddIcon
                                size="sm"
                                aria-hidden="true"
                            />
                            {t(`account.myContent.${kind}.list.emptyCta`)}
                        </LinkButton>
                    }
                />
            }
            pagination={{
                page,
                pageCount,
                hrefFor: (target) => buildAccountPageHref({ locale, path: basePath, page: target })
            }}
        >
            {items.map((item) => (
                <ContentCard
                    key={item.id}
                    locale={locale}
                    title={item.title}
                    statuses={buildContentStatuses({
                        locale,
                        moderationState: item.moderationState,
                        visibility: item.visibility,
                        lifecycleState: item.lifecycleState
                    })}
                    actions={
                        <LinkButton
                            href={buildUrl({ locale, path: `${basePath}/${item.id}/editar` })}
                            variant="secondary"
                            size="sm"
                            aria-label={t('account.myContent.contentList.editNamed', undefined, {
                                title: item.title
                            })}
                        >
                            {t('account.myContent.card.editLink')}
                        </LinkButton>
                    }
                />
            ))}
        </MyContentList>
    );
}
