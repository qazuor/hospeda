/**
 * QR Code Format Enum (HOS-981)
 *
 * The output formats the render engine can produce.
 */
export enum QrCodeFormatEnum {
    /** Vector. The same string serves a screen and a print stylesheet at any size. */
    SVG = 'SVG',
    /** Raster. For consumers that cannot embed SVG (some email clients, some print shops). */
    PNG = 'PNG'
}
