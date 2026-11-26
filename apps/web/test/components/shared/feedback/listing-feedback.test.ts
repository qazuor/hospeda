import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const feedback = resolve(import.meta.dirname, '../../../../src/components/shared/feedback');
const empty = readFileSync(resolve(feedback, 'EmptyState.astro'), 'utf8');
const error = readFileSync(resolve(feedback, 'ErrorBanner.astro'), 'utf8');
const globalCss = readFileSync(resolve(feedback, '../../../styles/global.css'), 'utf8');

describe('shared listing feedback', () => {
    it('renders an optional semantic heading without replacing the localized message', () => {
        expect(empty).toContain('<h2 class="empty-state__title">{title}</h2>');
        expect(empty).toContain('<p class="empty-state__message">{resolvedMessage}</p>');
    });

    it('hides the illustration from assistive technology and keeps the recovery link outside it', () => {
        expect(empty).toMatch(/class="empty-state__icon" aria-hidden="true"[\s\S]*?<slot\s*\/>/);
        expect(empty).toMatch(
            /\{actionUrl && \([\s\S]*?<a href=\{actionUrl\}[^>]*>[\s\S]*?\{resolvedActionLabel\}/
        );
    });

    it('announces errors and offers a keyboard-focusable, localized retry action', () => {
        expect(error).toContain('role="alert"');
        expect(error).toContain('aria-hidden="true"');
        expect(error).toContain('<p class="error-banner__message">{resolvedMessage}</p>');
        expect(error).toMatch(
            /<button type="button"[^>]*data-action="reload"[\s\S]*?\{retryLabel\}/
        );
        expect(globalCss).toMatch(/:focus-visible\s*\{[^}]*outline:/);
    });
});
