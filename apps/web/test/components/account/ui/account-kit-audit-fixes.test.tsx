/** Focused render and source regressions for G11, G13/D8 and G26. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditableNote } from '../../../../src/components/account/EditableNote';
import { AutoSaveChip } from '../../../../src/components/account/ui/AutoSaveChip';
import { ConfirmDialog } from '../../../../src/components/account/ui/ConfirmDialog';
import { PageHeader } from '../../../../src/components/account/ui/PageHeader';

const source = (path: string) => readFileSync(resolve(__dirname, '../../../../src', path), 'utf8');
const css = (name: string) => source(`components/account/ui/${name}.module.css`);
const rule = (text: string, selector: string) =>
    [...text.matchAll(new RegExp(`${selector.replaceAll('.', '\\.')} \\{([^}]+)\\}`, 'g'))].at(
        -1
    )?.[1] ?? '';

describe('account kit audit fixes', () => {
    it.each([
        ['es', 'Todo guardado', 'Cambios sin guardar', 'Escribe una nota personal...'],
        ['en', 'All changes saved', 'Unsaved changes', 'Write a personal note...'],
        ['pt', 'Tudo salvo', 'Alterações não salvas', 'Escreva uma nota pessoal...']
    ] as const)('renders clean/dirty and the empty note placeholder in %s', (locale, clean, dirty, placeholder) => {
        const { rerender, unmount } = render(
            <AutoSaveChip
                status="clean"
                locale={locale}
            />
        );
        expect(screen.getByRole('status')).toHaveTextContent(clean);
        expect(screen.getByRole('status').querySelector('svg')).toHaveAttribute(
            'aria-hidden',
            'true'
        );
        rerender(
            <AutoSaveChip
                status="dirty"
                locale={locale}
            />
        );
        expect(screen.getByRole('status')).toHaveTextContent(dirty);
        expect(screen.queryByRole('button')).toBeNull();
        unmount();
        render(
            <EditableNote
                bookmarkId="bookmark"
                initialValue={null}
                apiBase="http://localhost:3001"
                locale={locale}
            />
        );
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', placeholder);
    });

    it('keeps title and help in a non-wrapping row while allowing title text to wrap', () => {
        render(
            <PageHeader
                title="A long account page title"
                help={<a href="/help/">Help</a>}
                description="Supporting description"
                locale="en"
            />
        );
        const title = screen.getByRole('heading', { level: 1 });
        expect(title.parentElement).toBe(
            screen.getByRole('link', { name: 'Help' }).parentElement?.parentElement
        );
        expect(screen.getByText('Supporting description')).toBeInTheDocument();
        const text = css('PageHeader');
        expect(rule(text, '.titleRow')).toContain('flex-wrap: nowrap');
        expect(rule(text, '.title')).toContain('min-inline-size: 0');
        expect(rule(text, '.title')).toContain('overflow-wrap: anywhere');
        expect(rule(text, '.help')).toContain('flex: none');
        expect(text.match(/\.titleRow \{/g)).toHaveLength(1);
    });

    it.each([
        ['consultas', 'guestInbox'],
        ['resenas', 'reviews'],
        ['consultas-propietario', 'ownerInbox']
    ])('passes a translated description to the %s page header in every locale', (route, key) => {
        const page = source(`pages/[lang]/mi-cuenta/${route}/index.astro`);
        expect(page).toMatch(
            new RegExp(
                `<PageHeader[^>]+description=\\{t\\('account.pages.${key}.headingDesc'\\)\\}`
            )
        );
        for (const locale of ['es', 'en', 'pt']) {
            const catalog = JSON.parse(
                readFileSync(
                    resolve(
                        __dirname,
                        `../../../../../../packages/i18n/src/locales/${locale}/account.json`
                    ),
                    'utf8'
                )
            );
            expect(catalog.pages[key].headingDesc).toEqual(expect.any(String));
            expect(catalog.pages[key].headingDesc.length).toBeGreaterThan(15);
            for (const status of ['clean', 'dirty', 'saving', 'saved', 'error', 'retry']) {
                expect(catalog.ui.autoSave[status]).toEqual(expect.any(String));
            }
            expect(catalog.ui.autoSave.saved).toContain('{{time}}');
        }
    });

    it('gives the destructive icon an explicit inherited danger color rather than its blue default', () => {
        render(
            <ConfirmDialog
                open
                title="Delete note"
                description="This cannot be undone."
                confirmLabel="Delete"
                locale="en"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );
        const icon = screen
            .getByRole('alertdialog')
            .querySelector('svg[aria-label="alert-circle icon"]');
        expect(icon).toHaveAttribute('fill', 'currentColor');
        expect(icon?.parentElement?.className).toContain('iconDestructive');
        expect(rule(css('ConfirmDialog'), '.iconDestructive')).toContain(
            'color: var(--status-danger-fg)'
        );
        expect(rule(css('ConfirmDialog'), '.iconDestructive')).toContain(
            'background-color: var(--status-danger-bg)'
        );
        const chips = css('StickySaveBar');
        expect(rule(chips, '.chipClean')).toContain('var(--status-success-fg)');
        expect(rule(chips, '.chipDirty')).toContain('var(--status-warning-fg)');
    });

    it('uses shared kit tour styling and configuration from both entry points', () => {
        const text = source('styles/driver-tour.css');
        expect(rule(text, '.driver-popover-next-btn')).toContain(
            'background-color: var(--action-primary)'
        );
        expect(rule(text, '.driver-popover-prev-btn')).toContain(
            'border-color: var(--control-border)'
        );
        expect(rule(text, '.driver-popover-prev-btn')).toContain(
            'background-color: var(--control-bg)'
        );
        const close = rule(text, '.driver-popover-close-btn');
        expect(close).toContain('inset-block-start: var(--space-2)');
        expect(close).toContain('inset-inline-end: var(--space-2)');
        expect(close).toContain('inline-size: var(--control-h-md)');
        expect(close).toContain('block-size: var(--control-h-md)');
        expect(text).toContain('outline: 2px solid var(--focus-ring)');
        expect(text).toContain('.driver-popover-prev-btn[hidden]');
        for (const component of ['TourController', 'RestartTour']) {
            expect(source(`components/account/${component}.client.tsx`)).toContain(
                '...buildTourDriverTexts({ t })'
            );
        }
    });
});
