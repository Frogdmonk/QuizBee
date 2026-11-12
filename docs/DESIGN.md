# Rally: "Match Day" final design spec

> **Brand update (2026-11-12): NIAT / NxtWave identity.** The tokens in `src/styles/index.css` now carry the
> brand: Nile Blue `#183B56` (ink-900: headings, text, navigation, dark controls), Emerald `#44C654`
> (emerald-500 / signal-400 / volt-400: primary actions with Nile Blue text, active states, progress, positive
> feedback), deep emerald `#1A7F37` (signal-600 / success-600: green text and links), Catskill White `#F8FAFC`
> (paper) and white (surface); the night screens are deep Nile navy (`#0B1D2C`). Typeface: Inter everywhere
> (code stays monospace). Game art (answer tiles, monsters, avatars, ranks) keeps its own colours. Where this
> document still names the old palette (paper #F6F4EF, signal #C8361A, Archivo / Figtree), the tokens win.


Status: final. This is the creative director's call. Match Day won by judge consensus (51 / 50 / 50). It is grafted with ideas from Desk & Stickers and Baseline, and every judge weakness is fixed. Contrast ratios were recomputed with the WCAG 2.x relative-luminance formula during this pass. Package versions were checked with `npm view` on 2026-11-07.

---

## 0. Concept

Rally works like a live broadcast of the lesson.

- **Teacher side: the editorial desk.** Newsprint paper, a strict grid, hairline rules instead of boxes, 3px section rules with kickers, and tabular numbers set like a results table. It is calm, flat, fast to scan, and nothing loops.
- **Student and projector side: the stage under floodlights.** A graphite night canvas with score bugs (a fixed-corner state block), lower thirds (a coloured tab plus a bar), a PIN readable from the back row, and players who arrive on screen as a roll call.
- **Energy is rationed.** Motion and colour peak only on (a) the student's own actions and (b) projector events the class is watching. Every number shown is real. Nothing is invented.
- **The sport is graphic, not literal.** There are no balls, trophies or team names in the copy, and no pitch drawing. The night texture is an abstract broadcast grid. The voice is "live", not "sport".

### Changes from the proposal (judge fixes and grafts)

| Change | Source |
|---|---|
| Answer A lightened to `#3B5BEA`: 3.51:1 on night-950 (was 2.93) and white text 5.43:1 | Judge fix |
| The kit pattern now fills a full-height **kit panel** on each tile (the column behind the letter chip), not a 28px flag. A stronger colour-blind cue | Judge fix plus Stickers idea |
| Answer-dim gets a 1px night-line border, so a dimmed tile keeps its shape (3.54:1 edge) | Judge fix |
| Volt appears only on student phone screens, at most one element per screen | Judge fix |
| Word headlines use Archivo width ≥ 82. The condensed width 75 is for numerals only | Judge fix |
| JetBrains Mono dropped. One-time links use the system mono stack (no package) | Judge fix |
| The full-screen kick-off wipe is dropped. Student step changes use a 3px top step-bar (220ms, non-blocking) plus a slide | Judge fix |
| 10deg clip-path cut dropped from score bugs (aliasing risk). The cut survives only inside the LogoMark SVG path | Judge fix |
| Danger is visually separated from primary: danger is outline plus icon by default. A filled danger appears only as the confirm button inside a ConfirmDialog | Judge fix |
| Locked state uses a chalk plate with ink text and a lock icon, not amber, so it can't be confused with answer D | Judge fix (marigold-overload lesson from Baseline) |
| Fixture cards simplified to band, title, caption and one action. Status is shown by the tab only | Judge fix |
| Copy: no "bring the noise". Pitch texture replaced by an abstract grid | Judge fix |
| Ink text on every bright fill, enforced by a token-pair unit test | Graft: Desk & Stickers |
| Static, non-animated skeletons | Graft: Desk & Stickers |
| Live name-tag preview in the avatar builder | Graft: Desk & Stickers |
| Press shadow is never animated: only transform moves, and the shadow swap is instant | Graft: Desk & Stickers |
| Breathing line as the single "waiting" idiom | Graft: Baseline |
| Quiet ConnectionPill | Graft: Baseline |
| "Your pick" ring and tag (Phase 4 token) | Graft: Baseline |
| Celebrations gated on `navigator.hardwareConcurrency` | Graft: Baseline |
| The dashboard Host band is always present | Graft: Baseline |
| Shared with Me as ledger rows | Graft: Baseline |
| Avatar palette re-tune keeps array order and indices | Graft: Baseline |

---

## 1. Audit problems → decisions

### Foundations

| Audit problem | Decision |
|---|---|
| White on flame-500 = 3.51 on primary buttons | Primary fill `signal-600 #C8361A`, white text **5.25:1**. Hover `signal-700 #B32E14` = 6.33 |
| Input borders 1.5:1; ink-400 text 3.2–3.5 | Inputs use `line-strong #8A857C` (3.67 on white, 3.34 on paper). Text floor is `ink-500 #5E5A53` (6.24 on paper). The `ink-400` token is re-pointed to `#6B675F` (5.12 on paper) so legacy uses pass |
| No night component layer | Semantic night tokens, plus `tone="night"` on Button, TextField, Badge, Alert, Dialog and Skeleton |
| LogoMark tile vanishes on night | `LogoMark tone="night"`: night-800 tile with a 1px night-line stroke. `Logo inverted` implies night |
| Reduced motion freezes Spinner and Skeleton | Spinner becomes the `.motion-essential` level meter with a stepped-opacity fallback. Skeletons are static by design |
| Card is the only surface | Surface vocabulary: Sheet, Ledger, Strip, Banner, ScoreBug, LowerThird, Placeholder. `shadow-card` is re-pointed to none |
| No type scale; weights too heavy | `--text-*` tokens and `.type-*` utilities. The global h1–h3 display rule is removed. Card titles use Figtree 650 |
| Motion tokens missing or unused; 14 inline springs | CSS duration and easing tokens plus `src/lib/motion.ts` named springs and variants. Every inline config is replaced |
| Touch targets of 32–36px | `@media (pointer: coarse)` lifts sm buttons, icon buttons, menu items, segments and the eye toggle to 44px |
| Answer B and D contrast | B `#0A7A6E` white 5.22; D `#F2B100` with ink text 9.86. Press, dim, correct and your-pick states are defined |
| Mint badge 4.0; status chips hand-made | success-600 on success-50 = 4.74. Badge gets status variants (live, open, locked, reconnecting) and a night surface |
| Radius drift | Radius scale is xs 3, sm 6, md 10, full. `rounded-xl` is re-pointed to 6px and `2xl`/`3xl` to 10px, so legacy classes conform |
| Static paper theme-color on night routes | `RootLayout` sets theme-color and the `data-ground` attribute per route |
| FullPageLoader paper flash | The loader reads the pathname and picks the night or paper ground |
| Info alert grey on grey; three "note" styles | Alert uses tone tint plus a 4px left tab, with info-50 and info-700. The dashed note is retired in favour of Placeholder |
| `cn()` cannot merge classes | `tailwind-merge@3.7.0` via `extendTailwindMerge`, with the custom text tokens registered |

### Public and auth

| Audit problem | Decision |
|---|---|
| Landing feature band is blank on phone (whileInView) | Rule: content is never gated on whileInView. Reveals animate only accent rules |
| Create account shows at 390 | Fixed by tailwind-merge |
| Stock hero and skeleton mock | Honest "Example question" broadcast frame with a real prompt and four kit tiles |
| Four identical features | "How a round works" three-surface strip |
| Phone is the desktop stack | Student-first "Got a PIN?" block at the top |
| Split auth with dead gaps; no brand on phone | 5/7 editorial split, top-aligned form, per-route aside art. Phone gets a 72px night strip with a 4-colour kit stripe |
| Student link faint | Student LowerThird link with equal weight |
| Leaderboard copy not yet true | Present-tense copy only |
| 404 detached | Rendered inside PublicLayout as the "not one of the options" answer grid |
| Status tiles inconsistent | `StatusBlock` primitive |
| No password feedback | Presentational checklist and a confirm-match tick |

### Teacher shell, dashboard, profile

| Audit problem | Decision |
|---|---|
| Stale roadmap and "phase 3" tile | Deleted |
| No Host entry | Host band plus a Host action on rows |
| "Good evening, Ms" | Full `display_name` |
| Stat cards stacked on phone | StatStrip, 3-up at 390 |
| Recent card stretched | `items-start` |
| Weak sidebar | paper-sunk ground, group kickers, 3px signal bar on the active item |
| Hamburger-only phone nav | Bottom tab bar |
| Drawer has no focus trap | Focus trap added |
| Profile duplicate title and Sign out first | Identity header; Session section last |
| Disabled primary looks salmon | Disabled is a neutral paper-sunk fill |
| Upcoming page uses checks and "Phase 5" | Hollow markers and user language |

### Quiz library, editor, preview

| Audit problem | Decision |
|---|---|
| Stage text breaks mid-word on phone | Single column of tiles with `overflow-wrap:normal; hyphens:auto` |
| Answer rows overflow | `grid-cols-[minmax(0,1fr)]` and `min-w-0` |
| Red error on a new quiz | Validate on blur or save only |
| Decorative banners | Fixture cards and Ledger rows |
| Host buried | One primary action per status |
| 36px controls | 44px on coarse pointers |
| Phone toolbar | Top bar, chip rail, Edit/Student switch, bottom action bar |
| Card-in-card | One Sheet, hairlines between sections |
| Truncated type labels | Narrower rails |
| Half-empty phone frame | Sized to content |
| Faint Edit button; Show answer outshines Next | night-ghost with a visible border; primary Next |
| No reveal moment | Reveal tokens |
| Filter wording drift | "Published" at every width |
| Mixed optional markers | One "Optional" caption |

### Workspaces and sharing

| Audit problem | Decision |
|---|---|
| Black slabs | Shared `QuizCover` |
| Untidy actions | One primary action by access level |
| Dead click area | Whole-row link |
| 450px phone cards | Ledger rows |
| AccessBadge drift | Composes Badge |
| No workspace identity | Monogram (hashed answer colour plus kit) and InitialsStack |
| Truncated title | Wraps |
| Remove 36px | Labelled 44px or a row menu |
| Revoke has no confirm | Inline Yes/Cancel plus loading |
| Invite reveal is flat | Wipe-open plus copy morph |
| Inviter fallback missing | "A colleague invited you" |
| Native checkboxes | `Checkbox` primitive |
| Grey activity icons | Tone-coded icons on a timeline rail |
| Skeleton sizes | Matched to real rows |

### Live host, sessions, projector

| Audit problem | Decision |
|---|---|
| PIN not dominant | `stage-pin` at 17vh |
| Tile grid; overflow at 100 players | Frameless crowd with density tiers, h-dvh |
| QR detached | Fused join panel |
| Title at white/70 | `stage-title` in night-text |
| Pulse empty state | Breathing line plus instruction |
| Layout animation on 100 items | No `layout` prop; queued pops |
| No primary on host; dashed Phase 4 note | Command bar plus Placeholder ("COMING NEXT", no button) |
| 2.6k-px phone page | Sticky compact bar, Join details sheet, 4-column crowd |
| Close lobby weak | Danger zone with danger-outline |
| Mixed waiting idioms | Breathing line everywhere |
| Open-now card not urgent | Live Banner |
| Orange Host column | One secondary Host button per row |
| Dev copy | Removed |
| Native player-limit select | Segmented control |

### Student

| Audit problem | Decision |
|---|---|
| Change-look sheet overflows and switches to light theme | Dialog max-h, internal scroll, `tone="night"`, dark builder |
| Tiny preview; 32-tile wall | 168px hero preview; 2-row snap scroller |
| Weak PIN focal point; muddy disabled button | Top-aligned layout, six slots, dashed "not yet" CTA that arms to volt |
| "You're in" too small | display-xl headline on the volt bar, one-shot |
| White Change-look slab | night and night-ghost button pair |
| Dev copy | "Get ready — the game is starting" |
| Small targets | 44px minimum |
| Terminal states identical | Per-state character |
| Logo links away from the game | Non-interactive mark |

---

## 2. Palette (all tokens live in `src/styles/index.css @theme`)

### Paper (teacher, public)

| Token | Hex | Role |
|---|---|---|
| `--color-paper` | #F6F4EF | Page ground |
| `--color-surface` | #FFFFFF | Sheets, dialogs, inputs |
| `--color-paper-sunk` | #E8E5DD | Sidebar, StatStrip, table header band, disabled fill. Never place inputs directly on it, and never put signal-600 text on it (4.17); use signal-700 |
| `--color-ink-950` | #0E0D12 | 3px section rules |
| `--color-ink-900` | #121214 | Primary text (17.02 on paper), dark button |
| `--color-ink-700` | #3A3834 | Strong secondary |
| `--color-ink-500` | #5E5A53 | Secondary text, hints, placeholders (6.24 paper / 6.86 white / 5.45 sunk) |
| `--color-ink-400` | #6B675F | Legacy alias, re-pointed (5.12 on paper). Do not use in new code |
| `--color-line-strong` | #8A857C | Input, checkbox and switch outlines (3.67 white / 3.34 paper) |
| `--color-line` | #D6D3CC | Decorative hairlines only |
| `--color-signal-700` | #B32E14 | Primary hover/pressed; link hover; signal text on sunk |
| `--color-signal-600` | #C8361A | Primary fill (white 5.25); links on white (5.25) and paper (4.78); active nav bar; live dot |
| `--color-signal-400` | #FF7A5C | Signal on night: links, focus ring, live dot (7.43 on night-950, 6.60 on night-900) |
| `--color-signal-50` | #FDEDE8 | Selected row, live wash on paper |
| `--color-success-600` / `-50` | #127A4C / #E7F4EC | Published, saved, correct marker. 4.74 badge; white on fill 5.37 |
| `--color-warning-700` / `-50` | #8A5A00 / #FFF4D6 | Warnings. 5.41 |
| `--color-error-600` / `-50` | #B3261E / #FBEBE8 | Validation and destructive. 5.65 badge; white on fill 6.54; on paper 5.95 |
| `--color-info-700` / `-50` | #1F45C2 / #E9EEFC | Info alert. 6.73 |

### Night (student, projector, full-screen preview)

| Token | Hex | Role |
|---|---|---|
| `--color-night-950` | #0E1013 | Canvas; theme-color on night routes |
| `--color-night-900` | #1A1D21 | Score bug, inputs, sheets |
| `--color-night-800` | #2B3036 | Raised, selected, LogoMark tile on night, skeleton |
| `--color-night-line` | #646B74 | Night control borders (3.54 on 950, 3.14 on 900) |
| `--color-night-rule` | #2B3036 | Decorative dividers |
| `--color-night-text` | #F3F4F1 | Primary text (17.26 on 950, 15.32 on 900) |
| `--color-night-muted` | #A3A9B0 | Secondary text (8.04 on 950, 7.14 on 900, 5.61 on 800) |
| `--color-error-300` | #FF9B91 | Input errors on night only (8.34 on 900). Never used for wrong answers |
| `--color-volt-400` | #D7F23A | **Student phone only, one element per screen.** Graphite text (15.11). Allowed uses: armed Enter CTA (join-pin), Join game CTA (join-profile), the YOU'RE IN bar and own name-tag tab (player-lobby). Phase 4/5: own rank on own phone. Never on paper, the projector or teacher routes |
| `--color-success-400` | #33C47A | Correct on night (graphite 8.45) |

Legacy aliases kept so pages compile: `flame-500` and `flame-600` map to #C8361A, `flame-700` to #B32E14, `flame-400` and `flame-300` to #FF7A5C, `flame-50` and `flame-100` to #FDEDE8. `mint-*` maps to the success values (mint-400/500 = #33C47A, mint-600 = #127A4C, mint-50 = #E7F4EC). `rose-*` maps to the error values (rose-400 = #FF9B91, rose-500/600 = #B3261E, rose-50 = #FBEBE8). `sun-*` maps to the warning and amber values (sun-300/400 = #F2B100, sun-500 = #8A5A00). Old `night-700..950` are re-pointed to the new night values (night-700 = #3A3F46). Screen tasks migrate usages to the semantic names.

### Answers (positions fixed: A top-left, B top-right, C bottom-left, D bottom-right)

| | Fill | Press/edge | Text | Kit pattern (kit panel) | Paper soft |
|---|---|---|---|---|---|
| A Cobalt | #3B5BEA | #2E49C9 | white 5.43 | Solid: panel in the press shade | #E6EBFC |
| B Pine | #0A7A6E | #07615A | white 5.22 | 45deg hatch: 2px lines every 7px, white 22% | #E0F0EE |
| C Berry | #B8285F | #961F4D | white 5.99 | Dots: 2.5px radial every 9px, white 24% | #F6E2EA |
| D Amber | #F2B100 | #C99200 | **ink-900 9.86** | Hoops: 3px horizontal bands every 8px, ink 16% | #FDF1CC |

- Fills against night-950: A 3.51, B 3.65, C 3.18, D 10.04. Answer tiles are only placed on night-950, white or paper. On night-900, C is 2.82, so tiles never sit there.
- `--color-answer-dim` #22262B, always with a 1px night-line border (3.54 edge). Text is night-muted (6.42). The letter chip and kit panel stay visible at 60%.
- `--color-yourpick` is night-text #F3F4F1: a 3px ring plus a "YOU" tag on the chosen tile, right or wrong.
- Ranks (Phase 5, graphite text): gold #E8B21A (9.81), silver #B9C0C7 (10.37), bronze #C9803F (6.03).

### Rules

- **Ink-on-bright rule.** Any fill with relative luminance > 0.3 (D amber, volt, success-400, signal-400, ranks, night-text "locked" plate) carries ink-900 or graphite text. Never white.
- **Token-pair test.** `tests/unit/design-tokens.test.ts` parses `--color-*` from index.css and asserts every declared text pair is ≥ 4.5 and every declared control-edge pair is ≥ 3.
- **Separate red roles.** Primary is filled signal. Danger is error-600 *outline plus icon* (Trash2 or LogOut). The danger *fill* is only used as the confirm button inside a ConfirmDialog.

---

## 3. Typography

### Packages

- **Add `@fontsource-variable/archivo@5.3.0`.** Published 2026-07-19 and verified. Import `@fontsource-variable/archivo/wdth.css`, which provides the wdth 62–125 and wght 100–900 axes. The latin file is about 90KB. Family name: `'Archivo Variable'`.
- **Keep `@fontsource-variable/figtree@5.3.0`** (`wght.css`) for body and UI.
- **Remove `@fontsource-variable/bricolage-grotesque`.** Delete its import and the dependency. The net payload stays roughly flat.
- **No mono package.** `--font-mono: ui-monospace, 'Cascadia Mono', 'SF Mono', Menlo, Consolas, monospace` is used for one-time invite links only.

### Font tokens

```
--font-sans: 'Figtree Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
--font-display: 'Archivo Variable', 'Figtree Variable', ui-sans-serif, system-ui, sans-serif;
```

### Utilities (`@layer components`)

| Class | Settings | Use |
|---|---|---|
| `.type-display` | display font, `font-stretch: 85%`, weight 850, tracking -0.015em | Word headlines |
| `.type-headline` | `font-stretch: 90%`, weight 800 | Section headlines |
| `.type-score` | `font-stretch: 75%`, weight 800, `font-variant-numeric: tabular-nums lining-nums` | Numerals |
| `.type-stage` | `font-stretch: 75%`, weight 900, tabular | Stage PIN and numerals |
| `.type-kicker` | Figtree 700, 0.75rem, uppercase, tracking 0.12em, ink-500 (night-muted on night) | Kickers |

- Width 75 is **numerals only**. Word headlines never go below width 82.
- The global h1–h3 display rule is deleted. `h1` and `h2` opt in with classes; h3 and smaller use Figtree `text-title`.

### Scale (`@theme --text-*`, each with `--line-height` and, where set, a weight)

| Group | Token | Value | Notes |
|---|---|---|---|
| UI | caption | 0.8125rem / 1.4 / 500 | **Minimum size**; 11px and 15px are gone |
| UI | body-sm | 0.875rem / 1.5 | |
| UI | body | 1rem / 1.55 | |
| UI | label | 0.875rem / 1.3 / 600 | |
| UI | title | 1.0625rem / 1.35 / 650 | Card and panel titles, Figtree |
| Display | headline | 1.5rem / 1.1 | |
| Display | display-lg | clamp(2rem, 1.6rem + 1.2vw, 2.5rem) / 1.0 | h1 |
| Display | display-xl | clamp(2.75rem, 2rem + 2.6vw, 4rem) / 0.95 | Landing hero, YOU'RE IN, 404 |
| Numeric | score-sm | 1rem | |
| Numeric | score-md | 1.5rem | |
| Numeric | score-xl | clamp(2rem, 1.6rem + 1.6vw, 3rem) | |
| Stage | stage-pin | clamp(5rem, 17vh, 13rem) / 0.9 | |
| Stage | stage-title | clamp(2.25rem, 5.5vh, 4.25rem) / 1.05 | width 85 |
| Stage | stage-url | clamp(1.75rem, 4.2vh, 3.25rem) / 1.05 | Figtree 700 |
| Stage | stage-label | clamp(1rem, 2.2vh, 1.5rem) / 1.1 | Figtree 700, uppercase, +0.08em |
| Stage | stage-name | clamp(0.95rem, 1.9vh, 1.25rem) / 1.1 | Figtree 650 |
| Student phone | PIN digit | 2.75rem `.type-score` in a 52×64 slot | |
| Student phone | buttons | 1.125rem Figtree 700 | |
| Student phone | body | never under 16px | |

- One weight-800+ element per view.
- `tailwind-merge` must register these font-size keys (see foundation).

---

## 4. Space, layout, shape, surfaces

### Space and layout

- Spacing uses an 8px baseline (Tailwind 2/4/6/8/12/16). Side gutter is ≥ 16px.
- Teacher content uses a 12-column grid with max-w 72rem. Layouts are asymmetric: 8/4, 7/5, 5/7. No equal card grids except the quiz library.
- At 390px nothing overflows horizontally. Every grid child that holds text gets `min-w-0`, and grids use `minmax(0,1fr)`.

### Radii

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 3px | Badges, kbd |
| `--radius-sm` | 6px | Inputs, buttons, segmented track; inner segment 4px |
| `--radius-md` | 10px | Panels, dialogs, tiles, sheet top corners |
| full | | Avatars, live dot, switch |

- Legacy re-points: `--radius-lg` 10px, `--radius-xl` 6px, `--radius-2xl` 10px, `--radius-3xl` 10px.
- Nested radius = parent radius minus padding.
- `rounded-[28px]` and `rounded-[2rem]` are removed by the screen tasks.

### Shadows

| Token | Value | Use |
|---|---|---|
| `--shadow-pop` | 0 12px 32px -12px rgb(14 16 19 / 0.28) | Floating layers on paper only: Menu, Dialog, Toast, the editor phone frame |
| `--shadow-press` | inset 0 -3px 0 rgb(0 0 0 / 0.22) | Pressable game objects only: primary button, answer tiles, the PIN Enter button |
| `--shadow-card` | `0 0 #0000` | Legacy, now flat |
| `--shadow-lift` | = shadow-pop | Legacy |

There are **no shadows on night**.

### Surfaces (replacing the single Card)

| Surface | Description |
|---|---|
| **Sheet** | White, 1px `line` border, radius-md, no shadow (default `Card`) |
| **Flat** | paper-sunk fill, no border |
| **Ledger** | No container. A `SectionHead` (3px ink-950 rule plus kicker and title) and hairline rows of 56–72px. Each row has a 4px left status tab (success-600 published / line-strong draft / ink-500 archived / signal-600 live), whole-row link, and paper-sunk 60% hover |
| **Strip** | paper-sunk band split by 1px vertical `line` rules into 3–4 cells: `.type-score` score-xl plus a caption label. It stays 3-up at 390 |
| **Banner** | night-950 block with a 6px signal-600 left tab, used for live sessions and the dashboard Host band |
| **ScoreBug** | night-900, radius-sm, 4px left tab (signal-600 default; ink on paper). Holds PIN, count, n/N or status. No clip-path |
| **LowerThird** | 6px colour tab plus a bar (white on paper, night-900 on night), sharp right edge. Used for name tags, join ticker, toasts, the student link on login and inviter lines |
| **Placeholder** | Hairline-outlined region, kicker "COMING NEXT", one sentence. No button affordance ever |
| **StatusBlock** | 48px square icon tile with a 4px tone tab, then title, body and actions. Left-aligned. Used for every auth, terminal and error state |

### Texture and shape

- **Night grid:** one static, aria-hidden, fixed SVG of a 96px grid of 1px lines at 3% white plus a single 1px horizon line at 4%. It is one layer and never animates. It replaces the pitch drawing.
- **Kit panel:** the full-height column behind each tile's letter chip, in the CSS repeating-gradient classes `.kit-a` to `.kit-d`. The editor answer row reuses it as a 12px left band. Monograms reuse it as a background.
- **Touch:** under `@media (pointer: coarse)` everything interactive is at least 44px. Student primary CTAs are 60px.

---

## 5. Components (src/components/ui)

### Button

- Heights: sm 36 (44 on coarse), md 44, lg 52, xl 60. Radius sm. Figtree 650–700.
- Variants:
  - `primary`: signal-600, white, shadow-press; hover signal-700.
  - `dark`: ink-900 with white text.
  - `secondary`: white with a 1px line-strong border.
  - `ghost`: 44px hit area, paper-sunk hover.
  - `danger`: error-600 fill; reserved for ConfirmDialog.
  - `danger-outline`: error-600 1.5px border, error-600 text, plus an icon.
  - `night`: night-900 fill, 1px night-line, night-text.
  - `night-ghost`: night-muted text, 1px night-line border so it never looks disabled.
  - `volt`: graphite on volt plus shadow-press.
- Press: CSS `active:translate-y-[2px]`, and the inset shadow is removed instantly. Only transform transitions (`--dur-instant`). The JS Button uses the press spring with `y: 2`.
- Disabled never uses opacity. On paper it is a paper-sunk fill with ink-500 text and no shadow. On night it is a transparent fill, a 1px **dashed** night-line border and night-muted text.
- `armed` animation (opt-in prop `wipeIn`): a pseudo-element fill scaleX 0→1 from the left over `--dur-slow` with `--ease-wipe`.
- Loading: the level-meter spinner replaces the label at the same width.

### Inputs

- TextField, PasswordField and TextArea: h-11, white fill, 1px line-strong border. Focus is a 2px signal-600 border plus a 2px offset outline.
- Error: error-600 border, icon and message. **The hint stays** above the error.
- `tone="night"`: night-900 fill, night-line border, night-text, night-muted placeholder, signal-400 focus, error-300 message.
- Optional fields: one pattern, an "Optional" caption right-aligned on the label row.
- The eye toggle is 44px.
- SelectField gets the same borders.
- New `Checkbox`: a 44px row with a 20px box in line-strong and an ink-900 checked fill.

### PinDigits (display) and PIN slots

- `PinDigits {value, length=6, size:'phone'|'bar'|'stage', reveal?}` renders six cells with a 12px gap after digit 3.
- Empty slot: 3px night-line underline. Filled: night-text underline and the digit pops in. Active: a signal-400 underline and a caret bar (opacity steps; static under reduced motion).
- `reveal` runs a one-shot digit drop (y -16→0 plus opacity, 40ms stagger).

### Other primitives

- **Badge:** radius-xs, 12px 700 uppercase, +0.06em tracking.
  - Tones: neutral, signal (LIVE with dot), success, warning, error, info. Legacy aliases flame, mint, sun, rose and dark stay.
  - `surface="night"`: night-800 fill with tinted text.
  - Props: `dot`, `icon`.
- **Card:** `variant: 'sheet'|'flat'|'night'` (default sheet, flat look). CardHeader title uses `text-title` Figtree 650.
- **SectionHead:** `{kicker, title?, action?, tone?}` with a 3px rule.
- **Ledger / LedgerRow:** `{status?, href?/children, actions?}`. Uses the stretched-link pattern for a whole-row target.
- **StatStrip:** `{items:{label,value,href?}[]}`.
- **ScoreBug, LowerThird:** `{tab?, tone?}`.
- **Placeholder, StatusBlock, StepStrip:** StepStrip is the three steps Build / Host / Join with answer-colour tabs that wipe in once; the text is static.
- **Monogram:** `{name, seed, size}`. Hashed answer colour, kit background, initials in `.type-score`. Hash indices stay stable.
- **InitialsStack:** first 4 plus "+N", using real names.
- **CountRoll:** `{value}`. Changed digits roll on translateY with the roll spring; the reduced-motion fallback is a crossfade.
- **BreathingLine:** a 2px line scaleX 0.15↔1 over 2.4s linear. Under reduced motion it is a static line at 40%.
- **AnswerTile:** `{index, label, size:'phone'|'stage'|'compact', state:'rest'|'locked'|'dim'|'correct'|'yourpick', media?}`.
  - Letter chip: Archivo 900 width 75 on a solid square inside the kit panel.
  - Label: Figtree 700 with `overflow-wrap:normal; hyphens:auto`.
- **NightCanvas:** night-950 ground plus the grid SVG plus `pt-safe`/`pb-safe`.
- **ThemeColor:** `{color}`. Sets `meta[name=theme-color]`.
- **Kbd:** chip.
- **UnderlineTabs:** `{options:{value,label,count?}[]}`. A 3px ink bar (signal-400 on night) slides via layoutId. Uses role=tablist or radiogroup, and scrolls horizontally on phone.
- **SegmentedControl:** keeps its layoutId pill, now a flat ink-900 pill with white text (night-800 on night). Segments are 44px on coarse pointers.
- **Switch:** 44×26, ink-900 when on.
- **Dialog:**
  - Paper: radius-md, shadow-pop, 3px ink-950 top rule.
  - `tone="night"`: night-900 with a 1px night-line.
  - Always capped at `max-h-[calc(100dvh-env(safe-area-inset-top)-16px)]` with a scrolling body and a sticky footer.
  - On phone it is a bottom sheet with a 4px grabber. The close button is 44px. `size?: 'md'|'lg'`.
- **Menu:** shadow-pop, items 44px on coarse pointers. Danger items use error-600 and sit below a rule.
- **Alert:** tint plus a 4px left tab in the tone colour. Tones info, success, warning, error. `tone="night"` is supported.
- **Skeleton:** static, no animation. Paper uses paper-sunk with a 1px line inner edge; night uses night-800. `aria-busy` goes on the container.
- **Spinner:** a 3-bar level meter (the LogoMark bars) scaling Y in sequence over 900ms, class `.motion-essential`. Under reduced motion it becomes a stepped-opacity cycle (1.2s, `steps(3)`) plus sr-only text, so loading is never silent.
- **FullPageLoader:** reads `window.location.pathname`. Night routes (`/join`, `/game`, `/presenter`, `/teacher/quizzes/*/preview`) get night-950; all others get paper. It **keeps** `role="status"` and the `aria-label={label}` that `guards.test.tsx` relies on.
- **Toast** (ToastProvider): a LowerThird entering from the left with `slideFromLeft`. On phone it sits above the tab bar.
- **Logo:**
  - LogoMark is an SVG tile with a 10deg cut top-right corner drawn in the path.
  - Bars are #FF7A5C, #F2B100 and #33C47A; the spark is #F2B100.
  - `tone="paper"` gives an ink-900 tile; `tone="night"` gives a night-800 tile with a 1px #646B74 stroke.
  - `Logo inverted` implies night. The wordmark uses `.type-headline` in ink-900 or night-text.
- **ConnectionPill:** `quiet` prop. When healthy it is a 8px success-400 dot plus sr-only text. When reconnecting or offline it expands to a Badge (warning or error, night surface) with a BreathingLine.

---

## 6. Motion

### Tokens

CSS (`:root` for durations, `@theme` for easings):

```
--dur-instant: 90ms; --dur-fast: 140ms; --dur-base: 220ms; --dur-slow: 360ms; --dur-stage: 600ms;
--ease-out: cubic-bezier(0.22,1,0.36,1); --ease-in: cubic-bezier(0.55,0,1,0.45);
--ease-wipe: cubic-bezier(0.65,0,0.35,1); --ease-snap: cubic-bezier(0.2,0.9,0.1,1); --ease-snappy (alias of ease-snap)
```

`src/lib/motion.ts` mirrors these:

- `dur` in seconds, and `ease` as arrays.
- Springs:
  - `press {type:'spring', stiffness:700, damping:40}`
  - `pop {520, 24}`
  - `land {380, 20, mass:0.9}`
  - `sheet {420, 40}`
  - `layout {500, 38}`
  - `roll {600, 38}`
- Variants:
  - `enterUp` (y 8→0, opacity, dur.base, ease.out)
  - `fade`
  - `popIn` (scale 0.4→1, opacity, pop)
  - `slideFromLeft` (x -24→0)
  - `stepSlide(direction)` (x ±24, 220ms)
  - `wipeIn` (scaleX 0→1, origin left, dur.slow, ease.wipe)
- Helpers:
  - `staggerDelay(i)` = min(i, 8) × 0.03
  - `canCelebrate()` = !reducedMotion && (navigator.hardwareConcurrency ?? 2) > 4

### Principles

1. Animate transform and opacity only. Colour changes use a 140ms CSS transition on small elements only. Shadows are never transitioned.
2. Teacher side: enterUp 8px for page content, the nav bar slide, the segmented pill and row hover. Nothing loops.
3. Personality appears on the student's own actions and on projector events. At most one ambient loop per screen, and it is the BreathingLine or the own-avatar bob.
4. Content is never hidden behind whileInView. Use `initial={false}`, or animate only the accent rule.
5. Never use `layout` on lists longer than 12 items. Projector and host crowds append and pop. Leaves fade without reflow.
6. Reduced motion: `MotionConfig reducedMotion="user"` stays. The CSS override becomes `*:not(.motion-essential)`. Pops, slides and wipes become 120ms crossfades. The bob stops. Static elements stay.

### Signature moments today (all real events)

- **PIN slot fill.** Each digit pops (scale 0.6→1, pop) and its underline turns night-text. At 6 digits the Enter CTA arms: the dashed state wipes to a volt fill (scaleX). An invalid PIN gives an x-nudge of ±6px over 2 cycles, then an error LowerThird with an error-300 tab.
- **Step change in the join flow.** A 3px signal-400 step-bar at the top of the viewport scales X 0→1 over 220ms while content uses `stepSlide`. It is non-blocking and replaces the 360ms full wipe.
- **Avatar change.** The preview is keyed by avatar value: the old one goes to scale 0.92 and fades, the new one lands (0.9→1.04→1, land). "Surprise me" rotates its icon 270deg. The selected preset gets a 3px night-text frame via layoutId (not volt).
- **YOU'RE IN.** Plays once per session (sessionStorage flag). The avatar lands from y 24, then the volt bar wipes in behind the "YOU'RE IN" display-xl text, then the name-tag LowerThird slides in. After that, a 6px bob every 3s, paused when `document.hidden`.
- **Roll call** (projector and host). A new avatar runs popIn. Joins are queued at 60ms intervals. A "ADA JOINED" LowerThird ticker shows for 1.6s and collapses to "+N JOINED" when more than 3 are queued.
- **Count roll** on every real count.
- **PIN reveal.** A one-shot digit drop when the projector or host lobby loads, then the signal-400 underline wipes in.
- **Waiting.** The BreathingLine.
- **Copy morph.** The icon changes to a check (pop) and the label reads "Copied" for 1.6s.
- **Invite reveal.** The panel opens scaleY from the top over 220ms; the text fades in after.
- **Publish ready.** At 0 issues a success "READY" tab wipes in. On success the status tab swaps from line-strong to success.
- **404.** The struck-through tile nudges once.

### Reserved for Phase 4/5 (tokens and variants in motion.ts only, no UI)

- **Question kick-off.** The n/N score bug wipes in, then the prompt runs enterUp, then the tiles stagger at 40ms.
- **Countdown.** One bar shrinks with scaleX, linear over the real duration. The last 5 digits pop. Under reduced motion only the numerals change.
- **Lock-in.** The chosen tile scales to 0.96 and gets the yourpick ring; the others go to opacity 0.35. A "LOCKED IN" LowerThird appears.
- **Reveal.** The correct tile scales to 1.04 and a success-400 check stamp pops. A wrong pick goes to answer-dim with the "YOU" tag, no shake and no red. Copy: "Not this time — B was correct". Points use the count roll.
- **Leaderboard.** Manual FLIP on translateY with the layout spring. The projector shows the top 5 only; the student's own rank appears in volt on their own phone only.
- **Podium.** Blocks scaleY from the bottom in the order 3, 2, 1 at stage duration, then avatars land.
- **Streak and achievement.** A volt chip pops, plus a sweep of at most 12 kit flags over at most 1.2s, only when `canCelebrate()`.

---

## 7. Illustration assets (inline SVG or CSS only, under 8KB total)

1. **LogoMark v2.** Updates the favicon (`public/favicon.svg` uses the paper tone).
2. **Night grid SVG.**
3. **Kit classes** `.kit-a` to `.kit-d`.
4. **ScoreBug and LowerThird.** CSS only.
5. **StatusBlock icons.** lucide inside a tone tile.
6. **StepStrip.** CSS and type.
7. **Phone-and-projector diagram** for the join-pin desktop view and landing step 2. Flat rectangles, an empty six-slot PIN and an arrow; about 2KB.
8. **Avatar re-tune** in `src/lib/avatar.ts`, colours only. Array lengths and order are unchanged so stored indices stay valid. Purple-night background and shirt values (#2a2840-family) become graphite #3A3F46. On paper, avatars get a 1px `line` ring. The Avatar component gains `ring?: 'own'` (3px night-text ring).
9. **Placeholder wireframe.** Hairline rows with no values.

---

## 8. Per-screen composition

### landing

**Desktop.**
- Masthead: logo; on the right, a "Got a PIN? Join a game" night ScoreBug link, a ghost "Teacher sign in" and a primary "Create account".
- A 3px rule, then a 7/5 grid:
  - Left: kicker "CLASSROOM QUIZ, LIVE"; display-xl headline "Turn any lesson / into a / rally." with "rally." in signal-600; one body sentence in true present tense ("Build a quiz, put the PIN on the projector, and your class answers from their phones."); primary and secondary buttons.
  - Right: a night-950 "EXAMPLE" frame with a score bug reading "EXAMPLE · Q 1/1", the prompt "Which planet is closest to the sun?", four AnswerTiles (Mercury/Venus/Earth/Mars, no scores), and a timer bar that wipes down once (static under reduced motion).
- "How a round works" strip:
  1. Build: a paper sheet with a ledger snippet.
  2. Project the PIN: a night block with PinDigits "482 913" labelled "example".
  3. Answer on phones: four answer tabs.
- A closing signal-600 band, "Your first game is five minutes away." with a CTA (white text 5.25), then a footer of hairline columns.

**Phone.**
- Header: logo and a single "Sign in".
- A full-bleed night block "GOT A PIN?" with six empty slots and a 60px "Join a game" button linking to /join.
- The teacher pitch: display-xl 2.75rem, two full-width buttons.
- The example frame with 2×2 compact tiles at text-base (no mid-word breaks).
- The steps as a vertical list with colour tabs, then the closing band.
- Everything is visible on first render.

### login

**Desktop (5/7 split).**
- Left: NightCanvas with the night Logo and a ScoreBug "PIN · 6 DIGITS" containing empty slots, with the line "Teachers set the game. Students join with a PIN." Top-aligned on the 8px rhythm.
- Right: paper with the form top-aligned at 18vh.
  - Kicker "TEACHER SIGN IN", display-lg "Welcome back".
  - Fields, then a full-width primary "Sign in".
  - "Forgot password?" as a 44px ghost link right-aligned on the password label row.
  - Below, a night LowerThird link "Student? Join with a PIN →".

**Phone.**
- A 72px night strip: logo plus a 4px stripe of the four answer colours along the bottom.
- The form starts 24px below with no vertical centring.
- The student LowerThird sits directly under the heading, before the fields.

### register

**Desktop.**
- Same frame as login. The aside shows 6 real preset avatars (aria-hidden, no names) on a baseline, captioned "Your students build these when they join."
- Form fields: name, school, email, password, confirm.
- A presentational requirements checklist: ledger rows that tick to success-600 from the existing form values. A confirm-match tick.
- The pending state uses StatusBlock (success tone).

**Phone.**
- Night strip, then the top-aligned form.
- The checklist sits under the password as a two-column list of compact ticks.

### forgot-password

**Desktop.**
- The aside shows a single large D AnswerTile labelled "Back in the game".
- A 44px ghost "← Back to sign in" sits above the heading as a breadcrumb.
- One field and the primary button.
- The sent state is a StatusBlock (info tone) with the non-enumerating copy, entering with enterUp.

**Phone.** Night strip, then the breadcrumb, heading and field, all top-aligned.

### reset-password

**Desktop.**
- Same aside as forgot-password.
- Verifying state: a form-shaped static skeleton plus the caption "Checking your link".
- Invalid state: StatusBlock in error tone, left-aligned, with "Request a new link".
- The form uses two password fields plus the checklist.

**Phone.** Night strip, then the top-aligned form; the StatusBlock is full width.

### not-found (also RouteErrorPage and ConfigErrorScreen)

**Desktop.**
- Rendered inside PublicLayout, so the header and footer stay.
- 7/5 grid:
  - Left: kicker "ERROR 404", display-xl "That page isn't one of the options.", buttons Home (primary) and Join a game (secondary).
  - Right: four AnswerTiles as real links (Dashboard, My quizzes, Join a game, Sign in), and a fifth answer-dim tile with the missing path in mono, struck through, nudging once.

RouteErrorPage uses the same layout with an error kicker and keeps its reload logic. ConfigErrorScreen gets a static version with no Motion and no Router.

**Phone.** The headline, then the 2×2 tiles at 64px, then the dim tile.

### dashboard

**Desktop.**
- Header: kicker with the date; display-lg greeting with the **full** display_name; on the right, "New quiz" (secondary).
- **Host band** (Banner, always present):
  - If an open lobby is available from data already loaded by existing services: a live dot, the quiz title, PinDigits at bar size, "n waiting" with CountRoll, and a primary "Back to lobby".
  - Otherwise: "Ready to run a quiz?" plus a primary "Host a game" linking to /teacher/sessions.
- StatStrip: QUIZZES / PUBLISHED / DRAFTS, real counts, each a link into the filtered library.
- 8/4 grid with items-start:
  - Left: "RECENT QUIZZES" Ledger. Rows have a status tab, title, "n questions · edited 2d ago", and actions Preview, Edit, and Host (published only, opening the existing HostQuizDialog).
  - Right: an "ACCOUNT" column showing only the unconfirmed-email Alert when relevant, then quick links.
- The roadmap and the "phase 3" tile are deleted.
- New teacher: StepStrip plus one Create CTA.

**Phone.**
- Top bar title, then the greeting at 2rem, the full-bleed Host band, and the 3-up StatStrip at 64px tall.
- Recent ledger rows of 64px with a 44px kebab.
- The Home tab is active.

### quizzes

**Desktop.**
- Kicker "LIBRARY", display-lg "My quizzes", primary "New quiz".
- Toolbar: UnderlineTabs "All 4 · Published 2 · Drafts 2 · Archived 0"; the search field on the same baseline; a Grid/List toggle (remembered in localStorage).
- Grid view of Fixture cards in 3 columns:
  - QuizCover band of 72px (cover image or a hashed answer band with its kit), subject kicker, `text-title` title, caption "n questions · edited 2d ago", and the status tab on the left edge.
  - One action: Host (secondary) for published; "Edit" for drafts, plus a warning caption "0 questions" when true. A 44px kebab.
  - Hover: y -2 plus shadow-pop.
- List view: Ledger with columns Title / Subject / Questions / Status / Updated / actions.
- No-results state: a headline line, "Clear search", and a one-line filter explanation.
- Skeletons match the card and row shapes.

**Phone.**
- Ledger rows are the default: 72px, with a colour tab, title, meta, and a trailing 44px Host or Edit text button.
- The tabs scroll horizontally.
- "New quiz" is a 56px fixed button bottom-right above the tab bar (`bottom: calc(var(--tabbar-h) + 16px)`).
- "Published" is used at every width.

### quiz-create

**Desktop.**
- Editor frame on the Details step.
- The title field shows the neutral caption "Name your quiz to save it" and validates on blur or save only.
- One white Sheet with hairline sections: Title, Subject, Description, Cover, Scoring. Speed scoring is an inline Switch row.
- The right preview shows a night "programme cover" with the real title and subject, updating live.

**Phone.**
- Sticky top bar: back, "New quiz", save dot.
- Full-bleed sheet.
- Bottom action bar (56px plus pb-safe): Save (secondary) and "Add questions" (primary). The tab bar is hidden.

### quiz-edit

**Desktop.**
- Toolbar: back, title with SaveState, Preview, Share (both labelled), Save, and Publish (primary, with a success "READY" tab at 0 issues).
- Left rail, 248px, on paper-sunk: rows show number, type icon, a two-line prompt, an issue dot and a 3px signal bar when active. "Add question" at the bottom; new rows wipe in.
- Centre: one Sheet.
  - Question type as SegmentedControl with full labels. The rails are narrower so labels don't truncate at 1440, and short labels apply under 1280.
  - Prompt textarea in 1.125rem.
  - Answer rows: a 12px kit band, the soft tint fill, a 40px letter chip, the input, and a 44px correct toggle that fills success-600 and pops a check. A "CORRECT" success badge appears.
  - Explanation and image below hairlines.
- Right, 340px: the phone frame (shadow-pop) sized to its content, maximum ratio 19.5:9, content centred, plus the Show answer switch.

**Phone.**
- Sticky top bar: back, truncated title, save dot.
- A 44px chip rail that scrolls horizontally (number, type icon, issue dot).
- An Edit / Student view SegmentedControl that swaps the form for the preview.
- Answer rows in `grid-cols-[minmax(0,1fr)]` with `min-w-0`. All controls are 44px.
- A bottom bar with labelled 48px Preview / Save / Publish. The tab bar is hidden.

### quiz-preview

**Desktop (NightCanvas stage).**
- ScoreBug top-left: "Q 2 / 12" in score-md plus the title in stage-name.
- night-ghost "Edit" top-right, with a visible border.
- The prompt in stage-title, left-aligned on 12 columns; media on the right if present.
- 2×2 AnswerTiles at stage size.
- Footer: Previous (night-ghost; disabled uses the dashed style), "Show answer" (night), Next (primary).
- Progress as a segmented bar, the current segment in signal-400 (not volt).
- Kbd chips: ← → Space Esc.
- Show answer uses the reveal tokens.

**Phone.**
- The ScoreBug "Q 2 / 12" is always visible.
- The prompt is 1.5rem.
- Answers are one column of 64px phone tiles at text-lg.
- A bottom bar of 48px Prev / Show answer / Next with pb-safe.
- The empty quiz state is a headline plus an "Add questions" link.

### shared

**Desktop.**
- Kicker "FROM COLLEAGUES", display-lg "Shared with me".
- UnderlineTabs with counts (All · View · Copy · Edit) and search on one row.
- Ledger rows:
  - A 64px QuizCover thumb.
  - Title plus subject.
  - Owner LowerThird ("Mr Okafor · via" plus a Monogram and the workspace name).
  - AccessBadge.
  - One primary action by access (Edit / Copy to My Quizzes / Preview); the rest go in the kebab.
  - The whole row is a link.
- Skeleton rows match. The no-match state includes "Clear filters".

**Phone.** 76px rows: 56px thumb, title, the owner wrapping to two lines rather than truncating, a badge, and one trailing 44px action. Six rows fit per screen.

### workspaces

**Desktop.**
- Header aligned on the baseline; "New workspace" is secondary.
- A Ledger max 760px wide. Each 72px row has a 44px Monogram, the name, a role badge, an InitialsStack, member and quiz counts in score-sm right-aligned, and a chevron next to the content.
- A 4/12 note column: SectionHead "HOW SHARING WORKS" plus text.
- Skeleton rows are 72px.

**Phone.**
- Full-bleed rows. Counts drop to a caption.
- The empty state uses the StepStrip variant (Create / Invite / Share) with one CTA.

### workspace-detail

**Desktop.**
- Header: a 44px back button and the kebab on the top row; a 64px Monogram; the name in display-lg (wraps, never truncates); the meta line "4 members · Created 2 weeks ago" with the role badge inline.
- 7/5 grid:
  - Left: "MEMBERS" Ledger aligned to the header edge. Rows have initials, name, "(you)", joined date, role, and a labelled 44px danger-outline "Remove" for owners.
  - Right: "INVITES".
    - "Create invite link" is secondary.
    - The one-time link panel wipes open as a night ScoreBug with the link in the mono stack, and Copy morphs to a check.
    - The active-invites ledger shows uses and an expiry chip. Revoke opens an inline "Revoke? Yes / Cancel" with a loading state.
- Not-found and error states use StatusBlock.

**Phone.**
- The title wraps at 1.75rem.
- 64px member rows with a 44px kebab containing Remove.
- The invites section sits below, under a SectionHead.

### join-workspace

**Desktop.**
- A 640px column at 20vh: kicker "INVITATION".
- An inviter LowerThird: "{name} invited you", or "A colleague invited you" when invitedBy is empty.
- An 80px Monogram, display-lg name, InitialsStack with count, a paragraph.
- Primary "Join workspace" and ghost "Not now" at the same height with a 12px gap.
- On success the button shows a check over a success fill for 220ms, then the existing navigation and toast run.

**Phone.** Top-aligned; buttons pinned in a bottom action area with pb-safe.

### sessions

**Desktop.**
- Kicker "LIVE", display-lg "Live sessions".
- An open lobby gets a full-width Banner: live dot, title, PinDigits at bar size, "24 waiting" with CountRoll, and primary "Back to lobby".
- 8/4 grid:
  - Left: "READY TO HOST" Ledger. Rows have a hashed colour tab, subject kicker, title, question count right-aligned, and "Shared by Mr Okafor" as a separate caption line. The whole row opens HostQuizDialog. One secondary "Host" button per row (always visible on coarse pointers; on desktop it gets a primary fill on hover).
  - Right: "RECENT" ledger with relative time always visible and a neutral "Closed" badge. A Placeholder line: "History arrives with live games".
- HostQuizDialog: the player limit as a SegmentedControl (10/20/30/50/100) and a mini night ScoreBug preview with "––– –––" (not a real PIN).

**Phone.**
- A full-bleed Banner (PIN in score-md).
- 72px rows with a 44px Host button.
- Recent sits behind a disclosure.
- The Live tab is active.

### host-lobby

**Desktop.**
- A sticky night-950 Command Bar:
  - ScoreBug with PinDigits at bar size and score-xl, tap to copy with the copy morph.
  - The join URL.
  - CountRoll "24 / 50".
  - Lock as a SegmentedControl "Open / Locked" (night).
  - A night "Open projector view" button.
  - The quiet ConnectionPill.
- Paper below, 8/4 grid:
  - Left: "PLAYERS" crowd of frameless 64px avatars with name tags.
    - Hover or focus reveals a 44px remove button. Click selects an avatar and shows a contextual "Remove Ada" bar.
    - popIn queue; no layout prop.
    - Empty crowd: BreathingLine plus "Waiting for the first player — share the PIN above."
  - Right: the QR at 200px on white with the caption below.
    - Placeholder "COMING NEXT · Game controls arrive with live games" (no button).
    - An "END SESSION" SectionHead with danger-outline "Close lobby".

**Phone.**
- A sticky compact bar: PIN at score-md, the count, and a Lock Switch.
- A "Join details" button opens a sheet with the QR, copy link and projector button.
- The crowd is a 4-column grid of 56px avatars with names. Tapping selects and shows a bottom "Remove" bar.
- The danger zone is last.
- About 1.2k px tall at 24 players.

### history-upcoming

**Desktop.**
- A 640px column: kicker "COMING NEXT", display-lg "Quiz history", "Arrives after live games launch."
- A ledger of planned items with hollow circle markers.
- A hairline Placeholder wireframe of a results table labelled "PLANNED", with no values.
- The nav badge reads "Planned".

**Phone.** Same content full width; the wireframe shows three rows.

### profile

**Desktop.**
- Identity header: 3px rule, a 72px Monogram (ink tile with a signal tab), display-lg name, school and email in caption, and "This is how colleagues see you in shared quizzes."
- One Sheet with sections on a 4/8 internal grid: DETAILS (name, school, read-only email with explanation) and PASSWORD. Both submits are primary; disabled is the neutral state.
- A final SESSION section with a secondary "Sign out".
- The duplicate "Profile" heading is removed.

**Phone.** Compact header with a 48px Monogram; sections stacked with labels above fields; Sign out last.

### presenter

**Projector** (1440×900, 1920×1080, 1024×768): h-dvh, never scrolls, NightCanvas.
- Header:
  - Left: a ScoreBug with the night LogoMark and the title in stage-title, night-text, wrapping to 2 lines.
  - Right: fullscreen control and the quiet ConnectionPill.
- Left 5/12, one fused Join panel:
  - stage-label "JOIN AT", the URL in stage-url.
  - PinDigits at stage size (stage-pin, 17vh) with reveal and the signal-400 underline wipe.
  - A white QR (24vh) with "Scan to join" beside it on one line.
- Right 7/12, the crowd:
  - A ScoreBug "24 PLAYERS" with CountRoll.
  - Frameless avatars with stage-name labels, sized by real count: 112px under 16, 88 under 32, 68 under 60, 52 up to 100.
  - No layout prop; the 60ms queue; a join-ticker LowerThird at the bottom.
- 0 players: "Grab your phone" in stage-title with "← the PIN is on the left", plus the BreathingLine under the PIN.
- Locked: a chalk (night-text) plate with ink text, a lock icon and "LOCKED", wiping in.
- At 1024×768 (4:3) the join panel becomes the top band and the crowd sits below.

**Phone (edge case).** The panel stacks above a 4-column crowd at 52px; the title wraps.

### join-pin

**Phone.**
- NightCanvas with theme-color #0E1013.
- A non-link LogoMark.
- Content top-aligned at 12vh: kicker "GAME PIN", display-lg "Join a game".
- Six 52×64 slots overlaid on the real single input.
- A 60px CTA in the dashed "not yet" state that wipes to volt ("Enter") at 6 digits.
- Errors appear as an error LowerThird plus the x-nudge.
- A 44px ghost "Teacher? Sign in" at the bottom with pb-safe.

**Desktop.** 5/7 split: the form column on the left; the phone-and-projector diagram on the right with the caption "The PIN is on your teacher's screen".

### join-profile

**Phone.**
- Top: a ScoreBug strip with a 44px "Different PIN" back control and the quiz title (2 lines).
- Hero: a 168px avatar on a night-800 disc, keyed for the land animation. A live name-tag LowerThird below it (night-900 bar, night-text tab), exactly as the projector will show it. "Surprise me" as a 48px round night button overlapping the bottom-right of the disc.
- Nickname field in the night tone with a "7/16" counter on the label row; the hint stays alongside any error.
- Builder:
  - UnderlineTabs at 44px.
  - Presets as a 2-row horizontal snap scroller of 64px tiles.
  - Swatches at 44px with descriptive aria-labels ("Skin tone, deep brown").
  - Shapes in a 4-column grid with 13px labels.
- A sticky solid night-950 bar with a top rule and the volt "Join game" xl button. Content padding-bottom equals the bar height. The page is about 900px tall.

**Desktop.** 5/7 split. Left (sticky): a 240px preview, name tag, nickname and CTA. Right: the builder with an 8-column preset grid.

### player-lobby

**Phone.**
- NightCanvas.
- Top ScoreBug: quiz title, quiet ConnectionPill, and CountRoll "24 IN".
- Centre:
  - The own avatar at 200px with `ring="own"` landing.
  - The display-xl "YOU'RE IN" on the volt bar, first time only.
  - The name-tag LowerThird.
  - "Look for your name on the big screen", then the BreathingLine.
- Actions 32px under the content (not pinned): "Change look" (night) and "Leave" (night-ghost, keeps its confirm), both 52px.
- Change look opens a night Dialog sheet with max-h, scrolling, the dark AvatarBuilder and a sticky Save.
- Copy while the game is in progress: "Get ready — the game is starting".
- Terminal states:
  - Game ended: avatar, neutral headline, "Join another game".
  - You left: desaturated avatar (CSS `grayscale` is static, not animated).
  - Removed: neutral, no red.
  - Can't reach: StatusBlock with a wifi-off tile and Retry.
  - Loading: a static avatar-disc skeleton plus "Joining {quiz}".
- The logo is non-interactive.

**Desktop.** A 560px centred column, the avatar at 240px, actions directly under the name tag, the grid texture behind.

---

## 9. Accessibility rules

- Text ≥ 4.5:1 and control edges ≥ 3:1. Enforced by the token-pair test.
- Colour is never the only cue. Answers carry letter plus kit plus position. Status carries text plus tab. Danger carries icon plus outline.
- Touch targets ≥ 44px on coarse pointers. Student primary CTAs are 60px.
- Focus: a 2px signal-600 ring (signal-400 on night) with 2px offset, everywhere.
- Every Dialog and drawer traps focus, closes on Escape and restores focus.
- aria-live on CountRoll and on the SaveState. role=status on the loader and the ConnectionPill.
- Reduced motion per section 6. Loaders stay communicative.
- Body text minimum 13px on teacher screens and 16px on student screens.
- No horizontal overflow at 390px.
- The projector never uses rotated text.
- Decorative avatars, grid and diagrams are aria-hidden.

## 10. Reserved for Phase 4/5 (tokens and variants only; no fake UI now)

- Answer press, dim, correct and yourpick states.
- success-400 correct and answer-dim miss.
- Rank gold, silver and bronze.
- Volt own-rank.
- Motion variants: kickoff, countdown, lockIn, reveal, leaderboardFlip, podium, celebrate (gated by `canCelebrate()`).
- Stage typography tokens.
- The ScoreBug "Q n/N" and timer slot.
- The LowerThird "LOCKED IN".

No leaderboard, podium, achievement or streak UI is rendered anywhere until those phases ship.
