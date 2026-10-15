import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../../../../..');
const files = [
    join(
        root,
        'packages/service-core/src/services/billing/reconciliation/sweep/zero-call-checks.service.ts'
    ),
    join(
        root,
        'packages/service-core/src/services/billing/reconciliation/sweep/addon-without-shutdown-check.ts'
    ),
    join(root, 'packages/service-core/src/services/billing/reconciliation/sweep/zero-call-ports.ts')
];

function stripComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1');
}
function violates(text: string): boolean {
    const source = stripComments(text);
    return /from\s*['"]@repo\/payments['"]|\b(?:readAuthorization|readCharge|searchAuthorizations|PaymentProvider)\b|\bports\.provider\b/.test(
        source
    );
}

describe('TEST:B11:18 zero-call checks have no provider capability', () => {
    it('keeps provider imports and methods out of both modules', () => {
        for (const file of files) expect(violates(readFileSync(file, 'utf8'))).toBe(false);
    });

    it('rejects an injected provider method while ignoring comments', () => {
        expect(violates('const note = "readAuthorization";')).toBe(true);
        expect(violates('// readAuthorization\nconst safe = true;')).toBe(false);
    });
});
