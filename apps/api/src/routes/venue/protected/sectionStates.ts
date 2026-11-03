/** GET /api/v1/protected/venues/:id/sections */
import { VenueListingSectionStatesSchema, VerticalEnum } from '@repo/schemas';
import { resolveListingSections } from '@repo/verticals';
import type { Context } from 'hono';
import { z } from 'zod';
import { getListingAccessPorts } from '../../../utils/listing-access/ports';
import { createProtectedRoute } from '../../../utils/route-factory';

export const protectedGetVenueSectionStatesRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/sections',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'READ_OWN', idParam: 'id' },
    summary: 'Read venue listing section states',
    description:
        'Returns section and trait availability for the listing owner, plus whether its business lines make it multi-line.',
    tags: ['Venue'],
    requestParams: { id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }) },
    responseSchema: VenueListingSectionStatesSchema,
    handler: async (ctx: Context) => {
        const { subjectId } = ctx.get('listingAccess');
        const ports = getListingAccessPorts();
        const { facts } = await ports.loadFacts({
            vertical: VerticalEnum.VENUE,
            listingId: ctx.req.param('id')
        });
        const effective = await ports.effectiveSet({
            userId: subjectId,
            vertical: VerticalEnum.VENUE
        });
        const resolved = resolveListingSections({
            vertical: 'venue',
            businessLines: facts?.businessLines ?? [],
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
