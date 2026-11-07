/** GET /api/v1/protected/venues/:id/sections */
import {
    BUSINESS_LINES_INVALID_REASON,
    ListingSectionStatesBusinessLinesQuerySchema,
    ServiceErrorCode,
    VenueListingSectionStatesSchema,
    VerticalEnum,
    validateBusinessLines
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

export const protectedGetVenueSectionStatesRoute = createProtectedRoute({
    method: 'get',
    emailUnverifiedOperation: 'READ_OWN',
    path: '/{id}/sections',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'READ_OWN', idParam: 'id' },
    summary: 'Read venue listing section states',
    description:
        'Returns section and trait availability for the listing owner, plus whether its business lines make it multi-line.',
    tags: ['Venue'],
    requestParams: { id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }) },
    requestQuery: {
        businessLines: ListingSectionStatesBusinessLinesQuerySchema
    },
    responseSchema: VenueListingSectionStatesSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query: Record<string, unknown> = {}
    ) => {
        const listingAccess = ctx.get('listingAccess');
        if (!listingAccess?.subjectId)
            throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
        const { subjectId } = listingAccess;
        const ports = getListingAccessPorts();
        // HOS-1787 leaf 5.7: an optional hypothetical selection lets the owner
        // editor ask which sections a removal would hide BEFORE saving it. Only
        // the resolver may map business lines to sections (G-FAC-03), and the
        // selection is validated with the single validator (G-FAC-09) against
        // the listing's stored type, so an invalid query answers 400 instead of
        // producing a map nothing could have persisted.
        const hypothetical = parseHypotheticalBusinessLines(query.businessLines);
        let businessLines = listingAccess.businessLines;
        if (hypothetical) {
            const facts = await ports.loadFacts({
                vertical: VerticalEnum.VENUE,
                listingId: String(params.id)
            });
            const validation = validateBusinessLines({
                vertical: 'venue',
                type: facts.facts?.type ?? '',
                businessLines: hypothetical
            });
            if (!validation.ok) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Invalid business lines',
                    { field: 'businessLines', reason: validation.reason },
                    BUSINESS_LINES_INVALID_REASON
                );
            }
            businessLines = hypothetical;
        }
        let effective: Awaited<ReturnType<typeof ports.effectiveSet>>;
        try {
            effective = await ports.effectiveSet({
                userId: subjectId,
                vertical: VerticalEnum.VENUE
            });
        } catch {
            throw new ServiceError(
                ServiceErrorCode.SERVICE_UNAVAILABLE,
                'Unable to read listing entitlements'
            );
        }
        const resolved = resolveListingSections({
            vertical: 'venue',
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

/**
 * Splits the optional comma-separated `businessLines` query into catalog
 * values, or returns `null` when the caller did not ask for a hypothetical map.
 *
 * @param value - Raw query value, already validated as a string by Zod.
 * @returns The deduplicated selection, or `null` when the parameter is absent.
 */
function parseHypotheticalBusinessLines(value: unknown): string[] | null {
    if (typeof value !== 'string') return null;
    return [
        ...new Set(
            value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
        )
    ];
}
