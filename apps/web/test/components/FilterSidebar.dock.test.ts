import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const component = read('../../src/components/shared/filters/FilterSidebar.client.tsx');
const styles = read('../../src/components/shared/filters/FilterSidebar.module.css');
const layout = read('../../src/layouts/ListingLayout.astro');

describe('FilterSidebar dock integration', () => {
    it('uses a portal trigger, retains its drawer, stays within the source size limit, and hides fixed styles', () => {
        expect(component).toContain('FilterDockTrigger');
        expect(component).toMatch(/<MobileDrawer\b/);
        expect(component).toMatch(
            /<FilterDockTrigger\b[\s\S]*?onOpen=\{\(\) => setIsDrawerOpen\(true\)\}\s*\/>/
        );
        expect(component).not.toContain('<DockPortal');
        expect(component.split('\n').length).toBeLessThan(500);
        expect(styles).not.toContain('position: fixed');
        const mobile = styles.match(/@media \(max-width: 767px\)\s*\{([\s\S]*?)(?=\n\})/);
        expect(mobile?.[1]).toMatch(/\.floatingTrigger\s*\{[^}]*display:\s*none/s);
        expect(mobile?.[1]).toMatch(
            /:global\(\[data-mobile-dock\]\) \.floatingTrigger\s*\{[^}]*position:\s*static/s
        );
    });

    it('keeps the collapsed mobile sidebar visible to its fixed drawer', () => {
        expect(layout).toMatch(
            /@media \(max-width: 768px\)[\s\S]*?\.listing-sidebar\s*\{[^}]*width:\s*0;[^}]*height:\s*0;[^}]*overflow:\s*visible;/
        );
    });
});
