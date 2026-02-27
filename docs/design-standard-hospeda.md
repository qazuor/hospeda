# Hospeda - Design Standard (Unified)

> Combinacion del prototipo de cards (Bolt) + template Adventure Gene + theme Advenx
> Fecha: 2026-02-18
> Status: APPROVED - All decisions finalized

---

## 1. Design Philosophy

Combinar la **limpieza y estructura** del prototipo Bolt (grids, cards, dark mode, badges) con la **calidez y personalidad visual** del template Adventure (fondos decorativos, transiciones organicas, espaciado generoso) y los **patrones de marca premium** de Advenx (triple-font system, accent font handwritten, warm orange accents, full-bleed photo sections).

### Principios

1. **Limpio pero calido**: No frio/corporativo, sino acogedor y turistico
2. **Cards estructuradas**: Del prototipo Bolt - badges, ratings, amenities, grids responsivos
3. **Secciones con personalidad**: Del Adventure + Advenx - fondos tematicos, separadores, espaciado generoso
4. **Accent font con caracter**: Caveat handwritten font para subtitulos de seccion agrega personalidad y calidez
5. **Dark mode nativo**: Del prototipo Bolt - soporte completo light/dark
6. **Mobile-first responsive**: Grids adaptivos probados en 4 breakpoints
7. **Full-bleed photo CTAs**: Del Advenx - secciones con imagen de fondo para CTAs y propietarios

### Sources Reference

- **Prototipo Bolt**: Structure, cards, grids, dark mode, badges, responsive behavior
- **Adventure Gene**: Warm beige sections, SVG wave dividers, generous padding, decorative bg images
- **Advenx**: Triple-font system (display + handwritten + body), warm orange accent, full-bleed photo sections, counter animations, negative margin overlapping

---

## 2. Typography

### 2.1 Font System (Triple-font)

| Rol | Font | Fallback | Uso |
|-----|------|----------|-----|
| **Display** | `Playfair Display` | `Georgia, serif` | H1 hero, H2 section titles, counters |
| **Accent** | `Caveat` | `cursive` | Section subtitles ("Descubri el Litoral"), decorative labels |
| **UI/Body** | `Inter` | `system-ui, sans-serif` | Body, cards, nav, buttons, badges |

> **Decision**: Playfair Display (elegante, premium, adecuada para turismo argentino) + Caveat (handwritten legible, calido sin ser excesivamente casual) + Inter (excelente legibilidad UI, ya del prototipo).

### 2.2 Type Scale

| Token | Font | Size | Weight | Line Height | Transform | Uso |
|-------|------|------|--------|-------------|-----------|-----|
| `display-hero` | Playfair Display | 48px (mobile 32px) | 700 | 1.2 | none | Hero H1 |
| `display-section` | Playfair Display | 36px (mobile 28px) | 700 | 1.3 | none | Section H2 |
| `accent-subtitle` | Caveat | 24px (mobile 20px) | 400 | 1.4 | none | Section subtitles |
| `heading-card` | Inter | 18px | 700 | 28px | none | Card H3 |
| `heading-sub` | Inter | 16px | 600 | 24px | none | Card H4 |
| `section-tag` | Inter | 14px | 500 | 20px | uppercase | Section label ("Proximos Eventos") |
| `body` | Inter | 16px | 400 | 24px | none | Body text |
| `body-large` | Inter | 18px | 400 | 28px | none | Section descriptions |
| `body-small` | Inter | 14px | 400 | 20px | none | Badges, dates, metadata |
| `caption` | Inter | 12px | 500 | 16px | none | Tag pills, small labels |
| `button` | Inter | 16px | 600 | 24px | none | Primary buttons |
| `button-small` | Inter | 14px | 500 | 20px | none | Secondary buttons |
| `counter` | Playfair Display | 40px | 700 | 1.1 | none | Statistics numbers |

---

## 3. Color System

