import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_SRC = join(import.meta.dirname, '../../src');

function files(dir: string, prefix = ''): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) return files(join(dir, entry.name), relative);
        return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [relative] : [];
    });
}

function withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function rows(root: string) {
    return files(root).map((file) => ({
        file,
        text: withoutComments(readFileSync(join(root, file), 'utf8'))
    }));
}

const apiRows = rows(API_SRC);
const mentions = (text: string, name: string) => new RegExp(`\\b${name}\\b`).test(text);
const requestsPlanChange = apiRows.some(
    ({ text }) => mentions(text, 'requestPlanChange') || mentions(text, 'request-plan-change')
);
const webhookPorts = readFileSync(join(API_SRC, 'routes/webhooks/mercadopago-ports.ts'), 'utf8');

const missingWiring = [
    ...(webhookPorts.includes('unimplementedSuccessionCloser') ||
    !apiRows.some(({ text }) => mentions(text, 'createSuccessionCloser'))
        ? [
              'B1: webhook still mentions unimplementedSuccessionCloser or API has no createSuccessionCloser reference'
          ]
        : []),
    ...(apiRows.some(({ text }) => mentions(text, 'cancelSuccessionPredecessor'))
        ? []
        : ['B2: API has no cancelSuccessionPredecessor reference']),
    ...(apiRows.some(
        ({ file, text }) =>
            file.startsWith('cron/') && mentions(text, 'reevaluateSuccessionPredecessors')
    )
        ? []
        : ['B3: cron has no reevaluateSuccessionPredecessors reference'])
];

describe('HOS-1579 AC:B8b:8 / AC:B8b:24 plan change route wiring', () => {
    it('requires all succession wiring before API source references requestPlanChange', () => {
        expect(
            !requestsPlanChange || missingWiring.length === 0,
            `HOS-1579 AC:B8b:8 / AC:B8b:24: ${missingWiring.join('; ')}`
        ).toBe(true);
    });

    it('keeps the plan change route in HOS-1579 (owner Q3)', () => {
        expect(
            requestsPlanChange,
            'la ruta de cambio de plan es de HOS-1579 (owner Q3); si la estás agregando, este test y el guard se actualizan en ese PR'
        ).toBe(false);
    });
});
