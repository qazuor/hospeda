/**
 * @file VenuePromotionsManager.client.tsx
 * @description Owner editor for the venue's own promotions, on the kit
 * (HOS-2504): `Section`, `DataList` rows, `StatusPill`, `LockedState`,
 * `ConfirmDialog` through `useConfirm`, and the editor's auto-save chip.
 *
 * This is an `auto` section: every action persists itself, so each one reports
 * through `runRetryableEditorAutoSave`.
 */

import { AddIcon } from '@repo/icons';
import {
    LifecycleStatusEnum,
    OwnerPromotionDiscountTypeEnum,
    TouristAudienceEnum,
    VenuePromotionCreateRequestSchema
} from '@repo/schemas';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { runRetryableEditorAutoSave } from '@/components/account/editor-shell/editor-auto-save-signal';
import { Alert } from '@/components/account/ui/Alert';
import { Button } from '@/components/account/ui/Button';
import { EmptyState } from '@/components/account/ui/EmptyState';
import { ErrorState } from '@/components/account/ui/ErrorState';
import { LockedState } from '@/components/account/ui/LockedState';
import { Section } from '@/components/account/ui/Section';
import { Skeleton } from '@/components/account/ui/Skeleton';
import { useConfirm } from '@/components/account/ui/use-confirm';
import { isUnlimitedLimit } from '@/components/billing/plan-card-delta';
import {
    type PromotionAudience,
    PromotionAudienceField
} from '@/components/host/PromotionAudienceField';
import { venuePromotionsApi } from '@/lib/api/endpoints-protected';
import type { ApiError } from '@/lib/api/types';
import { buildLimitReachedPayloadFromDetails } from '@/lib/billing-limit-error';
import { getEntitlementsCached } from '@/lib/entitlements-cache';
import { sectionHelpId } from '@/lib/help/section-help-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { listVipPausedTitles } from '@/lib/promotions/vip-paused';
import { buildUrl } from '@/lib/urls';
import {
    resolveVenuePromotionLimitPlanName,
    type VenuePromotionLimitPlanOption
} from '@/lib/venue/section-upsell-plan';
import { type PromotionRow, toDateInputValue } from './promotion-lifecycle';
import { VenuePromotionForm } from './VenuePromotionForm.client';
import { VenuePromotionList } from './VenuePromotionList.client';
import styles from './VenuePromotionsManager.module.css';

export { resolvePromotionLifecycleState } from './promotion-lifecycle';

type VenueDiscountType = PromotionRow['discountType'];

interface Props {
    /** HOS-2589: X and the VIP plan name from the tourist catalog (SSR); `null` if unreadable. */
    readonly freeQuota?: number | null;
    readonly vipPlanName?: string | null;
    readonly listingId: string;
    readonly locale: SupportedLocale;
    readonly sectionState: 'locked' | 'available';
    readonly upsellPlanName: string | null;
    readonly limitPlanOptions: readonly VenuePromotionLimitPlanOption[];
}

/** The update body without its audience (the create schema defaults it to `plus`). */
function omitAudience<T extends { readonly touristAudience?: unknown }>(
    body: T
): Omit<T, 'touristAudience'> {
    const { touristAudience: _omitted, ...rest } = body;
    return rest;
}