### 3.1 Semantic Colors - Light Mode

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| **Backgrounds** | | | |
| `bg-body` | `#F9FAFB` | `gray-50` | Body background |
| `bg-section-white` | `#FFFFFF` | `white` | White sections |
| `bg-section-gray` | `#F3F4F6` | `gray-100` | Alternate gray sections (functional: blog, contact) |
| `bg-section-warm` | `#F9F4EE` | custom | Warm beige sections (touristic: destinations, accommodations) |
| `bg-card` | `#FFFFFF` | `white` | Card backgrounds |
| `bg-header` | `#FFFFFF` | `white` | Sticky header |
| **Text** | | | |
| `text-primary` | `#111827` | `gray-900` | Headings, primary text |
| `text-secondary` | `#374151` | `gray-700` | Nav links, secondary |
| `text-muted` | `#6B7280` | `gray-500` | Descriptions, metadata |
| `text-on-accent` | `#FFFFFF` | `white` | Text on colored backgrounds |
| **Accents** | | | |
| `accent-primary` | `#3B82F6` | `blue-500` | CTAs, prices, primary actions |
| `accent-warm` | `#F97316` | `orange-500` | High-impact CTAs: "Reservar", "Suscribirse", propietarios CTA |
| `accent-secondary` | `#22C55E` | `green-500` | Success, section icons, events |
| `accent-tertiary` | `#0EA5E9` | `sky-500` | Destinations, info |
| **Borders** | | | |
| `border-default` | `#E5E7EB` | `gray-200` | Cards, header |
| `border-light` | `#F3F4F6` | `gray-100` | Subtle separators |
| **Category badges** | | | |
| `cat-carnaval` | `#EC4899` | `pink-500` | |
| `cat-consejos` | `#22C55E` | `green-500` | |
| `cat-gastronomia` | `#F97316` | `orange-500` | |
| `cat-naturaleza` | `#22C55E` | `green-500` | |
| `cat-playa` | `#14B8A6` | `teal-500` | |
| `cat-tradiciones` | `#A855F7` | `purple-500` | |

### 3.2 Section Background Strategy (Hybrid warm + gray)

```
Touristic sections (warm beige #F9F4EE):
  - Featured Accommodations
  - Featured Destinations
  - Statistics/Counters
  - Testimonials
  - Category Icons

Functional sections (gray-100 #F3F4F6):
  - Blog Posts
  - Contact/Forms
  - FAQ
  - Search Results

Always white:
  - Hero (full-bleed image)
  - First section below hero
  - Newsletter (background image)
  - Owner CTA (background image)
```

### 3.3 Semantic Colors - Dark Mode

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `bg-body` | `#111827` | `gray-900` | Body |
| `bg-section-alt` | `#1F2937` | `gray-800` | Alternate gray sections |
| `bg-section` | `#111827` | `gray-900` | Standard sections |
| `bg-section-warm` | `#1C1917` | `stone-900` | Warm sections (dark equivalent) |
| `bg-card` | `#1F2937` | `gray-800` | Cards |
| `bg-header` | `#111827` | `gray-900` | Header |
| `text-primary` | `#FFFFFF` | `white` | Headings |
| `text-secondary` | `#D1D5DB` | `gray-300` | Secondary |
| `text-muted` | `#9CA3AF` | `gray-400` | Muted |
| `border-default` | `#374151` | `gray-700` | Borders |

### 3.4 Event Panel Colors (Rotating)

```
Pattern: blue -> green -> sky -> blue -> green -> sky
#3B82F6 -> #22C55E -> #0EA5E9 -> repeat
```

---

## 4. Spacing System

### 4.1 Section Padding

| Section type | Padding-Y | Tailwind |
|-------------|-----------|----------|
| Hero | 0 (full bleed) | -- |
| First section below hero | `80px` | `py-20` |
| Standard sections | `96px` | `py-24` |
| Feature sections (CTA, membership, stats) | `120px` | `py-30` (custom) |
| Compact sections | `64px` | `py-16` |

### 4.2 Container & Full-bleed Strategy

**Two-layer layout**: Section backgrounds are ALWAYS full-viewport width. Content is constrained within a centered container.

```html
<!-- Pattern: full-bleed section + constrained content -->
<section class="w-full bg-warm">        <!-- Full-width bg -->
  <div class="max-w-site mx-auto px-4 sm:px-6">  <!-- Centered content -->
    <!-- Grid, text, cards here -->
  </div>
</section>
```

