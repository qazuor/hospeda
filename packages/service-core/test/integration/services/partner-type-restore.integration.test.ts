/**
 * HOS-2366 — restoring a partner type keeps its lifecycle state, against a
 * REAL database.
 *
 * Replays the staging smoke that failed AC-3.5 of HOS-2336: deactivate a type,
 * soft-delete it, restore it. Before the fix, `BaseModelImpl.restore()` forced
 * `lifecycleState = ACTIVE` (SPEC-063-gaps T-001), so a type the admin had
 * deactivated came back assignable. Only Postgres proves what the UPDATE
 * actually wrote, which is why this lives in the real-DB suite.
 *
 * @module partner-type-restore.integration.test
 */
import { eq, partnerTypes, users } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { PartnerTypeService } from '../../../src/services/partner-type/partner-type.service';
import type { Actor, ServiceContext } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import { isServiceTestDbAvailable, withServiceTestTransaction } from './helpers';

const dbAvailable = isServiceTestDbAvailable();
const RUN = crypto.randomUUID().slice(0, 8);

const actor: Actor = {
    id: crypto.randomUUID(),
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: [
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.PARTNER_TYPE_VIEW,
        PermissionEnum.PARTNER_TYPE_UPDATE,
        PermissionEnum.PARTNER_TYPE_DELETE,
        PermissionEnum.PARTNER_TYPE_RESTORE
    ]
};

describe.skipIf(!dbAvailable)('PartnerTypeService.restore — real DB (HOS-2366)', () => {
    it('a type deactivated by the admin comes back INACTIVE, with its slug, after delete + restore (AC-3.5)', async () => {
        await withServiceTestTransaction(async (tx) => {
            // Arrange: the acting admin (FK target of updated_by/deleted_by) and an
            // unused ACTIVE type.
            await tx.insert(users).values({
                id: actor.id,
                email: `pt-restore-${RUN}@example.com`,
                displayName: 'Partner Type Restore Admin',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            } as typeof users.$inferInsert);
            const id = crypto.randomUUID();
            const slug = `pt-${RUN}-keep`;
            await tx.insert(partnerTypes).values({
                id,
                slug,
                nameI18n: { es: slug, en: slug, pt: slug },
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });
            const service = new PartnerTypeService({ logger: createLoggerMock() });
            const ctx = { tx, hookState: {} } as ServiceContext;

            // Act: the three steps of the staging smoke.
            const deactivated = await service.update(
                actor,
                id,
                { lifecycleState: LifecycleStatusEnum.INACTIVE },
                ctx
            );
            const deleted = await service.softDelete(actor, id, ctx);
            const [afterDelete] = await tx
                .select()
                .from(partnerTypes)
                .where(eq(partnerTypes.id, id));
            const restored = await service.restore(actor, id, ctx);

            // Assert: delete does not touch the state, restore keeps it.
            expect(deactivated.error).toBeUndefined();
            expect(deleted.error).toBeUndefined();
            expect(afterDelete?.deletedAt).not.toBeNull();
            expect(afterDelete?.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
            expect(restored.error).toBeUndefined();
            expect(restored.data).toEqual({ count: 1 });
            const [row] = await tx.select().from(partnerTypes).where(eq(partnerTypes.id, id));
            expect(row?.deletedAt).toBeNull();
            expect(row?.slug).toBe(slug);
            expect(row?.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
        });
    });
});
