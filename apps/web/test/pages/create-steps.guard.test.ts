/** Structural guarantees for kit-only create steps and published-only quota copy. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePrecheckPanelContent } from '@/lib/host/publish-precheck-panel-content';
import { createTranslations } from '@/lib/i18n';

const srcPath = (path: string) => resolve(__dirname, '../../src', path);
const read = (path: string) => readFileSync(srcPath(path), 'utf8');

describe('minimal create step structure', () => {
    it.each([
        'listing/ListingCreateForm',
        'event/editor/EventCreateForm',
        'post/editor/PostCreateForm'
    ])('%s uses kit controls and has no legacy stylesheet', (form) => {
        const source = read(`components/${form}.client.tsx`);
        expect(existsSync(srcPath(`components/${form}.module.css`))).toBe(false);
        for (const component of ['Section', 'Select', 'Button'])
            expect(source).toContain(`<${component}`);
        expect(source).toContain('<CreateTextField');
        expect(source).not.toMatch(/<(?:input|select|textarea|button)\b/);
    });

    it.each([
        'eventos',
        'publicaciones'
    ])('%s page delegates its Section to the create island', (area) => {
        const source = read(`pages/[lang]/mi-cuenta/${area}/nuevo.astro`);
        expect(source).not.toContain('<Section');
        expect(source).toContain('<PageHeader');
    });

    it('reuses the post editor’s rich-text component and keeps organizer controls in the kit', () => {
        for (const file of ['ContentSection', 'PostCreateForm']) {
            expect(read(`components/post/editor/${file}.client.tsx`)).toContain(
                "from '@/components/host/editor/RichTextEditor.client'"
            );
        }
        const picker = read('components/event/editor/EventOrganizerPicker.client.tsx').replace(
            /\/\*[\s\S]*?\*\//g,
            ''
        );
        expect(picker).not.toMatch(/<(?:input|select|button)\b/);
        expect(picker).toContain('<Field');
        expect(picker).toContain('<Select');
    });

    it('offers only one plan/pricing link', () => {
        const source = read('components/publish/PublishPlanLinks.astro');
        expect(source.match(/<a\b/g)).toHaveLength(1);
        expect(source).toContain('href={pricingUrl}');
    });
});

describe('localized quota copy matches the published-only rule', () => {
    for (const locale of ['es', 'en', 'pt'] as const) {
        it.each([
            'accommodation',
            'venue',
            'experience'
        ] as const)(`${locale}: %s distinguishes published listings from drafts`, (vertical) => {
            const { t, tPlural } = createTranslations(locale);
            for (const decision of [
                'upgrade_only',
                'resume_delete_or_upgrade',
                'pick_draft_delete_or_upgrade'
            ] as const) {
                const panel = resolvePrecheckPanelContent({
                    locale,
                    vertical,
                    decision,
                    editUrl: '/edit/',
                    createUrl: '/create/',
                    accountPropertiesUrl: '/list/',
                    subscriptionUrl: '/subscription/'
                });
                for (const currentCount of [1, 2]) {
                    const body = tPlural(
                        panel.bodyKey,
                        panel.bodyPluralBasis === 'maxAllowed' ? 2 : currentCount,
                        { currentCount, maxAllowed: 2 }
                    );
                    expect(body).toContain(String(currentCount));
                    expect(body).toContain('2');
                    expect(body).toMatch(
                        locale === 'es'
                            ? /publicad.*borradores no cuentan/i
                            : locale === 'en'
                              ? /published.*drafts do not count/i
                              : /publicad.*rascunhos não contam/i
                    );
                    expect(body).not.toContain('{{');
                }
            }
            expect(t('publish.experience.hero.title')).not.toMatch(
                /llenala|fill it up|lote as vagas/
            );
        });
    }
});
