# Design System Guide

A design theme guide for yanicells.dev, focusing on the / (home) and /about pages.

## Color Palette

### Primary Dark Theme – **Catppuccin Mocha**

**Base Colors:**

- **Background**: `#1e1e2e` (Deep dark navy)
- **Foreground (Text)**: `#cdd6f4` (Off-white)
- **Card Background**: `#313244` (Slightly lighter than bg)
- **Muted Background**: `#45475a` (Gray-ish)
- **Muted Foreground**: `#a6adc8` (Lighter gray text)
- **Border**: `#45475a` (Subtle borders)

### Accent Color Palette – **Vibrant Catppuccin**

Used throughout for highlights, buttons, icons, and attention-grabbing elements:

- **Primary/Blue**: `#89b4fa` (Sky blue) — Main accent, CTAs, links
- **Blue Hover**: `#74c7ec` (Cyan) — Hover states
- **Purple**: `#b4befe` (Periwinkle)
- **Lavender**: `#cba6f7` (Soft purple)
- **Pink**: `#f5c2e7` (Soft pink)
- **Teal**: `#89dceb` (Cyan-teal)
- **Red**: `#f38ba8` (Soft red)
- **Yellow**: `#f9e2af` (Warm yellow/gold)
- **Green**: `#a6e3a1` (Mint green) — Status indicators, success
- **Peach**: `#fab387` (Warm peach/orange)
- **Mint**: `#94e2d5` (Cool mint)

## Typography

**Font Stack**: System fonts (default sans-serif via Tailwind)

```css
font-family:
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  Roboto,
  "Helvetica Neue",
  Arial,
  sans-serif;
```

**Font Sizes & Hierarchy**:

- **Display/Hero**: `2.25rem – 2.5rem` (text-2xl, text-3xl) — Bold, tracking tight
- **Large Headings**: `1.875rem – 2.25rem` (text-3xl, text-4xl) — Bold
- **Section Headers**: `1.5rem – 1.875rem` (text-2xl, text-3xl) — Bold
- **Body Text**: `0.875rem – 1rem` (text-sm, text-base) — Regular
- **Small/Captions**: `0.75rem` (text-xs) — For labels, muted foreground
- **Monospace Labels**: `0.75rem – 0.875rem` — Uppercase, tracking-wider for branding

**Font Weights**:

- **Regular**: 400 (body, descriptions)
- **Medium**: 500 (accents, slightly bolder text)
- **Bold**: 700 (headings, CTAs)

## Layout & Containers

### Cards & Containers

- **Border Radius**: `0.625rem` (default) — Subtle rounded corners
- **Border**: `1px solid #45475a` (subtle borders)
- **Padding**: `0.5rem – 1rem` (sm to md variants)
- **Gap Spacing**: `0.5rem – 2rem` depending on context

**Card Style** (used on / homepage for CTAs):

```
Border: 1px solid border
Background: Transparent or muted/50 (very subtle)
Padding: 0.5rem – 1rem
Hover State: Border → primary/30, Background → muted/50
Transition: 200ms ease-out
```

### 2×2 CTA Grid (Home Page)

- **Grid**: `grid-cols-2`
- **Gap**: `0.375rem – 0.5rem` (tight spacing)
- **Responsive**: Scales up on larger screens with more padding

## Component Styling

### Input/Textarea (Chat Interface)

- **Background**: `muted/50` (semi-transparent muted)
- **Border**: `1px solid border`
- **Border Radius**: Fully rounded (`rounded-full`)
- **Focus State**:
  - Border color → `ring` (blue)
  - Ring: `1px ring-ring/50`
- **Padding**: `py-1 pl-2 pr-1.5`
- **Text Color**: `foreground`
- **Placeholder**: `muted-foreground`
- **Min Height**: `3rem` (min-h-12)

### Quick Question Chips (Home Page)

- **Style**: Pill/button
- **Border**: `1px solid border`
- **Background**: `muted/50`
- **Padding**: `px-3 py-1.5` (sm: `px-4`)
- **Font Size**: `text-xs` (sm: `text-sm`)
- **Text Color**: `muted-foreground`
- **Hover State**:
  - Background → `muted`
  - Text → `foreground`
- **Disabled State**: `opacity-50`, `pointer-events-none`

### Icon Buttons

- **Size**: `size-4 – size-5` (sm: larger variants)
- **Background**: `bg-{color}/10` for subtle accent backgrounds
- **Hover**: Transition from `muted-foreground` to `foreground` or `primary`
- **Transition**: `300ms` ease-out

### Social Links (About Page)

- **Icon Size**: `size-5`
- **Color**: `text-muted-foreground`
- **Hover State**:
  - Transition to `text-primary` (blue)
  - Duration: `300ms`

### Status Indicators (About Page)

- **Color Dots**: `1.5px` size, `rounded-full`
- **Colors**: Green (`ctp-green`), Blue (`ctp-blue`), Peach (`ctp-peach`)
- **Margin Top**: `mt-2` (align with text baseline)

## Spacing & Layout Guidelines

**Vertical Spacing**:

- **Section Gap**: `space-y-8` (2rem between major sections)
- **Paragraph Gap**: `space-y-2.5 – space-y-3` (0.625rem – 0.75rem)
- **Heading to Content**: `mb-3 – mb-4`

**Horizontal Padding**:

- **Container Max Width**: `max-w-3xl`
- **Page Padding**: `px-4` (mobile), up to `px-0` on larger screens

**Responsive Design**:

- **Mobile First**: Stack vertically, smaller font sizes
- **Tablet (sm+)**: Increase padding, font sizes
- **Desktop (md+)**: Side-by-side layouts, larger spacing
- **Large Desktop (lg+)**: Maximum spacing, larger typography

## Interactive States & Transitions

**Hover Effects**:

- **Duration**: `200ms – 300ms`
- **Easing**: `ease-out`
- **Effects**: Border color shift, background subtle change, text color change

**Focus States**:

- **Outline**: None (uses custom ring system)
- **Ring**: `1px ring-ring/50` (blue outline with transparency)
- **Border**: Transition to `ring` color

**Loading States**:

- **Opacity Reduction**: `opacity-50`
- **Cursor**: `pointer-events-none`

**Animations**:

- **Fade In Up**: Smooth entrance animation for hero content
- **Pulse**: Subtle pulse on cursor indicator in typing effect
- **Equalizer**: Music visualization bars (if used)

## Summary – Design Identity

- **Dark, sophisticated aesthetic** with deep navy backgrounds
- **Vibrant accent colors** for visual interest and hierarchy
- **Clean typography** with clear hierarchy and spacing
- **Minimal, bordered containers** instead of filled boxes
- **Smooth transitions and hover states** for interactivity
- **Accessibility-first approach** with color contrast and readable text
- **Catppuccin Mocha theme** throughout for consistency and brand cohesion

This creates a **modern, approachable dark UI** that feels premium yet friendly.
