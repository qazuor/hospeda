/**
 * @file SocialNetworksSection.client.tsx
 * @description Social network URLs of the commerce owner editor (HOS-258).
 *
 * Covers facebook / instagram / twitter / tiktok / youtube plus linkedIn
 * (SPEC-253 AC-4). Like `ContactSection`, it takes a group-level change
 * callback because the API replaces the whole `socialNetworks` JSONB block.
 */

import type { JSX } from 'react';
import { FieldError } from '@/components/ui/FieldError';
import { buildFieldErrorId } from '@/components/ui/TextField';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { SOCIAL_KEYS, type SocialValues } from './commerce-edit-data';
import styles from './editor-fields.module.css';
import { COMMERCE_FIELD_PREFIX } from './field-ids';

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
                const field = { prefix: COMMERCE_FIELD_PREFIX, name: errorKey } as const;
                return (
                    <div key={key}>
                        {/*
                         * Derivation only, not `<TextField>` (HOS-385): these
                         * inputs are named by `aria-label`, with no visible
                         * `<label>` — the platform name alone next to the URL
                         * placeholder is the whole affordance. The wrapper
                         * always renders a real `<label htmlFor>`, so adopting
                         * it would put six new visible labels on the page, a
                         * change NG-4 forbids in a refactor.
                         *
                         * HOS-373 gave these inputs an id at all; HOS-385 makes
                         * the id derive from the dotted Zod key, which renames
                         * `ce-social-<key>` to `ce-socialNetworks-<key>`.
                         */}
                        <input
                            id={buildFieldId(field)}
                            className={styles.input}
                            type="url"
                            aria-label={key}
                            value={social[key]}
                            placeholder={`https://${key === 'linkedIn' ? 'linkedin' : key}.com/...`}
                            aria-invalid={errors[errorKey] ? 'true' : 'false'}
                            aria-describedby={
                                errors[errorKey] ? buildFieldErrorId(field) : undefined
                            }
                            onChange={(event) => onSocialChange(key, event.target.value)}
                        />
                        <FieldError
                            id={buildFieldErrorId(field)}
                            message={errors[errorKey]}
                        />
                    </div>
                );
            })}
        </fieldset>
    );
}
