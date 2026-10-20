---
name: design-research
description: Research real-world design before building or redesigning an interface. Curated inspiration and component sources matched to the kind of product, plus the rules for adapting ideas without overdesigning. Use for any significant page, redesign, new interface, landing page, dashboard, portfolio, gallery or shop — or whenever a design needs a direction rather than a tweak.
---

# Design research

The goal is not to make every project look flashy, and not to make them look alike.
The goal is that each one is polished, modern, intentional, distinctive, consistent
within itself, appropriate to its purpose, responsive, accessible and enjoyable.

Use the sources in `references/sources.md` as a toolbox, not a checklist.

**Do not blindly copy websites. Do not add effects because they look impressive.**
Always adapt an idea to the existing product, brand, content and architecture.

## Before researching anything

Do not browse first. Answer these about the actual task:

1. What product is this?
2. What page or screen is this?
3. What is the user's primary goal here?
4. What information matters most?
5. What visual personality should this product have?
6. What design system already exists?
7. What components already exist in the codebase?
8. What should stay unchanged?
9. What genuinely needs improving?

Only then open the sources.

## Workflow for a redesign or a major page

**Step 1 — Audit what exists.** Components, CSS, tokens, typography, colours,
spacing, radius, shadows, animation, responsive behaviour, page structure. Screenshot
it with `shot.mjs` if it runs. Never redesign blind.

**Step 2 — Name the actual problem.** State it plainly: hierarchy is unclear, the page
feels empty, cards are repetitive, navigation is weak, typography lacks contrast, the
CTA does not stand out, the gallery does not show the artwork well, the dashboard shows
too much, spacing is inconsistent, mobile is weak. **Do not solve a problem that does
not exist.**

**Step 3 — Research the right sources.** Match the source to the kind of interface (see
below). Look at real examples of the same type of thing. Do not pull in unrelated
references because they look impressive.

**Step 4 — Offer 2–3 directions, build one.** For each: the visual idea, the sources it
draws on, typography, layout, colour, interaction, animation, components, advantages,
risks. **Do not implement three versions.** Compare, choose, then build.

## Match the source to the task

Full URLs and what each is good for are in `references/sources.md`.

| Building | Go to |
|---|---|
| **Portfolio** | Godly, Awwwards, SiteInspire, Behance, Dribbble, One Page Love, Aceternity, Cult UI — artwork presentation, image grids, project storytelling, galleries, case studies |
| **Artist shop** | Land-book, Lapa Ninja, One Page Love, Mobbin, SiteInspire, shadcn/ui, Magic UI — product galleries, cards, filtering, checkout, trust sections |
| **Dashboard** | Mobbin, shadcn/ui, Origin UI, HeroUI, 21st.dev, Flowbite, Preline — navigation, hierarchy, tables, filters, sidebars, command menus, empty states. Avoid decorative interfaces. |
| **Editor** | Mobbin, shadcn/ui, Origin UI, HeroUI, Motion, React Bits — toolbars, side panels, contextual menus, shortcuts, autosave and status indicators, distraction-free layouts |
| **Creative / game** | Godly, Awwwards, Dribbble, Cult UI, Aceternity, React Bits, Magic UI, Motion — visual feedback, playful interaction, large type, dramatic layout. Usability still wins. |
| **SaaS landing page** | Land-book, Lapa Ninja, Godly, Awwwards, Tailark, shadcn Blocks, Magic UI — hero, product demo, features, social proof, pricing, FAQ, CTA |

## Which component source first

**Foundational application UI:** existing project components → shadcn/ui → Origin UI →
HeroUI → Preline / Flowbite / daisyUI → anything else.

**Creative visual elements:** existing project components → Aceternity → Magic UI →
React Bits → Cult UI → Motion Primitives → 21st.dev → anything else.

**Whole-page inspiration:** Godly → Awwwards → SiteInspire → Land-book → Mobbin →
Lapa Ninja → One Page Love → Behance → Dribbble.

This is a starting point by problem type, not a quality ranking.

## Codebase first

