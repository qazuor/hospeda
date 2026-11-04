/** GET /api/v1/protected/experiences/:id/sections */
import {
    ExperienceListingSectionStatesSchema,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { resolveListingSections } from '@repo/verticals';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getListingAccessPorts } from '../../../utils/listing-access/ports';
import { createProtectedRoute } from '../../../utils/route-factory';

export const protectedGetExperienceSectionStatesRoute = createProtectedRoute({
    method: 'get',
    emailUnverifiedOperation: 'READ_OWN',
    path: '/{id}/sections',
    listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'READ_OWN', idParam: 'id' },
    summary: 'Read experience listing section states',
    description:
        'Returns section and trait availability for the listing owner, plus whether its business lines make it multi-line.',
    tags: ['Experiences'],
    requestParams: { id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }) },
    responseSchema: ExperienceListingSectionStatesSchema,
    handler: async (ctx: Context) => {
        const listingAccess = ctx.get('listingAccess');
        if (!listingAccess?.subjectId)
            throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
        const { subjectId, businessLines } = listingAccess;
        const ports = getListingAccessPorts();
        let effective: Awaited<ReturnType<typeof ports.effectiveSet>>;
        try {
            effective = await ports.effectiveSet({
                userId: subjectId,
                vertical: VerticalEnum.EXPERIENCE
            });
        } catch {
            throw new HTTPException(503, { message: 'Unable to read listing entitlements' });
        }
        const resolved = resolveListingSections({
            vertical: 'experience',
            businessLines,
            effective,
            userId: subjectId
        });
        return {
            sections: Object.fromEntries(
                [...resolved.sections].map(([id, section]) => [
                    id,
                    { state: section.state, traits: Object.fromEntries(section.traits) }
                ])
            ),
            multiLine: resolved.multiLine
        };
    }
});
