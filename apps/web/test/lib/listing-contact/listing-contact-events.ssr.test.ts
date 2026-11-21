// @vitest-environment node
import { expect, it, vi } from 'vitest';

it('imports the listing contact bus and safely invokes it without browser globals', async () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    const handler = vi.fn();

    const { openListingContactPanel, onListingContactPanelOpen } = await import(
        '../../../src/lib/listing-contact/listing-contact-events'
    );
    const unsubscribe = onListingContactPanelOpen(handler);
    openListingContactPanel({ origin: 'bar' });
    unsubscribe();

    expect(handler).not.toHaveBeenCalled();
});
