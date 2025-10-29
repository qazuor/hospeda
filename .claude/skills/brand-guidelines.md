# Brand Guidelines Skill

## Purpose

Apply Hospeda brand guidelines consistently across all UI components, ensuring visual coherence, proper use of colors, typography, tone of voice, and design system elements (Tailwind CSS + Shadcn UI).

---

## Capabilities

- Apply color palette automatically
- Use correct typography (fonts, sizes, weights)
- Maintain tone of voice in copy
- Use approved logo variations
- Ensure brand consistency
- Apply design system (Tailwind + Shadcn)
- Create brand-compliant components
- Design responsive layouts

---

## Brand Identity

### Brand Essence

**Hospeda** is a tourism accommodation platform for ConcepciÛn del Uruguay and the Litoral region of Argentina.

**Brand Personality:**

- **Welcoming**: Like a friendly host
- **Trustworthy**: Professional and reliable
- **Local**: Deeply connected to the region
- **Authentic**: Real experiences, honest presentation
- **Warm**: Inviting and comfortable

**Brand Promise:**
"Discover authentic accommodations in the Litoral region, where every stay feels like home."

---

## Color System

### Primary Palette

```css
/* Primary Blue - Trust, reliability, water (rivers) */
--primary-50:  #eff6ff
--primary-100: #dbeafe
--primary-200: #bfdbfe
--primary-300: #93c5fd
--primary-400: #60a5fa
--primary-500: #3b82f6  /* Main brand color */
--primary-600: #2563eb
--primary-700: #1d4ed8
--primary-800: #1e40af
--primary-900: #1e3a8a
```text

**Usage:**

- **Primary-500**: Main CTAs, links, active states
- **Primary-600**: Hover states, emphasis
- **Primary-100**: Backgrounds, subtle highlights
- **Primary-900**: Headings, strong text

### Secondary Palette

```css
/* Warm Orange - Sunsets, hospitality, warmth */
--secondary-50:  #fff7ed
--secondary-100: #ffedd5
--secondary-200: #fed7aa
--secondary-300: #fdba74
--secondary-400: #fb923c
--secondary-500: #f97316  /* Accent color */
--secondary-600: #ea580c
--secondary-700: #c2410c
--secondary-800: #9a3412
--secondary-900: #7c2d12
```text

**Usage:**

- **Secondary-500**: Secondary CTAs, badges, highlights
- **Secondary-100**: Featured backgrounds
- **Secondary-700**: Hover states for secondary buttons

### Neutral Palette

```css
/* Grays - Text, borders, backgrounds */
--gray-50:  #f9fafb
--gray-100: #f3f4f6
--gray-200: #e5e7eb
--gray-300: #d1d5db
--gray-400: #9ca3af
--gray-500: #6b7280
--gray-600: #4b5563  /* Body text */
--gray-700: #374151
--gray-800: #1f2937
--gray-900: #111827  /* Headings */
```text

**Usage:**

- **Gray-900**: Main headings
- **Gray-600**: Body text
- **Gray-400**: Subtle text, placeholders
- **Gray-100**: Light backgrounds
- **Gray-200**: Borders

### Semantic Colors

```css
/* Success - Green */
--success-50:  #f0fdf4
--success-500: #10b981
--success-700: #047857

/* Warning - Yellow */
--warning-50:  #fffbeb
--warning-500: #f59e0b
--warning-700: #b45309

/* Error - Red */
--error-50:  #fef2f2
--error-500: #ef4444
--error-700: #b91c1c

/* Info - Blue (same as primary) */
--info-500: #3b82f6
```text

**Usage:**

- Success: Confirmations, availability, positive states
- Warning: Alerts, important notices
- Error: Errors, validation, unavailable
- Info: Information, tips, help text

### Color Usage Examples

```tsx
// Primary CTA
<button className="bg-primary-500 hover:bg-primary-600 text-white">
  Reservar ahora
</button>

// Secondary CTA
<button className="bg-secondary-500 hover:bg-secondary-600 text-white">
  Ver m·s
</button>

// Outline button
<button className="border-2 border-primary-500 text-primary-600 hover:bg-primary-50">
  Filtrar
</button>

// Text link
<a className="text-primary-600 hover:text-primary-700 hover:underline">
  Ver detalles
</a>

// Success badge
<span className="bg-success-50 text-success-700 px-2 py-1 rounded-full text-sm">
  Disponible
</span>

// Error message
<div className="bg-error-50 border border-error-200 text-error-700 p-4 rounded">
  Error al procesar la reserva
</div>
```text

