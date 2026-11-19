import {
    OwnerPromotionDiscountTypeEnum,
    VenuePromotionCreateRequestSchema,
    type VenuePromotionListOutput
} from '@repo/schemas';
import { formatCalendarDate } from '@repo/utils';
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { isUnlimitedLimit } from '@/components/billing/plan-card-delta';
import fieldStyles from '@/components/listing/editor/editor-fields.module.css';
import { venuePromotionsApi } from '@/lib/api/endpoints-protected';
import type { ApiError } from '@/lib/api/types';
import { buildLimitReachedPayloadFromDetails } from '@/lib/billing-limit-error';
import { showConfirmationDialog } from '@/lib/forms/show-confirmation-dialog';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { formatPromotionBenefit } from '@/lib/promotions/format-benefit';
import styles from './VenuePromotionsManager.module.css';

type PromotionRow = VenuePromotionListOutput['items'][number];
type VenueDiscountType = PromotionRow['discountType'];

/** Converts a serialized or parsed API date to the native date input format. */
function toDateInputValue(value: Date | string): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

/** Returns a timestamp for a serialized or parsed API date. */
function toTimestamp(value: Date | string): number {
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Narrows a native select value to the venue promotion benefits in the schema. */
function parseVenueDiscountType(value: string): VenueDiscountType | null {
    if (value === OwnerPromotionDiscountTypeEnum.PERCENTAGE)
        return OwnerPromotionDiscountTypeEnum.PERCENTAGE;
    if (value === OwnerPromotionDiscountTypeEnum.FIXED) return OwnerPromotionDiscountTypeEnum.FIXED;
    if (value === OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER)
        return OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER;
    return null;
}

interface Props {
    readonly listingId: string;
    readonly locale: SupportedLocale;
    readonly sectionState: 'locked' | 'available';
    readonly upsellPlanName: string | null;
}

/** Owner editor for the venue's own promotions. */
export function VenuePromotionsManager({ listingId, locale, sectionState, upsellPlanName }: Props) {
    const { t } = createTranslations(locale);
    const headingId = useId();
    const titleInputRef = useRef<HTMLInputElement>(null);
    const [items, setItems] = useState<readonly PromotionRow[]>([]);
    const [activeCount, setActiveCount] = useState(0);
    const [maxActive, setMaxActive] = useState(0);
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
    const [message, setMessage] = useState('');
    const [offerError, setOfferError] = useState('');
    const lockedWithoutPlan = sectionState === 'locked' && upsellPlanName === null;

    const lockedMessage = () =>
        upsellPlanName
            ? t(
                  'venue.owner.editor.promotionsManager.locked',
                  'Disponible desde el plan {{plan}}.',
                  { plan: upsellPlanName }
              )
            : t(
                  'venue.owner.editor.promotionsManager.lockedNoPlan',
                  'Esta función todavía no está disponible para tu plan.'
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
        setFormOpen(false);
        setMessage('');
        setOfferError('');
    };

    const openEdit = (item: PromotionRow) => {
        if (sectionState === 'locked') {
            setMessage(lockedMessage());
            return;
        }
        setEditing(item);
        setTitle(item.title);
        setDescription(item.description ?? '');
        setDiscountType(item.discountType);
        setDiscountValue(item.discountValue === null ? '' : String(item.discountValue));
        setValidFrom(toDateInputValue(item.validFrom));
        setValidUntil(item.validUntil ? toDateInputValue(item.validUntil) : '');
        setFormOpen(true);
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
            validUntil: validUntil || null
        };
        const parsed = VenuePromotionCreateRequestSchema.safeParse(body);
        if (!parsed.success) {
            setMessage(
                t(
                    'venue.owner.editor.promotionsManager.invalid',
                    'Revisá los campos del formulario.'
                )
            );
            return;
        }
        const result = editing
            ? await venuePromotionsApi.update({
                  id: listingId,
                  promotionId: editing.id,
                  body: parsed.data
              })
            : await venuePromotionsApi.create({ id: listingId, body: parsed.data });
        if (!result.ok) {
            const errorText = apiErrorMessage(result.error);
            setMessage(errorText);
            if (discountType === 'special_offer') setOfferError(errorText);
            return;
        }
        const cacheNotice = t(
            'venue.owner.editor.promotionsManager.cacheNotice',
            'Puede tardar unos minutos en verse en la ficha.'
        );
        await load();
        resetForm();
        setMessage(cacheNotice);
    };

    const changeState = async (item: PromotionRow, state: string) => {
        if (state === 'ACTIVE' && sectionState === 'locked') {
            setMessage(lockedMessage());
            return;
        }
        const result = await venuePromotionsApi.patch({
            id: listingId,
            promotionId: item.id,
            body: { lifecycleState: state }
        });
        if (result.ok) await load();
        else setMessage(apiErrorMessage(result.error));
    };

    const remove = async (item: PromotionRow) => {
        const confirmed = await showConfirmationDialog({
            title: t('venue.owner.editor.promotionsManager.deleteTitle', 'Borrar promoción'),
            message: t(
                'venue.owner.editor.promotionsManager.deleteConfirm',
                '¿Querés borrar esta promoción?'
            ),
            confirmLabel: t('venue.owner.editor.promotionsManager.actions.delete'),
            cancelLabel: t('common.cancel', 'Cancelar')
        });
        if (!confirmed) return;
        const result = await venuePromotionsApi.remove({ id: listingId, promotionId: item.id });
        if (result.ok) await load();
        else setMessage(apiErrorMessage(result.error));
    };

    const lifecycleLabel = (item: PromotionRow): string => {
        const isExpired =
            item.lifecycleState === 'ACTIVE' &&
            item.validUntil != null &&
            toTimestamp(item.validUntil) < Date.now();
        const key = isExpired
            ? 'expired'
            : item.lifecycleState === 'ACTIVE'
              ? 'active'
              : item.lifecycleState === 'DRAFT'
                ? 'draft'
                : 'paused';
        const fallback =
            key === 'active'
                ? 'Activa'
                : key === 'draft'
                  ? 'Borrador'
                  : key === 'paused'
                    ? 'Pausada'
                    : 'Vencida';
        return t(`venue.owner.editor.promotionsManager.states.${key}`, fallback);
    };

    if (lockedWithoutPlan) return null;
    return (
        <section
            className={fieldStyles.section}
            aria-labelledby={headingId}
        >
            <h2
                id={headingId}
                className={fieldStyles.label}
            >
                {t('venue.owner.editor.promotionsManager.title', 'Promociones')}
            </h2>
            <p>
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
            {sectionState === 'locked' && (
                <p role="status">
                    {t(
                        'venue.owner.editor.promotionsManager.locked',
                        'Disponible desde el plan {{plan}}.',
                        { plan: upsellPlanName ?? '' }
                    )}
                </p>
            )}
            {!loading &&
                sectionState === 'available' &&
                !isUnlimitedLimit({ value: maxActive }) &&
                activeCount >= maxActive && (
                    <p role="status">
                        {upsellPlanName
                            ? t(
                                  'venue.owner.editor.promotionsManager.limitReached',
                                  'Alcanzaste el tope. El plan {{plan}} permite más promociones.',
                                  { plan: upsellPlanName }
                              )
                            : t(
                                  'venue.owner.editor.promotionsManager.limitReachedNoPlan',
                                  'Alcanzaste el tope de promociones de tu plan.'
                              )}
                    </p>
                )}
            {loading ? (
                <p>{t('common.loading', 'Cargando…')}</p>
            ) : error ? (
                <button
                    type="button"
                    onClick={() => void load()}
                >
                    {t('common.retry', 'Reintentar')}
                </button>
            ) : items.length === 0 ? (
                <p>
                    {t(
                        'venue.owner.editor.promotionsManager.empty',
                        'Todavía no cargaste promociones.'
                    )}
                </p>
            ) : (
                <ul className={styles.list}>
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className={styles.item}
                        >
                            <strong>{item.title}</strong>
                            <span>
                                {formatPromotionBenefit({
                                    discountType: item.discountType,
                                    discountValue: item.discountValue,
                                    locale,
                                    specialOfferText: item.description
                                })}
                            </span>
                            <span>{lifecycleLabel(item)}</span>
                            <small>
                                {formatCalendarDate({
                                    value: item.validFrom,
                                    locale,
                                    options: { dateStyle: 'long' }
                                })}{' '}
                                –{' '}
                                {item.validUntil
                                    ? formatCalendarDate({
                                          value: item.validUntil,
                                          locale,
                                          options: { dateStyle: 'long' }
                                      })
                                    : t('venue.detail.promotions.noEndDate', 'Sin fecha de fin')}
                            </small>
                            <button
                                type="button"
                                onClick={() => openEdit(item)}
                            >
                                {t('venue.owner.editor.promotionsManager.actions.edit')}
                            </button>
                            {item.lifecycleState === 'ACTIVE' ? (
                                <button
                                    type="button"
                                    onClick={() => void changeState(item, 'PAUSED')}
                                >
                                    {t('venue.owner.editor.promotionsManager.actions.pause')}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => void changeState(item, 'ACTIVE')}
                                >
                                    {t('venue.owner.editor.promotionsManager.actions.activate')}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => void remove(item)}
                            >
                                {t('venue.owner.editor.promotionsManager.actions.delete')}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <button
                type="button"
                disabled={sectionState === 'locked' || activeCount >= maxActive}
                onClick={() => {
                    if (sectionState === 'locked' || activeCount >= maxActive)
                        setMessage(lockedMessage());
                    else setFormOpen(true);
                }}
            >
                {t('venue.owner.editor.promotionsManager.create', 'Nueva promoción')}
            </button>
            {message && <p role="status">{message}</p>}
            {(formOpen || editing) && (
                <form
                    className={styles.form}
                    onSubmit={(event) => void submit(event)}
                >
                    <label>
                        {t('venue.owner.editor.promotionsManager.name', 'Título')}
                        <input
                            ref={titleInputRef}
                            required
                            maxLength={200}
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </label>
                    <label>
                        {t('venue.owner.editor.promotionsManager.discountType', 'Beneficio')}
                        <select
                            value={discountType}
                            onChange={(event) => {
                                const value = parseVenueDiscountType(event.target.value);
                                if (value) setDiscountType(value);
                            }}
                        >
                            <option value="percentage">
                                {t('host.promotions.discountTypes.percentage', 'Porcentaje')}
                            </option>
                            <option value="fixed">
                                {t('host.promotions.discountTypes.fixed', 'Monto')}
                            </option>
                            <option value="special_offer">
                                {t(
                                    'host.promotions.discountTypes.special_offer',
                                    'Oferta especial'
                                )}
                            </option>
                        </select>
                    </label>
                    {discountType === 'special_offer' ? (
                        <label>
                            {t('host.promotions.specialOffer.label', 'Contá el beneficio')}
                            <textarea
                                required
                                maxLength={1000}
                                value={description}
                                onChange={(event) => {
                                    setDescription(event.target.value);
                                    setOfferError('');
                                }}
                            />
                            <small>
                                {t(
                                    'host.promotions.specialOffer.help',
                                    'Contá el beneficio en pocas palabras, por ejemplo 2x1 en tragos.'
                                )}
                            </small>
                            <small>{description.length}/1000</small>
                            {offerError && <small role="alert">{offerError}</small>}
                        </label>
                    ) : (
                        <>
                            <label>
                                {t('venue.owner.editor.promotionsManager.value', 'Valor')}
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    max={discountType === 'percentage' ? 100 : undefined}
                                    value={discountValue}
                                    onChange={(event) => setDiscountValue(event.target.value)}
                                />
                            </label>
                            <label>
                                {t('venue.owner.editor.promotionsManager.condition', 'Condición')}
                                <textarea
                                    maxLength={1000}
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                />
                            </label>
                        </>
                    )}
                    <label>
                        {t('venue.owner.editor.promotionsManager.validFrom', 'Válida desde')}
                        <input
                            required
                            type="date"
                            value={validFrom}
                            onChange={(event) => setValidFrom(event.target.value)}
                        />
                    </label>
                    <label>
                        {t('venue.owner.editor.promotionsManager.validUntil', 'Válida hasta')}
                        <input
                            type="date"
                            value={validUntil}
                            onChange={(event) => setValidUntil(event.target.value)}
                        />
                    </label>
                    <button type="submit">
                        {t('venue.owner.editor.promotionsManager.actions.save')}
                    </button>
                    <button
                        type="button"
                        onClick={resetForm}
                    >
                        {t('common.cancel', 'Cancelar')}
                    </button>
                </form>
            )}
        </section>
    );
}
