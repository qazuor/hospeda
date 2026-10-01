/**
 * @fileoverview
 * HOS-1136: tests the DECISION logic of `run-dependency-audit.sh` in
 * isolation, without hitting the real npm registry. The seam is a fake
 * `pnpm` binary placed first on `PATH` — the same "drive the real script as
 * a subprocess" style as `check-seed-dual-write.test.ts`, except here the
 * injection point is the external binary the script shells out to, rather
 * than an env-var override the script reads directly (there is nothing else
 * to intercept: the whole point of the script is deciding based on what
 * `pnpm audit` actually printed and exited with).
 *
 * Every case here mirrors a real `pnpm audit --json` shape observed against
 * this repo's own dependency tree (2026-09-21): a clean run, a real finding,
 * and the exact network-timeout log lines from the 2026-09-03 incident this
 * script exists to handle (see HOS-1136).
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts/run-dependency-audit.sh');

interface RunResult {
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
}

const cleanupDirs: string[] = [];

afterEach(() => {
    while (cleanupDirs.length > 0) {
        const dir = cleanupDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

/**
 * Writes a fake `pnpm` binary that only implements `pnpm audit ...` (any
 * other invocation exits 127), scripted by the given bash body, and returns
 * a directory holding it so the caller can prepend it to `PATH`.
 */
function makeFakePnpm(auditBody: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'fake-pnpm-'));
    cleanupDirs.push(dir);
    const script = `#!/usr/bin/env bash\nif [ "$1" = "audit" ]; then\n${auditBody}\nfi\nexit 127\n`;
    const pnpmPath = path.join(dir, 'pnpm');
    writeFileSync(pnpmPath, script);
    chmodSync(pnpmPath, 0o755);
    return dir;
}

/**
 * Runs a script with `bash`, capturing stdout/stderr/exit code uniformly
 * regardless of whether it exits zero or non-zero (unlike `execFileSync`,
 * which only surfaces stderr via the thrown error on a non-zero exit and
 * discards it silently on success).
 */
function runScript(
    scriptPath: string,
    pathPrefix: string,
    extraEnv: Record<string, string>
): RunResult {
    const proc = spawnSync('bash', [scriptPath], {
        cwd: REPO_ROOT,
        env: { ...process.env, PATH: `${pathPrefix}:${process.env.PATH ?? ''}`, ...extraEnv },
        encoding: 'utf8'
    });
    return { exitCode: proc.status ?? 1, stdout: proc.stdout, stderr: proc.stderr };
}

/** Runs the real script with a fake `pnpm` shadowing `PATH`, plus any extra env. */
function runAudit(fakePnpmDir: string, extraEnv: Record<string, string> = {}): RunResult {
    return runScript(SCRIPT_PATH, fakePnpmDir, extraEnv);
}

