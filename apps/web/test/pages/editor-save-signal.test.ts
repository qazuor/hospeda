/**
 * Each editor section page renders only the save signal of its registry
 * `saveModel` (HOS-2487, spec HOS-2415 §6.2, AC-3).
 *
 * Vitest cannot render `.astro`, so this reads the sources:
 *
 * - the shell mounts the one `EditorAutoSaveChip` only for an `auto` section;
 * - every page's section island belongs to its model: a `bar` page mounts an
 *   island that renders `EditorSaveBar` (and no `ActionBar`), an `auto` page
 *   mounts one that does not.
 *
 * `PENDING_BAR` lists the `bar` sections whose managers still carry their own
 * save buttons until their move to the bar (spec PR-5): they are declared
 * `bar` and asserted NOT to render the bar yet, so the list must shrink when
 * that lands.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCOMMODATION_EDITOR_REGISTRY } from '@/lib/editor/accommodation-editor-sections';
import type { EditorRegistry, EditorSaveModel } from '@/lib/editor/editor-registry';
import { buildListingEditorRegistry } from '@/lib/editor/listing-editor-registry';

const WEB = resolve(__dirname, '../..');
const read = (path: string): string => readFileSync(resolve(WEB, path), 'utf8');
const codeOf = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

/** The section island each page mounts → its source file. */
const ISLANDS: Readonly<Record<string, string>> = {
    BasicsForm: 'src/components/host/editor/forms/BasicsForm.client.tsx',
    ContactForm: 'src/components/host/editor/forms/ContactForm.client.tsx',
    LocationForm: 'src/components/host/editor/forms/LocationForm.client.tsx',
    ServicesForm: 'src/components/host/editor/forms/ServicesForm.client.tsx',
    CapacityPricingForm: 'src/components/host/editor/forms/CapacityPricingForm.client.tsx',
    PoliciesForm: 'src/components/host/editor/forms/PoliciesForm.client.tsx',
    SeoForm: 'src/components/host/editor/forms/SeoForm.client.tsx',
    ListingEditor: 'src/components/listing/ListingEditor.client.tsx',
    CalendarSection: 'src/components/host/editor/CalendarSection.client.tsx',
    PhotoSection: 'src/components/host/editor/PhotoSection.client.tsx',
    FaqSection: 'src/components/host/editor/FaqSection.client.tsx',
    AiQuestionsPanel: 'src/components/listing/ai-questions/AiQuestionsPanel.client.tsx',
    ExternalReputationSection: 'src/components/host/ExternalReputationSection.client.tsx',
    TranslationPanel: 'src/components/host/editor/TranslationPanel.client.tsx',
    MediaSection: 'src/components/listing/editor/MediaSection.client.tsx',
    ListingFaqManager: 'src/components/listing/ListingFaqManager.client.tsx',
    VenuePromotionsManager: 'src/components/venue/VenuePromotionsManager.client.tsx',
    VenueMenuManager: 'src/components/venue/VenueMenuManager.client.tsx',
    VenueDailySpecialsManager: 'src/components/venue/VenueDailySpecialsManager.client.tsx',
    VenueEventsManager: 'src/components/venue/VenueEventsManager.client.tsx'
};

/** Declared `bar`, managers not on the bar yet (spec PR-5). */
const PENDING_BAR: ReadonlySet<string> = new Set(['carta', 'menu-del-dia', 'eventos']);

const EDITORS: readonly {
    readonly dir: string;
    readonly registries: readonly EditorRegistry[];
}[] = [
    {
        dir: 'src/pages/[lang]/mi-cuenta/propiedades/[id]/editar',
        registries: [ACCOMMODATION_EDITOR_REGISTRY]
    },
    {
        dir: 'src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar',
        registries: [
            buildListingEditorRegistry({ vertical: 'venue', sectionStates: {} }),
            buildListingEditorRegistry({ vertical: 'experience', sectionStates: {} })
        ]
    }
];

/** The save model of a page slug, agreed by every registry that has it. */
function modelOf(registries: readonly EditorRegistry[], slug: string): EditorSaveModel {
    const models = new Set(
        registries.flatMap((registry) =>
            registry.sections.filter((section) => section.slug === slug).map((s) => s.saveModel)
        )
    );
    expect(models.size, `${slug}: registries disagree or none has it`).toBe(1);
    return [...models][0] as EditorSaveModel;
}

/** Whether an island's source renders the kit save bar. */
function rendersBar(island: string): boolean {
    const path = ISLANDS[island];
    expect(path, `unknown island <${island}>: add it to ISLANDS`).toBeDefined();
    return /<EditorSaveBar\b/.test(codeOf(read(path as string)));
}

const PAGES = EDITORS.flatMap(({ dir, registries }) =>
    readdirSync(resolve(WEB, dir))
        .filter((file) => file.endsWith('.astro') && file !== 'index.astro')
        .map((file) => ({ dir, registries, slug: file.replace(/\.astro$/, '') }))
);

describe('editor save signal per page (HOS-2487, AC-3)', () => {
    it('covers all 30 section pages', () => {
        expect(PAGES).toHaveLength(30);
    });

    it('the shell mounts the autosave chip only for an auto section', () => {
        const shell = codeOf(read('src/layouts/EditorShellLayout.astro'));

        expect(shell).toMatch(/saveModel === 'auto' && <EditorAutoSaveChip/);
        expect(shell).toContain('data-save-model={saveModel}');
    });

    it.each(
        PAGES.map((page) => [`${page.dir.split('/')[4]}/${page.slug}`, page] as const)
    )('%s renders only the signal of its model', (_name, { dir, registries, slug }) => {
        // Arrange
        const model = modelOf(registries, slug);
        const page = codeOf(read(`${dir}/${slug}.astro`));
        const islands = [...page.matchAll(/<([A-Z][A-Za-z]+)\s[^>]*client:/g)]
            .map((match) => match[1] as string)
            .filter((name) => name in ISLANDS);

        // Assert
        expect(islands.length, `${slug}: no section island found`).toBeGreaterThan(0);
        const withBar = islands.filter(rendersBar);
        if (model === 'bar' && !PENDING_BAR.has(slug)) {
            expect(withBar, `${slug} is bar but mounts no EditorSaveBar`).not.toHaveLength(0);
        } else {
            expect(withBar, `${slug} is ${model} but mounts the save bar`).toHaveLength(0);
        }
    });

    it('no bar island keeps the retired ActionBar', () => {
        for (const island of Object.keys(ISLANDS).filter(rendersBar)) {
            expect(codeOf(read(ISLANDS[island] as string)), island).not.toContain('ActionBar');
        }
    });
});
