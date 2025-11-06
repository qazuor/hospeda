# Icon Naming Conventions Guide

Comprehensive guide for naming icon components in the `@repo/icons` package.

## Table of Contents

- [Naming Principles](#naming-principles)
- [General Patterns](#general-patterns)
- [Component Naming](#component-naming)
- [Semantic vs Descriptive](#semantic-vs-descriptive)
- [Category-Specific Conventions](#category-specific-conventions)
- [Consistency Rules](#consistency-rules)
- [Compound Names](#compound-names)
- [Abbreviation Guidelines](#abbreviation-guidelines)
- [Special Cases](#special-cases)
- [Common Mistakes](#common-mistakes)
- [Refactoring Legacy Names](#refactoring-legacy-names)
- [Examples by Category](#examples-by-category)
- [Decision Tree](#decision-tree)
- [Best Practices](#best-practices)

---

## Naming Principles

### Core Principles

**1. Clarity Over Brevity**

```typescript
// ✅ Good - Clear and descriptive
AirConditioningIcon
WheelchairAccessibleIcon

// ❌ Bad - Too abbreviated
ACIcon
WCAIcon
```

**2. Consistency Across Package**

```typescript
// ✅ Good - Consistent "Icon" suffix
SearchIcon
FilterIcon
SortIcon

// ❌ Bad - Inconsistent naming
SearchIcon
FilterComponent
SortSVG
```

**3. Semantic Meaning**

```typescript
// ✅ Good - Describes purpose/meaning
AddIcon          // Action: adding something
SuccessIcon      // Status: success state

// ❌ Bad - Describes appearance
PlusIcon         // Visual: plus symbol
GreenCheckIcon   // Visual + color
```

**4. Domain-Specific Terms**

```typescript
// ✅ Good - Uses Hospeda business terms
AccommodationIcon
EventIcon
ExperienceIcon

// ❌ Bad - Generic terms
HouseIcon       // Could be anything
CalendarIcon    // Too generic for events
ActivityIcon    // Vague
```

---

## General Patterns

### Standard Pattern

```
[Description]Icon
```

**Components:**

- **Description:** What the icon represents (PascalCase)
- **Icon:** Suffix indicating icon component

**Examples:**

```typescript
SearchIcon
UserIcon
HomeIcon
SettingsIcon
```

### Compound Pattern

```
[Prefix][Description]Icon
```

**For specificity:**

```typescript
// Action + Object
AddUserIcon
EditProfileIcon
DeleteAccountIcon

// Feature + Type
WiFiIcon
AirConditioningIcon
SwimmingPoolIcon

// State + Object
ActiveUserIcon
PendingBookingIcon
CompletedPaymentIcon
```

---

## Component Naming

### Naming Rules

**1. Always PascalCase**

```typescript
// ✅ Correct
SearchIcon
AirConditioningIcon
TwentyFourHourIcon

// ❌ Wrong
searchIcon      // camelCase
search-icon     // kebab-case
SEARCHICON      // SCREAMING_SNAKE_CASE
```

**2. Always End with "Icon"**

```typescript
// ✅ Correct
AddIcon
EditIcon
DeleteIcon

// ❌ Wrong
Add             // Missing suffix
EditComponent   // Wrong suffix
DeleteSVG       // Wrong suffix
```

**3. Start with Letter (Not Number)**

```typescript
// ✅ Correct
TwentyFourHourIcon
NinetyDegreeIcon

// ❌ Wrong
24HourIcon      // Starts with number
90DegreeIcon    // Starts with number
```

**4. No Special Characters**

```typescript
// ✅ Correct
WifiIcon
AirConditioningIcon

// ❌ Wrong
WiFiIcon        // Mixed case mid-word
Air_Conditioning_Icon  // Underscores
Air-Conditioning-Icon  // Hyphens
```

### File Naming

**Match component name:**

```
SearchIcon.tsx       // Component: SearchIcon
AirConditioningIcon.tsx  // Component: AirConditioningIcon
TwentyFourHourIcon.tsx   // Component: TwentyFourHourIcon
```

**Test files:**

```
SearchIcon.test.tsx
AirConditioningIcon.test.tsx
```

---

## Semantic vs Descriptive

### Semantic Names (Preferred)

**Describe meaning/purpose:**

```typescript
// ✅ Semantic - What it means
AddIcon          // Action: add something
SearchIcon       // Action: search
SuccessIcon      // Status: success
ErrorIcon        // Status: error
```

**Benefits:**

- More meaningful in code
- Easier to understand intent
- Better for screen readers
- Survives visual redesigns

### Descriptive Names (When Necessary)

**Describe appearance:**

```typescript
// Use only when semantic name unclear
ChevronLeftIcon   // Visual shape
CircleIcon        // Geometric shape
SquareIcon        // Geometric shape
```

**When to use:**

- Geometric shapes with no semantic meaning
- Directional indicators
- Pure decorative elements
- No clear business meaning

### Choosing Between Semantic and Descriptive

**Decision flow:**

```
Does icon have clear business meaning?
    ├─ YES → Use semantic name (AccommodationIcon)
    └─ NO → Is it a UI element with purpose?
            ├─ YES → Use semantic name (SearchIcon)
            └─ NO → Use descriptive name (ChevronIcon)
```

**Examples:**

```typescript
// Business concepts → Semantic
AccommodationIcon    // Business entity
BookingIcon         // Business entity
PaymentIcon         // Business entity

// User actions → Semantic
SearchIcon          // User action
FilterIcon          // User action
SortIcon            // User action

// Pure UI → Descriptive
ChevronDownIcon     // Directional UI
DotsIcon           // Visual pattern
LineIcon           // Visual element
```

---

## Category-Specific Conventions

### 1. Actions Category

**Pattern:** `[Verb]Icon`

**Convention:** Use action verbs

```typescript
// ✅ Good - Action verbs
AddIcon
EditIcon
DeleteIcon
SaveIcon
CancelIcon
CreateIcon
UpdateIcon
RemoveIcon

// ❌ Bad - Not action-oriented
PlusIcon        // Visual, not action
TrashIcon       // Visual, not action
CrossIcon       // Visual, not action
```

**Compound actions:**

```typescript
AddUserIcon
EditProfileIcon
DeleteAccountIcon
```

### 2. Amenities Category

**Pattern:** `[Feature]Icon`

**Convention:** Use feature/facility names

```typescript
// ✅ Good - Feature names
WifiIcon
PoolIcon
ParkingIcon
AirConditioningIcon
KitchenIcon
GymIcon
LaundryIcon

// ❌ Bad - Too generic or abbreviated
InternetIcon    // Use WifiIcon
SwimIcon        // Use PoolIcon
ACIcon          // Use AirConditioningIcon
```

**Compound amenities:**

```typescript
SwimmingPoolIcon      // Specific type
IndoorPoolIcon       // Specific location
OutdoorParkingIcon   // Specific location
```

### 3. Entities Category

**Pattern:** `[Entity]Icon`

**Convention:** Use business entity names

```typescript
// ✅ Good - Business entities
AccommodationIcon
EventIcon
ExperienceIcon
AttractionIcon
DestinationIcon
BookingIcon
UserIcon

// ❌ Bad - Generic terms
HouseIcon       // Use AccommodationIcon
CalendarIcon    // Use EventIcon
MapIcon         // Use AttractionIcon
```

### 4. Navigation Category

**Pattern:** `[Destination]Icon` or `[Direction]Icon`

**Convention:** Use navigation destinations or directions

```typescript
// Destinations
HomeIcon
SearchIcon
ProfileIcon
SettingsIcon
DashboardIcon

// Directions
BackIcon
ForwardIcon
UpIcon
DownIcon
MenuIcon
CloseIcon
```

### 5. Status Category

**Pattern:** `[State]Icon`

**Convention:** Use state/status names

```typescript
// ✅ Good - Status states
SuccessIcon
ErrorIcon
WarningIcon
InfoIcon
PendingIcon
ActiveIcon
InactiveIcon
CompletedIcon

// ❌ Bad - Visual descriptions
CheckIcon       // Use SuccessIcon
XIcon           // Use ErrorIcon
CircleIcon      // Use PendingIcon
```

### 6. Social Category

**Pattern:** `[Platform]Icon`

**Convention:** Use exact platform names

```typescript
// ✅ Good - Exact platform names
FacebookIcon
InstagramIcon
TwitterIcon
LinkedInIcon
YouTubeIcon
WhatsAppIcon

// ❌ Bad - Abbreviated or generic
FBIcon          // Use FacebookIcon
InstaIcon       // Use InstagramIcon
SocialIcon      // Too generic
```

### 7. Payment Category

**Pattern:** `[PaymentMethod]Icon`

**Convention:** Use payment method names

```typescript
// ✅ Good - Payment methods
CreditCardIcon
DebitCardIcon
MercadoPagoIcon
PayPalIcon
CashIcon
BankTransferIcon

// ❌ Bad - Generic or abbreviated
CardIcon        // Too generic
MPIcon          // Use MercadoPagoIcon
MoneyIcon       // Use CashIcon
```

### 8. Weather Category

**Pattern:** `[Condition]Icon`

**Convention:** Use weather condition names

```typescript
// ✅ Good - Weather conditions
SunIcon
CloudIcon
RainIcon
StormIcon
SnowIcon
WindIcon
FogIcon

// ❌ Bad - Descriptions
SunnyIcon       // Use SunIcon
RainyIcon       // Use RainIcon
CloudyIcon      // Use CloudIcon
```

### 9. Accessibility Category

**Pattern:** `[Feature]Icon` or `[Feature]AccessibleIcon`

**Convention:** Use accessibility feature names

```typescript
// ✅ Good - Accessibility features
WheelchairIcon
WheelchairAccessibleIcon
AudioDescriptionIcon
SignLanguageIcon
ClosedCaptionIcon
BrailleIcon

// ❌ Bad - Abbreviated
WCIcon          // Use WheelchairIcon
CCIcon          // Use ClosedCaptionIcon
```

### 10. Time Category

**Pattern:** `[TimeUnit]Icon` or `[TimeRelated]Icon`

**Convention:** Use time-related terms

```typescript
// ✅ Good - Time-related
ClockIcon
CalendarIcon
TimerIcon
AlarmIcon
ScheduleIcon
DurationIcon

// ❌ Bad - Too specific
TwelveOClockIcon    // Too specific
JanuaryIcon         // Use CalendarIcon
```

### 11. Communication Category

**Pattern:** `[Medium]Icon`

**Convention:** Use communication medium names

```typescript
// ✅ Good - Communication mediums
MailIcon
PhoneIcon
MessageIcon
ChatIcon
VideoCallIcon
NotificationIcon

// ❌ Bad - Abbreviated or generic
EmailIcon       // Prefer MailIcon
TelIcon         // Use PhoneIcon
BellIcon        // Use NotificationIcon
```

### 12. UI Category

**Pattern:** `[Element]Icon`

**Convention:** Use UI element names

```typescript
// ✅ Good - UI elements
LoaderIcon
SpinnerIcon
ChevronIcon
DotsIcon
BarsIcon
GridIcon
ListIcon

// ❌ Bad - Too generic
IconIcon        // Redundant
UIIcon          // Too vague
```

---

## Consistency Rules

### Across Categories

**Use consistent terms:**

```typescript
// ✅ Consistent
AddIcon (actions)
AddUserIcon (actions)
AddBookingIcon (actions)

// ❌ Inconsistent
AddIcon (actions)
CreateUser (actions)     // Use AddUserIcon
NewBooking (actions)     // Use AddBookingIcon
```

### Within Category

**Same pattern for similar concepts:**

```typescript
// ✅ Consistent pattern
SuccessIcon
ErrorIcon
WarningIcon
InfoIcon

// ❌ Inconsistent pattern
SuccessIcon
FailIcon            // Use ErrorIcon
AlertIcon           // Use WarningIcon
InformationIcon     // Use InfoIcon
```

### Verb Tense

**Use present tense for actions:**

```typescript
// ✅ Present tense
AddIcon
EditIcon
DeleteIcon
SaveIcon

// ❌ Past/future tense
AddedIcon
EditingIcon
WillDeleteIcon
```

### Singular vs Plural

**General rule: Use singular**

```typescript
// ✅ Singular
UserIcon
BookingIcon
AccommodationIcon

// ✅ Plural (when referring to multiple)
UsersIcon           // Multiple users
SettingsIcon        // Collection of settings
```

**When to use plural:**

- Icon explicitly shows multiple items
- Represents a collection
- Common usage is plural (SettingsIcon)

---

## Compound Names

### When to Use Compound Names

**Add prefix/suffix for specificity:**

```typescript
// Base icon
UserIcon

// Compound for specificity
ActiveUserIcon
AdminUserIcon
GuestUserIcon
```

### Compound Patterns

**1. Action + Object**

```typescript
AddUserIcon
EditProfileIcon
DeleteAccountIcon
CreateBookingIcon
UpdateSettingsIcon
```

**2. State + Object**

```typescript
ActiveUserIcon
PendingBookingIcon
CompletedPaymentIcon
VerifiedAccountIcon
ExpiredTokenIcon
```

**3. Location + Object**

```typescript
IndoorPoolIcon
OutdoorParkingIcon
PrivateBathroomIcon
SharedKitchenIcon
```

**4. Type + Object**

```typescript
CreditCardIcon
DebitCardIcon
VideoCallIcon
TextMessageIcon
```

### Ordering in Compounds

**Modifier + Base:**

```typescript
// ✅ Correct order
PrivatePoolIcon      // Private (modifier) + Pool (base)
OutdoorParkingIcon   // Outdoor (modifier) + Parking (base)

// ❌ Wrong order
PoolPrivateIcon      // Awkward
ParkingOutdoorIcon   // Awkward
```

---

## Abbreviation Guidelines

### When to Abbreviate

**Generally avoid abbreviations:**

```typescript
// ✅ Full words preferred
WifiIcon            // Exception: universally known
AirConditioningIcon // Full term
InformationIcon     // Full term

// ❌ Avoid abbreviations
ACIcon              // Use AirConditioningIcon
InfoIcon            // Use InformationIcon (or keep InfoIcon as common)
MsgIcon             // Use MessageIcon
```

### Acceptable Abbreviations

**Industry-standard acronyms:**

```typescript
// ✅ Acceptable
WifiIcon            // WiFi is standard term
ApiIcon             // API is standard term
SmsIcon             // SMS is standard term
GpsIcon             // GPS is standard term

// ✅ Also acceptable spelled out
WirelessIcon        // If WiFi too technical
ApplicationProgrammingInterfaceIcon  // Too verbose, use ApiIcon
```

### Abbreviation Decision Tree

```
Is term universally recognized as abbreviation?
    ├─ YES → Use abbreviation (WifiIcon, ApiIcon)
    └─ NO → Can full term be reasonably used?
            ├─ YES → Use full term (AirConditioningIcon)
            └─ NO → Create clear abbreviation + document
```

---

## Special Cases

### Numbers in Names

**Spell out numbers:**

```typescript
// ✅ Correct
TwentyFourHourIcon
NinetyDegreeIcon
OneHundredPercentIcon

// ❌ Wrong
24HourIcon          // Can't start with number
90DegreeIcon        // Can't start with number
100PercentIcon      // Can't start with number
```

**When number is mid-name:**

```typescript
// ✅ Acceptable
ThreeSixtyIcon      // 360
FourKIcon           // 4K
FiveStarIcon        // 5-star
```

### Brand Names

**Use official capitalization:**

```typescript
// ✅ Correct - Official branding
YouTubeIcon         // Official: YouTube
WhatsAppIcon        // Official: WhatsApp
LinkedIn Icon       // Official: LinkedIn

// ❌ Wrong
YoutubeIcon         // Not official
WhatsappIcon        // Not official
LinkedinIcon        // Not official
```

### Compound Words

**Single word vs separate:**

```typescript
// ✅ Single compound word
AirConditioningIcon     // Air conditioning (compound)
SwimmingPoolIcon        // Swimming pool (compound)
CreditCardIcon          // Credit card (compound)

// Not:
AirConditionIcon        // Incomplete
SwimPoolIcon            // Too abbreviated
```

### Hyphenated Terms

**Remove hyphens, capitalize:**

```typescript
// Original: Wi-Fi
WifiIcon            // ✅ Simplified

// Original: Twenty-four hour
TwentyFourHourIcon  // ✅ Spelled out

// Original: Check-in
CheckInIcon         // ✅ No hyphen
```

### Possessives

**Avoid possessives:**

```typescript
// ✅ Without possessive
UserProfileIcon
BookingDetailsIcon

// ❌ With possessive
UsersProfileIcon    // Awkward
BookingsDetailsIcon // Awkward
```

---

## Common Mistakes

### Mistake 1: Too Generic

```typescript
// ❌ Bad - Too generic
IconComponent
ImageIcon
ButtonIcon

// ✅ Good - Specific purpose
SearchIcon
UserProfileIcon
AddBookingIcon
```

### Mistake 2: Describing Visual, Not Meaning

```typescript
// ❌ Bad - Visual description
PlusIcon            // What does it do?
CheckmarkIcon       // What does it mean?
XIcon               // What is it for?

// ✅ Good - Semantic meaning
AddIcon             // Action: adding
SuccessIcon         // Status: success
CloseIcon           // Action: closing
```

### Mistake 3: Inconsistent Suffixes

```typescript
// ❌ Bad - Mixed suffixes
SearchIcon
FilterComponent
SortSVG

// ✅ Good - Consistent suffix
SearchIcon
FilterIcon
SortIcon
```

### Mistake 4: Over-Specification

```typescript
// ❌ Bad - Too specific
BlueSearchIconLarge
RedErrorIconSmall

// ✅ Good - Flexible
SearchIcon          // Color/size via props
ErrorIcon          // Color/size via props
```

### Mistake 5: Abbreviation Inconsistency

```typescript
// ❌ Bad - Inconsistent abbreviations
ACIcon              // Air Conditioning abbreviated
AirConditioningIcon // Same thing, spelled out
InfoIcon            // Information abbreviated
InformationIcon     // Same thing, spelled out

// ✅ Good - Consistent approach
AirConditioningIcon // Always spell out
AirConditioningIcon // Consistent
InformationIcon     // Always spell out
InformationIcon     // Consistent
```

### Mistake 6: Wrong Category

```typescript
// ❌ Bad - Wrong category
TrashIcon (ui)      // Should be DeleteIcon (actions)
PlusIcon (ui)       // Should be AddIcon (actions)
HouseIcon (ui)      // Should be AccommodationIcon (entities)

// ✅ Good - Correct category
DeleteIcon (actions)
AddIcon (actions)
AccommodationIcon (entities)
```

---

## Refactoring Legacy Names

### When to Refactor

**Indicators that refactoring is needed:**

- Icon name doesn't follow conventions
- Visual description instead of semantic
- Inconsistent with similar icons
- Category misalignment
- User confusion

### Refactoring Process

**1. Identify Issues:**

```typescript
// Current (problematic)
PlusIcon           // Visual, not semantic
TrashIcon          // Visual, not semantic
HouseIcon          // Generic, not domain-specific
```

**2. Propose New Names:**

```typescript
// Proposed
AddIcon            // Semantic action
DeleteIcon         // Semantic action
AccommodationIcon  // Domain-specific
```

**3. Create Deprecation Path:**

```typescript
// Keep old name with deprecation warning
/**
 * @deprecated Use AddIcon instead
 */
export const PlusIcon = AddIcon;

// New name
export function AddIcon({ ...props }: IconProps) {
  return <svg>{/* ... */}</svg>;
}
```

**4. Update Documentation:**

```markdown
## Migration Guide

### PlusIcon → AddIcon

The `PlusIcon` has been renamed to `AddIcon` for semantic clarity.

**Before:**
```tsx
import { PlusIcon } from '@repo/icons';
<PlusIcon />
```

**After:**

```tsx
import { AddIcon } from '@repo/icons';
<AddIcon />
```

**Migration timeline:**

- v2.0.0: PlusIcon deprecated
- v3.0.0: PlusIcon removed

```

**5. Migrate Codebase:**

```bash
# Search for usage
grep -r "PlusIcon" apps/ packages/

# Update imports
# Replace PlusIcon with AddIcon
```

**6. Remove Deprecated:**

```typescript
// After migration period, remove deprecated export
// Delete: export const PlusIcon = AddIcon;
```

### Migration Checklist

```
□ Identify problematic names
□ Propose better names (following conventions)
□ Create aliases for backward compatibility
□ Add deprecation warnings
□ Update documentation with migration guide
□ Communicate to team
□ Migrate internal codebase
□ Set removal timeline
□ Monitor usage
□ Remove deprecated names in next major version
```

---

## Examples by Category

### Actions (10 examples)

```typescript
AddIcon              // Add new item
EditIcon             // Edit existing
DeleteIcon           // Delete item
SaveIcon             // Save changes
CancelIcon           // Cancel operation
CreateIcon           // Create new
UpdateIcon           // Update existing
RemoveIcon           // Remove item
DuplicateIcon        // Duplicate item
ArchiveIcon          // Archive item
```

### Amenities (10 examples)

```typescript
WifiIcon             // Internet connectivity
PoolIcon             // Swimming pool
ParkingIcon          // Parking facility
AirConditioningIcon  // Climate control
KitchenIcon          // Kitchen facility
GymIcon              // Fitness center
LaundryIcon          // Laundry facility
BalconyIcon          // Outdoor space
ElevatorIcon         // Accessibility
PetFriendlyIcon      // Pet policy
```

### Entities (10 examples)

```typescript
AccommodationIcon    // Lodging
EventIcon            // Tourism event
ExperienceIcon       // Activity
AttractionIcon       // Tourist site
DestinationIcon      // Location
BookingIcon          // Reservation
UserIcon             // User account
HostIcon             // Property owner
GuestIcon            // Visitor
ReviewIcon           // User review
```

### Navigation (10 examples)

```typescript
HomeIcon             // Home page
BackIcon             // Go back
ForwardIcon          // Go forward
MenuIcon             // Open menu
CloseIcon            // Close element
SearchIcon           // Search function
FilterIcon           // Filter results
SortIcon             // Sort items
SettingsIcon         // Settings page
HelpIcon             // Help/support
```

### Status (10 examples)

```typescript
SuccessIcon          // Success state
ErrorIcon            // Error state
WarningIcon          // Warning state
InfoIcon             // Information
PendingIcon          // Pending state
ActiveIcon           // Active status
InactiveIcon         // Inactive status
CompletedIcon        // Completed state
CancelledIcon        // Cancelled state
VerifiedIcon         // Verified status
```

### Social (6 examples)

```typescript
FacebookIcon         // Facebook
InstagramIcon        // Instagram
TwitterIcon          // Twitter (X)
LinkedInIcon         // LinkedIn
YouTubeIcon          // YouTube
WhatsAppIcon         // WhatsApp
```

### Payment (6 examples)

```typescript
CreditCardIcon       // Credit card
DebitCardIcon        // Debit card
MercadoPagoIcon      // Mercado Pago
CashIcon             // Cash payment
BankTransferIcon     // Bank transfer
PayPalIcon           // PayPal
```

### Weather (6 examples)

```typescript
SunIcon              // Sunny
CloudIcon            // Cloudy
RainIcon             // Rainy
StormIcon            // Stormy
SnowIcon             // Snowy
WindIcon             // Windy
```

### Accessibility (6 examples)

```typescript
WheelchairIcon           // Wheelchair access
AudioDescriptionIcon     // Audio description
SignLanguageIcon         // Sign language
ClosedCaptionIcon        // Closed captions
BrailleIcon              // Braille
LargeTextIcon            // Large text
```

### Time (6 examples)

```typescript
ClockIcon            // Time
CalendarIcon         // Date
TimerIcon            // Timer/countdown
AlarmIcon            // Alarm
ScheduleIcon         // Schedule
DurationIcon         // Duration
```

### Communication (6 examples)

```typescript
MailIcon             // Email
PhoneIcon            // Phone call
MessageIcon          // Text message
ChatIcon             // Chat/messaging
VideoCallIcon        // Video call
NotificationIcon     // Notification
```

### UI (6 examples)

```typescript
LoaderIcon           // Loading indicator
ChevronIcon          // Chevron direction
DotsIcon             // More options
BarsIcon             // Menu bars
GridIcon             // Grid view
ListIcon             // List view
```

---

## Decision Tree

### Comprehensive Naming Decision Tree

```
Starting point: Need to name an icon
    │
    ├─ What category does it belong to?
    │   ├─ Actions → Use [Verb]Icon (AddIcon, EditIcon)
    │   ├─ Amenities → Use [Feature]Icon (WifiIcon, PoolIcon)
    │   ├─ Entities → Use [Entity]Icon (AccommodationIcon)
    │   ├─ Navigation → Use [Destination]Icon (HomeIcon)
    │   ├─ Status → Use [State]Icon (SuccessIcon)
    │   └─ Other → See category-specific rules
    │
    ├─ Is it semantic or descriptive?
    │   ├─ Has clear meaning → Semantic (SearchIcon)
    │   └─ Pure visual → Descriptive (ChevronIcon)
    │
    ├─ Does it need compound name?
    │   ├─ Yes → [Modifier][Base]Icon (ActiveUserIcon)
    │   └─ No → [Base]Icon (UserIcon)
    │
    ├─ Does name contain numbers?
    │   ├─ At start → Spell out (TwentyFourHourIcon)
    │   └─ Mid/end → Acceptable (FiveStarIcon)
    │
    ├─ Is abbreviation needed?
    │   ├─ Universal term → OK (WifiIcon, ApiIcon)
    │   └─ Not universal → Spell out (AirConditioningIcon)
    │
    └─ Check consistency
        ├─ Similar icons in category → Match pattern
        ├─ Already exists → Use existing or create variant
        └─ New pattern → Document reasoning
```

### Quick Decision Examples

**Example 1: Adding/Creating Items**

```
Need: Icon for adding new booking
    │
    ├─ Category: Actions (user performs action)
    ├─ Pattern: [Verb]Icon
    ├─ Verb: Add
    ├─ Compound? Yes (Add + Booking)
    └─ Result: AddBookingIcon ✅
```

**Example 2: Amenity/Feature**

```
Need: Icon for air conditioning
    │
    ├─ Category: Amenities (accommodation feature)
    ├─ Pattern: [Feature]Icon
    ├─ Feature: Air Conditioning
    ├─ Abbreviate? No (not universal)
    └─ Result: AirConditioningIcon ✅
```

**Example 3: Status Indicator**

```
Need: Icon showing booking is confirmed
    │
    ├─ Category: Status (state indicator)
    ├─ Pattern: [State]Icon
    ├─ State: Confirmed
    ├─ Compound? Optional (ConfirmedIcon or ConfirmedBookingIcon)
    └─ Result: ConfirmedIcon ✅ (or ConfirmedBookingIcon)
```

---

## Best Practices

### Summary of Best Practices

**1. Follow category conventions**

- Each category has specific patterns
- Consistency within category is critical

**2. Prefer semantic over descriptive**

- Meaning over appearance
- Business context over visual

**3. Use full words, not abbreviations**

- Exception: Universal terms (WiFi, API)
- Clarity over brevity

**4. Keep it simple**

- One purpose per icon
- Avoid over-specification
- Let props handle variations

**5. Be consistent**

- Match existing patterns
- Use consistent verb tense
- Maintain singular/plural rules

**6. Document special cases**

- Brand names
- Numbers
- Compounds

**7. Plan for refactoring**

- Deprecation path
- Migration guides
- Timeline communication

### Quick Reference Checklist

```
□ PascalCase naming
□ Ends with "Icon"
□ Semantic meaning clear
□ Follows category convention
□ Consistent with similar icons
□ No abbreviations (unless universal)
□ Numbers spelled out (if at start)
□ No special characters
□ Documented in catalog
□ Tests follow same naming
```

---

## Summary

### Key Takeaways

1. **Consistency is paramount** - Follow established patterns
2. **Semantic names are better** - Describe purpose, not appearance
3. **Category conventions matter** - Each category has specific rules
4. **Clarity over brevity** - Spell out terms unless universally known
5. **Plan for change** - Deprecation paths for refactoring

### Quick Naming Formula

```
1. Determine category
2. Use category pattern
3. Choose semantic meaning
4. Add modifiers if needed
5. Verify consistency
6. Add "Icon" suffix
```

### Resources

- **Full catalog:** [Icons Catalog](../icons-catalog.md)
- **Usage examples:** [Usage Reference](../usage-reference.md)
- **Adding icons:** [Adding Icons Guide](./adding-icons.md)

---

*Last updated: 2025-01-05*
