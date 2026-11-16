/**
 * HOS-2184 T-010 — bearer token extraction shared by the MCP middleware and
 * the `/mcp` route.
 */

import { describe, expect, it } from 'vitest';
import { readBearerToken } from '../../../src/lib/mcp/bearer-token';

describe('readBearerToken', () => {
    it.each([
        ['Bearer abc.def.ghi', 'abc.def.ghi'],
        ['bearer abc', 'abc'],
        ['Bearer   abc  ', 'abc']
    ])('reads the token of %j', (authorization, expected) => {
        // Act
        const token = readBearerToken({ authorization });

        // Assert
        expect(token).toBe(expected);
    });

    it.each([
        undefined,
        '',
        'Bearer',
        'Bearer ',
        'Basic dXNlcjpwYXNz',
        'Bearer a b'
    ])('returns null for %j', (authorization) => {
        // Act
        const token = readBearerToken({ authorization });

        // Assert
        expect(token).toBeNull();
    });
});