---

## Typography

### Font Families

```css
/* Sans Serif - Default */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Display - Headings (optional enhancement) */
font-family: 'Source Sans Pro', 'Inter', sans-serif;
```text

### Type Scale (Tailwind)

```tsx
// Display
<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold">
  TÌtulo Principal
</h1>

// Heading 1
<h1 className="text-3xl md:text-4xl font-bold text-gray-900">
  Encabezado Nivel 1
</h1>

// Heading 2
<h2 className="text-2xl md:text-3xl font-semibold text-gray-900">
  Encabezado Nivel 2
</h2>

// Heading 3
<h3 className="text-xl md:text-2xl font-semibold text-gray-800">
  Encabezado Nivel 3
</h3>

// Heading 4
<h4 className="text-lg md:text-xl font-medium text-gray-800">
  Encabezado Nivel 4
</h4>

// Body Large
<p className="text-lg text-gray-600">
  Texto destacado o introducciÛn
</p>

// Body
<p className="text-base text-gray-600">
  Texto principal del cuerpo
</p>

// Body Small
<p className="text-sm text-gray-600">
  Texto secundario o meta informaciÛn
</p>

// Caption
<span className="text-xs text-gray-500">
  Etiquetas, timestamps, avisos pequeÒos
</span>
```text

### Typography Usage

```tsx
//  GOOD: Proper hierarchy
<article>
  <h1 className="text-3xl font-bold text-gray-900 mb-2">
    Casa Frente al RÌo
  </h1>
  <p className="text-sm text-gray-500 mb-4">
    Publicado el 15 de enero de 2024
  </p>
  <p className="text-base text-gray-600 leading-relaxed">
    Hermosa casa con vista al rÌo Uruguay. Cuenta con 3 dormitorios,
    2 baÒos, pileta y amplio jardÌn. Ideal para familias.
  </p>
</article>

// L BAD: Poor hierarchy, inconsistent sizing
<article>
  <h1 className="text-xl">Casa Frente al RÌo</h1>
  <p className="text-xs">Publicado el 15 de enero de 2024</p>
  <p className="text-lg font-bold">
    Hermosa casa con vista al rÌo Uruguay...
  </p>
</article>
```text

### Font Weights

```tsx
font-normal    // 400 - Body text
font-medium    // 500 - Emphasis, labels
font-semibold  // 600 - Subheadings
font-bold      // 700 - Headings, CTAs
font-extrabold // 800 - Display (use sparingly)
```text

---

## Spacing System

### Base Unit: 4px (Tailwind `1` = 0.25rem)

```tsx
// Spacing scale
p-1  // 4px
p-2  // 8px
p-3  // 12px
p-4  // 16px   ê Standard button padding
p-6  // 24px   ê Standard card padding
p-8  // 32px
p-12 // 48px   ê Section padding
p-16 // 64px
```text

### Component Spacing Standards

```tsx
// Card padding
<Card className="p-6">
  {/* Content */}
</Card>

// Section vertical spacing
<section className="py-12 md:py-16">
  {/* Content */}
</section>

// Element gaps
<div className="space-y-4">
  {/* Vertical spacing between elements */}
</div>

<div className="flex gap-4">
  {/* Horizontal spacing between elements */}
</div>

// Page container
<div className="container mx-auto px-4 md:px-6 lg:px-8">
  {/* Content */}
</div>
```text

---

## Tone of Voice

### Writing Style

**Guidelines:**

- **Warm and welcoming**, not formal
- **Clear and concise**, not verbose
- **Helpful**, not pushy
- **Authentic**, not exaggerated
- **Local**, with regional references

### Second Person (Familiar - "te" / "tu")

```text
 GOOD:
"Encontr· tu alojamiento ideal"
"Te invitamos a descubrir ConcepciÛn"
"Reserv· con confianza"

L BAD (formal "usted"):
"Encuentre su alojamiento"
"Le invitamos a descubrir"
"Reserve con confianza"
```text

### Voice Examples

**Headers:**

