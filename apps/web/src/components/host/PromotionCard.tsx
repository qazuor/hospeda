/** Shared owner-promotion card for accommodation and venue managers. */
import { formatCalendarDate } from '@repo/utils';
import type { ReactNode } from 'react';
import { ContentCard, KeyValueList } from '@/components/account/ui';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './PromotionCard.module.css';

interface Props {
    readonly locale: SupportedLocale;
    readonly title: string;
    readonly benefit: string;
    readonly status: ReactNode;
    readonly validFrom: string | Date | null | undefined;
    readonly validUntil: string | Date | null | undefined;
    readonly actions: ReactNode;
}

export function PromotionCard({
    locale,
    title,
    benefit,
    status,
    validFrom,
    validUntil,
    actions
}: Props) {
    const { t } = createTranslations(locale);
    const date = (value: Props['validFrom']) =>
        formatCalendarDate({ value, locale, options: { dateStyle: 'long' } }) ?? '';
    const validity = validUntil
        ? t('host.promotions.kit.validRange', undefined, {
              from: date(validFrom),
              until: date(validUntil)
          })
        : t('host.promotions.kit.validOpen', undefined, { from: date(validFrom) });

    return (
        <ContentCard
            locale={locale}
            title={benefit}
            meta={title}
            actions={<div className={styles.actions}>{actions}</div>}
        >
            <KeyValueList
                items={[
                    { key: 'status', label: t('host.promotions.kit.statusLabel'), value: status },
                    {
                        key: 'validity',
                        label: t('host.promotions.kit.validityLabel'),
                        value: validity
                    }
                ]}
            />
        </ContentCard>
    );
}
