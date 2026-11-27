/**
 * The Hospeda isotipo, as data (HOS-2672).
 *
 * The owner's vector artwork, transcribed from the SVG file into constants so
 * that NOTHING reads a file at runtime: the API ships as a single tsup bundle,
 * which does not carry loose `.svg` assets, and a read at request time would be
 * one more way for a deploy to break QR rendering. The path data is verbatim —
 * do not hand-edit the numbers. The per-shape `id`s of the source file were dropped on purpose (they are document-global too).
 *
 * Both painters in `qr-center-logo.ts` consume this module: the SVG painter
 * nests the markup in the symbol, the PNG painter rasterises the very same
 * markup, so the two formats can never show different artwork.
 *
 * ## Brand colours
 *
 * The fills below (blue, green, teal, orange) belong to the isotipo and are NOT
 * driven by the QR's foreground colour. Only the disc behind it follows the
 * QR's background colour.
 *
 * ## The clip id is namespaced, not unique
 *
 * An SVG `id` is document-global. The source file's generic `silueta` could
 * collide with an unrelated id on the same page, so the id below is specific to
 * this feature. It is NOT unique per QR: several codes inlined in one page (a
 * brochure, a sheet of stickers) all repeat it. That is harmless because every
 * copy defines identical content, so whichever one a browser resolves clips the
 * same way. The caveat is `display: none`: a `clipPath` defined inside a hidden
 * subtree may not resolve for the visible copies in some browsers, so a page
 * that hides some inline codes should embed them as `<img>` instead.
 *
 * @module utils/qr-hospeda-isotipo
 */

/** Feature-specific `clipPath` id used by the isotipo markup (repeats across QRs on a page by design). */
export const HOSPEDA_ISOTIPO_CLIP_ID = 'hospeda-qr-isotipo-clip';

/** The isotipo's own coordinate box, as the source SVG declared it. */
export const HOSPEDA_ISOTIPO_VIEWBOX = {
    minX: 7,
    minY: 8,
    width: 517,
    height: 517
} as const;

/** The `viewBox` attribute value for `HOSPEDA_ISOTIPO_VIEWBOX`. */
export const HOSPEDA_ISOTIPO_VIEWBOX_ATTRIBUTE = `${HOSPEDA_ISOTIPO_VIEWBOX.minX} ${HOSPEDA_ISOTIPO_VIEWBOX.minY} ${HOSPEDA_ISOTIPO_VIEWBOX.width} ${HOSPEDA_ISOTIPO_VIEWBOX.height}`;

/**
 * The smallest circle that contains every painted pixel of the isotipo, in the
 * isotipo's own viewBox units.
 *
 * MEASURED, not eyeballed: the artwork was rasterised at 4 px per unit and the
 * minimal enclosing circle of every non-transparent pixel corner was computed
 * (centre 266.39, 239.71; radius 294.41), then padded by a tenth of a unit on
 * the centre error and the radius. The artwork is NOT centred in its viewBox
 * (the sun hangs off the top right), so the circle's centre is not the box's
 * centre, and centring by the box would push the sun out of the disc.
 * `qr-center-logo.test.ts` re-rasterises the artwork and fails if any painted
 * pixel falls outside this circle, so editing the artwork without updating this
 * constant is a red test rather than a logo spilling out of its disc.
 */
export const HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE = {
    cx: 266.4,
    cy: 239.8,
    radius: 294.6
} as const;

/**
 * The isotipo's inner SVG markup: a silhouette `clipPath`, the blue, green and
 * teal shapes clipped by it, and the orange sun drawn outside the clip.
 *
 * Splice it into an `<svg>` whose `viewBox` is `HOSPEDA_ISOTIPO_VIEWBOX_ATTRIBUTE`.
 */
