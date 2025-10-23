/**
 * Access right scope enum for permission system
 * Defines the scope levels for access rights based on subscription items
 */
export enum AccessRightScopeEnum {
    /** Accommodation-specific access rights */
    ACCOMMODATION = 'accommodation',
    /** Placement/advertising-specific access rights */
    PLACEMENT = 'placement',
    /** Merchant/business-specific access rights */
    MERCHANT = 'merchant',
    /** Service-specific access rights */
    SERVICE = 'service',
    /** Global/system-wide access rights */
    GLOBAL = 'global'
}
