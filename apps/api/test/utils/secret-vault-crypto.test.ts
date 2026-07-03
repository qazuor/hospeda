/**
 * Unit tests for the shared secret-vault crypto util (HOS-64 / SPEC-297a G-4, T-016).
 *
 * Unlike `ai-vault.test.ts` (which mocks `env` since the master key is read
 * internally), this util takes the master key as a direct input — no env
 * mocking needed.
 *
 * @module test/utils/secret-vault-crypto
 */

import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from '../../src/utils/secret-vault-crypto.js';

const MASTER_KEY = 'test-vault-master-key-at-least-32-chars-xx';
const OTHER_MASTER_KEY = 'a-completely-different-master-key-32xxxx';
const MASTER_KEY_NAME = 'HOSPEDA_TEST_VAULT_MASTER_KEY';

describe('secret-vault-crypto', () => {
    describe('round-trip', () => {
        it('decrypts back to the original plaintext', () => {
            // Arrange
            const plaintext = 'sk-test-provider-api-key-123';

            // Act
            const enc = encryptSecret({
                plaintext,
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });
            const { plaintext: out } = decryptSecret({
                ...enc,
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });

            // Assert
            expect(out).toBe(plaintext);
        });

        it('handles unicode and long secrets', () => {
            // Arrange
            const plaintext = `clé-secrète-日本語-${'x'.repeat(500)}`;

            // Act
            const enc = encryptSecret({
                plaintext,
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });
            const { plaintext: out } = decryptSecret({
                ...enc,
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });

            // Assert
            expect(out).toBe(plaintext);
        });

        it('handles the empty string', () => {
            // Act
            const enc = encryptSecret({
                plaintext: '',
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });
            const { plaintext: out } = decryptSecret({
                ...enc,
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });

            // Assert
            expect(out).toBe('');
        });
    });

    describe('tamper detection', () => {
        it('throws when the ciphertext is altered', () => {
            // Arrange
            const enc = encryptSecret({
                plaintext: 'secret',
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });
            const tampered = {
                ...enc,
                ciphertext: Buffer.from('tampered-data').toString('base64')
            };

            // Act & Assert
            expect(() =>
                decryptSecret({
                    ...tampered,
                    masterKey: MASTER_KEY,
                    masterKeyName: MASTER_KEY_NAME
                })
            ).toThrow();
        });

        it('throws when the authTag is altered', () => {
            // Arrange
            const enc = encryptSecret({
                plaintext: 'secret',
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });
            const badTag = Buffer.alloc(16, 0).toString('base64');

            // Act & Assert
            expect(() =>
                decryptSecret({
                    ...enc,
                    authTag: badTag,
                    masterKey: MASTER_KEY,
                    masterKeyName: MASTER_KEY_NAME
                })
            ).toThrow();
        });

        it('throws when the iv is altered', () => {
            // Arrange
            const enc = encryptSecret({
                plaintext: 'secret',
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });
            const badIv = Buffer.alloc(12, 0).toString('base64');

            // Act & Assert
            expect(() =>
                decryptSecret({
                    ...enc,
                    iv: badIv,
                    masterKey: MASTER_KEY,
                    masterKeyName: MASTER_KEY_NAME
                })
            ).toThrow();
        });
    });

    describe('missing master key', () => {
        it('encrypt throws a clear error naming the env var', () => {
            expect(() =>
                encryptSecret({
                    plaintext: 'x',
                    masterKey: undefined,
                    masterKeyName: MASTER_KEY_NAME
                })
            ).toThrow(/HOSPEDA_TEST_VAULT_MASTER_KEY is not set/);
        });

        it('decrypt throws a clear error naming the env var', () => {
            // Arrange
            const enc = encryptSecret({
                plaintext: 'x',
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });

            // Act & Assert
            expect(() =>
                decryptSecret({ ...enc, masterKey: undefined, masterKeyName: MASTER_KEY_NAME })
            ).toThrow(/HOSPEDA_TEST_VAULT_MASTER_KEY is not set/);
        });

        it('encrypt throws when the master key is an empty string', () => {
            expect(() =>
                encryptSecret({ plaintext: 'x', masterKey: '', masterKeyName: MASTER_KEY_NAME })
            ).toThrow(/HOSPEDA_TEST_VAULT_MASTER_KEY is not set/);
        });

        it('names a different vault correctly when masterKeyName differs', () => {
            expect(() =>
                encryptSecret({
                    plaintext: 'x',
                    masterKey: undefined,
                    masterKeyName: 'HOSPEDA_SOCIAL_VAULT_MASTER_KEY'
                })
            ).toThrow(/HOSPEDA_SOCIAL_VAULT_MASTER_KEY is not set/);
        });
    });

    describe('cross-master-key non-interchangeability', () => {
        it('fails to decrypt with a different master key than the one used to encrypt', () => {
            // Arrange
            const enc = encryptSecret({
                plaintext: 'secret',
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });

            // Act & Assert
            expect(() =>
                decryptSecret({
                    ...enc,
                    masterKey: OTHER_MASTER_KEY,
                    masterKeyName: MASTER_KEY_NAME
                })
            ).toThrow();
        });

        it('produces different ciphertext for the same plaintext under different master keys', () => {
            // Arrange & Act
            const encA = encryptSecret({
                plaintext: 'same-input',
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });
            const encB = encryptSecret({
                plaintext: 'same-input',
                masterKey: OTHER_MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });

            // Assert — ciphertext differs (both IV randomness and key derivation)
            expect(encA.ciphertext).not.toBe(encB.ciphertext);
        });
    });

    describe('ciphertext properties', () => {
        it('produces ciphertext that differs from the plaintext', () => {
            // Act
            const enc = encryptSecret({
                plaintext: 'sensitive-value',
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });

            // Assert
            expect(enc.ciphertext).not.toBe('sensitive-value');
            expect(Buffer.from(enc.ciphertext, 'base64').toString('utf8')).not.toBe(
                'sensitive-value'
            );
        });

        it('uses a fresh IV each call, yielding different ciphertext for equal plaintext', () => {
            // Act
            const a = encryptSecret({
                plaintext: 'same-input',
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });
            const b = encryptSecret({
                plaintext: 'same-input',
                masterKey: MASTER_KEY,
                masterKeyName: MASTER_KEY_NAME
            });

            // Assert
            expect(a.iv).not.toBe(b.iv);
            expect(a.ciphertext).not.toBe(b.ciphertext);
        });
    });
});
