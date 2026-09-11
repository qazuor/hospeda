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

import { useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import styles from './CreateCollectionCTA.module.css';
import { CreateEditCollectionModal } from './CreateEditCollectionModal.client';
import { COLLECTION_CREATED_EVENT } from './collection-created-event';

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
     * Whether the actor's entitlement excludes collections entirely (the SSR
     * usage fetch answered 403 `ENTITLEMENT_REQUIRED`). Takes priority over
     * `isAtLimit`: an entitlement-gated actor isn't "at their limit" — they
     * have zero access, and the disabled-state message must say so rather
     * than falsely claiming a cap they never had (HOS-899). Defaults to
     * `false` for callers that haven't wired the check.
     */
    readonly accessDenied?: boolean;
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
 * When `accessDenied` is true (no collections entitlement at all) the button
 * is disabled with the `account.favorites.collections.upgrade.message` copy
 * instead — `accessDenied` wins over `isAtLimit` when both are true.
 */
export function CreateCollectionCTA({
    locale,
    isAtLimit,
    maxCollections,
    accessDenied = false,
    onCreated
}: CreateCollectionCTAProps) {
    const t = createT(locale);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const limitReachedLabel = t(
        'account.favorites.collections.limit_reached',
        'Ya alcanzaste el máximo de {{max}} colecciones',
        { max: maxCollections }
    );

    const entitlementRequiredLabel = t(
        'account.favorites.collections.upgrade.message',
        'Las colecciones están disponibles en los planes Plus y VIP. Actualizá tu plan para acceder.'
    );

    const createLabel = t('account.favorites.collections.create', 'Crear colección');

    const isDisabled = accessDenied || isAtLimit;
    const disabledLabel = accessDenied ? entitlementRequiredLabel : limitReachedLabel;

    function handleOpen(): void {
        if (!isDisabled) {
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
        // counter (CollectionUsageMeter) live in separate islands outside
        // this one, so they don't observe the create on their own. Broadcast
        // it instead of the previous `window.location.reload()` — a reload
        // lost scroll position and the active tab, and killed the toast
        // below before it could ever render (HOS-999).
        window.dispatchEvent(
            new CustomEvent(COLLECTION_CREATED_EVENT, {
                detail: { id: collection.id, name: collection.name }
            })
        );

        addToast({
            type: 'success',
            message: t(
                'account.favorites.collections.createSuccess',
                'Colección "{{name}}" creada',
                {
                    name: collection.name
                }
            )
        });
    }

    return (
        <>
            <button
                type="button"
                className={styles.ctaBtn}
                disabled={isDisabled}
                onClick={handleOpen}
                aria-label={isDisabled ? disabledLabel : createLabel}
                title={isDisabled ? disabledLabel : undefined}
            >
                <span
                    className={styles.ctaIcon}
                    aria-hidden="true"
                >
                    +
                </span>
                {createLabel}
            </button>

            {isDisabled && (
                <output
                    className={styles.limitMsg}
                    aria-live="polite"
                >
                    {disabledLabel}
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
