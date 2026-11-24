import { Text } from '@react-email/components';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    buildPreviewOutboxRow,
    defineEmailCatalogEntry,
    defineNotificationEntry,
    defineOutboxEntry,
    type EmailCatalogRenderDeps,
    EmailCatalogScenarioNotFoundError
} from '../../src/catalog/index';
import { NotificationType, type PartnerRevokedPayload } from '../../src/types/notification.types';

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
            audience: 'user',
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
        expect(entry.scenarios).toEqual([{ id: 'one', label: 'Uno', locale: 'es' }]);
    });

    it('rejects duplicate scenario ids at definition time', () => {
        expect(() =>
            defineEmailCatalogEntry<null>({
                sendPath: 'auth',
                id: 'dup',
                name: 'Duplicado',
                domain: 'auth',
                audience: 'user',
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

    it('resolves a scenario locale, defaulting to es (HOS-2565 D14)', () => {
        // Act
        const entry = defineEmailCatalogEntry<{ readonly locale?: 'es' | 'pt' }>({
            sendPath: 'auth',
            id: 'locales',
            name: 'Idiomas',
            domain: 'auth',
            audience: 'user',
            scenarios: [
                { id: 'implicit', label: 'Implícito', input: {} },
                { id: 'portuguese', label: 'Portugués', locale: 'pt', input: { locale: 'pt' } }
            ],
            render: () => ({ subject: 'x', react: createElement(Text, null, 'x'), warnings: [] })
        });

        // Assert
        expect(entry.scenarios.map(({ id, locale }) => [id, locale])).toEqual([
            ['implicit', 'es'],
            ['portuguese', 'pt']
        ]);
    });

    it.each([
        ['at the top level', { locale: 'en' }],
        ['inside the payload', { payload: { locale: 'en' } }]
    ])('rejects a scenario whose input carries a locale it does not declare, %s (AC-3.2)', (_where, input) => {
        expect(() =>
            defineEmailCatalogEntry<Record<string, unknown>>({
                sendPath: 'auth',
                id: 'liar',
                name: 'Mentiroso',
                domain: 'auth',
                audience: 'user',
                scenarios: [{ id: 'english', label: 'Inglés', input }],
                render: () => ({
                    subject: 'x',
                    react: createElement(Text, null, 'x'),
                    warnings: []
                })
            })
        ).toThrow('carries locale "en" but declares "es"');
    });

    it('accepts a scenario that declares the locale its input carries', () => {
        expect(() =>
            defineEmailCatalogEntry<Record<string, unknown>>({
                sendPath: 'auth',
                id: 'honest',
                name: 'Honesto',
                domain: 'auth',
                audience: 'user',
                scenarios: [
                    { id: 'english', label: 'Inglés', locale: 'en', input: { locale: 'en' } }
                ],
                render: () => ({
                    subject: 'x',
                    react: createElement(Text, null, 'x'),
                    warnings: []
                })
            })
        ).not.toThrow();
    });

    it('rejects an unknown scenario id on render', async () => {
        const entry = defineEmailCatalogEntry<null>({
            sendPath: 'auth',
            id: 'one',
            name: 'Uno',
            domain: 'auth',
            audience: 'user',
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
            audience: 'user',
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

describe('defineNotificationEntry', () => {
    const scenario = (type: NotificationType.PARTNER_REVOKED): PartnerRevokedPayload => ({
        type,
        recipientEmail: 'ana.ejemplo@example.com',
        recipientName: 'Ana Ejemplo',
        userId: null,
        partnerName: 'Comercio de Ejemplo',
        reason: 'Motivo de ejemplo'
    });

    it('accepts scenarios whose payload type matches the entry type', () => {
        const entry = defineNotificationEntry<PartnerRevokedPayload>({
            type: NotificationType.PARTNER_REVOKED,
            name: 'Aliado dado de baja',
            domain: 'partner',
            audience: 'user',
            scenarios: [{ id: 'a', label: 'A', input: scenario(NotificationType.PARTNER_REVOKED) }]
        });
        expect(entry.key).toBe('notification.partner_revoked');
    });

    it('rejects a scenario whose payload type differs from the entry type', () => {
        // Arrange — a scenario copy-pasted from partner_revoked under another key.
        const define = () =>
            defineNotificationEntry<PartnerRevokedPayload>({
                type: NotificationType.HOST_TRADE_REVOKED,
                name: 'Ficha dada de baja',
                domain: 'host-trade',
                audience: 'user',
                scenarios: [
                    {
                        id: 'copied',
                        label: 'Copiado',
                        input: scenario(NotificationType.PARTNER_REVOKED)
                    }
                ]
            });

        // Act & Assert
        expect(define).toThrow(
            'Scenario "copied" of email catalog entry "notification.host_trade_revoked" has payload type "partner_revoked"'
        );
    });
});