| Layer | Width | Tailwind |
|-------|-------|----------|
| Section wrapper (backgrounds, images, overlays) | `100vw` | `w-full` |
| Content container | max `1200px`, centered | `max-w-site mx-auto` |
| Content padding-X | `16px` (mobile) / `24px` (tablet+) | `px-4 sm:px-6` |

**Full-bleed elements** (always 100% viewport width):

- All section background colors (warm beige, gray, white)
- Background images (hero, stats, newsletter, owner CTA)
- Overlays on background images
- Wave divider SVG
- Footer background
- Header/nav background

**Constrained elements** (max 1200px, centered):

- Text content, headings, descriptions
- Card grids
- Search bar
- Forms
- Navigation links
- Footer columns content

### 4.3 Grid Gap

- Standard: `24px` (`gap-6`)
- Compact: `16px` (`gap-4`) para amenities, tags
- Large: `32px` (`gap-8`) para sections como testimonials

### 4.4 Section Transitions

```
Hero -> First section: SVG wave divider at hero bottom
  - SVG fills with next section's bg color
  - Positioned absolute at bottom of hero
  - Responsive height (40-60px)

All other transitions: Negative margin overlap
  - Overlap: margin-top: -20px to -30px
  - Subtle visual continuity between different bg colors
  - No overlap between same-color sections
```

---

## 5. Card System

### 5.1 Base Card Styles

| Property | Value | Tailwind |
|----------|-------|----------|
| Border-radius | `12px` | `rounded-xl` |
| Border | `1px solid` border-default | `border border-gray-200 dark:border-gray-700` |
| Background | white / gray-800 | `bg-white dark:bg-gray-800` |
| Overflow | hidden | `overflow-hidden` |
| Cursor | pointer | `cursor-pointer` |
| Transition | `all 0.3s ease` | `transition-all duration-300` |

### 5.2 Card Shadow Levels

| Level | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | `shadow-sm` | Event cards, testimonials |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | `shadow-md` | Accommodation, blog cards |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | `shadow-lg` | Destination cards, hover state |
| `shadow-hover` | `0 20px 25px -5px rgba(0,0,0,0.1)` | `shadow-xl` | Cards on hover |

### 5.3 Card Hover Effect

```css
/* Standard card hover */
transform: translateY(-4px);
box-shadow: shadow-hover;
transition: all 0.3s ease;
```

---

## 6. Section Pattern

### 6.1 Homepage Section Order

```
1. Hero (carousel + search bar) - full-bleed image
2. Featured Accommodations - white bg
3. Featured Destinations - warm beige bg
4. Statistics/Counters - background image + overlay
5. Featured Events - white bg
6. Category Icons - warm beige bg
7. Featured Blog Posts - gray-100 bg
8. Testimonials - warm beige bg
9. Newsletter CTA - background image + overlay
10. Owner CTA ("Publica tu alojamiento") - full-bleed photo
11. Footer
```

### 6.2 Section Header Pattern

```
Layout: centrado

1. [Opcional] Accent subtitle: Caveat, 24px, text-muted/accent ("Descubri el Litoral")
2. [Opcional] Section icon: 48x48px, colored bg, rounded-xl, con icono SVG blanco
3. H2 Title: Playfair Display, 36px, bold, text-primary
4. Description: Inter 18px, text-muted, max-width 600px, centrado
5. [Opcional] "Ver todos" link: derecha, outlined button

Spacing:
  - Accent subtitle to title: 8px
  - Icon to title: 16px
  - Title to description: 12px
  - Description to grid: 40px
```

### 6.3 Background Image Sections

```
Pattern:
  - Background image: cover, center
  - Overlay: rgba(0,0,0,0.4) a rgba(0,0,0,0.6)
  - Text: white
  - Padding: 120px vertical

Sections using this pattern:
  - Statistics/counters (imagen paisaje entrerriano)
  - Newsletter CTA (imagen rio/costa)
  - Owner CTA (imagen alojamiento premium)
```

---

## 7. Responsive Breakpoints

