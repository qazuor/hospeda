/**
 * @file bearer-token.ts
 * @description Reads the bearer token of an MCP request (HOS-2184). Shared by
 * `mcpAuthMiddleware`, which verifies it, and the `/mcp` route, which hands it
 * to the SDK as `authInfo.token`.
 */

/** `Authorization` header carrying a bearer token (RFC 6750 §2.1). */
const BEARER_HEADER_PATTERN = /^Bearer[ ]+([^\s]+)[ ]*$/i;

/**
 * Arguments for {@link readBearerToken}. RO-RO.
 */
export interface ReadBearerTokenArgs {
    /** The `Authorization` header value, if any. */
    readonly authorization: string | undefined;
}

/**
 * Extracts the token of an `Authorization: Bearer <token>` header.
 *
 * @param args - The header value
 * @returns The token, or `null` when the header is absent or not a bearer one
 *
 * @example
 * ```typescript
 * readBearerToken({ authorization: 'Bearer abc' }); // 'abc'
 * readBearerToken({ authorization: 'Basic abc' }); // null
 * ```
 */
export function readBearerToken({ authorization }: ReadBearerTokenArgs): string | null {
    const match = authorization ? BEARER_HEADER_PATTERN.exec(authorization) : null;
    return match?.[1] ?? null;
}
