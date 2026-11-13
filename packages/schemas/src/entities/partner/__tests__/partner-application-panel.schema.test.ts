import { describe, expect, it } from 'vitest';
import {
    AdminPartnerApplicationPanelItemSchema,
    AdminPartnerApplicationPanelQuerySchema
} from '../partner-application-panel.schema';

const validItem = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'partner@example.test',
    status: 'APPROVED',
    createdAt: '2026-01-01T00:00:00.000Z',
    resolvedAt: '2026-01-02T00:00:00.000Z',
    overdue: false,
    waitEndsAt: null
} as const;

describe('admin Partner application panel schemas', () => {
    it('defaults an empty query', () => {
        expect(AdminPartnerApplicationPanelQuerySchema.parse({})).toEqual({
            page: 1,
            pageSize: 50,
            view: 'pending'
        });
    });

    it('rejects page sizes over 100', () => {
        expect(AdminPartnerApplicationPanelQuerySchema.safeParse({ pageSize: '101' }).success).toBe(
            false
        );
    });

    it('rejects unsupported views', () => {
        expect(
            AdminPartnerApplicationPanelQuerySchema.safeParse({ view: 'approved' }).success
        ).toBe(false);
    });

    it('accepts null and populated partners', () => {
        expect(
            AdminPartnerApplicationPanelItemSchema.safeParse({ ...validItem, partner: null })
                .success
        ).toBe(true);
        expect(
            AdminPartnerApplicationPanelItemSchema.safeParse({
                ...validItem,
                partner: {
                    id: '00000000-0000-4000-8000-000000000002',
                    name: 'Partner',
                    slug: 'partner'
                }
            }).success
        ).toBe(true);
    });
});
