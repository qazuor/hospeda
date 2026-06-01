import {
    AccessRightScopeEnum,
    AccommodationTypeEnum,
    AmenitiesTypeEnum,
    AuthProviderEnum,
    BillingIntervalEnum,
    ClientTypeEnum,
    ConversationStatusEnum,
    DestinationTypeEnum,
    EntityPermissionReasonEnum,
    EntityTypeEnum,
    EventCategoryEnum,
    ExchangeRateSourceEnum,
    ExchangeRateTypeEnum,
    InvoiceStatusEnum,
    LifecycleStatusEnum,
    MessageSenderTypeEnum,
    MessageStatusEnum,
    ModerationStatusEnum,
    NewsletterCampaignLocaleFilterEnum,
    NewsletterCampaignStatusEnum,
    NewsletterChannelEnum,
    NewsletterContentTypeEnum,
    NewsletterDeliveryStatusEnum,
    NewsletterSourceEnum,
    NewsletterSubscriberStatusEnum,
    NotificationRecipientSideEnum,
    OwnerPromotionDiscountTypeEnum,
    PaymentStatusEnum,
    PermissionCategoryEnum,
    PermissionEffectEnum,
    PermissionEnum,
    PostCategoryEnum,
    PreferredContactEnum,
    PriceCurrencyEnum,
    ProductTypeEnum,
    RecurrenceTypeEnum,
    RefundStatusEnum,
    RoleEnum,
    SponsorshipStatusEnum,
    SponsorshipTargetTypeEnum,
    SponsorshipTierEnum,
    SubscriptionStatusEnum,
    TagColorEnum,
    TagTypeEnum,
    VisibilityEnum
} from '@repo/schemas';
import { pgEnum } from 'drizzle-orm/pg-core';
import { enumToTuple } from '../utils/enum-utils.ts';

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

export const DestinationTypePgEnum = pgEnum(
    'destination_type_enum',
    enumToTuple(DestinationTypeEnum)
);

export const PreferredContactPgEnum = pgEnum(
    'preferred_contact_enum',
    enumToTuple(PreferredContactEnum)
);

export const PriceCurrencyPgEnum = pgEnum('price_currency_enum', enumToTuple(PriceCurrencyEnum));

export const ProductTypePgEnum = pgEnum('product_type_enum', enumToTuple(ProductTypeEnum));

export const EntityTypePgEnum = pgEnum('entity_type_enum', enumToTuple(EntityTypeEnum));

export const EventCategoryPgEnum = pgEnum('event_category_enum', enumToTuple(EventCategoryEnum));

export const ExchangeRateSourcePgEnum = pgEnum(
    'exchange_rate_source_enum',
    enumToTuple(ExchangeRateSourceEnum)
);

export const ExchangeRateTypePgEnum = pgEnum(
    'exchange_rate_type_enum',
    enumToTuple(ExchangeRateTypeEnum)
);

export const LifecycleStatusPgEnum = pgEnum(
    'lifecycle_status_enum',
    enumToTuple(LifecycleStatusEnum)
);

export const PermissionPgEnum = pgEnum('permission_enum', enumToTuple(PermissionEnum));

export const PermissionEffectPgEnum = pgEnum(
    'permission_effect_enum',
    enumToTuple(PermissionEffectEnum)
);

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

export const NewsletterCampaignLocaleFilterPgEnum = pgEnum(
    'newsletter_campaign_locale_filter_enum',
    enumToTuple(NewsletterCampaignLocaleFilterEnum)
);

export const NewsletterCampaignStatusPgEnum = pgEnum(
    'newsletter_campaign_status_enum',
    enumToTuple(NewsletterCampaignStatusEnum)
);

export const NewsletterChannelPgEnum = pgEnum(
    'newsletter_channel_enum',
    enumToTuple(NewsletterChannelEnum)
);

export const NewsletterContentTypePgEnum = pgEnum(
    'newsletter_content_type_enum',
    enumToTuple(NewsletterContentTypeEnum)
);

export const NewsletterDeliveryStatusPgEnum = pgEnum(
    'newsletter_delivery_status_enum',
    enumToTuple(NewsletterDeliveryStatusEnum)
);

export const NewsletterSourcePgEnum = pgEnum(
    'newsletter_source_enum',
    enumToTuple(NewsletterSourceEnum)
);

export const NewsletterSubscriberStatusPgEnum = pgEnum(
    'newsletter_subscriber_status_enum',
    enumToTuple(NewsletterSubscriberStatusEnum)
);

export const TagColorPgEnum = pgEnum('tag_color_enum', enumToTuple(TagColorEnum));

export const TagTypePgEnum = pgEnum('tag_type', enumToTuple(TagTypeEnum));

export const VisibilityPgEnum = pgEnum('visibility_enum', enumToTuple(VisibilityEnum));

export const AuthProviderPgEnum = pgEnum('auth_provider_enum', enumToTuple(AuthProviderEnum));

export const EntityPermissionReasonPgEnum = pgEnum(
    'entity_permission_reason_enum',
    enumToTuple(EntityPermissionReasonEnum)
);

export const SponsorshipStatusPgEnum = pgEnum(
    'sponsorship_status_enum',
    enumToTuple(SponsorshipStatusEnum)
);

export const SponsorshipTargetTypePgEnum = pgEnum(
    'sponsorship_target_type_enum',
    enumToTuple(SponsorshipTargetTypeEnum)
);

export const SponsorshipTierPgEnum = pgEnum(
    'sponsorship_tier_enum',
    enumToTuple(SponsorshipTierEnum)
);

export const OwnerPromotionDiscountTypePgEnum = pgEnum(
    'owner_promotion_discount_type_enum',
    enumToTuple(OwnerPromotionDiscountTypeEnum)
);

export const BillingIntervalPgEnum = pgEnum(
    'billing_interval_enum',
    enumToTuple(BillingIntervalEnum)
);

export const SubscriptionStatusPgEnum = pgEnum(
    'subscription_status_enum',
    enumToTuple(SubscriptionStatusEnum)
);

export const PaymentStatusPgEnum = pgEnum('payment_status_enum', enumToTuple(PaymentStatusEnum));

export const InvoiceStatusPgEnum = pgEnum('invoice_status_enum', enumToTuple(InvoiceStatusEnum));

export const RefundStatusPgEnum = pgEnum('refund_status_enum', enumToTuple(RefundStatusEnum));

export const ConversationStatusPgEnum = pgEnum(
    'conversation_status_enum',
    enumToTuple(ConversationStatusEnum)
);

export const MessageStatusPgEnum = pgEnum('message_status_enum', enumToTuple(MessageStatusEnum));

export const MessageSenderTypePgEnum = pgEnum(
    'message_sender_type_enum',
    enumToTuple(MessageSenderTypeEnum)
);

export const NotificationRecipientSidePgEnum = pgEnum(
    'notification_recipient_side_enum',
    enumToTuple(NotificationRecipientSideEnum)
);
