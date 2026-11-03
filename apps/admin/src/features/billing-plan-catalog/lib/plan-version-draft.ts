import type { AdminCatalogPlanVersion, PlanVersionContentInput } from '@repo/schemas';

type EntitlementDraft = {
    readonly rowId: string;
    readonly key: string;
    readonly planQuota: string;
    readonly trialQuota: string;
};
type LimitDraft = { readonly rowId: string; readonly key: string; readonly value: string };

/** Editable representation of one plan version form. */
export type PlanVersionDraft = {
    readonly rank: string;
    readonly sellable: boolean;
    readonly trialDays: string;
    readonly graceDays: string;
    readonly allowsPause: boolean;
    readonly inheritsTouristVip: boolean;
    readonly cycles: BillingCycle[];
    readonly entitlements: EntitlementDraft[];
    readonly limits: LimitDraft[];
};

/** Converts a current plan version to editable form values or the empty base. */
export function toDraft({
    currentVersion
}: {
    readonly currentVersion: AdminCatalogPlanVersion | null;
}): PlanVersionDraft {
    if (!currentVersion) {
        return {
            rank: '0',
            sellable: false,
            trialDays: '0',
            graceDays: '0',
            allowsPause: false,
            inheritsTouristVip: false,
            cycles: [],
            entitlements: [],
            limits: []
        };
    }
    return {
        rank: String(currentVersion.rank),
        sellable: currentVersion.sellable,
        trialDays: String(currentVersion.trialDays),
        graceDays: String(currentVersion.graceDays),
        allowsPause: currentVersion.allowsPause,
        inheritsTouristVip: currentVersion.inheritsTouristVip,
        cycles: [...(currentVersion.cycles ?? [])],
        entitlements: currentVersion.entitlements.map((item, index) => ({
            rowId: `entitlement-${index}`,
            key: item.key,
            planQuota: item.planQuota == null ? '' : String(item.planQuota),
            trialQuota: item.trialQuota == null ? '' : String(item.trialQuota)
        })),
        limits: currentVersion.limits.map((item, index) => ({
            rowId: `limit-${index}`,
            key: item.key,
            value: String(item.value)
        }))
    };
}

/** Converts editable form values to the API content shape, dropping blank rows. */
export function toContent({
    draft
}: {
    readonly draft: PlanVersionDraft;
}): PlanVersionContentInput {
    return {
        rank: Number(draft.rank),
        sellable: draft.sellable,
        trialDays: Number(draft.trialDays),
        graceDays: Number(draft.graceDays),
        allowsPause: draft.allowsPause,
        inheritsTouristVip: draft.inheritsTouristVip,
        cycles: draft.cycles,
        entitlements: draft.entitlements
            .filter((item) => item.key.trim())
            .map((item) => ({
                key: item.key,
                ...(item.planQuota.trim() ? { planQuota: Number(item.planQuota) } : {}),
                ...(item.trialQuota.trim() ? { trialQuota: Number(item.trialQuota) } : {})
            })),
        limits: draft.limits
            .filter((item) => item.key.trim())
            .map((item) => ({
                key: item.key,
                value: Number(item.value)
            }))
    };
}
