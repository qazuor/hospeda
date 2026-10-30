/** @module test/components/shared/dock/DockPortal */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DockPortal } from '../../../../src/components/shared/dock/DockPortal';

afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
});

describe('TEST:1768:9 DockPortal', () => {
    it('renders children in place during SSR without reading the document', () => {
        vi.stubGlobal('document', undefined);
        try {
            expect(
                renderToString(
                    <DockPortal slot="filters">
                        <button>Filters</button>
                    </DockPortal>
                )
            ).toBe('<button>Filters</button>');
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('keeps children in place when the named slot does not exist', () => {
        render(
            <DockPortal slot="filters">
                <button>Filters</button>
            </DockPortal>
        );
        expect(screen.getByRole('button', { name: 'Filters' }).parentElement).not.toHaveAttribute(
            'data-mobile-dock-slot'
        );
    });

    it('moves children to an existing slot after mount and empties the slot on unmount', () => {
        const slot = document.createElement('div');
        slot.setAttribute('data-mobile-dock-slot', 'filters');
        document.body.append(slot);
        const view = render(
            <DockPortal slot="filters">
                <button>Filters</button>
            </DockPortal>
        );
        const button = screen.getByRole('button', { name: 'Filters' });
        expect(slot).toContainElement(button);
        view.unmount();
        expect(slot).toBeEmptyDOMElement();
    });

    it('renders newly enabled children directly into the slot after the portal mounted', () => {
        const slot = document.createElement('div');
        slot.setAttribute('data-mobile-dock-slot', 'filters');
        document.body.append(slot);
        const view = render(<DockPortal slot="filters">{null}</DockPortal>);
        view.rerender(
            <DockPortal slot="filters">
                <button>Filters</button>
            </DockPortal>
        );
        fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
        expect(slot).toContainElement(screen.getByRole('button', { name: 'Filters' }));
    });
});
