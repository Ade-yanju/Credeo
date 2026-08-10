---
name: ui-excellence
description: Use this skill whenever building or restyling a web app (React/Next.js) or mobile app (React Native/Expo) UI — landing pages, dashboards, product screens, onboarding flows, design systems. Also trigger when the user asks for a UI to feel "premium," "native," "polished," "not generic," "not AI-slop," or wants 3D, motion, or a distinctive visual identity. This skill picks the right level of 2D/3D/motion, selects real third-party libraries instead of reinventing primitives, and enforces an anti-slop bar so the output looks like a shipped product, not a template. Trigger even if the user only says "build me an app" or "make this landing page" without naming any of these words explicitly — that's still a UI-build task this skill should govern.
---

# UI Excellence

Most AI-built interfaces are recognizable at a glance: the same purple-to-blue gradient hero, the same three feature cards, the same unstyled shadcn defaults, the same Inter font, the same fade-up-on-scroll on everything. None of that is wrong in isolation — it becomes "slop" because it was reached for by default, not chosen for this product. Your job is the opposite: build interfaces that look and feel like a real product team with a design system, a motion budget, and an opinion shipped them.

This skill governs *how* to build (stack, libraries, motion/3D, platform feel). For *visual identity* — palette, typography, layout, copy — read `/mnt/skills/public/frontend-design/SKILL.md` too; the two are meant to be used together. Read that skill's design principles before making any color or type decisions; don't duplicate that thinking here.

## Step 1: Scope the build before writing code

Don't guess silently on things that change the whole approach. Resolve these, either from context already in the conversation or by asking:

1. **Platform**: web (React/Next.js), mobile (React Native/Expo), or both? If both, are they meant to share a visual language (same brand, two native shells) or literally share code (React Native Web)? Default to native shells with a shared design-token file rather than shared UI code — a web page and a mobile screen that behave identically usually means neither one feels native to its platform.
2. **Motion/3D intensity**: this is a per-project creative decision, not a fixed default — always check. Read `references/motion-3d.md` for the decision framework, then either state your call and why, or ask the user directly if the brief gives no signal (e.g. "I'm thinking restrained motion with one 3D moment in the hero — want to go bigger, or keep it flatter?").
3. **Real vs. placeholder content**: if there's no real copy, product data, or imagery, decide what the product actually is first (see frontend-design's "Ground it in the subject"). Generic content produces generic UI even with great code.
4. **Fidelity target**: a throwaway prototype and a production screen warrant different amounts of polish (accessibility, error states, loading states, responsiveness). Match effort to what's being asked for, but never skip the quality-bar checklist in Step 5 for anything described as a real product.

## Step 2: Run the anti-slop check

Before building, mentally price-check your plan against `references/anti-slop.md` — it's a working list of the tells (specific gradients, layouts, copy patterns, icon choices) that make interfaces read as generated rather than designed. You don't need to avoid every pattern on that list on principle; the point is that each choice should be one you'd defend, not one you reached for because it's the path of least resistance. If your plan matches three or more items on that list with no justification specific to this product, revise before you build.

## Step 3: Pick your libraries — don't hand-roll what's solved

Reinventing a date picker, a physics-based drag interaction, or a 3D scene from scratch produces worse results in more time than reaching for a maintained library, and it's a common tell of AI-generated code (custom CSS that approximates what a real component library does natively, badly). Default to composing from real libraries and reserve custom code for the parts that make this product distinctive.

- Web (React/Next.js): component primitives, motion, charts, 3D, icons, fonts — see `references/web.md`.
- Mobile (React Native/Expo): navigation, motion, gesture, native-feel primitives, icons — see `references/mobile.md`.
- 3D and advanced motion on either platform: see `references/motion-3d.md` for library choices, performance guardrails, and when *not* to use 3D.

Pick specific named libraries and versions where you can, install them for real (don't fake an import), and lean on their built-in variants/theming rather than overriding every class — heavy per-component overrides are usually a sign the wrong base component was chosen.

## Step 4: Build with platform instincts, not just responsive CSS

A mobile screen is not a narrow web page, and a web page is not a native screen with hover removed. Read the relevant reference (`references/web.md` or `references/mobile.md`) for the concrete platform patterns — navigation models, gesture expectations, safe areas, hit targets, platform-adaptive components (iOS vs. Android), and performance defaults. The single biggest tell of a non-native-feeling mobile UI is a web layout dropped into a phone frame: full-bleed cards with web-style hover states, desktop navigation patterns (top tab bars behaving like nav links), and no attention to thumb reach or gesture affordances.

## Step 5: Critique, then verify the quality bar

Before calling it done, actually look at what you built (take a screenshot if your environment supports it) and check it against this bar. This list is deliberately non-negotiable for anything presented as a finished screen, separate from the more subjective anti-slop judgment call above:

- **Responsive/adaptive**: the web layout holds from mobile width up through desktop; the mobile layout holds across phone sizes and respects safe areas.
- **States are designed, not missing**: loading, empty, error, and success states exist and are considered, not left as blank divs or default browser errors.
- **Motion respects the user**: `prefers-reduced-motion` is honored on web; nothing traps the user in an animation longer than ~400ms without an escape.
- **Accessible by default**: real focus states (not `outline: none` with nothing to replace it), semantic elements/roles, sufficient contrast, tappable targets ≥44px on mobile.
- **Performance-aware**: 3D/heavy motion assets are lazy-loaded or code-split; nothing blocks first paint that doesn't need to.
- **It's specific to this product**: if you swapped the logo and copy, would this still look like a template? If yes, go back to Step 2.

## When the ask is small

Not every request needs the full loop — a single component, a quick fix, or an explicit "just make it work" doesn't need a 3D decision or a library survey. Use judgment: scale the process to the size of the ask, but don't let "it's just a small thing" become an excuse to reach for the same six patterns every time.
