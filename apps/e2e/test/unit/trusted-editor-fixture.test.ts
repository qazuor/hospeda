/**
 * Static guard — the trusted-editor e2e fixture derives its permission bundle.
 *
 * `setTrustedEditor` (apps/e2e/fixtures/api-helpers.ts) arranges the state that
 * every HOS-374 trusted-editor spec depends on: an `EDITOR` holding the four
 * `TRUSTED_EDITOR_PERMISSIONS` as `grant` overrides in `user_permission`.
 *
 * The failure this guards against is a hand-typed list. A fixture that restates
 * the four permissions keeps passing after the bundle changes in
 * `@repo/schemas`, and the specs it feeds then assert "a trusted editor can
 * publish" about a user who is NOT one — green tests over a broken premise.
 * So the assertion is not "the fixture writes four rows", it is "the fixture
 * writes exactly what the schema tuple says, whatever that tuple becomes".
 *
 * No DB, no servers: `execSQL` is mocked and the emitted parameters inspected.
 *
 * @see packages/schemas/src/entities/permission/permission.trusted-editor.schema.ts
 * @see apps/e2e/fixtures/api-helpers.ts
 */

import { TRUSTED_EDITOR_PERMISSIONS } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execSQLMock } = vi.hoisted(() => ({ execSQLMock: vi.fn() }));

vi.mock('../../fixtures/db-helpers.ts', () => ({
    execSQL: execSQLMock
}));

import { setTrustedEditor } from '../../fixtures/api-helpers.ts';

const USER_ID = '11111111-2222-3333-4444-555555555555';

beforeEach(() => {
    execSQLMock.mockReset().mockResolvedValue([]);
});

describe('setTrustedEditor fixture (HOS-374)', () => {
    it('writes the bundle derived from TRUSTED_EDITOR_PERMISSIONS, not a restated list', async () => {
        await setTrustedEditor(USER_ID);

        expect(execSQLMock).toHaveBeenCalledTimes(1);
        const [, params] = execSQLMock.mock.calls[0] as [string, readonly unknown[]];

        expect(params[0]).toBe(USER_ID);
        expect(params[1]).toEqual([...TRUSTED_EDITOR_PERMISSIONS]);
    });

    it('targets user_permission with a grant effect', async () => {
        await setTrustedEditor(USER_ID);

        const [sql] = execSQLMock.mock.calls[0] as [string, readonly unknown[]];

        expect(sql).toContain('INSERT INTO user_permission');
        expect(sql).toContain("'grant'::permission_effect_enum");
    });

    /**
     * Idempotence + normalization: the `(user_id, permission)` primary key makes
     * a repeat call a no-op, and an existing `deny` row must be upgraded rather
     * than left in place — a half-denied bundle is not a trusted editor.
     */
    it('upgrades a pre-existing row instead of failing on the primary key', async () => {
        await setTrustedEditor(USER_ID);

        const [sql] = execSQLMock.mock.calls[0] as [string, readonly unknown[]];

        expect(sql).toContain('ON CONFLICT (user_id, permission)');
        expect(sql).toContain("DO UPDATE SET effect = 'grant'::permission_effect_enum");
    });
});
