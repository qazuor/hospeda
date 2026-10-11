import { SUBSCRIPTION_STATUSES } from '@repo/db';
import { describe, expect, it } from 'vitest';
import {
    PROVIDER_NOTICE_MIRROR,
    READ_STATES
} from '../../../../src/services/billing/notice/provider-notice-mirror.js';

describe('provider notice mirror grid', () => {
    it('contains all 36 TEST:B3:18 pairs and exact action counts', () => {
        const cells = READ_STATES.flatMap((state) =>
            SUBSCRIPTION_STATUSES.map((status) => PROVIDER_NOTICE_MIRROR[state][status])
        );
        const counts = { NOOP: 0, S2: 0, PROVIDER_CANCEL: 0, DIVERGENCE: 0, DELEGATE: 0 };
        for (const action of cells) counts[action.kind] += 1;
        expect(cells).toHaveLength(36);
        expect(counts).toEqual({ NOOP: 8, S2: 1, PROVIDER_CANCEL: 1, DIVERGENCE: 8, DELEGATE: 18 });
    });
});
