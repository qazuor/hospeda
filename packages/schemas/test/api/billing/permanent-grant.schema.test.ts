import { describe, expect, it } from 'vitest';
import {
    PermanentGrantAnchorResponseSchema,
    PermanentGrantCreateRequestSchema,
    PermanentGrantCreateResponseSchema
} from '../../../src/api/billing/permanent-grant.schema.js';

const BENEFICIARY = '7a1f4c2e-3b5d-4e6f-8a9b-0c1d2e3f4a5b';
const PLAN = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';
const FLOOR = '9e8d7c6b-5a49-4382-9716-05f4e3d2c1b0';
const GRANT = '2a3b4c5d-6e7f-4890-a1b2-c3d4e5f60718';

const request = {
    beneficiaryUserId: BENEFICIARY,
    reason: 'Complimentary grant',
    includesAddons: false,
    anchors: [{ vertical: 'accommodation', planId: PLAN, floorPlanVersionId: FLOOR }]
};

const outcome = {
    subscriptionId: BENEFICIARY,
    cancelCall: 'SENT' as const
};

const createResponse = {
    permanentGrantId: GRANT,
    anchorIds: [PLAN],
    cancelledSubscriptionIds: [BENEFICIARY],
    releasedRetentionIds: [],
    closedCourtesyIds: [],
    providerCalls: [outcome],
    anchoredAddonInstanceIds: [],
    addonProviderCalls: []
};

describe('TEST:B9a:9 permanent grant contract', () => {
    it('accepts the valid strict grant body', () => {
        expect(PermanentGrantCreateRequestSchema.safeParse(request).success).toBe(true);
    });

    it('rejects empty anchors and repeated verticals', () => {
        expect(
            PermanentGrantCreateRequestSchema.safeParse({ ...request, anchors: [] }).success
        ).toBe(false);
        expect(
            PermanentGrantCreateRequestSchema.safeParse({
                ...request,
                anchors: [...request.anchors, ...request.anchors]
            }).success
        ).toBe(false);
    });

    it('rejects signer fields, blank reasons and malformed UUIDs', () => {
        expect(
            PermanentGrantCreateRequestSchema.safeParse({ ...request, grantedBy: PLAN }).success
        ).toBe(false);
        expect(
            PermanentGrantCreateRequestSchema.safeParse({ ...request, reason: '  ' }).success
        ).toBe(false);
        expect(
            PermanentGrantCreateRequestSchema.safeParse({ ...request, beneficiaryUserId: 'bad' })
                .success
        ).toBe(false);
    });

    it.each([
        ['SENT', undefined],
        ['NOT_NEEDED', undefined],
        ['NOTICE_PENDING', undefined],
        ['FAILED', undefined],
        ['NOT_APPLICABLE', undefined],
        ['SENT', 'NO_RECIPIENT'],
        ['FAILED', 'DELIVERY_EXHAUSTED']
    ] as const)('accepts provider outcome %s with escalation %s', (cancelCall, escalated) => {
        const call = {
            subscriptionId: BENEFICIARY,
            cancelCall,
            ...(escalated ? { escalated } : {})
        };
        expect(
            PermanentGrantCreateResponseSchema.safeParse({
                ...createResponse,
                providerCalls: [call],
                addonProviderCalls: [call]
            }).success
        ).toBe(true);
        expect(
            PermanentGrantAnchorResponseSchema.safeParse({
                ...createResponse,
                anchorId: PLAN,
                providerCalls: [call],
                addonProviderCalls: [call]
            }).success
        ).toBe(true);
    });

    it('accepts empty result lists', () => {
        expect(
            PermanentGrantCreateResponseSchema.safeParse({
                ...createResponse,
                anchorIds: [],
                cancelledSubscriptionIds: [],
                releasedRetentionIds: [],
                closedCourtesyIds: [],
                providerCalls: [],
                anchoredAddonInstanceIds: [],
                addonProviderCalls: []
            }).success
        ).toBe(true);
    });
});
