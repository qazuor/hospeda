/**
 * Unit tests for typed confirmations without a TTY (HOS-1963).
 *
 * The incident: a typed phrase piped into `hops` (`echo phrase | hops ...`)
 * made clack skip the prompt, and the command ended exit 0 having written
 * nothing. These tests pin the fix: a prompt without a TTY exits non-zero with
 * a clear message (exercised in a REAL subprocess with a piped stdin), and
 * `--confirm-phrase` answers the prompt only when it equals the phrase exactly.
 */

import { describe, expect, it } from 'bun:test';
import { parseCutoverStep3Args } from '../src/lib/cutover-step-3-core.ts';
import {
    cutoverWrapperArgvSpec,
    parseCutoverWrapperArgs
} from '../src/lib/cutover-wrapper-core.ts';
import { CUTOVER_STEP_4C_SPEC } from '../src/lib/cutover-wrapper-specs.ts';
import { confirmTypedPhrase, ttyRefusal } from '../src/lib/typed-confirmation.ts';

const PHRASE = 'purge-prod';

describe('ttyRefusal', () => {
    it('allows a prompt only when stdin and stdout are both TTYs', () => {
        // Arrange / Act / Assert
        expect(ttyRefusal({ stdinIsTty: true, stdoutIsTty: true, message: 'x' })).toBeUndefined();
        expect(ttyRefusal({ stdinIsTty: undefined, stdoutIsTty: true, message: 'x' })).toContain(
            'not a TTY'
        );
        expect(ttyRefusal({ stdinIsTty: true, stdoutIsTty: false, message: 'x' })).toContain(
            '--confirm-phrase'
        );
    });
});

describe('promptText without a TTY (real subprocess, piped stdin)', () => {
    it('exits non-zero with a clear message instead of ending silently', async () => {
        // Arrange
        const script = `import { promptText } from '${import.meta.dir}/../src/lib/prompt.ts';
            await promptText({ message: "Type 'purge-prod' to confirm" });
            console.log('REACHED');`;
        // Act
        const proc = Bun.spawn(['bun', '-e', script], {
            stdin: new Blob([`${PHRASE}\n`]),
            stdout: 'pipe',
            stderr: 'pipe'
        });
        const [stdout, stderr, code] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited
        ]);
        // Assert
        expect(code).toBe(1);
        expect(stderr).toContain('not a TTY');
        expect(stdout).not.toContain('REACHED');
    });
});

describe('confirmTypedPhrase', () => {
    it('accepts --confirm-phrase equal to the phrase without prompting', async () => {
        // Arrange
        let asked = false;
        // Act
        const result = await confirmTypedPhrase({
            expected: PHRASE,
            provided: PHRASE,
            ask: async () => {
                asked = true;
                return '';
            }
        });
        // Assert
        expect(result).toEqual({ ok: true });
        expect(asked).toBe(false);
    });

    it.each([
        'purge-prod ',
        'PURGE-PROD',
        'write-trials-prod',
        ''
    ])('rejects a --confirm-phrase of %p and never falls back to the prompt', async (provided) => {
        // Arrange
        let asked = false;
        // Act
        const result = await confirmTypedPhrase({
            expected: PHRASE,
            provided,
            ask: async () => {
                asked = true;
                return PHRASE;
            }
        });
        // Assert
        expect(result.ok).toBe(false);
        expect(asked).toBe(false);
    });

    it('prompts when no flag was given and compares exactly', async () => {
        // Arrange / Act / Assert
        expect(
            (
                await confirmTypedPhrase({
                    expected: PHRASE,
                    provided: undefined,
                    ask: async () => PHRASE
                })
            ).ok
        ).toBe(true);
        expect(
            (
                await confirmTypedPhrase({
                    expected: PHRASE,
                    provided: undefined,
                    ask: async () => 'nope'
                })
            ).ok
        ).toBe(false);
    });
});

describe('--confirm-phrase parsing', () => {
    it('step 3 reads the value and refuses an empty or repeated one', () => {
        // Arrange / Act / Assert
        const ok = parseCutoverStep3Args([
            '--confirm-write-trials',
            '--confirm-phrase=write-trials-prod'
        ]);
        expect(ok.ok && ok.value.confirmPhrase).toBe('write-trials-prod');
        expect(parseCutoverStep3Args(['--confirm-phrase=']).ok).toBe(false);
        expect(parseCutoverStep3Args(['--confirm-phrase']).ok).toBe(false);
        expect(parseCutoverStep3Args(['--confirm-phrase=a', '--confirm-phrase=a']).ok).toBe(false);
    });

    it('wrappers read it, never forward it to the script, and declare it', () => {
        // Arrange
        const parsed = parseCutoverWrapperArgs({
            spec: CUTOVER_STEP_4C_SPEC,
            argv: ['--confirm-purge', `--confirm-phrase=${PHRASE}`],
            cwd: '/tmp',
            fileExists: () => true
        });
        // Assert
        expect(parsed.ok && parsed.value.confirmPhrase).toBe(PHRASE);
        expect(parsed.ok && parsed.value.forwarded).toEqual([]);
        expect(
            cutoverWrapperArgvSpec(CUTOVER_STEP_4C_SPEC).valueFlags.map((f) => f.name)
        ).toContain('--confirm-phrase');
        expect(
            parseCutoverWrapperArgs({
                spec: CUTOVER_STEP_4C_SPEC,
                argv: ['--confirm-phrase='],
                cwd: '/tmp',
                fileExists: () => true
            }).ok
        ).toBe(false);
    });
});
