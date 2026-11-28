import { CopyIcon } from '@repo/icons';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';

/**
 * The two URLs of one QR code, in full (HOS-2679).
 *
 * The list used to truncate the destination to one line, which hid exactly the
 * part an operator came to check: the query string. Both URLs now wrap with
 * `break-all` and carry their own copy button.
 *
 * - `targetUrl` — where a scan ends up, as stored.
 * - `scanUrl` — what the printed symbol encodes (`{site}/qr/{slug}/`).
 */

/** Props for {@link QrCodeUrlCell}. */
export type QrCodeUrlCellProps = {
    /** The stored destination. */
    readonly targetUrl: string;
    /** The URL the printed symbol encodes. */
    readonly scanUrl: string;
};

/** Props for {@link CopyUrlButton}. */
type CopyUrlButtonProps = {
    readonly value: string;
    readonly label: string;
};

/** An icon button that copies one URL and toasts the outcome. */
function CopyUrlButton({ value, label }: CopyUrlButtonProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            addToast({ message: t('admin-qr-codes.urls.copied'), variant: 'success' });
        } catch {
            addToast({ message: t('admin-qr-codes.urls.copyFailed'), variant: 'error' });
        }
    };

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            aria-label={label}
            title={label}
            onClick={handleCopy}
        >
            <CopyIcon
                className="h-3.5 w-3.5"
                aria-hidden="true"
            />
        </Button>
    );
}

/**
 * Renders the destination and the scan URL of one row.
 *
 * @param props - {@link QrCodeUrlCellProps}
 * @returns The cell.
 */
export function QrCodeUrlCell({ targetUrl, scanUrl }: QrCodeUrlCellProps) {
    const { t } = useTranslations();

    return (
        <div className="min-w-56 max-w-md space-y-1.5 text-sm">
            <div className="flex items-start gap-1">
                <span className="break-all">{targetUrl}</span>
                <CopyUrlButton
                    value={targetUrl}
                    label={t('admin-qr-codes.urls.copyTarget')}
                />
            </div>
            <div className="flex items-start gap-1 text-muted-foreground text-xs">
                <span className="shrink-0 font-medium">{t('admin-qr-codes.urls.scanLabel')}</span>
                <span className="break-all font-mono">{scanUrl}</span>
                <CopyUrlButton
                    value={scanUrl}
                    label={t('admin-qr-codes.urls.copyScan')}
                />
            </div>
        </div>
    );
}
