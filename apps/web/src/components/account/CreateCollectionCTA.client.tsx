/**
 * @file CreateCollectionCTA.client.tsx
 * @description React island that renders the "+ Crear colección" button and
 * opens the CreateEditCollectionModal on click.
 *
 * When the user has reached the plan-level collection limit (`isAtLimit = true`),
 * the button is disabled and a tooltip/aria-label communicates the reason.
 *
 * Hydration: caller must use `client:load`.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { useState } from 'react';
import styles from './CreateCollectionCTA.module.css';
import { CreateEditCollectionModal } from './CreateEditCollectionModal.client';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the CreateCollectionCTA island */
export interface CreateCollectionCTAProps {
    /** Active locale for i18n strings */
    readonly locale: SupportedLocale;
    /**
     * Whether the user has reached the plan-level collection limit.
     * When true, the CTA button is disabled and an accessible message is shown.
     */
    readonly isAtLimit: boolean;
    /**
     * Maximum number of collections allowed by the user's plan.
     * Used to render the limit-reached message with the actual cap.
     */
    readonly maxCollections: number;
    /**
     * Optional callback invoked after a collection is successfully created.
     * Receives the created collection's id and name.
     */
    readonly onCreated?: (collection: { id: string; name: string }) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CTA button that opens the CreateEditCollectionModal in CREATE mode.
 *
 * When `isAtLimit` is true the button is disabled and the aria-label
 * explains why via the `account.favorites.collections.limit_reached` i18n key.
 */
export function CreateCollectionCTA({
    locale,
    isAtLimit,
    maxCollections,
    onCreated
}: CreateCollectionCTAProps) {
    const t = createT(locale);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const limitReachedLabel = t(
        'account.favorites.collections.limit_reached',
        'Ya alcanzaste el máximo de {{max}} colecciones',
        { max: maxCollections }
    );

    const createLabel = t('account.favorites.collections.create', 'Crear colección');

    function handleOpen(): void {
        if (!isAtLimit) {
            setIsModalOpen(true);
        }
    }

    function handleClose(): void {
        setIsModalOpen(false);
    }

    function handleSaved(collection: { id: string; name: string }): void {
        setIsModalOpen(false);
        onCreated?.(collection);
        // The collection list (UserFavoritesList) and the "X / max" usage
        // counter live in separate islands / SSR markup outside this island,
        // so they don't observe the create. A full reload is the simplest,
        // robust way to reflect the new collection in both at once (same
        // reload-after-mutation pattern used by other account mutations).
        window.location.reload();
    }

    return (
        <>
            <button
                type="button"
                className={styles.ctaBtn}
                disabled={isAtLimit}
                onClick={handleOpen}
                aria-label={isAtLimit ? limitReachedLabel : createLabel}
                title={isAtLimit ? limitReachedLabel : undefined}
            >
                <span
                    className={styles.ctaIcon}
                    aria-hidden="true"
                >
                    +
                </span>
                {createLabel}
            </button>

            {isAtLimit && (
                <output
                    className={styles.limitMsg}
                    aria-live="polite"
                >
                    {limitReachedLabel}
                </output>
            )}

            <CreateEditCollectionModal
                isOpen={isModalOpen}
                onClose={handleClose}
                onSaved={handleSaved}
                locale={locale}
                isAtLimit={isAtLimit}
                collectionMax={maxCollections}
            />
        </>
    );
}
