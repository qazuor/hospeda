/**
 * @file HostTradeEditForm.helpers.ts
 * @description Pure snapshot + diff helpers for the host-trade owner
 * self-service edit form (HOS-278 §8). Kept separate from the component so
 * the payload-building logic — the exact place the benefit-atom rule lives —
 * is directly unit-testable without mounting React.
 */

import type { HostTradeBenefitTypeEnum, HostTradeOwnerUpdate } from '@repo/schemas';
import { hostTradeBenefitTypeRequiresValue } from '@repo/schemas';
import type { MyHostTrade } from '@/lib/api/endpoints-protected';

/**
 * Normalized snapshot of every field the owner may edit, as plain
 * strings/booleans. Used both as the diff baseline (resynced after a
 * successful save) and to build the current form state for diffing.
 */
export interface HostTradeEditSnapshot {
    readonly contact: string;
    readonly scheduleText: string;
    readonly is24h: boolean;
    /** Empty string = no type selected. */
    readonly benefitType: string;
    /** Empty string = no value entered. Same unit the value's `benefitType` implies (whole percent, or centavos). */
    readonly benefitValue: string;
    readonly benefitText: string;
}

/**
 * Builds the form's diff baseline from the server-fetched trade.
 *
 * The benefit trio is seeded from the PENDING proposal when one is already
 * awaiting review (`benefitReviewState === 'pending'`) so re-opening the form
 * continues refining that submission instead of quietly resetting it back to
 * the still-live offer underneath it. Otherwise it seeds from the LIVE
 * benefit — the ordinary "propose a change to what's currently published"
 * case. This seeding choice was not specified by the brief; it is the
 * interpretation that keeps a half-finished pending edit from disappearing
 * on next visit.
 *
 * @param trade - The server-fetched listing to seed the baseline from.
 * @returns A normalized {@link HostTradeEditSnapshot}.
 */
export function buildHostTradeEditSnapshot(trade: MyHostTrade): HostTradeEditSnapshot {
    const hasPending = trade.benefitReviewState === 'pending';
    return {
        contact: trade.contact,
        scheduleText: trade.scheduleText ?? '',
        is24h: trade.is24h,
        benefitType: (hasPending ? trade.pendingBenefitType : trade.benefitType) ?? '',
        benefitValue: String((hasPending ? trade.pendingBenefitValue : trade.benefitValue) ?? ''),
        benefitText: (hasPending ? trade.pendingBenefitText : trade.benefit) ?? ''
    };
}

/**
 * Builds the PATCH payload as the diff between the current form snapshot and
 * the baseline. Only touched groups are included — a submit with no changes
 * at all returns `{}`, which the caller treats as "nothing to save".
 *
 * **THE ATOM RULE (HOS-278) — read before touching this function.**
 * `HostTradeService.updateOwn` treats "any one of `benefitType` /
 * `benefitValue` / `benefitText` present in the request" as a benefit edit,
 * and then OVERWRITES all three pending columns from whatever it received:
 * `pendingBenefitType: benefitType ?? null`, and the same shape for the other
 * two. Sending ONLY a changed `benefitText` would silently NULL the pending
 * type and value that were never touched. So whenever ANY of the three
 * benefit fields is dirty, ALL THREE travel together in the payload —
 * never a partial benefit patch.
 *
 * Two schema shape rules also apply (`HostTradeOwnerUpdateSchema`):
 * - `benefitType` is `.optional()` but NOT `.nullable()` — an empty
 *   selection is OMITTED from the payload entirely, never sent as `null`.
 * - `benefitValue` IS nullable — a non-numeric type
 *   (`TWO_FOR_ONE`/`SPECIAL_CONDITION`) sends `benefitValue: null`
 *   explicitly, because `refineHostTradeBenefit` rejects a value on those
 *   types.
 *
 * @param params - `{ current, baseline }` (RO-RO).
 * @returns The changed-fields-only payload for `hostTradesApi.updateMine`.
 */
export function buildHostTradeOwnerPatch({
    current,
    baseline
}: {
    readonly current: HostTradeEditSnapshot;
    readonly baseline: HostTradeEditSnapshot;
}): HostTradeOwnerUpdate {
    const payload: Record<string, unknown> = {};

    const contact = current.contact.trim();
    if (contact !== baseline.contact.trim()) {
        payload.contact = contact;
    }

    const scheduleText = current.scheduleText.trim();
    if (scheduleText !== baseline.scheduleText.trim()) {
        payload.scheduleText = scheduleText;
    }

    if (current.is24h !== baseline.is24h) {
        payload.is24h = current.is24h;
    }

    const benefitDirty =
        current.benefitType !== baseline.benefitType ||
        current.benefitValue.trim() !== baseline.benefitValue.trim() ||
        current.benefitText.trim() !== baseline.benefitText.trim();

    if (benefitDirty) {
        const benefitType = current.benefitType as HostTradeBenefitTypeEnum | '';
        const requiresValue = benefitType ? hostTradeBenefitTypeRequiresValue(benefitType) : false;

        // `.optional()` but NOT `.nullable()` on the schema — omit, never null.
        if (benefitType) {
            payload.benefitType = benefitType;
        }
        // `.nullable()` on the schema — an explicit null clears a stale value
        // when the (possibly just-selected) type does not accept one.
        payload.benefitValue =
            requiresValue && current.benefitValue.trim() !== ''
                ? Number(current.benefitValue)
                : null;
        payload.benefitText = current.benefitText.trim();
    }

    return payload as HostTradeOwnerUpdate;
}
