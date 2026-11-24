/**
 * Which add-ons an account is offered, and what the purchase screen says when an add-on has
 * nowhere to go (HOS-2599). Pure decisions: the compatible verticals of each add-on come from
 * the DB catalog through `GET /protected/billing/addons/offers` (`compatibleVerticals`), and
 * the account's verticals from its own subscriptions read. No vertical map lives in code.
 *
 * @module lib/billing/addon-account-verticals
 */

import type { StatusTone } from '@/components/account/ui/status-tone';

/** The slice of an own-subscription row these decisions read. */
export interface AccountSubscriptionSlice {
    readonly vertical: string;
    readonly status: string;
}

/**
 * The verticals an account holds a subscription in, in any status, without repeats. A
 * subscription that is paused, in grace or waiting for its first payment still says which
 * vertical the account works in, so its add-ons stay on offer.
 *
 * @param input.subscriptions - The account's subscriptions, from the own-subscriptions read.
 * @returns The distinct verticals.
 */
export function accountVerticalsFrom(input: {
    readonly subscriptions: readonly AccountSubscriptionSlice[];
}): string[] {
    return [...new Set(input.subscriptions.map((item) => item.vertical))];
}

/**
 * Keep the offers compatible with at least one of the account's verticals. `null` means the
 * account's verticals are unknown (the read failed, or the screen came back from a checkout
 * without reading them): every offer stays and the server stays the authority. An offer whose
 * catalog row lists no vertical is kept, since nothing says it is foreign to the account.
 *
 * @param input.offers - The saleable offers, each with its catalog `compatibleVerticals`.
 * @param input.accountVerticals - The account's verticals, or `null` when unknown.
 * @returns The offers this account can use.
 */
export function offersForAccountVerticals<
    T extends { readonly compatibleVerticals: readonly string[] }
>(input: {
    readonly offers: readonly T[];
    readonly accountVerticals: readonly string[] | null;
}): T[] {
    const { offers, accountVerticals } = input;
    if (accountVerticals === null) return [...offers];
    return offers.filter(
        (offer) =>
            offer.compatibleVerticals.length === 0 ||
            offer.compatibleVerticals.some((vertical) => accountVerticals.includes(vertical))
    );
}

/**
 * Why a subscription-scoped add-on found no subscription to hang from. `INACTIVE` when the
 * account does hold a compatible subscription that is not active right now (paused, in grace,
 * waiting for payment…): telling that owner «you are in the free trial or have no plan» would
 * be false. `NONE` when no compatible subscription exists at all.
 *
 * @param input.subscriptions - The account's subscriptions.
 * @param input.compatibleVerticals - The add-on's catalog verticals.
 * @returns The empty-state reason.
 */
export function noSubscriptionReason(input: {
    readonly subscriptions: readonly AccountSubscriptionSlice[];
    readonly compatibleVerticals: readonly string[];
}): 'INACTIVE' | 'NONE' {
    return input.subscriptions.some(
        (item) => item.status !== 'ACTIVE' && input.compatibleVerticals.includes(item.vertical)
    )
        ? 'INACTIVE'
        : 'NONE';
}

const PUBLICATION_TONE: Readonly<Record<string, StatusTone>> = {
    PUBLISHED: 'success',
    UNPUBLISHED_BY_BILLING: 'warning',
    MODERATED: 'danger',
    DRAFT: 'neutral',
    ARCHIVED: 'neutral',
    PURGED: 'neutral'
};

/**
 * The pill tone of a listing's publication status on the destination step. The status is
 * also said in words, so the tone is never the only signal.
 *
 * @param input.status - A `PublicationStatusEnum` wire value.
 * @returns The tone, `neutral` for an unknown value.
 */
export function publicationStatusTone(input: { readonly status: string }): StatusTone {
    return Object.hasOwn(PUBLICATION_TONE, input.status)
        ? (PUBLICATION_TONE[input.status] ?? 'neutral')
        : 'neutral';
}
