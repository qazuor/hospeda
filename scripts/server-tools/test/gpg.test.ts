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
 * prefixed with a wrapper `gpg` that logs its argv (plus the mode of the
 * `--passphrase-file`, read while gpg still has it) before exec'ing the real
 * binary — that log is how the "passphrase never reaches argv" test sees
 * exactly what the process was started with.
 *
 * Skipped (not failed) when gpg is not installed.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gpgSymmetricDecrypt, gpgSymmetricEncrypt } from '../src/lib/gpg.ts';
import { runner } from '../src/lib/runner.ts';

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
        [
            '#!/usr/bin/env bash',
            'mode=none',
            'prev=',
            'for arg in "$@"; do',
            '    if [ "$prev" = "--passphrase-file" ]; then mode=$(stat -c %a "$arg"); fi',
            '    prev=$arg',
            'done',
            `printf '%s MODE=%s\\n' "$*" "$mode" >> "$HOPS_GPG_ARGV_LOG"`,
            `exec "${realGpg}" "$@"`,
            ''
        ].join('\n')
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
            expect(argv).not.toContain('--passphrase-fd');
            // The file was private while gpg read it...
            expect(argv).toMatch(/ MODE=600$/);
            // ...and is gone (with its directory) once the helper returns.
            const passphraseFile = /--passphrase-file (\S+)/.exec(argv)?.[1] ?? '';
            expect(passphraseFile).not.toBe('');
            expect(existsSync(passphraseFile)).toBe(false);
            expect(existsSync(dirname(passphraseFile))).toBe(false);
        }
    });

    it('removes the passphrase file when gpg fails', async () => {
        // Arrange
        writeFileSync(argvLog, '');

        // Act
        await expect(
            gpgSymmetricDecrypt(Buffer.from('not an OpenPGP message'), PASSPHRASE)
        ).rejects.toThrow(/gpg exited with code/);

        // Assert
        const passphraseFile =
            /--passphrase-file (\S+)/.exec(readFileSync(argvLog, 'utf-8'))?.[1] ?? '';
        expect(passphraseFile).not.toBe('');
        expect(existsSync(dirname(passphraseFile))).toBe(false);
    });

    it('lets the NEXT child process exit after a gpg call, even across a GC', async () => {
        // Regression (HOS-1953, `hops db-restore` hung after decrypting):
        // gpg used to read the passphrase from an extra stdio pipe on fd 3.
        // Bun closes that pipe once when it is drained and then AGAIN when
        // the stream wrapper is collected. By then the fd number has been
        // reused, so the second close lands on whatever took it, which in
        // the hang was the pidfd of the next child (`docker cp`). Bun stops
        // watching that child, it stays <defunct>, and the awaited exit
        // never comes. A forced GC while the next child runs reproduces it
        // deterministically on bun 1.3.7 and 1.3.13.

        // Arrange
        const ciphertext = await gpgSymmetricEncrypt(randomBytes(64 * 1024), PASSPHRASE);
        await gpgSymmetricDecrypt(ciphertext, PASSPHRASE);

        // Act: the next child goes through the same runner `docker()` uses,
        // so it allocates the fd numbers the gpg pipes just released.
        const nextChild = runner.run(['sleep', '0.2']);
        await new Promise((resolve) => setTimeout(resolve, 20));
        Bun.gc(true);
        const outcome = await Promise.race([
            nextChild,
            new Promise<'HUNG'>((resolve) => setTimeout(() => resolve('HUNG'), 5000))
        ]);

        // Assert
        expect(outcome === 'HUNG' ? 'HUNG' : outcome.exitCode).toBe(0);
    }, 10000);
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
