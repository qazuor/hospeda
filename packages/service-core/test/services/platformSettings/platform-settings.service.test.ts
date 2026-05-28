/**
 * Unit tests for PlatformSettingsService (SPEC-156, PR-1, T-004).
 *
 * Coverage:
 *   - get: success per key, forbidden when missing perm, null when row absent.
 *   - upsert: success per key, forbidden, validation rejection on key/value mismatch.
 *   - SEO key write triggers revalidation; other keys do NOT trigger it.
 *
 * @module test/services/platformSettings/platform-settings.service.test
 */

import { PlatformSettingsModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformSettingsService } from '../../../src/services/platformSettings/platform-settings.service.js';
import type { Actor } from '../../../src/types/index.js';
import { createActor } from '../../factories/actorFactory.js';
import {
    expectForbiddenError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

// Mock the RevalidationService accessor so we can assert on revalidation behavior.
const revalidateByEntityType = vi.fn().mockResolvedValue([]);
const getRevalidationServiceMock = vi.fn();
vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: () => getRevalidationServiceMock()
}));

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

const seoRow = {
    key: 'seo.defaults' as const,
    value: {
        metaTitleTemplate: '%s | Hospeda',
        metaDescriptionDefault: 'Alojamientos en Concepción del Uruguay',
        ogImageDefault: 'https://hospeda.com.ar/og.png'
    },
    updatedAt: new Date('2026-05-28T00:00:00Z'),
    updatedBy: '22222222-2222-4222-8222-222222222222'
};

const maintenanceRow = {
    key: 'maintenance.mode' as const,
    value: { enabled: true },
    updatedAt: new Date('2026-05-28T00:00:00Z'),
    updatedBy: '22222222-2222-4222-8222-222222222222'
};

