/**
 * @file RejectUsageDialog.client.tsx
 * @description The "are you sure?" dialog for rejecting a benefit usage, on the
 * kit `Dialog` (HOS-2502).
 *
 * ONE DIALOG FOR BOTH SIDES of the flow. The host rejects what a provider
 * declared and the provider rejects what a host declared; the wording, the
 * optional note, the reversibility promise and the focus handling are identical,
 * so a second copy would be a second place for them to drift. It was extracted
 * when the provider's half of the flow was finally built (H-06/H-65/H-159) —
 * before that, only the host could reject at all.
 *
 * THE NOTE STAYS OPTIONAL, deliberately. Rejecting is the only control keeping
 * the public counters honest, and demanding a written explanation to say "that
 * never happened" taxes the one action the system most needs people to take.
 *
 * The kit Dialog owns the mechanics (focus trap, Escape, scroll lock, and
 * returning focus to the button that opened it, which the native `<dialog>` this
 * replaced lost when the row underneath re-rendered). The component is mounted
 * only while a rejection is being asked, so the dialog is open for its whole life.
 */

import { useState } from 'react';
import { Button, Dialog, Field, Textarea } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';

/** Maximum length of the optional rejection note, mirroring the API's cap. */
const REJECTION_NOTE_MAX = 300;

interface RejectUsageDialogProps {
    readonly locale: SupportedLocale;
    /** Who will be told the usage did not happen — the OTHER party, never the reader. */
    readonly counterpartName: string;
    readonly onCancel: () => void;
    /** Receives the trimmed note, or `undefined` when none was written. */
    readonly onConfirm: (note?: string) => void;
}

/**
 * Renders the rejection confirmation dialog.
 *
 * @param props - Locale, the counterpart's name, and the two outcomes.
 * @returns The dialog element.
 */
export function RejectUsageDialog({
    locale,
    counterpartName,
    onCancel,
    onConfirm
}: RejectUsageDialogProps) {
    const { t } = createTranslations(locale);
    const [note, setNote] = useState('');

    return (
        <Dialog
            open
            size="sm"
            locale={locale}
            title={t('host-trades.usages.reject.title', '¿Rechazar este uso?')}
            description={t(
                'host-trades.usages.reject.body',
                'Le vamos a avisar a {{name}} que este uso no ocurrió. Podés deshacerlo después: el rechazo es reversible.',
                { name: counterpartName }
            )}
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={onCancel}
                    >
                        {t('host-trades.usages.reject.cancel', 'Volver')}
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => {
                            const trimmed = note.trim();
                            onConfirm(trimmed.length > 0 ? trimmed : undefined);
                        }}
                    >
                        {t('host-trades.usages.reject.confirm', 'Sí, rechazar')}
                    </Button>
                </>
            }
        >
            <Field
                label={t('host-trades.usages.reject.noteLabel', 'Contale por qué (opcional)')}
                locale={locale}
            >
                <Textarea
                    limit={REJECTION_NOTE_MAX}
                    locale={locale}
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                />
            </Field>
        </Dialog>
    );
}
