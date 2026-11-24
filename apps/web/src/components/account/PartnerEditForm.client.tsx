/**
 * @file PartnerEditForm.client.tsx
 * @description Partner self-service edit form for the owner's own `partners`
 * listing (HOS-278 D3), mounted from `mi-cuenta/partner/index.astro` with
 * `client:load`.
 *
 * Four field groups, each with different mechanics:
 *
 * 1. **Identity** (`name`, `slug`, `type`) — DISABLED, display-only.
 *    These are admin-managed (`PARTNER_OWNER_FORBIDDEN_FIELDS` in
 *    `@repo/schemas`), so the form never even builds them into a payload —
 *    disabling the inputs is a UX affordance, not the enforcement mechanism.
 * 2. **Content** (`logoUrl`, `description`, `websiteUrl`) — a save here goes to
 *    the PENDING columns and waits for admin review (§6.3 step 4); whatever is
 *    currently published stays live and unchanged in the meantime.
 * 3. **Contact** (`workEmail`, `workPhone`, `whatsapp`) — apply immediately,
 *    merged into the stored `contactInfo`.
 * 4. **Social** (all six links) — apply immediately, merged into the stored
 *    `socialNetworks` (a cleared link is sent as an explicit `null`).
 *
 * See `PartnerEditForm.helpers.ts` for the atom rule governing the content trio
 * and the reason the two JSONB groups are diffed differently.
 *
 * Validates with `PartnerOwnerUpdateSchema`, submits only the dirty fields
 * (baseline-diff, mirroring `HostTradeEditForm.client.tsx`), and PATCHes via
 * `partnersApi.updateMine`.
 *
 * Built on the account kit (HOS-2506): one flat `Section` per group, the logo
 * through `ImageUploader` (upload to the media pipeline, preview before saving,
 * the URL lands in `logoUrl`) with the old URL text field kept behind a
 * «Pegar URL» `Disclosure`, and the explicit-save model (`StickySaveBar`).
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { PartnerOwnerUpdateSchema } from '@repo/schemas';
import { useState } from 'react';
import {
    Alert,
    Disclosure,
    Field,
    ImageUploader,
    type SaveOutcome,
    Section,
    StickySaveBar,
    Textarea,
    TextInput,
    useSaveBar
} from '@/components/account/ui';
import type { MyPartner } from '@/lib/api/endpoints-protected';
import { partnersApi } from '@/lib/api/endpoints-protected';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { uploadPartnerLogo } from '@/lib/media/upload-partner-logo';
import {
    buildPartnerEditSnapshot,
    buildPartnerOwnerPatch,
    type PartnerEditSnapshot
} from './PartnerEditForm.helpers';
import styles from './PartnerEditForm.module.css';

/** The form's id namespace (`pef-<key>`), shared with the save bar's «Ir al primer error». */
const ID_PREFIX = 'pef';

