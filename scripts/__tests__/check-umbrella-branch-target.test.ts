/**
 * @fileoverview
 * DEC-ARCH-007 / DEC-CI-001: drives `check-umbrella-branch-target.sh` against
 * a REAL throwaway git history — a bare "origin" plus a clone — because the
 * guard's predicate is ancestry, and ancestry is exactly what a mocked diff
 * cannot express.
 *
 * Each test builds the topology it needs (staging, an umbrella cut from it, a
 * sub-epic cut from the umbrella, a normal feature branch), checks out the
 * PR's merge result the way `actions/checkout` does for `pull_request`, and
 * runs the real script there, asserting exit code and output.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '../check-umbrella-branch-target.sh');
const UMBRELLA = 'epic/HOS-1352-verticales-billing';

interface RunResult {
    readonly exitCode: number;
    readonly stdout: string;
}

interface Sandbox {
    readonly root: string;
    readonly clone: string;
}

/** Runs git inside `cwd` with a fixed identity, returning trimmed stdout. */
function git({ cwd, args }: { readonly cwd: string; readonly args: readonly string[] }): string {
    return execFileSync('git', [...args], {
        cwd,
        encoding: 'utf8',
        env: {
            ...process.env,
            GIT_AUTHOR_NAME: 'test',
            GIT_AUTHOR_EMAIL: 'test@example.com',
            GIT_COMMITTER_NAME: 'test',
            GIT_COMMITTER_EMAIL: 'test@example.com'
        }
    }).trim();
}

/** Writes a file and commits it on the currently checked-out branch. */
function commit({ cwd, file }: { readonly cwd: string; readonly file: string }): void {
    writeFileSync(path.join(cwd, file), `${file}\n`);
    git({ cwd, args: ['add', file] });
    git({ cwd, args: ['commit', '-q', '-m', `add ${file}`] });
}

/** Creates a bare origin with `staging`/`main` and a working clone of it. */
function createSandbox(): Sandbox {
    const root = mkdtempSync(path.join(tmpdir(), 'umbrella-guard-'));
    const origin = path.join(root, 'origin.git');
    const clone = path.join(root, 'clone');
    git({ cwd: root, args: ['init', '-q', '--bare', '-b', 'staging', origin] });
    git({ cwd: root, args: ['clone', '-q', origin, clone] });
    git({ cwd: clone, args: ['checkout', '-q', '-b', 'staging'] });
    commit({ cwd: clone, file: 'base.txt' });
    git({ cwd: clone, args: ['push', '-q', 'origin', 'staging', 'staging:main'] });
    return { root, clone };
}

/** Pushes `branch` (currently checked out or named) to origin. */
function push({ cwd, branch }: { readonly cwd: string; readonly branch: string }): void {
    git({ cwd, args: ['push', '-q', 'origin', branch] });
}

/**
 * Checks out the merge of `head` into `origin/<base>` on a detached HEAD,
 * which is what `actions/checkout` does for a `pull_request` event.
 */
function checkoutPrMerge({
    cwd,
    head,
    base
}: {
    readonly cwd: string;
    readonly head: string;
    readonly base: string;
}): void {
    git({ cwd, args: ['fetch', '-q', 'origin'] });
    git({ cwd, args: ['checkout', '-q', '--detach', `origin/${base}`] });
    git({ cwd, args: ['merge', '-q', '--no-ff', '--no-edit', `origin/${head}`] });
}

/** Runs the guard from `cwd` with the given PR context. */
function runGuard({
    cwd,
    env
}: {
    readonly cwd: string;
    readonly env: Record<string, string>;
}): RunResult {
    try {
        const stdout = execFileSync('bash', [SCRIPT_PATH], {
            cwd,
            env: { ...process.env, CI_BASELINE_SHA: '', ...env },
            encoding: 'utf8'
        });
        return { exitCode: 0, stdout };
    } catch (error) {
        const err = error as { status: number | null; stdout: string };
        return { exitCode: err.status ?? 1, stdout: err.stdout };
    }
}

