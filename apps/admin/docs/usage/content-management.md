# Content Management Guide

Complete guide to creating, editing, and publishing content in the Hospeda Admin Dashboard.

---

## Overview

Content management is the heart of the Hospeda platform. This comprehensive guide covers everything you need to create, edit, publish, and manage accommodations, destinations, events, and other content.

**What you will learn:**

- Creating and editing accommodations, destinations, and events
- Content workflow (draft, review, publish)
- SEO optimization
- Image and media management
- Scheduling and publishing
- Bulk operations
- Content quality best practices

**Prerequisites:**

- Editor, Manager, or Admin role required
- Viewers have read-only access

---

## Managing Accommodations

### Accommodations Overview

**Access:** Sidebar - Accommodations

**The accommodations list shows:**

```text

  Accommodations                      [+ Add Accommodation]

  [Search...]
  [Filters]  [Status]  [Export]

  Name            City         Type    Status    Actions

  Hotel Central   Buenos Aires Hotel   Published
  Beach House     Mar del Plata House   Draft
  Mountain Cabin  Bariloche    Cabin   Scheduled

```

### Creating an Accommodation

**Access:** Accommodations - Add Accommodation

#### Step 1: Basic Information

**Required fields:**

- **Name*** - Accommodation name (e.g., "Hotel Central")
- **Type*** - Hotel, Hostel, House, Cabin, Apartment, Other
- **Destination*** - Select from destination list
- **Description*** - Detailed description (minimum 100 characters)

**Example:**

```text
Name: Hotel Central
Type: Hotel
Destination: Concepcion del Uruguay
Description: Charming boutique hotel in the heart of the city.
Located just two blocks from the main plaza...
```

#### Step 2: Location

**Required:**

- **Address*** - Street address
- **City*** - City name
- **Province*** - Province/state
- **Country*** - Default: Argentina
- **Postal Code** - ZIP/postal code

**Optional:**

- **Coordinates** - Latitude/longitude (auto-filled from address)
- **Map** - Interactive map to pin exact location

**Tips:**

- Enter complete address for accurate map placement
- Verify coordinates match location
- Use drag-and-drop to adjust pin if needed

#### Step 3: Pricing

**Required:**

- **Price per Night*** - Base price in local currency (ARS)
- **Currency*** - Default: ARS

**Optional pricing fields:**

- **Weekend Price** - Different rate for weekends
- **Monthly Price** - Long-term stay discount
- **Minimum Stay** - Minimum nights required
- **Maximum Stay** - Maximum nights allowed

**Price ranges:**

```text
Standard Rate: $15,000 ARS/night
Weekend Rate: $18,000 ARS/night
Monthly Rate: $400,000 ARS/month
```

**Discounts:**

- **Early Bird** - Discount for booking X days in advance
- **Last Minute** - Discount for booking within X days
- **Seasonal** - Different rates by season

#### Step 4: Capacity and Amenities

**Capacity:**

- **Maximum Guests*** - Total guest capacity
- **Bedrooms** - Number of bedrooms
- **Beds** - Number of beds (total)
- **Bathrooms** - Number of bathrooms

**Amenities (select all that apply):**

**Essential:**

- WiFi
- Air Conditioning
- Heating
- Hot Water
- Kitchen

**Comfort:**

- TV
- Cable/Streaming
- Parking
- Pool
- Garden

**Services:**

- Breakfast Included
- Cleaning Service
- Room Service
- Laundry
- Concierge

**Accessibility:**

- Wheelchair Accessible
- Elevator
- Ground Floor Units
- Accessible Bathroom

#### Step 5: Images

**Requirements:**

- Minimum: 5 images
- Recommended: 10-20 images
- Format: JPG, PNG, WebP
- Size: Minimum 1200x800px
- Max file size: 5MB per image

**Image types:**

1. **Main Image** - Primary photo (required)
2. **Gallery** - Additional photos
3. **Floor Plan** - Layout diagram (optional)

**Best practices:**

- High resolution, well-lit photos
- Show different angles and rooms
- Include exterior and interior shots
- Highlight unique features
- Use professional photography if possible

