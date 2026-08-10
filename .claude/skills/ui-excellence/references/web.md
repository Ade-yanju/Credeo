# Web (React / Next.js)

## Component primitives

Don't build interactive primitives (dropdowns, dialogs, comboboxes, popovers, sliders) from scratch — accessibility and edge cases (focus trapping, keyboard nav, portals, scroll locking) are genuinely hard to get right and already solved.

- **Radix UI** (`@radix-ui/react-*`) or **Ark UI** — unstyled, accessible primitives. Best choice when you want full control over visual styling and are building a distinctive design system.
- **shadcn/ui** — Radix + Tailwind, copy-pasted into the repo rather than installed as a dependency. Good starting scaffold, but the raw generated look is one of the most recognizable "AI built this" tells — always re-theme it (colors, radii, shadows, spacing scale, font) rather than shipping the defaults.
- **Headless UI** — lighter alternative to Radix, works well with Tailwind.
- **React Aria (Adobe)** — the deepest accessibility guarantees of any of these; worth it for complex components (date pickers, comboboxes, tables) in production apps.

## Motion

- **Framer Motion / Motion for React** — the default choice for page transitions, layout animation, gesture-driven interaction, and scroll-linked effects. `layout` and `layoutId` props handle shared-element transitions with very little code.
- **GSAP** (with ScrollTrigger) — reach for this over Framer Motion when the brief calls for complex, choreographed scroll sequences, SVG morphing, or precise timeline control; it's the standard in agency/awwwards-style sites.
- **Lenis** — smooth-scroll library, commonly paired with GSAP ScrollTrigger for the "premium site" scroll feel.
- **React Spring** — physics-based alternative to Framer Motion, good for organic, springy interactions.
- **Lottie** (`lottie-react`) — for designer-authored vector animations (After Effects exports) rather than hand-coding complex illustrated motion.

Always check `prefers-reduced-motion` and provide a reduced/no-motion path; Framer Motion and GSAP both have built-in hooks for this.

## 3D

See `motion-3d.md` for the decision framework on when 3D is worth it at all. When it is:

- **@react-three/fiber** (React renderer for Three.js) + **@react-three/drei** (helper components: cameras, controls, loaders, environment maps) — the standard React 3D stack. Prefer this over raw Three.js in a React codebase; it composes with React state instead of fighting it.
- **@react-three/rapier** or **@react-three/cannon** — physics, if the scene needs it.
- **Spline** — for designer-authored 3D scenes exported and embedded via `@splinetool/react-spline`, when the 3D asset itself is being designed in a visual tool rather than coded.
- Always lazy-load the 3D bundle (`next/dynamic` with `ssr: false`, or React `lazy` + `Suspense`) — Three.js is heavy and should never block first paint.

## Charts and data viz

- **Recharts** — fastest to a clean, composable chart for standard dashboard needs.
- **visx** (Airbnb) — lower-level, for fully custom/branded chart design built on D3 primitives with React.
- **D3** directly — only when the visualization is genuinely custom (not a standard chart type).
- **Tremor** — pre-built dashboard blocks (KPI cards, charts) on top of Tailwind, good for fast internal tools.

## Icons and type

- **Lucide** is the current default and is fine, but note it's also become a slop tell through sheer ubiquity — consider **Phosphor Icons** (more weight variants), **Tabler Icons**, or a custom/brand icon set for anything meant to feel distinctive.
- Load real variable fonts (via `next/font` for Next.js) rather than defaulting to system fonts or Inter; see frontend-design's guidance on type pairing.

## Framework and performance defaults

- Next.js App Router: use Server Components by default, mark interactive pieces `"use client"` deliberately rather than at the top of every file.
- `next/image` for real image optimization; never ship unoptimized full-resolution images.
- Code-split anything heavy (3D, charts, rich text editors) with dynamic imports.
- Tailwind CSS is the common styling layer across most of the libraries above, but don't let default Tailwind spacing/color tokens stand in for a real design system — extend the theme with the palette and type scale from the design plan (see frontend-design).
