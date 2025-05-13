import {
    AccommodationTypeEnum,
    AmenitiesTypeEnum,
    BuiltinPermissionTypeEnum,
    BuiltinRoleTypeEnum,
    ClientTypeEnum,
    EntityTypeEnum,
    EventCategoryEnum,
    PostCategoryEnum,
    PreferedContactEnum,
    PriceCurrencyEnum,
    RecurrenceTypeEnum,
    StateEnum,
    TagColorEnum,
    VisibilityEnum
} from '@repo/types';
import { pgEnum } from 'drizzle-orm/pg-core';
import { enumToTuple } from '../utils/db-utils';

/**
 * PostgreSQL native ENUM for entity types.
 */
export const EntityTypePgEnum = pgEnum('entity_type_enum', enumToTuple(EntityTypeEnum));

/**
 * PostgreSQL native ENUM for general state.
 */
export const StatePgEnum = pgEnum('state_enum', enumToTuple(StateEnum));

/**
 * PostgreSQL native ENUM for preferred contact methods.
 */
export const PreferedContactPgEnum = pgEnum(
    'prefered_contact_enum',
    enumToTuple(PreferedContactEnum)
);

/**
 * PostgreSQL native ENUM for price currency.
 */
export const PriceCurrencyPgEnum = pgEnum('price_currency_enum', enumToTuple(PriceCurrencyEnum));

/**
 * PostgreSQL native ENUM for tag colors.
 */
export const TagColorPgEnum = pgEnum('tag_color_enum', enumToTuple(TagColorEnum));

/**
 * PostgreSQL native ENUM for accommodation types.
 */
export const AccommodationTypePgEnum = pgEnum(
    'accommodation_type_enum',
    enumToTuple(AccommodationTypeEnum)
);

/**
 * PostgreSQL native ENUM for amenities categories.
 */
export const AmenitiesTypePgEnum = pgEnum('amenities_type_enum', enumToTuple(AmenitiesTypeEnum));

/**
 * PostgreSQL native ENUM for user roles.
 */
export const BuiltinRoleTypePgEnum = pgEnum(
    'builtin_role_type_enum',
    enumToTuple(BuiltinRoleTypeEnum)
);

/**
 * PostgreSQL native ENUM for permissions.
 */
export const BuiltinPermissionTypePgEnum = pgEnum(
    'builtin_permission_type_enum',
    enumToTuple(BuiltinPermissionTypeEnum)
);

/**
 * PostgreSQL native ENUM for post categories.
 */
export const PostCategoryPgEnum = pgEnum('post_category_enum', enumToTuple(PostCategoryEnum));

/**
 * PostgreSQL native ENUM for visibility settings.
 */
export const VisibilityPgEnum = pgEnum('visibility_enum', enumToTuple(VisibilityEnum));

/**
 * PostgreSQL native ENUM for recurrence types.
 */
export const RecurrenceTypePgEnum = pgEnum('recurrence_type_enum', enumToTuple(RecurrenceTypeEnum));

/**
 * PostgreSQL native ENUM for event categories.
 */
export const EventCategoryPgEnum = pgEnum('event_category_enum', enumToTuple(EventCategoryEnum));

/**
 * PostgreSQL native ENUM for client types.
 */
export const ClientTypePgEnum = pgEnum('client_type_enum', enumToTuple(ClientTypeEnum));