### 7.1 Grid Columns

| Section | sm (< 640) | md (640-767) | lg (768-1023) | xl (1024-1279) | 2xl (1280+) |
|---------|-----------|-------------|--------------|---------------|-------------|
| Events | 1 col | 1 col | 1 col | 2 col | 2 col |
| Accommodations | 1 col | 2 col | 2 col | 3 col | 3 col |
| Destinations | 1 col | 2 col | 2 col | 3 col | 4 col |
| Testimonials | 1 col | 1 col | 2 col | 3 col | 4 col |
| Blog Posts | 1 col | 2 col | 2 col | 3 col | 3 col |
| Categories | 2 col | 3 col | 3 col | 6 col | 6 col |
| Counters/Stats | 2 col | 2 col | 4 col | 4 col | 4 col |

### 7.2 Typography Responsive

| Token | Mobile (< 640) | Tablet (640+) | Desktop (1024+) |
|-------|---------------|---------------|-----------------|
| `display-hero` | 32px | 40px | 48px |
| `display-section` | 24px | 30px | 36px |
| `accent-subtitle` | 20px | 22px | 24px |
| `body-large` | 16px | 18px | 18px |
| `counter` | 32px | 36px | 40px |

### 7.3 Responsive Behavior Notes

| Breakpoint | Header | Hero | Sections |
|-----------|--------|------|----------|
| Mobile (375) | Logo + hamburger | Stacked title, full-width CTA, search stacked | Single column, py-12 to py-16 |
| Tablet (768) | Logo + hamburger | 2-line title, search bar stacked | 2-column grids, py-16 to py-20 |
| Desktop (1024+) | Full nav + accent-warm "Reservar" CTA | Full hero with inline search | Multi-column grids, py-20 to py-30 |

---

## 8. Component Reference

### 8.1 Hero Section

```
Full-viewport height (100vh o min-height 600px)
Background: carousel (3-5 photos of Entre Rios landscapes/attractions)
Overlay: gradient (bottom darker for search bar readability)

Content:
  - Accent subtitle: Caveat, 24px, white, "Descubri el Litoral"
  - H1: Playfair Display, display-hero, white
  - Subtitle: Inter, body-large, white/80%
  - Search bar: flex row, bg white, rounded-xl, shadow-lg
    - Select "Tipo" + Select "Destino" + Date input + CTA button
    - CTA: accent-primary bg, white text, rounded-r-lg (8px)

SVG wave divider at bottom (fills next section bg color)

Carousel:
  - Auto-advance every 5-7 seconds
  - Smooth fade or slide transition
  - Dot indicators at bottom
  - Pause on hover (desktop)
```

### 8.2 Cards (del Prototipo)

Se mantienen las 5 cards del prototipo:

- EventCard (con date panel coloreado)
- AccommodationCard (con badges de tipo y precio)
- DestinationCard (imagen full-background con gradient)
- TestimonialCard (avatar, quote, rating, star icons)
- BlogPostCard (categoria coloreada, tags)

**Ajustes**:

- Border-radius: 12px (`rounded-xl`)
- Hover: translateY(-4px) + shadow elevation
- Images: border-radius top 12px, bottom 0 (via overflow-hidden on card)

### 8.3 Statistics Section

```
Background: imagen paisaje entrerriano
Overlay: rgba(0,0,0,0.5)
Padding: 120px vertical

Grid 4 columnas (2 en mobile)
Cada counter:
  - Numero: Playfair Display, 40px, bold, white
  - "+" suffix if applicable
  - Label: Inter, 14px, uppercase, white/80%
  - Animated count-up on scroll (IntersectionObserver)

Data examples:
  - "+500" / "Alojamientos"
  - "50+" / "Destinos"
  - "1000+" / "Reviews"
  - "10+" / "Anios de experiencia"
```

### 8.4 Category Icons Section

```
Background: warm beige (#F9F4EE)
Padding: 96px vertical

Grid 6 columnas (3 tablet, 2 mobile)
Cada item:
  - Icon: 64x64px, rounded-xl, colored bg
  - Titulo: Inter, 16px, bold
  - Conteo: "45 alojamientos", text-muted
  - Hover: scale(1.05) + shadow-md
```

