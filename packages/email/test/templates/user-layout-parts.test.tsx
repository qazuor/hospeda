/**
 * The pieces of the USER layout (HOS-2565 PR-4): hosted assets, help links, the D16
 * account link, the new components, the public exports and the no-vertical-branch
 * guard.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { render } from '@react-email/render';
import { emailPalette } from '@repo/design-tokens';
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { OptionCard } from '../../src/components/option-card.js';
import { SectionBar } from '../../src/components/section-bar.js';
import { resolveEmailAssetUrl } from '../../src/email-assets.js';
import * as barrel from '../../src/index.js';
import { resolveEmailAccountLinkTarget } from '../../src/templates/user-layout/account-link.js';
import {
    EMAIL_DEFAULT_HELP_ARTICLE_IDS,
    EMAIL_MAX_HELP_LINKS,
    resolveEmailHelpLinks
} from '../../src/templates/user-layout/help-links.js';
import {
    EMAIL_ILLUSTRATION_PATHS,
    EMAIL_ILLUSTRATIONS,
    EMAIL_USER_ASSET_PATHS
} from '../../src/templates/user-layout/user-assets.js';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');
const EMAIL_SRC = join(__dirname, '..', '..', 'src');

/** Every `.ts`/`.tsx` file under a directory. */
function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        return /\.tsx?$/.test(name) ? [path] : [];
    });
}

describe('user layout assets', () => {
    const paths = [
        ...Object.values(EMAIL_USER_ASSET_PATHS),
        ...Object.values(EMAIL_ILLUSTRATION_PATHS)
    ];

    it.each(paths)('should host %s in apps/web/public', (path) => {
        // Assert
        expect(existsSync(join(WEB_PUBLIC, path))).toBe(true);
    });

    it('should keep the whole user asset set under 150 KB', () => {
        // Arrange
        const bytes = paths.reduce((sum, path) => sum + statSync(join(WEB_PUBLIC, path)).size, 0);

        // Assert
        expect(bytes).toBeLessThan(150 * 1024);
    });

    it('should declare one path per illustration', () => {
        // Assert
        expect(Object.keys(EMAIL_ILLUSTRATION_PATHS).sort()).toEqual(
            [...EMAIL_ILLUSTRATIONS].sort()
        );
    });

    it('should resolve a path against the asset origin', () => {
        // Act & Assert
        expect(resolveEmailAssetUrl({ path: '/email/user/tagline@2x.png' })).toBe(
            'https://hospeda.com.ar/email/user/tagline@2x.png'
        );
    });
});

describe('resolveEmailHelpLinks', () => {
    it('should return the default set when nothing is declared', () => {
        // Act
        const { links } = resolveEmailHelpLinks({});

        // Assert
        expect(links.map((link) => link.id)).toEqual([...EMAIL_DEFAULT_HELP_ARTICLE_IDS]);
        expect(links.every((link) => link.title.length > 0)).toBe(true);
    });

    it('should fall back to the default set when every declared id is unknown', () => {
        // Act
        const { links } = resolveEmailHelpLinks({ ids: ['nope', 'also-nope'] });

        // Assert
        expect(links.map((link) => link.id)).toEqual([...EMAIL_DEFAULT_HELP_ARTICLE_IDS]);
    });

    it('should keep the declared order, skip unknown ids and cap the list', () => {
        // Act
        const { links } = resolveEmailHelpLinks({
            ids: ['addons', 'nope', 'calendar', 'photos', 'reviews', 'inquiries']
        });

        // Assert
        expect(links).toHaveLength(EMAIL_MAX_HELP_LINKS);
        expect(links.map((link) => link.id)).toEqual(['addons', 'calendar', 'photos', 'reviews']);
        expect(links[0]?.href).toBe('https://hospeda.com.ar/es/mi-cuenta/ayuda/addons/');
    });
});

describe('resolveEmailAccountLinkTarget (D16)', () => {
    it.each([
        { verticals: undefined, kind: 'account' },
        { verticals: [], kind: 'account' },
        { verticals: ['partner'], kind: 'account' },
        { verticals: ['tourist'], kind: 'account' },
        { verticals: ['partner', 'venue'], kind: 'publications' },
        { verticals: ['unknown-vertical'], kind: 'account' }
    ] as const)('should map $verticals to $kind', ({ verticals, kind }) => {
        // Act
        const target = resolveEmailAccountLinkTarget(verticals ? { verticals } : {});

        // Assert
        expect(target.kind).toBe(kind);
    });

    it('should answer for every VerticalEnum value without throwing', () => {
        // Act & Assert
        for (const vertical of Object.values(VerticalEnum)) {
            const { kind } = resolveEmailAccountLinkTarget({ verticals: [vertical] });
            expect(['publications', 'account']).toContain(kind);
        }
    });

    it('should never branch on a VerticalEnum member in packages/email/src', () => {
        // Arrange
        const offenders = sourceFiles(EMAIL_SRC).filter((file) =>
            /(===|!==)\s*VerticalEnum\.|case\s+VerticalEnum\./.test(readFileSync(file, 'utf8'))
        );

        // Assert
        expect(offenders.map((file) => relative(EMAIL_SRC, file))).toEqual([]);
    });
});

describe('SectionBar', () => {
    it('should render a teal 36x4 bar by default and an orange one on request', async () => {
        // Act
        const teal = await render(<SectionBar />);
        const orange = await render(<SectionBar tone="orange" />);

        // Assert
        expect(teal).toContain(`background-color:${emailPalette.accentTeal}`);
        expect(teal).toContain('width="36"');
        expect(teal).toContain('data-skip-in-text="true"');
        expect(orange).toContain(`background-color:${emailPalette.accentOrange}`);
    });

    it('should space with fixed-height cells, never margins', async () => {
        // Act
        const html = await render(
            <SectionBar
                spaceAbove={16}
                spaceBelow={10}
            />
        );

        // Assert
        expect(html).toContain('height="16"');
        expect(html).toContain('height="10"');
        expect(html).not.toContain('margin');
    });
});

describe('OptionCard', () => {
    it.each([
        {
            tone: 'success',
            stripe: emailPalette.optionSuccessStripe,
            band: emailPalette.optionSuccessBand
        },
        { tone: 'info', stripe: emailPalette.optionInfoStripe, band: emailPalette.optionInfoBand }
    ] as const)('should draw the $tone stripe and band', async ({ tone, stripe, band }) => {
        // Act
        const html = await render(
            <OptionCard
                tone={tone}
                label="Opción 1"
                title="Actualizá tu plan"
            >
                <p>Cuerpo</p>
            </OptionCard>
        );

        // Assert
        expect(html).toContain(`data-option-card="${tone}"`);
        expect(html).toContain(`6px solid ${stripe}`);
        expect(html).toContain(`background-color:${band}`);
        expect(html).toContain('Actualizá tu plan');
        expect(html).toContain('Cuerpo');
        expect(html).not.toContain('display:flex');
    });
});

describe('public exports (HOS-2565 PR-4)', () => {
    it('should export the user layout API from the barrel', () => {
        // Assert
        const exported = [
            barrel.OptionCard,
            barrel.SectionBar,
            barrel.resolveEmailAssetUrl,
            barrel.EmailLayoutContext,
            barrel.resolveEmailHelpLinks,
            barrel.buildEmailHelpArticleUrl,
            barrel.EMAIL_ILLUSTRATIONS,
            barrel.EMAIL_SOCIAL_PLATFORMS,
            barrel.EMAIL_USER_STYLE_BLOCK
        ];
        expect(exported.every((value) => value !== undefined)).toBe(true);
    });
});
