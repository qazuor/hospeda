/** Compact owner-card downloads and an on-demand QR preview (D14). */
import { LockIcon } from '@repo/icons';
import { useState } from 'react';
import { Dialog } from '@/components/account/ui/Dialog';
import { Menu, type MenuItem } from '@/components/account/ui/Menu';
import { ListingQrSheet } from '@/components/shared/qr/ListingQrSheet.client';
import { useListingQrDownload } from '@/components/shared/qr/use-listing-qr-download';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import {
    type BrochureDownloadButtonProps,
    useBrochureDownload
} from './BrochureDownloadButton.client';
import styles from './ListingActions.module.css';

/** One menu for both server PDFs; neither download requires loading the QR image. */
export function ListingDownloads(
    props: BrochureDownloadButtonProps & {
        readonly name: string;
        readonly isPublished: boolean;
    }
) {
    const { locale, vertical, name, isPublished } = props;
    const { t } = createTranslations(locale);
    const brochure = useBrochureDownload(props);
    const sheet = useListingQrDownload(props);
    const [qrOpen, setQrOpen] = useState(false);
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
              },
        {
            id: 'qr-sheet',
            label: t(
                sheet.state.status === 'working'
                    ? 'common.qrSheet.working'
                    : 'common.qrSheet.download'
            ),
            disabled: !isPublished || sheet.state.status === 'working',
            onSelect: () => {
                void sheet.handleDownload();
            }
        },
        {
            id: 'view-qr',
            label: t('listing.owner.downloads.viewQr'),
            disabled: !isPublished,
            onSelect: () => setQrOpen(true)
        }
    ];
    const sheetErrors = {
        notFound: 'common.qrSheet.errorNotFound',
        rateLimited: 'common.qrSheet.errorRateLimited',
        signedOut: 'common.qrSheet.errorSignedOut',
        generic: 'common.qrSheet.error'
    } as const;

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
            {sheet.state.status === 'error' && (
                <p
                    role="alert"
                    className={styles.error}
                >
                    {t(sheetErrors[sheet.state.reason])}
                </p>
            )}
            {sheet.state.status === 'ready' && (
                <p
                    role="status"
                    className={styles.hint}
                >
                    {t('common.qrSheet.ready')}
                </p>
            )}
            <Dialog
                locale={locale}
                open={qrOpen}
                onOpenChange={setQrOpen}
                title={t('listing.owner.downloads.qrTitle', undefined, { name })}
                size="sm"
            >
                {qrOpen && (
                    <ListingQrSheet
                        {...props}
                        codeOnly
                    />
                )}
            </Dialog>
        </>
    );
}
