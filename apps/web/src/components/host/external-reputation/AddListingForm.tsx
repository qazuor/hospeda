/**
 * @file AddListingForm.tsx
 * @description «Add a platform» form of the external reputation section
 * (HOS-2515): kit `Field`s with visible labels, a native `Select`, a `TextInput`
 * and two `Checkbox`es. Hidden once every platform is registered.
 *
 * The idle label («Agregar») and the busy label («Agregando…») are DISTINCT
 * i18n keys (HOS-2438).
 */

import type { ReactElement } from 'react';
import { Alert } from '@/components/account/ui/Alert';
import { Button } from '@/components/account/ui/Button';
import { Checkbox } from '@/components/account/ui/Checkbox';
import { Field } from '@/components/account/ui/Field';
import { Select } from '@/components/account/ui/Select';
import { TextInput } from '@/components/account/ui/TextInput';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import styles from './ExternalReputation.module.css';
import type { ExternalPlatform } from './external-reputation-types';
import { platformLabel } from './ListingsList';
import type { UseAddListingResult } from './use-add-listing';

/** Props of {@link AddListingForm}. */
export interface AddListingFormProps {
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    readonly form: UseAddListingResult;
}

/**
 * The add form, or a note when every platform is already connected.
 *
 * @param props - See {@link AddListingFormProps}.
 * @returns The form.
 */
export function AddListingForm({ locale, t, form }: AddListingFormProps): ReactElement {
    if (form.availablePlatforms.length === 0) {
        return (
            <p
                className={styles.mutedText}
                data-testid="ext-rep-all-platforms"
            >
                {t('external-reputation.ownerConfig.allPlatformsAdded')}
            </p>
        );
    }

    return (
        <div className={styles.addForm}>
            <p className={styles.addTitle}>{t('external-reputation.ownerConfig.addListing')}</p>

            <Field
                locale={locale}
                label={t('external-reputation.ownerConfig.platformField')}
                idParts={{ prefix: 'ext-rep', name: 'platform' }}
            >
                <Select
                    value={form.platform}
                    onChange={(event) => form.setPlatform(event.target.value as ExternalPlatform)}
                >
                    {form.availablePlatforms.map((platform) => (
                        <option
                            key={platform}
                            value={platform}
                        >
                            {platformLabel({ t, platform })}
                        </option>
                    ))}
                </Select>
            </Field>

            <Field
                locale={locale}
                label={t('external-reputation.ownerConfig.urlField')}
                idParts={{ prefix: 'ext-rep', name: 'url' }}
                hint={t(`external-reputation.ownerConfig.urlHint.${form.platform.toLowerCase()}`)}
                error={form.urlError}
                required
            >
                <TextInput
                    type="url"
                    value={form.url}
                    onChange={(event) => form.setUrl(event.target.value)}
                    placeholder="https://..."
                />
            </Field>

            <div className={styles.checks}>
                <Checkbox
                    label={t('external-reputation.ownerConfig.showLink')}
                    checked={form.showLink}
                    onChange={(event) => form.setShowLink(event.target.checked)}
                />
                <Checkbox
                    label={t('external-reputation.ownerConfig.showReviews')}
                    checked={form.showReviews}
                    onChange={(event) => form.setShowReviews(event.target.checked)}
                />
            </div>

            {form.formError ? (
                <Alert
                    tone="danger"
                    locale={locale}
                >
                    {form.formError}
                </Alert>
            ) : null}

            <div className={styles.formActions}>
                <Button
                    loading={form.isAdding}
                    disabled={!form.url.trim()}
                    onClick={() => void form.submit()}
                >
                    {form.isAdding
                        ? t('external-reputation.ownerConfig.addingListing')
                        : t('external-reputation.ownerConfig.addButton')}
                </Button>
            </div>
        </div>
    );
}