/** Largest logo, in bytes: the cap the upload endpoint enforces for entity images. */
const LOGO_MAX_BYTES = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB);

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

    const { fieldErrors, formError, validate, handleApiError, setFormError, clearError, reset } =
        useZodForm({ schema: PartnerOwnerUpdateSchema, t });

    const setField = (key: EditableKey, value: string): void => {
        setValues((prev) => ({ ...prev, [key]: value }));
        clearError(key);
        clearError(`contactInfo.${key}`);
        clearError(`socialNetworks.${key}`);
    };

    /** A field's error, wherever the schema nests it. */
    const errorFor = (key: EditableKey): string | undefined =>
        fieldErrors[key] ??
        fieldErrors[`contactInfo.${key}`] ??
        fieldErrors[`socialNetworks.${key}`];

    const patch = buildPartnerOwnerPatch({ current: values, baseline });
    const isDirty = Object.keys(patch).length > 0;

    async function save(): Promise<SaveOutcome> {
        setFormError(null);

        const payload = buildPartnerOwnerPatch({ current: values, baseline });
        if (Object.keys(payload).length === 0) {
            return { ok: true };
        }

        // `validate()` is a GATE ONLY — its `parsed.data` is deliberately
        // discarded, and the hand-built diff-only `payload` is what gets sent.
        // Same discipline as `HostTradeEditForm`: submitting Zod's output would
        // let any `.default()` in the schema fill in a key the user never
        // touched, turning a partial patch into a full overwrite.
        const parsed = validate(payload);
        if (!parsed.success) {
            const invalidFields = parsed.error.issues
                .map((issue) => issue.path[issue.path.length - 1])
                .filter((key): key is string => typeof key === 'string');
            return { ok: false, invalidFields };
        }

        const fallback = t(
            'account.partner.form.errors.saveFailed',
            'No se pudieron guardar los cambios'
        );
        try {
            const result = await partnersApi.updateMine(payload);
            if (!result.ok) {
                handleApiError(result.error, fallback);
                return { ok: false };
            }
            const nextPartner = result.data.partner;
            const nextSnapshot = buildPartnerEditSnapshot(nextPartner);
            setCurrentPartner(nextPartner);
            setBaseline(nextSnapshot);
            setValues(nextSnapshot);
            return { ok: true };
        } catch (err) {
            setFormError(err instanceof Error ? err.message : fallback);
            return { ok: false };
        }
    }

    const saveBar = useSaveBar({
        locale,
        isDirty,
        onSave: save,
        onDiscard: () => {
            setValues(baseline);
            reset();
        },
        idPrefix: ID_PREFIX
    });

    const isPending = currentPartner.contentReviewState === 'pending';
    const isRejected = currentPartner.contentReviewState === 'rejected';
    const saving = saveBar.status === 'saving';

    /** One labelled text input bound to a snapshot key. */
    const field = (key: EditableKey, labelKey: string, fallback: string, type = 'text') => (
        <Field
            label={t(labelKey, fallback)}
            locale={locale}
            idParts={{ prefix: ID_PREFIX, name: key }}
            error={errorFor(key)}
        >
            <TextInput
                type={type}
                value={values[key]}
                onChange={(e) => setField(key, e.target.value)}
                disabled={saving}
            />
        </Field>
    );

    return (
        <form
            className={styles.form}
            onSubmit={(e) => {
                e.preventDefault();
                void saveBar.save();
            }}
            noValidate
            aria-label={t('account.partner.form.title', 'Editar mi ficha de aliado')}
        >
            {/* Identity — admin-managed, display-only (never enters the payload) */}
            <Section
                title={t('account.partner.form.identitySection', 'Datos administrados por Hospeda')}
                description={t(
                    'account.partner.form.identityNote',
                    'Estos datos los gestiona el equipo de Hospeda. Si necesitás corregirlos, contactanos.'
                )}
                helpId="section:partner.identity"
            >
                <div className={styles.grid}>
                    <Field
                        label={t('account.partner.form.fields.name', 'Nombre')}
                        locale={locale}
                        idParts={{ prefix: ID_PREFIX, name: 'name' }}
                    >
                        <TextInput
                            value={currentPartner.name}
                            disabled
                            readOnly
                        />
                    </Field>
                    <Field
                        label={t('account.partner.form.fields.slug', 'Identificador')}
                        locale={locale}
                        idParts={{ prefix: ID_PREFIX, name: 'slug' }}
                    >
                        <TextInput
                            value={currentPartner.slug}
                            disabled
                            readOnly
                        />
                    </Field>
                </div>
            </Section>

            {/* Content — goes to review, never live on save */}
            <Section
                title={t('account.partner.form.contentSection', 'Logo y textos')}
                description={t(
                    'account.partner.form.contentNote',
                    'Los cambios en el logo, la descripción y el sitio pasan por revisión antes de publicarse. Lo que ya está publicado sigue visible mientras tanto.'
                )}
                helpId="section:partner.edit-form"
            >
                <div className={styles.stack}>
                    {isPending && (
                        <Alert
                            locale={locale}
                            tone="info"
                            title={t('account.partner.form.pendingLabel', 'En revisión')}
                        >
                            <p>
                                {t(
                                    'account.partner.form.pendingText',
                                    'Ya enviaste cambios y estamos revisándolos. Podés seguir ajustándolos: se revisa la última versión que envíes.'
                                )}
                            </p>
                        </Alert>
                    )}

                    {isRejected && currentPartner.contentReviewNote && (
                        <Alert
                            locale={locale}
                            tone="warning"
                            title={t('account.partner.form.rejectedLabel', 'Cambios rechazados')}
                        >
                            <p>{currentPartner.contentReviewNote}</p>
                        </Alert>
                    )}

                    <ImageUploader
                        label={t('account.partner.form.logo.label')}
                        locale={locale}
                        id={`${ID_PREFIX}-logoUrl`}
                        value={values.logoUrl || null}
                        onChange={(url) => setField('logoUrl', url)}
                        upload={(file) => uploadPartnerLogo({ file, locale })}
                        maxBytes={LOGO_MAX_BYTES}
                        maxMb={DEFAULT_ENTITY_MAX_FILE_SIZE_MB}
                        previewAlt={t('account.partner.form.logo.previewAlt')}
                        error={errorFor('logoUrl')}
                        disabled={saving}
                    />

                    <Disclosure summary={t('account.partner.form.logo.pasteUrl')}>
                        <Field
                            label={t('account.partner.form.fields.logoUrl', 'URL del logo')}
                            locale={locale}
                            idParts={{ prefix: ID_PREFIX, name: 'logoUrlText' }}
                            hint={t('account.partner.form.logo.urlHint')}
                        >
                            <TextInput
                                type="url"
                                value={values.logoUrl}
                                onChange={(e) => setField('logoUrl', e.target.value)}
                                disabled={saving}
                            />
                        </Field>
                    </Disclosure>

                    {field(
                        'websiteUrl',
                        'account.partner.form.fields.websiteUrl',
                        'Sitio web',
                        'url'
                    )}

                    <Field
                        label={t('account.partner.form.fields.description', 'Descripción')}
                        locale={locale}
                        idParts={{ prefix: ID_PREFIX, name: 'description' }}
                        error={errorFor('description')}
                    >
                        <Textarea
                            value={values.description}
                            onChange={(e) => setField('description', e.target.value)}
                            disabled={saving}
                            rows={5}
                            locale={locale}
                        />
                    </Field>
                </div>
            </Section>

            {/* Contact — applies immediately */}
            <Section
                title={t('account.partner.form.contactSection', 'Contacto')}
                description={t(
                    'account.partner.form.immediateNote',
                    'Estos datos se actualizan al instante, sin revisión.'
                )}
                helpId="section:partner.contact"
            >
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
            </Section>

            {/* Social — applies immediately */}
            <Section
                title={t('account.partner.form.socialSection', 'Redes')}
                description={t(
                    'account.partner.form.immediateNote',
                    'Estos datos se actualizan al instante, sin revisión.'
                )}
                helpId="section:partner.social"
            >
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
            </Section>

            <StickySaveBar
                status={saveBar.status}
                errorMessage={formError}
                locale={locale}
                onSave={() => {
                    void saveBar.save();
                }}
                onDiscard={saveBar.discard}
                onGoToFirstError={saveBar.goToFirstError}
            />
        </form>
    );
}
