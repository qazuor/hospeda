import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import type { FoldableSource } from '../../src/effective-set/types';

export const KEY = 'max_ai_chat_per_month';
export const at = (day: string) => new Date(`${day}T03:00:00.000Z`);

export function source(
    type: 'TRIAL' | 'SUBSCRIPTION' | 'ADDON' | 'BASE',
    since: Date | 'NOT_STARTED',
    quota: number
): FoldableSource {
    return {
        source: CoverageSourceSchema.parse({
            type,
            reference:
                type === 'ADDON'
                    ? { kind: 'ADDON_VERSION', addonVersionId: 'addon-v1' }
                    : { kind: 'PLAN_VERSION', planVersionId: 'plan-v1' },
            scope: type === 'ADDON' ? 'USER' : 'VERTICAL',
            target: null,
            since,
            until:
                since === 'NOT_STARTED'
                    ? 'NOT_STARTED'
                    : type === 'BASE'
                      ? 'NEVER_EXPIRES'
                      : new Date('2028-01-01T03:00:00.000Z'),
            charged: type === 'SUBSCRIPTION' ? true : null,
            floor: null
        }),
        grants: [{ key: KEY, value: quota, strategy: 'SUM' }]
    };
}
