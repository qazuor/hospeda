# Navigation Guide

Complete guide to navigating the Hospeda platform.

---

## 🗺️ Site Structure

### Main Sections

The platform is organized into four main sections:

1. **Home** - Landing page and featured content
2. **Accommodations** - Browse and search properties
3. **Destinations** - Explore tourist destinations
4. **Events** - Find upcoming events
5. **Blog** - Read news and articles

---

## 📱 Header Navigation

### Desktop Header

**Left Side**:

- **Logo**: Click to return to homepage
- **Main Menu**:
  - Accommodations
  - Destinations
  - Events
  - Blog

**Right Side**:

- **Language Selector** (🌐): Switch ES/EN
- **Search Icon** (🔍): Open search
- **User Menu** (👤):
  - Sign In / Sign Up (if not logged in)
  - Profile
  - Favorites
  - My Bookings
  - Settings
  - Sign Out

### Mobile Header

**Layout**:

- **Hamburger Menu** (☰): Left side
- **Logo**: Center
- **Search Icon** (🔍): Right side

**Hamburger Menu Contains**:

- Main navigation links
- Language selector
- User account options
- Sign in/out

---

## 🏠 Homepage

### Page Sections (Top to Bottom)

1. **Hero Section**
   - Large banner image
   - Search bar
   - Call-to-action buttons

2. **Featured Accommodations**
   - Carousel of highlighted properties
   - "View All" button
   - Quick filters

3. **Popular Destinations**
   - Grid of destination cards
   - "Explore More" link

4. **Upcoming Events**
   - Event list or calendar preview
   - "See All Events" button

5. **Latest Blog Posts**
   - Article cards
   - "Read More" links

6. **Newsletter Signup**
   - Email subscription form
   - Benefits description

7. **Footer**
   - Site navigation
   - Contact information
   - Social media links
   - Legal links

---

## 🏨 Accommodations Section

### Main Page (`/alojamientos`)

**Layout**:

1. **Search Bar** (Top)
   - Keyword search
   - Quick filters

2. **Filters Sidebar** (Left, Desktop only)
   - Location
   - Price range
   - Property type
   - Amenities
   - Rating

3. **Results Grid** (Main area)
   - Accommodation cards
   - Sort dropdown
   - View toggle (grid/list/map)

4. **Pagination** (Bottom)
   - Page numbers
   - Previous/Next buttons

**Mobile Layout**:

- Search bar at top
- Filter button opens modal
- Results in single column
- Infinite scroll (optional)

### Accommodation Detail Page

**URL Pattern**: `/alojamientos/[slug]`

**Page Structure**:

1. **Breadcrumbs**: Home > Accommodations > [Name]
2. **Image Gallery**: Main carousel
3. **Quick Info**: Name, location, rating
4. **Description**: Full details
5. **Amenities**: Icon list
6. **Pricing**: Rates and policies
7. **Reviews**: Guest reviews
8. **Map**: Location map
9. **Similar Properties**: Recommendations

---

## 🗺️ Destinations Section

### Main Page (`/destinos`)

**Layout**:

1. **Hero Banner**
   - Featured destination
   - CTA button

2. **Category Tabs**
   - Nature
   - Culture
   - Adventure
   - Food & Wine

3. **Destination Grid**
   - Cards with images
   - Brief descriptions
   - "Learn More" links

### Destination Detail Page

**URL Pattern**: `/destinos/[slug]`

**Page Structure**:

1. **Breadcrumbs**: Home > Destinations > [Name]
2. **Hero Image**: Large banner
3. **Overview**: Introduction and details
4. **Attractions**: Points of interest
5. **Gallery**: Photo collection
6. **Nearby Accommodations**: Links
7. **Upcoming Events**: Event list
8. **Map**: Interactive location map

---

## 📅 Events Section

### Main Page (`/eventos`)

**Layout Options**:

**Calendar View**:

- Monthly calendar grid
- Events marked on dates
- Click date to filter

**List View**:

- Upcoming events list
- Sort by date/popularity
- Filter sidebar

**Layout Elements**:

1. **View Toggle**: Calendar/List
2. **Date Filter**: Specific dates
3. **Category Filter**: Event types
4. **Search**: Find events

### Event Detail Page

**URL Pattern**: `/eventos/[slug]`

**Page Structure**:

1. **Breadcrumbs**: Home > Events > [Name]
2. **Event Header**: Image, name, date
3. **Details**: Description, schedule
4. **Tickets**: Pricing, purchase
5. **Location**: Venue, map
6. **Related Events**: Recommendations

---

## 📰 Blog Section

### Main Page (`/publicaciones`)

**Layout**:

1. **Featured Post**
   - Large card at top
   - Hero image
   - Excerpt

2. **Category Filter**
   - Travel Tips
   - Local News
   - Guides
   - Reviews

3. **Article Grid**
   - Post cards
   - Images and excerpts
   - Read time estimate

4. **Sidebar** (Desktop)
   - Popular posts
   - Categories
   - Tags

### Article Detail Page

**URL Pattern**: `/publicaciones/[slug]`

