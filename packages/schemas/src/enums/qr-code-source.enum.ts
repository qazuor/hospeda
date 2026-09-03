/**
 * QR Code Source Enum (HOS-981)
 *
 * How a QR code came into existence. This is not cosmetic: a `GENERATED` code
 * is owned by the entity it was derived from and carries `entityType`/`entityId`,
 * while a `MANUAL` one is owned by whoever typed it into the admin panel and has
 * no entity behind it. The distinction decides who may retarget a code and what
 * happens to it when its subject goes away.
 */
export enum QrCodeSourceEnum {
    /** Created by an operator in the admin panel, pointing wherever they chose. */
    MANUAL = 'MANUAL',
    /** Created by the platform for a concrete entity (a listing, an accommodation, …). */
    GENERATED = 'GENERATED'
}