```text
 "Bienvenido a tu prÛxima escapada"
 "DescubrÌ el Litoral Argentino"
 "Alojamientos con encanto"

L "Plataforma de reservas hoteleras"
L "Sistema de gestiÛn de propiedades"
```text

**CTAs:**

```text
 "Reservar ahora"
 "Ver disponibilidad"
 "Contactar al anfitriÛn"

L "Proceder con la transacciÛn"
L "Ejecutar reserva"
```text

**Confirmations:**

```text
 "°Tu reserva est· confirmada!"
 "Te enviamos los detalles por email"
 "Nos vemos pronto en ConcepciÛn"

L "TransacciÛn completada exitosamente"
L "ConfirmaciÛn de operaciÛn #12345"
```text

**Errors:**

```text
 "Ups, algo saliÛ mal"
 "No pudimos procesar tu solicitud. Por favor, intent· nuevamente"
 "Parece que esta fecha ya no est· disponible"

L "Error 500: Internal Server Error"
L "OperaciÛn fallida. CÛdigo: ERR_VALIDATION"
```text

---

## Logo Usage

### Logo Variations

**Primary Logo** (full color)

- Use on white or light backgrounds
- Minimum size: 120px width
- Clear space: Equal to height of logo

**White Logo** (inverse)

- Use on dark backgrounds or photos
- Maintain same sizing rules

**Monochrome** (when color not available)

- Use primary-600 for blue version
- Use gray-900 for black version

### Logo Don'ts

L Don't stretch or distort
L Don't change colors
L Don't add effects (shadows, outlines)
L Don't rotate
L Don't place on busy backgrounds without proper contrast

---

## Component Library (Shadcn UI)

### Buttons

```tsx
// Primary button
<Button className="bg-primary-500 hover:bg-primary-600 text-white">
  Reservar
</Button>

// Secondary button
<Button variant="secondary" className="bg-secondary-500 hover:bg-secondary-600">
  Ver m·s
</Button>

// Outline button
<Button variant="outline" className="border-primary-500 text-primary-600">
  Filtrar
</Button>

// Ghost button
<Button variant="ghost" className="text-gray-600 hover:text-gray-900">
  Cancelar
</Button>

// Destructive button
<Button variant="destructive">
  Eliminar
</Button>
```text

### Cards

```tsx
<Card className="overflow-hidden hover:shadow-lg transition-shadow">
  <div className="relative h-48">
    <img
      src={accommodation.image}
      alt={accommodation.title}
      className="w-full h-full object-cover"
    />
    <Badge className="absolute top-2 right-2 bg-success-500">
      Disponible
    </Badge>
  </div>

  <CardHeader>
    <CardTitle className="text-xl">
      {accommodation.title}
    </CardTitle>
    <CardDescription className="text-gray-500">
      {accommodation.city}
    </CardDescription>
  </CardHeader>

  <CardContent>
    <p className="text-gray-600 line-clamp-2">
      {accommodation.description}
    </p>
  </CardContent>

  <CardFooter className="flex justify-between items-center">
    <div>
      <span className="text-2xl font-bold text-gray-900">
        ${accommodation.pricePerNight}
      </span>
      <span className="text-sm text-gray-500">/ noche</span>
    </div>
    <Button>Ver detalles</Button>
  </CardFooter>
</Card>
```text

### Forms

```tsx
<form className="space-y-6">
  <div className="space-y-2">
    <Label htmlFor="email">Email *</Label>
    <Input
      id="email"
      type="email"
      placeholder="tu@email.com"
      className="w-full"
    />
    <p className="text-sm text-gray-500">
      Te enviaremos la confirmaciÛn a este email
    </p>
  </div>

  <div className="space-y-2">
    <Label htmlFor="guests">Cantidad de huÈspedes *</Label>
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Seleccion· cantidad" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1">1 huÈsped</SelectItem>
        <SelectItem value="2">2 huÈspedes</SelectItem>
        <SelectItem value="3">3 huÈspedes</SelectItem>
        <SelectItem value="4">4 huÈspedes</SelectItem>
      </SelectContent>
    </Select>
  </div>

  <Button type="submit" className="w-full">
    Continuar
  </Button>
</form>
```text

### Badges

