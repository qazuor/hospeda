/**
 * @file PartnerEditForm.client.tsx
 * @description Partner self-service edit form for the owner's own `partners`
 * listing (HOS-278 D3), mounted from `mi-cuenta/partner/index.astro` with
 * `client:load`.
 *
 * Four field groups, each with different mechanics:
 *
 * 1. **Identity** (`name`, `slug`, `type`, `tier`) — DISABLED, display-only.
 *    These are admin-managed (`PARTNER_OWNER_FORBIDDEN_FIELDS` in
 *    `@repo/schemas`), so the form never even builds them into a payload —
 *    disabling the inputs is a UX affordance, not the enforcement mechanism.
 * 2. **Content** (`logoUrl`, `description`, `websiteUrl`) — a save here goes to
 *    the PENDING columns and waits for admin review (§6.3 step 4); whatever is
 *    currently published stays live and unchanged in the meantime.
 * 3. **Contact** (`workEmail`, `workPhone`, `whatsapp`) — apply immediately,
 *    merged into the stored `contactInfo`.
 * 4. **Social** (all six links) — apply immediately, replacing
 *    `socialNetworks` wholesale.
 *
 * See `PartnerEditForm.helpers.ts` for the atom rule governing the content trio
 * and the reason the two JSONB groups are diffed differently.
 *
 * Validates with `PartnerOwnerUpdateSchema`, submits only the dirty fields
 * (baseline-diff, mirroring `HostTradeEditForm.client.tsx`), and PATCHes via
 * `partnersApi.updateMine`.
 */

