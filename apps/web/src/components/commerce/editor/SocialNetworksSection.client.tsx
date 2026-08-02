/**
 * @file SocialNetworksSection.client.tsx
 * @description Social network URLs of the commerce owner editor (HOS-258).
 *
 * Covers facebook / instagram / twitter / tiktok / youtube plus linkedIn
 * (SPEC-253 AC-4). Like `ContactSection`, it takes a group-level change
 * callback because the API replaces the whole `socialNetworks` JSONB block.
 */

import type { JSX } from 'react';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { SOCIAL_KEYS, type SocialValues } from './commerce-edit-data';
import styles from './editor-fields.module.css';

export interface SocialNetworksSectionProps {
    readonly locale: SupportedLocale;
    readonly social: SocialValues;
    /** Dotted schema keys (`socialNetworks.facebook`, …) as produced by `useZodForm`. */
    readonly errors: Readonly<Record<string, string | undefined>>;
    readonly onSocialChange: (key: keyof SocialValues, value: string) => void;
}

export function SocialNetworksSection({
    locale,
    social,
    errors,
    onSocialChange
}: SocialNetworksSectionProps): JSX.Element {
    const { t } = createTranslations(locale);

    return (
        <fieldset
            className={styles.section}
            id="editor-socialNetworks"
        >
            <legend className={styles.label}>
                {t('commerce.owner.editor.sections.socialNetworks', 'Redes sociales')}
            </legend>
            {SOCIAL_KEYS.map((key) => {
                const errorKey = `socialNetworks.${key}`;
                return (
                    <div key={key}>
                        <input
                            className={styles.input}
                            type="url"
                            aria-label={key}
                            value={social[key]}
                            placeholder={`https://${key === 'linkedIn' ? 'linkedin' : key}.com/...`}
                            aria-invalid={errors[errorKey] ? 'true' : 'false'}
                            aria-describedby={errors[errorKey] ? fieldErrorId(errorKey) : undefined}
                            onChange={(event) => onSocialChange(key, event.target.value)}
                        />
                        <FieldError
                            id={fieldErrorId(errorKey)}
                            message={errors[errorKey]}
                        />
                    </div>
                );
            })}
        </fieldset>
    );
}
