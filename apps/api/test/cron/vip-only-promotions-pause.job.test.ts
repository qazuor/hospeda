/**
 * HOS-2589 D-8: the «Solo VIP» pause sweep (AC-35, AC-36, AC-39).
 * Collaborators are injected; the pause itself is a fake that only touches rows
 * still ACTIVE, exactly like the model's guarded UPDATE.
 */
import type { ActiveVipPromotionRow } from '@repo/db';
import { NotificationType, type VipPromotionsPausedPayload } from '@repo/notifications';
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    runVipOnlyPromotionsPause,
    type VipOnlyPauseDeps
} from '../../src/cron/jobs/vip-only-promotions-pause.job';

const NOW = new Date('2026-11-24T12:20:00.000Z');

function world(input: { readonly holders: ReadonlySet<string>; readonly failing?: string }) {
    const active = new Map<string, ActiveVipPromotionRow>([
        ['a1', { id: 'a1', ownerId: 'lost', entityType: 'accommodation', title: 'Finde largo' }],
        ['v1', { id: 'v1', ownerId: 'lost', entityType: 'venue', title: 'Cena VIP' }],
        ['k1', { id: 'k1', ownerId: 'keeps', entityType: 'accommodation', title: 'Noche extra' }],
        ['e1', { id: 'e1', ownerId: 'outage', entityType: 'venue', title: 'Brindis' }]
    ]);
    const sent: VipPromotionsPausedPayload[] = [];
    const deps: VipOnlyPauseDeps = {
        findActiveVipPromotions: vi.fn(async () => [...active.values()]),
        holdsVipOnlyKey: vi.fn(async ({ userId }: { readonly userId: string }) => {
            if (userId === input.failing) throw new Error('effective set down');
            return input.holders.has(userId);
        }),
        pause: vi.fn(async ({ ids }: { readonly ids: readonly string[] }) => {
            const paused = ids.filter((id) => active.has(id));
            for (const id of paused) active.delete(id);
            return paused;
        }),
        readRecipients: vi.fn(async ({ ids }: { readonly ids: readonly string[] }) =>
            ids.map((id) => ({
                id,
                email: `${id}@x.test`,
                name: id,
                settings: { languageWeb: 'es' }
            }))
        ),
        send: vi.fn(async (payload: VipPromotionsPausedPayload) => {
            sent.push(payload);
            return { delivered: true };
        }),
        siteUrl: 'https://hospeda.test'
    };
    return { deps, sent, active };
}

describe('runVipOnlyPromotionsPause', () => {
    it('AC-35: pauses only the promotions of owners who lost the key, per vertical', async () => {
        const { deps, active } = world({ holders: new Set(['keeps']), failing: 'outage' });

        const output = await runVipOnlyPromotionsPause({ now: NOW, deps });

        expect(output).toMatchObject({ paused: 2, notified: 1, readErrors: 1 });
        expect([...active.keys()].sort()).toEqual(['e1', 'k1']);
        expect(deps.holdsVipOnlyKey).toHaveBeenCalledWith({
            userId: 'lost',
            vertical: VerticalEnum.VENUE
        });
        expect(deps.holdsVipOnlyKey).toHaveBeenCalledWith({
            userId: 'lost',
            vertical: VerticalEnum.ACCOMMODATION
        });
    });

    it('an effective-set outage pauses nothing for that owner', async () => {
        const { deps, active } = world({ holders: new Set(['keeps', 'lost']), failing: 'outage' });
        await runVipOnlyPromotionsPause({ now: NOW, deps });
        expect(active.has('e1')).toBe(true);
        expect(deps.pause).not.toHaveBeenCalled();
    });

    it('AC-36: one email per owner naming every paused title, no tourist data', async () => {
        const { deps, sent } = world({ holders: new Set(['keeps']), failing: 'outage' });
        await runVipOnlyPromotionsPause({ now: NOW, deps });

        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({
            type: NotificationType.VIP_PROMOTIONS_PAUSED,
            userId: 'lost',
            locale: 'es',
            promotionsUrl: 'https://hospeda.test/es/mi-cuenta/promociones/',
            pausedSubject: 'Pausamos 2 promociones «Solo VIP»'
        });
        expect([...(sent[0]?.promotionTitles ?? [])].sort()).toEqual(['Cena VIP', 'Finde largo']);
    });

    it('AC-39: a second run changes nothing and sends nothing', async () => {
        const { deps, sent } = world({ holders: new Set(['keeps']), failing: 'outage' });
        await runVipOnlyPromotionsPause({ now: NOW, deps });
        const second = await runVipOnlyPromotionsPause({ now: NOW, deps });

        expect(second).toMatchObject({ paused: 0, notified: 0 });
        expect(sent).toHaveLength(1);
    });

    it('an owner who keeps the key is never paused', async () => {
        const { deps, sent } = world({ holders: new Set(['keeps', 'lost', 'outage']) });
        const output = await runVipOnlyPromotionsPause({ now: NOW, deps });
        expect(output.paused).toBe(0);
        expect(sent).toHaveLength(0);
        expect(deps.pause).not.toHaveBeenCalled();
    });
});
