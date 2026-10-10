import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { trialMachineLockKey } from '../../src/trial/trial-lock-key';

describe('trial machine lock key', () => {
    it('shares the exact T1 advisory lock key', () => {
        expect(
            trialMachineLockKey({ userId: 'user-1', vertical: VerticalEnum.ACCOMMODATION })
        ).toEqual({ key: `trial-start:user-1:${VerticalEnum.ACCOMMODATION}` });
    });
});