describe('PlatformSettingsService', () => {
    let service: PlatformSettingsService;
    let modelMock: PlatformSettingsModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(PlatformSettingsModel, ['findByKey', 'upsertByKey']);
        loggerMock = createLoggerMock();
        service = new PlatformSettingsService({ logger: loggerMock }, modelMock);

        // Reset mocks
        getRevalidationServiceMock.mockReset();
        revalidateByEntityType.mockClear();
        // Default: revalidation service is "initialized"
        getRevalidationServiceMock.mockReturnValue({
            revalidateByEntityType
        });
    });

    // -------------------------------------------------------------------------
    // get
    // -------------------------------------------------------------------------

    describe('get', () => {
        it('returns the row when seo.defaults key exists and actor has SETTINGS_GENERAL_VIEW', async () => {
            const actor: Actor = createActor({
                permissions: [PermissionEnum.SETTINGS_GENERAL_VIEW]
            });
            asMock(modelMock.findByKey).mockResolvedValue(seoRow);

            const result = await service.get({ actor, key: 'seo.defaults' });

            expectSuccess(result);
            expect(result.data).toEqual(seoRow);
        });

        it('returns null when the seo.defaults key is absent', async () => {
            const actor: Actor = createActor({
                permissions: [PermissionEnum.SETTINGS_GENERAL_VIEW]
            });
            asMock(modelMock.findByKey).mockResolvedValue(undefined);

            const result = await service.get({ actor, key: 'seo.defaults' });

            expectSuccess(result);
            expect(result.data).toBeNull();
        });

        it('returns FORBIDDEN when actor lacks SETTINGS_GENERAL_VIEW for seo.defaults', async () => {
            const actor: Actor = createActor({ permissions: [] });
            asMock(modelMock.findByKey).mockResolvedValue(seoRow);

            const result = await service.get({ actor, key: 'seo.defaults' });

            expectForbiddenError(result);
            expect(modelMock.findByKey).not.toHaveBeenCalled();
        });

        it('returns FORBIDDEN when actor lacks MAINTENANCE_MODE_WRITE for maintenance.mode read', async () => {
            const actor: Actor = createActor({
                permissions: [PermissionEnum.SETTINGS_GENERAL_VIEW] // wrong perm for this key
            });
            asMock(modelMock.findByKey).mockResolvedValue(maintenanceRow);

            const result = await service.get({ actor, key: 'maintenance.mode' });

            expectForbiddenError(result);
        });

        it('returns VALIDATION_ERROR when given an unknown key', async () => {
            const actor: Actor = createActor({
                permissions: [PermissionEnum.SETTINGS_GENERAL_VIEW]
            });

            const result = await service.get({
                actor,
                // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
                key: 'unknown.key' as any
            });

            expectValidationError(result);
        });
    });

    // -------------------------------------------------------------------------
    // upsert
    // -------------------------------------------------------------------------

    describe('upsert', () => {
        it('upserts seo.defaults when actor has SETTINGS_GENERAL_WRITE', async () => {
            const actor: Actor = createActor({
                id: VALID_UUID,
                permissions: [PermissionEnum.SETTINGS_GENERAL_WRITE]
            });
            asMock(modelMock.upsertByKey).mockResolvedValue(seoRow);

            const result = await service.upsert({
                actor,
                key: 'seo.defaults',
                value: seoRow.value
            });

            expectSuccess(result);
            expect(result.data).toEqual(seoRow);
            expect(modelMock.upsertByKey).toHaveBeenCalledWith(
                'seo.defaults',
                seoRow.value,
                VALID_UUID,
                undefined
            );
        });

        it('upserts maintenance.mode when actor has MAINTENANCE_MODE_WRITE', async () => {
            const actor: Actor = createActor({
                id: VALID_UUID,
                permissions: [PermissionEnum.MAINTENANCE_MODE_WRITE]
            });
            asMock(modelMock.upsertByKey).mockResolvedValue(maintenanceRow);

            const result = await service.upsert({
                actor,
                key: 'maintenance.mode',
                value: { enabled: true }
            });

            expectSuccess(result);
            expect(result.data?.value).toEqual({ enabled: true });
        });

        it('returns FORBIDDEN when actor lacks SETTINGS_GENERAL_WRITE for SEO write', async () => {
            const actor: Actor = createActor({
                permissions: [PermissionEnum.SETTINGS_GENERAL_VIEW] // read-only, not enough
            });

            const result = await service.upsert({
                actor,
                key: 'seo.defaults',
                value: seoRow.value
            });

            expectForbiddenError(result);
            expect(modelMock.upsertByKey).not.toHaveBeenCalled();
        });

        it('returns VALIDATION_ERROR when value shape does not match the key (SEO body sent under maintenance key)', async () => {
            const actor: Actor = createActor({
                permissions: [PermissionEnum.MAINTENANCE_MODE_WRITE]
            });

            const result = await service.upsert({
                actor,
                key: 'maintenance.mode',
                // SEO-shaped payload under maintenance.mode key
                value: seoRow.value
            });

            expectValidationError(result);
            expect(modelMock.upsertByKey).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // findActiveAnnouncements (T-010 — public read path, no actor required)
    // -------------------------------------------------------------------------

    describe('findActiveAnnouncements', () => {
        const NOW = new Date('2026-06-01T12:00:00.000Z');

        const item = (
            overrides: Partial<{
                id: string;
                startsAt?: string;
                endsAt?: string;
                text?: { es: string; en: string; pt: string };
                variant?: 'info' | 'warning' | 'danger';
                dismissible?: boolean;
            }> = {}
        ) => ({
            id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
            text: overrides.text ?? { es: 'Hola', en: 'Hello', pt: 'Olá' },
            variant: overrides.variant ?? ('info' as const),
            dismissible: overrides.dismissible ?? true,
            ...(overrides.startsAt ? { startsAt: overrides.startsAt } : {}),
            ...(overrides.endsAt ? { endsAt: overrides.endsAt } : {})
        });

        it('returns [] when the row is absent', async () => {
            asMock(modelMock.findByKey).mockResolvedValue(undefined);
            const result = await service.findActiveAnnouncements(NOW);
            expect(result).toEqual([]);
        });

        it('returns [] when the stored value fails schema validation (defensive)', async () => {
            asMock(modelMock.findByKey).mockResolvedValue({
                key: 'announcements.global',
                value: { not: 'an array' },
                updatedAt: NOW,
                updatedBy: VALID_UUID
            });
            const result = await service.findActiveAnnouncements(NOW);
            expect(result).toEqual([]);
            expect(loggerMock.warn).toHaveBeenCalled();
        });

        it('returns all announcements when none have a date window', async () => {
            const a = item({ id: '11111111-1111-4111-8111-111111111111' });
            const b = item({ id: '22222222-2222-4222-8222-222222222222' });
            asMock(modelMock.findByKey).mockResolvedValue({
                key: 'announcements.global',
                value: [a, b],
                updatedAt: NOW,
                updatedBy: VALID_UUID
            });
            const result = await service.findActiveAnnouncements(NOW);
            expect(result).toHaveLength(2);
        });

        it('filters out announcements whose startsAt is in the future', async () => {
            const future = item({
                id: '11111111-1111-4111-8111-111111111111',
                startsAt: '2026-07-01T00:00:00.000Z' // after NOW
            });
            const active = item({
                id: '22222222-2222-4222-8222-222222222222',
                startsAt: '2026-05-01T00:00:00.000Z' // before NOW
            });
            asMock(modelMock.findByKey).mockResolvedValue({
                key: 'announcements.global',
                value: [future, active],
                updatedAt: NOW,
                updatedBy: VALID_UUID
            });
            const result = await service.findActiveAnnouncements(NOW);
            expect(result).toHaveLength(1);
            expect(result[0]?.id).toBe('22222222-2222-4222-8222-222222222222');
        });

        it('filters out announcements whose endsAt is in the past', async () => {
            const expired = item({
                id: '11111111-1111-4111-8111-111111111111',
                endsAt: '2026-05-01T00:00:00.000Z' // before NOW
            });
            const active = item({
                id: '22222222-2222-4222-8222-222222222222',
                endsAt: '2026-07-01T00:00:00.000Z' // after NOW
            });
            asMock(modelMock.findByKey).mockResolvedValue({
                key: 'announcements.global',
                value: [expired, active],
                updatedAt: NOW,
                updatedBy: VALID_UUID
            });
            const result = await service.findActiveAnnouncements(NOW);
            expect(result).toHaveLength(1);
            expect(result[0]?.id).toBe('22222222-2222-4222-8222-222222222222');
        });

        it('includes announcements whose window spans now (startsAt + endsAt set)', async () => {
            const spanning = item({
                id: '11111111-1111-4111-8111-111111111111',
                startsAt: '2026-05-01T00:00:00.000Z',
                endsAt: '2026-07-01T00:00:00.000Z'
            });
            asMock(modelMock.findByKey).mockResolvedValue({
                key: 'announcements.global',
                value: [spanning],
                updatedAt: NOW,
                updatedBy: VALID_UUID
            });
            const result = await service.findActiveAnnouncements(NOW);
            expect(result).toHaveLength(1);
        });

        it('does NOT require an actor and does NOT check permissions', async () => {
            // No actor argument — this is the public path.
            asMock(modelMock.findByKey).mockResolvedValue({
                key: 'announcements.global',
                value: [item()],
                updatedAt: NOW,
                updatedBy: VALID_UUID
            });
            const result = await service.findActiveAnnouncements(NOW);
            expect(result).toHaveLength(1);
            // No FORBIDDEN error — verified by the fact that we got data back.
        });
    });

    // -------------------------------------------------------------------------
    // SEO revalidation hook (tech-analysis D7)
    // -------------------------------------------------------------------------

    describe('SEO revalidation hook', () => {
        it('triggers revalidateByEntityType("post") after successful seo.defaults upsert', async () => {
            const actor: Actor = createActor({
                id: VALID_UUID,
                permissions: [PermissionEnum.SETTINGS_GENERAL_WRITE]
            });
            asMock(modelMock.upsertByKey).mockResolvedValue(seoRow);

            await service.upsert({ actor, key: 'seo.defaults', value: seoRow.value });

            expect(revalidateByEntityType).toHaveBeenCalledTimes(1);
            expect(revalidateByEntityType).toHaveBeenCalledWith({
                entityType: 'post',
                trigger: 'hook'
            });
        });

        it('does NOT trigger revalidation for non-SEO keys (maintenance.mode)', async () => {
            const actor: Actor = createActor({
                id: VALID_UUID,
                permissions: [PermissionEnum.MAINTENANCE_MODE_WRITE]
            });
            asMock(modelMock.upsertByKey).mockResolvedValue(maintenanceRow);

            await service.upsert({ actor, key: 'maintenance.mode', value: { enabled: true } });

            expect(revalidateByEntityType).not.toHaveBeenCalled();
        });

        it('does NOT trigger revalidation when the upsert fails (permission check rejection)', async () => {
            const actor: Actor = createActor({
                permissions: [] // no write perm
            });

            await service.upsert({ actor, key: 'seo.defaults', value: seoRow.value });

            expect(revalidateByEntityType).not.toHaveBeenCalled();
        });

        it('is a no-op (no throw) when RevalidationService is not initialized', async () => {
            const actor: Actor = createActor({
                id: VALID_UUID,
                permissions: [PermissionEnum.SETTINGS_GENERAL_WRITE]
            });
            asMock(modelMock.upsertByKey).mockResolvedValue(seoRow);
            getRevalidationServiceMock.mockReturnValue(undefined);

            const result = await service.upsert({
                actor,
                key: 'seo.defaults',
                value: seoRow.value
            });

            // Upsert still succeeds — revalidation failure is non-blocking.
            expectSuccess(result);
            expect(revalidateByEntityType).not.toHaveBeenCalled();
        });

        it('does NOT roll back the upsert when revalidateByEntityType throws (best-effort)', async () => {
            const actor: Actor = createActor({
                id: VALID_UUID,
                permissions: [PermissionEnum.SETTINGS_GENERAL_WRITE]
            });
            asMock(modelMock.upsertByKey).mockResolvedValue(seoRow);
            revalidateByEntityType.mockImplementationOnce(() => {
                throw new Error('revalidation adapter exploded');
            });

            const result = await service.upsert({
                actor,
                key: 'seo.defaults',
                value: seoRow.value
            });

            expectSuccess(result);
            expect(result.data).toEqual(seoRow);
        });
    });
});
