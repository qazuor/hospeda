import { formatCurrency } from '@repo/i18n';
import type { AdminAddonCatalogResponse } from '@repo/schemas';

/** One catalog row returned by the action 20 read endpoint. */
export type CatalogAddon = AdminAddonCatalogResponse['items'][number];
/** One immutable version returned by the action 20 read endpoint. */
export type CatalogVersion = CatalogAddon['versions'][number];
/** Editable version content before schema validation. */
export type AddonVersionDraft = {
    validity: CatalogVersion['validity'];
    validityDays: string;
    scopeType: CatalogVersion['scopeType'];
    entitlements: string[];
    limits: { key: string; value: string }[];
    price: string;
};
/** Key-by-key change shown in the publication confirmation. */
export type AddonVersionChange = {
    kind: 'added' | 'removed' | 'changed';
    key: string;
    from: string | null;
    to: string | null;
};

/** Copies a current version and price into a new editable draft. */
export function toAddonVersionDraft({
    version,
    price
}: {
    version: CatalogVersion | null;
    price: number | null;
}): AddonVersionDraft {
    return {
        validity: version?.validity ?? 'WHILE_SUBSCRIPTION_ALIVE',
        validityDays: version?.validityDays == null ? '' : String(version.validityDays),
        scopeType: version?.scopeType ?? 'LISTING',
        entitlements: [...(version?.entitlements ?? [])],
        limits: version?.limits.map((item) => ({ key: item.key, value: String(item.value) })) ?? [],
        price: price == null ? '' : String(price)
    };
}

/** Converts form strings to a shape validated by AddonVersionContentSchema. */
export function toAddonVersionContent({ draft }: { draft: AddonVersionDraft }) {
    return {
        validity: draft.validity,
        validityDays: draft.validity === 'FIXED_DAYS' ? Number(draft.validityDays) : null,
        scopeType: draft.scopeType,
        entitlements: draft.entitlements.map((key) => key.trim()).filter(Boolean),
        limits: draft.limits
            .filter((item) => item.key.trim())
            .map((item) => ({ key: item.key.trim(), value: Number(item.value) }))
    };
}

/** Computes every added, removed and changed policy key plus scope, validity and price. */
export function diffAddonVersion({
    current,
    proposed,
    currentPrice,
    proposedPrice
}: {
    current: CatalogVersion;
    proposed: Pick<
        CatalogVersion,
        'entitlements' | 'limits' | 'scopeType' | 'validity' | 'validityDays'
    >;
    currentPrice: number;
    proposedPrice: number;
}): AddonVersionChange[] {
    const before = new Map<string, string>();
    const after = new Map<string, string>();
    for (const key of current.entitlements) before.set(`entitlement:${key}`, key);
    for (const key of proposed.entitlements) after.set(`entitlement:${key}`, key);
    for (const item of current.limits) before.set(`limit:${item.key}`, String(item.value));
    for (const item of proposed.limits) after.set(`limit:${item.key}`, String(item.value));
    before.set('scope', current.scopeType);
    after.set('scope', proposed.scopeType);
    before.set('validity', `${current.validity}:${current.validityDays ?? ''}`);
    after.set('validity', `${proposed.validity}:${proposed.validityDays ?? ''}`);
    before.set(
        'price',
        formatCurrency({ value: currentPrice / 100, locale: 'es-AR', currency: 'ARS' })
    );
    after.set(
        'price',
        formatCurrency({ value: proposedPrice / 100, locale: 'es-AR', currency: 'ARS' })
    );
    return [...new Set([...before.keys(), ...after.keys()])]
        .sort()
        .flatMap((key): AddonVersionChange[] => {
            const from = before.get(key) ?? null;
            const to = after.get(key) ?? null;
            if (from === to) return [];
            return [
                {
                    kind: from === null ? 'added' : to === null ? 'removed' : 'changed',
                    key,
                    from,
                    to
                }
            ];
        });
}