**Upload process:**

1. Click **Upload Images**
2. Select files or drag-and-drop
3. Wait for upload progress
4. Reorder by drag-and-drop
5. Add captions (optional)
6. Set main image (star icon)

#### Step 6: Contact Information

**Required:**

- **Phone Number*** - Contact number with country code
- **Email*** - Contact email address

**Optional:**

- **Website** - Accommodation website
- **Booking URL** - Direct booking link
- **WhatsApp** - WhatsApp number
- **Social Media** - Facebook, Instagram links

#### Step 7: Policies and Rules

**House Rules:**

- Check-in time: 3:00 PM
- Check-out time: 11:00 AM
- No smoking
- No pets (or pets allowed with fee)
- No parties/events
- Quiet hours: 10 PM - 8 AM

**Cancellation Policy:**

- Free cancellation up to X days before
- 50% refund X-Y days before
- No refund less than Y days before

**Payment Terms:**

- 50% deposit at booking
- Balance due at check-in
- Accepted payment methods: Cash, Credit Card, Bank Transfer

#### Step 8: SEO Optimization

**For better search visibility:**

**SEO Title:**

- Target length: 50-60 characters
- Include location and type
- Example: "Hotel Central - Boutique Hotel in Concepcion del Uruguay"

**Meta Description:**

- Target length: 150-160 characters
- Compelling summary with keywords
- Example: "Experience comfort at Hotel Central, a charming boutique hotel in the heart of Concepcion del Uruguay. Modern amenities, excellent location, great rates."

**URL Slug:**

- Auto-generated from name
- Editable if needed
- Use lowercase, hyphens
- Example: `hotel-central-concepcion-uruguay`

**Keywords:**

- 5-10 relevant keywords
- Include location, type, features
- Example: "hotel, boutique, Concepcion del Uruguay, accommodation, city center"

#### Step 9: Publishing Options

**Status options:**

- **Draft** - Work in progress, not public
- **Pending Review** - Submit for approval (Editor role)
- **Schedule** - Publish at specific date/time
- **Publish** - Make live immediately (Manager/Admin only)

**Visibility:**

- **Public** - Visible to all users
- **Unlisted** - Only accessible via direct link
- **Private** - Only visible to admins

#### Step 10: Save and Publish

**Save options:**

- **Save Draft** - Save without publishing
- **Submit for Review** - Send to Manager for approval
- **Schedule** - Set future publish date
- **Publish Now** - Make live immediately

**Before publishing:**

1. Preview accommodation page
2. Verify all required fields
3. Check images display correctly
4. Test contact information
5. Review SEO settings

---

## Managing Destinations

### Destinations Overview

**Access:** Sidebar - Destinations

**Destinations are:**

- Cities or regions
- Used to organize accommodations
- Featured on homepage and search
- Have their own landing pages

### Creating a Destination

**Access:** Destinations - Add Destination

#### Required Information

**Basic:**

- **Name*** - Destination name (e.g., "Concepcion del Uruguay")
- **Type*** - City, Town, Region, Province
- **Province*** - Province/state
- **Description*** - Compelling overview (minimum 200 characters)

**Location:**

- **Coordinates*** - Latitude/longitude
- **Timezone** - Default: America/Argentina/Buenos_Aires

#### Content Sections

**Overview:**

- Short tagline (50 characters)
- Full description (500+ words recommended)
- Why visit this destination
- Best time to visit

**Attractions:**

- Major attractions list
- Points of interest
- Activities
- Tours

**Getting There:**

- By car (directions, distance from major cities)
- By bus (terminals, companies)
- By plane (nearest airports)
- By train (stations, routes)

**Local Info:**

- Climate and weather
- Currency and banking
- Language and culture
- Safety and health
- Local customs

#### Images

**Requirements:**

- Main image (hero): 1920x1080px minimum
- Gallery: 10-15 images
- Show variety: nature, architecture, culture, food

**Image suggestions:**

- Iconic landmarks
- Scenic views
- Local events
- Cultural highlights
- Street scenes
- Food and dining

