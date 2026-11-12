# Monster Generation Engine: audit and plan

Status: **phases 1–6 built** (data model, catalogue, generator, compatibility rules, server storage,
difficulty, the drawn bodies and asset registry, the state machine and animations, battle integration, teacher controls). Phases 7–8 were skipped by decision (2026-11-12): the
monster is stored with the session and sent in the existing game state, so reconnects already show
the same monster; no extra scale testing was run for the engine.

## 1. What already existed (audit)

| Area | Where | What it does |
|---|---|---|
| Battle state | `session_battles` (migrations 2026111[3-7]) | One row per session: monster key, HP, intensity preset, class targets and healing per mode, timers, weapons, energy, team abilities |
| HP and damage | `private.resolve_battle` (trigger on question close) | Server-authoritative, exactly once per question; modes Normal → Rage → Enraged by HP %; special attack stopped or healed by class accuracy |
| Realtime | `private.game_payload` → one `state` broadcast per transition | No per-frame traffic; screens animate locally from the state |
| Monster | `lib/battle/monster.ts`, `components/battle/Monster.tsx` | One monster (Gloomjaw), one SVG body; name and special attacks hard-coded on the client |
| Animations | `styles/battle.css`, `lib/battle/choreography.ts` | Monster actions (idle, taking, hit, stagger, charge, heal, stunned, brewing, defeat), deterministic attack timeline, class formation |
| Avatars | `components/avatar/Hero.tsx`, `lib/battle/formation.ts` | Full-body students in a honeycomb; 30 typical, 100 tested |
| Learning | `session_questions.objective/topic/difficulty` | Objectives and topics per question (used for the weakness) |

The engine extends these; it replaces none of them.

## 2. Architecture

