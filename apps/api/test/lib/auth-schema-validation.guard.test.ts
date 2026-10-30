/**
 * CI guard: Better Auth's runtime schema validation stays off (HOS-1932).
 *
 * Better Auth 1.7 compares the Drizzle schema with the tables it expects and
 * fails every auth request when they differ. The admin plugin declares a
 * `role` field on `user`, but `users.role` was dropped by HOS-296 (roles live
 * in `user_role`), so with validation on every sign-up answered 500
 * `Drizzle schema mismatch: Missing columns user.role`. The wiring is asserted
 * over the source because instantiating Better Auth needs a live DB.
 *
 * @module test/lib/auth-schema-validation.guard.test
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const AUTH_SOURCE = readFileSync(join(__dirname, '../../src/lib/auth.ts'), 'utf8');

describe('Better Auth schema validation (HOS-1932)', () => {
    it('disables advanced.database.validateSchema while users.role is absent', () => {
        // Arrange
        const databaseBlock = AUTH_SOURCE.slice(AUTH_SOURCE.indexOf('\n        advanced: {'));

        // Act / Assert
        expect(databaseBlock).toMatch(/^\s*validateSchema: false$/m);
    });
});