#### SEO for Destinations

**SEO Title:**

- "Tourism in [Destination] - Accommodations, Attractions & Travel Guide"
- Target: 60 characters

**Meta Description:**

- "Discover [Destination]: find accommodations, explore attractions, and plan your perfect trip. Complete travel guide with tips and recommendations."
- Target: 160 characters

**Keywords:**

- Destination name + "tourism"
- Destination name + "travel"
- Destination name + "accommodations"
- Major attractions by name

---

## Managing Events

### Events Overview

**Access:** Sidebar - Events

**Events include:**

- Festivals and celebrations
- Cultural events
- Sports events
- Tourism activities
- Conferences and exhibitions

### Creating an Event

**Access:** Events - Add Event

#### Basic Information

**Required:**

- **Title*** - Event name
- **Type*** - Festival, Cultural, Sports, Business, Other
- **Destination*** - Where event takes place
- **Start Date*** - Event start date and time
- **End Date*** - Event end date and time
- **Description*** - Event details (minimum 100 characters)

**Example:**

```text
Title: Fiesta Nacional de la Playa Grande
Type: Festival
Destination: Concepcion del Uruguay
Start: 2024-02-15 18:00
End: 2024-02-18 23:59
```

#### Event Details

**Venue:**

- Venue name
- Address
- Capacity

**Tickets:**

- Free or Paid
- Ticket prices
- Where to buy
- Early bird discounts

**Schedule:**

- Day-by-day program
- Activity times
- Special guests
- Highlights

**Organizer:**

- Organization name
- Contact information
- Website

#### Event Images

**Requirements:**

- Main poster/flyer image
- Event photos from previous years (if applicable)
- Venue photos
- Artist/performer photos

**Best practices:**

- Use official event poster as main image
- Show crowd/atmosphere
- Highlight performers/attractions
- Include venue shots

#### Event SEO

**SEO Title:**

- "[Event Name] [Year] - [Destination] - Dates, Schedule & Tickets"
- Example: "Fiesta Nacional de la Playa Grande 2024 - Concepcion del Uruguay"

**Meta Description:**

- Event dates, highlights, how to attend
- Example: "Join the Fiesta Nacional de la Playa Grande Feb 15-18, 2024. Free concerts, beach activities, and local food. Complete schedule and info."

**Schema Markup:**

- Automatically generated Event schema for Google
- Includes dates, location, price, organizer

---

## Content Status Workflow

### Content Statuses

#### Draft

**What it means:**

- Work in progress
- Not visible to public
- Can be edited freely
- No review required to save

**Who can create:**

- Editors, Managers, Admins

**Actions available:**

- Edit, Delete, Submit for Review

#### Pending Review

**What it means:**

- Editor has submitted for approval
- Waiting for Manager/Admin review
- Not yet public
- Cannot be edited by original author

**Who can submit:**

- Editors (for their own content)
- Managers (for their own content)

**Actions available:**

- Approve (Manager/Admin only)
- Reject with feedback (Manager/Admin only)
- Edit and Approve (Manager/Admin only)

#### Scheduled

**What it means:**

- Approved for publication
- Will auto-publish at scheduled date/time
- Not yet public
- Cannot be edited once scheduled (without un-scheduling)

**Who can schedule:**

- Managers, Admins

**Actions available:**

- Change schedule date/time
- Publish immediately
- Cancel schedule (revert to draft)

#### Published

**What it means:**

- Live and visible to public
- Indexed by search engines
- Can still be edited
- Changes go live immediately (no re-approval)

**Who can publish:**

- Managers, Admins

**Actions available:**

- Edit (changes live immediately)
- Unpublish (revert to draft)
- Schedule update
- Archive

#### Archived

**What it means:**

- No longer active
- Not visible to public
- Preserved in database
- Can be restored if needed

**Use cases:**

- Past events
- Closed accommodations
- Outdated content
- Seasonal content (off-season)

**Actions available:**

- Restore (return to draft)
- Permanently delete

### Publishing Workflow

#### Editor Workflow

**For users with Editor role:**

