import {
    AccessRightScopeEnum,
    AccommodationTypeEnum,
    AdSlotReservationStatusEnum,
    AmenitiesTypeEnum,
    AuthProviderEnum,
    BillingCycleEnum,
    BillingIntervalEnum,
    BillingSchemeEnum,
    CampaignChannelEnum,
    CampaignStatusEnum,
    ClientTypeEnum,
    DiscountTypeEnum,
    EntityPermissionReasonEnum,
    EntityTypeEnum,
    EventCategoryEnum,
    FeaturedStatusEnum,
    FeaturedTypeEnum,
    InvoiceStatusEnum,
    LifecycleStatusEnum,
    ListingStatusEnum,
    MediaAssetTypeEnum,
    ModerationStatusEnum,
    NotificationChannelEnum,
    NotificationRecipientTypeEnum,
    NotificationStatusEnum,
    NotificationTypeEnum,
    PaymentMethodEnum,
    PaymentProviderEnum,
    PaymentStatusEnum,
    PermissionCategoryEnum,
    PermissionEnum,
    PostCategoryEnum,
    PreferredContactEnum,
    PriceCurrencyEnum,
    ProductTypeEnum,
    ProfessionalServiceCategoryEnum,
    RecurrenceTypeEnum,
    RoleEnum,
    ServiceOrderStatusEnum,
    SponsorshipEntityTypeEnum,
    SponsorshipStatusEnum,
    SubscriptionItemEntityTypeEnum,
    SubscriptionItemSourceTypeEnum,
    SubscriptionStatusEnum,
    TagColorEnum,
    VisibilityEnum
} from '@repo/schemas';
import { pgEnum } from 'drizzle-orm/pg-core';
import { enumToTuple } from '../utils/enum-utils';

export const AccommodationTypePgEnum = pgEnum(
    'accommodation_type_enum',
    enumToTuple(AccommodationTypeEnum)
);

export const AccessRightScopePgEnum = pgEnum(
    'access_right_scope_enum',
    enumToTuple(AccessRightScopeEnum)
);

export const AmenitiesTypePgEnum = pgEnum('amenities_type_enum', enumToTuple(AmenitiesTypeEnum));

export const ClientTypePgEnum = pgEnum('client_type_enum', enumToTuple(ClientTypeEnum));

export const PreferredContactPgEnum = pgEnum(
    'preferred_contact_enum',
    enumToTuple(PreferredContactEnum)
);

export const PriceCurrencyPgEnum = pgEnum('price_currency_enum', enumToTuple(PriceCurrencyEnum));

export const ProductTypePgEnum = pgEnum('product_type_enum', enumToTuple(ProductTypeEnum));

export const EntityTypePgEnum = pgEnum('entity_type_enum', enumToTuple(EntityTypeEnum));

export const EventCategoryPgEnum = pgEnum('event_category_enum', enumToTuple(EventCategoryEnum));

export const LifecycleStatusPgEnum = pgEnum(
    'lifecycle_status_enum',
    enumToTuple(LifecycleStatusEnum)
);

export const PermissionPgEnum = pgEnum('permission_enum', enumToTuple(PermissionEnum));

export const PermissionCategoryPgEnum = pgEnum(
    'permission_category_enum',
    enumToTuple(PermissionCategoryEnum)
);

export const PostCategoryPgEnum = pgEnum('post_category_enum', enumToTuple(PostCategoryEnum));

export const RecurrenceTypePgEnum = pgEnum('recurrence_type_enum', enumToTuple(RecurrenceTypeEnum));

export const RolePgEnum = pgEnum('role_enum', enumToTuple(RoleEnum));

export const ModerationStatusPgEnum = pgEnum(
    'moderation_status_enum',
    enumToTuple(ModerationStatusEnum)
);

export const TagColorPgEnum = pgEnum('tag_color_enum', enumToTuple(TagColorEnum));

export const VisibilityPgEnum = pgEnum('visibility_enum', enumToTuple(VisibilityEnum));

