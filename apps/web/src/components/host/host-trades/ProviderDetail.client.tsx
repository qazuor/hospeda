/**
 * @file ProviderDetail.client.tsx
 * @description The body of a provider's detail page inside the directory, on the
 * account kit (HOS-2472): the provider's data, a «Contactar» button that opens
 * the contact channel in a dialog, and the benefit with its «Registrar uso» CTA.
 *
 * One island so the dialog and both sections share a React tree; it ships with
 * the least eager directive (`client:idle`) because nothing here is needed
 * before the page is readable. The reviews stay in their own island.
 *
 * The contact is the single free-text `contact` field the directory already
 * returns, resolved to a real link (`tel:`, `mailto:` or `https:`) by
 * {@link resolveProviderContact}. No other contact field is read.
 */

import { KeyValueList, LinkButton, Section, TextLink } from '@/components/account/ui';
import type { DirectoryProvider } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { ProviderContactButton } from './ProviderContactButton';
import styles from './ProviderDetail.module.css';
import { resolveProviderContact } from './resolve-provider-contact';
import { TradeCategoryBadges } from './TradeCategoryBadges';

/** Props for {@link ProviderDetail}. */
export interface ProviderDetailProps {
    /** The provider as the directory detail endpoint returns it. */
    readonly provider: Pick<
        DirectoryProvider,
        'name' | 'categories' | 'contact' | 'benefit' | 'is24h' | 'scheduleText'
    >;
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** Where «Registrar uso del beneficio» goes. */
    readonly registerUsageHref: string;
}

/**
 * Renders the provider's data section and the benefit section.
 *
 * @param props - {@link ProviderDetailProps}
 * @returns The two sections.
 */
export function ProviderDetail({ provider, locale, registerUsageHref }: ProviderDetailProps) {
    const t = createT(locale);
    const contact = resolveProviderContact({ contact: provider.contact });
    const schedule = provider.is24h ? t('host-trades.card.is24h') : provider.scheduleText;

    const items = [
        provider.categories.length > 0
            ? {
                  key: 'categories',
                  label: t('host-trades.card.categoriesLabel'),
                  value: (
                      <TradeCategoryBadges
                          categories={provider.categories}
                          locale={locale}
                      />
                  )
              }
            : null,
        schedule
            ? { key: 'schedule', label: t('host-trades.detail.schedule'), value: schedule }
            : null,
        {
            key: 'contact',
            label: t('host-trades.detail.contact'),
            value: (
                <TextLink
                    href={contact.href}
                    external={contact.channel === 'web' || contact.channel === 'whatsapp'}
                    locale={locale}
                >
                    {contact.display}
                </TextLink>
            )
        }
    ].filter((item) => item !== null);

    return (
        <div className={styles.stack}>
            <Section
                title={t('host-trades.detail.dataTitle')}
                helpId="section:hosttrade.datos"
                actions={
                    <ProviderContactButton
                        name={provider.name}
                        contact={provider.contact}
                        locale={locale}
                    />
                }
            >
                <KeyValueList items={items} />
            </Section>

            <Section
                title={t('host-trades.detail.benefitTitle')}
                helpId="section:hosttrade.benefit"
                footer={
                    <LinkButton
                        href={registerUsageHref}
                        variant="secondary"
                    >
                        {t('host-trades.registerUsage.title')}
                    </LinkButton>
                }
            >
                <p className={styles.benefit}>{provider.benefit}</p>
            </Section>
        </div>
    );
}