export const HOSPEDA_ISOTIPO_MARKUP: string =
    `<defs>` +
    `<clipPath id="${HOSPEDA_ISOTIPO_CLIP_ID}">` +
    `<path d="M 242.743 521.410 C 242.385 521.052 235.434 519.711 227.296 518.429 C 133.778 503.701 82.997 478.809 38.859 426.063 C 26.358 411.123 21.992 401.805 22.010 390.093 C 22.028 378.125 27.142 370.623 39.088 365.042 C 56.734 356.796 77.549 356.800 121.000 365.054 C 149.117 370.395 167.585 373.000 177.343 373.000 C 192.171 373.000 217.581 368.294 216.749 365.702 C 215.083 360.506 182.221 348.630 139.000 337.606 C 97.059 326.908 94.052 326.078 80.000 321.314 C 43.766 309.029 21.168 291.247 13.988 269.370 C 12.748 265.591 11.386 262.050 10.960 261.500 C 7.973 257.640 9.116 231.449 12.945 216.000 C 29.488 149.258 78.831 98.508 186.500 37.497 C 193.100 33.757 200.075 29.799 202.000 28.703 C 224.523 15.871 241.820 10.704 263.838 10.230 C 272.401 10.046 279.689 10.313 280.338 10.835 C 280.977 11.349 283.075 12.098 285.000 12.499 C 298.665 15.350 312.991 25.334 320.157 37.000 C 325.378 45.499 326.855 63.704 323.646 80.000 C 322.220 87.242 319.977 99.570 318.006 111.000 C 313.656 136.232 315.019 148.446 323.468 159.956 C 335.801 176.757 356.680 187.078 406.500 201.003 C 476.534 220.577 494.225 230.821 509.243 260.500 C 512.963 267.850 517.776 282.050 519.073 289.499 C 519.697 293.080 520.610 296.259 521.104 296.564 C 522.268 297.284 522.277 336.303 521.113 337.550 C 520.626 338.072 519.694 341.650 519.043 345.500 C 513.643 377.437 494.169 410.448 463.208 440.149 C 419.803 481.786 369.393 507.610 309.000 519.145 C 297.509 521.339 244.486 523.152 242.743 521.410 Z"/></clipPath>` +
    `</defs>` +
    `<g clip-path="url(#${HOSPEDA_ISOTIPO_CLIP_ID})">` +
    `<path fill="#49A7CD" d="M 0 0 H 531 V 532 H 0 Z"/>` +
    `<path fill="#A2D636" d="M 249.500 523.846 C 247.850 523.306 243.125 522.445 239.000 521.934 C 234.875 521.423 228.350 520.572 224.500 520.044 C 220.650 519.515 215.475 518.818 213.000 518.495 C 210.525 518.173 206.025 517.283 203.000 516.518 C 199.975 515.752 193.000 514.139 187.500 512.932 C 117.021 497.465 77.572 474.762 35.706 425.573 C 24.443 412.341 20.000 402.359 20.000 390.290 C 20.000 374.855 27.837 365.895 47.000 359.420 C 54.746 356.803 90.547 356.757 102.500 359.349 C 122.876 363.768 146.867 368.132 162.000 370.172 C 172.461 371.582 192.617 370.659 204.500 368.226 C 210.000 367.099 218.404 365.712 223.175 365.144 C 228.619 364.495 233.647 363.208 236.675 361.688 C 243.496 358.265 259.663 352.000 261.675 352.000 C 264.617 352.000 285.880 341.074 292.008 336.414 C 295.247 333.951 303.275 329.280 309.848 326.035 C 316.421 322.789 322.102 319.644 322.472 319.045 C 322.843 318.445 325.700 316.599 328.823 314.942 C 331.945 313.284 336.018 310.970 337.874 309.799 C 341.315 307.629 355.990 303.136 368.381 300.459 C 391.546 295.455 436.097 299.092 456.500 307.654 C 459.800 309.039 464.525 310.585 467.000 311.091 C 472.920 312.299 477.915 314.324 482.273 317.282 C 484.225 318.606 488.574 320.719 491.940 321.977 C 497.025 323.879 499.143 325.477 504.481 331.443 C 511.499 339.284 513.000 342.185 513.000 347.910 C 513.000 350.404 513.672 352.298 514.974 353.477 C 518.266 356.456 518.212 358.358 514.513 369.531 C 510.915 380.400 504.104 394.083 498.542 401.622 C 496.869 403.889 493.416 408.614 490.869 412.122 C 475.303 433.561 438.344 467.040 416.500 479.489 C 413.750 481.056 410.825 482.895 410.000 483.574 C 406.451 486.498 374.647 502.191 365.500 505.531 C 351.984 510.467 328.746 517.579 322.000 518.845 C 311.044 520.901 303.192 522.000 299.385 522.011 C 297.248 522.017 293.291 522.692 290.591 523.511 C 284.896 525.238 254.510 525.486 249.500 523.846 Z"/>` +
    `<path fill="#359FA4" d="M 393.000 448.924 C 391.075 448.446 386.575 447.572 383.000 446.983 C 379.425 446.395 371.550 444.511 365.500 442.797 C 354.919 439.799 351.036 438.330 333.500 430.690 C 329.100 428.774 321.720 425.571 317.100 423.573 C 312.481 421.575 304.606 417.548 299.600 414.623 C 294.595 411.698 285.552 406.667 279.504 403.443 C 269.816 398.278 251.889 387.075 230.771 372.989 C 227.070 370.520 224.032 367.997 224.021 367.383 C 224.009 366.769 227.037 365.132 230.750 363.745 C 234.463 362.358 242.535 359.148 248.690 356.612 C 254.844 354.075 260.664 352.000 261.621 352.000 C 264.576 352.000 285.795 341.139 291.877 336.513 C 295.044 334.105 302.780 329.493 309.068 326.264 C 315.355 323.036 325.207 317.521 330.960 314.009 C 361.406 295.422 417.380 292.754 457.972 307.955 C 462.112 309.505 468.129 311.535 471.341 312.467 C 474.554 313.398 479.205 315.443 481.678 317.010 C 484.150 318.578 488.496 320.669 491.336 321.656 C 495.218 323.006 498.210 325.196 503.383 330.476 C 510.754 337.998 513.000 341.934 513.000 347.333 C 513.000 349.202 513.823 351.803 514.830 353.115 C 518.170 357.468 518.134 358.931 514.420 369.870 C 507.427 390.465 495.762 408.162 472.201 433.920 C 466.637 440.003 466.105 440.332 462.074 440.174 C 459.211 440.062 455.499 441.025 450.730 443.118 C 439.625 447.993 427.905 449.989 411.000 449.885 C 403.025 449.835 394.925 449.403 393.000 448.924 Z"/></g>` +
    `<path fill="#FFB02B" d="M 419.000 164.464 C 398.076 160.683 376.228 143.895 367.027 124.529 C 357.760 105.026 359.079 82.007 370.568 62.744 C 394.138 23.224 452.740 15.566 488.000 47.399 C 525.176 80.962 514.531 138.718 467.358 159.392 C 452.852 165.749 435.930 167.524 419.000 164.464 Z"/>`;
