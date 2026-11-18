import { describe, expect, it } from 'vitest';
import type { UmamiClientConfig } from '../umami/client.js';
import { UmamiDefinitionError } from '../umami/definitions.js';
import {
    buildCohortDefinition,
    buildSegmentDefinitions,
    HOSPEDA_COHORTS,
    HOSPEDA_SEGMENTS,
    type SegmentDefinition,
    segmentParametersSchema
} from '../umami/segment-definitions.js';
import { listSegments, upsertSegment } from '../umami/segments-client.js';

const WEBSITE = 'w1';
const SEGMENTS_PATH = `/api/websites/${WEBSITE}/segments`;

interface Call {
    readonly method: string;
    readonly url: string;
    readonly body: unknown;
}

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

function setup(input: {
    pages?: readonly (readonly unknown[])[];
    count?: number;
    dryRun?: boolean;
}): { config: UmamiClientConfig; calls: Call[] } {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
        const call: Call = {
            method: init?.method ?? 'GET',
            url: String(url),
            body: init?.body ? JSON.parse(String(init.body)) : undefined
        };
        calls.push(call);
        const parsed = new URL(call.url);
        if (call.method === 'GET') {
            const page = Number(parsed.searchParams.get('page') ?? '1');
            const data = input.pages?.[page - 1] ?? [];
            const count = input.count ?? input.pages?.flat().length ?? 0;
            return json(200, { data, count, page, pageSize: 100 });
        }
        const id = parsed.pathname.split('/').pop() ?? 'new';
        return json(200, {
            id: id === 'segments' ? 'new' : id,
            websiteId: WEBSITE,
            ...(call.body as object)
        });
    }) as typeof fetch;
    return {
        config: {
            baseUrl: 'http://umami.test',
            token: 'tok',
            fetchImpl,
            ...(input.dryRun === undefined ? {} : { dryRun: input.dryRun })
        },
        calls
    };
}

const writes = (calls: readonly Call[]) => calls.filter((c) => c.method !== 'GET');

const definition: SegmentDefinition = {
    type: 'segment',
    name: 'Brasil y Uruguay',
    parameters: {
        filters: [
            { name: 'country', operator: 'eq', value: 'BR' },
            { name: 'country', operator: 'eq', value: 'UY' }
        ],
        match: 'any'
    }
};
const stored = {
    id: 's1',
    websiteId: WEBSITE,
    type: 'segment',
    name: 'Brasil y Uruguay',
    // Key order differs and parameters come as a JSON string on purpose.
    parameters: JSON.stringify({
        match: 'any',
        filters: [
            { value: 'BR', operator: 'eq', name: 'country' },
            { value: 'UY', operator: 'eq', name: 'country' }
        ]
    })
};

