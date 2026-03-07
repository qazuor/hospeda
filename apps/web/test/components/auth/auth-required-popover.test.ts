import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/auth/AuthRequiredPopover.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

describe('AuthRequiredPopover.client.tsx', () => {
    describe('Imports', () => {
        it('should import FavoriteIcon and UserIcon from @repo/icons', () => {
            expect(content).toContain("import { FavoriteIcon, UserIcon } from '@repo/icons'");
        });

        it('should import cn utility', () => {
            expect(content).toContain("import { cn } from '../../lib/cn'");
        });

        it('should NOT import useTranslation hook', () => {
            expect(content).not.toContain('useTranslation');
        });
    });

    describe('Props', () => {
        it('should have readonly message prop', () => {
            expect(content).toContain('readonly message: string');
        });

        it('should have readonly onClose callback', () => {
            expect(content).toContain('readonly onClose: () => void');
        });

        it('should have i18n string props with defaults', () => {
            expect(content).toContain('readonly dialogLabel?: string');
            expect(content).toContain('readonly closeLabel?: string');
            expect(content).toContain('readonly signInLabel?: string');
            expect(content).toContain('readonly registerLabel?: string');
        });

        it('should default locale to es', () => {
            expect(content).toContain("locale = 'es'");
        });
    });

    describe('Design tokens', () => {
        it('should use card background token', () => {
            expect(content).toContain('bg-card');
        });

        it('should use primary/20 for borders', () => {
            expect(content).toContain('border-primary/20');
        });

        it('should use primary/5 for background accents', () => {
            expect(content).toContain('bg-primary/5');
        });
    });

    describe('Accessibility', () => {
        it('should have role="dialog"', () => {
            expect(content).toContain('role="dialog"');
        });

        it('should have aria-label from dialogLabel prop', () => {
            expect(content).toContain('aria-label={dialogLabel}');
        });

        it('should handle Escape key', () => {
            expect(content).toContain("event.key === 'Escape'");
        });

        it('should handle click outside', () => {
            expect(content).toContain('handleClickOutside');
        });

        it('should have close button with aria-label', () => {
            expect(content).toContain('aria-label={closeLabel}');
        });
    });

    describe('Auth links', () => {
        it('should generate login link with locale and returnUrl', () => {
            expect(content).toContain(
                '`/${locale}/auth/signin?returnUrl=${encodeURIComponent(returnUrl)}`'
            );
        });

        it('should generate register link with locale', () => {
            expect(content).toContain('`/${locale}/auth/signup`');
        });
    });

    describe('Named export', () => {
        it('should use named export', () => {
            expect(content).toContain('export function AuthRequiredPopover');
        });
    });
});
