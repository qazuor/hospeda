import { CATALOG_KEY_DEFINITIONS, type VerticalEnum } from '@repo/schemas';
import { encodeFiniteOrInfinite, type RehydratedEffectiveSet } from '@repo/verticals';

export function toEffectiveSetView({
    effective,
    userId,
    vertical
}: {
    effective: RehydratedEffectiveSet;
    userId: string;
    vertical: VerticalEnum;
}) {
    const entitlements: Record<string, number | 'Infinity'> = {};
    const limits: Record<string, number | 'Infinity'> = {};
    for (const definition of CATALOG_KEY_DEFINITIONS) {
        const value = (
            definition.kind === 'entitlement' ? effective.entitlements : effective.limits
        ).get({
            key: definition.key,
            userId,
            vertical
        });
        if (value === undefined) continue;
        (definition.kind === 'entitlement' ? entitlements : limits)[definition.key] =
            encodeFiniteOrInfinite(value);
    }
    return {
        userId,
        vertical,
        hasLiveNonTrialTitle: effective.hasLiveNonTrialTitle,
        entitlements,
        limits
    };
}
