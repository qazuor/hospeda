/**
 * TEST:B1:1 (AC:B1:1), compile-time half: "a type check fails if the
 * interface names a provider concept".
 *
 * The check is a type (`PaymentProviderNamesNoProviderConcept`), so proving it
 * means compiling. This test runs the TypeScript compiler over small fixtures:
 * the real interface must compile clean, and an interface that leaks a provider
 * concept (in a method name, in a field of a result, in a literal of a status
 * union) must NOT compile, with the error naming the leaked name.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PACKAGE_ROOT = resolve(import.meta.dirname, '..');
const PROVIDER_DIR = join(PACKAGE_ROOT, 'src/provider');

const HEADER = `import type { AssertNoProviderConcept, PaymentProviderNamesNoProviderConcept, ProviderConceptsIn } from '${PROVIDER_DIR}/provider-concepts';
import type { AuthorizeInput, AuthorizeResult, AuthorizationSnapshot, PaymentProvider } from '${PROVIDER_DIR}/payment-provider';
`;

const FIXTURES = {
    clean: `${HEADER}
export type Check = PaymentProviderNamesNoProviderConcept;
`,
    leakedMethod: `${HEADER}
interface Leaky extends PaymentProvider {
    createPreapproval(input: AuthorizeInput): Promise<AuthorizeResult>;
}
export type Check = AssertNoProviderConcept<ProviderConceptsIn<Leaky>>;
`,
    leakedResultField: `${HEADER}
interface Leaky extends Omit<PaymentProvider, 'authorize'> {
    authorize(input: AuthorizeInput): Promise<AuthorizeResult & { readonly init_point: string }>;
}
export type Check = AssertNoProviderConcept<ProviderConceptsIn<Leaky>>;
`,
    leakedStatusLiteral: `${HEADER}
interface Leaky extends Omit<PaymentProvider, 'readAuthorization'> {
    readAuthorization(input: { readonly authorizationId: string }): Promise<
        Omit<AuthorizationSnapshot, 'status'> & { readonly status: 'active' | 'mercadopagoPaused' }
    >;
}
export type Check = AssertNoProviderConcept<ProviderConceptsIn<Leaky>>;
`
} as const;

type FixtureName = keyof typeof FIXTURES;

let fixtureDir = '';
let diagnosticsByFixture: Record<FixtureName, readonly string[]>;

beforeAll(() => {
    // Arrange: one program over every fixture, with the package's own options.
    fixtureDir = mkdtempSync(join(tmpdir(), 'payments-concepts-'));
    const files = Object.fromEntries(
        Object.entries(FIXTURES).map(([name, source]) => {
            const file = join(fixtureDir, `${name}.ts`);
            writeFileSync(file, source);
            return [name, file];
        })
    ) as Record<FixtureName, string>;
    const config = ts.getParsedCommandLineOfConfigFile(
        join(PACKAGE_ROOT, 'tsconfig.json'),
        {},
        { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined }
    );
    if (!config) throw new Error('cannot read packages/payments/tsconfig.json');
    const program = ts.createProgram({
        rootNames: Object.values(files),
        options: { ...config.options, noEmit: true, types: [] }
    });

    // Act
    diagnosticsByFixture = Object.fromEntries(
        Object.entries(files).map(([name, file]) => {
            const source = program.getSourceFile(file);
            const diagnostics = source ? ts.getPreEmitDiagnostics(program, source) : [];
            return [
                name,
                diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
            ];
        })
    ) as Record<FixtureName, readonly string[]>;
}, 60_000);

afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
});

describe('the provider-concept type check', () => {
    it('compiles the real interface clean', () => {
        expect(diagnosticsByFixture.clean).toEqual([]);
    });

    it.each([
        ['a method name', 'leakedMethod', 'createPreapproval'],
        ['a field of a resolved result', 'leakedResultField', 'init_point'],
        ['a literal of a status union', 'leakedStatusLiteral', 'mercadopagoPaused']
    ] as const)('fails when the interface leaks a concept in %s', (_where, fixture, leaked) => {
        // Assert
        const messages = diagnosticsByFixture[fixture];
        expect(messages.length).toBeGreaterThan(0);
        expect(messages.join('\n')).toContain(leaked);
    });
});
