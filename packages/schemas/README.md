# Hospeda Schemas

Zod validation schemas for all entities and data structures in the Hospeda platform.  
These schemas ensure data integrity, strong typing, and consistent validation across the entire stack.

---

## 📦 What's Inside?

- **Entity Schemas:** Accommodation, Destination, Event, Post, User, and all their sub-entities.  
- **Relationship Schemas:** For all major entity relations.  
- **Common Schemas:** Media, Location, Tag, Contact, Social, Price, SEO, etc.  
- **Enums:** All business enums (roles, permissions, categories, etc.).  
- **Utilities:** Regex, helpers, and validation utilities.  

---

## 🗂️ Schema Catalog

- [Hospeda Schemas](#hospeda-schemas)
  - [📦 What's Inside?](#-whats-inside)
  - [🗂️ Schema Catalog](#️-schema-catalog)
  - [Accommodation Schemas](#accommodation-schemas)
    - [AccommodationSchema](#accommodationschema)
      - [AccommodationSchemaExample JSON](#accommodationschemaexample-json)
    - [AccommodationFeatureSchema](#accommodationfeatureschema)
    - [AccommodationAmenitySchema](#accommodationamenityschema)
    - [AccommodationReviewSchema](#accommodationreviewschema)
    - [AccommodationRatingSchema](#accommodationratingschema)
    - [AccommodationFaqSchema](#accommodationfaqschema)
    - [AccommodationIaDataSchema](#accommodationiadataschema)
    - [ExtraInfoSchema](#extrainfoschema)
    - [ScheduleSchema](#scheduleschema)
    - [AmenitySchema](#amenityschema)
    - [FeatureSchema](#featureschema)
  - [Destination Schemas](#destination-schemas)
    - [DestinationSchema](#destinationschema)
      - [DestinationSchemaExample JSON](#destinationschemaexample-json)
    - [DestinationAttractionSchema](#destinationattractionschema)
    - [DestinationReviewSchema](#destinationreviewschema)
    - [DestinationRatingSchema](#destinationratingschema)
  - [Event Schemas](#event-schemas)
    - [EventSchema](#eventschema)
      - [EventSchema Example JSON](#eventschema-example-json)
    - [EventDateSchema](#eventdateschema)
    - [EventLocationSchema](#eventlocationschema)
    - [EventOrganizerSchema](#eventorganizerschema)
    - [EventPriceSchema](#eventpriceschema)
    - [EventExtrasSchema](#eventextrasschema)
  - [Post Schemas](#post-schemas)
    - [PostSchema](#postschema)
      - [PostSchema Example JSON](#postschema-example-json)
    - [PostSponsorSchema](#postsponsorschema)
    - [PostSponsorshipSchema](#postsponsorshipschema)
    - [PostExtrasSchema](#postextrasschema)
  - [User Schemas](#user-schemas)
    - [UserSchema](#userschema)
      - [UserSchema Example JSON](#userschema-example-json)
    - [UserProfileSchema](#userprofileschema)
    - [UserSettingsSchema](#usersettingsschema)
    - [UserBookmarkSchema](#userbookmarkschema)
    - [UserExtrasSchema](#userextrasschema)
    - [RoleSchema](#roleschema)
    - [PermissionSchema](#permissionschema)
  - [Common Schemas](#common-schemas)
    - [MediaSchema](#mediaschema)
    - [ImageSchema](#imageschema)
    - [VideoSchema](#videoschema)
    - [LocationSchema](#locationschema)
    - [CoordinatesSchema](#coordinatesschema)
    - [TagSchema](#tagschema)
    - [ContactInfoSchema](#contactinfoschema)
    - [SocialNetworkSchema](#socialnetworkschema)
    - [PriceSchema](#priceschema)
    - [SeoSchema](#seoschema)
  - [Enums](#enums)
    - [AccommodationTypeEnum](#accommodationtypeenum)
    - [AmenityTypeEnum](#amenitytypeenum)
    - [ClientTypeEnum](#clienttypeenum)
    - [ContactPreferenceEnum](#contactpreferenceenum)
    - [CurrencyEnum](#currencyenum)
    - [EntityTypeEnum](#entitytypeenum)
    - [EventCategoryEnum](#eventcategoryenum)
    - [LifecycleStateEnum](#lifecyclestateenum)
    - [PermissionEnum](#permissionenum)
    - [PostCategoryEnum](#postcategoryenum)
    - [RecurrenceEnum](#recurrenceenum)
    - [RoleEnum](#roleenum)
    - [StateEnum](#stateenum)
    - [TagColorEnum](#tagcolorenum)
    - [VisibilityEnum](#visibilityenum)
  - [Usage, Best Practices, Utilities, and License](#usage-best-practices-utilities-and-license)

---

## Accommodation Schemas

### AccommodationSchema

| Property         | Type                              | Description                                 |
|------------------|-----------------------------------|---------------------------------------------|
| id               | string (UUID)                     | Unique identifier                           |
| slug             | string                            | URL-friendly identifier                     |
| name             | string                            | Name of the accommodation                   |
| type             | AccommodationTypeEnum             | Type of accommodation                       |
| description      | string                            | Full description                            |
| contactInfo      | ContactInfoSchema?                | Contact information (optional)              |
| socialNetworks   | SocialNetworkSchema?              | Social links (optional)                     |
| price            | PriceSchema?                      | Price info (optional)                       |
| location         | LocationSchema?                   | Location info (optional)                    |
| media            | MediaSchema?                      | Media (images, videos) (optional)           |
| isFeatured       | boolean?                          | Is featured (optional)                      |
| ownerId          | string                            | Owner user ID                               |
| owner            | UserSchema?                       | Owner user object (optional)                |
| destinationId    | string                            | Destination ID                              |
| destination      | DestinationSchema?                | Destination object (optional)               |
| features         | AccommodationFeatureSchema[]?     | Features (optional, min 2)                  |
| amenities        | AccommodationAmenitySchema[]?     | Amenities (optional, min 2)                 |
| reviews          | AccommodationReviewSchema[]?      | Reviews (optional)                          |
| rating           | AccommodationRatingSchema?        | Rating (optional)                           |
| schedule         | ScheduleSchema?                   | Schedule (optional)                         |
| extraInfo        | ExtraInfoSchema?                  | Extra info (optional)                       |
| faqs             | AccommodationFaqSchema[]?         | FAQs (optional)                             |
| iaData           | AccommodationIaDataSchema[]?      | AI data (optional)                          |

#### AccommodationSchemaExample JSON

```json
{
  "id": "acc-1234-uuid",
  "slug": "casa-del-sol",
  "name": "Casa del Sol",
  "type": "house",
  "description": "A beautiful house with a pool and garden.",
  "contactInfo": {
    "personalEmail": "host@casadelsol.com",
    "mobilePhone": "+5493411234567"
  },
  "socialNetworks": {
    "facebook": "https://facebook.com/casadelsol",
    "instagram": "https://instagram.com/casadelsol"
  },
  "price": {
    "price": 120,
    "currency": "USD"
  },
  "location": {
    "state": "Entre Ríos",
    "zipCode": "3200",
    "country": "Argentina",
    "coordinates": { "lat": "-31.392", "long": "-58.017" },
    "street": "Av. Costanera",
    "number": "1234",
    "city": "Concordia"
  },
  "media": {
    "featuredImage": { "url": "https://cdn.hospeda.com/img1.jpg", "caption": "Front view" },
    "gallery": [
      { "url": "https://cdn.hospeda.com/img2.jpg", "caption": "Pool" },
      { "url": "https://cdn.hospeda.com/img3.jpg" }
    ],
    "videos": [
      { "url": "https://cdn.hospeda.com/vid1.mp4", "caption": "Walkthrough" }
    ]
  },
  "isFeatured": true,
  "ownerId": "user-uuid-1",
  "owner": {
    "id": "user-uuid-1",
    "email": "owner@hospeda.com",
    "userName": "hoster1",
    "role": {
      "id": "role-1",
      "name": "host",
      "permissions": [
        { "id": "perm-1", "name": "manage_accommodation" }
      ]
    },
    "profile": { "avatar": "https://cdn.hospeda.com/avatar1.png" }
  },
  "destinationId": "dest-uuid-1",
  "destination": {
    "id": "dest-uuid-1",
    "slug": "concordia",
    "name": "Concordia",
    "summary": "A riverside city.",
    "description": "Concordia is known for its beaches and hot springs.",
    "location": {
      "state": "Entre Ríos",
      "zipCode": "3200",
      "country": "Argentina",
      "street": "",
      "number": "",
      "city": "Concordia"
    },
    "media": {
      "featuredImage": { "url": "https://cdn.hospeda.com/concordia.jpg" }
    },
    "isFeatured": true,
    "visibility": "public"
  },
  "features": [
    {
      "accommodationId": "acc-1234-uuid",
      "featureId": "feat-1",
      "feature": { "id": "feat-1", "name": "Pool" }
    }
  ],
  "amenities": [
    {
      "accommodationId": "acc-1234-uuid",
      "amenityId": "amen-1",
      "isOptional": false,
      "amenity": { "id": "amen-1", "name": "WiFi", "type": "wifi" }
    }
  ],
  "reviews": [
    {
      "accommodationId": "acc-1234-uuid",
      "userId": "user-uuid-2",
      "title": "Great stay!",
      "content": "Loved the pool and the garden.",
      "rating": {
        "cleanliness": 5,
        "hospitality": 5,
        "services": 4,
        "accuracy": 5,
        "communication": 5,
        "location": 5
      }
    }
  ],
  "rating": {
    "cleanliness": 5,
    "hospitality": 5,
    "services": 4,
    "accuracy": 5,
    "communication": 5,
    "location": 5
  },
  "schedule": {
    "checkinTime": "14:00",
    "checkoutTime": "11:00",
    "earlyCheckinAccepted": false,
    "lateCheckinAccepted": true,
    "lateCheckinTime": "20:00",
    "lateCheckoutAccepted": false,
    "selfCheckin": true,
    "selfCheckout": true
  },
  "extraInfo": {
    "capacity": 6,
    "minNights": 2,
    "bedrooms": 3,
    "bathrooms": 2
  },
  "faqs": [
    {
      "accommodationId": "acc-1234-uuid",
      "question": "Is breakfast included?",
      "answer": "No, but there is a kitchen."
    }
  ],
  "iaData": [
    {
      "accommodationId": "acc-1234-uuid",
      "title": "AI summary",
      "content": "Great for families and groups."
    }
  ]
}
```

### AccommodationFeatureSchema

| Property         | Type            | Description                                 |
|------------------|-----------------|---------------------------------------------|
| accommodationId  | string          | Accommodation ID                            |
| featureId        | string          | Feature ID                                  |
| hostReWriteName  | string?         | Custom name by host (optional)              |
| comments         | string?         | Comments (optional)                         |
| feature          | FeatureSchema?  | Feature object (optional)                   |

---

### AccommodationAmenitySchema

| Property               | Type          | Description                                 |
|------------------------|---------------|---------------------------------------------|
| accommodationId        | string        | Accommodation ID                            |
| amenityId              | string        | Amenity ID                                  |
| isOptional             | boolean       | Is optional for guest                       |
| additionalCost         | PriceSchema?  | Additional cost (optional)                  |
| additionalCostPercent  | number?       | Additional cost percent (optional)          |
| amenity                | AmenitySchema?| Amenity object (optional)                   |

---

### AccommodationReviewSchema

| Property         | Type                        | Description                                 |
|------------------|-----------------------------|---------------------------------------------|
| accommodationId  | string                      | Accommodation ID                            |
| userId           | string                      | User ID                                     |
| title            | string?                     | Review title (optional)                     |
| content          | string?                     | Review content (optional)                   |
| rating           | AccommodationRatingSchema   | Rating object                               |

---

### AccommodationRatingSchema

| Property       | Type    | Description                          |
|----------------|---------|--------------------------------------|
| cleanliness    | number  | Cleanliness rating (1–5)             |
| hospitality    | number  | Hospitality rating (1–5)             |
| services       | number  | Services rating (1–5)                |
| accuracy       | number  | Accuracy rating (1–5)                |
| communication  | number  | Communication rating (1–5)           |
| location       | number  | Location rating (1–5)                |

---

### AccommodationFaqSchema

| Property         | Type    | Description                                 |
|------------------|---------|---------------------------------------------|
| accommodationId  | string  | Accommodation ID                            |
| question         | string  | FAQ question                                |
| answer           | string  | FAQ answer                                  |
| category         | string? | FAQ category (optional)                     |

---

### AccommodationIaDataSchema

| Property         | Type    | Description                                 |
|------------------|---------|---------------------------------------------|
| accommodationId  | string  | Accommodation ID                            |
| title            | string  | AI data title                               |
| content          | string  | AI data content                             |
| category         | string? | AI data category (optional)                 |

---

### ExtraInfoSchema

| Property        | Type      | Description                               |
|-----------------|-----------|-------------------------------------------|
| capacity        | number    | Max capacity                              |
| minNights       | number    | Minimum nights                            |
| maxNights       | number?   | Maximum nights (optional)                 |
| bedrooms        | number    | Number of bedrooms                        |
| beds            | number?   | Number of beds (optional)                 |
| bathrooms       | number    | Number of bathrooms                       |
| smokingAllowed  | boolean?  | Smoking allowed (optional)                |
| extraInfo       | string[]? | Extra info (optional)                     |

---

### ScheduleSchema

| Property              | Type     | Description                                 |
|-----------------------|----------|---------------------------------------------|
| checkinTime           | string?  | Check-in time (optional)                    |
| checkoutTime          | string?  | Check-out time (optional)                   |
| earlyCheckinAccepted  | boolean  | Early check-in accepted                     |
| earlyCheckinTime      | string?  | Early check-in time (optional)              |
| lateCheckinAccepted   | boolean  | Late check-in accepted                      |
| lateCheckinTime       | string?  | Late check-in time (optional)               |
| lateCheckoutAccepted  | boolean  | Late check-out accepted                     |
| lateCheckoutTime      | string?  | Late check-out time (optional)              |
| selfCheckin           | boolean  | Self check-in                               |
| selfCheckout          | boolean  | Self check-out                              |

---

### AmenitySchema

| Property     | Type             | Description                      |
|--------------|------------------|----------------------------------|
| id           | string           | Amenity ID                       |
| name         | string           | Amenity name                     |
| description  | string?          | Description (optional)           |
| icon         | string?          | Icon (optional)                  |
| type         | AmenityTypeEnum  | Amenity type                     |

---

### FeatureSchema

| Property     | Type     | Description                      |
|--------------|----------|----------------------------------|
| id           | string   | Feature ID                       |
| name         | string   | Feature name                     |
| description  | string?  | Description (optional)           |
| icon         | string?  | Icon (optional)                  |

---

## Destination Schemas

### DestinationSchema

| Property             | Type                                | Description                                   |
|----------------------|-------------------------------------|-----------------------------------------------|
| id                   | string (UUID)                       | Unique identifier                             |
| slug                 | string                              | URL-friendly identifier                       |
| name                 | string                              | Name of the destination                       |
| summary              | string                              | Short summary                                 |
| description          | string                              | Full description                              |
| location             | LocationSchema                      | Location info                                 |
| media                | MediaSchema                         | Media (images, videos)                        |
| isFeatured           | boolean?                            | Is featured (optional)                        |
| visibility           | VisibilityEnum                      | Visibility                                    |
| reviewsCount         | number?                             | Number of reviews (optional)                  |
| averageRating        | number?                             | Average rating (optional)                     |
| accommodationsCount  | number?                             | Number of accommodations (optional)           |
| attractions          | DestinationAttractionSchema[]?      | Attractions (optional, min 3)                 |
| reviews              | DestinationReviewSchema[]?          | Reviews (optional)                            |

#### DestinationSchemaExample JSON

```json
{
  "id": "dest-uuid-1",
  "slug": "concordia",
  "name": "Concordia",
  "summary": "A riverside city.",
  "description": "Concordia is known for its beaches and hot springs.",
  "location": {
    "state": "Entre Ríos",
    "zipCode": "3200",
    "country": "Argentina",
    "street": "",
    "number": "",
    "city": "Concordia"
  },
  "media": {
    "featuredImage": { "url": "https://cdn.hospeda.com/concordia.jpg" }
  },
  "isFeatured": true,
  "visibility": "public",
  "reviewsCount": 12,
  "averageRating": 4.7,
  "accommodationsCount": 25,
  "attractions": [
    {
      "id": "attr-1",
      "name": "Hot Springs",
      "slug": "hot-springs",
      "description": "Natural hot springs.",
      "icon": "spa",
      "destinationId": "dest-uuid-1"
    }
  ],
  "reviews": [
    {
      "userId": "user-uuid-2",
      "destinationId": "dest-uuid-1",
      "title": "Amazing!",
      "content": "Loved the city.",
      "rating": {
        "landscape": 5,
        "attractions": 5,
        "accessibility": 4,
        "safety": 5,
        "cleanliness": 5,
        "hospitality": 5,
        "culturalOffer": 4,
        "gastronomy": 5,
        "affordability": 4,
        "nightlife": 4,
        "infrastructure": 4,
        "environmentalCare": 5,
        "wifiAvailability": 4,
        "shopping": 4,
        "beaches": 5,
        "greenSpaces": 5,
        "localEvents": 4,
        "weatherSatisfaction": 5
      }
    }
  ]
}
```

---

### DestinationAttractionSchema

| Property       | Type     | Description                      |
|----------------|----------|----------------------------------|
| id             | string   | Attraction ID                    |
| name           | string   | Attraction name                  |
| slug           | string   | URL-friendly identifier          |
| description    | string   | Description                      |
| icon           | string   | Icon                             |
| destinationId  | string   | Destination ID                   |

---

### DestinationReviewSchema

| Property        | Type                      | Description                                 |
|-----------------|---------------------------|---------------------------------------------|
| userId          | string                    | User ID                                     |
| destinationId   | string                    | Destination ID                              |
| title           | string?                   | Review title (optional)                     |
| content         | string?                   | Review content (optional)                   |
| rating          | DestinationRatingSchema   | Rating object                               |

---

### DestinationRatingSchema

| Property              | Type    | Description                                   |
|-----------------------|---------|-----------------------------------------------|
| landscape             | number  | Landscape rating (0–5)                        |
| attractions           | number  | Attractions rating (0–5)                      |
| accessibility         | number  | Accessibility rating (0–5)                    |
| safety                | number  | Safety rating (0–5)                           |
| cleanliness           | number  | Cleanliness rating (0–5)                      |
| hospitality           | number  | Hospitality rating (0–5)                      |
| culturalOffer         | number  | Cultural offer rating (0–5)                   |
| gastronomy            | number  | Gastronomy rating (0–5)                       |
| affordability         | number  | Affordability rating (0–5)                    |
| nightlife             | number  | Nightlife rating (0–5)                        |
| infrastructure        | number  | Infrastructure rating (0–5)                   |
| environmentalCare     | number  | Environmental care rating (0–5)               |
| wifiAvailability      | number  | WiFi availability rating (0–5)                |
| shopping              | number  | Shopping rating (0–5)                         |
| beaches               | number  | Beaches rating (0–5)                          |
| greenSpaces           | number  | Green spaces rating (0–5)                     |
| localEvents           | number  | Local events rating (0–5)                     |
| weatherSatisfaction   | number  | Weather satisfaction rating (0–5)             |

---

## Event Schemas

### EventSchema

| Property     | Type                  | Description                                 |
|--------------|-----------------------|---------------------------------------------|
| id           | string (UUID)         | Unique identifier                           |
| title        | string                | Event title                                 |
| description  | string                | Event description                           |
| date         | EventDateSchema       | Event date                                  |
| location     | EventLocationSchema   | Event location                              |
| organizer    | EventOrganizerSchema  | Event organizer                             |
| price        | EventPriceSchema?     | Event price (optional)                      |
| extras       | EventExtrasSchema?    | Additional event extras (optional)          |

#### EventSchema Example JSON

```json
{
  "id": "event-uuid-1",
  "title": "Jazz Festival",
  "description": "Annual jazz festival in the city square.",
  "date": {
    "start": "2024-11-10T18:00:00Z",
    "end": "2024-11-10T23:00:00Z",
    "isAllDay": false
  },
  "location": {
    "id": "loc-1",
    "city": "Concordia",
    "placeName": "City Square"
  },
  "organizer": {
    "id": "org-1",
    "name": "Concordia Events",
    "logo": "https://cdn.hospeda.com/org1.png",
    "contactInfo": {
      "personalEmail": "info@concordiaevents.com",
      "mobilePhone": "+5493417654321"
    },
    "social": {
      "facebook": "https://facebook.com/concordiaevents"
    }
  },
  "price": {
    "isFree": false,
    "priceFrom": 10,
    "priceTo": 50
  },
  "extras": {
    "notes": "Bring your own chair."
  }
}
```

---

### EventDateSchema

| Property   | Type     | Description                          |
|------------|----------|--------------------------------------|
| start      | string   | Start date/time                      |
| end        | string?  | End date/time (optional)             |
| isAllDay   | boolean? | Is all day event (optional)          |
| recurrence | string?  | Recurrence type (optional)           |

---

### EventLocationSchema

| Property     | Type     | Description                          |
|--------------|----------|--------------------------------------|
| id           | string   | Location ID                          |
| street       | string?  | Street (optional)                    |
| number       | string?  | Number (optional)                    |
| floor        | string?  | Floor (optional)                     |
| apartment    | string?  | Apartment (optional)                 |
| neighborhood | string?  | Neighborhood (optional)             |
| city         | string   | City                                 |
| department   | string?  | Department (optional)                |
| placeName    | string?  | Place name (optional)                |

---

### EventOrganizerSchema

| Property     | Type                  | Description                                 |
|--------------|-----------------------|---------------------------------------------|
| id           | string                | Organizer ID                                |
| name         | string                | Organizer name                              |
| logo         | string?               | Logo URL (optional)                         |
| contactInfo  | ContactInfoSchema?    | Contact info (optional)                     |
| social       | SocialNetworkSchema?  | Social links (optional)                     |

---

### EventPriceSchema

| Property       | Type    | Description                              |
|----------------|---------|------------------------------------------|
| isFree         | boolean | Is the event free                        |
| priceFrom      | number? | Price from (optional)                    |
| priceTo        | number? | Price to (optional)                      |
| pricePerGroup  | number? | Price per group (optional)               |

---

### EventExtrasSchema

| Property | Type     | Description              |
|----------|----------|--------------------------|
| notes    | string?  | Additional notes (optional) |

---

## Post Schemas

### PostSchema

| Property      | Type                    | Description                                 |
|---------------|-------------------------|---------------------------------------------|
| id            | string (UUID)           | Unique identifier                           |
| title         | string                  | Post title                                  |
| content       | string                  | Post content                                |
| authorId      | string                  | Author user ID                              |
| category      | string                  | Post category                               |
| sponsorship   | PostSponsorshipSchema?  | Sponsorship details (optional)              |
| sponsor       | PostSponsorSchema?      | Sponsor details (optional)                  |
| extras        | PostExtrasSchema?       | Additional post extras (optional)           |

#### PostSchema Example JSON

```json
{
  "id": "post-uuid-1",
  "title": "Top 5 Things to Do in Concordia",
  "content": "Explore the best attractions in Concordia...",
  "authorId": "user-uuid-3",
  "category": "blog",
  "sponsorship": {
    "sponsorId": "sponsor-1",
    "postId": "post-uuid-1",
    "description": "Sponsored by Turismo Concordia",
    "paid": { "price": 100, "currency": "USD" }
  },
  "sponsor": {
    "id": "sponsor-1",
    "name": "Turismo Concordia",
    "type": "company",
    "description": "Tourism board",
    "logo": "https://cdn.hospeda.com/turismo.png",
    "contact": {
      "workEmail": "contact@turismoconcordia.com",
      "mobilePhone": "+5493419876543"
    },
    "social": {
      "facebook": "https://facebook.com/turismoconcordia"
    }
  },
  "extras": {
    "tags": ["travel", "concordia"]
  }
}
```

---

### PostSponsorSchema

| Property     | Type                  | Description                              |
|--------------|-----------------------|------------------------------------------|
| id           | string                | Sponsor ID                               |
| name         | string                | Sponsor name                             |
| type         | ClientTypeEnum        | Sponsor type                             |
| description  | string                | Description                              |
| logo         | string?               | Logo URL (optional)                      |
| contact      | ContactInfoSchema?    | Contact info (optional)                  |
| social       | SocialNetworkSchema?  | Social links (optional)                  |

---

### PostSponsorshipSchema

| Property       | Type          | Description                              |
|----------------|---------------|------------------------------------------|
| sponsorId      | string        | Sponsor ID                               |
| postId         | string        | Post ID                                  |
| message        | string?       | Sponsorship message (optional)           |
| description    | string        | Sponsorship description                  |
| paid           | PriceSchema   | Paid amount                              |
| paidAt         | string?       | Paid at (optional)                       |
| fromDate       | string?       | From date (optional)                     |
| toDate         | string?       | To date (optional)                       |
| isHighlighted  | boolean?      | Is highlighted (optional)                |

---

### PostExtrasSchema

| Property | Type      | Description                          |
|----------|-----------|--------------------------------------|
| tags     | string[]? | Tags for the post (optional)         |

---

## User Schemas

### UserSchema

| Property        | Type                  | Description                                 |
|-----------------|-----------------------|---------------------------------------------|
| id              | string (UUID)         | Unique identifier                           |
| email           | string                | User email                                  |
| userName        | string                | Username                                    |
| password        | string                | User password (input only)                  |
| firstName       | string?               | First name (optional)                       |
| lastName        | string?               | Last name (optional)                        |
| birthDate       | string?               | Birth date (optional)                       |
| emailVerified   | boolean?              | Email verified (optional)                   |
| phoneVerified   | boolean?              | Phone verified (optional)                   |
| contactInfo     | ContactInfoSchema?    | Contact info (optional)                     |
| location        | LocationSchema?       | Location info (optional)                    |
| socialNetworks  | SocialNetworkSchema?  | Social networks (optional)                  |
| role            | RoleSchema            | User role                                   |
| permissions     | PermissionSchema[]?   | User permissions (optional)                 |
| profile         | UserProfileSchema     | User profile                                |
| settings        | UserSettingsSchema?   | User settings (optional)                    |
| bookmarks       | UserBookmarkSchema[]? | User bookmarks (optional)                   |
| extras          | UserExtrasSchema?     | User extras (optional)                      |

#### UserSchema Example JSON

```json
{
  "id": "user-uuid-1",
  "email": "owner@hospeda.com",
  "userName": "hoster1",
  "password": "********",
  "firstName": "Ana",
  "lastName": "García",
  "birthDate": "1990-05-10",
  "emailVerified": true,
  "phoneVerified": true,
  "contactInfo": {
    "personalEmail": "ana@personal.com",
    "mobilePhone": "+5493411234567"
  },
  "location": {
    "state": "Entre Ríos",
    "zipCode": "3200",
    "country": "Argentina",
    "street": "Av. Costanera",
    "number": "1234",
    "city": "Concordia"
  },
  "socialNetworks": {
    "facebook": "https://facebook.com/ana.garcia"
  },
  "role": {
    "id": "role-1",
    "name": "host",
    "permissions": [
      { "id": "perm-1", "name": "manage_accommodation" }
    ]
  },
  "permissions": [
    { "id": "perm-2", "name": "edit_profile" }
  ],
  "profile": {
    "avatar": "https://cdn.hospeda.com/avatar1.png",
    "bio": "Host and traveler."
  },
  "settings": {
    "darkMode": true,
    "language": "es",
    "notifications": {
      "email": true,
      "sms": false
    }
  },
  "bookmarks": [
    {
      "id": "bm-1",
      "entityId": "dest-uuid-1",
      "entityType": "destination",
      "name": "Concordia"
    }
  ],
  "extras": {
    "id": "extras-1",
    "userName": "hoster1",
    "firstName": "Ana",
    "profile": {
      "avatar": "https://cdn.hospeda.com/avatar1.png"
    }
  }
}
```

---

### UserProfileSchema

| Property    | Type     | Description                      |
|-------------|----------|----------------------------------|
| avatar      | string?  | Avatar URL (optional)            |
| bio         | string?  | User bio (optional)              |
| website     | string?  | Website URL (optional)           |
| occupation  | string?  | Occupation (optional)            |

---

### UserSettingsSchema

| Property       | Type                      | Description                                 |
|----------------|---------------------------|---------------------------------------------|
| darkMode       | boolean?                  | Dark mode enabled (optional)                |
| language       | string?                   | Language (optional)                         |
| notifications  | UserNotificationsSchema   | Notification settings                       |

---

### UserBookmarkSchema

| Property     | Type           | Description                              |
|--------------|----------------|------------------------------------------|
| id           | string         | Bookmark ID                              |
| entityId     | string         | Entity ID                                |
| entityType   | EntityTypeEnum | Entity type                              |
| name         | string?        | Name (optional)                          |
| description  | string?        | Description (optional)                   |

---

### UserExtrasSchema

| Property        | Type                  | Description                              |
|-----------------|-----------------------|------------------------------------------|
| id              | string                | Extras ID                                |
| userName        | string                | Username                                 |
| firstName       | string?               | First name (optional)                    |
| lastName        | string?               | Last name (optional)                     |
| profile         | UserProfileSchema?    | User profile (optional)                  |
| socialNetworks  | SocialNetworkSchema?  | Social networks (optional)               |

---

### RoleSchema

| Property     | Type                | Description                      |
|--------------|---------------------|----------------------------------|
| id           | string              | Role ID                          |
| name         | string              | Role name                        |
| description  | string?             | Description (optional)           |
| permissions  | PermissionSchema[]  | Permissions                      |

---

### PermissionSchema

| Property     | Type     | Description                    |
|--------------|----------|--------------------------------|
| id           | string   | Permission ID                  |
| name         | string   | Permission name                |
| description  | string?  | Description (optional)         |

---

## Common Schemas

### MediaSchema

| Property       | Type           | Description                              |
|----------------|----------------|------------------------------------------|
| featuredImage  | ImageSchema    | Main image                               |
| gallery        | ImageSchema[]? | Gallery images (optional)                |
| videos         | VideoSchema[]? | Videos (optional)                        |

---

### ImageSchema

| Property     | Type     | Description                     |
|--------------|----------|---------------------------------|
| url          | string   | Image URL                       |
| caption      | string?  | Caption (optional)              |
| description  | string?  | Description (optional)          |

---

### VideoSchema

| Property     | Type     | Description                     |
|--------------|----------|---------------------------------|
| url          | string   | Video URL                       |
| caption      | string?  | Caption (optional)              |
| description  | string?  | Description (optional)          |

---

### LocationSchema

| Property      | Type              | Description                     |
|---------------|-------------------|---------------------------------|
| state         | string            | State                           |
| zipCode       | string            | Zip code                        |
| country       | string            | Country                         |
| coordinates   | CoordinatesSchema?| Coordinates (optional)          |
| street        | string            | Street                          |
| number        | string            | Number                          |
| floor         | string?           | Floor (optional)                |
| apartment     | string?           | Apartment (optional)            |
| neighborhood  | string?           | Neighborhood (optional)         |
| city          | string            | City                            |
| department    | string?           | Department (optional)           |

---

### CoordinatesSchema

| Property  | Type   | Description     |
|-----------|--------|-----------------|
| lat       | string | Latitude        |
| long      | string | Longitude       |

---

### TagSchema

| Property  | Type     | Description                     |
|-----------|----------|---------------------------------|
| id        | string   | Tag ID                          |
| name      | string   | Tag name                        |
| color     | string   | Tag color                       |
| icon      | string?  | Icon (optional)                 |
| notes     | string?  | Notes (optional)                |

---

### ContactInfoSchema

| Property        | Type     | Description                           |
|-----------------|----------|---------------------------------------|
| personalEmail   | string?  | Personal email (optional)             |
| workEmail       | string?  | Work email (optional)                 |
| homePhone       | string?  | Home phone (optional)                 |
| workPhone       | string?  | Work phone (optional)                 |
| mobilePhone     | string   | Mobile phone                          |
| website         | string?  | Website (optional)                    |
| preferredEmail  | string?  | Preferred email (optional)            |
| preferredPhone  | string?  | Preferred phone (optional)            |

---

### SocialNetworkSchema

| Property   | Type     | Description                      |
|------------|----------|----------------------------------|
| facebook   | string?  | Facebook URL (optional)          |
| instagram  | string?  | Instagram URL (optional)         |
| twitter    | string?  | Twitter URL (optional)           |
| linkedIn   | string?  | LinkedIn URL (optional)          |
| tiktok     | string?  | TikTok URL (optional)            |
| youtube    | string?  | YouTube URL (optional)           |

---

### PriceSchema

| Property  | Type     | Description         |
|-----------|----------|---------------------|
| price     | number   | Price amount        |
| currency  | string   | Currency            |

---

### SeoSchema

| Property         | Type      | Description                     |
|------------------|-----------|---------------------------------|
| seoTitle         | string?   | SEO title (optional)            |
| seoDescription   | string?   | SEO description (optional)      |
| seoKeywords      | string[]? | SEO keywords (optional)         |

---

## Enums

### AccommodationTypeEnum

Examples: `"hotel"`, `"apartment"`, `"hostel"`, ...

### AmenityTypeEnum

Examples: `"wifi"`, `"pool"`, `"parking"`, ...

### ClientTypeEnum

Examples: `"individual"`, `"company"`

### ContactPreferenceEnum

Examples: `"personal"`, `"work"`

### CurrencyEnum

Examples: `"USD"`, `"EUR"`

### EntityTypeEnum

Examples: `"accommodation"`, `"destination"`

### EventCategoryEnum

Examples: `"music"`, `"sports"`

### LifecycleStateEnum

Examples: `"active"`, `"inactive"`

### PermissionEnum

Examples: `"read"`, `"write"`

### PostCategoryEnum

Examples: `"news"`, `"blog"`

### RecurrenceEnum

Examples: `"daily"`, `"weekly"`

### RoleEnum

Examples: `"admin"`, `"user"`

### StateEnum

Examples: `"published"`, `"draft"`

### TagColorEnum

Examples: `"red"`, `"blue"`

### VisibilityEnum

Examples: `"public"`, `"private"`

---

## Usage, Best Practices, Utilities, and License

- All schemas are defined using `zod` for strict validation.
- Use schemas directly in API routes, form validation, and factories.
- Reuse common schemas for media, contact, location, and social profiles.
- Extend and compose schemas using `.extend()` or `.merge()` as needed.
- Prefer using the enums defined here over hardcoded strings.
- Utilities like regex and helpers are available in the `utils` folder.
