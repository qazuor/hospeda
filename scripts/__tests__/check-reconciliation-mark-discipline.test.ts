import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    COURTESY_FILE,
    MARK_MODEL_FILE,
    REASONS_FILE,
    run,
    S14_FILE,
    S15_FILE
} from '../check-reconciliation-mark-discipline.js';

const repo = path.resolve(import.meta.dirname, '../..');
const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const reasons = [
    'REEMBOLSO_POR_CONFIRMAR',
    'COBRO_POSTERIOR_A_LA_BAJA',
    'COBRO_POSTERIOR_AL_GRANT',
    'PAGO_PENDIENTE_SIN_RAMA',
    'DIVERGENCIA_DE_MONTO',
    'TRANSICION_NO_DECLARADA',
    'PAGO_TARDIO_RECHAZADO',
    'REANUDACION_NO_APLICADA',
    'SUCESION_ABIERTA_SOBRE_FILA_MUERTA',
    'FAN_OUT_DE_GRANT_INCOMPLETO',
    'ADDON_SIN_APAGAR',
    'COBRO_DURANTE_CORTESIA',
    'CORTESIA_SIN_RE_EMITIR',
    'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA',
    'COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION',
    'CANCELACION_SIN_CONFIRMAR',
    'CONTRACARGO',
    'REEMBOLSO_FUERA_DEL_FLUJO',
    'COBRO_SIN_REGISTRAR',
    'COBRO_DUPLICADO',
    'COBRO_DEL_PERIODO_SIN_RESOLVER',
    'PAUSA_NO_APLICADA',
    'ORDEN_PAGADA_SIN_INSTANCIA',
    'IMPORTE_COBRADO_DE_MAS'
];
const closeReasons = [
    'VENTANA_DE_AUTORIZACION_VENCIDA',
    'GRANT_PERMANENTE_OTORGADO',
    'DESTINO_DE_PLAN_NO_MENSUAL',
    'CONTRACARGO_DE_LA_PREDECESORA'
];
const s14 = `export async function openReconciliationMark(input: { reason: string, payment?: unknown }) { const m = await reconciliationMarkModel.findOpen({}); if (!m) await reconciliationMarkModel.insertOpen({}); if (input.payment) await payments.hang({}); }`;
const s15 = `export async function liftReconciliationMark(input: { markId: string }) { const unresolved = await payments.countUnresolved({}); if (unresolved > 0) throw new Error(); return reconciliationMarkModel.lift({ markId: input.markId }); }`;
const base: Record<string, string> = {
    [S14_FILE]: s14,
    [S15_FILE]: s15,
    [MARK_MODEL_FILE]: `export const x = 1;`,
    [REASONS_FILE]: `export const RECONCILIATION_MARK_REASONS = [${reasons.map((x) => `'${x}'`).join(',')}] as const;`,
    [COURTESY_FILE]: `export const COURTESY_CLOSE_REASONS = [${closeReasons.map((x) => `'${x}'`).join(',')}] as const;`,
    'packages/db/src/models/subscription/subscription.model.ts': `export const x = db.update(courtesyGrants).set({ balanceClosedAt: now, closeReason: 'VENTANA_DE_AUTORIZACION_VENCIDA' satisfies CourtesyCloseReason });`,
    'packages/service-core/src/services/billing/caller.ts': `async function call() { openReconciliationMark({ reason: 'COBRO_DUPLICADO' }); }`
};
function tree(overrides: Record<string, string> = {}): string {
    const root = mkdtempSync(path.join(tmpdir(), 'gr1f-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    for (const [f, s] of Object.entries({ ...base, ...overrides })) {
        const p = path.join(root, f);
        mkdirSync(path.dirname(p), { recursive: true });
        writeFileSync(p, s);
    }
    return root;
}
function check(overrides: Record<string, string> = {}) {
    return run({ root: tree(overrides), minScannedFiles: 1 });
}

describe('TEST:B3:27 GUARD:G-R1-F', () => {
    it('is green over the real tree', () => {
        const result = run();
        expect(result.exitCode).toBe(0);
        // AC:B13a:9 (HOS-1620) declared the actionable listing, so (c) is evaluated on the real tree.
        expect(result.output).toMatch(/\(c\) [1-9]\d* listings? checked/);
        expect(result.output).toContain('mark consumers registered');
    }, 30000);
    it('is green on the minimum valid source tree', () => {
        const result = check();
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain(
            '(c) not evaluated: no ActionableReconciliationMark* declaration in the tree yet'
        );
    });
    it('mutation 1: rejects unknown and missing opening reasons (a1)', () => {
        for (const source of [
            `async function call(){openReconciliationMark({reason:'MOTIVO_INVENTADO'});}`,
            `async function call(){openReconciliationMark({});}`
        ]) {
            const r = check({ 'packages/service-core/src/services/billing/caller.ts': source });
            expect(r.output).toContain('G-R1-F (a)');
            expect(r.output).toContain('caller.ts');
        }
    });
    it('rejects a reason identifier with no local type declaration (a1)', () => {
        const r = check({
            'packages/service-core/src/services/billing/caller.ts': `async function call(){openReconciliationMark({reason: unknownReason});}`
        });
        expect(r.output).toContain('G-R1-F (a)');
        expect(r.output).toContain('caller.ts');
    });
    it('accepts catalog literals and locally typed reason values', () => {
        expect(
            check({
                'packages/service-core/src/services/billing/caller.ts': `async function call(reason: ReconciliationMarkReason){openReconciliationMark({reason});}`
            }).exitCode
        ).toBe(0);
        expect(
            check({
                'packages/service-core/src/services/billing/caller.ts': `async function call(){openReconciliationMark({reason:'COBRO_DUPLICADO'});}`
            }).exitCode
        ).toBe(0);
    });
    it('rejects insertOpen outside S14 (a2)', () => {
        const r = check({ 'packages/db/src/models/other.ts': `x.insertOpen({});` });
        expect(r.output).toContain('G-R1-F (a)');
        expect(r.output).toContain('other.ts');
    });
    it('requires a mark id and forbids subject ids on lift (b1)', () => {
        const r = check({
            'packages/service-core/src/services/billing/caller.ts': `async function x(){liftReconciliationMark({subscriptionId:'x'});}`
        });
        expect(r.output).toContain('G-R1-F (b)');
    });
    it('rejects model lift outside S15 and liftedAt writes outside model (b2,b3)', () => {
        const r = check({
            'packages/db/src/models/other.ts': `reconciliationMarkModel.lift({markId:'x'}); db.update(t).set({liftedAt: now});`
        });
        expect(r.output).toContain('G-R1-F (b)');
        expect(r.output).toContain('other.ts');
    });
    it('rejects motives 14 and 15 in one function, but permits separate functions (d)', () => {
        const src = `function same(){openReconciliationMark({reason:'${reasons[13]}'});openReconciliationMark({reason:'${reasons[14]}'});}`;
        expect(
            check({ 'packages/service-core/src/services/billing/caller.ts': src }).output
        ).toContain('G-R1-F (d)');
        const separate = `function one(){openReconciliationMark({reason:'${reasons[13]}'});} function two(){openReconciliationMark({reason:'${reasons[14]}'});}`;
        expect(
            check({ 'packages/service-core/src/services/billing/caller.ts': separate }).exitCode
        ).toBe(0);
    });
    it('requires S14 findOpen before insertOpen and payment hang under the payment if (e1,e2)', () => {
        for (const source of [
            s14.replace('const m = await reconciliationMarkModel.findOpen({});', ''),
            s14.replace('if (input.payment) await payments.hang({});', '')
        ]) {
            const r = check({ [S14_FILE]: source });
            expect(r.output).toContain('G-R1-F (e)');
            expect(r.output).toContain(S14_FILE);
        }
    });
    it('rejects hang outside S14 (e3)', () => {
        const r = check({
            'packages/service-core/src/services/billing/other.ts': `payments.hang({});`
        });
        expect(r.output).toContain('G-R1-F (e)');
        expect(r.output).toContain('other.ts');
    });
    it('requires countUnresolved and throwing positive-count check before lift (f)', () => {
        for (const source of [
            s15.replace('const unresolved = await payments.countUnresolved({});', ''),
            s15.replace('if (unresolved > 0)', 'if (unresolved > 0 || true)'),
            s15.replace('throw new Error();', 'void 0;'),
            s15.replace(
                'const unresolved = await payments.countUnresolved({}); if (unresolved > 0) throw new Error(); return reconciliationMarkModel.lift({ markId: input.markId });',
                'const result = await reconciliationMarkModel.lift({ markId: input.markId }); const unresolved = await payments.countUnresolved({}); if (unresolved > 0) throw new Error(); return result;'
            )
        ]) {
            const r = check({ [S15_FILE]: source });
            expect(r.output).toContain('G-R1-F (f)');
            expect(r.output).toContain(S15_FILE);
        }
    });
    it('mutation 2: requires both close columns and a catalog close reason (h)', () => {
        for (const value of [
            `{balanceClosedAt: now}`,
            `{closeReason:'VENTANA_DE_AUTORIZACION_VENCIDA'}`,
            `{balanceClosedAt: now, closeReason:'OTRO_ACTO'}`
        ]) {
            const r = check({
                'packages/db/src/models/subscription/subscription.model.ts': `db.update(courtesyGrants).set(${value});`
            });
            expect(r.output).toContain('G-R1-F (h)');
            expect(r.output).toContain('subscription.model.ts');
        }
        expect(
            check({
                'packages/db/src/models/subscription/subscription.model.ts': `db.update(courtesyGrants).set({balanceClosedAt:null, closeReason:null});`
            }).exitCode
        ).toBe(0);
    });
    it('fails when either catalog cannot be read', () => {
        const r = check({ [REASONS_FILE]: `export const RECONCILIATION_MARK_REASONS=[];` });
        expect(r.output).toContain('G-R1-F (a)');
        expect(r.output).toContain(REASONS_FILE);
    });
    it('ignores test-only copies of invalid code', () =>
        expect(
            check({
                'packages/service-core/src/test/example.test.ts': `openReconciliationMark({});`
            }).exitCode
        ).toBe(0));
});

describe('G-R1-F is plugged into the guards job', () => {
    it('wires the package script, guards chain before fake-lies, and own guards-job step', async () => {
        const fs = await import('node:fs');
        const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')) as {
            scripts: Record<string, string>;
        };
        expect(pkg.scripts['check:reconciliation-mark-discipline']).toBe(
            'tsx scripts/check-reconciliation-mark-discipline.ts'
        );
        const chain = pkg.scripts['check:guards'];
        expect(chain).toContain('pnpm check:reconciliation-mark-discipline');
        expect(chain.indexOf('pnpm check:reconciliation-mark-discipline')).toBeLessThan(
            chain.indexOf('pnpm check:fake-lies')
        );
        const ci = fs.readFileSync(path.join(repo, '.github/workflows/ci.yml'), 'utf8');
        const lines = ci.split('\n');
        const at = lines.findIndex((x) => x.trim() === 'guards:');
        const end = lines.findIndex((x, i) => i > at && /^ {2}[\w-]+:/.test(x));
        const block = lines.slice(at + 1, end < 0 ? undefined : end).join('\n');
        expect(block).toContain('Check reconciliation mark discipline (GUARD:G-R1-F)');
        expect(block).toContain('run: pnpm check:reconciliation-mark-discipline');
    });
});
