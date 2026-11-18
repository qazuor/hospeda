/**
 * @file VenueInteractionTracker.test.tsx
 * @description Unit tests for VenueInteractionTracker (HOS-2256).
 *
 * Covers: a tap on a marked element sends a beacon with the venue id and kind,
 * an unmarked element or an unknown kind sends nothing, the middle button
 * counts and the right button does not, `eventId` is forwarded, the tap is
 * never `preventDefault`-ed, and unmounting removes the listener (AC-11).
 */

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
vi.mock('@/lib/analytics/interaction-capture', () => ({
    sendInteractionBeacon: (...args: unknown[]) => sendMock(...args)
}));

import { VenueInteractionTracker } from '@/components/analytics/VenueInteractionTracker.client';

const VENUE = '550e8400-e29b-41d4-a716-446655440000';
const EVENT = '660e8400-e29b-41d4-a716-446655440000';

function addLink(attrs: Record<string, string>, inner = '<span id="inner">x</span>'): HTMLElement {
    const a = document.createElement('a');
    a.href = '#';
    for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
    a.innerHTML = inner;
    document.body.appendChild(a);
    return a;
}

describe('VenueInteractionTracker (HOS-2256)', () => {
    beforeEach(() => {
        sendMock.mockClear();
        document.body.innerHTML = '';
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('renders nothing', () => {
        const { container } = render(<VenueInteractionTracker entityId={VENUE} />);
        expect(container.innerHTML).toBe('');
    });

    it('sends a beacon when a marked element, or a child of it, is clicked', () => {
        render(<VenueInteractionTracker entityId={VENUE} />);
        const link = addLink({ 'data-interaction-kind': 'PHONE_CLICK' });

        link.querySelector('#inner')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(sendMock).toHaveBeenCalledOnce();
        expect(sendMock).toHaveBeenCalledWith({
            entityId: VENUE,
            kind: 'PHONE_CLICK',
            eventId: undefined
        });
    });

    it('forwards the event id of an event interaction', () => {
        render(<VenueInteractionTracker entityId={VENUE} />);
        const link = addLink({
            'data-interaction-kind': 'TICKET_CLICK',
            'data-interaction-event-id': EVENT
        });

        link.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(sendMock).toHaveBeenCalledWith({
            entityId: VENUE,
            kind: 'TICKET_CLICK',
            eventId: EVENT
        });
    });

    it('ignores elements without the attribute and unknown kinds (AC-3)', () => {
        render(<VenueInteractionTracker entityId={VENUE} />);
        const plain = addLink({});
        const unknown = addLink({ 'data-interaction-kind': 'MENU_CLICK' });

        plain.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        unknown.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(sendMock).not.toHaveBeenCalled();
    });

    it('counts a middle-button auxclick and ignores the right button', () => {
        render(<VenueInteractionTracker entityId={VENUE} />);
        const link = addLink({ 'data-interaction-kind': 'WEBSITE_CLICK' });

        link.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 2 }));
        expect(sendMock).not.toHaveBeenCalled();
        link.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));
        expect(sendMock).toHaveBeenCalledOnce();
    });

    it('never prevents the default action of the tap', () => {
        render(<VenueInteractionTracker entityId={VENUE} />);
        const link = addLink({ 'data-interaction-kind': 'MAP_CLICK' });
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });

        link.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
    });

    it('registers one listener per mount and removes it on unmount (AC-11)', () => {
        const add = vi.spyOn(document, 'addEventListener');
        const remove = vi.spyOn(document, 'removeEventListener');
        const { unmount } = render(<VenueInteractionTracker entityId={VENUE} />);
        const link = addLink({ 'data-interaction-kind': 'INSTAGRAM_CLICK' });

        expect(add.mock.calls.filter(([type]) => type === 'click')).toHaveLength(1);
        expect(add.mock.calls.filter(([type]) => type === 'auxclick')).toHaveLength(1);

        unmount();
        link.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(remove.mock.calls.map(([type]) => type).sort()).toEqual(['auxclick', 'click']);
        expect(sendMock).not.toHaveBeenCalled();
        add.mockRestore();
        remove.mockRestore();
    });
});
