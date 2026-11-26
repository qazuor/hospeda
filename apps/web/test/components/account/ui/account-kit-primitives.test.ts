/** Source guards for account kit styling; browser rendering remains a separate gate. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(__dirname, '../../../../src', path), 'utf8');
const css = (name: string) => source(`components/account/ui/${name}.module.css`);
const rule = (text: string, selector: string) => {
    const start = text.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThanOrEqual(0);
    return text.slice(start, text.indexOf('}', start) + 1);
};

describe('ListRow styling', () => {
    const text = css('ListRow');
    it('uses control hierarchy, wraps descriptions on mobile and clamps them in the wide container', () => {
        expect(rule(text, '.title')).toContain('font: var(--app-control)');
        expect(rule(text, '.description')).toContain('font: var(--app-ui)');
        // HOS-2621 AC-2: no clamp on mobile; the two-line clamp lives in the wide container query.
        expect(rule(text, '.description')).not.toContain('-webkit-line-clamp');
        expect(text).toMatch(
            /@container \(width >= 40rem\)\s*{\s*\.description:not\(\.descriptionWrap\)\s*{[^}]*-webkit-line-clamp: 2/
        );
        expect(rule(text, '.descriptionWrap')).toContain('-webkit-line-clamp: unset');
        expect(rule(text, '.meta')).toContain('overflow-wrap: anywhere');
        expect(rule(text, '.trailing')).toContain('flex-wrap: wrap');
    });
    it('reserves a common body height and centers the leading piece', () => {
        expect(rule(text, '.body')).toContain('min-block-size:');
        expect(rule(text, '.leading')).toContain('align-self: center');
    });
    it('limits hover painting to linked rows on hover-capable devices', () => {
        expect(text).toMatch(
            /@media \(hover: hover\) and \(pointer: fine\)\s*{\s*\.row:has\(\.link\):hover/
        );
        const hover = rule(text, '.row:has(.link):hover');
        expect(hover).toContain(
            'background-color: color-mix(in srgb, var(--surface-warm) 25%, var(--core-card))'
        );
        expect(hover).not.toContain('background-color: var(--surface-warm)');
        expect(text).not.toContain('.row:hover');
    });
    it('lets titles wrap without single-line truncation', () => {
        const title = rule(text, '.title');
        expect(title).toContain('min-inline-size: 0');
        expect(title).toContain('overflow-wrap: anywhere');
        expect(title).not.toMatch(
            /white-space:\s*nowrap|text-overflow:\s*ellipsis|overflow:\s*hidden/
        );
    });
});

describe('native control styling', () => {
    const control = css('Control');
    const choice = css('Choice');
    it('paints a direction-invariant CSS chevron with logical positioning', () => {
        expect(rule(control, '.select')).toContain('appearance: none');
        const chevron = rule(control, '.dropdown::after');
        expect(chevron).toContain('inset-inline-end: var(--space-4)');
        expect(chevron).toContain('border-right: 2px solid var(--core-muted-foreground)');
        expect(chevron).toContain('border-bottom: 2px solid var(--core-muted-foreground)');
        expect(chevron).toContain('transform: translateY(-75%) rotate(45deg)');
        expect(chevron).not.toMatch(/border-(?:inline|block)-(?:start|end):/);
        expect(chevron).toContain('pointer-events: none');
        expect(chevron).toContain('var(--core-muted-foreground)');
        expect(control).not.toMatch(/data:|<svg/);
    });
    it('paints check, indeterminate and radio states without replacing semantics', () => {
        expect(rule(choice, '.input')).toContain('appearance: none');
        expect(rule(choice, '.input')).toContain('var(--control-border)');
        expect(choice).toContain('.input[type="checkbox"]:checked::before');
        expect(choice).toContain('.input[type="checkbox"]:indeterminate::before');
        expect(choice).toContain('.input[type="radio"]:checked::before');
        expect(rule(choice, '.choice')).toContain('min-block-size: var(--control-h-lg)');
        expect(rule(choice, '.input:focus-visible')).toContain('var(--focus-ring)');
        expect(rule(choice, '.input[aria-invalid="true"]')).toContain('border-color:');
        expect(rule(choice, '.input[aria-invalid="true"]')).not.toContain('outline:');
        expect(choice).toContain('.fieldset[aria-invalid="true"] .input');
        expect(choice).toContain('.input:disabled');
    });
    it('hides number spinners on both input recipes and preserves date/time pickers', () => {
        for (const name of ['control', 'bare']) {
            expect(control).toContain(`.${name}[type="number"]::-webkit-inner-spin-button`);
            expect(control).toContain(`.${name}[type="number"]::-webkit-outer-spin-button`);
            expect(control).toContain(`.${name}[type="number"]`);
        }
        expect(control).toContain('min-inline-size: calc(var(--space-10) * 4)');
        expect(control).toContain('min-inline-size: calc(var(--space-10) * 3)');
        expect(control).not.toMatch(
            /picker-indicator|\[type="(?:date|time)"\][^{]*{[^}]*appearance:/
        );
    });
    it('gives disabled primary actions muted colors without fading loading actions', () => {
        const text = css('Button');
        expect(text).toMatch(/\.primary:disabled,[\s\S]*?background-color: var\(--muted\)/);
        expect(text).toMatch(/\.primary:disabled,[\s\S]*?color: var\(--core-muted-foreground\)/);
        expect(rule(text, '.loading')).not.toContain('opacity:');
    });
});

describe('shared account spacing', () => {
    it('owns the sibling stack without changing template widths or inline margins', () => {
        const content = rule(source('layouts/AccountShell.module.css'), '.content');
        expect(content).toContain('display: flex');
        expect(content).toContain('flex-direction: column');
        expect(content).toContain('gap: var(--space-6)');
        expect(content).not.toContain('margin-inline');
        expect(source('pages/[lang]/mi-cuenta/preferencias/index.astro')).not.toContain(
            'preferencias-tour-gap'
        );
    });
    it('keeps tour titles and actions in stable columns even on mobile', () => {
        const text = source('components/account/RestartTour.module.css');
        expect(rule(text, '.list')).toContain('grid-template-columns: minmax(0, 1fr) auto');
        expect(rule(text, '.item')).toContain('grid-template-columns: subgrid');
        expect(rule(text, '.name')).toContain('overflow-wrap: anywhere');
        expect(text).not.toContain('flex-wrap: wrap');
    });
    it('neutralizes only direct header outer spacing where the shell now owns the gap', () => {
        expect(rule(source('layouts/AccountShell.module.css'), '.content > header')).toContain(
            'margin-block-end: 0'
        );
    });
});
