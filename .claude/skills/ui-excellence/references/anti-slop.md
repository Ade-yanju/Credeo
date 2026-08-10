# Anti-Slop Patterns

None of these are banned outright — the right brief can justify any of them. The point is that each should be a decision, not the reflex. If you catch yourself reaching for one because it's fast rather than because it's right for this product, swap it.

## Color and surface

- The two color stories that show up regardless of subject: (1) warm cream background (~`#F4F1EA`) with a high-contrast serif and a terracotta accent near `#D97757`; (2) near-black background with one acid-green or vermilion accent. Both read as "AI made this" now because of how often they appear, not because they're bad palettes.
- Purple-to-blue (or pink-to-orange) linear gradients used as a background wash with no reason tied to the product.
- Glassmorphism (frosted blur cards) applied everywhere rather than as one deliberate surface treatment.
- Heavy drop shadows on every card as the only depth cue, instead of considered elevation.

## Layout

- Centered hero (headline, subhead, two buttons) directly above a 3-up feature-card grid with an icon, bold title, and one sentence each. This is the single most common AI-generated landing page shape.
- Numbered markers (01 / 02 / 03) on content that isn't actually sequential — decorative numbering that doesn't encode real order.
- A logo cloud of generic company placeholders under "Trusted by" with no real logos.
- Bento-grid layouts used as decoration rather than because the content genuinely has that many distinct, differently-sized chunks.

## Typography

- Inter (or Inter + a generic serif pairing) as the unexamined default for every project regardless of tone.
- Center-aligned everything, including long body copy.
- A type scale with only two sizes doing all the work (huge headline, one body size) with no intermediate steps for hierarchy.

## Motion

- Fade-up-on-scroll applied uniformly to every section, card, and list item with no variation — motion as decoration rather than communication.
- Hover states that only scale(1.05) or add a shadow, on every interactive element, with no other feedback.
- Auto-playing carousels/marquees as a default way to fit "more logos" or "more testimonials" into less space.

## Iconography and imagery

- Generic outline icon sets (the same rounded-corner line icons) chosen without regard to the product's actual visual language.
- Emoji standing in for icons in a polished product UI.
- Stock photography of diverse groups of people smiling at laptops.
- AI-generated abstract 3D blob/gradient-mesh imagery used as filler hero art with no connection to the product.

## Components

- Unstyled or barely-styled shadcn/ui, MUI, or Chakra defaults shipped as final UI — using a component library's raw theme instead of adapting its tokens to the brand.
- Every button using the same single primary color regardless of hierarchy (primary/secondary/tertiary/destructive all looking alike or all looking equally loud).
- Modal/dialog patterns used for content that would work better inline or as a dedicated view (over-reliance on modals for everything).

## Copy

- Vague value-prop headlines assembled from interchangeable business-speak ("Unlock your potential," "Supercharge your workflow," "The future of X") that could apply to any product in the category.
- Feature descriptions that restate the feature name instead of saying what it does for the user.
- Lorem-ipsum-shaped placeholder copy left in a screen presented as finished.

## Mobile-specific

- A web page dropped into a phone-sized viewport: hover-dependent interactions, desktop-style top navigation bars, no bottom nav or tab bar despite the app having 3+ top-level destinations.
- Ignoring platform conventions — Android app using iOS-style back swipe/nav icons, or vice versa, with no platform-adaptive logic at all.
- Full-bleed content that ignores safe areas, notches, and home-indicator space.
