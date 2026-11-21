import { Text } from '@react-email/components';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    buildPreviewOutboxRow,
    defineEmailCatalogEntry,
    defineOutboxEntry,
    type EmailCatalogRenderDeps,
    EmailCatalogScenarioNotFoundError
} from '../../src/catalog/index';

const deps = (
    outboxRenderer: EmailCatalogRenderDeps['outboxRenderer']
): EmailCatalogRenderDeps => ({
    siteUrl: 'https://hospeda.com.ar',
    outboxRenderer
});

describe('defineEmailCatalogEntry', () => {
    it('builds the key from the send path and id and defaults wired to true', () => {
        // Act
        const entry = defineEmailCatalogEntry<{ readonly word: string }>({
            sendPath: 'auth',
            id: 'sample',
            name: 'Ejemplo',
            domain: 'auth',
            scenarios: [{ id: 'one', label: 'Uno', input: { word: 'hola' } }],
            render: ({ scenario }) => ({
                subject: scenario.word,
                react: createElement(Text, null, scenario.word),
                warnings: []
            })
        });

        // Assert
        expect(entry.key).toBe('auth.sample');
        expect(entry.wired).toBe(true);
        expect(entry.scenarios).toEqual([{ id: 'one', label: 'Uno' }]);
    });

    it('rejects duplicate scenario ids at definition time', () => {
        expect(() =>
            defineEmailCatalogEntry<null>({
                sendPath: 'auth',
                id: 'dup',
                name: 'Duplicado',
                domain: 'auth',
                scenarios: [
                    { id: 'same', label: 'A', input: null },
                    { id: 'same', label: 'B', input: null }
                ],
                render: () => ({
                    subject: 'x',
                    react: createElement(Text, null, 'x'),
                    warnings: []
                })
            })
        ).toThrow('Duplicate scenario id "same" in email catalog entry "auth.dup"');
    });

    it('rejects an unknown scenario id on render', async () => {
        const entry = defineEmailCatalogEntry<null>({
            sendPath: 'auth',
            id: 'one',
            name: 'Uno',
            domain: 'auth',
            scenarios: [{ id: 'a', label: 'A', input: null }],
            render: () => ({ subject: 'x', react: createElement(Text, null, 'x'), warnings: [] })
        });
        await expect(
            entry.renderScenario({ scenarioId: 'b', deps: deps(vi.fn()) })
        ).rejects.toBeInstanceOf(EmailCatalogScenarioNotFoundError);
    });
});

describe('defineOutboxEntry', () => {
    it('hands the injected outbox renderer a synthetic row with the template and payload', async () => {
        // Arrange
        const renderer = vi.fn(() => ({
            subject: 'Asunto',
            react: createElement(Text, null, 'cuerpo')
        }));
        const entry = defineOutboxEntry({
            template: 'billing.sample',
            name: 'Ejemplo',
            domain: 'billing',
            scenarios: [
                {
                    id: 'a',
                    label: 'A',
                    input: {
                        payload: { planName: 'Plan Profesional' },
                        row: { recipientEmail: 'otra@example.com' }
                    }
                }
            ]
        });

        // Act
        const result = await entry.renderScenario({ scenarioId: 'a', deps: deps(renderer) });

        // Assert
        expect(entry.key).toBe('outbox.billing.sample');
        expect(result).toMatchObject({ subject: 'Asunto', warnings: [] });
        const row = renderer.mock.calls[0]?.[0]?.row;
        expect(row?.template).toBe('billing.sample');
        expect(row?.payload).toEqual({ planName: 'Plan Profesional' });
        expect(row?.recipientEmail).toBe('otra@example.com');
    });
});

describe('buildPreviewOutboxRow', () => {
    it('never lets overrides replace the template or the payload', () => {
        const row = buildPreviewOutboxRow({
            template: 'billing.sample',
            payload: { a: 1 },
            overrides: { attempts: 2 }
        });
        expect(row).toMatchObject({
            template: 'billing.sample',
            payload: { a: 1 },
            attempts: 2,
            status: 'pending'
        });
        expect(row.recipientEmail).toMatch(/@example\.com$/);
    });
});