export const AuthProviderPgEnum = pgEnum('auth_provider_enum', enumToTuple(AuthProviderEnum));

export const BillingCyclePgEnum = pgEnum('billing_cycle_enum', enumToTuple(BillingCycleEnum));

export const BillingIntervalPgEnum = pgEnum(
    'billing_interval_enum',
    enumToTuple(BillingIntervalEnum)
);

export const BillingSchemePgEnum = pgEnum('billing_scheme_enum', enumToTuple(BillingSchemeEnum));

export const EntityPermissionReasonPgEnum = pgEnum(
    'entity_permission_reason_enum',
    enumToTuple(EntityPermissionReasonEnum)
);

export const PaymentMethodPgEnum = pgEnum('payment_method_enum', enumToTuple(PaymentMethodEnum));

export const PaymentProviderPgEnum = pgEnum(
    'payment_provider_enum',
    enumToTuple(PaymentProviderEnum)
);

export const PaymentStatusPgEnum = pgEnum('payment_status_enum', enumToTuple(PaymentStatusEnum));

export const SubscriptionStatusPgEnum = pgEnum(
    'subscription_status_enum',
    enumToTuple(SubscriptionStatusEnum)
);

export const SubscriptionItemSourceTypePgEnum = pgEnum(
    'subscription_item_source_type_enum',
    enumToTuple(SubscriptionItemSourceTypeEnum)
);

export const SubscriptionItemEntityTypePgEnum = pgEnum(
    'subscription_item_entity_type_enum',
    enumToTuple(SubscriptionItemEntityTypeEnum)
);

export const CampaignChannelPgEnum = pgEnum(
    'campaign_channel_enum',
    enumToTuple(CampaignChannelEnum)
);

export const CampaignStatusPgEnum = pgEnum('campaign_status_enum', enumToTuple(CampaignStatusEnum));

export const MediaAssetTypePgEnum = pgEnum(
    'media_asset_type_enum',
    enumToTuple(MediaAssetTypeEnum)
);

export const AdSlotReservationStatusPgEnum = pgEnum(
    'ad_slot_reservation_status_enum',
    enumToTuple(AdSlotReservationStatusEnum)
);

export const SponsorshipEntityTypePgEnum = pgEnum(
    'sponsorship_entity_type_enum',
    enumToTuple(SponsorshipEntityTypeEnum)
);

export const SponsorshipStatusPgEnum = pgEnum(
    'sponsorship_status_enum',
    enumToTuple(SponsorshipStatusEnum)
);

export const FeaturedTypePgEnum = pgEnum('featured_type_enum', enumToTuple(FeaturedTypeEnum));

export const FeaturedStatusPgEnum = pgEnum('featured_status_enum', enumToTuple(FeaturedStatusEnum));

export const ProfessionalServiceCategoryPgEnum = pgEnum(
    'professional_service_category_enum',
    enumToTuple(ProfessionalServiceCategoryEnum)
);

export const ServiceOrderStatusPgEnum = pgEnum(
    'service_order_status_enum',
    enumToTuple(ServiceOrderStatusEnum)
);

export const ListingStatusPgEnum = pgEnum('listing_status_enum', enumToTuple(ListingStatusEnum));

export const InvoiceStatusPgEnum = pgEnum('invoice_status_enum', enumToTuple(InvoiceStatusEnum));

export const DiscountTypePgEnum = pgEnum('discount_type_enum', enumToTuple(DiscountTypeEnum));

export const NotificationChannelPgEnum = pgEnum(
    'notification_channel_enum',
    enumToTuple(NotificationChannelEnum)
);

export const NotificationRecipientTypePgEnum = pgEnum(
    'notification_recipient_type_enum',
    enumToTuple(NotificationRecipientTypeEnum)
);

export const NotificationStatusPgEnum = pgEnum(
    'notification_status_enum',
    enumToTuple(NotificationStatusEnum)
);

export const NotificationTypePgEnum = pgEnum(
    'notification_type_enum',
    enumToTuple(NotificationTypeEnum)
);
