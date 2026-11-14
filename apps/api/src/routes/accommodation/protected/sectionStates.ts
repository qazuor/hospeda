/** GET /api/v1/protected/accommodations/:id/sections */
import {
    AccommodationListingSectionStatesSchema,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
// Same module instance `utils/response-helpers` compares against: importing
// `ServiceError` from the package ROOT yields a DIFFERENT class under the test
// resolver (the global stand-in only replaces the root specifier), and
// `instanceof` then fails — a SERVICE_UNAVAILABLE answered as a 500.
import { ServiceError } from '@repo/service-core/types';
import { resolveListingSections } from '@repo/verticals';
import type { Context } from 'hono';
import { z } from 'zod';
import { getListingAccessPorts } from '../../../utils/listing-access/ports';
import { createProtectedRoute } from '../../../utils/route-factory';

export const protectedGetAccommodationSectionStatesRoute = createProtectedRoute({
    method: 'get',
    emailUnverifiedOperation: 'READ_OWN',
    path: '/{id}/sections',
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'READ_OWN', idParam: 'id' },
    summary: 'Read accommodation listing section states',
    description:
        'Returns section and trait availability for the accommodation owner (HOS-1809). The map lets the editor show which sections and field traits (rich description, video, verification badge, external calendar sync) the owner plan unlocks.',
    tags: ['Accommodations'],
    requestParams: { id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }) },
    responseSchema: AccommodationListingSectionStatesSchema,
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
                vertical: VerticalEnum.ACCOMMODATION
            });
        } catch {
            throw new ServiceError(
                ServiceErrorCode.SERVICE_UNAVAILABLE,
                'Unable to read listing entitlements'
            );
        }
        const resolved = resolveListingSections({
            vertical: 'accommodation',
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