```text
1. Create content - Save as Draft
2. Continue editing - Save Draft
3. Ready to publish - Submit for Review
4. Wait for Manager approval
5. If approved - Published
   If rejected - Edit and resubmit
```

**Editor limitations:**

- Cannot publish directly
- Cannot schedule
- Can save drafts
- Can submit for review
- Can edit own drafts

#### Manager/Admin Workflow

**For users with Manager or Admin role:**

```text
1. Create content - Save as Draft
2. Continue editing - Save Draft
3. Ready to publish - Publish or Schedule
```

**Or review Editor submissions:**

```text
1. Receive notification of pending review
2. Review content
3. Approve - Publish or Schedule
   Reject - Provide feedback
   Edit - Make changes and Publish
```

**Manager/Admin privileges:**

- Can publish directly
- Can schedule
- Can approve others' content
- Can edit published content
- Can unpublish content

### Review and Approval

**When Editor submits content:**

**Manager receives:**

- Email notification
- In-app notification
- Content appears in "Pending Review" list

**Manager reviews:**

1. Open content for review
2. Check all fields complete
3. Verify images and media
4. Check SEO settings
5. Preview public page

**Manager options:**

- **Approve** - Publish immediately or schedule
- **Edit and Approve** - Make changes and publish
- **Reject** - Send back with feedback

**Rejection feedback example:**

```text
Reason: Incomplete information

Feedback:
- Add at least 5 more images
- Expand description to minimum 200 words
- Add house rules and policies
- Verify contact phone number

Please resubmit when complete.
```

**Editor receives:**

- Email notification of rejection
- Can view feedback
- Can edit and resubmit
- Content remains in Draft status

---

## Image Management

### Uploading Images

**Supported formats:**

- JPG/JPEG
- PNG
- WebP (recommended)

**Size requirements:**

- Minimum: 1200x800px
- Recommended: 1920x1080px or higher
- Max file size: 5MB per image

**Upload methods:**

#### Single Upload

1. Click **Upload Image** button
2. Select file from computer
3. Wait for upload
4. Image added to gallery

#### Bulk Upload

1. Click **Upload Images** (plural)
2. Select multiple files (Ctrl/Cmd + Click)
3. Or drag-and-drop files onto upload area
4. Progress bar shows upload status
5. All images added to gallery

#### Drag and Drop

1. Open file explorer
2. Select images
3. Drag onto upload area
4. Drop to upload

### Organizing Images

**Reordering:**

- Drag images to reorder
- First image = main image (by default)
- Order affects gallery display

**Setting Main Image:**

- Click star icon on any image
- Main image shown in search results
- Main image shown at top of detail page

**Deleting Images:**

- Click trash icon
- Confirm deletion
- Cannot be undone
- Ensure not referenced elsewhere

### Image Optimization

**Automatic optimizations:**

- Resize to optimal dimensions
- Compress to reduce file size
- Generate thumbnails
- Convert to WebP (modern browsers)
- Create responsive variants

**Manual optimizations:**

- Crop/rotate before upload
- Use JPG for photos
- Use PNG for graphics with transparency
- Compress before upload (tools like TinyPNG)

### Image Captions

**Add captions for:**

- Accessibility (screen readers)
- SEO (alt text)
- Context (what is shown in image)

**Example captions:**

```text
Main Image: "Hotel Central exterior with courtyard"
Bedroom: "Spacious double room with ensuite bathroom"
Pool: "Outdoor swimming pool with sun loungers"
Breakfast: "Continental breakfast buffet"
```

**Best practices:**

- Descriptive and specific
- Include key features
- 10-20 words optimal
- Do not use "image of" or "photo of"
- Do not keyword stuff

---

## Scheduling Content

### Why Schedule Content?

**Use cases:**

- Launch accommodations at specific date
- Coordinate with marketing campaigns
- Publish events closer to date
- Batch content creation
- Time-zone optimization

### Scheduling Options

**When editing content:**

1. Complete all content fields
2. Instead of "Publish Now", click "Schedule"
3. Select date and time
4. Choose timezone (if different from default)
5. Save schedule

