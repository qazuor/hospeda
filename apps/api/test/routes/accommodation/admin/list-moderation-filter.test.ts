/**
 * Tests for moderationState filter in admin review list schemas — SPEC-166 T-021.
 *
 * Verifies:
 *  - AccommodationReviewAdminSearchSchema accepts `moderationState` as a valid filter.
 *  - DestinationReviewAdminSearchSchema accepts `moderationState` as a valid filter.
 *  - Valid moderation state values (PENDING, APPROVED, REJECTED) pass Zod validation.
 *  - Invalid values are rejected.
 *
 * The admin list route invokes `adminList()` on the service, which delegates to
 * `_executeAdminSearch` — which does NOT force-override `moderationState` (that
 * force-override only happens in `_executeSearch` for public paths, SPEC-166 T-022).
 * So passing `moderationState=PENDING` to the admin list endpoint is a supported,
 * valid use case for building the admin moderation queue.
 *
 * @module test/routes/accommodation/admin/list-moderation-filter
 * @see SPEC-166 T-021
 */

import {
    AccommodationReviewAdminSearchSchema,
    DestinationReviewAdminSearchSchema,
    ModerationStatusEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';

describe('AccommodationReviewAdminSearchSchema — moderationState filter (SPEC-166 T-021)', () => {
    it('accepts moderationState=PENDING', () => {
        const result = AccommodationReviewAdminSearchSchema.safeParse({
            moderationState: ModerationStatusEnum.PENDING
        });
        expect(result.success).toBe(true);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    it('accepts moderationState=APPROVED', () => {
        const result = AccommodationReviewAdminSearchSchema.safeParse({
            moderationState: ModerationStatusEnum.APPROVED
        });
        expect(result.success).toBe(true);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.APPROVED);
    });

    it('accepts moderationState=REJECTED', () => {
        const result = AccommodationReviewAdminSearchSchema.safeParse({
            moderationState: ModerationStatusEnum.REJECTED
        });
        expect(result.success).toBe(true);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.REJECTED);
    });

    it('moderationState is optional — schema parses without it', () => {
        const result = AccommodationReviewAdminSearchSchema.safeParse({});
        expect(result.success).toBe(true);
        expect(result.data?.moderationState).toBeUndefined();
    });

    it('rejects an unknown moderationState string', () => {
        const result = AccommodationReviewAdminSearchSchema.safeParse({
            moderationState: 'UNKNOWN_STATE'
        });
        expect(result.success).toBe(false);
    });

    it('parses correctly alongside other admin search filters', () => {
        const result = AccommodationReviewAdminSearchSchema.safeParse({
            moderationState: ModerationStatusEnum.PENDING,
            page: 1,
            pageSize: 20,
            accommodationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        });
        expect(result.success).toBe(true);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.PENDING);
        expect(result.data?.page).toBe(1);
    });
});

describe('DestinationReviewAdminSearchSchema — moderationState filter (SPEC-166 T-021)', () => {
    it('accepts moderationState=PENDING', () => {
        const result = DestinationReviewAdminSearchSchema.safeParse({
            moderationState: ModerationStatusEnum.PENDING
        });
        expect(result.success).toBe(true);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    it('accepts moderationState=APPROVED', () => {
        const result = DestinationReviewAdminSearchSchema.safeParse({
            moderationState: ModerationStatusEnum.APPROVED
        });
        expect(result.success).toBe(true);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.APPROVED);
    });

    it('accepts moderationState=REJECTED', () => {
        const result = DestinationReviewAdminSearchSchema.safeParse({
            moderationState: ModerationStatusEnum.REJECTED
        });
        expect(result.success).toBe(true);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.REJECTED);
    });

    it('moderationState is optional — schema parses without it', () => {
        const result = DestinationReviewAdminSearchSchema.safeParse({});
        expect(result.success).toBe(true);
        expect(result.data?.moderationState).toBeUndefined();
    });

    it('rejects an unknown moderationState string', () => {
        const result = DestinationReviewAdminSearchSchema.safeParse({
            moderationState: 'INVALID'
        });
        expect(result.success).toBe(false);
    });

    it('parses correctly alongside other admin search filters', () => {
        const result = DestinationReviewAdminSearchSchema.safeParse({
            moderationState: ModerationStatusEnum.PENDING,
            page: 2,
            pageSize: 10,
            destinationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
        });
        expect(result.success).toBe(true);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.PENDING);
        expect(result.data?.page).toBe(2);
    });
});
