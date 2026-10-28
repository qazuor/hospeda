/**
 * Round-trip tests for `src/lib/gpg.ts` against the REAL gpg binary, run
 * under bun — the runtime `hops` ships on (HOS-1953).
 *
 * The encrypted backup path had never been exercised: under bun, the old
 * execa call (`encoding: 'buffer'`) threw "Attempted to assign to readonly
 * property." on every call, so `db-backup-now`, the pre-migrate backup and
 * the pre-restore snapshot all died as soon as BACKUP_PASSPHRASE was set,
 * and `db-restore` could not read a `.dump.gpg`. A mock of the subprocess
 * layer would have stayed green through all of that, which is why these
 * tests spawn gpg for real.
 *
 * Isolation: GNUPGHOME points at a throwaway directory, and PATH is
 * prefixed with a wrapper `gpg` that logs its argv before exec'ing the real
 * binary — that log is how the "passphrase never reaches argv" test sees
 * exactly what the process was started with.
 *
 * Skipped (not failed) when gpg is not installed.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gpgSymmetricDecrypt, gpgSymmetricEncrypt } from '../src/lib/gpg.ts';

const realGpg = spawnSync('bash', ['-c', 'command -v gpg'], { encoding: 'utf-8' }).stdout.trim();
const hasGpg = realGpg.length > 0;

const PASSPHRASE = 'hos-1953 correct horse battery staple';
const FIVE_MB = 5 * 1024 * 1024;

let workDir = '';
let argvLog = '';
const saved: Record<'PATH' | 'GNUPGHOME' | 'HOPS_GPG_ARGV_LOG', string | undefined> = {
    PATH: undefined,
    GNUPGHOME: undefined,
    HOPS_GPG_ARGV_LOG: undefined
};

beforeAll(() => {
    if (!hasGpg) return;
    saved.PATH = process.env.PATH;
    saved.GNUPGHOME = process.env.GNUPGHOME;
    saved.HOPS_GPG_ARGV_LOG = process.env.HOPS_GPG_ARGV_LOG;

    workDir = mkdtempSync(join(tmpdir(), 'hops-gpg-test-'));
    const gnupgHome = join(workDir, 'gnupg');
    mkdirSync(gnupgHome, { mode: 0o700 });
    const binDir = join(workDir, 'bin');
    mkdirSync(binDir);
    argvLog = join(workDir, 'argv.log');

    // One line per invocation, every argument NUL-free and space-joined.
    const wrapper = join(binDir, 'gpg');
    writeFileSync(
        wrapper,
        `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "$HOPS_GPG_ARGV_LOG"\nexec "${realGpg}" "$@"\n`
    );
    chmodSync(wrapper, 0o755);

    process.env.GNUPGHOME = gnupgHome;
    process.env.HOPS_GPG_ARGV_LOG = argvLog;
    process.env.PATH = `${binDir}:${saved.PATH ?? ''}`;
});

afterAll(() => {
    if (!hasGpg) return;
    for (const key of Object.keys(saved) as Array<keyof typeof saved>) {
        const value = saved[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    rmSync(workDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpg)('gpg symmetric round trip (real gpg, bun runtime)', () => {
    it('encrypts 5 MB and decrypts back to the identical bytes', async () => {
        // Arrange
        const plaintext = randomBytes(FIVE_MB);

        // Act
        const ciphertext = await gpgSymmetricEncrypt(plaintext, PASSPHRASE);
        const decrypted = await gpgSymmetricDecrypt(ciphertext, PASSPHRASE);

        // Assert
        expect(ciphertext.length).toBeGreaterThan(0);
        expect(ciphertext.subarray(0, 64).equals(plaintext.subarray(0, 64))).toBe(false);
        expect(decrypted.length).toBe(FIVE_MB);
        expect(Buffer.compare(decrypted, plaintext)).toBe(0);
    });

    it('rejects a decrypt with the wrong passphrase', async () => {
        // Arrange
        const plaintext = randomBytes(64 * 1024);
        const ciphertext = await gpgSymmetricEncrypt(plaintext, PASSPHRASE);

        // Act + Assert
        await expect(gpgSymmetricDecrypt(ciphertext, 'not-the-passphrase')).rejects.toThrow(
            /gpg exited with code/
        );
    });

    it('rejects input that is not an OpenPGP message', async () => {
        await expect(
            gpgSymmetricDecrypt(Buffer.from('definitely not gpg'), PASSPHRASE)
        ).rejects.toThrow(/gpg exited with code/);
    });

    it('never puts the passphrase on the gpg command line', async () => {
        // Arrange
        writeFileSync(argvLog, '');

        // Act
        const ciphertext = await gpgSymmetricEncrypt(Buffer.from('argv check'), PASSPHRASE);
        await gpgSymmetricDecrypt(ciphertext, PASSPHRASE);

        // Assert
        const invocations = readFileSync(argvLog, 'utf-8').split('\n').filter(Boolean);
        expect(invocations).toHaveLength(2);
        for (const argv of invocations) {
            expect(argv).not.toContain(PASSPHRASE);
            expect(argv).not.toMatch(/--passphrase(\s|=)/);
            expect(argv).toContain('--passphrase-fd 3');
        }
    });
});

describe('gpg availability in CI', () => {
    // The round trip above skips without gpg, so a CI image that stopped
    // shipping it would turn the whole suite into a silent no-op. In CI the
    // skip is not acceptable: fail loudly instead.
    it.skipIf(process.env.CI !== 'true')('has a gpg binary on PATH', () => {
        expect(hasGpg).toBe(true);
    });
});

describe('gpg helpers input validation', () => {
    it('refuses an empty passphrase before spawning gpg', async () => {
        await expect(gpgSymmetricEncrypt(Buffer.from('x'), '')).rejects.toThrow(
            /passphrase is empty/
        );
        await expect(gpgSymmetricDecrypt(Buffer.from('x'), '')).rejects.toThrow(
            /passphrase is empty/
        );
    });
});