/** Owner editor for the venue's own promotions. */
export function VenuePromotionsManager({
    listingId,
    locale,
    sectionState,
    upsellPlanName,
    limitPlanOptions,
    freeQuota = null,
    vipPlanName = null
}: Props) {
    const { t } = createTranslations(locale);
    const { confirm: askConfirm, confirmDialog } = useConfirm({ locale });
    const titleInputRef = useRef<HTMLInputElement>(null);
    const [items, setItems] = useState<readonly PromotionRow[]>([]);
    const [activeCount, setActiveCount] = useState(0);
    const [maxActive, setMaxActive] = useState(0);
    const limitUpsellPlanName = resolveVenuePromotionLimitPlanName({
        options: limitPlanOptions,
        maxActive
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [editing, setEditing] = useState<PromotionRow | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [discountType, setDiscountType] = useState<VenueDiscountType>(
        OwnerPromotionDiscountTypeEnum.PERCENTAGE
    );
    const [discountValue, setDiscountValue] = useState('');
    const [validFrom, setValidFrom] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [windowEnabled, setWindowEnabled] = useState(false);
    const [windowWeekdays, setWindowWeekdays] = useState<number[]>([]);
    const [windowStart, setWindowStart] = useState('');
    const [windowEnd, setWindowEnd] = useState('');
    const [message, setMessage] = useState('');
    const [messageTone, setMessageTone] = useState<'info' | 'danger'>('info');
    const [offerError, setOfferError] = useState('');
    const [now, setNow] = useState<number | null>(null);
    // HOS-2589: who sees it, and whether the plan lets the owner pick «Solo VIP».
    const [audience, setAudience] = useState<PromotionAudience>(TouristAudienceEnum.PLUS);
    const [initialAudience, setInitialAudience] = useState<PromotionAudience>(
        TouristAudienceEnum.PLUS
    );
    const [vipOnlyAllowed, setVipOnlyAllowed] = useState(false);
    useEffect(() => {
        let cancelled = false;
        const check = async (): Promise<void> => {
            const effectiveSet = await getEntitlementsCached({ vertical: 'venue' });
            if (cancelled) return;
            setVipOnlyAllowed(
                !effectiveSet.failed && (effectiveSet.entitlements.vip_only_promotions ?? 0) > 0
            );
        };
        void check();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => setNow(Date.now()), []);

    const lockedMessage = () =>
        upsellPlanName
            ? t(
                  'venue.owner.editor.promotionsManager.locked',
                  'Disponible desde el plan {{plan}}.',
                  { plan: upsellPlanName }
              )
            : t(
                  'venue.owner.editor.promotionsManager.lockedNoPlan',
                  'Las promociones todavía no están disponibles para tu plan.'
              );

    const apiErrorMessage = (apiError: ApiError): string => {
        if (apiError.status === 403 && apiError.code === 'LIMIT_REACHED') {
            return buildLimitReachedPayloadFromDetails({ details: apiError.details, locale })
                .message;
        }
        if (apiError.code === 'ENTITLEMENT_REQUIRED') return lockedMessage();
        return t(
            apiError.message,
            'No se pudo completar la acción. Revisá los datos e intentá de nuevo.'
        );
    };

    const load = useCallback(async () => {
        setLoading(true);
        const result = await venuePromotionsApi.list({ id: listingId });
        if (result.ok) {
            setItems(result.data.items);
            setActiveCount(result.data.meta.activeCount);
            setMaxActive(result.data.meta.maxActive);
            setError(false);
        } else setError(true);
        setLoading(false);
    }, [listingId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (formOpen) titleInputRef.current?.focus();
    }, [formOpen]);

    const resetForm = () => {
        setEditing(null);
        setTitle('');
        setDescription('');
        setDiscountValue('');
        setValidFrom('');
        setValidUntil('');
        setWindowEnabled(false);
        setWindowWeekdays([]);
        setWindowStart('');
        setWindowEnd('');
        setAudience(TouristAudienceEnum.PLUS);
        setInitialAudience(TouristAudienceEnum.PLUS);
        setFormOpen(false);
        setMessage('');
        setOfferError('');
    };

    const openEdit = (item: PromotionRow) => {
        if (sectionState === 'locked') {
            notify(lockedMessage(), 'info');
            return;
        }
        setEditing(item);
        setTitle(item.title);
        setDescription(item.description ?? '');
        setDiscountType(item.discountType);
        setDiscountValue(item.discountValue === null ? '' : String(item.discountValue));
        setValidFrom(toDateInputValue(item.validFrom));
        setValidUntil(item.validUntil ? toDateInputValue(item.validUntil) : '');
        setWindowEnabled(item.window !== null);
        setWindowWeekdays(item.window?.weekdays ?? []);
        setWindowStart(item.window?.startTime ?? '');
        setWindowEnd(item.window?.endTime ?? '');
        const stored =
            item.touristAudience === TouristAudienceEnum.VIP
                ? TouristAudienceEnum.VIP
                : TouristAudienceEnum.PLUS;
        setAudience(stored);
        setInitialAudience(stored);
        setFormOpen(true);
    };

    const notify = (text: string, tone: 'info' | 'danger') => {
        setMessageTone(tone);
        setMessage(text);
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const body = {
            title,
            description: discountType === 'special_offer' ? null : description,
            discountType,
            ...(discountType === 'special_offer'
                ? { specialOfferText: description }
                : { discountValue: Number(discountValue) }),
            validFrom,
            validUntil: validUntil || null,
            window: windowEnabled
                ? { weekdays: windowWeekdays, startTime: windowStart, endTime: windowEnd }
                : null,
            touristAudience: audience
        };
        // AC-2: «Para todos» always stores plus; an unchanged «Solo VIP» on edit is
        // not re-sent, so a paused one stays editable without the key (D-8).
        const keepsVip =
            editing !== null &&
            audience === TouristAudienceEnum.VIP &&
            initialAudience === TouristAudienceEnum.VIP;
        const parsed = VenuePromotionCreateRequestSchema.safeParse(body);
        if (!parsed.success) {
            notify(
                t(
                    'venue.owner.editor.promotionsManager.invalid',
                    'Revisá los campos del formulario.'
                ),
                'danger'
            );
            return;
        }
        const promotionId = editing?.id;
        await runRetryableEditorAutoSave({
            save: async () => {
                const result = promotionId
                    ? await venuePromotionsApi.update({
                          id: listingId,
                          promotionId,
                          body: keepsVip ? omitAudience(parsed.data) : parsed.data
                      })
                    : await venuePromotionsApi.create({ id: listingId, body: parsed.data });
                if (!result.ok) {
                    const errorText = apiErrorMessage(result.error);
                    notify(errorText, 'danger');
                    if (discountType === 'special_offer') setOfferError(errorText);
                    return false;
                }
                // The retry of a failed save re-runs this too, so the list and
                // the form catch up whichever attempt succeeds.
                await load();
                resetForm();
                notify(
                    t(
                        'venue.owner.editor.promotionsManager.cacheNotice',
                        'Puede tardar unos minutos en verse en la ficha.'
                    ),
                    'info'
                );
                return true;
            }
        });
    };

    const changeState = async (item: PromotionRow, state: LifecycleStatusEnum) => {
        if (state === LifecycleStatusEnum.ACTIVE && sectionState === 'locked') {
            notify(lockedMessage(), 'info');
            return;
        }
        await runRetryableEditorAutoSave({
            save: async () => {
                const result = await venuePromotionsApi.patch({
                    id: listingId,
                    promotionId: item.id,
                    body: { lifecycleState: state }
                });
                if (!result.ok) {
                    notify(apiErrorMessage(result.error), 'danger');
                    return false;
                }
                await load();
                return true;
            }
        });
    };

    const remove = async (item: PromotionRow) => {
        const confirmed = await askConfirm({
            title: t('venue.owner.editor.promotionsManager.deleteTitle', 'Borrar promoción'),
            description: t(
                'venue.owner.editor.promotionsManager.deleteConfirm',
                '¿Querés borrar esta promoción?'
            ),
            confirmLabel: t('venue.owner.editor.promotionsManager.actions.delete'),
            cancelLabel: t('common.cancel', 'Cancelar')
        });
        if (!confirmed) return;
        await runRetryableEditorAutoSave({
            save: async () => {
                const result = await venuePromotionsApi.remove({
                    id: listingId,
                    promotionId: item.id
                });
                if (!result.ok) {
                    notify(apiErrorMessage(result.error), 'danger');
                    return false;
                }
                await load();
                return true;
            }
        });
    };

    // HOS-2589 D-8 / AC-36: the in-app notice of the «Solo VIP» pause.
    const { titles: vipPausedTitles } = listVipPausedTitles({ items });

    return (
        <Section
            title={t('venue.owner.editor.promotionsManager.title', 'Promociones')}
            helpId={sectionHelpId({ vertical: 'venue', slug: 'promociones' })}
        >
            <div className={styles.stack}>
                {vipPausedTitles.length > 0 ? (
                    <Alert
                        locale={locale}
                        tone="warning"
                        title={t('host.promotions.vipPaused.title')}
                    >
                        {t('host.promotions.vipPaused.body', undefined, {
                            titles: vipPausedTitles.join(', ')
                        })}
                    </Alert>
                ) : null}
                <p className={styles.count}>
                    {isUnlimitedLimit({ value: maxActive })
                        ? t(
                              'venue.owner.editor.promotionsManager.unlimitedCount',
                              'Promociones activas: {{count}} · sin tope',
                              { count: activeCount }
                          )
                        : t(
                              'venue.owner.editor.promotionsManager.count',
                              'Promociones activas: {{count}} / {{max}}',
                              { count: activeCount, max: maxActive }
                          )}
                </p>
                {sectionState === 'locked' &&
                    (upsellPlanName ? (
                        <LockedState
                            locale={locale}
                            reason={{
                                kind: 'plan',
                                feature: t(
                                    'venue.owner.editor.promotionsManager.title',
                                    'Promociones'
                                ),
                                description: lockedMessage(),
                                plans: [{ name: upsellPlanName }],
                                plansHref: buildUrl({
                                    locale,
                                    path: PRICING_PAGE_PATH_BY_AUDIENCE.venue
                                })
                            }}
                        />
                    ) : (
                        <Alert
                            locale={locale}
                            tone="info"
                        >
                            {lockedMessage()}
                        </Alert>
                    ))}
                {/* Owner decision 18: locked promotions are view + pause only. */}
                {sectionState === 'locked' && items.length > 0 ? (
                    <Alert
                        locale={locale}
                        tone="info"
                    >
                        {t('venue.owner.editor.promotionsManager.lockedExisting')}
                    </Alert>
                ) : null}
                {!loading &&
                    sectionState === 'available' &&
                    !isUnlimitedLimit({ value: maxActive }) &&
                    activeCount >= maxActive && (
                        <Alert
                            locale={locale}
                            tone="warning"
                        >
                            {limitUpsellPlanName
                                ? t(
                                      'venue.owner.editor.promotionsManager.limitReached',
                                      'Alcanzaste el tope. El plan {{plan}} permite más promociones.',
                                      { plan: limitUpsellPlanName }
                                  )
                                : t(
                                      'venue.owner.editor.promotionsManager.limitReachedNoPlan',
                                      'Alcanzaste el tope de promociones de tu plan.'
                                  )}
                        </Alert>
                    )}
                {loading ? (
                    <Skeleton
                        locale={locale}
                        lines={3}
                    />
                ) : error ? (
                    <ErrorState
                        locale={locale}
                        onRetry={load}
                    />
                ) : items.length === 0 ? (
                    <EmptyState
                        variant="compact"
                        title={t(
                            'venue.owner.editor.promotionsManager.empty',
                            'Todavía no cargaste promociones.'
                        )}
                    />
                ) : (
                    <VenuePromotionList
                        locale={locale}
                        items={items}
                        now={now}
                        sectionState={sectionState}
                        onEdit={openEdit}
                        onActivate={(item) => void changeState(item, LifecycleStatusEnum.ACTIVE)}
                        onPause={(item) => void changeState(item, LifecycleStatusEnum.INACTIVE)}
                        onDelete={(item) => void remove(item)}
                    />
                )}
                {sectionState === 'available' && (
                    <div>
                        <Button
                            variant="primary"
                            disabled={activeCount >= maxActive}
                            onClick={() => setFormOpen(true)}
                        >
                            <AddIcon
                                size="sm"
                                aria-hidden="true"
                            />
                            {t('venue.owner.editor.promotionsManager.create', 'Agregar promoción')}
                        </Button>
                    </div>
                )}
                {message && (
                    <Alert
                        locale={locale}
                        tone={messageTone}
                    >
                        {message}
                    </Alert>
                )}
                {(formOpen || editing) && (
                    <VenuePromotionForm
                        locale={locale}
                        titleInputRef={titleInputRef}
                        onSubmit={(event) => void submit(event)}
                        onCancel={resetForm}
                        title={title}
                        setTitle={setTitle}
                        description={description}
                        setDescription={setDescription}
                        discountType={discountType}
                        setDiscountType={setDiscountType}
                        discountValue={discountValue}
                        setDiscountValue={setDiscountValue}
                        validFrom={validFrom}
                        setValidFrom={setValidFrom}
                        validUntil={validUntil}
                        setValidUntil={setValidUntil}
                        offerError={offerError}
                        setOfferError={setOfferError}
                        windowEnabled={windowEnabled}
                        setWindowEnabled={setWindowEnabled}
                        windowWeekdays={windowWeekdays}
                        setWindowWeekdays={setWindowWeekdays}
                        windowStart={windowStart}
                        setWindowStart={setWindowStart}
                        windowEnd={windowEnd}
                        setWindowEnd={setWindowEnd}
                        audienceField={
                            <PromotionAudienceField
                                locale={locale}
                                t={t}
                                name="venue-promotion-touristAudience"
                                value={audience}
                                onChange={setAudience}
                                freeQuota={freeQuota}
                                vipPlanName={vipPlanName}
                                vipOnlyAllowed={vipOnlyAllowed}
                                plansHref={buildUrl({
                                    locale,
                                    path: PRICING_PAGE_PATH_BY_AUDIENCE.venue
                                })}
                            />
                        }
                    />
                )}
                {confirmDialog}
            </div>
        </Section>
    );
}
