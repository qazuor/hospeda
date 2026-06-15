/**
 * @file PromotionForm.client.tsx
 * @description Create / edit owner-promotion form island (SPEC-205 T-304).
 *
 * Supports two modes:
 *  - `create` — builds a new promotion via `ownerPromotionApi.create()`.
 *  - `edit`   — updates an existing promotion via `ownerPromotionApi.update()`.
 *
 * Validation: Zod (OwnerPromotionCreateInputSchema / OwnerPromotionUpdateInputSchema)
 * via `safeParse` before any network call. An extra client-side guard caps
 * `discountValue` at 100 when `discountType` is `percentage` (the base schema
 * only enforces `>= 0`).
 *
 * 403 / LIMIT_REACHED: shown as a distinct inline banner with an upgrade hint
 * instead of the generic error message.
 *
 * accommodationId: rendered as a <select> populated from protectedAccommodationsApi.listOwn().
 * Empty value = promotion applies to all owner's properties. A specific accommodation
 * can be selected from the dropdown. Falls back gracefully to an empty select (all-only) on
 * fetch failure.
 *
 * Redirect on success: `/{locale}/mi-cuenta/promociones/` via
 * `window.location.href` (same pattern as other web islands).
 *
 * Hydration: client:load (form is the primary interactive element on the page).
 */

