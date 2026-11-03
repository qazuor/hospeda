import { BillingDeadlineValuesSchema, VerticalDeadlineValuesSchema } from '@repo/schemas';

/** API and validation configuration for each independently versioned deadline half. */
export const DEADLINE_HALVES = {
    vertical: {
        basePath: '/api/v1/admin/vertical-deadlines',
        keys: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        valuesSchema: VerticalDeadlineValuesSchema,
        sectionKey: 'vertical'
    },
    billing: {
        basePath: '/api/v1/admin/billing-deadlines',
        keys: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        valuesSchema: BillingDeadlineValuesSchema,
        sectionKey: 'billing'
    }
} as const;

/** Resolves a deadline key to its owning API half. */
export function getDeadlineHalf(key: number): 'vertical' | 'billing' {
    const half = Object.entries(DEADLINE_HALVES).find(([, config]) =>
        config.keys.includes(key as never)
    )?.[0];
    if (half !== 'vertical' && half !== 'billing') throw new Error(`Unknown deadline key: ${key}`);
    return half;
}
