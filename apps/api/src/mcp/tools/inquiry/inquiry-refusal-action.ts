/**
 * @file inquiry-refusal-action.ts
 * @description Where a refused inquiry tool call points the owner (HOS-2326,
 * spec HOS-2335 §5.1): the inquiry inbox.
 *
 * An inquiry that is missing, someone else's, or outside what the account may
 * read all end here. The link is the inbox itself, never one thread: a link
 * around the asked id would confirm that the inquiry exists (AC-C4).
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { ToolErrorPayload, ToolRefusalLink } from '../tool-definition';

/**
 * The link of an inquiry tool refusal.
 *
 * @param args - The refusal
 * @returns The inbox for a not-found or out-of-scope refusal, otherwise none
 */
export function inquiryRefusalLink({
    error
}: {
    readonly error: ToolErrorPayload;
}): ToolRefusalLink | undefined {
    switch (error.code) {
        case ServiceErrorCode.NOT_FOUND:
        case ServiceErrorCode.GONE:
        case ServiceErrorCode.FORBIDDEN:
            return { destination: { kind: 'inquiry' } };
        default:
            return undefined;
    }
}