import { PartnerOwnerUpdateSchema } from '@repo/schemas';
import { useState } from 'react';
import type { MyPartner } from '@/lib/api/endpoints-protected';
import { partnersApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import {
    buildPartnerEditSnapshot,
    buildPartnerOwnerPatch,
    type PartnerEditSnapshot
} from './PartnerEditForm.helpers';
import styles from './PartnerEditForm.module.css';

/** Props for {@link PartnerEditForm}. */
export interface PartnerEditFormProps {
    readonly locale: SupportedLocale;
    readonly partner: MyPartner;
}

/** The editable snapshot keys, so the field list below stays type-checked. */
type EditableKey = keyof PartnerEditSnapshot;

/**
 * Partner self-service edit form island.
 *
 * @param props - Component props (see {@link PartnerEditFormProps})
 */
export function PartnerEditForm({ locale, partner: initialPartner }: PartnerEditFormProps) {
    const { t } = createTranslations(locale);

    // The full listing as last known — reassigned to the PATCH response after a
    // successful save so the pending/live readouts below update immediately.
    const [currentPartner, setCurrentPartner] = useState<MyPartner>(initialPartner);

    const initialSnapshot = buildPartnerEditSnapshot(initialPartner);
    const [values, setValues] = useState<PartnerEditSnapshot>(initialSnapshot);
    const [baseline, setBaseline] = useState<PartnerEditSnapshot>(initialSnapshot);
    const [submitting, setSubmitting] = useState(false);

    const { formError, validate, handleApiError, setFormError } = useZodForm({
        schema: PartnerOwnerUpdateSchema,
        t
    });

    const setField = (key: EditableKey, value: string): void => {
        setValues((prev) => ({ ...prev, [key]: value }));
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setFormError(null);

        const payload = buildPartnerOwnerPatch({ current: values, baseline });

        if (Object.keys(payload).length === 0) {
            addToast({
                type: 'info',
                message: t('account.partner.form.noChanges', 'No hay cambios para guardar')
            });
            return;
        }

        // `validate()` is a GATE ONLY — its `parsed.data` is deliberately
        // discarded, and the hand-built diff-only `payload` is what gets sent.
        // Same discipline as `HostTradeEditForm`: submitting Zod's output would
        // let any `.default()` in the schema fill in a key the user never
        // touched, turning a partial patch into a full overwrite.
        const parsed = validate(payload);
        if (!parsed.success) {
            return;
        }

        setSubmitting(true);
        try {
            const result = await partnersApi.updateMine(payload);

            if (!result.ok) {
                const fallback = t(
                    'account.partner.form.errors.saveFailed',
                    'No se pudieron guardar los cambios'
                );
                handleApiError(result.error, fallback);
                addToast({
                    type: 'error',
                    message: translateApiError({ error: result.error, t, fallback })
                });
                return;
            }

            const nextPartner = result.data.partner;
            const nextSnapshot = buildPartnerEditSnapshot(nextPartner);
            setCurrentPartner(nextPartner);
            setBaseline(nextSnapshot);
            setValues(nextSnapshot);

            addToast({
                type: 'success',
                message: t('account.partner.form.success', 'Cambios guardados')
            });
        } catch (err) {
            const msg =
                err instanceof Error
                    ? err.message
                    : t(
                          'account.partner.form.errors.saveFailed',
                          'No se pudieron guardar los cambios'
                      );
            setFormError(msg);
            addToast({ type: 'error', message: msg });
        } finally {
            setSubmitting(false);
        }
    }

    const isPending = currentPartner.contentReviewState === 'pending';
    const isRejected = currentPartner.contentReviewState === 'rejected';

    /** One labelled text input bound to a snapshot key. */
    const field = (key: EditableKey, labelKey: string, fallback: string, type = 'text') => (
        <div className={styles.field}>
            <label
                className={styles.label}
                htmlFor={`pef-${key}`}
            >
                {t(labelKey, fallback)}
            </label>
            <input
                id={`pef-${key}`}
                type={type}
                className={styles.input}
                value={values[key]}
                onChange={(e) => setField(key, e.target.value)}
                disabled={submitting}
            />
        </div>
    );

    return (
        <form
            className={styles.form}
            onSubmit={(e) => {
                void handleSubmit(e);
            }}
            noValidate
            aria-label={t('account.partner.form.title', 'Editar mi ficha de aliado')}
        >
            {/* Identity — admin-managed, display-only (never enters the payload) */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    {t('account.partner.form.identitySection', 'Datos administrados por Hospeda')}
                </h3>
                <p className={styles.hint}>
                    {t(
                        'account.partner.form.identityNote',
                        'Estos datos los gestiona el equipo de Hospeda. Si necesitás corregirlos, contactanos.'
                    )}
                </p>
                <div className={styles.grid}>
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="pef-name"
                        >
                            {t('account.partner.form.fields.name', 'Nombre')}
                        </label>
                        <input
                            id="pef-name"
                            type="text"
                            className={styles.input}
                            value={currentPartner.name}
                            disabled
                            readOnly
                        />
                    </div>
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="pef-slug"
                        >
                            {t('account.partner.form.fields.slug', 'Identificador')}
                        </label>
                        <input
                            id="pef-slug"
                            type="text"
                            className={styles.input}
                            value={currentPartner.slug}
                            disabled
                            readOnly
                        />
                    </div>
                </div>
            </section>

            {/* Content — goes to review, never live on save */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    {t('account.partner.form.contentSection', 'Logo y textos')}
                </h3>
                <p className={styles.hint}>
                    {t(
                        'account.partner.form.contentNote',
                        'Los cambios en el logo, la descripción y el sitio pasan por revisión antes de publicarse. Lo que ya está publicado sigue visible mientras tanto.'
                    )}
                </p>

                {isPending && (
                    <div className={styles.pendingBox}>
                        <span className={styles.pendingBoxLabel}>
                            {t('account.partner.form.pendingLabel', 'En revisión')}
                        </span>
                        <p className={styles.pendingBoxText}>
                            {t(
                                'account.partner.form.pendingText',
                                'Ya enviaste cambios y estamos revisándolos. Podés seguir ajustándolos: se revisa la última versión que envíes.'
                            )}
                        </p>
                    </div>
                )}

                {isRejected && currentPartner.contentReviewNote && (
                    <div className={`${styles.feedbackBanner} ${styles.feedbackBannerError}`}>
                        <span className={styles.pendingBoxLabel}>
                            {t('account.partner.form.rejectedLabel', 'Cambios rechazados')}
                        </span>
                        <p className={styles.pendingBoxText}>{currentPartner.contentReviewNote}</p>
                    </div>
                )}

                <div className={styles.grid}>
                    {field('logoUrl', 'account.partner.form.fields.logoUrl', 'URL del logo', 'url')}
                    {field(
                        'websiteUrl',
                        'account.partner.form.fields.websiteUrl',
                        'Sitio web',
                        'url'
                    )}
                </div>
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="pef-description"
                    >
                        {t('account.partner.form.fields.description', 'Descripción')}
                    </label>
                    <textarea
                        id="pef-description"
                        className={styles.textarea}
                        value={values.description}
                        onChange={(e) => setField('description', e.target.value)}
                        disabled={submitting}
                        rows={5}
                    />
                </div>
            </section>

            {/* Contact — applies immediately */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    {t('account.partner.form.contactSection', 'Contacto')}
                </h3>
                <p className={styles.hint}>
                    {t(
                        'account.partner.form.immediateNote',
                        'Estos datos se actualizan al instante, sin revisión.'
                    )}
                </p>
                <div className={styles.grid}>
                    {field(
                        'workEmail',
                        'account.partner.form.fields.workEmail',
                        'Email de contacto',
                        'email'
                    )}
                    {field('workPhone', 'account.partner.form.fields.workPhone', 'Teléfono', 'tel')}
                    {field('whatsapp', 'account.partner.form.fields.whatsapp', 'WhatsApp', 'tel')}
                </div>
            </section>

            {/* Social — applies immediately */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    {t('account.partner.form.socialSection', 'Redes')}
                </h3>
                <p className={styles.hint}>
                    {t(
                        'account.partner.form.immediateNote',
                        'Estos datos se actualizan al instante, sin revisión.'
                    )}
                </p>
                <div className={styles.grid}>
                    {field('facebook', 'account.partner.form.fields.facebook', 'Facebook', 'url')}
                    {field(
                        'instagram',
                        'account.partner.form.fields.instagram',
                        'Instagram',
                        'url'
                    )}
                    {field('twitter', 'account.partner.form.fields.twitter', 'X / Twitter', 'url')}
                    {field('linkedIn', 'account.partner.form.fields.linkedIn', 'LinkedIn', 'url')}
                    {field('tiktok', 'account.partner.form.fields.tiktok', 'TikTok', 'url')}
                    {field('youtube', 'account.partner.form.fields.youtube', 'YouTube', 'url')}
                </div>
            </section>

            {formError && (
                <p
                    className={`${styles.feedbackBanner} ${styles.feedbackBannerError}`}
                    role="alert"
                >
                    {formError}
                </p>
            )}

            <div className={styles.submitRow}>
                <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={submitting}
                >
                    {submitting
                        ? t('account.partner.form.saving', 'Guardando...')
                        : t('account.partner.form.save', 'Guardar cambios')}
                </button>
            </div>
        </form>
    );
}
