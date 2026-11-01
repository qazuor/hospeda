/**
 * The one reference device of every mobile capture in `marketing/`: a Samsung Galaxy S24 Ultra
 * with factory settings (FHD+, default zoom, Chrome), measured by the owner on the real phone
 * on 31/10/2026. Source of truth for the numbers and the decisions behind them:
 * `marketing/videos/REGLAS.md` § «Dispositivo de referencia: Samsung Galaxy S24 Ultra».
 *
 * Every recorder, probe and composition reads its sizes from here. `scripts/check-marketing-device.ts`
 * fails CI when `marketing/` names another phone or another phone size.
 */

/** A width × height pair in the unit stated by the field that holds it. */
export type Size = { readonly width: number; readonly height: number };

/** Heights of the browser and system bars drawn in editing over the 142 CSS px the page lacks. */
export type DeviceBars = {
    /** Android status bar (clock, signal, battery), CSS px. Holds the punch-hole camera. */
    readonly status: number;
    /** Chrome address bar, CSS px. */
    readonly address: number;
    /** Android navigation bar, CSS px. */
    readonly navigation: number;
};

/** Everything the video tooling needs to know about the reference phone. */
export type DeviceProfile = {
    /** Human name, for logs and docs. */
    readonly name: string;
    /** Full screen in CSS px (what the frame of the phone surrounds). */
    readonly screen: Size;
    /** Page area recorded by Playwright, CSS px: the visible area in Chrome. */
    readonly viewport: Size;
    /** Visible area as reported on the phone (Chrome rounds 412 down to 411); reference only. */
    readonly measuredViewport: Size;
    /** Device pixel ratio of the real phone (1080 / 412 ≈ 2.63). */
    readonly nativeDpr: number;
    /** Device pixel ratio used when recording: oversampled so zooms do not pixelate. */
    readonly recordDpr: number;
    /** Resolution of the screen-only export (layer 2): the real panel resolution. */
    readonly exportSize: Size;
    /** Bars drawn in editing; they add up to `screen.height - viewport.height`. */
    readonly bars: DeviceBars;
    /** Screen aspect, width / height (19.5:9 → 0.4615). */
    readonly aspect: number;
};

/**
 * Samsung Galaxy S24 Ultra, factory settings.
 *
 * Only the 142 px total of the bars was measured. The split is a drawing choice: Chrome's
 * toolbar (56 dp) and Android's three-button navigation bar (48 dp) are the platform defaults,
 * and the status bar takes the remaining 38.
 */
export const S24_ULTRA = {
    name: 'Samsung Galaxy S24 Ultra',
    screen: { width: 412, height: 892 },
    viewport: { width: 412, height: 750 },
    measuredViewport: { width: 411, height: 750 },
    nativeDpr: 2.63,
    recordDpr: 3,
    exportSize: { width: 1080, height: 2340 },
    bars: { status: 38, address: 56, navigation: 48 },
    aspect: 9 / 19.5
} as const satisfies DeviceProfile;

/** The device every mobile capture represents. Change it here and nowhere else. */
export const REFERENCE_DEVICE: DeviceProfile = S24_ULTRA;

/**
 * Size in device pixels of a recording made at `recordDpr` over the reference viewport
 * (412 × 750 at DPR 3 → 1236 × 2250).
 *
 * @param input.device - Device to size (defaults to {@link REFERENCE_DEVICE}).
 * @returns `{ size }` with the recording size in device pixels.
 */
export const recordingSizeOf = ({
    device = REFERENCE_DEVICE
}: {
    readonly device?: DeviceProfile;
} = {}): { readonly size: Size } => ({
    size: {
        width: device.viewport.width * device.recordDpr,
        height: device.viewport.height * device.recordDpr
    }
});
