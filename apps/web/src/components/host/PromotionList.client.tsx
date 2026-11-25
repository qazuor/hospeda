/**
 * @file PromotionList.client.tsx
 * @description The owner's promotions on the account kit (HOS-2505): the
 * shared `MyContentList` template with one `ContentCard` per promotion,
 * deletion through the kit `ConfirmDialog`, and `Pagination` over every page
 * the API reports (the list used to ask for one default page and drop the
 * rest silently, HOS-2440).
 *
 * Plan gate: the effective set says whether `create_promotions` is granted.
 * Like `PromotionForm`, only a SUCCESSFUL read that lacks the key locks: a
 * failed read is not «no plan» (the API decides on save), and while the read
 * is pending the list shows its normal loading state, never a lock flash.
 * When locked, the «Nueva promoción» action is not offered; an owner with no
 * promotions sees a `LockedState` with the catalog plan names
 * (`lockPlanNames`, read by the page), and one who still has some keeps the
 * list with an upgrade notice above it.
 *
 * Owner decision 18 (Mi cuenta UI epic): locked promotions are view + pause
 * only. «Editar» is shown disabled (the notice says why), an active promotion
 * offers «Pausar» (the API accepts a pause without the plan key), and
 * re-activating stays out, as the API refuses it without the key.
 *
 * @example
 * ```astro
 * <PromotionList client:load locale={locale} lockPlanNames={names}>
 *     <PageHelpLink slot="help" locale={locale} />
 * </PromotionList>
 * ```
 */

import { formatCalendarDate } from '@repo/utils';
import { type JSX, type ReactNode, useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Button,
    ContentCard,
    EmptyState,
    LinkButton,
    MyContentList,
    type MyContentListState,
    StatusPill,
    type StatusTone,
    useConfirm
} from '@/components/account/ui';
import { ACCOUNT_LIST_PAGE_SIZE } from '@/lib/account-pagination';
import { ownerPromotionApi } from '@/lib/api/endpoints-protected';
import { transformOwnerPromotionList } from '@/lib/api/transforms';
import type { OwnerPromotionData } from '@/lib/api/types';
import { getEntitlementsCached } from '@/lib/entitlements-cache';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { formatPromotionBenefit } from '@/lib/promotions/format-benefit';
import { listVipPausedTitles } from '@/lib/promotions/vip-paused';
import { buildUrl } from '@/lib/urls';

/**
 * Renders a promotion validity boundary — a calendar day, not an instant.
 * `validFrom`/`validUntil` are date-only UTC-midnight values: the shared
 * helper pins UTC so a viewer west of UTC sees the right day (BETA-88).
 */
function formatValidity(value: string | Date | null | undefined, locale: string): string {
    return formatCalendarDate({ value, locale, options: { dateStyle: 'long' } }) ?? '';
}

/** Lifecycle tone of an owner promotion. */
const LIFECYCLE_TONES: Readonly<Record<string, StatusTone>> = {
    ACTIVE: 'success',
    INACTIVE: 'warning',
    DRAFT: 'neutral',
    ARCHIVED: 'neutral'
};

/** Props of {@link PromotionList}. */
export interface PromotionListProps {
    /** Active UI locale for i18n and URL building. */
    readonly locale: SupportedLocale;
    /** Catalog names of the owner plans that include promotions (HOS-2505). */
    readonly lockPlanNames?: readonly string[];
    /** The page «?» (from Astro: `<PageHelpLink slot="help" />`). */
    readonly help?: ReactNode;
}

/** Result of the plan check: pending, open (granted or unknown), or locked. */
type PlanGate = 'checking' | 'open' | 'locked';

type ListState =
    | { readonly status: 'loading' }
    | {
          readonly status: 'ready';
          readonly items: ReadonlyArray<OwnerPromotionData>;
          readonly pageCount: number;
      }
    | { readonly status: 'error' };

/**
 * Owner promotion list island.
 *
 * @param props - See {@link PromotionListProps}.
 * @returns The `MyContentList` template.
 */