describe('segment definitions', () => {
    it('should define the 11 segments and 8 cohorts with exact Spanish names', () => {
        expect(HOSPEDA_SEGMENTS.map((s) => s.name)).toEqual([
            'Celular y tablet',
            'Escritorio y notebook',
            'Visitantes de Argentina',
            'Visitantes del exterior',
            'Brasil y Uruguay',
            'Llegan desde Google',
            'Llegan desde redes sociales',
            'Llegan por campaña (UTM)',
            'Usuarios logueados',
            'Navegan fichas de alojamiento',
            'Navegan Comer y salir y Experiencias'
        ]);
        expect(HOSPEDA_COHORTS.map((c) => c.name)).toEqual([
            'Vieron un alojamiento (7 días)',
            'Contactaron a un dueño (30 días)',
            'Se registraron (30 días)',
            'Publicaron un alojamiento (30 días)',
            'Usaron el chat con IA (30 días)',
            'Empezaron un checkout (30 días)',
            'Activaron una suscripción (90 días)',
            'Empezaron un trial (90 días)'
        ]);
    });

    it('should build every definition valid against the payload schema with unique keys', () => {
        const all = buildSegmentDefinitions();

        for (const d of all)
            expect(segmentParametersSchema.safeParse(d.parameters).success).toBe(true);
        expect(new Set(all.map((d) => `${d.type}:${d.name}`)).size).toBe(all.length);
        expect(buildSegmentDefinitions()).toEqual(all);
    });

    it('should build a cohort as an event action plus a date range', () => {
        expect(
            buildCohortDefinition({
                name: 'x',
                event: 'sign_up_completed',
                dateRange: '30day'
            })
        ).toEqual({
            type: 'cohort',
            name: 'x',
            parameters: {
                action: { type: 'event', value: 'sign_up_completed' },
                dateRange: '30day'
            }
        });
    });

    it('should throw UNKNOWN_EVENT for a cohort on a non-catalog event', () => {
        expect(() =>
            buildCohortDefinition({ name: 'x', event: 'not_an_event', dateRange: '7day' })
        ).toThrow(UmamiDefinitionError);
        expect(() =>
            buildCohortDefinition({ name: 'x', event: 'not_an_event', dateRange: '7day' })
        ).toThrowError(expect.objectContaining({ code: 'UNKNOWN_EVENT' }));
    });

    it('should reject a payload with an unknown operator', () => {
        const result = segmentParametersSchema.safeParse({
            filters: [{ name: 'country', operator: 'like', value: 'AR' }]
        });
        expect(result.success).toBe(false);
    });

    it.each([
        's',
        'ns',
        're',
        'gt'
    ])('should reject the %s operator on a segment column filter', (operator) => {
        const result = segmentParametersSchema.safeParse({
            filters: [{ name: 'distinctId', operator, value: '' }]
        });
        expect(result.success).toBe(false);
    });

    it('should use the column-safe neq operator for the UTM and logged-in segments', () => {
        const byName = (name: string) => HOSPEDA_SEGMENTS.find((s) => s.name === name);

        expect(byName('Llegan por campaña (UTM)')?.parameters.filters).toEqual([
            { name: 'utmSource', operator: 'neq', value: '' }
        ]);
        expect(byName('Usuarios logueados')?.parameters.filters).toEqual([
            { name: 'distinctId', operator: 'neq', value: '' }
        ]);
        expect(byName('Visitantes anónimos')).toBeUndefined();
    });
});

describe('listSegments', () => {
    it('should send the type and follow every page', async () => {
        const first = Array.from({ length: 100 }, (_, i) => ({ ...stored, id: `a${i}` }));
        const { config, calls } = setup({
            pages: [first, [{ ...stored, id: 'last' }]],
            count: 101
        });

        const result = await listSegments({ config, websiteId: WEBSITE, type: 'cohort' });

        expect(result).toHaveLength(101);
        expect(calls).toHaveLength(2);
        expect(new URL(calls[0]?.url ?? '').pathname).toBe(SEGMENTS_PATH);
        expect(new URL(calls[0]?.url ?? '').searchParams.get('type')).toBe('cohort');
    });
});

describe('listSegments pagination', () => {
    it('should return every item when the server clamps the page size below the requested one', async () => {
        const all = Array.from({ length: 45 }, (_, i) => ({ ...stored, id: `s${i}` }));
        const requested: number[] = [];
        const fetchImpl = (async (url: string | URL) => {
            const parsed = new URL(String(url));
            const page = Number(parsed.searchParams.get('page') ?? '1');
            requested.push(page);
            const data = all.slice((page - 1) * 20, page * 20);
            return json(200, { data, count: all.length, page, pageSize: 20 });
        }) as typeof fetch;
        const config: UmamiClientConfig = { baseUrl: 'http://umami.test', token: 'tok', fetchImpl };

        const result = await listSegments({ config, websiteId: WEBSITE, type: 'segment' });

        expect(result.map((s) => s.id)).toEqual(all.map((s) => s.id));
        expect(requested).toEqual([1, 2, 3]);
    });
});

