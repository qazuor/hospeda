import {
    AccommodationTypeEnum,
    AmenitiesTypeEnum,
    ClientTypeEnum,
    EntityTypeEnum,
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    PostCategoryEnum,
    PreferredContactEnum,
    PriceCurrencyEnum,
    RecurrenceTypeEnum,
    RoleEnum,
    TagColorEnum,
    VisibilityEnum
} from '@repo/types';
import { pgEnum } from 'drizzle-orm/pg-core';
import { enumToTuple } from '../utils/enum-utils';

export const AccommodationTypePgEnum = pgEnum(
    'accommodation_type_enum',
    enumToTuple(AccommodationTypeEnum)
);

export const AmenitiesTypePgEnum = pgEnum('amenities_type_enum', enumToTuple(AmenitiesTypeEnum));

export const ClientTypePgEnum = pgEnum('client_type_enum', enumToTuple(ClientTypeEnum));

export const PreferredContactPgEnum = pgEnum(
    'preferred_contact_enum',
    enumToTuple(PreferredContactEnum)
);

export const PriceCurrencyPgEnum = pgEnum('price_currency_enum', enumToTuple(PriceCurrencyEnum));

export const EntityTypePgEnum = pgEnum('entity_type_enum', enumToTuple(EntityTypeEnum));

export const EventCategoryPgEnum = pgEnum('event_category_enum', enumToTuple(EventCategoryEnum));

export const LifecycleStatusPgEnum = pgEnum(
    'lifecycle_status_enum',
    enumToTuple(LifecycleStatusEnum)
);

export const PermissionPgEnum = pgEnum('permission_enum', enumToTuple(PermissionEnum));

export const PostCategoryPgEnum = pgEnum('post_category_enum', enumToTuple(PostCategoryEnum));

export const RecurrenceTypePgEnum = pgEnum('recurrence_type_enum', enumToTuple(RecurrenceTypeEnum));

export const RolePgEnum = pgEnum('role_enum', enumToTuple(RoleEnum));

export const ModerationStatusPgEnum = pgEnum(
    'moderation_status_enum',
    enumToTuple(ModerationStatusEnum)
);

export const TagColorPgEnum = pgEnum('tag_color_enum', enumToTuple(TagColorEnum));

export const VisibilityPgEnum = pgEnum('visibility_enum', enumToTuple(VisibilityEnum));
