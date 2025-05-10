# Hospeda

Modern, minimalist web platform for discovering and managing tourist accommodations in Concepción del Uruguay and the Litoral region of Argentina, built with Astro, React, TanStack, Drizzle, and PostgreSQL in a TurboRepo-optimized monorepo.

## Types

### Enums

#### StateEnum

- ACTIVE
- INACTIVE
- PENDING
- DELETED

#### PreferedContactEnum

- HOME
- WORK
- MOBILE

#### AccommodationTypeEnum

- APARTMENT
- HOUSE
- COUNTRY_HOUSE
- CABIN
- HOTEL
- HOSTEL
- CAMPING
- ROOM

#### AmenitiesTypeEnum

- CLIMATE_CONTROL
- CONNECTIVITY
- ENTERTAINMENT
- KITCHEN
- BED_AND_BATH
- OUTDOORS
- ACCESSIBILITY
- PET_FRIENDLY
- SERVICES
- SAFETY
- FAMILY_FRIENDLY
- WORK_FRIENDLY
- GENERAL_APPLIANCES

#### RoleTypeEnum

- ADMIN
- EDITOR
- CLIENT
- USER

#### PostCategoryEnum

- EVENTS
- CULTURE
- GASTRONOMY
- NATURE
- TOURISM
- GENERAL
- SPORT

#### VisibilityEnum

- PUBLIC
- DRAFT
- PRIVATE

#### RecurrenceTypeEnum

- NONE
- DAILY
- WEEKLY
- MONTHLY
- YEARLY

#### EventCategoryEnum

- MUSIC
- CULTURE
- SPORTS
- GASTRONOMY
- FESTIVAL
- NATURE
- THEATER
- WORKSHOP
- OTHER

#### NotificationTypeEnum

- SYSTEM
- REMIINDER
- WARNING
- MARKETING
- PAYMENT
- RESERVATION
- CUSTOM

#### NotificationStateEnum

- PENDING
- SENT
- FAILED
- CANCELLED
- READED

#### NotificationChannelEnum

- EMAIL
- PUSH
- WHATSAPP
- SMS
- IN_APP

#### ClientTypeEnum

- POST_SPONSOR
- ADVERTISER
- HOST

#### EmailTemplateTypeEnum

- WELCOME
- BOOKING_CONFIRMATION
- PROMO
- NEWSLETTER
- MANUAL
- PASSWORD_RESET

#### MessageTypeEnum

- TEXT
- SYSTEM
- IMAGE
- BOOKING_REQUEST

#### CampaignStateEnum

- DRAFT
- SCHEDULED
- ACTIVE
- PAUSED
- COMPLETED

#### AdChannelEnum

- EMAIL
- PUSH
- WEB_BANNER
- LISTTING_BOOST
- SEARCH_BOOST
- FEATURED_BOOST
- SOCIAL_MEDIA

#### AdPlaceEnum

- ACCOMMODATION_LIST
- ACCOMMODATION_PAGE
- DESTINATION_LIST
- DESTINATION_PAGE
- HOME
- SEARCH
- BLOG_LIST
- BLOG_PAGE

### Common Types

#### BaseEntityType

- id: uuid
- name: string
- displayName: string
- state: StateEnum
- createdAt: date
- createdBy: UserType
- updatedAt: date
- updatedBy: UserType
- deletedAt: date
- deletedBy: UserType

#### ContactInfoType

- personalEmail: string
- workEmail?: string
- homePhone?: string
- workPhone?: string
- mobilePhone: string
- preferredEmail: PreferedContactEnum
- preferredPhone: PreferedContactEnum

#### LocationType

- street: string
- neighborhood?: string
- city: string
- state: string
- zipCode?: string
- country: string
- placeName?: string
- coordinates: CoordinatesType

#### CoordinatesType

- lat: string
- long: string

#### SocialNetworkType

- facebook?: string
- twitter?: string
- instagram?: string
- linkedIn?: string
- website?: string

#### BasePriceType

- price?: number
- currency?: string

#### ImageType

- url: string
- caption?: string
- description?: string
- tags?: string[]
- state: StateEnum

#### VideoType

- url: string
- caption?: string
- description?: string
- tags?: string[]
- state: StateEnum

#### SeoType

- seoTitle?: string
- seoDescription?: string
- seoKeywords?: string[]

#### AdminInfoType

- notes: string
- favorite: boolean
- tags: string[]

### Destinations Types

#### DestinationLocationType

- street: string
- neighborhood?: string
- city: string
- state: string
- zipCode?: string
- country: string
- placeName?: string
- coordinates: CoordinatesType

#### DestinationAttractionsType extends BaseEntityType

- name
- slug
- description
- icon

#### DestinationType extends BaseEntityType

