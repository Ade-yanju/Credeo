# 3D and Motion: Deciding How Far to Go

3D and heavy motion are the highest-leverage way to make a UI feel exceptional — and also the fastest way to make it feel like a gimmick, tank performance, or actively work against usability. Treat the *amount* of motion/3D as its own design decision, separate from whether the visual identity is otherwise bold or restrained. A minimal, quiet brand can still have one extraordinary 3D moment; a maximalist brand can be entirely flat and still feel premium through type and layout alone.

## Ask, don't assume

There is no safe default level here — it depends entirely on the product, the audience, and the brief. Before committing significant build time to a 3D scene or a choreographed motion sequence:

- If the brief signals it (a product that's inherently spatial/physical, an agency/portfolio site, a game, a brief that explicitly asks for "wow"), lean in.
- If the brief signals restraint (a B2B dashboard, a utility app, a finance/health product where trust and clarity matter more than spectacle), default lighter — motion in service of feedback and hierarchy, not spectacle.
- If the brief gives no signal either way, say what you're planning and why before building it out, rather than silently going big or silently playing it safe. A one-line check ("I'm planning a restrained UI with one 3D hero moment — louder or quieter?") costs nothing and prevents rebuilding later.

## Where 3D actually earns its cost

3D is worth the performance and complexity budget when it does one of these:

- **The product is inherently spatial** — configurators (cars, furniture, sneakers), architectural/interior visualization, anything where a real object needs to be seen from multiple angles.
- **One signature hero moment** — an orchestrated 3D scene as the single memorable element of a landing page (see frontend-design's "spend your boldness in one place"). This works best as *one* scene, not 3D scattered across every section.
- **Data that genuinely has a third dimension** — some scientific/technical visualization, but most data is better served by good 2D charts than forced into 3D that makes it harder to read.

3D is usually *not* worth it for: generic decorative backgrounds, floating abstract shapes with no connection to the product, or "because it looks impressive" with no functional or narrative reason. These read as filler, and they carry real cost (see below).

## Real cost of 3D — plan for it

- **Bundle size**: Three.js + a scene is easily several hundred KB to a few MB depending on assets. Always lazy-load it (dynamic import on web, avoid loading on app launch on mobile) so it never blocks first paint or app start.
- **Battery and thermal on mobile**: sustained WebGL/3D rendering drains battery fast and can throttle on mid-range devices. On React Native, prefer a pre-rendered video/Lottie fallback for anything that isn't truly interactive 3D, and always test on a mid-tier device, not just a simulator or flagship phone.
- **Accessibility**: provide a static fallback or way to skip/pause for users with `prefers-reduced-motion`, vestibular sensitivity, or low-end devices/slow connections.
- **Load time**: show a lightweight placeholder (blurred still frame, skeleton, or brand color) while the 3D scene loads rather than a blank space or spinner-only wait.

## Calibrating 2D motion

Most of what makes an interface feel alive is 2D motion, not 3D, and it's cheaper to get right:

- **Motion should communicate**, not decorate: a transition should show *where something came from* or *what changed* (shared-element transitions, height/opacity changes tied to state), not just be present for its own sake.
- **Vary timing and easing by context** — a page transition, a hover state, and a success confirmation shouldn't all use the same duration/easing; matching everything to one spring config is itself a slop tell (see anti-slop.md).
- **One orchestrated sequence beats many scattered ones.** A single well-choreographed page-load animation (staggered, purposeful) reads as more crafted than every individual element having its own scroll-triggered fade.
- **Respect the platform's motion language.** iOS and Material Design both have their own default transition curves and durations (spring-based on iOS, defined easing curves in Material) — matching them (or deliberately diverging, with reason) reads as more native than an arbitrary custom curve.

## Quick reference: library choice by ambition

| Ambition | Web | Mobile |
|---|---|---|
| Micro-interactions, simple transitions | Framer Motion | Reanimated / Moti |
| Choreographed scroll sequences | GSAP + ScrollTrigger + Lenis | Reanimated + Gesture Handler |
| Designer-authored vector animation | Lottie | Lottie |
| One 3D hero scene | @react-three/fiber + drei | Pre-rendered asset, or R3F via expo-gl if truly interactive |
| Full 3D product/configurator | @react-three/fiber + drei (+ rapier/cannon for physics) | Generally punt to web view or native module; rarely worth full 3D on RN |
