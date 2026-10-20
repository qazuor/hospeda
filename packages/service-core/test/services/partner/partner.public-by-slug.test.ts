import type { PartnerModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { PartnerService } from '../../../src/services/partner/partner.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const publicActor = createActor({ permissions: [PermissionEnum.ACCESS_API_PUBLIC] });
const mockLogger = createLoggerMock();

function buildService(modelOverrides: Record<string, unknown> = {}) {
    const model = { ...createModelMock(), ...modelOverrides };
    const service = new PartnerService({
        logger: mockLogger,
        model: model as unknown as PartnerModel
    });
    return { service, model };
}

describe('PartnerService.getPublicBySlug — V6 keeps partner pages dark', () => {
    it('returns notFound for an ACTIVE partner and never reads the row', async () => {
        const findOne = vi.fn(async () => ({ id: 'partner-id', lifecycleState: 'ACTIVE' }));
        const { service } = buildService({ findOne });
        const result = await service.getPublicBySlug(publicActor, { slug: 'acme-litoral' });
        expect(result.error).toBeUndefined();
        expect(result.data?.outcome).toBe('notFound');
        expect(findOne).not.toHaveBeenCalled();
    });

    it('returns notFound for every slug until V7 rewrites lookup over «página propia»', async () => {
        const { service } = buildService();
        const outcomes = await Promise.all(
            ['one', 'two', 'missing'].map((slug) => service.getPublicBySlug(publicActor, { slug }))
        );
        expect(outcomes.map((result) => result.data?.outcome)).toEqual([
            'notFound',
            'notFound',
            'notFound'
        ]);
    });

    it('retains the public API permission check', async () => {
        const { service } = buildService();
        const result = await service.getPublicBySlug(createActor({ permissions: [] }), {
            slug: 'acme'
        });
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });
});