- name: string
- longName: string
- slug: string
- summary: string
- description: string
- media: MediaType
- tags?: string[]
- isFeatured?: boolean
- visibility: VisibilityEnum
- seo?: SeoType
- adminInfo?: AdminInfoType
- rating?: RatingType
- reviews?: ReviewType[]
- location: DestinationLocationType
- attractions: DestinationAttractionsType

### Accomodation Types

#### OtherAdditionalFeesType

- name: string
- displayName: string
- value: number

#### OtherDiscountType

- name: string
- displayName: string
- value: number

#### AdditionalFeesType

- cleaning?: number
- taxPercent?: number
- lateCheckout?: number
- others?: OtherAdditionalFeesType[]

#### DiscountsType

- weekly?: number
- monthly?: number
- lastMinute?: number
- others?: OtherDiscountType[]

#### AccommodationPriceType

- basePrice: BasePriceType
- additionalFees?: AdditionalFeesType
- discounts?: DiscountsType

#### AmenitiesType

- name: string
- displayName: string
- optional: boolean
- additionalCost?: BasePriceType
- additionalCostPercent?: number
- description: string
- type?: AmenitiesTypeEnum

#### RatingType

- cleanliness: number
- hospitality: number
- services: number
- accuracy: number
- communication: number
- location: number

#### ScheduleType

- checkinTime? time
- checkoutTime?: time
- lateCheckout: boolean
- lateCheckoutTime: time
- selfCheckin: boolean
- selfCheckout: boolean

#### ExtraInfoType

- capacity: number
- minNights: number
- maxNights?: number;
- bedrooms: number
- beds?: number
- bathrooms: number
- petFriendly?: boolean
- smokingAllowed?: boolean
- extraRules?: string[]

#### MediaType

- featuredImage: ImageType
- gallery?: ImagesType[]
- videos?: VideoType[]

#### ReviewType

- author: uuid
- title: string
- content: string
- rating: RatingType

#### AccommodationFaqType extends BaseEntityType

- question: string
- answer: string
- adminInfo?: AdminInfoType

#### AccommodationIaDataType extends BaseEntityType

- title: string
- content: string
- adminInfo?: AdminInfoType

#### AccomodationType extends BaseEntityType

- slug: string
- type: AccommodationTypesEnum
- state: StateEnum
- destination: DestinationType
- description: string
- contactInfo: ContactInfoTpe
- socialNetworks: SocialNetworkType
- price: AccommodationPrice
- ownerId: string
- location: LocationType
- features: string[]
- amenities: AmenitiesType[]
- media: MediaType
- rating: RatingType
- reviews: ReviewType[]
- schedule: ScheduleType
- extraInfo: ExtraInfoType
- isFeatured?: boolean
- tags?: string[]
- seo?: SeoType
- adminInfo?: AdminInfoType
- faqs?: AccommodationFaqType[]
- iaData?: AccommodationIaDataType[]

### User Types

#### UserProfile

- avatar: string
- bio?: string
- website?: string
- occupation?: string

#### UserSettings

- darkMode?: boolean
- language?: string
- notificationsEnabled: boolean
- allowEmails: boolean
- allowSms: boolean
- allowPush: boolean

#### PermissionType

- id: uuid

#### RoleType

- id: uuid

#### UserType extends BaseEntityType

- userName: string
- passwordHash: string
- displayName: string
- firstName: string
- lastName: string
- brithDate: Date
- location: LocationType
- contactInfo: ContactInfoTpe
- socialNetworks: SocialNetworkType
- role: RoleTypeEnum
- state: StateType
- emailVerified: boolean
- phoneVerified: boolean
- profile?: UserProfile
- settings?: UserSettings
- bookmarks?: string[]
- adminInfo?: AdminInfoType

### events Types

#### EventDateType

- start: date
- end: date
- isAllDay?: boolean
- recurrence?: RecurrenceTypeEnum

#### EventPriceType

- isFree: boolean
- currency?: string
- priceFrom?: number
- priceTo?: number

#### EventOrganizerType

#### EventType extends BaseEntityType

- slug: string
- title: string
- description: string
- summary?: string
- media: MediaType
- category: EventCategoryEnum
- tags?: string[]
- location: LocationType
- date: EventDateType
- pricing?: EventPriceType
- organizer?: EventOrganizerType
- contact?: ContactInfoType
- media: MediaType
- tags?: string[]
- authorId: uuid
- isFeatured?: boolean
- visibility: VisibilityEnum
- seo?: SeoType
- adminInfo?: AdminInfoType

### notification Types

#### NotificationTargetType

<!-- #### NotificationTarget =
  | { type: 'all' }
  | { type: 'roles'; roles: UserRole[] }
  | { type: 'users'; userIds: string[] }
  | { type: 'user'; userId: string }; -->

