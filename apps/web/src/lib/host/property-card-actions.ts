/**
 * @file property-card-actions.ts
 * @description Which actions the host's accommodation card on
 * `/mi-cuenta/propiedades/` offers, per publication state (HOS-1641, H11).
 *
 * The card used to derive its actions from `lifecycleState`, so a `PURGED`
 * listing (purged by its owner, `deleted_at` still NULL, so still in the list)
 * kept offering "edit" and "delete" (Coord-351 F4). The decision now reads
 * `publicationStatus` and lives here, as a pure table, so every state has one
 * tested answer instead of a chain of conditions inside the template.
 *
 * @module lib/host/property-card-actions
 */

import { PublicationStatusEnum } from '@repo/schemas';
import type { PublishAffordance } from '@/lib/publish/subscribe-button';

/** The actions (and the QR block) one card renders. */
export interface PropertyCardActions {
    /** Link to the web editor. */
    readonly edit: boolean;
    /** Link to the public page. */
    readonly viewOnSite: boolean;
    /** The guided publish island (PB1). */
    readonly publish: boolean;
    /**
     * The "Publicar de nuevo" action (HOS-1977): a listing the system took
     * down for billing goes back through the SAME publish endpoint. Whether it
     * is actually offered also depends on the owner's affordance, see
     * {@link resolveRepublishOffer}.
     */
    readonly republish: boolean;
    /** The unpublish island. */
    readonly unpublish: boolean;
    /** The delete island (PB12). */
    readonly delete: boolean;
    /**
     * Whether the QR-sheet block is rendered at all. A non-published card
     * still renders it, so its owner reads what publishing unlocks.
     */
    readonly qrBlock: boolean;
    /**
     * Whether the QR sheet can actually be printed: only a `PUBLISHED` listing
     * has a public page, which is what the API's `qr-sheet` route checks too.
     */
    readonly canPrintQrSheet: boolean;
}

const NO_ACTION: PropertyCardActions = {
    edit: false,
    viewOnSite: false,
    publish: false,
    republish: false,
    unpublish: false,
    delete: false,
    qrBlock: false,
    canPrintQrSheet: false
};

/** Edit and delete only: the states the system or an admin took down. */
const TAKEN_DOWN: PropertyCardActions = {
    ...NO_ACTION,
    edit: true,
    delete: true,
    qrBlock: true
};

const ACTIONS_BY_STATUS: Readonly<Record<PublicationStatusEnum, PropertyCardActions>> = {
    [PublicationStatusEnum.DRAFT]: { ...TAKEN_DOWN, publish: true },
    [PublicationStatusEnum.PUBLISHED]: {
        edit: true,
        viewOnSite: true,
        publish: false,
        republish: false,
        unpublish: true,
        delete: true,
        qrBlock: true,
        canPrintQrSheet: true
    },
    [PublicationStatusEnum.UNPUBLISHED_BY_BILLING]: { ...TAKEN_DOWN, republish: true },
    [PublicationStatusEnum.ARCHIVED]: TAKEN_DOWN,
    [PublicationStatusEnum.MODERATED]: TAKEN_DOWN,
    // Final state: the content is gone. Only the HOS-1492 row-20 notice remains.
    [PublicationStatusEnum.PURGED]: NO_ACTION
};

/**
 * Resolves the card's actions from the listing's publication state.
 *
 * - `DRAFT`: edit, publish, delete.
 * - `PUBLISHED`: edit, view on site, unpublish, delete, printable QR.
 * - `UNPUBLISHED_BY_BILLING`: edit, republish, delete (HOS-1977).
 * - `ARCHIVED`, `MODERATED`: edit, delete (the HOS-1492 notices say what to
 *   do next).
 * - `PURGED`: nothing at all.
 *
 * @param params.publicationStatus - The listing's publication state.
 * @returns The actions the card renders.
 */
export function resolvePropertyCardActions({
    publicationStatus
}: {
    readonly publicationStatus: PublicationStatusEnum;
}): PropertyCardActions {
    return ACTIONS_BY_STATUS[publicationStatus] ?? NO_ACTION;
}

/**
 * Whether any action (or the QR block) is rendered, so the card can omit the
 * empty action row entirely.
 *
 * @param params.actions - The resolved actions.
 * @returns `true` when at least one action is rendered.
 */
export function hasAnyPropertyCardAction({
    actions
}: {
    readonly actions: PropertyCardActions;
}): boolean {
    return (
        actions.edit ||
        actions.viewOnSite ||
        actions.publish ||
        actions.republish ||
        actions.unpublish ||
        actions.delete
    );
}

/**
 * Whether the "Publicar de nuevo" button renders, per the owner's publish
 * affordance (HOS-1977). One exhaustive `Record` keyed by `kind`, never a
 * comparison against a kind literal.
 *
 * - `publish`: not covered and the trial is unspent. The button republishes
 *   through PB1, which starts the trial in the same transaction.
 * - `checkout`: not covered and no trial left. The button renders and, being
 *   the shared `PublishButton`, leads to the paid plans page of the vertical.
 * - `covered`: the owner may publish it by hand when the quota has a free slot
 *   (HOS-1997). With the quota full the API answers 403 `LIMIT_REACHED` and the
 *   shared `PublishButton` shows its `limitReached` message, so the card always
 *   offers the button instead of guessing the quota.
 * - `noPlans` / `unknown`: the shared `PublishButton` renders its own notice
 *   (no plans, check failed), so the card shows the same fail-closed states
 *   it shows a draft.
 *
 * @param params.actions - The resolved card actions.
 * @param params.affordance - What the server would do if the owner published.
 * @returns `true` when the republish button renders.
 */
export function resolveRepublishOffer({
    actions,
    affordance
}: {
    readonly actions: PropertyCardActions;
    readonly affordance: PublishAffordance;
}): boolean {
    if (!actions.republish) return false;
    const byKind: Readonly<Record<PublishAffordance['kind'], boolean>> = {
        publish: true,
        checkout: true,
        covered: true,
        noPlans: true,
        unknown: true
    };
    return byKind[affordance.kind];
}
