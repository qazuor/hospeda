/**
 * @file PublishReadyDialog.client.tsx
 * @description Offers publishing at the moment a save makes the listing
 * publishable (HOS-1183, second owner request).
 *
 * ## Why it can promise the listing will go live
 *
 * The dialog is only ever opened by {@link usePublishReadyPrompt}, which has
 * already established both halves of publishability: every blocking requirement
 * is met, and the server's own verdict says this owner may publish. That is the
 * whole reason it exists as a gated dialog rather than a button — H-99 was a
 * publish affordance that promised "va a aparecer en el sitio, visible para los
 * turistas" and then failed on confirm, and an unrequested dialog doing the same
 * would be worse, because the owner did not ask for it.
 *
 * A 403 can still arrive: the verdict was read seconds ago, and a subscription
 * can lapse in between. It is handled rather than assumed away — the dialog
 * turns into the plans link, exactly like the card's button does.
 */

import { type JSX, useState } from 'react';
import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import { accommodationEditApi } from '@/lib/api/endpoints-protected';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import styles from './PublishReadyDialog.module.css';

/** Props for {@link PublishReadyDialog}. */
export interface PublishReadyDialogProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    /**
     * Whether publishing would start the owner's free trial. Adds one line, and
     * only in that branch — a paying owner starts no clock, and saying so would
     * be a promise nothing keeps.
     */
    readonly startsTrial: boolean;
    /** How many days that trial runs, resolved from the live plan catalog. */
    readonly trialDays: number;
}

/** What the dialog is doing right now. */
type DialogState = 'offering' | 'publishing' | 'error' | 'subscriptionRequired';

/**
 * The "your listing is ready" dialog.
 *
 * @param props - See {@link PublishReadyDialogProps}.
 */
export function PublishReadyDialog({
    isOpen,
    onClose,
    locale,
    accommodationId,
    startsTrial,
    trialDays
}: PublishReadyDialogProps): JSX.Element | null {
    const { t, tPlural } = createTranslations(locale);
    const [state, setState] = useState<DialogState>('offering');

    if (!isOpen) {
        return null;
    }

    async function handlePublish(): Promise<void> {
        setState('publishing');
        const result = await accommodationEditApi.publish({ id: accommodationId });

        if (result.ok) {
            // Straight to the listing hub rather than a reload: the owner just
            // finished the job this editor exists for, and leaving them on a
            // section form implies there is more to do.
            window.location.href = buildUrl({ locale, path: 'mi-cuenta/propiedades' });
            return;
        }

        if (result.error.status === 403 && result.error.message === 'subscription_required') {
            // The verdict was true when it was read and is not now. Offering a
            // retry would fail identically.
            setState('subscriptionRequired');
            return;
        }
        setState('error');
    }

    const titleId = 'publish-ready-dialog-title';

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            ariaLabelledBy={titleId}
            size="sm"
        >
            <DialogHeader
                onClose={onClose}
                titleId={titleId}
                closeLabel={t('common.close', 'Cerrar')}
            >
                {state === 'subscriptionRequired'
                    ? t(
                          'host.properties.editor.publishReady.blockedTitle',
                          'Necesitás un plan activo'
                      )
                    : t('host.properties.editor.publishReady.title', 'Tu ficha ya está lista')}
            </DialogHeader>

            <DialogBody>
                {state === 'subscriptionRequired' ? (
                    <p className={styles.text}>
                        {t(
                            'host.properties.card.publishSubscriptionRequiredMessage',
                            'Necesitás un plan activo para publicar.'
                        )}
                    </p>
                ) : (
                    <>
                        <p className={styles.text}>
                            {t(
                                'host.properties.editor.publishReady.body',
                                'Completaste todo lo que hacía falta. Si la publicás ahora, va a aparecer en el sitio, visible para los turistas.'
                            )}
                        </p>
                        {startsTrial && (
                            <p className={styles.trialNote}>
                                {tPlural(
                                    'host.properties.card.actions.publishConfirmTrialNote',
                                    trialDays,
                                    { trialDays }
                                )}
                            </p>
                        )}
                        {state === 'error' && (
                            <p
                                className={styles.error}
                                role="alert"
                            >
                                {t(
                                    'host.properties.card.publishError',
                                    'No se pudo publicar. Intentá de nuevo.'
                                )}
                            </p>
                        )}
                    </>
                )}
            </DialogBody>

            <DialogFooter>
                {state === 'subscriptionRequired' ? (
                    <a
                        href={buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.owner })}
                        className={styles.primary}
                    >
                        {t('host.properties.card.publishSubscriptionRequiredCta', 'Ver planes')}
                    </a>
                ) : (
                    <>
                        <button
                            type="button"
                            className={styles.secondary}
                            onClick={onClose}
                        >
                            {t(
                                'host.properties.editor.publishReady.keepEditing',
                                'Seguir editando'
                            )}
                        </button>
                        <button
                            type="button"
                            className={styles.primary}
                            onClick={handlePublish}
                            disabled={state === 'publishing'}
                            aria-busy={state === 'publishing'}
                        >
                            {t('host.properties.editor.publishReady.publishNow', 'Publicar ahora')}
                        </button>
                    </>
                )}
            </DialogFooter>
        </Dialog>
    );
}