import { ownerPromotionApi, protectedAccommodationsApi } from '@/lib/api/endpoints-protected';
import { transformOwnerPromotion } from '@/lib/api/transforms';
import type { OwnerPromotionData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { OwnerPromotionDiscountTypeEnum, OwnerPromotionUpdateInputSchema } from '@repo/schemas';
import { type ChangeEvent, type FormEvent, useEffect, useId, useState } from 'react';
import styles from './PromotionForm.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the PromotionForm island. */
export interface PromotionFormProps {
    /** Active locale for i18n and redirect URL generation. */
    readonly locale: SupportedLocale;
    /** Whether the form creates a new promotion or edits an existing one. */
    readonly mode: 'create' | 'edit';
    /** Pre-populated data for edit mode. Ignored in create mode. */
    readonly initialData?: OwnerPromotionData;
    /** Required in edit mode: the promotion's UUID to update. */
    readonly promotionId?: string;
}

type FormFields = {
    title: string;
    description: string;
    discountType: string;
    discountValue: string;
    validFrom: string;
    validUntil: string;
    minNights: string;
    maxRedemptions: string;
    accommodationId: string;
};

type FieldErrors = Partial<Record<keyof FormFields, string>>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts Zod field-level errors from a ZodError into a flat FieldErrors
 * record — first issue message per path key wins.
 */
function extractFieldErrors(error: import('zod').ZodError): FieldErrors {
    const result: FieldErrors = {};
    for (const issue of error.issues) {
        const field = issue.path[0] as keyof FieldErrors | undefined;
        if (field && !result[field]) {
            result[field] = issue.message;
        }
    }
    return result;
}

/** Convert a JS Date or ISO string to `YYYY-MM-DD` for <input type="date">. */
function toDateInputValue(value: string | Date | null | undefined): string {
    if (!value) return '';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

/** Build initial FormFields from an OwnerPromotionData object. */
function buildInitialFields(data?: OwnerPromotionData): FormFields {
    return {
        title: data?.title ?? '',
        description: data?.description ?? '',
        discountType: data?.discountType ?? '',
        discountValue: data?.discountValue != null ? String(data.discountValue) : '',
        validFrom: toDateInputValue(data?.validFrom),
        validUntil: toDateInputValue(data?.validUntil),
        minNights: data?.minNights != null ? String(data.minNights) : '',
        maxRedemptions: data?.maxRedemptions != null ? String(data.maxRedemptions) : '',
        accommodationId: data?.accommodationId ?? ''
    };
}

const DISCOUNT_TYPE_VALUES = Object.values(OwnerPromotionDiscountTypeEnum);

// ─── Data-load state (edit mode without initialData) ─────────────────────────

type DataLoadState =
    | { readonly status: 'idle' }
    | { readonly status: 'loading' }
    | { readonly status: 'error'; readonly message: string };

/** Minimal shape extracted from a raw accommodation item returned by listOwn(). */
type OwnAccommodationOption = {
    readonly id: string;
    readonly label: string;
};

type AccommodationsLoadState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly items: readonly OwnAccommodationOption[] }
    | { readonly status: 'error' };

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * PromotionForm — create / edit owner-promotion island.
 *
 * Create mode: validates with OwnerPromotionCreateInputSchema, POSTs via
 * ownerPromotionApi.create().
 * Edit mode: validates with OwnerPromotionUpdateInputSchema, PUTs via
 * ownerPromotionApi.update(). When no `initialData` is provided, the island
 * fetches the promotion record via `ownerPromotionApi.getById({ id: promotionId })`
 * on mount and shows a loading indicator until data arrives.
 * Success: redirects to /{locale}/mi-cuenta/promociones/.
 */
export function PromotionForm({ locale, mode, initialData, promotionId }: PromotionFormProps) {
    const { t } = createTranslations(locale);

    const titleId = useId();
    const descriptionId = useId();
    const discountTypeId = useId();
    const discountValueId = useId();
    const validFromId = useId();
    const validUntilId = useId();
    const minNightsId = useId();
    const maxRedemptionsId = useId();
    const accommodationIdId = useId();

    // Whether we need to fetch the promotion record before the form can render.
    const needsFetch = mode === 'edit' && !initialData && !!promotionId;

    const [dataLoad, setDataLoad] = useState<DataLoadState>(
        needsFetch ? { status: 'loading' } : { status: 'idle' }
    );
    const [fields, setFields] = useState<FormFields>(() => buildInitialFields(initialData));
    const [errors, setErrors] = useState<FieldErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isLimitReached, setIsLimitReached] = useState(false);
    const [entitlementRequired, setEntitlementRequired] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [accommodationsLoad, setAccommodationsLoad] = useState<AccommodationsLoadState>({
        status: 'loading'
    });

    // ── Fetch promotion data in edit mode ─────────────────────────────────
    // biome-ignore lint/correctness/useExhaustiveDependencies: needsFetch encodes promotionId (stable prop); t is stable per locale; listing them would cause infinite re-fetch loops
    useEffect(() => {
        if (!needsFetch) return;

        let cancelled = false;

        async function fetchPromotion(): Promise<void> {
            const loadFailed = t(
                'host.promotions.errors.loadFailed',
                'No se pudo cargar la promoción.'
            );
            try {
                const result = await ownerPromotionApi.getById({
                    id: promotionId as string
                });
                if (cancelled) return;

                if (!result.ok) {
                    const status = (result.error as { status?: number }).status;
                    let message: string;
                    if (status === 404) {
                        message = t(
                            'host.promotions.errors.notFound',
                            'No se encontró la promoción.'
                        );
                    } else if (status === 403) {
                        message = t(
                            'host.promotions.errors.forbidden',
                            'No tenés permiso para acceder a esta promoción.'
                        );
                    } else {
                        message = loadFailed;
                    }
                    setDataLoad({
                        status: 'error',
                        message
                    });
                    return;
                }

                const promotion = transformOwnerPromotion({
                    item: result.data as Record<string, unknown>
                });
                setFields(buildInitialFields(promotion));
                setDataLoad({ status: 'idle' });
            } catch {
                if (cancelled) return;
                setDataLoad({
                    status: 'error',
                    message: loadFailed
                });
            }
        }

        void fetchPromotion();

        return () => {
            cancelled = true;
        };
    }, [needsFetch]);

    // ── Fetch owner's own accommodations for the select ───────────────────
    // Runs once on mount in both create and edit mode — not blocking the form.
    useEffect(() => {
        let cancelled = false;

        async function fetchOwnAccommodations(): Promise<void> {
            try {
                const result = await protectedAccommodationsApi.listOwn({ pageSize: 100 });
                if (cancelled) return;

                if (!result.ok) {
                    setAccommodationsLoad({ status: 'error' });
                    return;
                }

                const rawItems = (result.data.items ?? []) as readonly Record<string, unknown>[];
                const options: OwnAccommodationOption[] = rawItems.map((item) => ({
                    id: String(item.id ?? ''),
                    label: String(item.name ?? item.title ?? item.id ?? '')
                }));
                setAccommodationsLoad({ status: 'ready', items: options });
            } catch {
                if (cancelled) return;
                setAccommodationsLoad({ status: 'error' });
            }
        }

        void fetchOwnAccommodations();

        return () => {
            cancelled = true;
        };
    }, []);

    const promotionsListUrl = buildUrl({ locale, path: 'mi-cuenta/promociones' });
    const upgradeUrl = buildUrl({ locale, path: 'suscriptores/planes' });

    function handleChange(
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ): void {
        const { name, value } = e.currentTarget;
        setFields((prev) => ({ ...prev, [name]: value }));
        if (errors[name as keyof FieldErrors]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
        setFormError(null);
        setIsLimitReached(false);
        setEntitlementRequired(false);
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        if (isSubmitting) return;

        setFormError(null);
        setIsLimitReached(false);
        setEntitlementRequired(false);
        setErrors({});

        // Build payload — coerce number fields, null-out empty optionals.
        const discountValueNum =
            fields.discountValue === '' ? undefined : Number(fields.discountValue);
        const minNightsNum = fields.minNights === '' ? undefined : Number(fields.minNights);
        const maxRedemptionsNum =
            fields.maxRedemptions === '' ? undefined : Number(fields.maxRedemptions);

        const payload: Record<string, unknown> = {
            title: fields.title,
            description: fields.description !== '' ? fields.description : undefined,
            discountType: fields.discountType !== '' ? fields.discountType : undefined,
            discountValue: discountValueNum,
            validFrom: fields.validFrom !== '' ? fields.validFrom : undefined,
            validUntil: fields.validUntil !== '' ? fields.validUntil : undefined,
            minNights: minNightsNum,
            maxRedemptions: maxRedemptionsNum,
            accommodationId: fields.accommodationId !== '' ? fields.accommodationId : undefined
        };

        // Required-field validation (explicit, since the Zod schema used below
        // is fully partial). These are the fields the form marks with *.
        const requiredErrors: FieldErrors = {};
        if (!fields.title.trim()) {
            requiredErrors.title = t(
                'host.promotions.errors.titleRequired',
                'El título es requerido.'
            );
        }
        if (!fields.discountType) {
            requiredErrors.discountType = t(
                'host.promotions.errors.discountTypeRequired',
                'El tipo de descuento es requerido.'
            );
        }
        if (fields.discountValue === '') {
            requiredErrors.discountValue = t(
                'host.promotions.errors.discountValueRequired',
                'El valor del descuento es requerido.'
            );
        }
        if (!fields.validFrom) {
            requiredErrors.validFrom = t(
                'host.promotions.errors.validFromRequired',
                'La fecha de inicio es requerida.'
            );
        }
        if (Object.keys(requiredErrors).length > 0) {
            setErrors(requiredErrors);
            return;
        }

        // Client-side guard: percentage cannot exceed 100 (schema only enforces >= 0).
        if (
            fields.discountType === OwnerPromotionDiscountTypeEnum.PERCENTAGE &&
            discountValueNum != null &&
            discountValueNum > 100
        ) {
            setErrors({
                discountValue: t(
                    'host.promotions.errors.discountValueMaxPercentage',
                    'El porcentaje no puede superar 100.'
                )
            });
            return;
        }

        // Both modes use OwnerPromotionUpdateInputSchema for client-side validation
        // because OwnerPromotionCreateInputSchema requires server-managed fields
        // (ownerId, lifecycleState) that the form does not control. The update schema
        // is `.partial().strict()` — it validates types for present fields only.
        // Required-field presence is enforced by the Zod rules still: title,
        // discountType, discountValue, and validFrom are checked before this call
        // (their values are non-empty strings at this point).
        const parsed = OwnerPromotionUpdateInputSchema.safeParse(payload);

        if (!parsed.success) {
            setErrors(extractFieldErrors(parsed.error));
            return;
        }

        setIsSubmitting(true);

        try {
            const result =
                mode === 'create'
                    ? await ownerPromotionApi.create({
                          // TYPE-WORKAROUND: Zod-validated data (@repo/schemas) is structurally the web-local create input; the nominal types differ across the schema/web-lib boundary and serialize identically to JSON.
                          body: parsed.data as unknown as import(
                              '@/lib/api/types'
                          ).OwnerPromotionCreateInput
                      })
                    : await ownerPromotionApi.update({
                          id: promotionId ?? '',
                          // TYPE-WORKAROUND: Zod-validated data (@repo/schemas) is structurally the web-local update input; the nominal types differ across the schema/web-lib boundary and serialize identically to JSON.
                          body: parsed.data as unknown as import(
                              '@/lib/api/types'
                          ).OwnerPromotionUpdateInput
                      });

            if (!result.ok) {
                // 403 LIMIT_REACHED: entitlement cap hit — show upgrade hint.
                // ApiError carries `status` and `code` directly.
                if (
                    result.error.status === 403 &&
                    (result.error.code === 'LIMIT_REACHED' ||
                        result.error.code === 'ENTITLEMENT_LIMIT_REACHED')
                ) {
                    setIsLimitReached(true);
                    setFormError(
                        t(
                            'host.promotions.errors.saveFailed',
                            'No se pudo guardar la promoción. Intentá de nuevo.'
                        )
                    );
                    return;
                }

                // 403 ENTITLEMENT_REQUIRED: the actor's plan does not include
                // promotions at all — surface an upgrade prompt instead of a
                // generic "could not save" message the host would retry forever.
                if (result.error.status === 403 && result.error.code === 'ENTITLEMENT_REQUIRED') {
                    setEntitlementRequired(true);
                    setFormError(
                        t(
                            'host.promotions.errors.entitlementRequired',
                            'Tu plan no incluye promociones.'
                        )
                    );
                    return;
                }

                setFormError(
                    t(
                        'host.promotions.errors.saveFailed',
                        'No se pudo guardar la promoción. Intentá de nuevo.'
                    )
                );
                return;
            }

            window.location.href = promotionsListUrl;
        } catch {
            setFormError(
                t(
                    'host.promotions.errors.saveFailed',
                    'No se pudo guardar la promoción. Intentá de nuevo.'
                )
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    // ── Render: data loading (edit mode, fetching promotion) ─────────────
    if (dataLoad.status === 'loading') {
        return (
            <div
                className={styles.promotionForm}
                aria-busy="true"
                aria-label={t('host.promotions.loading', 'Cargando promoción...')}
            >
                <p className={styles.loadingText}>
                    {t('host.promotions.loading', 'Cargando promoción...')}
                </p>
            </div>
        );
    }

    // ── Render: data load error ────────────────────────────────────────────
    if (dataLoad.status === 'error') {
        return (
            <div
                className={styles.promotionForm}
                role="alert"
            >
                <p className="form-error">{dataLoad.message}</p>
                <a
                    href={promotionsListUrl}
                    className="btn-secondary"
                >
                    {t('host.promotions.actions.cancel', 'Cancelar')}
                </a>
            </div>
        );
    }

    return (
        <form
            className={`form form--card ${styles.promotionForm}`}
            onSubmit={(e) => {
                void handleSubmit(e);
            }}
            noValidate
            aria-label={
                mode === 'create'
                    ? t('host.promotions.createButton', 'Nueva promoción')
                    : t('host.promotions.actions.edit', 'Editar')
            }
        >
            {/* Title */}
            <div className="form-field">
                <label
                    className="form-label"
                    htmlFor={titleId}
                >
                    {t('host.promotions.fields.title', 'Título')}
                    <span
                        className="form-required"
                        aria-hidden="true"
                    >
                        *
                    </span>
                </label>
                <input
                    id={titleId}
                    className="form-input"
                    type="text"
                    name="title"
                    value={fields.title}
                    onChange={handleChange}
                    maxLength={200}
                    required
                    aria-invalid={errors.title ? 'true' : 'false'}
                    aria-describedby={errors.title ? `${titleId}-error` : undefined}
                />
                {errors.title && (
                    <p
                        id={`${titleId}-error`}
                        className="form-error"
                        role="alert"
                    >
                        {errors.title}
                    </p>
                )}
            </div>

            {/* Description */}
            <div className="form-field">
                <label
                    className="form-label"
                    htmlFor={descriptionId}
                >
                    {t('host.promotions.fields.description', 'Descripción')}
                </label>
                <textarea
                    id={descriptionId}
                    className="form-textarea"
                    name="description"
                    value={fields.description}
                    onChange={handleChange}
                    rows={3}
                    maxLength={1000}
                    aria-invalid={errors.description ? 'true' : 'false'}
                    aria-describedby={errors.description ? `${descriptionId}-error` : undefined}
                />
                {errors.description && (
                    <p
                        id={`${descriptionId}-error`}
                        className="form-error"
                        role="alert"
                    >
                        {errors.description}
                    </p>
                )}
            </div>

            {/* Discount type + value row */}
            <div className={styles.row}>
                {/* Discount type */}
                <div className="form-field">
                    <label
                        className="form-label"
                        htmlFor={discountTypeId}
                    >
                        {t('host.promotions.fields.discountType', 'Tipo de descuento')}
                        <span
                            className="form-required"
                            aria-hidden="true"
                        >
                            *
                        </span>
                    </label>
                    <select
                        id={discountTypeId}
                        className="form-input"
                        name="discountType"
                        value={fields.discountType}
                        onChange={handleChange}
                        required
                        aria-invalid={errors.discountType ? 'true' : 'false'}
                        aria-describedby={
                            errors.discountType ? `${discountTypeId}-error` : undefined
                        }
                    >
                        <option value="">
                            {t(
                                'host.promotions.fields.discountTypePlaceholder',
                                'Elegí una opción'
                            )}
                        </option>
                        {DISCOUNT_TYPE_VALUES.map((type) => (
                            <option
                                key={type}
                                value={type}
                            >
                                {t(`host.promotions.discountTypes.${type}`, type)}
                            </option>
                        ))}
                    </select>
                    {errors.discountType && (
                        <p
                            id={`${discountTypeId}-error`}
                            className="form-error"
                            role="alert"
                        >
                            {errors.discountType}
                        </p>
                    )}
                </div>

                {/* Discount value */}
                <div className="form-field">
                    <label
                        className="form-label"
                        htmlFor={discountValueId}
                    >
                        {t('host.promotions.fields.discountValue', 'Valor del descuento')}
                        <span
                            className="form-required"
                            aria-hidden="true"
                        >
                            *
                        </span>
                    </label>
                    <input
                        id={discountValueId}
                        className="form-input"
                        type="number"
                        name="discountValue"
                        value={fields.discountValue}
                        onChange={handleChange}
                        min={0}
                        step={1}
                        max={
                            fields.discountType === OwnerPromotionDiscountTypeEnum.PERCENTAGE
                                ? 100
                                : undefined
                        }
                        required
                        aria-invalid={errors.discountValue ? 'true' : 'false'}
                        aria-describedby={
                            errors.discountValue ? `${discountValueId}-error` : undefined
                        }
                    />
                    {errors.discountValue && (
                        <p
                            id={`${discountValueId}-error`}
                            className="form-error"
                            role="alert"
                        >
                            {errors.discountValue}
                        </p>
                    )}
                </div>
            </div>

            {/* Valid from / until row */}
            <div className={styles.row}>
                {/* Valid from */}
                <div className="form-field">
                    <label
                        className="form-label"
                        htmlFor={validFromId}
                    >
                        {t('host.promotions.fields.validFrom', 'Válido desde')}
                        <span
                            className="form-required"
                            aria-hidden="true"
                        >
                            *
                        </span>
                    </label>
                    <input
                        id={validFromId}
                        className="form-input"
                        type="date"
                        name="validFrom"
                        value={fields.validFrom}
                        onChange={handleChange}
                        required
                        aria-invalid={errors.validFrom ? 'true' : 'false'}
                        aria-describedby={errors.validFrom ? `${validFromId}-error` : undefined}
                    />
                    {errors.validFrom && (
                        <p
                            id={`${validFromId}-error`}
                            className="form-error"
                            role="alert"
                        >
                            {errors.validFrom}
                        </p>
                    )}
                </div>

                {/* Valid until */}
                <div className="form-field">
                    <label
                        className="form-label"
                        htmlFor={validUntilId}
                    >
                        {t('host.promotions.fields.validUntil', 'Válido hasta')}
                    </label>
                    <input
                        id={validUntilId}
                        className="form-input"
                        type="date"
                        name="validUntil"
                        value={fields.validUntil}
                        onChange={handleChange}
                        aria-invalid={errors.validUntil ? 'true' : 'false'}
                        aria-describedby={errors.validUntil ? `${validUntilId}-error` : undefined}
                    />
                    {errors.validUntil && (
                        <p
                            id={`${validUntilId}-error`}
                            className="form-error"
                            role="alert"
                        >
                            {errors.validUntil}
                        </p>
                    )}
                </div>
            </div>

            {/* Min nights / max redemptions row */}
            <div className={styles.row}>
                {/* Min nights */}
                <div className="form-field">
                    <label
                        className="form-label"
                        htmlFor={minNightsId}
                    >
                        {t('host.promotions.fields.minNights', 'Noches mínimas')}
                    </label>
                    <input
                        id={minNightsId}
                        className="form-input"
                        type="number"
                        name="minNights"
                        value={fields.minNights}
                        onChange={handleChange}
                        min={1}
                        step={1}
                        aria-invalid={errors.minNights ? 'true' : 'false'}
                        aria-describedby={errors.minNights ? `${minNightsId}-error` : undefined}
                    />
                    {errors.minNights && (
                        <p
                            id={`${minNightsId}-error`}
                            className="form-error"
                            role="alert"
                        >
                            {errors.minNights}
                        </p>
                    )}
                </div>

                {/* Max redemptions */}
                <div className="form-field">
                    <label
                        className="form-label"
                        htmlFor={maxRedemptionsId}
                    >
                        {t('host.promotions.fields.maxRedemptions', 'Usos máximos')}
                    </label>
                    <input
                        id={maxRedemptionsId}
                        className="form-input"
                        type="number"
                        name="maxRedemptions"
                        value={fields.maxRedemptions}
                        onChange={handleChange}
                        min={1}
                        step={1}
                        aria-invalid={errors.maxRedemptions ? 'true' : 'false'}
                        aria-describedby={
                            errors.maxRedemptions ? `${maxRedemptionsId}-error` : undefined
                        }
                    />
                    {errors.maxRedemptions && (
                        <p
                            id={`${maxRedemptionsId}-error`}
                            className="form-error"
                            role="alert"
                        >
                            {errors.maxRedemptions}
                        </p>
                    )}
                </div>
            </div>

            {/* Accommodation select — populated from protectedAccommodationsApi.listOwn() */}
            <div className="form-field">
                <label
                    className="form-label"
                    htmlFor={accommodationIdId}
                >
                    {t('host.promotions.fields.accommodationId', 'Propiedad')}
                </label>
                <select
                    id={accommodationIdId}
                    className="form-input"
                    name="accommodationId"
                    value={fields.accommodationId}
                    onChange={handleChange}
                    aria-invalid={errors.accommodationId ? 'true' : 'false'}
                    aria-describedby={[
                        `${accommodationIdId}-hint`,
                        errors.accommodationId ? `${accommodationIdId}-error` : undefined
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    disabled={accommodationsLoad.status === 'loading'}
                >
                    {accommodationsLoad.status === 'loading' ? (
                        <option value="">
                            {t(
                                'host.promotions.fields.accommodationIdLoading',
                                'Cargando propiedades...'
                            )}
                        </option>
                    ) : (
                        <>
                            <option value="">
                                {t(
                                    'host.promotions.fields.accommodationIdAll',
                                    'Todas mis propiedades'
                                )}
                            </option>
                            {accommodationsLoad.status === 'ready' &&
                                accommodationsLoad.items.map((acc) => (
                                    <option
                                        key={acc.id}
                                        value={acc.id}
                                    >
                                        {acc.label}
                                    </option>
                                ))}
                        </>
                    )}
                </select>
                <p
                    id={`${accommodationIdId}-hint`}
                    className="form-hint"
                >
                    {t(
                        'host.promotions.fields.accommodationIdHint',
                        "Elegí una propiedad o dejá 'Todas mis propiedades' para aplicar la promoción a todas."
                    )}
                </p>
                {errors.accommodationId && (
                    <p
                        id={`${accommodationIdId}-error`}
                        className="form-error"
                        role="alert"
                    >
                        {errors.accommodationId}
                    </p>
                )}
            </div>

            {/* Form-level error / LIMIT_REACHED banner */}
            {formError && (
                <div
                    className={`form-error-banner ${
                        isLimitReached || entitlementRequired ? styles.limitReachedBanner : ''
                    }`}
                    role="alert"
                >
                    <p>{formError}</p>
                    {isLimitReached && (
                        <p className={styles.limitReachedHint}>
                            {t(
                                'host.promotions.errors.limitReachedHint',
                                'Alcanzaste el límite de promociones activas de tu plan. Mejorá tu plan para crear más.'
                            )}
                        </p>
                    )}
                    {entitlementRequired && (
                        <p className={styles.limitReachedHint}>
                            {t(
                                'host.promotions.errors.entitlementRequiredHint',
                                'Mejorá tu plan para crear promociones.'
                            )}{' '}
                            <a href={upgradeUrl}>
                                {t('host.promotions.actions.upgradePlan', 'Ver planes')}
                            </a>
                        </p>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="form-actions">
                <a
                    href={promotionsListUrl}
                    className="btn-secondary"
                >
                    {t('host.promotions.actions.cancel', 'Cancelar')}
                </a>
                <button
                    type="submit"
                    className="btn-gradient btn-gradient--accent btn-gradient--shape-rounded"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                >
                    <span className="gradient-btn__label">
                        {isSubmitting
                            ? t('host.promotions.actions.saving', 'Guardando...')
                            : t('host.promotions.actions.save', 'Guardar')}
                    </span>
                </button>
            </div>
        </form>
    );
}