### 8.5 Newsletter Section

```
Background: imagen rio/costa entrerriana
Overlay: gradient oscuro
Padding: 120px vertical
Contenido centrado:
  - Accent subtitle: Caveat, white, "Mantenete informado"
  - H2: Playfair Display, white
  - Description: Inter, white/80%
  - Form: input + button inline
    - Input: h-14, rounded-l-lg, no border, placeholder gray
    - Button: accent-primary, h-14, rounded-r-lg, "Suscribirse"
```

### 8.6 Owner CTA Section ("Publica tu alojamiento")

```
Full-width background image (alojamiento premium/actividad)
Overlay: rgba(0,0,0,0.4)
Padding: 120px vertical
Content (left-aligned or centered):
  - Accent subtitle: Caveat, white, "Para propietarios"
  - H2: Playfair Display, 48px, white, "Publica tu alojamiento en Hospeda"
  - Description: Inter, body-large, white/80%
  - CTA button: accent-warm (#F97316), "Comenzar ahora", rounded-lg
```

### 8.7 Testimonial Section

```
Background: warm beige (#F9F4EE) or white
Carousel layout with navigation arrows and dots
Each testimonial:
  - Circular photo avatar (80-100px)
  - Location label (small, muted)
  - Quote text: Inter, body, italic
  - Name: Inter, 18px, 600
  - Star rating (5 stars, amber-400/filled)
Auto-advance, pause on hover
```

---

## 9. Buttons

| Variant | Background | Color | Padding | Border-radius | Font |
|---------|-----------|-------|---------|--------------|------|
| Primary | `accent-primary` (`blue-500`) | white | `12px 32px` | `8px` | 16px / 600 |
| Primary Large | `accent-primary` | white | `16px 48px` | `8px` | 16px / 600 |
| Primary Warm | `accent-warm` (`orange-500`) | white | `12px 32px` | `8px` | 16px / 600 |
| Secondary (outlined) | transparent | text-secondary | `8px 16px` | `8px` | 14px / 500, border 1px |
| Ghost | transparent | text-muted | `8px 16px` | `8px` | 14px / 400 |
| CTA Hero | `accent-primary` | white | `16px 40px` | `0 8px 8px 0` | 16px / 600 |

### Button Usage Guide

- **Primary blue**: Standard actions (search, view, navigate)
- **Primary warm orange**: High-conversion CTAs (reserve, subscribe, register as owner)
- **Secondary outlined**: Alternative actions (view all, filters)
- **Ghost**: Tertiary actions (read more, cancel)

---

## 10. Badge / Pill System

| Variant | Background | Color | Padding | Border-radius | Font |
|---------|-----------|-------|---------|--------------|------|
| Type (accommodation) | `white/90%` | gray-800 | `4px 12px` | `9999px` | 14px / 500 |
| Price | accent-primary | white | `4px 12px` | `9999px` | 14px / 700 |
| Category (blog) | per-category color | white | `4px 12px` | `9999px` | 14px / 500 |
| Date | `black/60%` | white | `4px 8px` | `4px` | 14px / 400 |
| Tag (content) | gray-100 | gray-600 | `4px 8px` | `9999px` | 12px / 500 |
| Rating | amber-400 | white | `4px 8px` | `6px` | 14px / 700 |
| Month (event) | rotating accent | white | `4px 8px` | `4px` | 18px / 700 |
| Amenity | transparent | gray-600 | `0` | -- | 14px / 400 + icon |

---

## 11. Implementation Roadmap

### Phase 0: Design Tokens (Tailwind Config)

