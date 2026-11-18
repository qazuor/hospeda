/**
 * Shared harness of the provider and benefit-usage tool tests (HOS-2332).
 *
 * The usage tools read through a REAL `HostTradeUsageService` built over fake
 * models, so the counterpart rule the tests assert is the service's own, not a
 * stub of it. The directory service (`listForHost`, `getOwn`) is a fake: its
 * scoping lives in SQL the route tests already cover, and the tools only
 * consume its answer.
 *
 * @module test/mcp/tools/host-trade/host-trade-tools.harness
 */

import type {
    HostTradeBenefitUsageModel,
    HostTradeModel,
    HostTradeReviewModel,
    UserModel
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { type Actor, HostTradeUsageService } from '@repo/service-core';
import { vi } from 'vitest';

/** The account that is BOTH a host and a provider (`host-provider@local.test`). */
export const HOST_PROVIDER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
/** Another host. */
export const OTHER_HOST_ID = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
/** The owner of another provider listing. */
export const OTHER_PROVIDER_OWNER_ID = '3b4c5d6e-7f8a-4b9c-8d0e-1f2a3b4c5d6e';
/** The host-provider's own directory listing. */
export const OWN_TRADE_ID = 'a1111111-1111-4111-8111-111111111111';
/** Another provider's listing. */
export const OTHER_TRADE_ID = 'a2222222-2222-4222-8222-222222222222';
export const CLIENT = 'https://claude.ai/oauth/mcp-client-metadata';
export const OTHER_CLIENT = 'https://chatgpt.com/oauth/client';
export const context = { channel: 'mcp', clientId: CLIENT } as const;

/** An actor. Roles are passed in to prove they decide nothing. */
export const actorFor = (
    id: string = HOST_PROVIDER_ID,
    options: { readonly roles?: readonly RoleEnum[]; readonly emailVerified?: boolean } = {}
): Actor =>
    ({
        id,
        roles: options.roles ?? [RoleEnum.HOST],
        permissions: [PermissionEnum.HOST_TRADE_VIEW],
        emailVerified: options.emailVerified ?? true
    }) as unknown as Actor;

/** A usage row as the model returns it. */
export const usageRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'c1111111-1111-4111-8111-111111111111',
    hostTradeId: OTHER_TRADE_ID,
    hostUserId: HOST_PROVIDER_ID,
    declaredBy: 'PROVIDER',
    declaredById: OTHER_PROVIDER_OWNER_ID,
    creationChannel: 'LINKED_SELECTOR',
    status: 'PENDING',
    servicedAt: '2026-11-01',
    note: null,
    expiresAt: new Date('2026-12-01T00:00:00Z'),
    confirmedAt: null,
    confirmedById: null,
    rejectedAt: null,
    rejectedById: null,
    rejectionNote: null,
    createdAt: new Date('2026-11-02T00:00:00Z'),
    updatedAt: new Date('2026-11-02T00:00:00Z'),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    ...overrides
});

/** Listings by id: who owns each one. */
const TRADES: Readonly<Record<string, { ownerUserId: string; slug: string; name: string }>> = {
    [OWN_TRADE_ID]: { ownerUserId: HOST_PROVIDER_ID, slug: 'mi-plomeria', name: 'Mi Plomería' },
    [OTHER_TRADE_ID]: {
        ownerUserId: OTHER_PROVIDER_OWNER_ID,
        slug: 'electricidad-sur',
        name: 'Electricidad Sur'
    }
};

/**
 * Builds a real usage service over fake models.
 *
 * @param rows - The usage rows the fake table holds
 * @returns The service and the fake models (to assert what was queried)
 */
export function buildUsageService(rows: readonly Record<string, unknown>[] = []) {
    const usageModel = {
        findById: vi.fn(async (id: string) => rows.find((row) => row.id === id) ?? null),
        findAll: vi.fn(async (where: Record<string, unknown>) => {
            const items = rows.filter((row) =>
                Object.entries(where).every(([key, value]) =>
                    key === 'deletedAt' ? row.deletedAt === null : row[key] === value
                )
            );
            return { items, total: items.length };
        }),
        findPendingForUser: vi.fn(async (userId: string) =>
            rows.filter(
                (row) =>
                    row.hostUserId === userId &&
                    row.status === 'PENDING' &&
                    row.declaredBy === 'PROVIDER'
            )
        ),
        countPendingForUser: vi.fn(
            async (userId: string) =>
                rows.filter(
                    (row) =>
                        row.hostUserId === userId &&
                        row.status === 'PENDING' &&
                        row.declaredBy === 'PROVIDER'
                ).length
        ),
        findLinkedHostsWithNames: vi.fn(async () => [
            { id: OTHER_HOST_ID, displayName: 'Ana', firstName: null, lastName: null }
        ]),
        update: vi.fn()
    };
    const hostTradeModel = {
        findById: vi.fn(async (id: string) => {
            const trade = TRADES[id];
            return trade ? { id, ...trade } : null;
        }),
        findByIds: vi.fn(async (ids: readonly string[]) =>
            ids.flatMap((id) => {
                const trade = TRADES[id];
                return trade ? [{ id, ...trade }] : [];
            })
        ),
        hydrateCategories: vi.fn(async () => new Map())
    };
    const reviewModel = { findAll: vi.fn(async () => ({ items: [], total: 0 })) };
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const service = new HostTradeUsageService(
        { logger: logger as never },
        usageModel as unknown as HostTradeBenefitUsageModel,
        hostTradeModel as unknown as HostTradeModel,
        {} as unknown as UserModel,
        async () => true,
        reviewModel as unknown as HostTradeReviewModel
    );
    return { service, usageModel, hostTradeModel };
}

/** The host-provider's own listing, as `HostTradeService.getOwn` returns it. */
export const ownTrade = () => ({
    id: OWN_TRADE_ID,
    slug: 'mi-plomeria',
    name: 'Mi Plomería',
    ownerUserId: HOST_PROVIDER_ID,
    benefit: '10% para anfitriones',
    contact: '+54 3442 000000',
    destinationId: 'd1111111-1111-4111-8111-111111111111',
    categories: []
});

/** In-memory Redis fake (single process). */
export function makeFakeRedis() {
    const data = new Map<string, string>();
    return {
        set: vi.fn(async (key: string, value: string) => {
            data.set(key, value);
            return 'OK';
        }),
        getdel: vi.fn(async (key: string) => {
            const value = data.get(key) ?? null;
            data.delete(key);
            return value;
        })
    };
}