```tsx
// Success
<Badge className="bg-success-50 text-success-700 border-success-200">
  Disponible
</Badge>

// Warning
<Badge className="bg-warning-50 text-warning-700 border-warning-200">
  Pocas unidades
</Badge>

// Info
<Badge className="bg-primary-50 text-primary-700 border-primary-200">
  Destacado
</Badge>

// Neutral
<Badge variant="secondary">
  Popular
</Badge>
```text

---

## Responsive Design

### Breakpoints

```css
sm:  640px   /* Landscape phones */
md:  768px   /* Tablets */
lg:  1024px  /* Desktop */
xl:  1280px  /* Large desktop */
2xl: 1536px  /* Extra large */
```text

### Mobile-First Approach

```tsx
//  GOOD: Mobile-first
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Cards */}
</div>

<h1 className="text-2xl md:text-3xl lg:text-4xl">
  TÌtulo
</h1>

// L BAD: Desktop-first
<div className="grid grid-cols-3 md:grid-cols-2 sm:grid-cols-1">
  {/* Wrong order */}
</div>
```text

### Touch Targets

Minimum size: 44x44px

```tsx
//  GOOD: Large enough
<button className="min-h-[44px] min-w-[44px] p-3">
  <Icon className="h-5 w-5" />
</button>

// L BAD: Too small
<button className="p-1">
  <Icon className="h-3 w-3" />
</button>
```text

---

## Imagery Guidelines

### Accommodation Photos

**Requirements:**

- Minimum resolution: 1200x800px
- Aspect ratio: 3:2 or 4:3
- Format: WebP (with JPEG fallback)
- Quality: 80% compression

**Style:**

- Natural lighting preferred
- Show the space authentically
- Include unique features
- Bright and inviting
- Clean and uncluttered

**Don'ts:**

- L Heavy filters
- L Misleading angles
- L Dark or poorly lit
- L Cluttered spaces

### Hero Images

```tsx
<section className="relative h-[500px] md:h-[600px]">
  <img
    src="/hero-litoral.jpg"
    alt="Vista del rÌo Uruguay en ConcepciÛn"
    className="w-full h-full object-cover"
  />
  <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/30 flex items-center">
    <div className="container mx-auto px-4">
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
        DescubrÌ el Litoral Argentino
      </h1>
      <p className="text-xl text-white/90 mb-8">
        Alojamientos ˙nicos en ConcepciÛn del Uruguay y regiÛn
      </p>
      <Button size="lg">
        Explorar alojamientos
      </Button>
    </div>
  </div>
</section>
```text

---

## Accessibility with Brand

### Color Contrast

All text must meet WCAG AA:

- Normal text: 4.5:1 minimum
- Large text (e18px): 3:1 minimum

```tsx
//  GOOD: Sufficient contrast
<p className="text-gray-900 bg-white">  {/* 21:1 */}
<p className="text-gray-600 bg-white">  {/* 7:1 */}
<Button className="bg-primary-500 text-white">  {/* 4.5:1 */}

// L BAD: Insufficient contrast
<p className="text-gray-400 bg-white">  {/* 2.5:1 - Too low */}
```text

### Focus States

Always visible focus indicators:

```tsx
<button className="focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
  Button
</button>

<a className="focus:outline-none focus:ring-2 focus:ring-primary-500 rounded">
  Link
</a>
```text

---

## Brand Checklist

When creating UI components, verify:

- [ ] Colors from approved palette
- [ ] Typography follows scale and weights
- [ ] Spacing uses standard increments
- [ ] Tone of voice is warm and welcoming
- [ ] Uses "te/tu" (familiar second person)
- [ ] Buttons use brand colors
- [ ] Cards have proper padding and shadows
- [ ] Responsive on all breakpoints
- [ ] Touch targets are 44x44px minimum
- [ ] Color contrast meets WCAG AA
- [ ] Focus states visible
- [ ] Images are high quality and authentic

---

## Deliverables

When this skill is applied, produce:

1. **Brand-Compliant Components** using correct colors, typography, spacing
2. **Consistent UI** across all pages and features
3. **Accessible Design** meeting WCAG AA standards
4. **Responsive Layouts** working on all devices
5. **On-Brand Copy** with appropriate tone of voice

---

**This skill ensures a cohesive, professional brand experience that builds trust and connects with users emotionally while maintaining high usability standards.**