Before pulling in any external component: check whether an equivalent already exists
and reuse it; check the project's framework and dependencies; check compatibility;
avoid a new dependency for a small effect; preserve existing functionality, APIs and
data structures unless the task requires changing them. **Never replace working
infrastructure to use a trendier library.**

## Do not overdesign

This matters more than anything else here. A site does **not** improve by adding
gradients, glowing borders, glassmorphism, particles, animated text, huge shadows,
over-rounded cards, parallax, cursor effects, 3D or constant motion.

A clean design with excellent spacing and typography beats a page loaded with effects.

## Animation must say something

Good reasons: showing a state change, confirming an action, revealing information,
guiding attention, creating hierarchy, making navigation legible, improving perceived
speed, a deliberate brand moment.

Bad reasons: it looked cool, the library had it, other AI sites do it, the page felt empty.

Prefer short transitions, subtle hover states, meaningful entrances, smooth layout
changes, and `prefers-reduced-motion` support. Avoid constant movement, looping
distractions, slow interactions, and animation that blocks the user.

## Responsive

Evaluate every idea at desktop, tablet and mobile. **Do not just shrink the desktop
version.** Ask whether navigation should change, cards should stack, type and spacing
should change, images should crop differently, interactions should become touch-friendly,
sidebars should become drawers, tables should become cards or scroll, motion should reduce.

## Accessibility

Keyboard access, visible focus states, sufficient contrast, readable text, semantic HTML,
accessible labels, adequate button sizes, reduced-motion support, screen-reader
compatibility. **Never trade accessibility for aesthetics.**

## Performance

Before adding an impressive component, weigh bundle size, animation cost, image size,
unnecessary JavaScript, layout shift, mobile performance and GPU-heavy effects. Prefer
CSS when CSS is enough. Prefer lightweight components. No large dependency for a small
visual effect.

## Brand consistency

Pages can differ in layout while still belonging to one product. Keep typography,
spacing, colour, radius, shadow, icon style, animation style, button, card and
navigation style coherent.

## Do not copy

Use external sites for inspiration, patterns, ideas, component concepts, interaction and
layout ideas. Never copy whole websites, branding, logos, proprietary illustration,
artwork, visual identity or copyrighted assets. Implement the underlying idea with our
own code and assets.

## Build primitives, not variants

Prefer reusable: Button, Card, Modal, Input, Select, Tabs, Badge, Tooltip, Dropdown,
Navigation, PageHeader, Section, Gallery, EmptyState, LoadingState, ErrorState,
CommandMenu, Toast, Dialog. **Do not create five slightly different versions of the same
component** — extend the existing one.

## Recommend before a big change

For a significant redesign, do not rewrite the page first. Give a short recommendation:
**current problem**, **inspiration** (which sources were relevant), **proposed solution**,
**components** to add or change, whether **animation** is genuinely needed, and the
**risk** to usability, performance or consistency. Then build once the direction is agreed.

Small improvements skip this and just get made.

## The product decides the visual language

Do not force one style across different projects.

- **Artistic / portfolio** — expressive, visual, experimental, editorial, image-led.
- **Business / SaaS** — clear, trustworthy, structured, efficient, professional.
- **Creative tools** — professional usability with a distinctive identity and subtle
  creative interaction.
- **Games / entertainment** — playful, dynamic, expressive, animated.

## Before calling it finished

**Visual:** clear hierarchy? intentional? enough whitespace? consistent type and spacing?
any personality?
**UX:** is the primary action obvious? is the page quickly understandable? are
interactions predictable? are important states visible?
**Responsive:** works on mobile? on tablet? does desktop use the space well?
**Accessibility:** readable? sufficient contrast? keyboard-usable? visible focus?
**Performance:** animations light? images optimised? no needless dependency?
**Consistency:** still the same product? tokens respected? does it belong?

## The point

Not "make it look like Awwwards." Rather: study excellent design, work out *why* it
works, and adapt that intelligently to this product.

Every decision must answer: **why does this improve the user's experience?** If there is
no good answer, do not add it.

## Related

`design-system` sets up the tokens. `design-review` screenshots the result and checks it.