**Schedule settings:**

```text
Publish Date: 2024-02-15
Publish Time: 08:00 AM
Timezone: America/Argentina/Buenos_Aires
```

**Scheduled content:**

- Shows "Scheduled" status badge
- Shows publish date in list
- Appears in "Scheduled Content" filter
- Automatically publishes at scheduled time

### Managing Scheduled Content

**View scheduled:**

1. Apply "Scheduled" status filter
2. Sort by publish date
3. See upcoming publications

**Change schedule:**

1. Open scheduled content
2. Edit publish date/time
3. Save changes

**Publish early:**

1. Open scheduled content
2. Click "Publish Now"
3. Confirm immediate publication

**Cancel schedule:**

1. Open scheduled content
2. Click "Unschedule"
3. Reverts to Draft status

---

## Bulk Operations

### Bulk Content Actions

**Access:** Content list - Select items - Actions menu

**Available bulk actions:**

- **Change Status** - Publish, draft, archive multiple items
- **Delete** - Remove multiple items (with confirmation)
- **Export** - Download CSV of selected items
- **Duplicate** - Create copies of selected items
- **Update Category/Tags** - Batch categorization

### Bulk Status Change

#### Example: Publishing Multiple Accommodations

**Steps:**

1. Select accommodations (checkboxes)
2. Actions - Change Status
3. Select "Published"
4. Confirm changes
5. All items publish immediately

**Safety confirmation:**

```text
Publish 15 accommodations?

This will make the following items public:
- Hotel Central
- Beach House
- Mountain Cabin
... (12 more)

[Cancel]  [Publish All]
```

### Bulk Edit

**Update common fields:**

**Steps:**

1. Select items
2. Actions - Bulk Edit
3. Select fields to update
4. Enter new values
5. Preview changes
6. Confirm update

**Editable fields:**

- Destination
- Type/Category
- Tags
- Price (increase/decrease by %)
- Availability status
- Featured status

**Example: 10% price increase:**

```text
Apply to: 20 selected accommodations

Field: Price per Night
Action: Increase by 10%

Preview:
- Hotel Central: $15,000 -> $16,500
- Beach House: $20,000 -> $22,000
... (18 more)

[Cancel]  [Apply Changes]
```

### Bulk Delete

**Use with caution.**

**Steps:**

1. Select items to delete
2. Actions - Delete
3. Choose delete type:
   - Soft delete (archive)
   - Hard delete (permanent)
4. Type confirmation text
5. Confirm deletion

**Safety measures:**

- Requires typing "DELETE" to confirm
- Shows count and list of items
- Cannot be undone (hard delete)
- Soft delete recommended

### Bulk Import/Export

#### Export Content

**Use cases:**

- Backup content
- Offline editing
- Data analysis
- Migration

**Steps:**

1. Apply filters (optional)
2. Select items or Select All
3. Actions - Export
4. Choose format: CSV or Excel
5. Choose fields to include
6. Download file

**Exported fields:**

- All content fields
- SEO metadata
- Status and dates
- Image URLs
- Custom fields

#### Import Content

**Use cases:**

- Bulk content creation
- Data migration
- Restore from backup
- Update multiple items

**Steps:**

1. Download CSV template
2. Fill in content data
3. Upload file
4. Map columns (if needed)
5. Preview import
6. Confirm and import

**CSV format example:**

```csv
name,type,destination,price,description,address
"Hotel Central","hotel","Concepcion del Uruguay",15000,"Charming boutique hotel...","San Martin 123"
"Beach House","house","Mar del Plata",20000,"Beautiful beach house...","Playa Grande 456"
```

**Validation:**

- Required fields checked
- Data types validated
- Duplicate detection
- Invalid rows reported
- Can skip errors or abort

---

## SEO Best Practices

### On-Page SEO

**Every content item should have:**

- Unique, descriptive title
- Compelling meta description
- Clean URL slug
- Relevant keywords
- High-quality images with alt text
- Complete, detailed description
- Internal links to related content

### Title Optimization

**Formula:**

