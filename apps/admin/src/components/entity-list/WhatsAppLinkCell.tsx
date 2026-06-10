import { WhatsappIcon } from '@repo/icons';

interface WhatsAppLinkCellProps {
    /** Raw phone string (any format — spaces/dashes/+ get stripped). */
    readonly phone: string | null | undefined;
}

/**
 * Renders a phone number as a wa.me link with the WhatsApp icon. `wa.me`
 * auto-redirects to the WhatsApp app on mobile or to web.whatsapp.com on
 * desktop, so the same URL works in both contexts.
 *
 * The phone is normalized to AR-mobile international format:
 *   - all non-digits stripped
 *   - if it already starts with `54` (Argentina country code), kept as-is
 *   - otherwise prefixed with `549` (AR mobile WhatsApp convention)
 *
 * Display keeps the original raw string so users still recognize it.
 */
export const WhatsAppLinkCell = ({ phone }: WhatsAppLinkCellProps) => {
    if (!phone) {
        return <span className="text-muted-foreground">—</span>;
    }

    const digits = phone.replace(/\D/g, '');
    if (!digits) {
        return <span className="text-muted-foreground">—</span>;
    }

    const e164 = digits.startsWith('54') ? digits : `549${digits}`;

    return (
        <a
            href={`https://wa.me/${e164}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Abrir WhatsApp con ${phone}`}
        >
            <WhatsappIcon
                size={14}
                aria-hidden="true"
            />
            <span className="tabular-nums">{phone}</span>
        </a>
    );
};