export function PromotionList({
    locale,
    lockPlanNames = [],
    help
}: PromotionListProps): JSX.Element {
    const { t } = createTranslations(locale);
    const { confirm: requestConfirm, confirmDialog } = useConfirm({ locale });
    const [page, setPage] = useState(1);
    const [state, setState] = useState<ListState>({ status: 'loading' });
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [pausingId, setPausingId] = useState<string | null>(null);
    const [gate, setGate] = useState<PlanGate>('checking');

    const fetchPromotions = useCallback(async (target: number) => {
        setState({ status: 'loading' });
        try {
            // The plan gate below is display only; the API decides on save.
            const result = await ownerPromotionApi.list({
                page: target,
                pageSize: ACCOUNT_LIST_PAGE_SIZE
            });
            if (!result.ok) {
                setState({ status: 'error' });
                return;
            }
            const items = transformOwnerPromotionList({
                items: result.data.items as ReadonlyArray<Record<string, unknown>>
            });
            const pageCount = Math.max(1, result.data.pagination?.totalPages ?? 1);
            if (target > pageCount) {
                // The page vanished (e.g. its last item was deleted): clamp and
                // let the page effect refetch the last page that exists.
                setPage(pageCount);
                return;
            }
            setState({ status: 'ready', items, pageCount });
        } catch {
            setState({ status: 'error' });
        }
    }, []);

    useEffect(() => {
        void fetchPromotions(page);
    }, [fetchPromotions, page]);

    useEffect(() => {
        let cancelled = false;
        const check = async (): Promise<void> => {
            const effectiveSet = await getEntitlementsCached({ vertical: 'accommodation' });
            if (cancelled) return;
            // A failed read is not «no plan»: the API decides on save.
            const locked =
                !effectiveSet.failed && (effectiveSet.entitlements.create_promotions ?? 0) <= 0;
            setGate(locked ? 'locked' : 'open');
        };
        void check();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleDelete = useCallback(
        async (promo: OwnerPromotionData) => {
            setDeleteError(null);
            await requestConfirm({
                title: t('host.promotions.kit.deleteTitle', undefined, { title: promo.title }),
                description: t('host.promotions.actions.confirmDelete'),
                confirmLabel: t('host.promotions.actions.delete'),
                onConfirm: async () => {
                    try {
                        const result = await ownerPromotionApi.remove({ id: promo.id });
                        if (!result.ok) {
                            setDeleteError(t('host.promotions.errors.deleteFailed'));
                            return;
                        }
                        void fetchPromotions(page);
                    } catch {
                        setDeleteError(t('host.promotions.errors.deleteFailed'));
                    }
                }
            });
        },
        [requestConfirm, fetchPromotions, page, t]
    );

    const handlePause = useCallback(
        async (promo: OwnerPromotionData) => {
            setDeleteError(null);
            setPausingId(promo.id);
            try {
                const result = await ownerPromotionApi.pause({ id: promo.id });
                if (!result.ok) {
                    setDeleteError(t('host.promotions.errors.pauseFailed'));
                    return;
                }
                void fetchPromotions(page);
            } catch {
                setDeleteError(t('host.promotions.errors.pauseFailed'));
            } finally {
                setPausingId(null);
            }
        },
        [fetchPromotions, page, t]
    );

    const plansHref = buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.owner });
    const createHref = buildUrl({ locale, path: 'mi-cuenta/promociones/nueva' });
    const items = state.status === 'ready' ? state.items : [];

    const listState: MyContentListState =
        state.status === 'loading' ||
        (gate === 'checking' && state.status === 'ready' && items.length === 0)
            ? { status: 'loading' }
            : state.status === 'error'
              ? {
                    status: 'error',
                    title: t('host.promotions.errors.loadFailed'),
                    retry: () => fetchPromotions(page)
                }
              : items.length > 0
                ? { status: 'ready' }
                : gate === 'locked'
                  ? {
                        status: 'locked',
                        reason: {
                            kind: 'plan',
                            feature: t('host.promotions.errors.entitlementRequired'),
                            description: t('host.promotions.errors.entitlementRequiredHint'),
                            plans: lockPlanNames.map((name) => ({ name })),
                            plansHref
                        }
                    }
                  : { status: 'empty' };

    // HOS-2589 D-8 / AC-36: the in-app notice of the «Solo VIP» pause.
    const { titles: vipPausedTitles } = listVipPausedTitles({ items });

    const notice = (
        <>
            {state.status === 'ready' && items.length > 0 && gate === 'locked' ? (
                <Alert
                    tone="warning"
                    locale={locale}
                    title={t('host.promotions.errors.entitlementRequired')}
                    action={
                        <LinkButton
                            href={plansHref}
                            variant="accent"
                            size="sm"
                        >
                            {t('host.promotions.actions.upgradePlan')}
                        </LinkButton>
                    }
                >
                    {t('host.promotions.errors.lockedListHint')}
                </Alert>
            ) : null}
            {vipPausedTitles.length > 0 ? (
                <Alert
                    tone="warning"
                    locale={locale}
                    title={t('host.promotions.vipPaused.title')}
                >
                    {t('host.promotions.vipPaused.body', undefined, {
                        titles: vipPausedTitles.join(', ')
                    })}
                </Alert>
            ) : null}
            {deleteError ? (
                <Alert
                    tone="danger"
                    locale={locale}
                >
                    {deleteError}
                </Alert>
            ) : null}
        </>
    );

    return (
        <>
            <MyContentList
                locale={locale}
                title={t('host.promotions.pageTitle')}
                description={t('host.promotions.pageDescription')}
                help={help}
                createAction={
                    gate === 'open' ? (
                        <LinkButton href={createHref}>
                            {t('host.promotions.createButton')}
                        </LinkButton>
                    ) : undefined
                }
                notice={notice}
                sectionTitle={t('host.promotions.kit.sectionTitle')}
                helpId="section:promotions.list"
                listLabel={t('host.promotions.pageTitle')}
                state={listState}
                empty={<EmptyState title={t('host.promotions.empty')} />}
                pagination={{
                    page,
                    pageCount: state.status === 'ready' ? state.pageCount : 1,
                    onPageChange: setPage
                }}
            >
                {items.map((promo) => {
                    const tone = LIFECYCLE_TONES[promo.lifecycleState];
                    const validity = promo.validUntil
                        ? t('host.promotions.kit.validRange', undefined, {
                              from: formatValidity(promo.validFrom, locale),
                              until: formatValidity(promo.validUntil, locale)
                          })
                        : t('host.promotions.kit.validOpen', undefined, {
                              from: formatValidity(promo.validFrom, locale)
                          });
                    return (
                        <ContentCard
                            key={promo.id}
                            locale={locale}
                            title={promo.title}
                            meta={formatPromotionBenefit({
                                discountType: promo.discountType,
                                discountValue: promo.discountValue,
                                locale,
                                style: 'summary'
                            })}
                            statuses={[
                                {
                                    key: 'lifecycle',
                                    label: t('host.promotions.kit.statusLabel'),
                                    value: (
                                        <StatusPill tone={tone ?? 'neutral'}>
                                            {t(
                                                `host.promotions.lifecycleStates.${promo.lifecycleState.toLowerCase()}`,
                                                promo.lifecycleState
                                            )}
                                        </StatusPill>
                                    )
                                },
                                {
                                    key: 'validity',
                                    label: t('host.promotions.kit.validityLabel'),
                                    value: validity
                                }
                            ]}
                            actions={
                                <>
                                    {gate === 'locked' ? (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            disabled
                                            aria-label={t(
                                                'host.promotions.kit.editNamed',
                                                undefined,
                                                { title: promo.title }
                                            )}
                                        >
                                            {t('host.promotions.actions.edit')}
                                        </Button>
                                    ) : (
                                        <LinkButton
                                            href={buildUrl({
                                                locale,
                                                path: `mi-cuenta/promociones/${promo.id}/editar`
                                            })}
                                            variant="secondary"
                                            size="sm"
                                            aria-label={t(
                                                'host.promotions.kit.editNamed',
                                                undefined,
                                                { title: promo.title }
                                            )}
                                        >
                                            {t('host.promotions.actions.edit')}
                                        </LinkButton>
                                    )}
                                    {gate === 'locked' && promo.lifecycleState === 'ACTIVE' ? (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            loading={pausingId === promo.id}
                                            aria-label={t(
                                                'host.promotions.kit.pauseNamed',
                                                undefined,
                                                { title: promo.title }
                                            )}
                                            onClick={() => void handlePause(promo)}
                                        >
                                            {t('host.promotions.actions.pause')}
                                        </Button>
                                    ) : null}
                                    <Button
                                        variant="danger-ghost"
                                        size="sm"
                                        aria-label={t(
                                            'host.promotions.kit.deleteNamed',
                                            undefined,
                                            {
                                                title: promo.title
                                            }
                                        )}
                                        onClick={() => void handleDelete(promo)}
                                    >
                                        {t('host.promotions.actions.delete')}
                                    </Button>
                                </>
                            }
                        />
                    );
                })}
            </MyContentList>
            {confirmDialog}
        </>
    );
}