```text
[Primary Keyword] - [Secondary Keyword] - [Location]
```

**Examples:**

- Good: "Boutique Hotel in City Center - Hotel Central Concepcion del Uruguay"
- Good: "Beach House Rental Mar del Plata - Oceanfront Vacation Home"
- Bad: "Hotel" (too generic)
- Bad: "The best hotel in the entire world!!!" (keyword stuffing)

**Title guidelines:**

- Target length: 50-60 characters
- Include location
- Front-load important keywords
- Make it compelling
- Be honest and accurate

### Meta Description

**Purpose:**

- Appears in search results
- Influences click-through rate
- Not a direct ranking factor
- Should sell the content

**Formula:**

```text
[What it is] in [Location]. [Unique features]. [Call to action].
```

**Examples:**

- Good: "Charming boutique hotel in Concepcion del Uruguay city center. Modern rooms, rooftop terrace, excellent location. Book your stay today!"
- Bad: "hotel accommodation place to stay" (too generic)
- Bad: "BEST HOTEL EVER CLICK NOW!!!" (spammy)

**Meta description guidelines:**

- Target length: 150-160 characters
- Include primary keyword
- Highlight unique benefits
- Clear call to action
- Accurate representation

### Image SEO

**Alt text requirements:**

- Describe what is in the image
- Include relevant keywords naturally
- 10-20 words optimal
- Be specific and descriptive

**Filename optimization:**

- Before upload, rename files
- Use descriptive names
- Use hyphens, not spaces
- Include keywords

**Examples:**

```text
Good: hotel-central-double-room-city-view.jpg
Good: mar-del-plata-beach-house-exterior.jpg
Bad: IMG_1234.jpg
Bad: photo.jpg
```

### Internal Linking

**Link to related content:**

- Link accommodations to their destination
- Link destinations to their events
- Link events to nearby accommodations
- Link blog posts to related pages

**Benefits:**

- Helps search engines understand relationships
- Keeps users on site longer
- Distributes page authority
- Improves navigation

---

## Content Quality Checklist

### Before Publishing - Accommodations

**Content completeness:**

- [ ] Name is clear and descriptive
- [ ] Type is selected correctly
- [ ] Destination is assigned
- [ ] Description is minimum 200 words
- [ ] Description includes unique features
- [ ] Description is well-formatted (paragraphs, not wall of text)

**Details:**

- [ ] Address is complete and accurate
- [ ] Coordinates match location
- [ ] Pricing is competitive and current
- [ ] Capacity numbers are correct
- [ ] All relevant amenities selected
- [ ] House rules and policies added

**Images:**

- [ ] Minimum 5 high-quality images
- [ ] Main image is eye-catching
- [ ] Images show variety (exterior, rooms, amenities)
- [ ] Images are well-lit and professional
- [ ] All images have descriptive captions
- [ ] Images are properly ordered

**Contact:**

- [ ] Phone number verified and working
- [ ] Email address verified
- [ ] Website link works (if applicable)
- [ ] Social media links work (if applicable)

**SEO:**

- [ ] SEO title is unique and optimized
- [ ] Meta description is compelling
- [ ] URL slug is clean and readable
- [ ] Keywords are relevant
- [ ] Alt text added to all images

**Final checks:**

- [ ] Preview page looks good
- [ ] All links work
- [ ] No typos or grammar errors
- [ ] Content is accurate and up-to-date
- [ ] Ready for public viewing

### Before Publishing - Destinations

**Content completeness:**

- [ ] Name and type are correct
- [ ] Description is comprehensive (500+ words)
- [ ] Overview highlights main attractions
- [ ] Getting there section complete
- [ ] Local info provided

**Images:**

- [ ] Hero image is high-quality and representative
- [ ] 10-15 gallery images showing variety
- [ ] Images show best of destination
- [ ] All images have captions

**SEO:**

- [ ] Title optimized with keywords
- [ ] Meta description compelling
- [ ] Keywords include main attractions
- [ ] URL slug is clean

### Before Publishing - Events

**Content completeness:**

