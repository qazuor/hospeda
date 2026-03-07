import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cssPath = resolve(__dirname, '../../src/styles/global.css');
const css = readFileSync(cssPath, 'utf8');

/**
 * Extract the :root block content from the CSS file.
 * Returns the raw text between the opening brace and matching closing brace.
 */
function extractRootBlock(source: string): string {
    const rootStart = source.indexOf(':root {');
    if (rootStart === -1) return '';
    const bodyStart = source.indexOf('{', rootStart);
    let depth = 0;
    let i = bodyStart;
    while (i < source.length) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) return source.slice(bodyStart, i + 1);
        }
        i++;
    }
    return '';
}

/**
 * Extract the [data-theme="dark"] block content from the CSS file.
 * Uses a regex to find the selector as a standalone rule, skipping any
 * @custom-variant references that also mention [data-theme="dark"].
 */
function extractDarkBlock(source: string): string {
    const rulePattern = /\[data-theme="dark"\]\s*\{/;
    const match = rulePattern.exec(source);
    if (!match) return '';
    const darkStart = match.index;
    const bodyStart = source.indexOf('{', darkStart);
    let depth = 0;
    let i = bodyStart;
    while (i < source.length) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) return source.slice(bodyStart, i + 1);
        }
        i++;
    }
    return '';
}

const rootBlock = extractRootBlock(css);
const darkBlock = extractDarkBlock(css);