- type: 'all' | 'roles' | 'user'
- roles?: UserRole[]
- userIds?: string[]
- userId?: string

#### NotificationType

- type: NotificationTypeEnum
- title: string
- message: string
- htmlMessage?: string
- channels: NotificationChannelEnum
- target: NotificationTargetType
- scheduledAt?: date
- sentAt?: date
- status: NotificationStateEnum
- metadata?: Record<string, unknown>

### Post Types

#### PostSponsorType extends BaseEntityType

- type: ClientTypeEnum
- name: string
- description: string
- logo?: ImageType
- social?: SocialNetworkType
- contact?: ContactInfoType
- tags: string[]
- state: StateEnum
- adminInfo?: AdminInfoType

#### PostSponsorshipType extends BaseEntityType

- sponsor?: PostSponsorType
- message?: string
- description: string
- tags: string[]
- paid: BasePriceType
- paidAt?: date
- fromDate?: date
- toDate?: date
- isHighlighted?: boolean\
- adminInfo?: AdminInfoType

#### PostType extends BaseEntityType

- slug: string
- category: PostCategoryEnum
- title: string
- summary: string
- content: string
- media: MediaType
- tags?: string[]
- authorId: uuid
- isFeatured?: boolean
- visibility: VisibilityEnum
- seo?: SeoType
- adminInfo?: AdminInfoType
- sponsorship?: PostSponsorshipType
- expiresAt?: date

### Ad Compaign Types

#### AdCampaignType extends BaseEntityType

- name: string
- sponsor: PostSponsorType
- description?: string
- startDate: date
- endDate?: date
- state: CampaignStateEnum
- channels: AdChannelEnum[]
- tags?: string[]
- webBannerPlace? AdPlaceEnum[]
- webBannerTemplate: string
- associatedPosts?: string[]
- associatedAccommodations?: string[]
- associatedEvents?: string[]
- adminInfo?: AdminInfoType

### Email Templates Types

#### EmailTemplateType extends BaseEntityType

- name: string;
- subject: string
- bodyHtml: string
- bodyText?: string
- tags?: string[]
- type: EmailTemplateTypeEnum
- isSystem: boolean
- owner?: uuid
- adminInfo?: AdminInfoType

### Chat Types

#### ChatThreadType extends BaseEntityType

- accommodation: uuid
- guestId: uuid
- hostId: uuid
- isArchived?: boolean
- isBlocked?: boolean

#### ChatMessageType extends BaseEntityType

- threadId: uuid
- senderId: uuid
- receiverId: uuid
- content: string
- sentAt: date
- readAt?: date
- type: MessageTypeEnum

## API End Points

### User API

- / [GET] (get entity list)
- / [POST] (create entity)
- /:id [GET] (get one entity by id)
- /:id [PUT] (update one entity by id)
- /:id [DELETE] (delete one entity by id)

### auth API

- /signin [POST] (login with email password)
- /signout [POST] (logout)
- /signup [POST] (register with email password)
- /reset-password [POST] (reset password)
- /google [POST] (login with google)
- /google/callback [POST] (google callback)
- /facebook [POST] (login with facebbok)
- /facebook/callback [POST] (facebook callback)

### Accomodation API

- / [GET] (get entity list)
- / [POST] (create entity)
- /:id [GET] (get one entity by id)
- /:id [PUT] (update one entity by id)
- /:id [DELETE] (delete one entity by id)

### news API

- / [GET] (get entity list)
- / [POST] (create entity)
- /:id [GET] (get one entity by id)
- /:id [PUT] (update one entity by id)
- /:id [DELETE] (delete one entity by id)

### events API

- / [GET] (get entity list)
- / [POST] (create entity)
- /:id [GET] (get one entity by id)
- /:id [PUT] (update one entity by id)
- /:id [DELETE] (delete one entity by id)

### notification API

- / [GET] (get entity list)
- / [POST] (create entity)
- /:id [GET] (get one entity by id)
- /:id [PUT] (update one entity by id)
- /:id [DELETE] (delete one entity by id)
- /:id/read [PATCH] (mark entity as read)

### Permission API

- / [GET] (get entity list)
- / [POST] (create entity)
- /:id [GET] (get one entity by id)
- /:id [PUT] (update one entity by id)
- /:id [DELETE] (delete one entity by id)

### Role API

- / [GET] (get entity list)
- / [POST] (create entity)
- /:id [GET] (get one entity by id)
- /:id [PUT] (update one entity by id)
- /:id [DELETE] (delete one entity by id)

### Post API

- / [GET] (get entity list)
- / [POST] (create entity)
- /:id [GET] (get one entity by id)
- /:id [PUT] (update one entity by id)
- /:id [DELETE] (delete one entity by id)

### email API

- /send-email [POST] (send a email)