- **Identity vs. fight.** `MonsterSpec` (lib/monsters/types.ts) is *who* the class fights: archetype,
  rig (body), element, name, title, rarity, personality, movement, body parts, palette, abilities
  (primary, defence, special per mode), weakness (element + one of the quiz's own topics). The
  *fight* (HP, damage, modes, results) stays on the server exactly as before.
- **Configuration, not code.** Archetypes (`archetypes.ts`) list their allowed elements, part pools,
  per-element part rules, personalities, name pieces, title nouns, ability builders, animation set
  and rarities. Elements (`elements.ts`) give palettes, words and weaknesses. Named monsters
  (`catalogue.ts`) fix an archetype, element, name and look. Adding a creature = adding an entry.
- **Generation** (`generate.ts`): seeded and deterministic; picks only from the archetype's pools,
  so results are coherent (no fire sea serpent, no winged golem, no stomping ghost). Modes: random,
  teacher's pick, surprise boss (rarer look, never harder). `monsterProblems()` checks any spec.
- **Storage.** The lobby stores the generated spec on `session_battles.monster_spec` through
  `set_battle_monster` (host only, lobby only, validated by `private.clean_monster_spec`). It is
  locked when the game starts, so reloads and reconnects show the same monster; every screen reads
  it from the existing game state. A missing or unreadable spec falls back to the catalogue monster
  named by `monster`, then to Gloomjaw (`resolveMonster`): the quiz never stops over a monster.
- **Difficulty** is a session setting (auto, easy, medium, hard, epic), separate from the monster
  and from rarity. It sets the intensity preset (class targets, healing), the rage thresholds (epic:
  75 % / 40 %) and scales automatic HP (×0.85 / 1 / 1.15 / 1.3). Auto resolves at the start from the
  quiz: mostly-hard questions → easy; a long mostly-easy quiz → hard; otherwise (and for untagged
  quizzes) medium, which is identical to the previous behaviour. A teacher's own HP and hand-tuned
  settings are never overridden.
- **No AI or image service at play time.** Everything is code and SVG/CSS, loaded with the app.

## 3. Phases

| # | Phase | Status | Contents |
|---|---|---|---|
| 1 | Data model and archetype catalogue | ✅ built | Types; 10 elements; 20 archetypes across the brief's families; 28 named monsters; personalities with short reaction lines; migration `20261119090000_monster_engine.sql` (`monster_spec`, `difficulty`, `difficulty_resolved`) |
| 2 | Procedural generation and compatibility | ✅ built | Seeded generator (random / pick / surprise), weakness from quiz topics, content-derived ids, validator; server validation and locking; difficulty presets, auto resolution and HP scaling; screens read the monster's name and specials from the spec |
| 3 | Asset registry and visual rendering | ✅ built | Nine SVG bodies (`components/monsters/rigs`: dragon, caster, golem, brute, undead, wraith, serpent, beast, phoenix) drawn from each monster's parts and painted only with its palette variables (`lib/monsters/colour.ts`, `styles/monsters.css`); every existing battle action and stage works on every body; registry (`components/monsters/registry.ts`) and optional painted art per state (`lib/monsters/art.ts`), falling back state → idle art → body → Gloomjaw, with an error boundary; the arena, announcement, HUD strip, result and climb board draw the session's monster; teacher page **Monsters** (`/teacher/monsters`) to browse the catalogue, roll random monsters or surprise bosses and preview every stage |
| 4 | State machine and animations | ✅ built | `lib/monsters/motion.ts`: states idle, preparing, attacking, damaged, defending, recovering, rage, enraged, weakened (≤ 15 % HP), stunned, defeated, worked out on every screen from the server's HP and mode plus the arena's action; each archetype's named motion per state resolves to a body motion (`mm-…` keyframes) and an effect (`components/monsters/MonsterFx.tsx`: breath, spell bolt, shock rings, slash, gaze beam, shield, healing, charging energy, runes, debris, feathers, smoke, falling pebbles, dust, sparks, sweat), unknown names fall back to the state's default; personality sets the pace of loops; the arena's hit jitter and knock-back timing kept; body parts react (wings raise to shield, droop when weakened, rune circles, glowing fists); defeats hold a visible final frame; reduced motion shows still frames; behaviour preview on the Monsters page |
| 5 | Battle integration | ✅ built | Arena timeline: a monster that is winning (special not stopped) defends while the hits land, gathers itself (prepare), then counter-attacks; one personality line per question from the real result (`lib/monsters/reactions.ts`: defeated, weakened, comeback, strong or weak round; a bad round makes it gloat about its luck, never call the class weak) in a speech bubble; a class weapon of the element it fears is shown as super effective; its weak-spot topic (from the quiz) flagged on the projector HUD, phones and the teacher's bar; it rises from the ground on its first announcement with its intro line and what it fears; the result card gives its last words; in the lobby it waits on the camp horizon as a silhouette rimmed with its glow. Thematic only: HP and damage unchanged on the server |
| 6 | Teacher controls | ✅ built | Host lobby, Boss battle section: the session's monster with its body, element, rarity, personality and weakness (`components/battle/MonsterPicker.tsx`); New random monster, Surprise boss, Choose… (the catalogue by family, current one marked); a new session rolls its own random monster once when the lobby opens (the default stays if that fails); weakness topics come from the quiz (`hooks/useQuizFacts.ts`); Difficulty (Auto, Easy, Medium, Hard, Epic) replaces the intensity buttons, Auto previews what it will be for this quiz and the HP estimate includes it (`lib/monsters/difficulty.ts`, mirrors the server); everything locked once the game starts (server-side) |
| 7 | Realtime and reconnect | skipped (covered by design) | Spec stored in the session and sent in the existing state; check reconnect paths on every screen; events derived from state changes (spawned, attack started, damaged, rage, weakened, defeated) without new channels |
| 8 | Scale testing | skipped | DB simulation with 30 and 100 participants across a full quiz; render checks of the arena at 100 |

## 4. Decisions to confirm

- **Renamed examples.** Frostmaw → Rimemaw, Dreadwing → Duskwing, Stormscale → Thunderscale (the
  originals match well-known characters or places in other franchises).
- **Difficulty replaces the intensity buttons** in Phase 6 (Easy ≈ Gentle, Medium ≈ Standard, Hard and
  Epic ≈ Fierce); Advanced settings stay for fine-tuning.
- **Weakness is thematic** until Phase 5 decides whether weakness-topic questions should also deal
  extra damage.
