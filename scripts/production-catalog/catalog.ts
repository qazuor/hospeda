import { createHash } from 'node:crypto';

/** V2.4a only: disposable values for exercising the production load mechanism. */
export interface PlanCatalogDefinition {
    readonly vertical: 'experience';
    readonly slug: `placeholder-${string}`;
    readonly name: string;
    readonly role: 'trial' | 'pre_trial' | 'floor' | null;
    readonly version: {
        readonly rank: number;
        readonly sellable: boolean;
        readonly current: boolean;
        readonly graceDays: number;
        readonly trialDays: number;
        readonly allowsPause: boolean;
        readonly inheritsTouristVip: boolean;
        readonly entitlements: readonly {
            readonly key: string;
            readonly planQuota?: number;
            readonly trialQuota?: number;
        }[];
        /** Trial limits are the closed list of declared trial overrides. */
        readonly limits: readonly { readonly key: 'max_experiences'; readonly value: number }[];
    };
}

export const PLACEHOLDER_CATALOG = [
    {
        vertical: 'experience',
        slug: 'placeholder-trial',
        name: 'Placeholder Trial',
        role: 'trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 14,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [],
            limits: []
        }
    },
    {
        vertical: 'experience',
        slug: 'placeholder-pre-trial',
        name: 'Placeholder Pre Trial',
        role: 'pre_trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [{ key: 'activate_trial' }, { key: 'subscribe_to_plan' }],
            limits: []
        }
    },
    {
        vertical: 'experience',
        slug: 'placeholder-floor',
        name: 'Placeholder Floor',
        role: 'floor',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [{ key: 'subscribe_to_plan' }, { key: 'recover_own_listing' }],
            limits: []
        }
    },
    {
        vertical: 'experience',
        slug: 'placeholder-sellable',
        name: 'Placeholder Sellable',
        role: null,
        version: {
            rank: 900_000,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 14,
            allowsPause: true,
            inheritsTouristVip: false,
            entitlements: [
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' },
                { key: 'publish_experience' }
            ],
            limits: [{ key: 'max_experiences', value: 123 }]
        }
    }
] as const satisfies readonly PlanCatalogDefinition[];

/** UUIDv5 using one fixed namespace and a natural catalog key. */
export function catalogId(key: string): string {
    const namespace = Buffer.from('8cd05b0f6e6352e297d631f5b58cba82', 'hex');
    const bytes = createHash('sha1').update(namespace).update(key, 'utf8').digest().subarray(0, 16);
    bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50;
    bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