describe('global.css - Design Token Infrastructure', () => {
    describe('File loading', () => {
        it('should load the CSS file successfully', () => {
            // Arrange
            // Act - already done at module load time
            // Assert
            expect(css.length).toBeGreaterThan(0);
        });

        it('should contain a :root block', () => {
            // Arrange / Act / Assert
            expect(css).toContain(':root {');
            expect(rootBlock.length).toBeGreaterThan(0);
        });

        it('should contain a [data-theme="dark"] block', () => {
            // Arrange / Act / Assert
            expect(css).toContain('[data-theme="dark"]');
            expect(darkBlock.length).toBeGreaterThan(0);
        });
    });

    describe('Light mode - core semantic tokens (in :root)', () => {
        const coreTokens = [
            '--background',
            '--foreground',
            '--card',
            '--card-foreground',
            '--primary',
            '--primary-foreground',
            '--secondary',
            '--secondary-foreground',
            '--accent',
            '--accent-foreground',
            '--muted',
            '--muted-foreground',
            '--destructive',
            '--destructive-foreground',
            '--border',
            '--ring'
        ] as const;

        for (const token of coreTokens) {
            it(`should define ${token}`, () => {
                // Arrange
                const declaration = `${token}:`;
                // Act / Assert
                expect(rootBlock).toContain(declaration);
            });
        }
    });

    describe('Dark mode - token overrides in [data-theme="dark"]', () => {
        const darkTokens = [
            '--background',
            '--foreground',
            '--card',
            '--card-foreground',
            '--primary',
            '--primary-foreground',
            '--secondary',
            '--secondary-foreground',
            '--accent',
            '--accent-foreground',
            '--muted',
            '--muted-foreground',
            '--destructive',
            '--destructive-foreground',
            '--border',
            '--ring'
        ] as const;

        for (const token of darkTokens) {
            it(`should override ${token} for dark mode`, () => {
                // Arrange
                const declaration = `${token}:`;
                // Act / Assert
                expect(darkBlock).toContain(declaration);
            });
        }
    });

    describe('Z-index scale tokens', () => {
        it('should define --z-content', () => {
            expect(rootBlock).toContain('--z-content:');
        });

        it('should define --z-wave', () => {
            expect(rootBlock).toContain('--z-wave:');
        });

        it('should define --z-menu', () => {
            expect(rootBlock).toContain('--z-menu:');
        });

        it('should define --z-overlay', () => {
            expect(rootBlock).toContain('--z-overlay:');
        });

        it('should define --z-toast for toasts above overlays', () => {
            expect(rootBlock).toContain('--z-toast:');
        });

        it('should have toast z-index higher than overlay z-index', () => {
            // Arrange
            const toastMatch = rootBlock.match(/--z-toast:\s*(\d+)/);
            const overlayMatch = rootBlock.match(/--z-overlay:\s*(\d+)/);
            // Act
            const toastZ = toastMatch ? Number.parseInt(toastMatch[1] as string, 10) : 0;
            const overlayZ = overlayMatch ? Number.parseInt(overlayMatch[1] as string, 10) : 0;
            // Assert
            expect(toastZ).toBeGreaterThan(overlayZ);
        });
    });

    describe('Animation duration tokens', () => {
        it('should define --scroll-reveal-duration', () => {
            expect(rootBlock).toContain('--scroll-reveal-duration:');
        });

        it('should define --scroll-reveal-offset-y', () => {
            expect(rootBlock).toContain('--scroll-reveal-offset-y:');
        });

        it('should define --scroll-reveal-offset-x', () => {
            expect(rootBlock).toContain('--scroll-reveal-offset-x:');
        });

        it('should define --nav-stagger-ms for nav item stagger delay', () => {
            expect(rootBlock).toContain('--nav-stagger-ms:');
        });

        it('should define --card-stagger-ms for card stagger delay', () => {
            expect(rootBlock).toContain('--card-stagger-ms:');
        });

        it('should use seconds unit for --scroll-reveal-duration', () => {
            // Arrange
            const durationMatch = rootBlock.match(/--scroll-reveal-duration:\s*[\d.]+s/);
            // Act / Assert
            expect(durationMatch).not.toBeNull();
        });
    });

    describe('Layout tokens', () => {
        it('should define --radius for border radius scale', () => {
            expect(rootBlock).toContain('--radius:');
        });

        it('should define --wave-separator-height', () => {
            expect(rootBlock).toContain('--wave-separator-height:');
        });

        it('should define --perspective-card-featured for 3D card effect', () => {
            expect(rootBlock).toContain('--perspective-card-featured:');
        });

        it('should define --perspective-card-secondary for secondary 3D card', () => {
            expect(rootBlock).toContain('--perspective-card-secondary:');
        });

        it('should define --card-tilt-featured with rotateY and rotateX transforms', () => {
            // Arrange
            const tiltValue = rootBlock.match(/--card-tilt-featured:\s*([^;]+)/);
            // Act / Assert
            expect(tiltValue).not.toBeNull();
            expect(tiltValue?.[1]).toContain('rotateY');
            expect(tiltValue?.[1]).toContain('rotateX');
        });
    });

    describe('Color function usage', () => {
        it('should use oklch() color function in :root tokens', () => {
            expect(rootBlock).toContain('oklch(');
        });

        it('should use oklch() color function in dark mode overrides', () => {
            expect(darkBlock).toContain('oklch(');
        });

        it('should not use deprecated hsl() function for semantic tokens', () => {
            // oklch is the chosen color space for this project
            expect(rootBlock).not.toContain('hsl(');
        });
    });

    describe('Shadow tokens', () => {
        it('should define --shadow-card', () => {
            expect(rootBlock).toContain('--shadow-card:');
        });

        it('should define --shadow-card-hover', () => {
            expect(rootBlock).toContain('--shadow-card-hover:');
        });

        it('should define --shadow-nav', () => {
            expect(rootBlock).toContain('--shadow-nav:');
        });

        it('should define --shadow-brutal-sm', () => {
            expect(rootBlock).toContain('--shadow-brutal-sm:');
        });

        it('should define --shadow-brutal-lg', () => {
            expect(rootBlock).toContain('--shadow-brutal-lg:');
        });
    });

    describe('Hospeda brand tokens', () => {
        it('should define --hospeda-sky', () => {
            expect(rootBlock).toContain('--hospeda-sky:');
        });

        it('should define --hospeda-river', () => {
            expect(rootBlock).toContain('--hospeda-river:');
        });

        it('should define --hospeda-forest', () => {
            expect(rootBlock).toContain('--hospeda-forest:');
        });

        it('should define --hospeda-sand', () => {
            expect(rootBlock).toContain('--hospeda-sand:');
        });

        it('should define --hospeda-sunset for CTA/accent usage', () => {
            expect(rootBlock).toContain('--hospeda-sunset:');
        });

        it('should override all hospeda brand tokens in dark mode', () => {
            const brandTokens = [
                '--hospeda-sky',
                '--hospeda-river',
                '--hospeda-forest',
                '--hospeda-sand',
                '--hospeda-sunset'
            ] as const;
            for (const token of brandTokens) {
                expect(darkBlock).toContain(`${token}:`);
            }
        });
    });

    describe('Feedback state tokens', () => {
        it('should define --success and --success-foreground', () => {
            expect(rootBlock).toContain('--success:');
            expect(rootBlock).toContain('--success-foreground:');
        });

        it('should define --warning and --warning-foreground', () => {
            expect(rootBlock).toContain('--warning:');
            expect(rootBlock).toContain('--warning-foreground:');
        });

        it('should define --info and --info-foreground', () => {
            expect(rootBlock).toContain('--info:');
            expect(rootBlock).toContain('--info-foreground:');
        });

        it('should override feedback tokens in dark mode', () => {
            expect(darkBlock).toContain('--success:');
            expect(darkBlock).toContain('--warning:');
            expect(darkBlock).toContain('--info:');
        });
    });

    describe('@theme inline block - Tailwind v4 token mapping', () => {
        it('should contain an @theme inline block', () => {
            expect(css).toContain('@theme inline {');
        });

        it('should map --color-background to var(--background)', () => {
            expect(css).toContain('--color-background: var(--background)');
        });

        it('should map --color-primary to var(--primary)', () => {
            expect(css).toContain('--color-primary: var(--primary)');
        });

        it('should map --color-accent to var(--accent)', () => {
            expect(css).toContain('--color-accent: var(--accent)');
        });

        it('should map --color-destructive to var(--destructive)', () => {
            expect(css).toContain('--color-destructive: var(--destructive)');
        });

        it('should define radius variants via calc()', () => {
            expect(css).toContain('--radius-sm: calc(var(--radius)');
            expect(css).toContain('--radius-lg: var(--radius)');
        });
    });
});
