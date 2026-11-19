import type { VenuePromotionListOutput } from '@repo/schemas';
import { OwnerPromotionDiscountTypeEnum } from '@repo/schemas';
import type { Dispatch, FormEventHandler, RefObject, SetStateAction } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { formatPromotionWindow } from '@/lib/venue/promotion-window';
import styles from './VenuePromotionsManager.module.css';

type VenueDiscountType = VenuePromotionListOutput['items'][number]['discountType'];

function parseVenueDiscountType(value: string): VenueDiscountType | null {
    if (value === OwnerPromotionDiscountTypeEnum.PERCENTAGE)
        return OwnerPromotionDiscountTypeEnum.PERCENTAGE;
    if (value === OwnerPromotionDiscountTypeEnum.FIXED) return OwnerPromotionDiscountTypeEnum.FIXED;
    if (value === OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER)
        return OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER;
    return null;
}

interface Props {
    readonly locale: SupportedLocale;
    readonly titleInputRef: RefObject<HTMLInputElement | null>;
    readonly onSubmit: FormEventHandler<HTMLFormElement>;
    readonly onCancel: () => void;
    readonly title: string;
    readonly setTitle: Dispatch<SetStateAction<string>>;
    readonly description: string;
    readonly setDescription: Dispatch<SetStateAction<string>>;
    readonly discountType: VenueDiscountType;
    readonly setDiscountType: Dispatch<SetStateAction<VenueDiscountType>>;
    readonly discountValue: string;
    readonly setDiscountValue: Dispatch<SetStateAction<string>>;
    readonly validFrom: string;
    readonly setValidFrom: Dispatch<SetStateAction<string>>;
    readonly validUntil: string;
    readonly setValidUntil: Dispatch<SetStateAction<string>>;
    readonly offerError: string;
    readonly setOfferError: Dispatch<SetStateAction<string>>;
    readonly windowEnabled: boolean;
    readonly setWindowEnabled: Dispatch<SetStateAction<boolean>>;
    readonly windowWeekdays: number[];
    readonly setWindowWeekdays: Dispatch<SetStateAction<number[]>>;
    readonly windowStart: string;
    readonly setWindowStart: Dispatch<SetStateAction<string>>;
    readonly windowEnd: string;
    readonly setWindowEnd: Dispatch<SetStateAction<string>>;
}

/** Owner editor form for a venue promotion and its optional weekly window. */
export function VenuePromotionForm({
    locale,
    titleInputRef,
    onSubmit,
    onCancel,
    title,
    setTitle,
    description,
    setDescription,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    validFrom,
    setValidFrom,
    validUntil,
    setValidUntil,
    offerError,
    setOfferError,
    windowEnabled,
    setWindowEnabled,
    windowWeekdays,
    setWindowWeekdays,
    windowStart,
    setWindowStart,
    windowEnd,
    setWindowEnd
}: Props) {
    const { t } = createTranslations(locale);
    return (
        <form
            className={styles.form}
            onSubmit={onSubmit}
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
                        {t('host.promotions.discountTypes.special_offer', 'Oferta especial')}
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
            <fieldset>
                <legend>
                    {t(
                        'venue.owner.editor.promotionsManager.window.title',
                        'Solo en ciertos días y horas'
                    )}
                </legend>
                <label>
                    <input
                        type="checkbox"
                        checked={windowEnabled}
                        onChange={(event) => setWindowEnabled(event.target.checked)}
                    />
                    {t(
                        'venue.owner.editor.promotionsManager.window.enable',
                        'Activar franja semanal'
                    )}
                </label>
                {windowEnabled && (
                    <>
                        <div className={styles.weekdays}>
                            {[1, 2, 3, 4, 5, 6, 0].map((weekday, index) => (
                                <label key={weekday}>
                                    <input
                                        type="checkbox"
                                        checked={windowWeekdays.includes(weekday)}
                                        onChange={(event) =>
                                            setWindowWeekdays((current) =>
                                                event.target.checked
                                                    ? [...current, weekday]
                                                    : current.filter((day) => day !== weekday)
                                            )
                                        }
                                    />
                                    {t(
                                        `venue.detail.promotions.window.days.${index}`,
                                        ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][index] ??
                                            ''
                                    )}
                                </label>
                            ))}
                        </div>
                        <label>
                            {t('venue.owner.editor.promotionsManager.window.start', 'Desde')}
                            <input
                                type="time"
                                value={windowStart}
                                onChange={(event) => setWindowStart(event.target.value)}
                            />
                        </label>
                        <label>
                            {t('venue.owner.editor.promotionsManager.window.end', 'Hasta')}
                            <input
                                type="time"
                                value={windowEnd}
                                onChange={(event) => setWindowEnd(event.target.value)}
                            />
                        </label>
                        {windowStart && windowEnd && windowEnd <= windowStart && (
                            <small>
                                {t(
                                    'venue.owner.editor.promotionsManager.window.overnight',
                                    'Termina después de la medianoche, el día siguiente'
                                )}
                            </small>
                        )}
                        {windowWeekdays.length > 0 && windowStart && windowEnd && (
                            <small>
                                {formatPromotionWindow({
                                    window: {
                                        weekdays: windowWeekdays,
                                        startTime: windowStart,
                                        endTime: windowEnd
                                    },
                                    locale
                                })}
                            </small>
                        )}
                    </>
                )}
                <small>
                    {t(
                        'venue.owner.editor.promotionsManager.window.eventsHint',
                        'Si es una entrada fija de tu agenda, cargala en Eventos. Acá va el beneficio.'
                    )}
                </small>
            </fieldset>
            <button type="submit">{t('venue.owner.editor.promotionsManager.actions.save')}</button>
            <button
                type="button"
                onClick={onCancel}
            >
                {t('common.cancel', 'Cancelar')}
            </button>
        </form>
    );
}
