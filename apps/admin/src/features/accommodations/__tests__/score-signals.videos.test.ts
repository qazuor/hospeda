/**
 * HOS-372 regression — the `video-gallery` quality signal must read the top-level
 * `videos` field, not `media.videos`.
 *
 * `media` is a RESPONSE-only shape now, composed from the relational rows plus the
 * `videos` column on the way out. The admin form writes `videos` directly. A signal
 * still reading `media.videos` therefore goes stale against the value the host is
 * actually editing: they add a video, the field holds it, and the signal keeps
 * saying "pending".
 *
 * @module features/accommodations/__tests__/score-signals.videos
 */

import { describe, expect, it } from 'vitest';
import { createAccommodationSignals } from '../config/score-signals';

/** Resolves the `video-gallery` signal with the premium feature unlocked. */
function checkVideoSignal(entity: Record<string, unknown>) {
    const signals = createAccommodationSignals({ hasVideoGalleryFeature: true });
    const signal = signals.find((s) => s.id === 'video-gallery');
    if (!signal) throw new Error('video-gallery signal is missing from the config');
    return signal.check(entity);
}

const VIDEO = { url: 'https://youtu.be/abc', moderationState: 'APPROVED' };

describe('accommodation video-gallery signal (HOS-372)', () => {
    it('is done when the top-level videos field has an entry', () => {
        expect(checkVideoSignal({ videos: [VIDEO] })).toEqual({ status: 'done' });
    });

    it('is pending when the top-level videos field is empty', () => {
        expect(checkVideoSignal({ videos: [] })).toEqual({ status: 'pending' });
    });

    it('is pending when videos is absent entirely', () => {
        expect(checkVideoSignal({ name: 'Hotel' })).toEqual({ status: 'pending' });
    });

    it('does not fall back to a legacy media.videos blob', () => {
        // The exact stale-read this fixes: a composed response shape with videos
        // nested under `media` must not satisfy the signal, because that is not
        // where the form keeps them.
        expect(checkVideoSignal({ media: { videos: [VIDEO] } })).toEqual({ status: 'pending' });
    });

    it('stays premium when the entitlement is locked, whatever the videos say', () => {
        const signals = createAccommodationSignals({ hasVideoGalleryFeature: false });
        const signal = signals.find((s) => s.id === 'video-gallery');
        expect(signal?.check({ videos: [VIDEO] })).toEqual({ status: 'premium' });
    });
});
