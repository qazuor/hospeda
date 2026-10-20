import { SUBSCRIPTION_STATUSES } from '@repo/db';
import { describe, expect, it } from 'vitest';
import {
    getProviderNoticeMirror,
    READ_STATES
} from '../../../../src/services/billing/notice/provider-notice-mirror.js';
import type { MirrorPairId } from '../../../../src/services/billing/notice/provider-notice-ports.js';

describe('provider notice mirror grid', () => {
    it('contains all 36 TEST:B3:18 pairs and exact action counts', () => {
        const cells = READ_STATES.flatMap((state) =>
            SUBSCRIPTION_STATUSES.map((status) => getProviderNoticeMirror()[state][status])
        );
        const counts = { NOOP: 0, S2: 0, PROVIDER_CANCEL: 0, DIVERGENCE: 0, DELEGATE: 0 };
        for (const action of cells) counts[action.kind] += 1;
        expect(cells).toHaveLength(36);
        expect(counts).toEqual({ NOOP: 9, S2: 1, PROVIDER_CANCEL: 1, DIVERGENCE: 7, DELEGATE: 18 });
    });

    it('freezes the HOS-1688 cells and the neighboring decisions', () => {
        const mirror = getProviderNoticeMirror();
        const delegate = (pair: MirrorPairId) => ({ kind: 'DELEGATE' as const, pair });
        expect(mirror.active.GRACE_PERIOD).toEqual({ kind: 'NOOP' });
        expect(mirror.active.SUSPENDED).toEqual({ kind: 'DIVERGENCE' });
        expect(mirror.active.ACTIVE).toEqual({ kind: 'NOOP' });
        expect(mirror.active.PENDING_AUTHORIZATION).toEqual({ kind: 'S2' });
        expect(mirror.paused.ACTIVE).toEqual(delegate('PROVIDER_PAUSE_IS_ARREARS'));
        expect(mirror.paused.GRACE_PERIOD).toEqual(delegate('PROVIDER_PAUSE_IS_ARREARS'));
        expect(mirror.cancelled.GRACE_PERIOD).toEqual(delegate('CANCELLED_ON_GRACE'));
        expect(mirror.cancelled.ACTIVE).toEqual({ kind: 'PROVIDER_CANCEL' });
        expect(mirror.cancelled.SUSPENDED).toEqual({ kind: 'NOOP' });
    });
});