describe('run-dependency-audit.sh (HOS-1136)', () => {
    it('passes when pnpm audit reports zero findings', () => {
        // Arrange
        const fakePnpmDir = makeFakePnpm(
            `echo '{"advisories":{},"metadata":{"vulnerabilities":{"info":0,"low":0,"moderate":0,"high":0,"critical":0}}}'\nexit 0`
        );

        // Act
        const result = runAudit(fakePnpmDir);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('OK: no critical/high vulnerabilities');
    });

    it('fails the build on a real critical/high finding', () => {
        // Arrange
        const fakePnpmDir = makeFakePnpm(
            `echo '{"advisories":{"1":{"title":"Prototype Pollution"}},"metadata":{"vulnerabilities":{"info":0,"low":0,"moderate":0,"high":2,"critical":0}}}'\nexit 1`
        );

        // Act
        const result = runAudit(fakePnpmDir);

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('reported a real finding');
    });

    it('trap case: still fails when the advisory title itself contains a network-error phrase', () => {
        // Arrange — a REAL, completed report whose own advisory text happens
        // to mention "socket hang up" must not be mistaken for the network
        // exemption. This is the exact fail-open the first version of the
        // script had: the network-signature grep ran over the full output
        // (including advisory text) before checking whether a report had
        // completed at all.
        const fakePnpmDir = makeFakePnpm(
            `echo '{"advisories":{"1":{"title":"DoS via socket hang up handling"}},"metadata":{"vulnerabilities":{"info":0,"low":0,"moderate":0,"high":1,"critical":0}}}'\nexit 1`
        );

        // Act
        const result = runAudit(fakePnpmDir);

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('reported a real finding');
    });

    it('point-1 regression: FORCE_COLOR=1 does not hide a real finding', () => {
        // Arrange — same real-finding fixture as above; FORCE_COLOR=1 is a
        // live convention in this repo (scripts/dev-all.js). The script no
        // longer parses any human-readable/colorized text, so this must
        // behave identically to the plain case above.
        const fakePnpmDir = makeFakePnpm(
            `echo '{"advisories":{"1":{"title":"Prototype Pollution"}},"metadata":{"vulnerabilities":{"info":0,"low":0,"moderate":0,"high":2,"critical":0}}}'\nexit 1`
        );

        // Act
        const result = runAudit(fakePnpmDir, { FORCE_COLOR: '1' });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('reported a real finding');
    });

    it('does not fail the build on the exact 2026-09-03 timeout signature, with no completed report', () => {
        // Arrange — the exact log lines from the incident this script exists
        // to handle (HOS-1136), with no JSON report on stdout at all.
        const fakePnpmDir = makeFakePnpm(
            [
                'echo "[WARN] POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk error (23). Will retry..." >&2',
                'echo "[23] The operation was aborted due to timeout" >&2',
                'echo "TimeoutError: The operation was aborted due to timeout" >&2',
                'exit 1'
            ].join('\n')
        );

        // Act
        const result = runAudit(fakePnpmDir);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('could not get a complete answer');
    });

    it('does not fail the build on a 5xx bad-response failure', () => {
        // Arrange
        const fakePnpmDir = makeFakePnpm(
            [
                'echo " ERR_PNPM_AUDIT_BAD_RESPONSE  The audit endpoint responded with 503: <html><body>Bad Gateway</body></html>" >&2',
                'exit 1'
            ].join('\n')
        );

        // Act
        const result = runAudit(fakePnpmDir);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('could not get a complete answer');
    });

    it('writes the network exemption to GITHUB_STEP_SUMMARY, not just a ::warning:: annotation', () => {
        // Arrange
        const fakePnpmDir = makeFakePnpm(
            'echo "TimeoutError: The operation was aborted due to timeout" >&2\nexit 1'
        );
        const summaryDir = mkdtempSync(path.join(tmpdir(), 'step-summary-'));
        cleanupDirs.push(summaryDir);
        const summaryPath = path.join(summaryDir, 'summary.md');
        writeFileSync(summaryPath, '');

        // Act
        const result = runAudit(fakePnpmDir, { GITHUB_STEP_SUMMARY: summaryPath });

        // Assert
        expect(result.exitCode).toBe(0);
        const summary = readFileSync(summaryPath, 'utf8');
        expect(summary).toContain('Dependency audit skipped (network exemption');
    });

    it('treats a hard timeout (no response at all) as the network exemption, not a hang', () => {
        // Arrange — pnpm accepts the "connection" and never answers. The
        // wrapper's own AUDIT_TIMEOUT_SECONDS_OVERRIDE keeps this test fast;
        // production always uses the real 300s default.
        const fakePnpmDir = makeFakePnpm('sleep 30\nexit 0');

        // Act
        const start = Date.now();
        const result = runAudit(fakePnpmDir, { AUDIT_TIMEOUT_SECONDS_OVERRIDE: '1' });
        const elapsedMs = Date.now() - start;

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('could not get a complete answer');
        expect(elapsedMs).toBeLessThan(5000);
    });

    it('fails closed with a distinct error when mktemp itself is broken', () => {
        // Arrange — shadow `mktemp` (ahead of the real one) so it always
        // fails, proving the script does not misreport this as "no
        // completion summary" (HOS-1136 review point 5) and never even
        // invokes pnpm.
        const fakePnpmDir = makeFakePnpm('echo "should never run" >&2\nexit 1');
        const brokenMktempDir = mkdtempSync(path.join(tmpdir(), 'broken-mktemp-'));
        cleanupDirs.push(brokenMktempDir);
        const mktempPath = path.join(brokenMktempDir, 'mktemp');
        writeFileSync(mktempPath, '#!/usr/bin/env bash\nexit 1\n');
        chmodSync(mktempPath, 0o755);

        // Act
        const result = runScript(SCRIPT_PATH, `${brokenMktempDir}:${fakePnpmDir}`, {});

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('mktemp failed');
        expect(result.stderr).not.toContain('completion summary');
    });
});
