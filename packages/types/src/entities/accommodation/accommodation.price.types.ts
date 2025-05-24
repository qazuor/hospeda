import type { BasePriceType } from '../../common/price.types.js';

/* Additional Fees */

export interface AdditionalFeesInfoType extends BasePriceType {
    isIncluded?: boolean;
    isOptional?: boolean;
    isPercent?: boolean;
    isPerStay?: boolean;
    isPerNight?: boolean;
    isPerGuest?: boolean;
}

export interface OtherAdditionalFeesType extends AdditionalFeesInfoType {
    name: string;
}

export interface AdditionalFeesType {
    cleaning?: AdditionalFeesInfoType;
    tax?: AdditionalFeesInfoType;
    lateCheckout?: AdditionalFeesInfoType;
    pets?: AdditionalFeesInfoType;
    bedlinen?: AdditionalFeesInfoType;
    towels?: AdditionalFeesInfoType;
    babyCrib?: AdditionalFeesInfoType;
    babyHighChair?: AdditionalFeesInfoType;
    extraBed?: AdditionalFeesInfoType;
    securityDeposit?: AdditionalFeesInfoType;
    extraGuest?: AdditionalFeesInfoType;
    parking?: AdditionalFeesInfoType;
    earlyCheckin?: AdditionalFeesInfoType;
    lateCheckin?: AdditionalFeesInfoType;
    luggageStorage?: AdditionalFeesInfoType;
    others?: OtherAdditionalFeesType[];
}

/* Discounts */

export interface DiscountInfoType extends BasePriceType {
    isIncluded?: boolean;
    isOptional?: boolean;
    isPercent?: boolean;
    isPerStay?: boolean;
    isPerNight?: boolean;
    isPerGuest?: boolean;
}

export interface OtherDiscountType extends DiscountInfoType {
    name: string;
}

export interface DiscountsType {
    weekly?: DiscountInfoType;
    monthly?: DiscountInfoType;
    lastMinute?: DiscountInfoType;
    others?: OtherDiscountType[];
}

/* Final Accommodation Price */

export interface AccommodationPriceType extends BasePriceType {
    additionalFees?: AdditionalFeesType;
    discounts?: DiscountsType;
}
