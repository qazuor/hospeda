/**
 * @file whats-new.test.ts
 *
 * Tests for the curated What's New data file (SPEC-175 T-004, HOS-964).
 *
 * Validates that:
 * - The module imports without throwing (empty catalog is valid).
 * - An invalid fixture (missing required `es` title) fails WhatsNewCatalogSchema.parse.
 * - HOS-964: the real, non-empty catalog is fully translated (es/en/pt) and its
 *   audience targeting actually reaches (and only reaches) the intended roles.
 *
 * @see SPEC-175 §6.3, AC-16
 */
import { WhatsNewEntrySchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { whatsNewEntries } from '../../../src/data/whats-new/whats-new';
import { filterEntriesByRole } from '../../../src/utils/whats-new/whats-new.helpers';

const WhatsNewCatalogSchema = z.array(WhatsNewEntrySchema).min(0);

describe('whats-new data file', () => {
    describe('module import', () => {
        it('should import whatsNewEntries without throwing', () => {
            // Assert — if the import above failed, the test file would not have loaded
            expect(whatsNewEntries).toBeDefined();
            expect(Array.isArray(whatsNewEntries)).toBe(true);
        });

        it('should export an array (empty catalog is valid)', () => {
            // Assert
            expect(whatsNewEntries.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('WhatsNewCatalogSchema validation', () => {
        it('should accept an empty array', () => {
            // Arrange & Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([])).not.toThrow();
        });

        it('should accept a valid entry', () => {
            // Arrange
            const validEntry = {
                id: '2026-05-29-test-feature',
                publishedAt: '2026-05-29T00:00:00Z',
                highlight: true,
                title: { es: 'Nueva funcionalidad', en: 'New feature' },
                body: { es: 'Descripción de la funcionalidad.' }
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([validEntry])).not.toThrow();
        });

        it('should reject an entry with missing required `es` title', () => {
            // Arrange — missing `es` in title (only has `en`)
            const invalidEntry = {
                id: '2026-05-01-bad-entry',
                publishedAt: '2026-05-01T00:00:00Z',
                highlight: false,
                title: { en: 'Title only in English' },
                body: { es: 'Cuerpo válido' }
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([invalidEntry])).toThrow();
        });

        it('should reject an entry with missing required `es` body', () => {
            // Arrange — body has no `es`
            const invalidEntry = {
                id: '2026-05-02-bad-body',
                publishedAt: '2026-05-02T00:00:00Z',
                highlight: false,
                title: { es: 'Título válido' },
                body: { en: 'Body only in English' }
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([invalidEntry])).toThrow();
        });

        it('should reject an entry with an invalid publishedAt (not ISO datetime)', () => {
            // Arrange
            const invalidEntry = {
                id: '2026-05-03-bad-date',
                publishedAt: 'not-a-date',
                highlight: false,
                title: { es: 'Título' },
                body: { es: 'Cuerpo' }
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([invalidEntry])).toThrow();
        });

        it('should reject an entry with a non-kebab-case id', () => {
            // Arrange — id with uppercase letters
            const invalidEntry = {
                id: 'Entry_With_Underscores',
                publishedAt: '2026-05-04T00:00:00Z',
                highlight: false,
                title: { es: 'Título' },
                body: { es: 'Cuerpo' }
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([invalidEntry])).toThrow();
        });

        it('should reject an entry with an unknown role value', () => {
            // Arrange
            const invalidEntry = {
                id: '2026-05-05-bad-role',
                publishedAt: '2026-05-05T00:00:00Z',
                highlight: false,
                title: { es: 'Título' },
                body: { es: 'Cuerpo' },
                roles: ['UNKNOWN_ROLE']
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([invalidEntry])).toThrow();
        });

        it('should accept an entry with an absent roles field (universal broadcast)', () => {
            // Arrange
            const entry = {
                id: '2026-05-06-no-roles',
                publishedAt: '2026-05-06T00:00:00Z',
                highlight: false,
                title: { es: 'Para todos' },
                body: { es: 'Visible para todos los roles.' }
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([entry])).not.toThrow();
        });
    });

    // -------------------------------------------------------------------------
    // HOS-964 — the real catalog is non-empty, fully translated, and its
    // audience targeting actually routes to the intended roles.
    // -------------------------------------------------------------------------

    describe('the real curated catalog (HOS-964)', () => {
        it('is no longer empty', () => {
            // The catalog was shipped empty (HOS-964's root cause): the whole
            // What's New mechanism worked, but there was nothing to show.
            expect(whatsNewEntries.length).toBeGreaterThan(0);
        });

        it('has between 3 and 5 entries as agreed for the initial HOS-964 batch', () => {
            expect(whatsNewEntries.length).toBeGreaterThanOrEqual(3);
            expect(whatsNewEntries.length).toBeLessThanOrEqual(5);
        });

        // ── The mandatory regression guard: every entry must carry all three
        // locales for both title and body. A single-locale entry is exactly the
        // HOS-908 defect (a Spanish-only entry silently reaching en/pt users as
        // Spanish). This asserts against the DATA, not the source text, so it
        // still fails no matter how an untranslated entry gets in.
        it('has es, en AND pt for every entry title and body (no untranslated entries)', () => {
            const missing: string[] = [];

            for (const entry of whatsNewEntries) {
                for (const field of ['title', 'body'] as const) {
                    for (const locale of ['es', 'en', 'pt'] as const) {
                        const value = entry[field][locale];
                        if (!value || value.trim().length === 0) {
                            missing.push(`entry '${entry.id}': ${field}.${locale} is missing`);
                        }
                    }
                }
            }

            expect(missing, `Untranslated fields found:\n${missing.join('\n')}`).toHaveLength(0);
        });

        it('has a unique id per entry (no accidental duplicate/reused id)', () => {
            const ids = whatsNewEntries.map((entry) => entry.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('only targets audience roles that exist in WhatsNewAudienceRoleSchema', () => {
            // Redundant with WhatsNewCatalogSchema.parse (which already ran at
            // import time), but pins the intent explicitly against the real data.
            const knownRoles = new Set([
                'HOST',
                'EDITOR',
                'ADMIN',
                'SUPER_ADMIN',
                'CLIENT_MANAGER',
                'GASTRONOMY_OWNER',
                'EXPERIENCE_OWNER',
                'SPONSOR',
                'USER'
            ]);

            for (const entry of whatsNewEntries) {
                for (const role of entry.roles ?? []) {
                    expect(knownRoles.has(role)).toBe(true);
                }
            }
        });

        it('delivers the USER-targeted entry to a USER and not to a HOST', () => {
            const userEntries = filterEntriesByRole({ entries: whatsNewEntries, roles: ['USER'] });
            const hostEntries = filterEntriesByRole({ entries: whatsNewEntries, roles: ['HOST'] });

            const aiChatEntry = whatsNewEntries.find(
                (entry) => entry.id === '2026-09-03-ai-chat-gastronomy-experience'
            );
            expect(aiChatEntry).toBeDefined();

            expect(userEntries.map((entry) => entry.id)).toContain(aiChatEntry?.id);
            expect(hostEntries.map((entry) => entry.id)).not.toContain(aiChatEntry?.id);
        });

        it('delivers the GASTRONOMY_OWNER/EXPERIENCE_OWNER entry to both owners, not to a HOST', () => {
            const gastronomyEntries = filterEntriesByRole({
                entries: whatsNewEntries,
                roles: ['GASTRONOMY_OWNER']
            });
            const experienceEntries = filterEntriesByRole({
                entries: whatsNewEntries,
                roles: ['EXPERIENCE_OWNER']
            });
            const hostEntries = filterEntriesByRole({ entries: whatsNewEntries, roles: ['HOST'] });

            const trialEntry = whatsNewEntries.find(
                (entry) => entry.id === '2026-09-05-commerce-publish-free-trial'
            );
            expect(trialEntry).toBeDefined();

            expect(gastronomyEntries.map((entry) => entry.id)).toContain(trialEntry?.id);
            expect(experienceEntries.map((entry) => entry.id)).toContain(trialEntry?.id);
            expect(hostEntries.map((entry) => entry.id)).not.toContain(trialEntry?.id);
        });

        it('delivers the HOST-targeted video entry to a HOST and not to a USER', () => {
            const hostEntries = filterEntriesByRole({ entries: whatsNewEntries, roles: ['HOST'] });
            const userEntries = filterEntriesByRole({ entries: whatsNewEntries, roles: ['USER'] });

            const videoEntry = whatsNewEntries.find(
                (entry) => entry.id === '2026-09-04-accommodation-videos'
            );
            expect(videoEntry).toBeDefined();

            expect(hostEntries.map((entry) => entry.id)).toContain(videoEntry?.id);
            expect(userEntries.map((entry) => entry.id)).not.toContain(videoEntry?.id);
        });
    });
});
