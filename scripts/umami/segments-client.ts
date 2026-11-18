import { z } from 'zod';
import {
    listAll,
    pickUnique,
    sameJson,
    type UmamiClientConfig,
    type UpsertResult,
    umamiRequest
} from './client.js';
import type { SegmentDefinition, SegmentType } from './segment-definitions.js';

/**
 * Segment and cohort endpoints of the Umami 3.5 client (HOS-2119). Same upsert
 * semantics as reports and boards: natural key, created/updated/unchanged,
 * `ambiguous` on several matches, reads only in dry-run.
 */

/** `parameters` come back as an object, or as a JSON string on some builds. */
const storedParametersSchema = z.preprocess(
    (value) => {
        if (typeof value !== 'string') return value;
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    },
    z.record(z.string(), z.unknown())
);

/** Zod schema of a segment or cohort as returned by the API. */
export const segmentSchema = z.object({
    id: z.string(),
    websiteId: z.string().optional(),
    type: z.string(),
    name: z.string(),
    parameters: storedParametersSchema
});

/** A segment or cohort as returned by the API. */
export type UmamiSegment = z.infer<typeof segmentSchema>;

/**
 * True when every key the definition declares deep-equals the stored value.
 * Extra stored keys (defaults the server adds, such as `match` or `filters: []`)
 * are ignored, so they never cause a false "updated".
 */
function declaredKeysMatch(input: {
    readonly stored: Readonly<Record<string, unknown>>;
    readonly declared: Readonly<Record<string, unknown>>;
}): boolean {
    return Object.entries(input.declared)
        .filter(([, value]) => value !== undefined)
        .every(([key, value]) => sameJson(input.stored[key], value));
}

/**
 * Lists every segment or cohort of a website (all pages).
 *
 * @param input.config - Client configuration
 * @param input.websiteId - Website id
 * @param input.type - `segment` or `cohort`
 */
export function listSegments(input: {
    readonly config: UmamiClientConfig;
    readonly websiteId: string;
    readonly type: SegmentType;
}): Promise<readonly UmamiSegment[]> {
    return listAll({
        config: input.config,
        path: `/api/websites/${input.websiteId}/segments`,
        query: { type: input.type },
        schema: segmentSchema
    });
}

/**
 * Creates the segment/cohort when absent, updates it when its parameters
 * differ, does nothing when equal. Natural key: `websiteId` + `type` + `name`.
 * In dry-run it only reads.
 *
 * @param input.config - Client configuration (`dryRun` honoured)
 * @param input.websiteId - Website id
 * @param input.definition - Desired segment or cohort
 * @returns What happened (or would happen)
 * @throws {UmamiApiError} On API failure or when the name is ambiguous
 */
export async function upsertSegment(input: {
    readonly config: UmamiClientConfig;
    readonly websiteId: string;
    readonly definition: SegmentDefinition;
}): Promise<UpsertResult<UmamiSegment>> {
    const { config, websiteId, definition } = input;
    const dryRun = config.dryRun === true;
    const basePath = `/api/websites/${websiteId}/segments`;
    const existing = pickUnique({
        matches: (await listSegments({ config, websiteId, type: definition.type })).filter(
            (s) => s.name === definition.name && s.type === definition.type
        ),
        label: `${definition.type}s named "${definition.name}"`,
        endpoint: basePath
    });
    const body = {
        type: definition.type,
        name: definition.name,
        parameters: definition.parameters
    };

    if (!existing) {
        if (dryRun) return { action: 'created', dryRun, resource: null };
        const created = await umamiRequest({
            config,
            method: 'POST',
            path: basePath,
            body,
            schema: segmentSchema
        });
        return { action: 'created', dryRun, resource: created };
    }

    if (declaredKeysMatch({ stored: existing.parameters, declared: body.parameters })) {
        return { action: 'unchanged', dryRun, resource: existing };
    }
    if (dryRun) return { action: 'updated', dryRun, resource: existing };
    const updated = await umamiRequest({
        config,
        method: 'POST',
        path: `${basePath}/${existing.id}`,
        body,
        schema: segmentSchema
    });
    return { action: 'updated', dryRun, resource: updated };
}
