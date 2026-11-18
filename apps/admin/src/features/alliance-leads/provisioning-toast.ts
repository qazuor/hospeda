/**
 * Pure mapping from a provisioning outcome to the toast the admin sees
 * (HOS-2339). Kept out of the components so every branch is unit-testable.
 */

import type { AllianceLeadProvisioningOutcome } from '@repo/schemas';

const KEY = 'admin-entities.allianceLeads';

/** A toast to show: variant plus the i18n key of its message. */
export type ProvisioningToast = {
    readonly variant: 'success' | 'warning' | 'info';
    readonly messageKey: string;
};

/** Warning key for a skip reason worth warning about, or `null` (silent). */
const warningKeyFor = (reason: AllianceLeadProvisioningOutcome['reason']): string | null => {
    if (reason === 'no-active-category') return `${KEY}.handle.warningNoActiveCategory`;
    if (reason === 'legacy-lead-without-typed-fields') return `${KEY}.handle.warningLegacy`;
    return null;
};

/**
 * Toast after approving a lead through `mark-handled`.
 *
 * Warns only when provisioning was skipped for `no-active-category` or
 * `legacy-lead-without-typed-fields`. Success, `already-provisioned` and an
 * absent outcome (other kinds) keep the existing green approval toast.
 *
 * @param params - `{ provisioning }` from the response, possibly undefined.
 */
export function resolveApprovalToast(params: {
    readonly provisioning: AllianceLeadProvisioningOutcome | undefined;
}): ProvisioningToast {
    const { provisioning } = params;
    const warning =
        provisioning && !provisioning.provisioned ? warningKeyFor(provisioning.reason) : null;
    if (warning) return { variant: 'warning', messageKey: warning };
    return { variant: 'success', messageKey: `${KEY}.handle.successApproved` };
}

/**
 * Toast after the dedicated retry (`POST .../provision`).
 *
 * @param params - `{ provisioning }` from the response.
 */
export function resolveRetryToast(params: {
    readonly provisioning: AllianceLeadProvisioningOutcome | undefined;
}): ProvisioningToast {
    const { provisioning } = params;
    if (provisioning?.provisioned) {
        return { variant: 'success', messageKey: `${KEY}.provision.success` };
    }
    if (provisioning?.reason === 'already-provisioned') {
        return { variant: 'info', messageKey: `${KEY}.provision.alreadyExists` };
    }
    const warning = warningKeyFor(provisioning?.reason);
    if (warning) return { variant: 'warning', messageKey: warning };
    return { variant: 'warning', messageKey: `${KEY}.provision.error` };
}
