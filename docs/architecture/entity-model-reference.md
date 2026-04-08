# Entity Model Reference

Complete domain entity tree for the Hospeda platform. All entities from `@repo/schemas` with nested sub-entities expanded inline.

**Last updated**: 2026-04-07

---

## Table of Contents

- [User](#user)
- [Accommodation](#accommodation)
- [Destination](#destination)
- [Post](#post)
- [Event](#event)
- [Tag](#tag)
- [Attraction](#attraction)
- [Amenity](#amenity)
- [AccommodationAmenityRelation](#accommodationamenityrelation)
- [Feature](#feature)
- [AccommodationFeatureRelation](#accommodationfeaturerelation)
- [AccommodationReview](#accommodationreview)
- [DestinationReview](#destinationreview)
- [Sponsorship](#sponsorship)
- [SponsorshipLevel](#sponsorshiplevel)
- [SponsorshipPackage](#sponsorshippackage)
- [PostSponsorship](#postsponsorship)
- [PostSponsor](#postsponsor)
- [OwnerPromotion](#ownerpromotion)
- [UserBookmark](#userbookmark)
- [ExchangeRate](#exchangerate)
- [RevalidationLog](#revalidationlog)

---

## User

```
User:
 - id (uuid)
 - slug (string) -> min 1
 - email (string) -> valid email
 - emailVerified (boolean) -> default false
 - image (string) -> URL, nullable
 - banned (boolean) -> default false
 - banReason (string) -> nullable
 - banExpires (Date) -> nullable
 - authProvider (enum: GOOGLE, GITHUB, CREDENTIALS) -> optional
 - authProviderUserId (string) -> optional
 - displayName (string) -> 2-50, optional
 - firstName (string) -> 2-50, nullable
 - lastName (string) -> 2-50, nullable
 - birthDate (Date) -> nullable
 - role (enum: USER, OWNER, MODERATOR, ADMIN, SUPER_ADMIN)
 - permissions (PermissionEnum[]) -> default []
 - profile (object) -> nullable
   - avatar (string) -> URL, optional
   - bio (string) -> 10-300, optional
   - website (string) -> URL, optional
   - occupation (string) -> 2-100, optional
 - settings (object) -> optional
   - darkMode (boolean) -> optional
   - language (string) -> 2-10, optional
   - notifications (object)
     - enabled (boolean)
     - allowEmails (boolean)
     - allowSms (boolean)
     - allowPush (boolean)
 - bookmarks (UserBookmark[]) -> optional
   - id (uuid)
   - userId (uuid) -> circular ref a User
   - entityId (uuid) -> polimorphic
   - entityType (enum: ACCOMMODATION, DESTINATION, EVENT, POST, ATTRACTION)
   - name (string) -> 3-100, optional
   - description (string) -> 10-300, optional
   - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
   - adminInfo (object) -> nullable
     - notes (string) -> 5-300, optional
     - favorite (boolean) -> default false
     - passwordChangeRequired (boolean) -> optional
   - createdAt (Date)
   - updatedAt (Date)
   - createdById (uuid) -> nullable
   - updatedById (uuid) -> nullable
   - deletedAt (Date) -> nullable
   - deletedById (uuid) -> nullable
 - contactInfo (object) -> nullable
   - personalEmail (string) -> optional
   - workEmail (string) -> optional
   - homePhone (string) -> intl regex, optional
   - workPhone (string) -> intl regex, optional
   - mobilePhone (string) -> intl regex, required
   - website (string) -> URL, optional
   - preferredEmail (enum: PERSONAL, WORK) -> optional
   - preferredPhone (enum: HOME, WORK, MOBILE) -> optional
 - location (object) -> nullable
   - street (string) -> 2-50
   - number (string) -> 1-10
   - floor (string) -> 1-10, optional
   - apartment (string) -> 1-10, optional
   - neighborhood (string) -> 2-50, optional
   - city (string) -> 2-50
   - department (string) -> 2-50, optional
   - state (string) -> 2-50, nullable
   - zipCode (string) -> 1-20, nullable
   - country (string) -> 2-50, nullable
   - coordinates (object) -> optional
     - lat (string)
     - long (string)
 - socialNetworks (object) -> nullable
   - facebook (string) -> URL + regex, optional
   - instagram (string) -> URL + regex, optional
   - twitter (string) -> URL + regex, optional
   - linkedIn (string) -> URL + regex, optional
   - tiktok (string) -> URL + regex, optional
   - youtube (string) -> URL + regex, optional
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
 - visibility (enum: PUBLIC, PRIVATE, RESTRICTED) -> default PUBLIC
 - adminInfo (object) -> nullable
   - notes (string) -> 5-300, optional
   - favorite (boolean) -> default false
   - passwordChangeRequired (boolean) -> optional
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## Accommodation

```
Accommodation:
 - id (uuid)
 - slug (string) -> 3-50
 - name (string) -> 3-100
 - summary (string) -> 10-300
 - description (string) -> 30-2000
 - isFeatured (boolean) -> default false
 - type (enum: HOTEL, HOSTEL, APARTMENT, VILLA, COTTAGE, RESORT, etc.)
 - owner (User)
   - id (uuid)
   - slug (string)
   - email (string)
   - displayName (string) -> 2-50, optional
   - firstName (string) -> nullable
   - lastName (string) -> nullable
   - role (enum: USER, OWNER, MODERATOR, ADMIN, SUPER_ADMIN)
   - image (string) -> URL, nullable
   - profile (object) -> nullable
     - avatar (string) -> URL, optional
     - bio (string) -> 10-300, optional
     - website (string) -> URL, optional
     - occupation (string) -> 2-100, optional
   - contactInfo (object) -> nullable
     - personalEmail (string) -> optional
     - workEmail (string) -> optional
     - homePhone (string) -> intl regex, optional
     - workPhone (string) -> intl regex, optional
     - mobilePhone (string) -> intl regex, required
     - website (string) -> URL, optional
     - preferredEmail (enum: PERSONAL, WORK) -> optional
     - preferredPhone (enum: HOME, WORK, MOBILE) -> optional
   - socialNetworks (object) -> nullable
     - facebook, instagram, twitter, linkedIn, tiktok, youtube (string URLs)
   - location (object) -> nullable
     - street, number, floor, apartment, neighborhood, city, department, state, zipCode, country (strings)
     - coordinates (object) -> optional
       - lat (string)
       - long (string)
   - [+ remaining User base fields: lifecycle, visibility, admin, audit]
 - destination (Destination)
   - id (uuid)
   - slug (string) -> 3-50
   - name (string) -> 3-100
   - summary (string) -> 10-300
   - description (string) -> 30-2000
   - destinationType (enum: COUNTRY, REGION, PROVINCE, DEPARTMENT, CITY, TOWN, NEIGHBORHOOD)
   - level (number) -> 0-6
   - path (string) -> regex /^\/[a-z0-9-/]+$/
   - pathIds (string) -> max 2000
   - parentDestinationId (uuid) -> nullable, hierarchical self-ref
   - isFeatured (boolean) -> default false
   - accommodationsCount (number) -> default 0
   - location (object) -> optional
     - state, zipCode, country (strings, nullable)
     - coordinates (object) -> optional
   - media (object) -> optional
     - featuredImage, gallery[], videos[]
   - rating (object) -> computed
     - landscape, attractions, accessibility, safety, cleanliness, hospitality (0-5)
     - culturalOffer, gastronomy, affordability, nightlife, infrastructure (0-5)
     - environmentalCare, wifiAvailability, shopping, beaches, greenSpaces (0-5)
     - localEvents, weatherSatisfaction (0-5)
   - [+ seo, tags, adminInfo, moderation, visibility, lifecycle, audit fields]
 - tags (Tag[]) -> optional
   - id (uuid)
   - name (string) -> 2-50
   - slug (string) -> min 1
   - color (enum: RED, BLUE, GREEN, YELLOW, PURPLE, ORANGE, PINK)
   - icon (string) -> 2-100, nullable
   - notes (string) -> 5-300, nullable
   - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED)
   - createdAt (Date)
   - updatedAt (Date)
   - createdById (uuid) -> nullable
   - updatedById (uuid) -> nullable
   - deletedAt (Date) -> nullable
   - deletedById (uuid) -> nullable
 - iaData (AccommodationIaData[]) -> optional
   - title (string) -> 3-200
   - content (string) -> 10-2000
   - category (string) -> 2-100, optional
   - createdAt (Date)
   - updatedAt (Date)
   - createdById (uuid) -> nullable
   - updatedById (uuid) -> nullable
   - lifecycleState (enum) -> default ACTIVE
   - adminInfo (object) -> nullable
 - faqs (BaseFaq[]) -> optional
   - question (string) -> 10-300
   - answer (string) -> 10-2000
   - category (string) -> 2-100, optional
   - createdAt (Date)
   - updatedAt (Date)
   - createdById (uuid) -> nullable
   - updatedById (uuid) -> nullable
   - lifecycleState (enum) -> default ACTIVE
 - price (object) -> optional
   - price (number) -> positive, optional
   - currency (enum: ARS, USD, EUR, BRL, etc.) -> optional
   - additionalFees (object) -> optional
     - cleaning (object) -> isIncluded, isOptional, isPercent, isPerStay, isPerNight, isPerGuest
     - tax (object) -> same structure
     - lateCheckout (object) -> same structure
     - pets (object) -> same structure
     - bedlinen (object) -> same structure
     - towels (object) -> same structure
     - babyCrib (object) -> same structure
     - babyHighChair (object) -> same structure
     - extraBed (object) -> same structure
     - securityDeposit (object) -> same structure
     - extraGuest (object) -> same structure
     - parking (object) -> same structure
     - earlyCheckin (object) -> same structure
     - lateCheckin (object) -> same structure
     - luggageStorage (object) -> same structure
     - others (array) -> custom fee objects with name
   - discounts (object) -> optional
     - weekly (object) -> same flags as fees
     - monthly (object) -> same structure
     - lastMinute (object) -> same structure
     - others (array) -> custom discount objects with name
 - rating (object) -> computed
   - cleanliness (number) -> 0-5
   - hospitality (number) -> 0-5
   - services (number) -> 0-5
   - accuracy (number) -> 0-5
   - communication (number) -> 0-5
   - location (number) -> 0-5
 - extraInfo (object) -> optional
   - capacity (number) -> integer
   - minNights (number) -> integer
   - maxNights (number) -> integer, optional
   - bedrooms (number) -> integer
   - beds (number) -> integer, optional
   - bathrooms (number) -> integer
   - smokingAllowed (boolean) -> optional
   - extraInfo (string[]) -> optional
 - contactInfo (object) -> nullable
   - personalEmail (string) -> optional
   - workEmail (string) -> optional
   - homePhone (string) -> intl regex, optional
   - workPhone (string) -> intl regex, optional
   - mobilePhone (string) -> intl regex, required
   - website (string) -> URL, optional
   - preferredEmail (enum: PERSONAL, WORK) -> optional
   - preferredPhone (enum: HOME, WORK, MOBILE) -> optional
 - location (object) -> optional
   - state (string) -> 2-50, nullable
   - zipCode (string) -> 1-20, nullable
   - country (string) -> 2-50, nullable
   - coordinates (object) -> optional
     - lat (string)
     - long (string)
 - media (object) -> optional
   - featuredImage (object) -> optional
     - url (string) -> URL
     - caption (string) -> 3-100, optional
     - description (string) -> 10-300, optional
     - moderationState (enum: PENDING, APPROVED, REJECTED, HIDDEN)
   - gallery (MediaItem[]) -> optional
     - url (string) -> URL
     - caption (string) -> 3-100, optional
     - description (string) -> 10-300, optional
     - moderationState (enum: PENDING, APPROVED, REJECTED, HIDDEN)
   - videos (MediaItem[]) -> optional
     - url (string) -> URL
     - caption (string) -> 3-100, optional
     - description (string) -> 10-300, optional
     - moderationState (enum: PENDING, APPROVED, REJECTED, HIDDEN)
 - seo (object) -> optional
   - title (string) -> 30-60, optional
   - description (string) -> 70-160, optional
   - keywords (string[]) -> optional
 - adminInfo (object) -> nullable
   - notes (string) -> 5-300, optional
   - favorite (boolean) -> default false
   - passwordChangeRequired (boolean) -> optional
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
 - moderationState (enum: PENDING, APPROVED, REJECTED, HIDDEN) -> default PENDING
 - visibility (enum: PUBLIC, PRIVATE, RESTRICTED) -> default PUBLIC
 - reviewsCount (number) -> min 0, default 0, computed
 - averageRating (number) -> 0-5, default 0, computed
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## Destination

```
Destination:
 - id (uuid)
 - slug (string) -> 3-50
 - name (string) -> 3-100
 - summary (string) -> 10-300
 - description (string) -> 30-2000
 - destinationType (enum: COUNTRY, REGION, PROVINCE, DEPARTMENT, CITY, TOWN, NEIGHBORHOOD)
 - level (number) -> 0-6, depth in hierarchy
 - path (string) -> regex /^\/[a-z0-9-/]+$/, 1-500
 - pathIds (string) -> max 2000, pipe-delimited ancestor IDs
 - isFeatured (boolean) -> default false
 - accommodationsCount (number) -> min 0, default 0
 - parentDestination (Destination) -> nullable, hierarchical self-reference
   - id (uuid)
   - name (string) -> 3-100
   - slug (string) -> 3-50
   - destinationType (enum)
   - level (number) -> 0-6
   - path (string)
   - parentDestinationId (uuid) -> nullable, recursive (not expanded further)
   - [+ base fields]
 - attractions (Attraction[]) -> optional
   - id (uuid)
   - name (string) -> 3-100
   - slug (string) -> 3-100, nullable, regex
   - description (string) -> 10-500
   - icon (string) -> 1-100
   - destinationId (uuid) -> nullable, ref to this Destination
   - isFeatured (boolean) -> default false
   - isBuiltin (boolean) -> default false, system attractions
   - displayWeight (number) -> 1-100, default 50
   - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
   - adminInfo (object) -> nullable
     - notes (string) -> 5-300, optional
     - favorite (boolean) -> default false
   - createdAt (Date)
   - updatedAt (Date)
   - createdById (uuid) -> nullable
   - updatedById (uuid) -> nullable
   - deletedAt (Date) -> nullable
   - deletedById (uuid) -> nullable
 - reviews (DestinationReview[]) -> optional
   - id (uuid)
   - user (User)
     - id (uuid)
     - displayName (string)
     - image (string) -> URL, nullable
     - [+ full User fields]
   - title (string) -> 1-50, optional
   - content (string) -> 10-500, optional
   - rating (object)
     - landscape (0-5)
     - attractions (0-5)
     - accessibility (0-5)
     - safety (0-5)
     - cleanliness (0-5)
     - hospitality (0-5)
     - culturalOffer (0-5)
     - gastronomy (0-5)
     - affordability (0-5)
     - nightlife (0-5)
     - infrastructure (0-5)
     - environmentalCare (0-5)
     - wifiAvailability (0-5)
     - shopping (0-5)
     - beaches (0-5)
     - greenSpaces (0-5)
     - localEvents (0-5)
     - weatherSatisfaction (0-5)
   - averageRating (number) -> 0-5, computed
   - visitDate (Date) -> optional
   - tripType (string) -> optional
   - travelSeason (string) -> optional
   - isBusinessTravel (boolean) -> default false
   - language (string) -> ISO 639-1, optional
   - isVerified (boolean) -> default false
   - isPublished (boolean) -> default false
   - isRecommended (boolean) -> default true
   - wouldVisitAgain (boolean) -> default true
   - helpfulVotes (number) -> default 0
   - totalVotes (number) -> default 0
   - hasOwnerResponse (boolean) -> default false
   - adminInfo (object) -> nullable
   - createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById
 - rating (object) -> computed, aggregate from reviews
   - landscape (number) -> 0-5
   - attractions (number) -> 0-5
   - accessibility (number) -> 0-5
   - safety (number) -> 0-5
   - cleanliness (number) -> 0-5
   - hospitality (number) -> 0-5
   - culturalOffer (number) -> 0-5
   - gastronomy (number) -> 0-5
   - affordability (number) -> 0-5
   - nightlife (number) -> 0-5
   - infrastructure (number) -> 0-5
   - environmentalCare (number) -> 0-5
   - wifiAvailability (number) -> 0-5
   - shopping (number) -> 0-5
   - beaches (number) -> 0-5
   - greenSpaces (number) -> 0-5
   - localEvents (number) -> 0-5
   - weatherSatisfaction (number) -> 0-5
 - tags (Tag[]) -> optional
   - [same Tag structure as Accommodation]
 - location (object) -> optional
   - state (string) -> 2-50, nullable
   - zipCode (string) -> 1-20, nullable
   - country (string) -> 2-50, nullable
   - coordinates (object) -> optional
     - lat (string)
     - long (string)
 - media (object) -> optional
   - [same structure as Accommodation.media]
 - seo (object) -> optional
   - title (string) -> 30-60
   - description (string) -> 70-160
   - keywords (string[]) -> optional
 - adminInfo (object) -> nullable
   - notes (string) -> 5-300, optional
   - favorite (boolean) -> default false
   - passwordChangeRequired (boolean) -> optional
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
 - moderationState (enum: PENDING, APPROVED, REJECTED, HIDDEN) -> default PENDING
 - visibility (enum: PUBLIC, PRIVATE, RESTRICTED) -> default PUBLIC
 - reviewsCount (number) -> min 0, default 0, computed
 - averageRating (number) -> 0-5, default 0, computed
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## Post

```
Post:
 - id (uuid)
 - slug (string) -> min 1
 - title (string) -> 3-150
 - summary (string) -> 10-300
 - content (string) -> 100-50000
 - category (enum: TRAVEL_TIPS, GUIDES, NEWS, REVIEWS, EVENTS, ACCOMMODATIONS, DESTINATIONS)
 - isFeatured (boolean) -> default false
 - isFeaturedInWebsite (boolean) -> default false
 - isNews (boolean) -> default false
 - expiresAt (Date) -> optional
 - publishedAt (Date) -> optional
 - readingTimeMinutes (number) -> min 0, default 5
 - likes (number) -> min 0, default 0
 - comments (number) -> min 0, default 0
 - shares (number) -> min 0, default 0
 - author (User)
   - id (uuid)
   - displayName (string) -> 2-50
   - image (string) -> URL, nullable
   - slug (string)
   - role (enum)
   - [+ full User fields]
 - relatedDestination (Destination) -> optional
   - id (uuid)
   - name (string) -> 3-100
   - slug (string) -> 3-50
   - destinationType (enum)
   - [+ full Destination fields]
 - relatedAccommodation (Accommodation) -> optional
   - id (uuid)
   - name (string) -> 3-100
   - slug (string) -> 3-50
   - type (enum)
   - [+ full Accommodation fields]
 - relatedEvent (Event) -> optional
   - id (uuid)
   - name (string) -> 3-100
   - slug (string)
   - category (enum)
   - [+ full Event fields]
 - sponsorship (PostSponsorship) -> optional
   - id (uuid)
   - sponsor (PostSponsor)
     - id (uuid)
     - name (string) -> 3-100
     - type (enum: COMPANY, INDIVIDUAL, ORGANIZATION)
     - description (string) -> 10-500
     - logo (object) -> nullable
       - url (string) -> URL
       - caption (string) -> optional
       - description (string) -> optional
       - moderationState (string) -> optional
     - contactInfo (object) -> nullable
       - [same structure as User.contactInfo]
     - socialNetworks (object) -> nullable
       - [same structure as User.socialNetworks]
     - lifecycleState (enum) -> default ACTIVE
     - adminInfo (object) -> nullable
     - createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById
   - postId (uuid) -> circular ref to this Post
   - message (string) -> 5-50, optional
   - description (string) -> 10-500
   - paid (object)
     - price (number) -> positive
     - currency (enum: ARS, USD, EUR, BRL, etc.)
   - paidAt (Date) -> optional
   - fromDate (Date) -> optional
   - toDate (Date) -> optional
   - isHighlighted (boolean) -> default false
   - lifecycleState (enum) -> default ACTIVE
   - adminInfo (object) -> nullable
   - createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById
 - tags (Tag[]) -> optional
   - [same Tag structure]
 - media (object) -> optional
   - [same structure as Accommodation.media]
 - seo (object) -> optional
   - title (string) -> 30-60
   - description (string) -> 70-160
   - keywords (string[]) -> optional
 - adminInfo (object) -> nullable
   - notes (string) -> 5-300, optional
   - favorite (boolean) -> default false
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
 - moderationState (enum: PENDING, APPROVED, REJECTED, HIDDEN) -> default PENDING
 - visibility (enum: PUBLIC, PRIVATE, RESTRICTED) -> default PUBLIC
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## Event

```
Event:
 - id (uuid)
 - slug (string) -> min 1
 - name (string) -> 3-100
 - summary (string) -> 10-300
 - description (string) -> 50-5000, optional
 - category (enum: CONFERENCE, FESTIVAL, MEETING, NETWORKING, ENTERTAINMENT, SPORTS, etc.)
 - isFeatured (boolean) -> default false
 - date (object)
   - start (Date) -> coerced
   - end (Date) -> optional, coerced
   - isAllDay (boolean) -> optional
   - recurrence (enum: DAILY, WEEKLY, MONTHLY, YEARLY) -> optional
 - pricing (object) -> optional
   - price (number) -> positive, optional
   - currency (enum) -> optional
   - isFree (boolean)
   - priceFrom (number) -> positive, optional
   - priceTo (number) -> positive, optional
   - pricePerGroup (number) -> positive, optional
   - earlyBirdPrice (number) -> positive, optional
   - earlyBirdDeadline (Date) -> optional
   - groupDiscountThreshold (number) -> min 2, optional
   - groupDiscountPercent (number) -> 0-100, optional
 - author (User)
   - id (uuid)
   - displayName (string)
   - image (string) -> URL, nullable
   - [+ full User fields]
 - location (EventLocation) -> optional
   - id (uuid)
   - slug (string) -> 2-100, regex
   - placeName (string) -> 2-100, nullable
   - street (string) -> 2-50, nullable
   - number (string) -> 1-10, nullable
   - floor (string) -> nullable
   - apartment (string) -> nullable
   - neighborhood (string) -> 2-50, nullable
   - city (string) -> 2-50
   - department (string) -> 2-50, nullable
   - state (string) -> 2-50, nullable
   - zipCode (string) -> 1-20, nullable
   - country (string) -> 2-50, nullable
   - coordinates (object) -> optional
     - lat (string)
     - long (string)
   - lifecycleState (enum) -> default ACTIVE
   - adminInfo (object) -> nullable
   - createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById
 - organizer (EventOrganizer) -> optional
   - id (uuid)
   - name (string) -> 3-100
   - slug (string) -> 3-100, regex
   - description (string) -> 10-500, nullable
   - logo (string) -> URL, nullable
   - contactInfo (object) -> nullable
     - [same structure as User.contactInfo]
   - socialNetworks (object) -> nullable
     - [same structure as User.socialNetworks]
   - lifecycleState (enum) -> default ACTIVE
   - adminInfo (object) -> nullable
   - createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById
 - tags (Tag[]) -> optional
   - [same Tag structure]
 - contactInfo (object) -> nullable
   - [same structure as User.contactInfo]
 - media (object) -> optional
   - [same structure as Accommodation.media]
 - seo (object) -> optional
   - title (string) -> 30-60
   - description (string) -> 70-160
   - keywords (string[]) -> optional
 - adminInfo (object) -> nullable
   - notes (string) -> 5-300, optional
   - favorite (boolean) -> default false
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
 - moderationState (enum: PENDING, APPROVED, REJECTED, HIDDEN) -> default PENDING
 - visibility (enum: PUBLIC, PRIVATE, RESTRICTED) -> default PUBLIC
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## Tag

```
Tag:
 - id (uuid)
 - name (string) -> 2-50
 - slug (string) -> min 1
 - color (enum: RED, BLUE, GREEN, YELLOW, PURPLE, ORANGE, PINK)
 - icon (string) -> 2-100, nullable
 - notes (string) -> 5-300, nullable
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED)
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## Attraction

```
Attraction:
 - id (uuid)
 - name (string) -> 3-100
 - slug (string) -> 3-100, nullable, regex
 - description (string) -> 10-500
 - icon (string) -> 1-100
 - destination (Destination) -> nullable
   - id (uuid)
   - name (string) -> 3-100
   - slug (string) -> 3-50
   - destinationType (enum)
   - [+ full Destination fields, no recursive expansion]
 - isFeatured (boolean) -> default false
 - isBuiltin (boolean) -> default false, system attractions
 - displayWeight (number) -> 1-100, default 50
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
 - adminInfo (object) -> nullable
   - notes (string) -> 5-300, optional
   - favorite (boolean) -> default false
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## Amenity

```
Amenity:
 - id (uuid)
 - slug (string) -> 3-100, nullable, regex
 - name (string) -> 2-100
 - description (string) -> 10-500, nullable
 - icon (string) -> 2-100, nullable
 - type (enum: KITCHEN, BEDROOMS, BATHROOMS, ENTERTAINMENT, OUTDOOR, UTILITIES, SERVICES, BUSINESS, SAFETY)
 - isBuiltin (boolean) -> default false
 - isFeatured (boolean) -> default false
 - displayWeight (number) -> 1-100, default 50
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
 - adminInfo (object) -> nullable
   - notes (string) -> 5-300, optional
   - favorite (boolean) -> default false
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## AccommodationAmenityRelation

Junction table for M:N relationship between Accommodation and Amenity.

```
AccommodationAmenityRelation:
 - accommodationId (uuid) -> fk to Accommodation
 - amenityId (uuid) -> fk to Amenity
 - amenity (Amenity)
   - [full Amenity structure]
 - isOptional (boolean) -> default false
 - additionalCost (object) -> optional
   - price (number) -> positive, optional
   - currency (enum) -> optional
 - additionalCostPercent (number) -> 0-100, optional
```

---

## Feature

```
Feature:
 - id (uuid)
 - slug (string) -> 3-100, regex
 - name (string) -> 2-100
 - description (string) -> 10-500, nullable
 - icon (string) -> 1-100, nullable
 - isBuiltin (boolean) -> default false
 - isFeatured (boolean) -> default false
 - displayWeight (number) -> 1-100, default 50
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
 - adminInfo (object) -> nullable
   - notes (string) -> 5-300, optional
   - favorite (boolean) -> default false
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## AccommodationFeatureRelation

Junction table for M:N relationship between Accommodation and Feature.

```
AccommodationFeatureRelation:
 - accommodationId (uuid) -> fk to Accommodation
 - featureId (uuid) -> fk to Feature
 - feature (Feature)
   - [full Feature structure]
 - hostReWriteName (string) -> 3-100, optional, host custom name
 - comments (string) -> 5-300, optional
```

---

## AccommodationReview

```
AccommodationReview:
 - id (uuid)
 - user (User)
   - id (uuid)
   - displayName (string)
   - image (string) -> URL, nullable
   - [+ full User fields]
 - accommodation (Accommodation)
   - id (uuid)
   - name (string) -> 3-100
   - slug (string) -> 3-50
   - type (enum)
   - [+ full Accommodation fields, no recursive expansion]
 - title (string) -> 1-200, optional
 - content (string) -> 10-2000, optional
 - rating (object)
   - cleanliness (number) -> 0-5
   - hospitality (number) -> 0-5
   - services (number) -> 0-5
   - accuracy (number) -> 0-5
   - communication (number) -> 0-5
   - location (number) -> 0-5
 - averageRating (number) -> 0-5, default 0, computed by DB trigger
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
 - adminInfo (object) -> nullable
   - notes (string) -> 5-300, optional
   - favorite (boolean) -> default false
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## DestinationReview

```
DestinationReview:
 - id (uuid)
 - user (User)
   - id (uuid)
   - displayName (string)
   - image (string) -> URL, nullable
   - [+ full User fields]
 - destination (Destination)
   - id (uuid)
   - name (string) -> 3-100
   - slug (string) -> 3-50
   - destinationType (enum)
   - [+ full Destination fields, no recursive expansion]
 - title (string) -> 1-50, optional
 - content (string) -> 10-500, optional
 - rating (object)
   - landscape (number) -> 0-5
   - attractions (number) -> 0-5
   - accessibility (number) -> 0-5
   - safety (number) -> 0-5
   - cleanliness (number) -> 0-5
   - hospitality (number) -> 0-5
   - culturalOffer (number) -> 0-5
   - gastronomy (number) -> 0-5
   - affordability (number) -> 0-5
   - nightlife (number) -> 0-5
   - infrastructure (number) -> 0-5
   - environmentalCare (number) -> 0-5
   - wifiAvailability (number) -> 0-5
   - shopping (number) -> 0-5
   - beaches (number) -> 0-5
   - greenSpaces (number) -> 0-5
   - localEvents (number) -> 0-5
   - weatherSatisfaction (number) -> 0-5
 - averageRating (number) -> 0-5, computed by DB trigger
 - visitDate (Date) -> optional
 - tripType (string) -> optional (FAMILY, ROMANTIC, BUSINESS, SOLO, GROUP)
 - travelSeason (string) -> optional (SUMMER, WINTER, SPRING, AUTUMN)
 - isBusinessTravel (boolean) -> default false
 - language (string) -> ISO 639-1, 2 chars, optional
 - isVerified (boolean) -> default false
 - isPublished (boolean) -> default false
 - isRecommended (boolean) -> default true
 - wouldVisitAgain (boolean) -> default true
 - helpfulVotes (number) -> min 0, default 0
 - totalVotes (number) -> min 0, default 0
 - hasOwnerResponse (boolean) -> default false
 - adminInfo (object) -> nullable
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## Sponsorship

```
Sponsorship:
 - id (uuid)
 - slug (string) -> min 1
 - sponsorUser (User)
   - id (uuid)
   - displayName (string)
   - email (string)
   - [+ full User fields]
 - targetType (enum: ACCOMMODATION, DESTINATION, EVENT, POST) -> sponsored entity type
 - targetId (uuid) -> polymorphic, points to entity based on targetType
 - level (SponsorshipLevel)
   - id (uuid)
   - slug (string)
   - name (string) -> 1-100
   - description (string) -> max 500, nullable
   - targetType (enum: ACCOMMODATION, DESTINATION, EVENT, POST)
   - tier (enum: BRONZE, SILVER, GOLD, PLATINUM, DIAMOND)
   - priceAmount (number) -> integer, min 0, in centavos
   - priceCurrency (string) -> default ARS
   - benefits (SponsorshipBenefit[])
     - key (string)
     - label (string)
     - description (string) -> optional
   - sortOrder (number) -> integer, default 0
   - isActive (boolean) -> default true
   - createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById
 - package (SponsorshipPackage) -> nullable
   - id (uuid)
   - slug (string)
   - name (string) -> 1-100
   - description (string) -> max 500, nullable
   - priceAmount (number) -> integer, min 0
   - priceCurrency (string) -> default ARS
   - includedPosts (number) -> integer, min 0
   - includedEvents (number) -> integer, min 0
   - eventLevelId (uuid) -> nullable, fk to SponsorshipLevel
   - isActive (boolean) -> default true
   - sortOrder (number) -> integer, default 0
   - createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById
 - status (enum: PENDING, ACTIVE, PAUSED, EXPIRED, REJECTED, CANCELLED) -> default PENDING
 - startsAt (Date)
 - endsAt (Date) -> nullable
 - paymentId (string) -> nullable
 - logoUrl (string) -> URL, nullable
 - linkUrl (string) -> URL, nullable
 - couponCode (string) -> nullable
 - couponDiscountPercent (number) -> 0-100, nullable
 - analytics (object)
   - impressions (number) -> min 0, default 0
   - clicks (number) -> min 0, default 0
   - couponsUsed (number) -> min 0, default 0
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## SponsorshipLevel

```
SponsorshipLevel:
 - id (uuid)
 - slug (string) -> min 1
 - name (string) -> 1-100
 - description (string) -> max 500, nullable
 - targetType (enum: ACCOMMODATION, DESTINATION, EVENT, POST)
 - tier (enum: BRONZE, SILVER, GOLD, PLATINUM, DIAMOND)
 - priceAmount (number) -> integer, min 0, in centavos
 - priceCurrency (string) -> default ARS
 - benefits (SponsorshipBenefit[])
   - key (string)
   - label (string)
   - description (string) -> optional
 - sortOrder (number) -> integer, default 0
 - isActive (boolean) -> default true
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## SponsorshipPackage

```
SponsorshipPackage:
 - id (uuid)
 - slug (string) -> min 1
 - name (string) -> 1-100
 - description (string) -> max 500, nullable
 - priceAmount (number) -> integer, min 0
 - priceCurrency (string) -> default ARS
 - includedPosts (number) -> integer, min 0
 - includedEvents (number) -> integer, min 0
 - eventLevel (SponsorshipLevel) -> nullable
   - [full SponsorshipLevel structure]
 - isActive (boolean) -> default true
 - sortOrder (number) -> integer, default 0
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## PostSponsorship

```
PostSponsorship:
 - id (uuid)
 - sponsor (PostSponsor)
   - id (uuid)
   - name (string) -> 3-100
   - type (enum: COMPANY, INDIVIDUAL, ORGANIZATION)
   - description (string) -> 10-500
   - logo (object) -> nullable
     - url (string) -> URL
     - caption (string) -> optional
     - description (string) -> optional
     - moderationState (string) -> optional
   - contactInfo (object) -> nullable
     - [same structure as User.contactInfo]
   - socialNetworks (object) -> nullable
     - [same structure as User.socialNetworks]
   - lifecycleState (enum) -> default ACTIVE
   - adminInfo (object) -> nullable
   - createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById
 - post (Post) -> circular ref, not expanded
 - message (string) -> 5-50, optional
 - description (string) -> 10-500
 - paid (object)
   - price (number) -> positive
   - currency (enum: ARS, USD, EUR, BRL, etc.)
 - paidAt (Date) -> optional
 - fromDate (Date) -> optional
 - toDate (Date) -> optional
 - isHighlighted (boolean) -> default false
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
 - adminInfo (object) -> nullable
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## PostSponsor

```
PostSponsor:
 - id (uuid)
 - name (string) -> 3-100
 - type (enum: COMPANY, INDIVIDUAL, ORGANIZATION)
 - description (string) -> 10-500
 - logo (object) -> nullable
   - url (string) -> URL
   - caption (string) -> optional
   - description (string) -> optional
   - moderationState (string) -> optional
 - contactInfo (object) -> nullable
   - personalEmail (string) -> optional
   - workEmail (string) -> optional
   - homePhone (string) -> intl regex, optional
   - workPhone (string) -> intl regex, optional
   - mobilePhone (string) -> intl regex, required
   - website (string) -> URL, optional
   - preferredEmail (enum: PERSONAL, WORK) -> optional
   - preferredPhone (enum: HOME, WORK, MOBILE) -> optional
 - socialNetworks (object) -> nullable
   - facebook, instagram, twitter, linkedIn, tiktok, youtube (string URLs)
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
 - adminInfo (object) -> nullable
   - notes (string) -> 5-300, optional
   - favorite (boolean) -> default false
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## OwnerPromotion

```
OwnerPromotion:
 - id (uuid)
 - slug (string) -> min 1
 - owner (User)
   - id (uuid)
   - displayName (string)
   - email (string)
   - [+ full User fields]
 - accommodation (Accommodation) -> nullable
   - id (uuid)
   - name (string) -> 3-100
   - slug (string) -> 3-50
   - type (enum)
   - [+ full Accommodation fields, no recursive expansion]
 - title (string) -> 1-200
 - description (string) -> max 1000, nullable
 - discountType (enum: PERCENTAGE, FIXED_AMOUNT)
 - discountValue (number) -> min 0
 - minNights (number) -> integer, min 1, nullable
 - validFrom (Date)
 - validUntil (Date) -> nullable
 - maxRedemptions (number) -> integer, min 1, nullable
 - currentRedemptions (number) -> integer, min 0, default 0
 - isActive (boolean) -> default true
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## UserBookmark

```
UserBookmark:
 - id (uuid)
 - user (User) -> circular ref, not expanded
 - entityId (uuid) -> polymorphic
 - entityType (enum: ACCOMMODATION, DESTINATION, EVENT, POST, ATTRACTION)
 - name (string) -> 3-100, optional
 - description (string) -> 10-300, optional
 - lifecycleState (enum: ACTIVE, INACTIVE, SUSPENDED) -> default ACTIVE
 - adminInfo (object) -> nullable
   - notes (string) -> 5-300, optional
   - favorite (boolean) -> default false
 - createdAt (Date)
 - updatedAt (Date)
 - createdById (uuid) -> nullable
 - updatedById (uuid) -> nullable
 - deletedAt (Date) -> nullable
 - deletedById (uuid) -> nullable
```

---

## ExchangeRate

```
ExchangeRate:
 - id (uuid)
 - fromCurrency (enum: ARS, USD, EUR, BRL, etc.)
 - toCurrency (enum: ARS, USD, EUR, BRL, etc.)
 - rate (number) -> positive, numeric precision
 - inverseRate (number) -> positive, numeric precision
 - rateType (enum: SPOT, FORWARD, HISTORICAL)
 - source (enum: ECB, API, MANUAL, CACHED)
 - isManualOverride (boolean)
 - expiresAt (Date) -> nullable
 - fetchedAt (Date)
 - createdAt (Date)
 - updatedAt (Date)
```

---

## RevalidationLog

```
RevalidationLog:
 - id (uuid)
 - path (string) -> ISR path revalidated
 - entityType (string) -> entity type (accommodation, destination, etc.)
 - entityId (uuid) -> nullable
 - trigger (enum: MANUAL, HOOK, CRON, STALE)
 - triggeredBy (string) -> nullable, user ID or system identifier
 - status (enum: SUCCESS, FAILED, SKIPPED)
 - durationMs (number) -> integer, nullable, milliseconds
 - errorMessage (string) -> nullable
 - metadata (Record<string, unknown>) -> nullable, arbitrary key-value pairs
 - createdAt (Date)
```

---

## Entity Relationship Map

```
User ---owns---> Accommodation ---belongsTo---> Destination ---parent---> Destination
  |                   |                              |
  +---authors---> Post                               +---has---> Attraction[]
  +---authors---> Event                              +---has---> DestinationReview[]
  +---reviews---> AccommodationReview
  +---reviews---> DestinationReview
  +---has-------> UserBookmark[] (polymorphic)
  +---sponsors--> Sponsorship
  +---promotes--> OwnerPromotion

Accommodation <--M:N--> Amenity (via AccommodationAmenityRelation)
Accommodation <--M:N--> Feature (via AccommodationFeatureRelation)

Event ---at---> EventLocation
Event ---by---> EventOrganizer

Post ---sponsored---> PostSponsorship ---by---> PostSponsor
Post ---related----> Destination, Accommodation, Event (optional)

Sponsorship ---level---> SponsorshipLevel
Sponsorship ---package-> SponsorshipPackage
```

---

## Notes

- **Source of truth**: All schemas defined in `packages/schemas/src/entities/`
- **Circular references**: Marked with "circular ref, not expanded" to avoid infinite nesting
- **Computed fields**: `averageRating`, `reviewsCount` are maintained by DB triggers
- **Polymorphic relations**: `UserBookmark.entityId` and `Sponsorship.targetId` point to different entity types based on their corresponding type enum
- **Soft delete**: All entities with `deletedAt`/`deletedById` support soft deletion
- **Money**: All monetary values stored as integers (centavos), currency as enum
