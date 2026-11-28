/**
 * Compact owner-card downloads (D14).
 *
 * The QR sheet and the QR preview used to live here too. Since HOS-2688 the QR
 * has a page of its own per listing (`…/{id}/codigo-qr`), linked from the
 * card's «⋯» menu, so this menu carries the brochure only.
 */
import { LockIcon } from '@repo/icons';
import { Menu, type MenuItem } from '@/components/account/ui/Menu';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import {
    type BrochureDownloadButtonProps,
    useBrochureDownload
} from './BrochureDownloadButton.client';
import styles from './ListingActions.module.css';

/** The brochure download, as a one-entry menu so the card keeps one download trigger. */
export function ListingDownloads(
    props: BrochureDownloadButtonProps & {
        readonly name: string;
    }
) {
    const { locale, vertical, name } = props;
    const { t } = createTranslations(locale);
    const brochure = useBrochureDownload(props);
    const brochureLabel = t('listing.brochure.download');
    const items: readonly MenuItem[] = [
        brochure.locked
            ? {
                  id: 'brochure',
                  label: (
                      <>
                          <LockIcon
                              size="sm"
                              aria-hidden="true"
                          />{' '}
                          {brochureLabel} · {t('listing.brochure.premiumBadge')}
                      </>
                  ),
                  href: buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE[vertical] })
              }
            : {
                  id: 'brochure',
                  label:
                      brochure.state === 'working'
                          ? t('listing.brochure.downloading')
                          : brochureLabel,
                  disabled: brochure.state === 'working',
                  onSelect: () => {
                      void brochure.handleDownload();
                  }
              }
    ];
    return (
        <>
            <Menu
                locale={locale}
                triggerText={t('listing.owner.downloads.label')}
                label={t('listing.owner.downloads.forListing', undefined, { name })}
                items={items}
            />
            {brochure.state === 'error' && (
                <p
                    role="alert"
                    className={styles.error}
                >
                    {t('listing.brochure.error')}
                </p>
            )}
        </>
    );
}
