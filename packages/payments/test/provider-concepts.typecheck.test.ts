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
    // Re-states the check in the fixture itself, so a concept leaked into the
    // real interface surfaces as a diagnostic of THIS file, not only of src.
    clean: `${HEADER}
export type Shipped = PaymentProviderNamesNoProviderConcept;
export type Check = AssertNoProviderConcept<ProviderConceptsIn<PaymentProvider>>;
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
const FIXTURE_NAMES = Object.keys(FIXTURES) as FixtureName[];
const diagnosticsByFixture = new Map<FixtureName, readonly string[]>();

beforeAll(() => {
    // Arrange: one program over every fixture, with the package's own options.
    fixtureDir = mkdtempSync(join(tmpdir(), 'payments-concepts-'));
    const files = new Map<FixtureName, string>();
    for (const name of FIXTURE_NAMES) {
        const file = join(fixtureDir, `${name}.ts`);
        writeFileSync(file, FIXTURES[name]);
        files.set(name, file);
    }
    const config = ts.getParsedCommandLineOfConfigFile(
        join(PACKAGE_ROOT, 'tsconfig.json'),
        {},
        { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined }
    );
    if (!config) throw new Error('cannot read packages/payments/tsconfig.json');
    const program = ts.createProgram({
        rootNames: [...files.values()],
        options: { ...config.options, noEmit: true, types: [] }
    });

    // Act
    for (const [name, file] of files) {
        const source = program.getSourceFile(file);
        if (!source) throw new Error(`fixture ${name} was not compiled`);
        const diagnostics = ts.getPreEmitDiagnostics(program, source);
        diagnosticsByFixture.set(
            name,
            diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
        );
    }
}, 60_000);

/** The diagnostics of one fixture; a fixture that was never compiled fails here. */
function diagnosticsOf({ fixture }: { readonly fixture: FixtureName }): readonly string[] {
    const messages = diagnosticsByFixture.get(fixture);
    if (!messages) throw new Error(`no diagnostics recorded for ${fixture}`);
    return messages;
}

afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
});

describe('the provider-concept type check', () => {
    it('compiles the real interface clean', () => {
        expect(diagnosticsOf({ fixture: 'clean' })).toEqual([]);
    });

    it.each([
        ['a method name', 'leakedMethod', 'createPreapproval'],
        ['a field of a resolved result', 'leakedResultField', 'init_point'],
        ['a literal of a status union', 'leakedStatusLiteral', 'mercadopagoPaused']
    ] as const)('fails when the interface leaks a concept in %s', (_where, fixture, leaked) => {
        // Assert
        const messages = diagnosticsOf({ fixture });
        expect(messages.length).toBeGreaterThan(0);
        expect(messages.join('\n')).toContain(leaked);
    });
});
