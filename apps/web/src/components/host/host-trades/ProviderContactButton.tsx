/** Shared contact action for directory cards and provider details. */
import { useState } from 'react';
import { Button, Dialog, LinkButton } from '@/components/account/ui';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './ProviderDetail.module.css';
import { resolveProviderContact } from './resolve-provider-contact';

/** Opens the provider's resolved contact channel in the kit dialog. */
export function ProviderContactButton({
    name,
    contact: value,
    locale,
    className
}: {
    readonly name: string;
    readonly contact: string;
    readonly locale: SupportedLocale;
    readonly className?: string;
}) {
    const { t } = createTranslations(locale);
    const [open, setOpen] = useState(false);
    const contact = resolveProviderContact({ contact: value });
    return (
        <>
            <Button
                className={className}
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
            >
                {t('host-trades.card.contact')}
            </Button>
            {open && (
                <Dialog
                    open={open}
                    onOpenChange={setOpen}
                    locale={locale}
                    size="sm"
                    title={t('host-trades.detail.contactDialogTitle', undefined, { name })}
                    description={t('host-trades.detail.contactDialogDescription')}
                >
                    <div className={styles.channel}>
                        <p className={styles.channelValue}>{contact.display}</p>
                        <LinkButton
                            href={contact.href}
                            external={contact.channel === 'web' || contact.channel === 'whatsapp'}
                            locale={locale}
                        >
                            {t(`host-trades.detail.channel.${contact.channel}`)}
                        </LinkButton>
                    </div>
                </Dialog>
            )}
        </>
    );
}