describe('upsertSegment', () => {
    it('should create when absent', async () => {
        const { config, calls } = setup({ pages: [[]] });

        const result = await upsertSegment({ config, websiteId: WEBSITE, definition });

        expect(result.action).toBe('created');
        expect(writes(calls)).toHaveLength(1);
        expect(new URL(writes(calls)[0]?.url ?? '').pathname).toBe(SEGMENTS_PATH);
        expect(writes(calls)[0]?.body).toEqual({
            type: 'segment',
            name: 'Brasil y Uruguay',
            parameters: definition.parameters
        });
    });

    it('should be a no-op when equal regardless of key order and string encoding', async () => {
        const { config, calls } = setup({ pages: [[stored]] });

        const result = await upsertSegment({ config, websiteId: WEBSITE, definition });

        expect(result.action).toBe('unchanged');
        expect(writes(calls)).toHaveLength(0);
    });

    it('should be unchanged when the server adds defaults the definition omits', async () => {
        const cohort: SegmentDefinition = {
            type: 'cohort',
            name: 'Se registraron (30 días)',
            parameters: {
                action: { type: 'event', value: 'sign_up_completed' },
                dateRange: '30day'
            }
        };
        const withDefaults = {
            id: 'c1',
            type: 'cohort',
            name: cohort.name,
            parameters: { ...cohort.parameters, match: 'all', filters: [] }
        };
        const { config, calls } = setup({ pages: [[withDefaults]] });

        const result = await upsertSegment({ config, websiteId: WEBSITE, definition: cohort });

        expect(result.action).toBe('unchanged');
        expect(writes(calls)).toHaveLength(0);
    });

    it('should update when a declared key differs even if extra keys are stored', async () => {
        const { config, calls } = setup({
            pages: [
                [
                    {
                        ...stored,
                        parameters: { match: 'all', filters: definition.parameters.filters }
                    }
                ]
            ]
        });

        const result = await upsertSegment({ config, websiteId: WEBSITE, definition });

        expect(result.action).toBe('updated');
        expect(writes(calls)).toHaveLength(1);
    });

    it('should set match explicitly on every segment', () => {
        for (const s of HOSPEDA_SEGMENTS) expect(s.parameters.match).toBeDefined();
    });

    it('should update in place when parameters differ', async () => {
        const { config, calls } = setup({
            pages: [[{ ...stored, parameters: { match: 'all' } }]]
        });

        const result = await upsertSegment({ config, websiteId: WEBSITE, definition });

        expect(result.action).toBe('updated');
        expect(new URL(writes(calls)[0]?.url ?? '').pathname).toBe(`${SEGMENTS_PATH}/s1`);
    });

    it('should not match a same-named item of the other type', async () => {
        const { config } = setup({ pages: [[{ ...stored, type: 'cohort' }]] });

        const result = await upsertSegment({ config, websiteId: WEBSITE, definition });

        expect(result.action).toBe('created');
    });

    it('should refuse to guess when the name is ambiguous and write nothing', async () => {
        const { config, calls } = setup({ pages: [[stored, { ...stored, id: 's2' }]] });

        await expect(
            upsertSegment({ config, websiteId: WEBSITE, definition })
        ).rejects.toMatchObject({
            kind: 'ambiguous'
        });
        expect(writes(calls)).toHaveLength(0);
    });

    it.each([
        ['absent', [[]] as unknown[][], 'created'],
        ['different', [[{ ...stored, parameters: { match: 'all' } }]], 'updated'],
        ['equal', [[stored]], 'unchanged']
    ])('should perform no write in dry-run when %s', async (_label, pages, action) => {
        const { config, calls } = setup({ pages, dryRun: true });

        const result = await upsertSegment({ config, websiteId: WEBSITE, definition });

        expect(result).toMatchObject({ action, dryRun: true });
        expect(calls.every((c) => c.method === 'GET')).toBe(true);
    });
});
