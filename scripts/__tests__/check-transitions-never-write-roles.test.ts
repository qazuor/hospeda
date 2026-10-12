import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-transitions-never-write-roles';
import { CATALOG_PATH, CORPUS_PATH, type TransitionCorpus } from '../transition-corpus';

const ROOT = path.resolve(import.meta.dirname, '../..');
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tempTree(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g4-'));
    dirs.push(root);
    for (const file of [CORPUS_PATH, CATALOG_PATH]) {
        const target = path.join(root, file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, readFileSync(path.join(ROOT, file), 'utf8'));
    }
    return root;
}
function readCorpus(root: string): TransitionCorpus {
    return JSON.parse(readFileSync(path.join(root, CORPUS_PATH), 'utf8')) as TransitionCorpus;
}
function saveCorpus(root: string, corpus: TransitionCorpus): void {
    writeFileSync(path.join(root, CORPUS_PATH), JSON.stringify(corpus, null, 2));
}
function addWrite(root: string, id: string, column: string): void {
    const corpus = readCorpus(root);
    const row = corpus.transitions.find((item) => item.id === id);
    if (!row) throw new Error(`Missing transition ${id}`);
    (row.writes as string[]).push(column);
    saveCorpus(root, corpus);
}
function addEffectText(root: string, id: string, text: string): void {
    const catalogPath = path.join(root, CATALOG_PATH);
    const source = readFileSync(catalogPath, 'utf8');
    const heading = `### \`${id}\``;
    const start = source.indexOf(heading);
    if (start < 0) throw new Error(`Missing catalog transition ${id}`);
    const next = source.indexOf('\n### `TRANS:', start + heading.length);
    const end = next < 0 ? source.length : next;
    const block = source.slice(start, end);
    const updated = block.replace(/(- \*\*efectos\*\*[^\n]*)(\n|$)/, `$1${text}$2`);
    if (updated === block) throw new Error(`Missing effects bullet for ${id}`);
    writeFileSync(catalogPath, `${source.slice(0, start)}${updated}${source.slice(end)}`);
}

describe('TEST:V5:23 - G4: a subscription or trial transition that writes roles', () => {
    it('checks the real corpus and catalog rows', () => {
        const result = run({ root: ROOT });
        expect(result.exitCode).toBe(0);
        expect(result.output).toMatch(/OK GUARD:G4: (?:4[1-9]|[5-9]\d|\d{3,}) transitions/);
    });
    it('detects the specified structured trial write', () => {
        const root = tempTree();
        addWrite(root, 'TRANS:V:T3', 'user_role.role');
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('structured');
        expect(result.output).toContain('TRANS:V:T3');
        expect(result.output).toContain('user_role.role');
    });
    it.each([
        ['TRANS:V:T5', 'role_permission.permission'],
        ['TRANS:B:S12', 'user_role_audit.action'],
        ['TRANS:B:S6', 'users.role'],
        ['TRANS:B:S11', 'user.roles']
    ])('detects role write %s %s', (id, column) => {
        const root = tempTree();
        addWrite(root, id, column);
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('structured');
        expect(result.output).toContain(id);
        expect(result.output).toContain(column);
    });
    it.each([
        ['TRANS:V:T3', ' y le revoca el rol `HOST` al dueño.'],
        ['TRANS:B:S16', ' y actualiza sus roles.']
    ])('detects role wording in catalog effects for %s', (id, text) => {
        const root = tempTree();
        addEffectText(root, id, text);
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('catalog prose');
        expect(result.output).toContain(id);
    });
    it('ignores writes outside the scoped role tables and unrelated prose', () => {
        const root = tempTree();
        addWrite(root, 'TRANS:V:PB5', 'user_role.role');
        addWrite(root, 'TRANS:V:T3', 'user_permission.permission');
        addEffectText(root, 'TRANS:V:T3', ' y puede controlar el acceso a su cuenta.');
        const result = run({ root });
        expect(result.exitCode).toBe(0);
    });
    it('fails closed when a required machine is missing', () => {
        const root = tempTree();
        const corpus = readCorpus(root);
        delete (corpus.machines as Record<string, unknown>).subscription;
        saveCorpus(root, corpus);
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('machine is undeclared');
    });
    it('fails closed when the catalog cannot be loaded', () => {
        const result = run({ root: tempTree(), catalogPath: 'missing-catalog.md' });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('cannot load');
    });
    it('is wired into check:guards and the guards CI job', () => {
        const scripts = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
            .scripts as Record<string, string>;
        expect(scripts['check:transitions-never-write-roles']).toBe(
            'tsx scripts/check-transitions-never-write-roles.ts'
        );
        expect(scripts['check:guards']).toContain('pnpm check:transitions-never-write-roles');
        expect(scripts['check:guards'].trim().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
        const guardsJob = ci.split('\n  guards:\n')[1]?.split(/\n {2}[a-zA-Z][\w-]*:\n/)[0];
        expect(guardsJob).toContain(
            'name: Check no subscription or trial transition writes roles (GUARD:G4)'
        );
        expect(guardsJob).toContain('run: pnpm check:transitions-never-write-roles');
    });
});
