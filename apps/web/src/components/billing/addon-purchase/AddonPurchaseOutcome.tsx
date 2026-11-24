import type { createTranslations } from '@/lib/i18n';
import styles from './AddonPurchase.module.css';

type Translate = ReturnType<typeof createTranslations>['t'];

/** The purchase-screen views that tell how a purchase ended (or is still settling). */
export type AddonPurchaseOutcomeView = 'PROCESSING' | 'ACTIVE' | 'CLOSED';

/**
 * The end of an add-on purchase: still being confirmed, active, or closed without activating.
 * Moved out of `AddonPurchase` as is (HOS-2599) so the screen stays within its size budget;
 * the copy keys are decided by the caller (`processingCopyKey`, `closedCopyKey`).
 */
export function AddonPurchaseOutcome(input: {
    readonly view: AddonPurchaseOutcomeView;
    /** Copy key of the processing line. */
    readonly processingKey: string;
    /** Whether the screen stopped waiting for the purchase to settle. */
    readonly waitEnded: boolean;
    /** Error of the last read while processing, if any. */
    readonly pollError: string | null;
    /** Copy key of the closed line. */
    readonly closedKey: string;
    readonly t: Translate;
}) {
    const { t } = input;
    if (input.view === 'ACTIVE')
        return (
            <p
                data-testid="addon-purchase-active"
                role="status"
            >
                {t('billing.addonPurchase.active')}
            </p>
        );
    if (input.view === 'CLOSED')
        return (
            <p
                data-testid="addon-purchase-closed"
                role="status"
            >
                {t(input.closedKey)}
            </p>
        );
    return (
        <>
            <p
                data-testid="addon-purchase-processing"
                data-exhausted={input.waitEnded ? 'true' : 'false'}
                role="status"
            >
                {t(input.processingKey)}
            </p>
            {input.pollError && (
                <p
                    role="alert"
                    className={styles.error}
                >
                    {input.pollError}
                </p>
            )}
        </>
    );
}
