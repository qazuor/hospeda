import { EmailIcon } from '@repo/icons';

interface MailLinkCellProps {
    /** Email address (any case). */
    readonly email: string | null | undefined;
}

/**
 * Renders an email as a `mailto:` link with the envelope icon. Opens the
 * user's default mail client (Gmail, Outlook, native app, etc.) on click.
 */
export const MailLinkCell = ({ email }: MailLinkCellProps) => {
    if (!email) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <a
            href={`mailto:${email}`}
            className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Enviar correo a ${email}`}
        >
            <EmailIcon
                size={14}
                aria-hidden="true"
            />
            <span className="truncate">{email}</span>
        </a>
    );
};