describe('check-umbrella-branch-target.sh (DEC-ARCH-007)', () => {
    let sandbox: Sandbox;

    beforeEach(() => {
        sandbox = createSandbox();
    });

    afterEach(() => {
        rmSync(sandbox.root, { recursive: true, force: true });
    });

    /** Umbrella cut from staging, with one commit of its own, pushed. */
    function createUmbrellaWithWork(): void {
        const cwd = sandbox.clone;
        git({ cwd, args: ['checkout', '-q', '-b', UMBRELLA, 'staging'] });
        commit({ cwd, file: 'umbrella-1.txt' });
        push({ cwd, branch: UMBRELLA });
    }

    it('passes when the umbrella does not exist on the remote yet', () => {
        // Arrange
        const cwd = sandbox.clone;
        git({ cwd, args: ['checkout', '-q', '-b', 'feat/x', 'staging'] });
        commit({ cwd, file: 'x.txt' });
        push({ cwd, branch: 'feat/x' });
        checkoutPrMerge({ cwd, head: 'feat/x', base: 'staging' });

        // Act
        const result = runGuard({
            cwd,
            env: { GITHUB_BASE_REF: 'staging', GITHUB_HEAD_REF: 'feat/x' }
        });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('does not exist');
    });

    it('fails a sub-epic branch cut from the umbrella that targets staging', () => {
        // Arrange
        const cwd = sandbox.clone;
        createUmbrellaWithWork();
        git({ cwd, args: ['checkout', '-q', '-b', 'feat/HOS-1355-unit', UMBRELLA] });
        commit({ cwd, file: 'unit.txt' });
        push({ cwd, branch: 'feat/HOS-1355-unit' });
        checkoutPrMerge({ cwd, head: 'feat/HOS-1355-unit', base: 'staging' });

        // Act
        const result = runGuard({
            cwd,
            env: { GITHUB_BASE_REF: 'staging', GITHUB_HEAD_REF: 'feat/HOS-1355-unit' }
        });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('FAIL (DEC-ARCH-007)');
    });

    it('fails a sub-epic branch that targets main', () => {
        // Arrange
        const cwd = sandbox.clone;
        createUmbrellaWithWork();
        git({ cwd, args: ['checkout', '-q', '-b', 'feat/unit-main', UMBRELLA] });
        commit({ cwd, file: 'unit.txt' });
        push({ cwd, branch: 'feat/unit-main' });
        checkoutPrMerge({ cwd, head: 'feat/unit-main', base: 'main' });

        // Act
        const result = runGuard({
            cwd,
            env: { GITHUB_BASE_REF: 'main', GITHUB_HEAD_REF: 'feat/unit-main' }
        });

        // Assert
        expect(result.exitCode).toBe(1);
    });

    it('fails a branch cut from an OLDER umbrella commit (tip moved on since)', () => {
        // Arrange
        const cwd = sandbox.clone;
        createUmbrellaWithWork();
        git({ cwd, args: ['checkout', '-q', '-b', 'feat/old-cut', UMBRELLA] });
        commit({ cwd, file: 'old-cut.txt' });
        push({ cwd, branch: 'feat/old-cut' });
        git({ cwd, args: ['checkout', '-q', UMBRELLA] });
        commit({ cwd, file: 'umbrella-2.txt' });
        push({ cwd, branch: UMBRELLA });
        checkoutPrMerge({ cwd, head: 'feat/old-cut', base: 'staging' });

        // Act
        const result = runGuard({
            cwd,
            env: { GITHUB_BASE_REF: 'staging', GITHUB_HEAD_REF: 'feat/old-cut' }
        });

        // Assert
        expect(result.exitCode).toBe(1);
    });

    it('fails a renamed branch: the predicate is ancestry, not the name', () => {
        // Arrange
        const cwd = sandbox.clone;
        createUmbrellaWithWork();
        git({ cwd, args: ['checkout', '-q', '-b', 'fix/innocent-looking', UMBRELLA] });
        push({ cwd, branch: 'fix/innocent-looking' });
        checkoutPrMerge({ cwd, head: 'fix/innocent-looking', base: 'staging' });

        // Act
        const result = runGuard({
            cwd,
            env: { GITHUB_BASE_REF: 'staging', GITHUB_HEAD_REF: 'fix/innocent-looking' }
        });

        // Assert
        expect(result.exitCode).toBe(1);
    });

    it('passes the umbrella its own PR to staging', () => {
        // Arrange
        const cwd = sandbox.clone;
        createUmbrellaWithWork();
        checkoutPrMerge({ cwd, head: UMBRELLA, base: 'staging' });

        // Act
        const result = runGuard({
            cwd,
            env: { GITHUB_BASE_REF: 'staging', GITHUB_HEAD_REF: UMBRELLA }
        });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('is the umbrella itself');
    });

    it('passes a sub-epic PR whose target is the umbrella', () => {
        // Arrange
        const cwd = sandbox.clone;
        createUmbrellaWithWork();
        git({ cwd, args: ['checkout', '-q', '-b', 'feat/unit-ok', UMBRELLA] });
        commit({ cwd, file: 'unit.txt' });
        push({ cwd, branch: 'feat/unit-ok' });
        checkoutPrMerge({ cwd, head: 'feat/unit-ok', base: UMBRELLA });

        // Act
        const result = runGuard({
            cwd,
            env: { GITHUB_BASE_REF: UMBRELLA, GITHUB_HEAD_REF: 'feat/unit-ok' }
        });

        // Assert
        expect(result.exitCode).toBe(0);
    });

    it('passes a normal staging branch while the umbrella has work of its own', () => {
        // Arrange
        const cwd = sandbox.clone;
        createUmbrellaWithWork();
        git({ cwd, args: ['checkout', '-q', '-b', 'feat/normal', 'staging'] });
        commit({ cwd, file: 'normal.txt' });
        push({ cwd, branch: 'feat/normal' });
        checkoutPrMerge({ cwd, head: 'feat/normal', base: 'staging' });

        // Act
        const result = runGuard({
            cwd,
            env: { GITHUB_BASE_REF: 'staging', GITHUB_HEAD_REF: 'feat/normal' }
        });

        // Assert
        expect(result.exitCode).toBe(0);
    });

    it('passes a normal staging branch when the umbrella tip IS the staging tip', () => {
        // Arrange — the day the umbrella is created: no commits of its own.
        // A tip-ancestry predicate fails every PR to staging here.
        const cwd = sandbox.clone;
        git({ cwd, args: ['checkout', '-q', '-b', UMBRELLA, 'staging'] });
        push({ cwd, branch: UMBRELLA });
        git({ cwd, args: ['checkout', '-q', '-b', 'feat/same-day', 'staging'] });
        commit({ cwd, file: 'same-day.txt' });
        push({ cwd, branch: 'feat/same-day' });
        checkoutPrMerge({ cwd, head: 'feat/same-day', base: 'staging' });

        // Act
        const result = runGuard({
            cwd,
            env: { GITHUB_BASE_REF: 'staging', GITHUB_HEAD_REF: 'feat/same-day' }
        });

        // Assert
        expect(result.exitCode).toBe(0);
    });

    it('passes normal branches after the umbrella has landed in staging', () => {
        // Arrange
        const cwd = sandbox.clone;
        createUmbrellaWithWork();
        git({ cwd, args: ['checkout', '-q', 'staging'] });
        git({ cwd, args: ['merge', '-q', '--no-ff', '--no-edit', UMBRELLA] });
        push({ cwd, branch: 'staging' });
        git({ cwd, args: ['checkout', '-q', '-b', 'feat/after', 'staging'] });
        commit({ cwd, file: 'after.txt' });
        push({ cwd, branch: 'feat/after' });
        checkoutPrMerge({ cwd, head: 'feat/after', base: 'staging' });

        // Act
        const result = runGuard({
            cwd,
            env: { GITHUB_BASE_REF: 'staging', GITHUB_HEAD_REF: 'feat/after' }
        });

        // Assert
        expect(result.exitCode).toBe(0);
    });

    it('fetches the umbrella when it exists on the remote but not locally', () => {
        // Arrange
        const cwd = sandbox.clone;
        createUmbrellaWithWork();
        git({ cwd, args: ['checkout', '-q', '-b', 'feat/unfetched', UMBRELLA] });
        commit({ cwd, file: 'unfetched.txt' });
        push({ cwd, branch: 'feat/unfetched' });
        checkoutPrMerge({ cwd, head: 'feat/unfetched', base: 'staging' });
        git({ cwd, args: ['update-ref', '-d', `refs/remotes/origin/${UMBRELLA}`] });

        // Act
        const result = runGuard({
            cwd,
            env: { GITHUB_BASE_REF: 'staging', GITHUB_HEAD_REF: 'feat/unfetched' }
        });

        // Assert
        expect(result.exitCode).toBe(1);
    });

    it('skips when there is no protected target (push or local run)', () => {
        // Arrange
        const cwd = sandbox.clone;
        createUmbrellaWithWork();

        // Act
        const result = runGuard({ cwd, env: { GITHUB_BASE_REF: '', GITHUB_HEAD_REF: '' } });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('nothing to check');
    });
});
