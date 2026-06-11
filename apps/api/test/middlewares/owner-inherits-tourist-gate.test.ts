/**
 * @file owner-inherits-tourist-gate.test.ts
 * @description SPEC-216 integration check — an owner-plan actor now passes a
 * tourist-entitlement gate (`gateFavorites`) that previously returned 403, because
 * owner plans inherit the tourist-VIP set. Exercises the real gate middleware
 * against the real owner-plan config (no DB), and confirms the gate still blocks an
 * actor whose plan lacks the entitlement.
 */

import { EntitlementKey, getPlanBySlug } from '@repo/billing';
import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { gateFavorites } from '../../src/middlewares/tourist-entitlements';

/** Minimal Hono context stub — the gate only reads `c.get('userEntitlements')`. */
function contextWithEntitlements(entitlements: Set<EntitlementKey>): Context {
    return {
        get: (key: string) => (key === 'userEntitlements' ? entitlements : undefined)
    } as unknown as Context;
}

describe('SPEC-216 — owner plan passes a tourist gate', () => {
    it('an owner-basico actor passes gateFavorites (previously 403)', async () => {
        const plan = getPlanBySlug('owner-basico');
        expect(plan).toBeDefined();
        expect(plan?.entitlements).toContain(EntitlementKey.SAVE_FAVORITES);

        const c = contextWithEntitlements(new Set(plan?.entitlements));
        const next = vi.fn(async () => {});

        await gateFavorites()(c, next);

        expect(next).toHaveBeenCalledOnce();
    });

    it('every owner/complex plan resolves SAVE_FAVORITES through the gate', async () => {
        const slugs = [
            'owner-basico',
            'owner-pro',
            'owner-premium',
            'complex-basico',
            'complex-pro',
            'complex-premium'
        ];
        for (const slug of slugs) {
            const plan = getPlanBySlug(slug);
            const c = contextWithEntitlements(new Set(plan?.entitlements));
            const next = vi.fn(async () => {});
            await gateFavorites()(c, next);
            expect(next, `${slug} should pass gateFavorites`).toHaveBeenCalledOnce();
        }
    });

    it('gateFavorites still blocks an actor whose plan lacks SAVE_FAVORITES', async () => {
        const c = contextWithEntitlements(new Set());
        const next = vi.fn(async () => {});

        await expect(gateFavorites()(c, next)).rejects.toThrow();
        expect(next).not.toHaveBeenCalled();
    });
});
