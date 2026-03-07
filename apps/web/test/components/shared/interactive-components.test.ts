/**
 * @file interactive-components.test.ts
 * @description Source-level tests for untested interactive shared components:
 * CounterAnimation.client.tsx, Tabs.client.tsx, and FavoriteButtonIsland.astro.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../../src');

function readComponent(relativePath: string): string {
    return readFileSync(resolve(srcDir, relativePath), 'utf8');
}

// ──────────────────────────────────────────────────────────────────────────────
// CounterAnimation.client.tsx
// ──────────────────────────────────────────────────────────────────────────────

describe('CounterAnimation.client.tsx', () => {
    const src = readComponent('components/shared/CounterAnimation.client.tsx');

    describe('Exports', () => {
        it('should export CounterAnimation as a named const', () => {
            expect(src).toContain('export const CounterAnimation');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('Props interface', () => {
        it('should define CounterAnimationProps interface', () => {
            expect(src).toContain('interface CounterAnimationProps');
        });

        it('should have readonly targetValue prop', () => {
            expect(src).toContain('readonly targetValue:');
        });

        it('should have optional readonly suffix prop', () => {
            expect(src).toContain('readonly suffix?');
        });

        it('should have optional readonly prefix prop', () => {
            expect(src).toContain('readonly prefix?');
        });

        it('should have readonly label prop', () => {
            expect(src).toContain('readonly label:');
        });

        it('should have optional readonly locale prop', () => {
            expect(src).toContain('readonly locale?');
        });
    });

    describe('Hooks usage', () => {
        it('should use useCountUp hook', () => {
            expect(src).toContain('useCountUp');
        });

        it('should use useViewportTrigger hook', () => {
            expect(src).toContain('useViewportTrigger');
        });
    });

    describe('i18n / number formatting', () => {
        it('should import formatNumber from @repo/i18n', () => {
            expect(src).toContain('formatNumber');
            expect(src).toContain('@repo/i18n');
        });

        it('should import toBcp47Locale for locale conversion', () => {
            expect(src).toContain('toBcp47Locale');
        });
    });

    describe('Accessibility', () => {
        it('should have an aria-live region for screen reader announcements', () => {
            expect(src).toContain('aria-live="polite"');
        });

        it('should use aria-hidden on the animated number span', () => {
            expect(src).toContain('aria-hidden=');
        });

        it('should announce the final value via sr-only element', () => {
            expect(src).toContain('sr-only');
        });
    });

    describe('Visual structure', () => {
        it('should render prefix before the number', () => {
            expect(src).toContain('{prefix}');
        });

        it('should render suffix after the number', () => {
            expect(src).toContain('{suffix}');
        });

        it('should render the label below the number', () => {
            expect(src).toContain('{label}');
        });

        it('should use flex-col items-center for vertical layout', () => {
            expect(src).toContain('flex-col');
            expect(src).toContain('items-center');
        });
    });

    describe('Semantic tokens', () => {
        it('should use text-foreground for number', () => {
            expect(src).toContain('text-foreground');
        });

        it('should use text-muted-foreground for label', () => {
            expect(src).toContain('text-muted-foreground');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tabs.client.tsx
// ──────────────────────────────────────────────────────────────────────────────

describe('Tabs.client.tsx', () => {
    const src = readComponent('components/shared/Tabs.client.tsx');

    describe('Exports', () => {
        it('should export Tabs as a named function', () => {
            expect(src).toContain('export function Tabs');
        });

        it('should export TabItem interface', () => {
            expect(src).toContain('export interface TabItem');
        });

        it('should export TabsProps interface', () => {
            expect(src).toContain('export interface TabsProps');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('TabItem interface', () => {
        it('should have readonly id prop', () => {
            expect(src).toContain('readonly id:');
        });

        it('should have readonly label prop', () => {
            expect(src).toContain('readonly label:');
        });

        it('should have readonly content prop', () => {
            expect(src).toContain('readonly content:');
        });
    });

    describe('TabsProps interface', () => {
        it('should have readonly tabs prop as ReadonlyArray', () => {
            expect(src).toContain('readonly tabs:');
            expect(src).toContain('ReadonlyArray');
        });

        it('should have optional defaultTab prop', () => {
            expect(src).toContain('readonly defaultTab?');
        });

        it('should have optional className prop', () => {
            expect(src).toContain('readonly className?');
        });
    });

    describe('ARIA pattern', () => {
        it('should have role=tablist on the tab strip', () => {
            expect(src).toContain('role="tablist"');
        });

        it('should have role=tab on each button', () => {
            expect(src).toContain('role="tab"');
        });

        it('should have role=tabpanel on each content panel', () => {
            expect(src).toContain('role="tabpanel"');
        });

        it('should use aria-selected on each tab button', () => {
            expect(src).toContain('aria-selected=');
        });

        it('should use aria-controls linking tab to panel', () => {
            expect(src).toContain('aria-controls=');
        });

        it('should use aria-labelledby linking panel to tab', () => {
            expect(src).toContain('aria-labelledby=');
        });

        it('should use id pattern tab-{id} for each button', () => {
            expect(src).toContain('id={`tab-');
        });

        it('should use id pattern panel-{id} for each panel', () => {
            expect(src).toContain('id={`panel-');
        });
    });

    describe('Keyboard navigation', () => {
        it('should handle ArrowLeft key', () => {
            expect(src).toContain("case 'ArrowLeft':");
        });

        it('should handle ArrowRight key', () => {
            expect(src).toContain("case 'ArrowRight':");
        });

        it('should handle Home key', () => {
            expect(src).toContain("case 'Home':");
        });

        it('should handle End key', () => {
            expect(src).toContain("case 'End':");
        });

        it('should implement roving tabIndex pattern', () => {
            expect(src).toContain('tabIndex={isActive ? 0 : -1}');
        });
    });

    describe('Focus management', () => {
        it('should use tabRefs for programmatic focus', () => {
            expect(src).toContain('tabRefs');
        });

        it('should call .focus() when navigating with keyboard', () => {
            expect(src).toContain('?.focus()');
        });
    });

    describe('Panel visibility', () => {
        it('should use hidden attribute to hide inactive panels', () => {
            expect(src).toContain('hidden={!isActive}');
        });
    });

    describe('Hooks', () => {
        it('should use useState for active tab state', () => {
            expect(src).toContain('useState');
        });

        it('should use useCallback for event handlers', () => {
            expect(src).toContain('useCallback');
        });

        it('should use useRef for tab button refs', () => {
            expect(src).toContain('useRef');
        });
    });

    describe('Semantic tokens', () => {
        it('should use text-primary for active tab', () => {
            expect(src).toContain('text-primary');
        });

        it('should use border-primary for active tab indicator', () => {
            expect(src).toContain('border-primary');
        });

        it('should use text-muted-foreground for inactive tabs', () => {
            expect(src).toContain('text-muted-foreground');
        });

        it('should use border-border for the tab strip border', () => {
            expect(src).toContain('border-border');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tabs.client.tsx - additional source-level assertions
// ──────────────────────────────────────────────────────────────────────────────

describe('Tabs.client.tsx - focus-visible ring', () => {
    const src = readComponent('components/shared/Tabs.client.tsx');

    it('should apply focus-visible:outline on each tab button', () => {
        expect(src).toContain('focus-visible:outline');
    });

    it('should use outline-primary as the focus ring color', () => {
        expect(src).toContain('focus-visible:outline-primary');
    });

    it('should use outline-offset-2 for the focus ring', () => {
        expect(src).toContain('focus-visible:outline-offset-2');
    });
});

describe('Tabs.client.tsx - active / inactive visual differentiation', () => {
    const src = readComponent('components/shared/Tabs.client.tsx');

    it('should apply border-b-2 on the active tab for the indicator underline', () => {
        expect(src).toContain('border-b-2');
    });

    it('should use border-transparent on inactive tabs', () => {
        expect(src).toContain('border-transparent');
    });

    it('should apply hover:border-border on inactive tabs', () => {
        expect(src).toContain('hover:border-border');
    });

    it('should apply hover:text-foreground on inactive tabs', () => {
        expect(src).toContain('hover:text-foreground');
    });
});

describe('Tabs.client.tsx - panel content rendering', () => {
    const src = readComponent('components/shared/Tabs.client.tsx');

    it('should only render tab.content when the tab is active', () => {
        expect(src).toContain('{isActive && tab.content}');
    });

    it('should apply mt-4 margin to each panel element', () => {
        expect(src).toContain('mt-4');
    });
});

describe('Tabs.client.tsx - tablist aria-label', () => {
    const src = readComponent('components/shared/Tabs.client.tsx');

    it('should set aria-label="Tabs" on the tablist element', () => {
        expect(src).toContain('aria-label="Tabs"');
    });
});

describe('Tabs.client.tsx - default tab initialisation', () => {
    const src = readComponent('components/shared/Tabs.client.tsx');

    it('should fall back to the first tab id when defaultTab is undefined', () => {
        expect(src).toContain('tabs[0]?.id');
    });

    it('should use nullish coalescing when setting the initialTab', () => {
        expect(src).toContain('defaultTab ??');
    });
});

describe('Tabs.client.tsx - keyboard event wrapping', () => {
    const src = readComponent('components/shared/Tabs.client.tsx');

    it('should call event.preventDefault() on ArrowLeft', () => {
        // The switch case block calls preventDefault in ArrowLeft case
        expect(src).toContain('event.preventDefault()');
    });

    it('should wrap ArrowLeft to the last tab when at index 0', () => {
        expect(src).toContain('tabs.length - 1');
    });

    it('should wrap ArrowRight to the first tab when at the last index', () => {
        expect(src).toContain('currentIndex + 1 : 0');
    });

    it('should use a default case to return early for unhandled keys', () => {
        expect(src).toContain('default:');
        expect(src).toContain('return;');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// FavoriteButtonIsland.astro
// ──────────────────────────────────────────────────────────────────────────────

describe('FavoriteButtonIsland.astro', () => {
    const src = readComponent('components/shared/FavoriteButtonIsland.astro');

    describe('Props interface', () => {
        it('should define a Props interface', () => {
            expect(src).toContain('interface Props');
        });

        it('should have readonly entityId prop', () => {
            expect(src).toContain('readonly entityId:');
        });

        it('should have readonly entityType prop', () => {
            expect(src).toContain('readonly entityType:');
        });

        it('should have optional entityName prop', () => {
            expect(src).toContain('readonly entityName?');
        });

        it('should have optional initialFavorited prop', () => {
            expect(src).toContain('readonly initialFavorited?');
        });

        it('should have optional locale prop', () => {
            expect(src).toContain('readonly locale?');
        });

        it('should have optional className prop', () => {
            expect(src).toContain('readonly className?');
        });
    });

    describe('Server island integration', () => {
        it('should import FavoriteButton client component', () => {
            expect(src).toContain('FavoriteButton');
        });

        it('should use server:defer directive for deferred hydration', () => {
            expect(src).toContain('server:defer');
        });
    });

    describe('Auth injection', () => {
        it('should read isAuthenticated from Astro.locals.user', () => {
            expect(src).toContain('Astro.locals.user');
        });

        it('should pass isAuthenticated as prop to FavoriteButton', () => {
            expect(src).toContain('isAuthenticated={isAuthenticated}');
        });
    });

    describe('Props passthrough', () => {
        it('should forward entityId to FavoriteButton', () => {
            expect(src).toContain('entityId={entityId}');
        });

        it('should forward entityType to FavoriteButton', () => {
            expect(src).toContain('entityType={entityType}');
        });

        it('should forward locale to FavoriteButton', () => {
            expect(src).toContain('locale={locale}');
        });

        it('should forward className to FavoriteButton', () => {
            expect(src).toContain('className={className}');
        });
    });
});
