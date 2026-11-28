import { DirectEmailRecipientStatusEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type {
    DirectEmailProviderEvent,
    ProviderEventRowState
} from '../../../src/models/direct-email/directEmailRecipient.model.ts';
import {
    DirectEmailRecipientModel,
    resolveProviderEventUpdate
} from '../../../src/models/direct-email/directEmailRecipient.model.ts';
import type { DrizzleClient } from '../../../src/types.ts';

const { SENT, DELIVERED, OPENED, BOUNCED, FAILED, SUPPRESSED } = DirectEmailRecipientStatusEnum;
const T1 = new Date('2026-11-28T10:00:00Z');
const T2 = new Date('2026-11-28T10:05:00Z');

const row = (overrides: Partial<ProviderEventRowState> = {}): ProviderEventRowState => ({
    status: SENT,
    deliveredAt: null,
    openedAt: null,
    bouncedAt: null,
    ...overrides
});

/** Applies events in order the way the webhook does, feeding each result back as the row. */
function replay(events: ReadonlyArray<readonly [DirectEmailProviderEvent, Date]>) {
    let state = row();
    for (const [event, at] of events) {
        const update = resolveProviderEventUpdate({ row: state, event, at });
        if (update) state = { ...state, ...update } as ProviderEventRowState;
    }
    return state;
}

describe('resolveProviderEventUpdate (HOS-2685, AC-9)', () => {
    it.each<[DirectEmailProviderEvent, Record<string, unknown>]>([
        ['delivered', { status: DELIVERED, deliveredAt: T1 }],
        ['opened', { status: OPENED, openedAt: T1 }],
        ['hard_bounce', { status: BOUNCED, bouncedAt: T1 }],
        ['soft_bounce', { bouncedAt: T1 }]
    ])('maps %s from sent', (event, expected) => {
        expect(resolveProviderEventUpdate({ row: row(), event, at: T1 })).toEqual(expected);
    });

    it('a soft bounce is not terminal: delivered and opened still advance the row', () => {
        // Regression: soft_bounce used to set status BOUNCED, which blocked both.
        const state = replay([
            ['soft_bounce', T1],
            ['delivered', T2],
            ['opened', T2]
        ]);

        expect(state.status).toBe(OPENED);
        expect(state.bouncedAt).toEqual(T1);
        expect(state.deliveredAt).toEqual(T2);
        expect(state.openedAt).toEqual(T2);
    });

    it('a late delivered still fills delivered_at after opened, without regressing the status', () => {
        // Regression: delivered only applied to status sent, so delivered_at stayed null.
        const state = replay([
            ['opened', T1],
            ['delivered', T2]
        ]);

        expect(state.status).toBe(OPENED);
        expect(state.openedAt).toEqual(T1);
        expect(state.deliveredAt).toEqual(T2);
    });

    it('keeps the first timestamp of each kind on a duplicate event', () => {
        const state = replay([
            ['delivered', T1],
            ['delivered', T2],
            ['opened', T1],
            ['opened', T2]
        ]);

        expect(state.deliveredAt).toEqual(T1);
        expect(state.openedAt).toEqual(T1);
        expect(resolveProviderEventUpdate({ row: state, event: 'opened', at: T2 })).toBeNull();
    });

    it('a hard bounce wins over a soft one and is terminal', () => {
        const state = replay([
            ['soft_bounce', T1],
            ['hard_bounce', T2],
            ['delivered', T2],
            ['opened', T2]
        ]);

        expect(state.status).toBe(BOUNCED);
        expect(state.bouncedAt).toEqual(T2);
        expect(state.deliveredAt).toBeNull();
        expect(state.openedAt).toBeNull();
    });

    it.each([FAILED, SUPPRESSED])('never touches a %s row', (status) => {
        for (const event of ['delivered', 'opened', 'hard_bounce', 'soft_bounce'] as const) {
            expect(resolveProviderEventUpdate({ row: row({ status }), event, at: T1 })).toBeNull();
        }
    });
});

/** Fake client: serves `current` to select(), records the SET clause of update(). */
function buildClient(input: {
    readonly current: Record<string, unknown> | undefined;
    readonly updated?: Record<string, unknown> | undefined;
}) {
    const set = vi.fn();
    const selectChain = {
        from: () => selectChain,
        where: () => selectChain,
        limit: async () => (input.current ? [input.current] : [])
    };
    const updateChain = {
        set: (value: unknown) => {
            set(value);
            return updateChain;
        },
        where: () => updateChain,
        returning: async () => (input.updated ? [input.updated] : [])
    };
    const client = {
        select: () => selectChain,
        update: () => updateChain
    } as unknown as DrizzleClient;
    return { client, set };
}

describe('DirectEmailRecipientModel.applyProviderEvent', () => {
    const model = new DirectEmailRecipientModel();

    it('writes the resolved update and returns the updated row', async () => {
        const { client, set } = buildClient({
            current: { id: 'r1', ...row() },
            updated: { id: 'r1' }
        });

        const result = await model.applyProviderEvent(
            { providerMessageId: '<m1>', event: 'delivered', at: T1 },
            client
        );

        expect(set).toHaveBeenCalledWith({ status: DELIVERED, deliveredAt: T1 });
        expect(result).toEqual({ id: 'r1' });
    });

    it('returns null for an unknown message id without writing', async () => {
        const { client, set } = buildClient({ current: undefined });

        const result = await model.applyProviderEvent(
            { providerMessageId: '<none>', event: 'delivered', at: T1 },
            client
        );

        expect(result).toBeNull();
        expect(set).not.toHaveBeenCalled();
    });

    it('returns null without writing when the event changes nothing', async () => {
        const { client, set } = buildClient({
            current: { id: 'r1', ...row({ status: OPENED, deliveredAt: T1, openedAt: T1 }) }
        });

        const result = await model.applyProviderEvent(
            { providerMessageId: '<m1>', event: 'opened', at: T2 },
            client
        );

        expect(result).toBeNull();
        expect(set).not.toHaveBeenCalled();
    });
});