- [ ] Title is clear and includes year
- [ ] Type is correct
- [ ] Destination is assigned
- [ ] Dates and times are accurate
- [ ] Description includes all important details
- [ ] Schedule/program provided
- [ ] Venue and location clear

**Practical info:**

- [ ] Ticket information provided
- [ ] How to get there explained
- [ ] Organizer contact info included
- [ ] Website link works

**Images:**

- [ ] Official poster/flyer included
- [ ] Photos show atmosphere
- [ ] Venue photos included

**SEO:**

- [ ] Title includes event name and year
- [ ] Meta description includes dates and highlights
- [ ] Event schema generated correctly

---

## Content Tips and Tricks

### Writing Great Descriptions

**Engaging opening:**

- Good: "Discover tranquility at Mountain Cabin, your perfect escape..."
- Bad: "This is a cabin with rooms and a kitchen."

**Highlight unique features:**

- What makes this special?
- What can guests experience here?
- Why choose this over alternatives?

**Use sensory language:**

- "Sun-drenched rooms with ocean views"
- "Cozy fireplace perfect for winter evenings"
- "Wake up to birdsong in this peaceful retreat"

**Include practical details:**

- Walking distance to attractions
- On-site parking available
- Pet-friendly with fenced yard
- Full kitchen for self-catering

**Call to action:**

- "Book your romantic getaway today"
- "Reserve your summer escape now"
- "Contact us for special group rates"

### Photography Guidelines

**Essential shots for accommodations:**

1. Exterior (front, sides, back if relevant)
2. Living areas (living room, common spaces)
3. Bedrooms (all types available)
4. Bathrooms (ensuite and shared)
5. Kitchen (if applicable)
6. Outdoor spaces (garden, patio, pool)
7. Views (from windows, balconies)
8. Special features (fireplace, hot tub, etc.)
9. Neighborhood context

**Photo tips:**

- Natural light is best
- Clean and tidy spaces
- No people in photos (usually)
- Horizontal orientation
- Multiple angles of each room
- No flash photography (harsh shadows)
- No cluttered spaces
- No extreme filters (be authentic)

### Seasonal Content Strategy

**Spring (Sep-Nov):**

- Highlight spring events
- Update accommodation availability
- Feature outdoor activities
- Promote early booking for summer

**Summer (Dec-Feb):**

- Beach and water activities
- Summer festivals and events
- High season accommodations
- Last-minute deals

**Autumn (Mar-May):**

- Fall colors and photography
- Wine harvest events
- Shoulder season promotions
- Cozy cabin experiences

**Winter (Jun-Aug):**

- Winter sports and activities
- Indoor attractions
- Fireplace and heating features
- Low season special offers

---

## Troubleshooting

### Common Issues

#### "Can't Publish Content"

**Check:**

- Your role (need Manager or Admin)
- Content status (cannot publish archived)
- Required fields completed
- Images uploaded (if required)

#### "Images Won't Upload"

**Solutions:**

- Check file size (max 5MB)
- Check format (JPG, PNG, WebP only)
- Check internet connection
- Try different browser
- Compress images before upload

#### "Content Not Appearing on Website"

**Check:**

- Status is "Published" (not Draft or Scheduled)
- Visibility is "Public" (not Unlisted or Private)
- Published date is in the past
- Clear browser cache (Ctrl + Shift + R)
- Wait a few minutes for indexing

#### "SEO Preview Not Showing Correctly"

**Solutions:**

- Save changes first
- Refresh preview
- Check social media cards separately
- Test with real sharing (use link debuggers)

#### "Bulk Operation Failed"

**Check:**

- All selected items meet criteria
- You have required permissions
- No items are locked or being edited
- Try smaller batches

---

## Related Documentation

**Learn more:**

- **[Dashboard Overview](./dashboard.md)** - Platform interface
- **[User Management](./user-management.md)** - Managing users
- **[Back to Usage Docs](./README.md)** - All usage guides

**For developers:**

- **[Content API](../../../api/docs/content.md)** - API endpoints
- **[Architecture](../architecture.md)** - System design

---

Back to [Usage Documentation](./README.md)
