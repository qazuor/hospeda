/**
 * HOS-2589 §7.7: the weekly VIP promotions digest (AC-14..AC-19) and its pure
 * helpers. The collaborators are injected, so the run is tested without a DB.
 */
import { NotificationType, type VipPromotionsWeeklyDigestPayload } from '@repo/notifications';
import { describe, expect, it, vi } from 'vitest';
import {
    runVipPromotionsWeeklyDigest,
    type VipPromotionsDigestDeps
} from '../../src/cron/jobs/vip-promotions-weekly-digest.job';
import {
    acceptsVipDigest,
    buildPlaceUrl,
    formatDigestBenefit,
    formatStartsLabel,
    previousArtWeek
} from '../../src/services/vip-promotions-digest.helpers';

/** Monday 2026-11-23 10:00 ART = 13:00 UTC. */
const NOW = new Date('2026-11-23T13:00:00.000Z');

function promotionRow(n: number, audience: 'plus' | 'vip', entityType = 'accommodation') {
    return {
        promotion: {
            id: `p${n}`,
            title: `Promo ${n}`,
            description: null,
            discountType: 'percentage',
            discountValue: 10 * n,
            validFrom: new Date('2026-11-17T00:00:00Z'),
            entityType,
            touristAudience: audience
        },
        place: { slug: `place-${n}`, name: `Place ${n}` }
    } as never;
}

function deps(overrides: Partial<VipPromotionsDigestDeps> = {}) {
    const sent: VipPromotionsWeeklyDigestPayload[] = [];
    const base: VipPromotionsDigestDeps = {
        readPromotions: vi.fn(async () => ({
            rows: [
                promotionRow(1, 'plus'),
                promotionRow(2, 'vip', 'venue'),
                promotionRow(3, 'plus')
            ],
            total: 3
        })),
        readCandidates: vi.fn(async () => ({
            recipients: [
                { id: 'vip', email: 'v@x.test', name: 'Vera', settings: { languageWeb: 'en' } },
                { id: 'free', email: 'f@x.test', name: 'Fede', settings: {} },
                {
                    id: 'optout',
                    email: 'o@x.test',
                    name: 'Olga',
                    settings: { vipPromotionsDigest: false }
                }
            ]
        })),
        isVip: vi.fn(async ({ userId }) => userId !== 'free'),
        alreadySent: vi.fn(async () => false),
        send: vi.fn(async (payload: VipPromotionsWeeklyDigestPayload) => {
            sent.push(payload);
            return { delivered: true };
        }),
        siteUrl: 'https://hospeda.test/',
        ...overrides
    };
    return { deps: base, sent };
}

