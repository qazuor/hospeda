import { TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveSubscribeDestination } from '../../src/publication/subscribe-destination';
import { createInMemoryTrialStart } from '../trial/in-memory-trial-start';
import { emailPseudonym, event, listingId, userId } from './support';

function setup(
    args: { covered?: boolean; days?: number; declared?: boolean; sellable?: boolean } = {}
) {
    const memory = createInMemoryTrialStart();
    memory.setActivationEvent(VerticalEnum.ACCOMMODATION, args.declared === false ? null : event);
    memory.setTrialPlan(VerticalEnum.ACCOMMODATION, {
        planId: listingId,
        planVersionId: listingId,
        trialDays: args.days ?? 14
    });
    memory.setSellableVersions(
        VerticalEnum.ACCOMMODATION,
        args.sellable === false
            ? []
            : [
                  {
                      id: listingId,
                      planId: listingId,
                      vertical: VerticalEnum.ACCOMMODATION,
                      rank: 1,
                      sellable: true,
                      current: true
                  }
              ]
    );
    const billing = { coverage: async () => ({ covered: args.covered ?? false, sources: [] }) };
    const input = { userId, vertical: VerticalEnum.ACCOMMODATION, event, emailPseudonym };
    return { memory, billing, input };
}

const consumed = {
    id: listingId,
    userId,
    vertical: VerticalEnum.ACCOMMODATION,
    status: TrialStatusEnum.TRIAL_CONVERTED,
    emailPseudonym,
    trialPlanId: null,
    floorEntitlementsVersionId: null,
    floorLimitsVersionId: null,
    floorTrialPlanVersionId: null,
    startedAt: null,
    endsAt: null,
    deadlinesVersion: null
} as const;

describe('TEST:V8a:2 resolveSubscribeDestination', () => {
    it('returns PUBLISH with the trial plan days when PB1 can start', async () => {
        const f = setup();
        expect(
            await resolveSubscribeDestination({
                reader: f.memory.reader,
                billing: f.billing,
                input: f.input
            })
        ).toEqual({ destination: 'PUBLISH', trialDays: 14 });
    });
    it.each([
        [
            'activation already exercised',
            (m: ReturnType<typeof createInMemoryTrialStart>) =>
                m.setTrialRow(userId, VerticalEnum.ACCOMMODATION, consumed)
        ],
        [
            'trial already consumed',
            (m: ReturnType<typeof createInMemoryTrialStart>) =>
                m.setTrialRow(userId, VerticalEnum.ACCOMMODATION, consumed)
        ],
        ['vertical has no activation event', undefined],
        ['trial days are zero', undefined],
        [
            'email hash already has a row',
            (m: ReturnType<typeof createInMemoryTrialStart>) =>
                m.setTrialRow('00000000-0000-4000-8000-000000000009', VerticalEnum.ACCOMMODATION, {
                    ...consumed,
                    userId: '00000000-0000-4000-8000-000000000009'
                })
        ]
    ])('%s routes to CHECKOUT', async (_label, seed) => {
        const f = setup({
            declared: _label === 'vertical has no activation event' ? false : undefined,
            days: _label === 'trial days are zero' ? 0 : undefined
        });
        if (seed) seed(f.memory);
        const result = await resolveSubscribeDestination({
            reader: f.memory.reader,
            billing: f.billing,
            input: f.input
        });
        expect(result.destination).toBe('CHECKOUT');
    });
    it('returns COVERED and gives NO_PLANS_AVAILABLE precedence over zero trial days', async () => {
        const covered = setup({ covered: true });
        expect(
            await resolveSubscribeDestination({
                reader: covered.memory.reader,
                billing: covered.billing,
                input: covered.input
            })
        ).toEqual({ destination: 'COVERED' });
        const empty = setup({ days: 0, sellable: false });
        expect(
            await resolveSubscribeDestination({
                reader: empty.memory.reader,
                billing: empty.billing,
                input: empty.input
            })
        ).toEqual({ destination: 'NO_PLANS_AVAILABLE' });
    });
});
