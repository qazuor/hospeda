/**
 * @file EditorSocialLinksSection.tsx
 * @description The social-network links of both owner editors' contact page,
 * on the kit (HOS-2488 / HOS-2497, spec HOS-2415 §6.3).
 *
 * Each link is a kit {@link Field} with a VISIBLE platform label (G-5: no
 * placeholder or `aria-label` as the only name). The accommodation editor types
 * a handle after a fixed domain addon (`facebook.com/` + `tu-pagina`), so its
 * links pass a `prefix`; the listing editor stores whole URLs and passes none.
 * How a value is parsed or composed stays with each engine: this section only
 * draws what it is given.
 */

import { Field } from '@/components/account/ui/Field';
import type { HelpAnchor } from '@/components/account/ui/help-anchor';
import { InputGroup } from '@/components/account/ui/InputGroup';
import { Section } from '@/components/account/ui/Section';
import { TextInput } from '@/components/account/ui/TextInput';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './EditorFields.module.css';

/** One social link as an engine hands it over. */
export interface SocialLinkField {
    /** DOM id of the input (built by the engine with `buildFieldId`). */
    readonly id: string;
    /** Visible platform label. */
    readonly label: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly error?: string;
    /** Fixed domain addon before a handle (`instagram.com/`); omit for whole URLs. */
    readonly prefix?: string;
}

/** Props of {@link EditorSocialLinksSection}. */
export interface EditorSocialLinksSectionProps {
    readonly locale: SupportedLocale;
    readonly helpId: HelpAnchor;
    readonly links: readonly SocialLinkField[];
}

/**
 * The shared social links section.
 *
 * @param props - See {@link EditorSocialLinksSectionProps}.
 * @returns A kit `Section` with one Field per network.
 */
export function EditorSocialLinksSection({ locale, helpId, links }: EditorSocialLinksSectionProps) {
    const t = createT(locale);

    return (
        <Section
            title={t('account.editorFields.social.title')}
            description={t('account.editorFields.social.hint')}
            helpId={helpId}
        >
            <div className={styles.grid}>
                {links.map((link) => (
                    <Field
                        key={link.id}
                        locale={locale}
                        label={link.label}
                        id={link.id}
                        error={link.error}
                        optional
                    >
                        {link.prefix ? (
                            <InputGroup
                                prefix={link.prefix}
                                value={link.value}
                                autoComplete="off"
                                onChange={(event) => link.onChange(event.target.value)}
                            />
                        ) : (
                            <TextInput
                                type="url"
                                inputMode="url"
                                value={link.value}
                                onChange={(event) => link.onChange(event.target.value)}
                            />
                        )}
                    </Field>
                ))}
            </div>
        </Section>
    );
}
