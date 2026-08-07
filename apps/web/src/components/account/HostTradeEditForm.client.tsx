/**
 * @file HostTradeEditForm.client.tsx
 * @description Provider self-service edit form for the owner's own
 * `host_trades` directory listing (HOS-278 §8), mounted from
 * `mi-cuenta/proveedor/index.astro` with `client:load`.
 *
 * Three field groups, each with different mechanics:
 *
 * 1. **Identity** (`name`, `slug`, `category`) — DISABLED, display-only. These
 *    are admin-managed (`HOST_TRADE_OWNER_FORBIDDEN_FIELDS` in
 *    `@repo/schemas`), so the form never even builds them into a payload —
 *    disabling the inputs is a UX affordance, not the enforcement mechanism.
 *    `destinationId` and `isActive` are NOT rendered at all: a raw
 *    destination UUID and a visibility flag are not information a provider
 *    can act on from this page.
 * 2. **Operational** (`contact`, `scheduleText`, `is24h`) — apply immediately
 *    on save.
 * 3. **Benefit** (`benefitType`, `benefitValue`, `benefitText`) — a save here
 *    goes to the PENDING columns and waits for admin review; the currently
 *    published benefit stays live and unchanged in the meantime. See
 *    `HostTradeEditForm.helpers.ts` for the atom rule that governs how these
 *    three fields are diffed and sent together.
 *
 * Validates with `HostTradeOwnerUpdateSchema`, submits only the dirty fields
 * (baseline-diff, mirroring `ProfileEditForm.client.tsx`), and PATCHes via
 * `hostTradesApi.updateMine`.
 */

