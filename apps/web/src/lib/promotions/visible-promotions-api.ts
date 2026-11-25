/**
 * Browser reads of the per-actor promotion endpoints (HOS-2589 §7.5).
 *
 * Both reads send the session cookie (`credentials: 'include'`), because the answer
 * depends on who reads it, and parse the envelope with the shared schemas. They
 * never throw: any failure is `{ ok: false }`, and the island shows its error state.
 *
 * @module lib/promotions/visible-promotions-api
 */
import {
    type PromotionListingResponse,
    PromotionListingResponseSchema,
    type PromotionVisibleResponse,
    PromotionVisibleResponseSchema
} from '@repo/schemas';
import { z } from 'zod';

/** A read result. */
export type PromotionsReadResult<T> =
    | { readonly ok: true; readonly data: T }
    | { readonly ok: false };

const BASE_PATH = '/api/v1/public/owner-promotions';

/** One in-flight/settled read per URL, so two islands on a page share it. */
const inflight = new Map<string, Promise<PromotionsReadResult<unknown>>>();

async function readEnvelope<T>(input: {
    readonly url: string;
    readonly schema: z.ZodType<T>;
}): Promise<PromotionsReadResult<T>> {
    try {
        const response = await fetch(input.url, {
            credentials: 'include',
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) return { ok: false };
        const envelope = z
            .object({ success: z.literal(true), data: z.unknown() })
            .safeParse(await response.json());
        if (!envelope.success) return { ok: false };
        const parsed = input.schema.safeParse(envelope.data.data);
        return parsed.success ? { ok: true, data: parsed.data } : { ok: false };
    } catch {
        return { ok: false };
    }
}

function shared<T>(input: {
    readonly url: string;
    readonly schema: z.ZodType<T>;
}): Promise<PromotionsReadResult<T>> {
    const existing = inflight.get(input.url);
    if (existing) return existing as Promise<PromotionsReadResult<T>>;
    const pending = readEnvelope(input).then((result) => {
        if (!result.ok) inflight.delete(input.url);
        return result;
    });
    inflight.set(input.url, pending);
    return pending;
}

/**
 * Reads the promotions of one place for the current reader.
 *
 * @param input - API base URL, the place and the session seed.
 * @returns The visible/locked items and the reader meta.
 */
export function fetchVisiblePromotions(input: {
    readonly apiUrl: string;
    readonly entityType: 'accommodation' | 'venue';
    readonly entityId: string;
    readonly seed: string;
}): Promise<PromotionsReadResult<PromotionVisibleResponse>> {
    const params = new URLSearchParams({
        entityType: input.entityType,
        entityId: input.entityId,
        seed: input.seed
    });
    return shared({
        url: `${input.apiUrl.replace(/\/$/, '')}${BASE_PATH}/visible?${params.toString()}`,
        schema: PromotionVisibleResponseSchema
    });
}

/**
 * Reads one page of the promotions listing for the current reader.
 *
 * @param input - API base URL, page and the session seed.
 * @returns The page of visible/locked items, the reader meta and the pagination.
 */
export function fetchListingPromotions(input: {
    readonly apiUrl: string;
    readonly page: number;
    readonly pageSize: number;
    readonly seed: string;
}): Promise<PromotionsReadResult<PromotionListingResponse>> {
    const params = new URLSearchParams({
        page: String(input.page),
        pageSize: String(input.pageSize),
        seed: input.seed
    });
    return shared({
        url: `${input.apiUrl.replace(/\/$/, '')}${BASE_PATH}/listing?${params.toString()}`,
        schema: PromotionListingResponseSchema
    });
}

/** Test-only: forget every shared read. */
export function resetPromotionReadsForTests(): void {
    inflight.clear();
}
