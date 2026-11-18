/**
 * Tests for the `categorySlugs` contract of POST /api/v1/public/alliance/leads
 * (HOS-919 T-032, AC-1.5 / AC-1.6 / AC-1.7).
 *
 * The form is anonymous, so the server is the only gate: an empty or missing
 * list, more than 10 slugs, duplicates and a stale/unknown slug must all answer
 * 400 VALIDATION_ERROR naming `categorySlugs`, WITHOUT a lead being created.
 * A valid submission reaches the service with the slugs untouched.
 *
 * @module test/routes/alliance/public/create-lead-categories
 */

import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const { mockCreateLead } = vi.hoisted(() => ({ mockCreateLead: vi.fn() }));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AllianceLeadService: vi.fn().mockImplementation(function () {
            return { createLead: mockCreateLead };
        })
    };
});

vi.mock('../../../../src/lib/alliance-ports', () => ({
    createAllianceClaimInvitePort: vi.fn().mockReturnValue(null)
}));
vi.mock('../../../../src/lib/lead-intake-ports', () => ({
    createAllianceLeadIntakeNotifyPort: vi.fn().mockReturnValue(null)
}));
vi.mock('../../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { publicCreateAllianceLeadRoute } = await import(
    '../../../../src/routes/alliance/public/create-lead.js'
);

const LEAD_ID = '66666666-6666-4666-8666-666666666666';
const DESTINATION_ID = '33333333-3333-4333-8333-333333333333';

const PROVIDER_LEAD = {
    kind: 'service_provider',
    contactName: 'Ana Plomera',
    email: 'ana@example.com',
    message: 'Quiero sumarme al directorio de proveedores.',
    businessName: 'Plomería Ana',
    destinationId: DESTINATION_ID,
    benefitType: 'PERCENTAGE',
    benefitValue: 10,
    categorySlugs: ['plomeria', 'pintura', 'gas']
};

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', {
            id: '00000000-0000-4000-8000-000000000000',
            roles: [RoleEnum.GUEST],
            permissions: []
        });
        return next();
    });
    app.route('/', publicCreateAllianceLeadRoute);
    return app;
}

function submit(body: unknown) {
    return buildApp().request('/', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
        body: JSON.stringify(body)
    });
}

beforeEach(() => {
    mockCreateLead.mockReset();
    mockCreateLead.mockResolvedValue({ data: { id: LEAD_ID }, error: undefined });
});

describe('POST /public/alliance/leads - categorySlugs (HOS-919)', () => {
    it('forwards a valid 3-slug submission to the service untouched and answers with the lead id', async () => {
        const res = await submit(PROVIDER_LEAD);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toEqual({ id: LEAD_ID });
        expect(mockCreateLead).toHaveBeenCalledTimes(1);
        expect(mockCreateLead.mock.calls[0]?.[0].input.categorySlugs).toEqual([
            'plomeria',
            'pintura',
            'gas'
        ]);
    });

    it.each([
        [
            'more than 10 slugs',
            { ...PROVIDER_LEAD, categorySlugs: Array.from({ length: 11 }, (_, i) => `cat-${i}`) }
        ],
        ['duplicated slugs', { ...PROVIDER_LEAD, categorySlugs: ['plomeria', 'plomeria'] }],
        ['a malformed slug', { ...PROVIDER_LEAD, categorySlugs: ['Not A Slug'] }]
    ])('answers 400 VALIDATION_ERROR naming categorySlugs for %s, creating nothing', async (_name, payload) => {
        const res = await submit(payload);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(JSON.stringify(body)).toContain('categorySlugs');
        expect(mockCreateLead).not.toHaveBeenCalled();
    });

    /**
     * The "required for service_provider" rule and the active-catalog check live
     * in `AllianceLeadService.createLead` (covered in service-core:
     * `alliance-lead.service.categories.test.ts`: [] / missing / 11 / stale slug).
     * The route's job is to map that refusal to 400 VALIDATION_ERROR and never
     * to answer 200 / 5xx.
     */
    it.each([
        ['an empty list', []],
        ['a stale or unknown slug', ['plomeria', 'stale-slug']]
    ])('maps the service refusal for %s to 400 VALIDATION_ERROR', async (_name, categorySlugs) => {
        mockCreateLead.mockResolvedValue({
            data: undefined,
            error: {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: 'categorySlugs contains a category that does not exist or is not available'
            }
        });

        const res = await submit({ ...PROVIDER_LEAD, categorySlugs });
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('does not require categorySlugs for the other kinds', async () => {
        const res = await submit({
            kind: 'sponsor',
            contactName: 'Juan Pérez',
            email: 'juan@example.com',
            message: 'Quiero patrocinar contenido de la plataforma.'
        });
        expect(res.status).toBe(200);
        expect(mockCreateLead).toHaveBeenCalledTimes(1);
    });
});
