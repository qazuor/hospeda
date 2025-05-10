import {
    AccommodationTypeEnum,
    AdChannelEnum,
    AdPlaceEnum,
    AmenitiesTypeEnum,
    CampaignStateEnum,
    ClientTypeEnum,
    EmailTemplateTypeEnum,
    EventCategoryEnum,
    MessageTypeEnum,
    NotificationChannelEnum,
    NotificationStateEnum,
    NotificationTypeEnum,
    PostCategoryEnum,
    PreferedContactEnum,
    PriceCurrencyEnum,
    RecurrenceTypeEnum,
    RoleTypeEnum,
    StateEnum,
    VisibilityEnum
} from '@repo/types';
import { z } from 'zod';

/**
 * General states used across most entities.
 */
export const StateEnumSchema = z.nativeEnum(StateEnum);

/**
 * Preferred contact method (email or phone).
 */
export const PreferedContactEnumSchema = z.nativeEnum(PreferedContactEnum);

/**
 * Accommodation types available in the system.
 */
export const AccommodationTypeEnumSchema = z.nativeEnum(AccommodationTypeEnum);

/**
 * Amenity categories used for classifying accommodation features.
 */
export const AmenitiesTypeEnumSchema = z.nativeEnum(AmenitiesTypeEnum);

/**
 * Role of a user within the system (used for access control).
 */
export const RoleTypeEnumSchema = z.nativeEnum(RoleTypeEnum);

/**
 * Categories for blog posts or articles.
 */
export const PostCategoryEnumSchema = z.nativeEnum(PostCategoryEnum);

/**
 * Visibility status (public, draft, private).
 */
export const VisibilityEnumSchema = z.nativeEnum(VisibilityEnum);

/**
 * Event recurrence frequency options.
 */
export const RecurrenceTypeEnumSchema = z.nativeEnum(RecurrenceTypeEnum);

/**
 * Categories used to classify events.
 */
export const EventCategoryEnumSchema = z.nativeEnum(EventCategoryEnum);

/**
 * System-defined notification types.
 */
export const NotificationTypeEnumSchema = z.nativeEnum(NotificationTypeEnum);

/**
 * Delivery status of notifications.
 */
export const NotificationStateEnumSchema = z.nativeEnum(NotificationStateEnum);

/**
 * Supported delivery channels for notifications.
 */
export const NotificationChannelEnumSchema = z.nativeEnum(NotificationChannelEnum);

/**
 * Types of clients (used in ads, sponsors, etc.).
 */
export const ClientTypeEnumSchema = z.nativeEnum(ClientTypeEnum);

/**
 * Email template categories for classification and reuse.
 */
export const EmailTemplateTypeEnumSchema = z.nativeEnum(EmailTemplateTypeEnum);

/**
 * Supported message types in the chat system.
 */
export const MessageTypeEnumSchema = z.nativeEnum(MessageTypeEnum);

/**
 * Campaign lifecycle states.
 */
export const CampaignStateEnumSchema = z.nativeEnum(CampaignStateEnum);

/**
 * Advertising delivery channels.
 */
export const AdChannelEnumSchema = z.nativeEnum(AdChannelEnum);

/**
 * Positions on the site where ads can be shown.
 */
export const AdPlaceEnumSchema = z.nativeEnum(AdPlaceEnum);

/**
 * Supported currencies for pricing fields.
 */
export const PriceCurrencyEnumSchema = z.nativeEnum(PriceCurrencyEnum);