import {
    HostTradeBenefitTypeEnum,
    HostTradeOwnerUpdateSchema,
    hostTradeBenefitTypeRequiresValue
} from '@repo/schemas';
import { useState } from 'react';
import type { MyHostTrade } from '@/lib/api/endpoints-protected';
import { hostTradesApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { buildHostTradeEditSnapshot, buildHostTradeOwnerPatch } from './HostTradeEditForm.helpers';
import styles from './HostTradeEditForm.module.css';

/** Props for {@link HostTradeEditForm}. */
export interface HostTradeEditFormProps {
    readonly locale: SupportedLocale;
    readonly trade: MyHostTrade;
}

const BENEFIT_TYPE_OPTIONS: readonly HostTradeBenefitTypeEnum[] =
    Object.values(HostTradeBenefitTypeEnum);

/**
 * Provider self-service host-trade edit form island.
 *
 * @param props - Component props (see {@link HostTradeEditFormProps})
 */
export function HostTradeEditForm({ locale, trade: initialTrade }: HostTradeEditFormProps) {
    const { t } = createTranslations(locale);

    // The full listing as last known — reassigned to the PATCH response after
    // a successful save so the pending/live benefit readouts below update
    // immediately (a resave still reads `initialTrade` on remount only).
    const [currentTrade, setCurrentTrade] = useState<MyHostTrade>(initialTrade);

    const [contact, setContact] = useState(initialTrade.contact);
    const [scheduleText, setScheduleText] = useState(initialTrade.scheduleText ?? '');
    const [is24h, setIs24h] = useState(initialTrade.is24h);

    const initialSnapshot = buildHostTradeEditSnapshot(initialTrade);
    const [benefitType, setBenefitType] = useState(initialSnapshot.benefitType);
    const [benefitValue, setBenefitValue] = useState(initialSnapshot.benefitValue);
    const [benefitText, setBenefitText] = useState(initialSnapshot.benefitText);

    const [baseline, setBaseline] = useState(initialSnapshot);
    const [submitting, setSubmitting] = useState(false);

    const { formError, validate, handleApiError, setFormError } = useZodForm({
        schema: HostTradeOwnerUpdateSchema,
        t
    });

    const benefitValueApplicable = hostTradeBenefitTypeRequiresValue(
        benefitType as HostTradeBenefitTypeEnum
    );

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setFormError(null);

        const current = { contact, scheduleText, is24h, benefitType, benefitValue, benefitText };
        const payload = buildHostTradeOwnerPatch({ current, baseline });

        if (Object.keys(payload).length === 0) {
            addToast({
                type: 'info',
                message: t('account.provider.form.noChanges', 'No hay cambios para guardar')
            });
            return;
        }

        // `validate()` is a GATE ONLY here — its `parsed.data` is deliberately
        // discarded. `HostTradeSchema.is24h` carries `z.boolean().default(false)`,
        // and `.partial()` treats an already-`.default()`-ed field as "already
        // optional" rather than wrapping it in a fresh `ZodOptional` — so Zod's
        // `isOptional()` check short-circuits and the field is left exactly as
        // `z.boolean().default(false)`. That means `safeParse` FILLS IN
        // `is24h: false` for any payload that omits the key, which would
        // silently flip a 24h provider back to non-24h on every unrelated save.
        // Submitting the hand-built diff-only `payload` instead (never
        // `parsed.data`) is what keeps this a true partial patch — same
        // discipline as `ProfileEditForm.client.tsx`'s `buildProfilePatch`.
        const parsed = validate(payload);
        if (!parsed.success) {
            return;
        }

        setSubmitting(true);
        try {
            const result = await hostTradesApi.updateMine(payload);

            if (!result.ok) {
                const fallback = t(
                    'account.provider.form.errors.saveFailed',
                    'No se pudieron guardar los cambios'
                );
                handleApiError(result.error, fallback);
                addToast({
                    type: 'error',
                    message: translateApiError({ error: result.error, t, fallback })
                });
                return;
            }

            const nextTrade = result.data.trade;
            const nextSnapshot = buildHostTradeEditSnapshot(nextTrade);
            setCurrentTrade(nextTrade);
            setBaseline(nextSnapshot);
            setContact(nextSnapshot.contact);
            setScheduleText(nextSnapshot.scheduleText);
            setIs24h(nextSnapshot.is24h);
            setBenefitType(nextSnapshot.benefitType);
            setBenefitValue(nextSnapshot.benefitValue);
            setBenefitText(nextSnapshot.benefitText);

            addToast({
                type: 'success',
                message: t('account.provider.form.success', 'Cambios guardados')
            });
        } catch (err) {
            const msg =
                err instanceof Error
                    ? err.message
                    : t(
                          'account.provider.form.errors.saveFailed',
                          'No se pudieron guardar los cambios'
                      );
            setFormError(msg);
            addToast({ type: 'error', message: msg });
        } finally {
            setSubmitting(false);
        }
    }

    const isPending = currentTrade.benefitReviewState === 'pending';

    return (
        <form
            className={styles.form}
            onSubmit={(e) => {
                void handleSubmit(e);
            }}
            noValidate
            aria-label={t('account.provider.form.title', 'Editar mi ficha de proveedor')}
        >
            {/* Identity — admin-managed, display-only (never enters the payload) */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    {t('account.provider.form.identitySection', 'Datos administrados por Hospeda')}
                </h3>
                <p className={styles.hint}>
                    {t(
                        'account.provider.form.identityNote',
                        'Estos datos los gestiona el equipo de Hospeda. Si necesitás corregirlos, contactanos.'
                    )}
                </p>
                <div className={styles.grid}>
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="htf-name"
                        >
                            {t('account.provider.form.fields.name', 'Nombre')}
                        </label>
                        <input
                            id="htf-name"
                            type="text"
                            className={styles.input}
                            value={currentTrade.name}
                            disabled
                            readOnly
                        />
                    </div>
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="htf-slug"
                        >
                            {t('account.provider.form.fields.slug', 'Identificador (slug)')}
                        </label>
                        <input
                            id="htf-slug"
                            type="text"
                            className={styles.input}
                            value={currentTrade.slug}
                            disabled
                            readOnly
                        />
                    </div>
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="htf-category"
                        >
                            {t('account.provider.form.fields.category', 'Categoría')}
                        </label>
                        <input
                            id="htf-category"
                            type="text"
                            className={styles.input}
                            value={t(
                                `host-trades.categories.${currentTrade.category}`,
                                currentTrade.category
                            )}
                            disabled
                            readOnly
                        />
                    </div>
                </div>
            </section>

            {/* Operational — applies immediately */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    {t('account.provider.form.operationalSection', 'Contacto y disponibilidad')}
                </h3>
                <p className={styles.hint}>
                    {t(
                        'account.provider.form.operationalNote',
                        'Estos cambios se aplican al instante en el directorio.'
                    )}
                </p>
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="htf-contact"
                    >
                        {t('account.provider.form.fields.contact', 'Contacto')}
                    </label>
                    <input
                        id="htf-contact"
                        type="text"
                        className={styles.input}
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        disabled={submitting}
                    />
                </div>
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="htf-checkbox-24h"
                    >
                        <input
                            id="htf-checkbox-24h"
                            type="checkbox"
                            checked={is24h}
                            onChange={(e) => setIs24h(e.target.checked)}
                            disabled={submitting}
                        />{' '}
                        {t('account.provider.form.fields.is24h', 'Disponible las 24 horas')}
                    </label>
                </div>
                {!is24h && (
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="htf-scheduleText"
                        >
                            {t('account.provider.form.fields.scheduleText', 'Horario de atención')}
                        </label>
                        <input
                            id="htf-scheduleText"
                            type="text"
                            className={styles.input}
                            value={scheduleText}
                            onChange={(e) => setScheduleText(e.target.value)}
                            disabled={submitting}
                            placeholder={t(
                                'account.provider.form.fields.scheduleTextPlaceholder',
                                'Ej: Lunes a Viernes 8:00–18:00'
                            )}
                        />
                    </div>
                )}
            </section>

            {/* Benefit — goes to review, live benefit stays published meanwhile */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    {t('account.provider.form.benefitSection', 'Beneficio para hosts')}
                </h3>
                <p className={styles.hint}>
                    {t(
                        'account.provider.form.benefitNote',
                        'Un cambio en el beneficio pasa a revisión del equipo de Hospeda antes de publicarse. Mientras tanto, el beneficio actual sigue visible en el directorio.'
                    )}
                </p>

                <div className={styles.liveBox}>
                    <span className={styles.liveBoxLabel}>
                        {t(
                            'account.provider.form.liveBenefitLabel',
                            'Beneficio publicado actualmente'
                        )}
                    </span>
                    <p className={styles.liveBoxText}>
                        {currentTrade.benefitType
                            ? t(
                                  `alliance-leads.form.benefitTypeOptions.${currentTrade.benefitType}`,
                                  currentTrade.benefitType
                              )
                            : t(
                                  'account.provider.form.noBenefit',
                                  'Sin beneficio estructurado cargado'
                              )}
                        {currentTrade.benefitValue == null ? '' : ` — ${currentTrade.benefitValue}`}
                    </p>
                    {currentTrade.benefit && (
                        <p className={styles.liveBoxText}>{currentTrade.benefit}</p>
                    )}
                </div>

                {isPending && (
                    <div
                        className={styles.pendingBox}
                        data-testid="pending-benefit-review"
                    >
                        <span className={styles.pendingBoxLabel}>
                            {t('account.provider.form.pendingLabel', 'Esperando revisión')}
                        </span>
                        <p className={styles.pendingBoxText}>
                            {currentTrade.pendingBenefitType
                                ? t(
                                      `alliance-leads.form.benefitTypeOptions.${currentTrade.pendingBenefitType}`,
                                      currentTrade.pendingBenefitType
                                  )
                                : t(
                                      'account.provider.form.noBenefit',
                                      'Sin beneficio estructurado cargado'
                                  )}
                            {currentTrade.pendingBenefitValue == null
                                ? ''
                                : ` — ${currentTrade.pendingBenefitValue}`}
                        </p>
                        {currentTrade.pendingBenefitText && (
                            <p className={styles.pendingBoxText}>
                                {currentTrade.pendingBenefitText}
                            </p>
                        )}
                    </div>
                )}

                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="htf-benefitType"
                    >
                        {t(
                            'alliance-leads.form.fields.benefitType',
                            'Beneficio para los anfitriones'
                        )}
                    </label>
                    <select
                        id="htf-benefitType"
                        className={styles.select}
                        value={benefitType}
                        onChange={(e) => setBenefitType(e.target.value)}
                        disabled={submitting}
                    >
                        <option value="">
                            {t(
                                'alliance-leads.form.placeholders.benefitType',
                                'Seleccioná un beneficio'
                            )}
                        </option>
                        {BENEFIT_TYPE_OPTIONS.map((value) => (
                            <option
                                key={value}
                                value={value}
                            >
                                {t(`alliance-leads.form.benefitTypeOptions.${value}`, value)}
                            </option>
                        ))}
                    </select>
                </div>

                {benefitValueApplicable && (
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="htf-benefitValue"
                        >
                            {t('alliance-leads.form.fields.benefitValue', 'Valor del beneficio')}
                        </label>
                        <input
                            id="htf-benefitValue"
                            type="number"
                            min={1}
                            step={1}
                            className={styles.input}
                            value={benefitValue}
                            onChange={(e) => setBenefitValue(e.target.value)}
                            disabled={submitting}
                        />
                    </div>
                )}

                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="htf-benefitText"
                    >
                        {t(
                            'alliance-leads.form.fields.benefitText',
                            'Condiciones del beneficio (opcional)'
                        )}
                    </label>
                    <textarea
                        id="htf-benefitText"
                        className={styles.textarea}
                        value={benefitText}
                        onChange={(e) => setBenefitText(e.target.value)}
                        disabled={submitting}
                        rows={3}
                    />
                </div>
            </section>

            {formError && (
                <div
                    className={`${styles.feedbackBanner} ${styles.feedbackBannerError}`}
                    role="alert"
                    aria-live="polite"
                >
                    {formError}
                </div>
            )}

            <div className={styles.submitRow}>
                <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={submitting}
                >
                    {submitting
                        ? t('account.provider.form.saving', 'Guardando…')
                        : t('account.provider.form.save', 'Guardar cambios')}
                </button>
            </div>
        </form>
    );
}
