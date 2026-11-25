/**
 * @file collections-gate.ts
 * @description The ONE collections gate of the favorites page (HOS-2480).
 *
 * «Crear colección» in the page header, the «Mover» dialog («+ Crear nueva
 * colección») and the create dialog all read this module, so they cannot
 * disagree on whether creating is locked or on why (HOS-2414 AC-6).
 *
 * - `noPlan`: the collections list answered 403 `ENTITLEMENT_REQUIRED`. The
 *   page shows ONE `LockedState` (plan names from the catalog).
 * - `atLimit`: the plan carries collections and the cap is reached.
 * - `open`: creating is allowed. `usage` is null when it is unknown (a read
 *   failed); the API's 403 stays the real enforcement then.
 */

import type { LockReason } from '@/components/account/ui';
import type { BookmarkCollectionUsage } from '@/lib/api/endpoints-protected';
import type { TranslationFn } from '@/lib/api-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';

/** State of the collections gate. */
export type CollectionsGate =
    | { readonly kind: 'open'; readonly usage: BookmarkCollectionUsage | null }
    | { readonly kind: 'atLimit'; readonly usage: BookmarkCollectionUsage }
    | { readonly kind: 'noPlan' };

/**
 * Builds the gate from what the collections endpoint said.
 *
 * @param input - Options object.
 * @param input.accessDenied - True when the endpoint answered `ENTITLEMENT_REQUIRED`.
 * @param input.usage - The usage counters, or null when unknown.
 * @returns The gate.
 */
export function resolveCollectionsGate({
    accessDenied,
    usage
}: {
    readonly accessDenied: boolean;
    readonly usage: BookmarkCollectionUsage | null;
}): CollectionsGate {
    if (accessDenied || (usage !== null && usage.max === 0)) return { kind: 'noPlan' };
    if (usage !== null && usage.current >= usage.max) return { kind: 'atLimit', usage };
    return { kind: 'open', usage };
}

/**
 * Whether a new collection may be created.
 *
 * @param input - Options object.
 * @param input.gate - The gate.
 * @returns True only for an `open` gate.
 */
export function canCreateCollection({ gate }: { readonly gate: CollectionsGate }): boolean {
    return gate.kind === 'open';
}

/**
 * Why creating a collection is locked, in one sentence, or null when it is not.
 * The same text explains «Crear colección» and replaces «+ Crear nueva
 * colección» inside «Mover».
 *
 * @param input - Options object.
 * @param input.gate - The gate.
 * @param input.t - The caller's translation function.
 * @returns The reason, or null.
 */
export function collectionsLockText({
    gate,
    t
}: {
    readonly gate: CollectionsGate;
    readonly t: TranslationFn;
}): string | null {
    if (gate.kind === 'noPlan') return t('account.favorites.collections.lock.plan');
    if (gate.kind === 'atLimit') {
        return t('account.favorites.collections.limit_reached', undefined, {
            max: gate.usage.max
        });
    }
    return null;
}

/**
 * The `LockedState` reason of the collections plan gate. Plan names come from
 * the catalog (read on the SSR page), never from a literal.
 *
 * @param input - Options object.
 * @param input.t - The caller's translation function.
 * @param input.locale - Page locale (for the pricing link).
 * @param input.planNames - Catalog names of the plans that carry collections.
 * @returns A `plan` lock reason.
 */
export function collectionsPlanLockReason({
    t,
    locale,
    planNames
}: {
    readonly t: TranslationFn;
    readonly locale: SupportedLocale;
    readonly planNames: readonly string[];
}): LockReason {
    return {
        kind: 'plan',
        feature: t('account.favorites.collections.upgrade.title'),
        description: t('account.favorites.collections.lock.description'),
        plans: planNames.map((name) => ({ name })),
        plansHref: buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.tourist })
    };
}
