/**
 * Tests for the password-reset hook helper (HOS-2184).
 *
 * The marker is written only when the user has at least one AI connection at
 * the moment of the reset, and a failure never escapes: a password reset must
 * succeed whatever happens to this side effect.
 */
import { describe, expect, it, vi } from 'vitest';
import {
    type PasswordResetAiReviewDeps,
    recordPasswordResetForAiConnections
} from '../../src/lib/auth-password-reset-ai-review';

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = new Date('2026-11-10T12:00:00.000Z');

const buildDeps = (connections: readonly unknown[]) => {
    const listConnections = vi.fn().mockResolvedValue(connections);
    const writeMarker = vi.fn().mockResolvedValue(undefined);
    const deps: PasswordResetAiReviewDeps = { listConnections, writeMarker, now: () => NOW };
    return { deps, listConnections, writeMarker };
};

describe('recordPasswordResetForAiConnections', () => {
    it('records the reset instant when the user has a connection', async () => {
        const { deps, listConnections, writeMarker } = buildDeps([{ clientId: 'c1' }]);

        const recorded = await recordPasswordResetForAiConnections({ userId: USER_ID, deps });

        expect(recorded).toBe(true);
        expect(listConnections).toHaveBeenCalledWith({ userId: USER_ID });
        expect(writeMarker).toHaveBeenCalledWith({
            userId: USER_ID,
            value: '2026-11-10T12:00:00.000Z'
        });
    });

    it('records nothing when the user has no connection', async () => {
        const { deps, writeMarker } = buildDeps([]);

        const recorded = await recordPasswordResetForAiConnections({ userId: USER_ID, deps });

        expect(recorded).toBe(false);
        expect(writeMarker).not.toHaveBeenCalled();
    });

    it('never throws when reading the connections fails', async () => {
        const { deps, listConnections, writeMarker } = buildDeps([]);
        listConnections.mockRejectedValue(new Error('relation oauth_consent does not exist'));

        await expect(recordPasswordResetForAiConnections({ userId: USER_ID, deps })).resolves.toBe(
            false
        );
        expect(writeMarker).not.toHaveBeenCalled();
    });

    it('never throws when writing the marker fails', async () => {
        const { deps, writeMarker } = buildDeps([{ clientId: 'c1' }]);
        writeMarker.mockRejectedValue(new Error('db down'));

        await expect(recordPasswordResetForAiConnections({ userId: USER_ID, deps })).resolves.toBe(
            false
        );
    });
});