**Page Structure**:

1. **Breadcrumbs**: Home > Blog > [Category] > [Title]
2. **Article Header**: Title, author, date
3. **Feature Image**: Hero image
4. **Content**: Full article
5. **Tags**: Topic tags
6. **Share Buttons**: Social sharing
7. **Related Articles**: Recommendations

---

## 🔍 Search

### Global Search

**Access**: Search icon (🔍) in header

**Features**:

- Overlay search bar
- Live results as you type
- Categories (All, Accommodations, Destinations, Events, Posts)
- Recent searches
- Popular searches

### Search Results Page

**URL**: `/search?q=[query]`

**Layout**:

1. **Search Bar**: Refine search
2. **Filters**: Type, date, location
3. **Results**:
   - Grouped by type
   - Relevance sorting
   - Pagination

---

## 👤 User Account Pages

### Sign In / Sign Up

**URLs**:

- `/auth/signin` - Sign in page
- `/auth/signup` - Sign up page

**Features**:

- Email/password form
- Social sign-in options
- Forgot password link
- Switch between sign in/up

### User Profile

**URL**: `/profile` or `/account`

**Sections**:

- Personal information
- Profile photo
- Email preferences
- Account settings

### My Favorites

**URL**: `/favorites` or `/account/favorites`

**Features**:

- Saved accommodations
- Saved destinations
- Saved events
- Remove favorites
- Filter by type

### My Bookings

**URL**: `/bookings` or `/account/bookings`

**Tabs**:

- Upcoming bookings
- Past bookings
- Cancelled bookings

**Actions**:

- View details
- Cancel booking
- Contact property
- Download confirmation

---

## 🦶 Footer Navigation

### Footer Sections

**Company**:

- About Us
- Contact
- Careers
- Press

**Resources**:

- Help Center
- FAQ
- Blog
- Sitemap

**Legal**:

- Terms of Service
- Privacy Policy
- Cookie Policy
- Accessibility

**Connect**:

- Facebook
- Instagram
- Twitter
- Email Newsletter

---

## 🍞 Breadcrumbs

### Understanding Breadcrumbs

Shows your current location in site hierarchy:

```text
Home > Accommodations > Hotels > Hotel Name
```

**Features**:

- Click any level to navigate up
- Always starts with "Home"
- Shows path to current page
- Desktop and tablet only

---

## ⌨️ Keyboard Navigation

### Essential Shortcuts

- **Tab**: Move to next element
- **Shift + Tab**: Move to previous element
- **Enter**: Activate link/button
- **Escape**: Close modals/menus
- **Arrow Keys**: Navigate within components

### Skip Links

- "Skip to main content"
- "Skip to footer"
- Visible on Tab key

---

## 🔗 Quick Links

### Common Paths

**From Homepage**:

- Browse accommodations: Click "Accommodations" in header
- Find events: Click "Events" in header
- Explore destinations: Click "Destinations" in header
- Read blog: Click "Blog" in header

**From Any Page**:

- Return home: Click logo
- Search: Click search icon
- Account: Click user icon
- Change language: Click language selector

---

## 📍 URL Structure

### Page URLs

```text
Homepage:         /
Accommodations:   /alojamientos
Accommodation:    /alojamientos/[slug]
Destinations:     /destinos
Destination:      /destinos/[slug]
Events:           /eventos
Event:            /eventos/[slug]
Blog:             /publicaciones
Post:             /publicaciones/[slug]
Search:           /search
Profile:          /profile
Bookings:         /bookings
Favorites:        /favorites
Sign In:          /auth/signin
Sign Up:          /auth/signup
```

### URL Parameters

**Pagination**:

```text
/alojamientos?page=2
/alojamientos/page/2
```

**Search**:

```text
/search?q=hotel
/alojamientos?search=centro
```

**Filters**:

```text
/alojamientos?tipo=hotel&precio=1000-5000
/eventos?categoria=musica&fecha=2025-12
```

---

## 🎯 Navigation Tips

### Finding Content

1. **Use Search**: Fastest for specific items
2. **Use Filters**: Narrow down results
3. **Use Categories**: Browse by type
4. **Use Breadcrumbs**: Navigate hierarchy

### Mobile Navigation

1. **Hamburger Menu**: Access all pages
2. **Bottom Navigation**: Quick access (if available)
3. **Swipe Gestures**: Navigate galleries
4. **Pull to Refresh**: Update content

### Desktop Navigation

1. **Main Menu**: Quick access to sections
2. **Hover Menus**: Sub-navigation (if available)
3. **Right-Click**: Browser navigation
4. **Keyboard**: Tab through elements

---

## 🚀 Performance Tips

### Faster Navigation

- Use browser back/forward buttons
- Bookmark frequently visited pages
- Open links in new tabs (Ctrl/Cmd + Click)
- Use browser history (Ctrl/Cmd + H)

### Reduce Loading Times

- Enable JavaScript
- Use modern browser
- Clear cache periodically
- Stable internet connection

---

⬅️ Back to [Usage Guide](README.md)
