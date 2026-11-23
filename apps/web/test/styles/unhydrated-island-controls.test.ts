/**
 * @vitest-environment jsdom
 *
 * Pins the global rule that blocks pointer input on a not-yet-hydrated island's
 * controls (HOS-2572). Page islands wait for the i18n hydration gate, so their
 * server-rendered controls are visible before React owns them: a click would do
 * nothing and typed text would be dropped. The rule's selector is read from
 * `global.css` and matched against real DOM shapes, so a rename or a lost
 * exclusion fails here.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const GLOBAL_CSS = resolve(__dirname, '../../src/styles/global.css');

/** The selector and declarations of the `astro-island[ssr]` rule, comments stripped. */
function unhydratedRule(): { readonly selector: string; readonly body: string } {
    const css = readFileSync(GLOBAL_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const match = css.match(/(astro-island\[ssr\][^{]*)\{([^}]*)\}/);
    expect(match, 'the astro-island[ssr] rule is missing from global.css').not.toBeNull();
    return { selector: (match?.[1] ?? '').trim(), body: match?.[2] ?? '' };
}

/** Whether `selector` matches the element marked `data-target` inside `html`. */
function matches({ selector, html }: { selector: string; html: string }): boolean {
    document.body.innerHTML = html;
    const target = document.querySelector('[data-target]');
    if (!target) throw new Error('fixture has no [data-target]');
    return target.matches(selector);
}

describe('not-yet-hydrated island controls (HOS-2572)', () => {
    it('blocks pointer input and shows a loading cursor', () => {
        const { body } = unhydratedRule();

        expect(body).toMatch(/pointer-events:\s*none/);
        expect(body).toMatch(/cursor:\s*progress/);
    });

    it.each([
        'button',
        'input',
        'select',
        'textarea'
    ])('matches a %s inside an island that has not hydrated', (tag) => {
        const { selector } = unhydratedRule();
        const control = tag === 'input' ? '<input data-target>' : `<${tag} data-target></${tag}>`;

        expect(
            matches({
                selector,
                html: `<astro-island ssr client="load"><form>${control}</form></astro-island>`
            })
        ).toBe(true);
    });

    it('matches a role=button element inside an island that has not hydrated', () => {
        const { selector } = unhydratedRule();

        expect(
            matches({
                selector,
                html: '<astro-island ssr client="idle"><div role="button" data-target></div></astro-island>'
            })
        ).toBe(true);
    });

    it('releases the control once the island hydrated (Astro removed `ssr`)', () => {
        const { selector } = unhydratedRule();

        expect(
            matches({
                selector,
                html: '<astro-island client="load"><button data-target></button></astro-island>'
            })
        ).toBe(false);
    });

    it('never blocks a client:media island (it may never hydrate)', () => {
        const { selector } = unhydratedRule();

        expect(
            matches({
                selector,
                html: '<astro-island ssr client="media"><button data-target></button></astro-island>'
            })
        ).toBe(false);
    });

    it('leaves links usable (they work without JS)', () => {
        const { selector } = unhydratedRule();

        expect(
            matches({
                selector,
                html: '<astro-island ssr client="load"><a href="/x" data-target>x</a></astro-island>'
            })
        ).toBe(false);
    });
});