- [ ] Add Playfair Display font (Google Fonts)
- [ ] Add Caveat font (Google Fonts)
- [ ] Add custom colors: `bg-warm` (#F9F4EE), `accent-warm` (orange-500 alias)
- [ ] Configure container max-width 1200px
- [ ] Configure typography scale tokens
- [ ] Set up shadow levels
- [ ] Configure dark mode custom properties (stone-900 for warm sections)

### Phase 1: Global Layout

- [ ] Create `SectionWrapper` component (bg variants: white/gray/warm, padding scale, overlap)
- [ ] Create `SectionHeader` component (Caveat subtitle + icon + Playfair title + description)
- [ ] Create `WaveDivider` SVG component (hero bottom only)
- [ ] Update container max-width to 1200px
- [ ] Implement section padding scale (64/80/96/120px)

### Phase 2: Hero Section

- [ ] Full-bleed hero with image carousel (3-5 slides)
- [ ] Caveat accent subtitle
- [ ] Search bar overlay (tipo + destino + fecha + CTA)
- [ ] Wave divider at bottom
- [ ] Responsive typography scaling
- [ ] Carousel auto-advance + controls

### Phase 3: Card Components (Redesign)

- [ ] `EventCard` - date panel + content (12px radius)
- [ ] `AccommodationCard` - image overlays + amenities (12px radius)
- [ ] `DestinationCard` - full-bg image + gradient (12px radius)
- [ ] `TestimonialCard` - avatar + quote + rating + stars
- [ ] `BlogPostCard` - category badge + tags (12px radius)
- [ ] Hover effects on all cards (translateY(-4px) + shadow-xl)

### Phase 4: New Sections

- [ ] `StatisticsSection` - 4 counters with bg image + overlay + count-up animation
- [ ] `CategoryIconsSection` - activity/type grid on warm beige
- [ ] `NewsletterSection` - bg image + overlay + form
- [ ] `OwnerCTASection` - full-bleed photo + orange CTA ("Publica tu alojamiento")
- [ ] `PartnersSection` - logo row

### Phase 5: Responsive

- [ ] Test all grids at 375, 640, 768, 1024, 1280, 1440
- [ ] Event card column/row switch
- [ ] Mobile navigation (hamburger)
- [ ] Typography responsive scaling
- [ ] Section padding responsive reduction
- [ ] Hero search bar stacking on mobile

### Phase 6: Dark Mode

- [ ] Apply dark tokens to all components
- [ ] Warm section dark equivalent (stone-900)
- [ ] Badge contrast verification
- [ ] Wave divider dark colors
- [ ] Background image overlay adjustments (slightly darker in dark mode)
- [ ] Caveat font contrast on dark backgrounds

### Phase 7: Polish

- [ ] Card hover animations (translateY + shadow)
- [ ] Counter animated count-up on scroll (IntersectionObserver)
- [ ] Section entry animations (fade-in on scroll)
- [ ] Truncation with ellipsis
- [ ] "+N" overflow badges
- [ ] Testimonial carousel with navigation
- [ ] Loading skeletons

---

## 12. Decisions Log (All Approved 2026-02-18)

| # | Decision | Result | Rationale |
|---|----------|--------|-----------|
| 1 | Font Display | **Playfair Display** | Elegante, premium, adecuada para turismo argentino |
| 2 | Font Accent | **Caveat** | Handwritten legible, calido sin ser excesivamente casual |
| 3 | Warm Sections | **Hibrido**: warm beige turisticas + gray-100 funcionales | Calidez donde importa, neutralidad donde es funcional |
| 4 | Section Dividers | **Hibrido**: wave SVG bajo hero + overlap sutil resto | Maximo impacto en hero, simplicidad en el resto |
| 5 | Hero | **Carousel + search bar** | Dinamismo + patron de conversion probado en turismo |
| 6 | Accent Warm | **#F97316 orange-500** para CTAs de alto impacto | Calido, nativo Tailwind, para "Reservar" / "Suscribirse" / owner CTA |
| 7 | Statistics | **Si**, counters animados con imagen fondo + overlay | Patron de credibilidad/conversion probado |
| 8 | Owner CTA | **Si**, CTA para propietarios ("Publica tu alojamiento") | Valor de negocio B2B real |
| 9 | Border-radius | **12px** (`rounded-xl`) para cards | Punto medio entre prototipo (16px) y Adventure (10px) |
| 10 | Container width | **1200px** | Estandar moderno, buena legibilidad |
| 11 | Button radius | **8px** (`rounded-lg`) para botones | Suave, profesional, ligeramente menor que cards |
