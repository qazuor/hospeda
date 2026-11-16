/**
 * @file location-exception-view.ts
 * @description Defensive parser of the protected projection's `locationException`
 * block (HOS-2192). Kept apart from `location-exception.ts` so the API transforms
 * can import it without pulling in the API client.
 */

import { type LocationExceptionOwnerView, LocationExceptionOwnerViewSchema } from '@repo/schemas';

/**
 * Parse the raw `locationException` block. Anything that is not the documented
 * shape (an older API build, a missing field) yields `undefined`, which the UI
 * reads as "no exception, no request".
 *
 * @param input.raw - The raw value from the API payload.
 * @returns The typed view or `undefined`.
 */
export function parseLocationException({
    raw
}: {
    readonly raw: unknown;
}): LocationExceptionOwnerView | undefined {
    const parsed = LocationExceptionOwnerViewSchema.safeParse(raw);
    return parsed.success ? parsed.data : undefined;
}