describe('runVipPromotionsWeeklyDigest', () => {
    it('AC-14: sends one email to the VIP with exactly the week promotions, in their locale', async () => {
        const { deps: d, sent } = deps();

        const output = await runVipPromotionsWeeklyDigest({ now: NOW, deps: d });

        expect(output).toMatchObject({
            promotions: 3,
            sent: 1,
            skippedNotVip: 1,
            skippedOptOut: 1
        });
        expect(sent).toHaveLength(1);
        const payload = sent[0];
        expect(payload?.type).toBe(NotificationType.VIP_PROMOTIONS_WEEKLY_DIGEST);
        expect(payload?.userId).toBe('vip');
        expect(payload?.locale).toBe('en');
        expect(payload?.promotions.map((p) => p.title)).toEqual(['Promo 1', 'Promo 2', 'Promo 3']);
        expect(payload?.promotions[1]).toMatchObject({
            vipOnly: true,
            placeUrl: 'https://hospeda.test/en/comer-y-salir/place-2/'
        });
        expect(payload?.promotionsUrl).toBe('https://hospeda.test/en/promociones/');
        expect(payload?.digestSubject).toBe('3 new promotions this week');
    });

    it('reads the previous ART week window', async () => {
        const { deps: d } = deps();
        await runVipPromotionsWeeklyDigest({ now: NOW, deps: d });
        expect(d.readPromotions).toHaveBeenCalledWith({
            from: new Date('2026-11-16T03:00:00.000Z'),
            to: new Date('2026-11-23T03:00:00.000Z'),
            now: NOW,
            limit: 10
        });
    });

    it('AC-15: no new promotion sends nothing and reads no recipient', async () => {
        const { deps: d, sent } = deps({
            readPromotions: vi.fn(async () => ({ rows: [], total: 0 }))
        });
        const output = await runVipPromotionsWeeklyDigest({ now: NOW, deps: d });
        expect(output.sent).toBe(0);
        expect(sent).toHaveLength(0);
        expect(d.readCandidates).not.toHaveBeenCalled();
    });

    it('AC-16: allowEmails false skips the VIP', async () => {
        const { deps: d, sent } = deps({
            readCandidates: vi.fn(async () => ({
                recipients: [
                    {
                        id: 'vip',
                        email: 'v@x.test',
                        name: 'V',
                        settings: { notifications: { allowEmails: false } }
                    }
                ]
            }))
        });
        await runVipPromotionsWeeklyDigest({ now: NOW, deps: d });
        expect(sent).toHaveLength(0);
    });

    it('AC-18: a second run in the same week sends nothing more', async () => {
        const keys = new Set<string>();
        const { deps: d, sent } = deps({
            alreadySent: vi.fn(async ({ idempotencyKey }) => keys.has(idempotencyKey)),
            send: vi.fn(async (payload: VipPromotionsWeeklyDigestPayload) => {
                keys.add(payload.idempotencyKey ?? '');
                return { delivered: true };
            })
        });
        await runVipPromotionsWeeklyDigest({ now: NOW, deps: d });
        const second = await runVipPromotionsWeeklyDigest({ now: NOW, deps: d });
        expect(second).toMatchObject({ sent: 0, skippedAlreadySent: 1 });
        expect(d.send).toHaveBeenCalledTimes(1);
        expect(sent).toHaveLength(0);
        expect([...keys][0]).toMatch(/^vip-promotions-digest:vip:2026-W\d{2}$/);
    });

    it('lists at most the read rows and counts the rest as «y X más»', async () => {
        const { deps: d, sent } = deps({
            readPromotions: vi.fn(async () => ({ rows: [promotionRow(1, 'plus')], total: 14 }))
        });
        await runVipPromotionsWeeklyDigest({ now: NOW, deps: d });
        expect(sent[0]?.moreCount).toBe(13);
    });
});

describe('vip digest helpers', () => {
    it('previousArtWeek spans the ART Monday-to-Monday before now', () => {
        expect(previousArtWeek({ now: new Date('2026-11-23T02:59:00Z') })).toEqual({
            from: new Date('2026-11-09T03:00:00.000Z'),
            to: new Date('2026-11-16T03:00:00.000Z')
        });
    });

    it('acceptsVipDigest honours both switches', () => {
        expect(acceptsVipDigest({ settings: null }).accepts).toBe(true);
        expect(acceptsVipDigest({ settings: { vipPromotionsDigest: false } }).accepts).toBe(false);
        expect(
            acceptsVipDigest({ settings: { notifications: { allowEmails: false } } }).accepts
        ).toBe(false);
    });

    it('formatDigestBenefit mirrors the web benefit line', () => {
        const base = { description: 'Postre gratis', title: 'T', locale: 'es' as const };
        expect(
            formatDigestBenefit({ ...base, discountType: 'percentage', discountValue: 20 })
        ).toBe('20% de descuento');
        expect(formatDigestBenefit({ ...base, discountType: 'free_night', discountValue: 0 })).toBe(
            'Noche gratis'
        );
        expect(
            formatDigestBenefit({ ...base, discountType: 'special_offer', discountValue: 0 })
        ).toBe('Postre gratis');
        expect(
            formatDigestBenefit({ ...base, discountType: 'fixed', discountValue: 5000 })
        ).toMatch(/5\.000/);
    });

    it('formatStartsLabel only for a future start', () => {
        expect(
            formatStartsLabel({ validFrom: new Date('2026-11-01'), now: NOW, locale: 'es' })
        ).toBeNull();
        expect(
            formatStartsLabel({
                validFrom: new Date('2026-12-05T12:00:00Z'),
                now: NOW,
                locale: 'es'
            })
        ).toMatch(/^Desde el 5 de diciembre/);
    });

    it('buildPlaceUrl uses the public section of the place type', () => {
        expect(
            buildPlaceUrl({
                siteUrl: 'https://h.test',
                locale: 'pt',
                entityType: 'accommodation',
                slug: 's'
            }).url
        ).toBe('https://h.test/pt/alojamientos/s/');
    });
});
