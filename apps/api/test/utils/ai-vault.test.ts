import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mutable mock of the validated env singleton so we can inject a throwaway
 * master key and exercise the "missing key" path. `deriveKey` reads
 * `env.HOSPEDA_AI_VAULT_MASTER_KEY` on every call, so mutating this between
 * tests is observed immediately.
 */
const mockEnv = vi.hoisted(() => ({
    env: {
        HOSPEDA_AI_VAULT_MASTER_KEY: 'test-vault-master-key-at-least-32-chars-xx' as
            | string
            | undefined
    }
}));

vi.mock('../../src/utils/env.js', () => mockEnv);

import { decryptSecret, encryptSecret } from '../../src/utils/ai-vault.js';

const VALID_KEY = 'test-vault-master-key-at-least-32-chars-xx';

describe('ai-vault', () => {
    beforeEach(() => {
        mockEnv.env.HOSPEDA_AI_VAULT_MASTER_KEY = VALID_KEY;
    });

    describe('round-trip', () => {
        it('decrypts back to the original plaintext', () => {
            // Arrange
            const plaintext = 'sk-test-provider-api-key-123';
            // Act
            const enc = encryptSecret({ plaintext });
            const { plaintext: out } = decryptSecret(enc);
            // Assert
            expect(out).toBe(plaintext);
        });

        it('handles unicode and long secrets', () => {
            const plaintext = `clé-secrète-日本語-${'x'.repeat(500)}`;
            const enc = encryptSecret({ plaintext });
            expect(decryptSecret(enc).plaintext).toBe(plaintext);
        });

        it('handles the empty string', () => {
            const enc = encryptSecret({ plaintext: '' });
            expect(decryptSecret(enc).plaintext).toBe('');
        });
    });

    describe('ciphertext properties', () => {
        it('produces ciphertext that differs from the plaintext', () => {
            const plaintext = 'sensitive-value';
            const enc = encryptSecret({ plaintext });
            expect(enc.ciphertext).not.toBe(plaintext);
            expect(Buffer.from(enc.ciphertext, 'base64').toString('utf8')).not.toBe(plaintext);
        });

        it('uses a fresh IV each call, yielding different ciphertext for equal plaintext', () => {
            const plaintext = 'same-input';
            const a = encryptSecret({ plaintext });
            const b = encryptSecret({ plaintext });
            expect(a.iv).not.toBe(b.iv);
            expect(a.ciphertext).not.toBe(b.ciphertext);
        });

        it('emits iv and authTag as base64 fitting the varchar(32) columns', () => {
            const enc = encryptSecret({ plaintext: 'x' });
            expect(enc.iv.length).toBeGreaterThan(0);
            expect(enc.iv.length).toBeLessThanOrEqual(32);
            expect(enc.authTag.length).toBeGreaterThan(0);
            expect(enc.authTag.length).toBeLessThanOrEqual(32);
        });
    });

    describe('tamper detection', () => {
        it('throws when the ciphertext is altered', () => {
            const enc = encryptSecret({ plaintext: 'secret' });
            const tampered = {
                ...enc,
                ciphertext: Buffer.from('tampered-data').toString('base64')
            };
            expect(() => decryptSecret(tampered)).toThrow();
        });

        it('throws when the authTag is altered', () => {
            const enc = encryptSecret({ plaintext: 'secret' });
            const badTag = Buffer.alloc(16, 0).toString('base64');
            expect(() => decryptSecret({ ...enc, authTag: badTag })).toThrow();
        });

        it('throws when the iv is altered', () => {
            const enc = encryptSecret({ plaintext: 'secret' });
            const badIv = Buffer.alloc(12, 0).toString('base64');
            expect(() => decryptSecret({ ...enc, iv: badIv })).toThrow();
        });

        it('throws when decrypted with a different master key', () => {
            const enc = encryptSecret({ plaintext: 'secret' });
            mockEnv.env.HOSPEDA_AI_VAULT_MASTER_KEY = 'a-completely-different-master-key-32xxxx';
            expect(() => decryptSecret(enc)).toThrow();
        });
    });

    describe('missing master key', () => {
        it('encrypt throws a clear error', () => {
            mockEnv.env.HOSPEDA_AI_VAULT_MASTER_KEY = undefined;
            expect(() => encryptSecret({ plaintext: 'x' })).toThrow(
                /HOSPEDA_AI_VAULT_MASTER_KEY is not set/
            );
        });

        it('decrypt throws a clear error', () => {
            const enc = encryptSecret({ plaintext: 'x' });
            mockEnv.env.HOSPEDA_AI_VAULT_MASTER_KEY = undefined;
            expect(() => decryptSecret(enc)).toThrow(/HOSPEDA_AI_VAULT_MASTER_KEY is not set/);
        });
    });
});
