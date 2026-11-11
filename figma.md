# Rally: complete visual redesign brief for Figma

> **How to use this file.** Give the whole document to a designer, or paste it into an AI design
> tool such as Figma Make. It describes every screen, state and interaction of the app as it works
> today, so the design can change *how things look* without losing *what they do*. Section 10
> lists what the finished Figma file must contain so the design can be rebuilt in code
> (React + Tailwind + SVG/CSS) screen by screen.

---

## 0. The prompt (copy this part into the design tool)

Design a complete, original visual redesign of **Rally**, a live classroom quiz game in which a class of up
to 100 students fights a boss monster together by answering questions. It has three audiences and three
surfaces:

1. **Teachers** on a laptop (1440×900): they build quizzes, run live sessions and see reports.
   The tone is calm, editorial and trustworthy.
2. **The projector**, the classroom screen (1920×1080 and 1024×768): one big shared fantasy-arcade world
   with a monster, the whole class as characters, weather that follows the battle, and cinematic moments.
   It must be readable from the back of a classroom.
3. **Students** on phones (390×844 and 360×740): they join with a PIN, answer, vote, use power-ups and
   send emotes. The screens are thumb-sized, fast and rewarding, and must work on cheap Android phones.

The art direction is "**a polished fantasy arcade game inside a serious classroom tool**":
- expressive 2D characters, layered parallax landscapes and readable game UI;
- selective glow and lighting, chunky friendly shapes and strong hierarchy.

It must not look like Kahoot or any other quiz brand, and must not look like a generic AI dashboard.
Avoid repeated purple gradients, glassmorphism everywhere and template card grids. Every screen must keep
the functions listed below. Produce a design system (variables, type, components with variants) and every
screen in every state listed, at the frame sizes given.

---

## 1. What Rally is (context for the designer)

- **Flow:** a teacher creates a quiz, then starts a live session. The projector shows a PIN and QR code.
  Students join on their phones with a nickname and an avatar they build, and wait in a lobby where their
  characters walk around a camp. The teacher presses Start.
- **Each question:**
  1. A short "get ready" countdown. Sometimes there's an announcement first: a new level, the monster
     changing mood, a review before a recovery question, or the power-up draft.
  2. The question appears on every screen at the same moment, with a timer.
  3. Students answer on their phones (multiple choice up to 4, true/false, or picture answers).
  4. The **reveal** shows the correct answer, how many picked each option, the explanation, and the most
     common mistake.
  5. In a **boss battle**, every student who answered correctly attacks the monster. Projectiles fly, the
     HP drops, and the monster may counter-attack and heal if too few were right.
  6. If at least 90% were right, the class **unlocks a weapon** and votes for one.
  7. A **leaderboard** shows the top 10 climbing a cliff toward the monster's lair.
- **Learning features:** questions have levels (1, 2, 3 and a final challenge). If the class misses the
  mastery bar (75%), a review and a parallel **recovery question** follow.
- **Before the final challenge** every student picks one of three **power-ups**. The class also earns
  shared **team energy**, which the teacher spends on **team abilities**.
- **The end:** a podium, the battle result (monster defeated or escaped), and for the teacher a learning
  report per objective.

Real names and numbers to use in mockups:
- Quiz "Solar System Basics", 10 questions. Question: "Which planet is the largest in our solar system?",
  answers Jupiter / Saturn / Neptune / Earth, 27 of 30 correct (90%).
- Monster "**Gloomjaw, the Riddle Eater**", 630 HP.
- PIN 482 913, 30 players.
- Students named "Ada", "Kwame", "Zoë", "Priya S", "Mateo"… (2–16 characters).

---

## 2. Hard rules (the design must respect these)

**Function**
1. Every button shown must do something real. Never design decorative controls that look clickable.
2. The server is the source of truth. Screens show what the server says (scores, HP, votes, damage).
   Design for real states only: loading, empty, error, live, reconnecting.
3. Answer positions are fixed: A top-left, B top-right, C bottom-left, D bottom-right. Each answer has a
   letter, a colour **and** a pattern, so colour is never the only cue.

**Privacy and fairness**
4. Never shame students. Nobody outside the top 10 is named on the projector. Wrong answers are never
   attributed to a person on shared screens; only counts appear ("11 of 30 picked B").
5. Students who missed a question cheer the attackers. They never look sad or defeated.

**Readability**
6. Projector text must be readable at 8 metres:
   - the question is at least 48px at 1080p;
   - names are at least 22px;
   - numbers are large and tabular.
7. On phones: body text at least 16px, touch targets at least 48px, and one hero action per screen.
8. Contrast is at least 4.5:1 for text and at least 3:1 for control edges and meaningful graphics.
9. Every animation needs a calm reduced-motion version (designed as a static frame).

**Production limits**
10. Everything must be buildable in SVG and CSS:
    - flat or gradient vector art with layered shapes;
    - no photographs and no 3D renders;
    - illustrations should export cleanly as SVG.
11. Free fonts only (Google Fonts or open-source).

---

## 3. Visual direction

### 3.1 Three surfaces, one family

| Surface | Where | Mood | Today |
|---|---|---|---|
| **Paper** | Teacher and public pages | Calm editorial desk: warm off-white, ink text, one signal accent | `#F6F4EF` paper, `#121214` ink, `#C8361A` signal |
| **Night** | Student phones, full-screen preview | Dark, focused, game-like | `#0E1013` canvas, `#1A1D21` panels |
| **World** | Projector | An illustrated fantasy landscape whose weather changes with the battle | Parallax hills, sky, moon |

You may change every colour, font and shape. Keep the three-surface idea and keep the paper and night
surfaces visibly part of the same brand as the world.

### 3.2 The world: four moods (design all four)

Mood follows the monster's HP. It applies to the projector backdrop and, as a tint, to phones.

| Mood | When | Sky | Particles | Extra |
|---|---|---|---|---|
| **Calm** | Lobby, HP above 70%, no battle | Dusk blue and violet | Twinkling stars | Crescent moon |
| **Rage** | HP 31–70% | Red-orange sunset | Embers rising | Orange moon |
| **Enraged** | HP 1–30% | Dark crimson storm | Embers | Lightning flicker every few seconds |
| **Victory** | Monster defeated | Dawn: indigo to pink to gold | Sparkles | Golden sun |

Three layers of hills drift slowly (parallax), and a dark veil keeps text readable on top.

### 3.3 Typography (current; may be replaced)

- **Display:** Archivo Variable, condensed (width 75 for numbers, 85 for words, weight 850–900).
- **Body and UI:** Figtree Variable.

Requirements:
- tabular numbers for every score, HP, timer and count;
- a minimum UI size of 13px;
- a projector type scale based on viewport height (`vh`).

### 3.4 Answer colours (keep four distinct, accessible hues)

| | Name | Fill | Pattern on the letter panel | Text |
|---|---|---|---|---|
| A | Cobalt | `#3B5BEA` | Solid darker panel | White |
| B | Pine | `#0A7A6E` | 45° hatch | White |
| C | Berry | `#B8285F` | Dots | White |
| D | Amber | `#F2B100` | Horizontal hoops | Dark ink |

---

## 4. Design system deliverables

Build these as **Figma variables and components with variants**. Use variant names that match the code
names in brackets, so they can be mapped one to one.

### 4.1 Variables

- **Colours:**
  - paper, night and world sets;
  - answer A–D, each with fill, press and soft;
  - success, warning, error and info;
  - ranks (gold, silver, bronze);
  - mood colours (sky stops, hills, orb and particle for each mood);
  - energy (yellow);
  - weapon art colours.
- **Type:** caption, body-sm, body, label, title, headline, display-lg, display-xl, score-sm, score-md,
  score-xl, stage-pin, stage-title, stage-url, stage-label, stage-name.
- **Space:** 4px grid, with 8px steps for layout.
- **Radius:** xs 4, sm 8, md 12, lg 20, full.
- **Shadows:** a "press" shadow for physical buttons and tiles, a "lift" shadow for sheets, and a "glow"
  for game elements.
- **Motion tokens** (documented as text): fast 120ms, base 200ms, slow 400ms, the springs (press, pop,
  land, layout) and the stage stagger of 80–120ms.

### 4.2 Base components (paper and night versions where noted)

| Component | Variants and states |
|---|---|
| Button [Button] | primary, secondary, ghost, danger-outline, night-ghost · sizes sm/md/lg/xl · default/hover/pressed/disabled/loading · optional left icon |
| Text field [TextField] | default/focus/error/disabled · hint · character counter · paper/night |
| Text area [TextAreaField] | with counter ("0/500") and the "Optional" tag |
| Select [SelectField] | with a leading icon |
| Switch [Switch] | on/off/disabled, label and description |
| Segmented control [SegmentedControl] | 2–4 options with a sliding pill, paper/night |
| Checkbox, Radio (correct-answer toggle) | checked/unchecked |
| Badge / Status [Badge, StatusBadge] | draft, published, archived, live, finished, cancelled |
| Alert / Banner | info, warning, error, success |
| Dialog / Confirm dialog | default and danger confirm |
| Toast | success, error, info |
| Menu (overflow "…") | items with icons; a destructive item |
| Tabs [UnderlineTabs] | |
| Score bug [ScoreBug] | the broadcast-style chip: coloured tab plus content ("Q 4 / 10", "12/30 ANSWERED") |
| Lower third [LowerThird] | a broadcast banner ("Locked in · waiting for the others") |
| PIN digits [PinDigits] | stage size, phone input slots (6 digits, grouped 3+3) |
| Count roll [CountRoll] | animated number |
| Kbd [Kbd] | key cap ("Space", "→") |
| Connection pill [ConnectionPill] | live / reconnecting / offline |
| Spinner, skeleton, empty state, status block | |
| QR code frame | white tile with a quiet zone |
| Answer tile [AnswerTile] | A–D × rest / yourpick (ring plus "YOU") / correct (tick plus glow) / dim / locked / removed (Knowledge Reveal) · sizes phone/stage/compact · text or picture |
| Timer ring [TimerRing] | full → empty, with a red last-5-seconds state |
| Countdown bar [Countdown] | phone |

### 4.3 Game components

| Component | Variants |
|---|---|
| **Avatar head** [Avatar] | Built from 9 parts: skin (8), hair style (10), hair colour (8), eyes (6), mouth (6), shirt style (6), shirt colour (10), extra (6: glasses, shades, freckles, blush, headphones), background (8). Moods: neutral, happy, laugh, surprised, angry, dizzy, sad, confused |
| **Avatar builder** [AvatarBuilder] | A part picker with tabs, swatches, a randomise button and a live preview |
| **Hero (full body)** [Hero] | Head on a body (skin tone and shirt colour from the avatar) · poses: idle, attack (overhead swing), cheer (arms up), brace (shielding), climb, fall (comic flail) · optional weapon in the right hand · optional rank ring (gold/silver/bronze) |
| **Monster: Gloomjaw** [Monster] | An original one-eyed horned blob. Stages: calm (violet), rage (orange, steam, angry brow), enraged (crimson, glowing cracks), defeated (grey, X eye, slumped). Actions: idle, taking hits (flicker), hit, stagger (knock-back), charge (wind-up), heal (green glow), stunned (stars circling), defeat (fall), brewing (pulse while charging a special) |
| **HP bar** [HpBar] | Bar plus a trailing "damage" ghost bar · colour by stage (green/amber/red) · numbers "459 / 630 HP" · sizes sm/md/stage |
| **Battle strip** [BattleStrip] | Monster mini, name, stage badge, HP bar, energy bar, note line ("⚡ Riddle Roar charging · 18 of 30 correct needed · Time Warp +5 s") |
| **Energy meter** [EnergyMeter] | 0–100, a spark icon, the number |
| **Weapon icon** [WeaponIcon] | 6 original weapons, each with its own silhouette: Thunder Blade (sword with lightning), Inferno Staff (staff with flame), Frost Hammer (ice hammer), Shadow Bow (recurve bow with arrow), Crystal Spear (crystal tip), Healing Wand (heart gem) |
| **Weapon card** [WeaponCard] | Icon tile, rarity chip (rare/epic/legendary), name, description, "Always:" passive, special name with charges, a vote bar plus count, states: offered / out of runoff / winner / with "Choose for the class" button · stage and phone sizes |
| **Rarity chip** | rare (sky), epic (violet), legendary (gold) |
| **Power-up card** | 8 icons: Thunder Strike, Guardian Shield, X-Ray Vision, Time Warp, Revival Crystal, Weakness Scanner, Team Heal, Comeback Charge · states: offered, chosen (tick), held (with Use button), armed, used, with hint |
| **Team ability button** | Team Shield 30, Group Lightning 40, Knowledge Reveal 25, Final Rally 60 · enabled / disabled-with-reason / armed |
| **Projectiles and effects** | bolt, orb, star, slash, fire, ice, arrow, crystal · impact spark · damage number "−3" · big total "−81" · "+32 HP" heal · shock wave · white flash |
| **Banners on the arena** | special stopped (green), special hit back (red), weapon effect line, team line (energy gained with reasons), "90% correct: weapon unlocked!" (gold, shining) |
| **Emote** [EmotePanel] | 20 emotes in 3 tabs (Emoji, Feelings, Moves) · rate-limited state "Wait 3 s" · "Sent!" · disabled state |
| **Reaction bubble** [ReactionLayer] | Avatar plus emoji plus name floating up a lane on the right edge of the projector · burst state "3 players · 🎉" |
| **Phase wipe** [PhaseWipe] | Ink brush (into a question), slash (into the reveal), dust (into the leaderboard), light burst (into the podium) |

---

## 5. Screens: what each one must do

For every screen, design the default state plus each listed state. Paper screens sit inside the teacher
shell unless marked otherwise.

### A. Public and sign-in (paper, 1440 and 390 widths)

**A1. Landing (`/`)**
- **Hero:** "Turn any lesson into a rally." Explains: build a quiz, put the PIN on the projector, the
  class answers on phones.
- **Primary actions:** "Got a PIN? Join a game" for students, plus "Teacher sign in" and "Create account".
- **Sections:** how it works (3 steps), the boss battle (monster plus class), the learning features
  (levels, recovery, reports), privacy ("no student accounts, no tracking").
- **Footer.**

**A2. Sign in (`/login`):** email, password, "Forgot password?", errors (wrong details, too many tries),
loading.

**A3. Create account (`/register`):** display name, school (optional), email, password with a live
checklist (length, number, letter), terms note; states for a taken email and for "check your email".

**A4. Forgot password and A5. Reset password:** sent state, invalid or expired link state, success.

### B. Teacher area (paper)

**B0. Teacher shell:** the sidebar is the app's left navigation.
- **Items:** Dashboard, My Quizzes, Live Sessions, Quiz History (**"Planned"** tag, leads to a coming-soon
  page), Shared with Me, Workspaces, Profile.
- **User block:** initials, name and email, with sign out.
- **Mobile:** a top bar with a menu sheet.

**B1. Dashboard:**
- greeting, quick actions (New quiz, Host a quiz);
- recent quizzes, live or recent sessions;
- an empty state for new teachers.

**B2. My Quizzes:**
- grid and list of quiz cards: cover, title, subject, question count, status badge, updated time;
- filters: All, Draft, Published, Archived, plus search;
- each card's menu: Edit, Preview, Host, Duplicate, Share, Archive/Restore, Delete (confirm);
- empty state and a quota warning (500 quizzes).

**B3. Quiz editor (`/teacher/quizzes/:id/edit`)**

Three columns: the question list, the editor, and a live phone preview.

- **Top bar:**
  - back, title, status badge;
  - save state: "Unsaved changes", "Saving…", "All changes saved";
  - Preview, Share, Save, and a menu (Publish/Unpublish, Duplicate, Delete).
- **Left column:**
  - "Quiz details";
  - the numbered question list with type icon, a dot for problems and drag to reorder;
  - "Add question" with a type choice (Choice, True/False, Pictures);
  - a "3 / 100 questions" count.
- **Quiz details panel:** title, description, subject, cover image, speed scoring switch.
- **Question editor:**
  - header "Question 1 of 3" with move up/down and a menu (duplicate, delete);
  - question type segmented control;
  - question text with counter and an optional image;
  - answers: 2–4 rows, each with letter, text (or picture), a correct toggle and remove; "Add answer";
  - time limit (5–120 s) and points (standard, double, none);
  - explanation (optional, 500 characters);
  - "Before publishing" warnings.
- **Learning section** (collapsible, "Learning (optional)"):
  - level (Level 1, 2, 3 or Final) and difficulty (Easy, Medium, Hard);
  - kind of question with a suggested time ("Predict the output (~30 s)"), plus the hint "Suggested time:
    30 s (yours: 20)" with a "Use 30 s" button;
  - learning objective with a hint, and topic;
  - "Why might someone pick a wrong answer?": one note field per wrong answer;
  - **Recovery question:**
    - collapsed: an "Add a recovery question" button;
    - expanded: a sub-form with question text, 2–4 text answers (letter as the correct toggle, a "Why pick
      it?" field per wrong answer, remove, add), time limit, explanation, and Remove.
- **Phone preview:** the student phone screen for the selected question, with a "Show answer" switch.
- **States:** revision conflict ("Someone else saved…" with Reload), publish blocked with a list of
  problems, read-only (shared with view access).

**B4. Quiz preview (full-screen night):** step through the questions as a student, then as the projector.

**B5. Shared with Me:** quizzes shared through workspaces, with an access badge (view, copy, edit), owner
name, workspace, and "Copy to my quizzes".

**B6. Workspaces:** list of workspaces with role and member count; Create workspace.

**B7. Workspace detail:** members (owner can remove), invite link (create, copy, revoke, expiry), shared
quizzes, rename, leave, delete (confirm).

**B8. Join workspace (`/invite/:token`):** preview the workspace (name, owner), Accept; states for invalid,
expired, already a member and signed out.

**B9. Live Sessions:** list of sessions with quiz, PIN, status (lobby, live, finished, cancelled), players,
date; open or host again.

**B10. Profile:** display name, school, email (read-only), password change, sign out.

**B11. Coming soon page** (for "Quiz History").

### C. Hosting a live session (teacher laptop, paper and night)

**C1. Host quiz dialog:** pick a player limit (2–100), then Start session, which opens the lobby.

**C2. Host lobby (`/teacher/sessions/:id`, status: lobby)**
- **Top (night) band:**
  - large PIN "482 913", the join URL with "Tap to copy link", QR toggle;
  - player count "30/100";
  - Open/Locked segmented control;
  - connection pill;
  - "Start game" (primary) and "Open projector view".
- **Left:**
  - the playground panel (animated characters walking in the camp);
  - "Select a player to remove them";
  - a grid of player tiles (avatar plus name) with a remove confirm.
- **Right:**
  - "Scan to join" QR;
  - **Start**: ready count text, "Start game", the Reactions on/off toggle.
  - **Learning**: Mastery check switch with a description; mastery bar % and review seconds with Save.
  - **Boss battle**:
    - battle switch with a description;
    - Monster HP: Automatic ("About 630 HP for 30 players and 10 questions…") or "Set it myself" with an
      HP field and Save;
    - damage per correct answer: 1 / 3 / 5 / 10;
    - battle intensity: Gentle / Standard / Fierce (Custom when edited), with an explanatory paragraph;
    - battle timers switch;
    - weapon unlocks switch;
    - power-ups and team energy switch;
    - **Advanced** (collapsible): mode thresholds, class targets per mode, healing per mode, battle timers,
      weapon unlock %, questions between unlocks, vote and runoff seconds; Save buttons and inline errors.
  - **Projector on another device**: create a link, copy, revoke.
  - **End session**: close lobby (confirm).
- **States:** empty lobby, locked, player removed toast, reconnecting.

**C3. Host game (status: in progress)**
- **Sticky control bar (night):**
  - "Q 4 / 10" (or "Recovery · same idea as Q1");
  - answered count "12 / 30 answered", countdown, "Starts in 3…", "Leaderboard in 4…";
  - battle strip (monster, HP, note);
  - last result "27/30 correct (90%) · −81 · special attack stopped" or "· counter-attack, +32 HP";
  - weapon panel (icon, name, charge dots, special button with reason "Recharging: ready from question 6"
    or "Armed");
  - team abilities (energy meter plus 4 buttons);
  - connection pill, Reactions toggle;
  - game command buttons: End question, Leaderboard, Next question or Final results (disabled during a
    vote);
  - "Projector" link.
- **Inside the bar when needed:**
  - **Mastery banner:** "Mastery check: 57% (75% needed). A recovery question … comes next" with "Skip the
    recovery question" or "Play the recovery question".
  - **Vote panel:** "Weapon vote · 12 of 30 voted · 8 s" or "Tie: you choose the weapon", each weapon as a
    button with its live count, plus Cancel vote.
- **Main:**
  - **Current question panel (night):** question, answer tiles with counts after closing, the explanation,
    the common mix-up line.
  - **Leaderboard panel (paper list):** top 10 with rank chip, animated character, name, streak, rival
    tags, near-miss, points gained, score, movement arrow.
- **Podium:** battle result, top 3, then **"What the class learned"**: a table of objective (with topic),
  questions, class correct %, after review %.
- **End game now:** confirm dialog.

### D. The projector (`/presenter/:id`, the world, 1920×1080 and 1024×768)

Every projector screen has:
- the world backdrop in the current mood;
- a header: quiz title score bug, connection pill, music button (states "Click for music", playing with a
  volume slider, off) and a full-screen button;
- a reaction lane on the right edge when reactions are on (bubbles float up; bursts at the top).

The teacher's own projector also shows a control row at the bottom: key hint "Space or → shows the
leaderboard now", team abilities, weapon panel, Reactions toggle, command buttons. A projector opened
with a projector link (read-only) shows no controls.

**D1. Lobby (camp)**
- **Left:** "Join at rally.pages.dev/join", "Game PIN" with very large digits, QR "Scan to join", "Start
  game" (teacher only) with "30 ready", the Reactions toggle with a hint, a "Locked · no new players" badge.
- **Right:** "30 PLAYERS" counter and the **camp**:
  - tents, campfire with firelight, rocks;
  - characters walking, bumping, waving, high-fiving, dancing, laughing and getting angry, with emote
    bubbles above them;
  - the monster's silhouette with a blinking glowing eye on the horizon (battle on);
  - a lower-third ticker "Ada joined".
- **States:** empty ("Grab your phone… Your avatar appears here when you join"), crowded (100 players,
  smaller characters), reduced-motion grid.

**D2. Get ready:** "Question 4 of 10" and a big 3-2-1 countdown.

**D3. Level start:** "LEVEL 2" kicker and a huge "Application" title (or "Final challenge · Everything
together" with "The monster aims at what the class found hard: Compare fractions · Add fractions"),
plus a countdown.

**D4. Battle announcement:**
- monster large (pulsing when angry);
- "Boss battle · Gloomjaw appears!" or "The monster changes · Gloomjaw is in a RAGE!" / "is ENRAGED!";
- "Every correct answer hits it. Bring its 630 HP down together.";
- "It roars a riddle every question: 18 of 30 must answer correctly to stop the Riddle Roar.";
- "10 seconds per question.";
- HP bar and countdown.

**D5. Review before a recovery question:**
- "Let's fix this together"; "43% got it right last time."; the original question in quotes;
- a panel: "The most common pick was B: Saturn (11 of 30)" with a lightbulb note "Saturn's rings make it
  look bigger than it is";
- "Right answer: Jupiter · explanation";
- "Now a new question on the same idea" with countdown.

**D6. Power-up draft:** "Final challenge · Choose your power-up!", "Everyone gets three to choose from on
their phone. Use it once in the final battle.", weak objectives, the 8 power-up icons, countdown.

**D7. Question**
- **Header:** "Q 4 / 10" (or "Recovery · Q4"), level chip ("LEVEL 2", "FINAL"), "12 / 30 ANSWERED",
  battle strip (monster pulsing when charging, HP, energy, note line), timer ring (with "Time's up" state).
- **Body:** the large question (with optional image) and 4 (or 2) answer tiles in a 2×2 grid, with a
  "removed" tile when Knowledge Reveal was used.
- **States:** text question, picture answers, true/false, last 5 seconds (red ring, faster music), time's up.

**D8. Reveal: classic (no battle):** the question, tiles with the correct one highlighted and the others
dimmed, count bars under each tile, the explanation, the "Common mix-up: B (11 of 30) · note" line,
and "Leaderboard in 5" with a progress bar.

**D9. Reveal: battle arena.** A top band shows the question, the correct answer tile, "27 of 30 correct ·
90%", the explanation and the common mix-up. The **arena** (16:9 world):
- **Left:** the class as full-body heroes in a honeycomb formation (30 typical; 100 must still be
  recognisable). Correct students attack (swing) in a staggered wave; the others cheer.
- **Middle:** projectiles in the class weapon's style, with spark bursts and "−3" numbers on impact.
- **Right:** Gloomjaw with name and title, stage badge, big HP bar; it reacts (flicker, flinch, stagger
  with a camera shake and flash), and a big "−81" total pops up.
- **Then, one of these outcomes:**
  - (a) "Riddle Roar stopped!" green banner, monster stunned with stars;
  - (b) "Riddle Roar!" red banner: the monster charges, a shock wave hits the class (they brace), it
    heals ("+32 HP");
  - (c) "Riddle Roar blocked by a shield!";
  - (d) "Riddle Roar frozen!" (Deep Freeze);
  - (e) the monster is defeated (falls, victory fanfare).
- **Extra banners:** the weapon line ("Thunderclap! Every hit doubled · +100 weapon damage"), the team line
  ("Final Rally! · Group Lightning −50 · 3 power-up strikes · +30 team energy (mastery, defended,
  everyone joined in, final challenge)"), and the gold "90% correct: weapon unlocked!" banner.
- **Mid-attack frames to design:** wind-up, projectiles in flight, impact, total, counter-attack, healed.

**D10. Weapon vote**
- "INCREDIBLE TEAMWORK!" and "A legendary weapon has been unlocked!";
- "Vote on your phone · one vote each · 12 of 30 voted";
- three weapon cards dealt in with live vote bars;
- countdown at the top right; teacher-only "Cancel vote" and "Choose for the class" on each card.
- **States:** runoff ("It's a tie! · Runoff vote: choose again", the out-of-runoff card dimmed), teacher
  decides ("Still a tie · Your teacher chooses the weapon", counts shown), cancelled.

**D11. Weapon equipped:** the weapon icon spins in, "LEGENDARY", "Thunder Blade equipped!", "16 votes.
Always: … Thunderclap: …", and below, the arena with the weapon popping into every hero's hand.

**D12. Leaderboard: "The Climb to the Lair"**
- **Layout:**
  - a cliff path in three switchbacks with 10 ledges, #1 at the top near the lair, #10 at the foot;
  - rune stones with rank numbers; the top three ledges lit gold, silver and bronze;
  - each hero on a ledge with a name banner (name, score, "+900" gained, "↑7" or "↓2");
  - streak torches; a crown on #1;
  - the monster watching from the lair with its HP (or a flag if no battle);
  - a nameless crowd of dots at the foot for everyone else.
- **Headline banners:** "Champion defends · Ada", "New champion · Kwame", "Legendary comeback · Zoë · 9 → 1";
  plus "Top 10 of 30 · everyone sees their own place on their phone".
- **Frames to design:** before (old ranks), mid-move (climbing, leaping, sliding, newcomer jumping from the
  crowd), settled.
- **Optional state:** the mastery banner below it, with the teacher's skip button.

**D13. Final podium:**
- the battle result ("Gloomjaw is defeated! The whole class brought it down together." with the defeated
  monster, or "Gloomjaw escaped · The class dealt 520 of 630 damage. So close!" with its HP);
- "Final results" with a 2-1-3 podium (heroes, names, scores) and "30 players · thanks for playing";
- the dawn world for a victory.

**D14. Projector system states:** "Can't show this session" (needs a projector link), connecting,
session ended, reconnecting pill.

### E. Student phone (night, 390×844 and 360×740)

**E1. Join (`/join`, `/join/:pin`)**
- **Step 1, PIN:** 6 digit slots (3+3), the numeric keypad, an "Enter" CTA that is only active when
  complete, errors (wrong PIN, game locked, game full, too many tries with retry time).
- **Step 2, profile:** game title, nickname (2–16 characters, blocked words, name taken), the avatar
  builder, "Join game".

**E2. Lobby**
- a "YOU'RE IN" bar;
- my character (large) with my emote bubble and mood;
- "Waiting for the teacher to start";
- the class reactions row (last 5 emotes from classmates);
- the emote panel (tabs, 20 emotes, rate limit "Wait 3 s", "Sent!", "Reactions are turned off");
- Leave game.
- **States:** removed by the teacher, session ended, reconnecting.

**E3. Get ready:** "Question 4 of 10", countdown. **E3b. Level start, battle announcement, review and
draft:** compact phone versions of D3–D6. The draft shows 3 tappable power-up cards, "One each. If you
don't choose, you get the first one.", then "Power-up ready!".

**E4. Question**
- **Header bar:** "Q 4/10" (or "Recovery · Q4"), streak flame "3", rank "#4", score.
- **Battle note line:** "⚡ Gloom Storm charging · 21 of 30 correct needed".
- **Body:** question text, optional image, countdown bar with seconds, 4 large answer buttons (letter,
  colour, pattern, label) or a 2×2 picture grid.
- **States:**
  - before answering;
  - locked in (my pick ringed with "YOU", others dimmed, "Locked in · waiting for the others" lower
    third, then emotes);
  - removed answer (greyed, not tappable);
  - time's up;
  - "Too late", "Hold on — not started yet" notices.
- **Power-up row (final challenge):**
  - held: icon, name, description and a "Use" button (disabled for Revival until answered);
  - armed ("Armed for this question" / "Pick your new answer (once)");
  - used, with the X-Ray hint box ("This question tests: Compare planet sizes. Careful, a common trap: …");
  - an error notice ("You have not missed this idea before: save it…").

**E5. Reveal**
- **Correct:** a big tick, "Correct!", "+840".
- **Wrong:** "Not this time" or "No answer this time", "A was correct.", "Next question coming up — every
  question is a fresh chance.".
- The common mix-up line.
- **Battle card:**
  - my avatar swinging and "Your attack hit Gloomjaw! −3" (or "Your class hit Gloomjaw. The next question
    is your chance.");
  - "27 of 30 got it right · class damage −81";
  - "Your class stopped the Riddle Roar!" or "The Riddle Roar hit back (18 needed): Gloomjaw healed 32 HP.";
  - "+25 team energy"; the HP bar; "Gloomjaw is defeated! Great teamwork."
- "Leaderboard in 5", then emotes.

**E6. Weapon vote:** "Weapon unlocked! Amazing teamwork. Get ready to vote…" (pending), then "Vote for the
class weapon" with a seconds counter and "One vote each. You can't change it once it's in.", 3 weapon
cards (2 in a runoff: "Tie! Vote again"), "You voted Frost Hammer. Waiting for the class…", "Still a
tie! Your teacher is choosing between …", "Thunder Blade equipped!" (with vibration), "No new weapon
this time".

**E7. Leaderboard:** my rank card (my character doing its rank-movement animation, "Your rank 4th", "of 30
· 3,210 points ▲2") plus the compact top-10 list with my row highlighted.

**E8. Final:** "Final results", the battle result, my final rank card, the top-10 list.

**E9. Phone mood tint:** the background glow follows the monster's mood (violet, orange, pulsing red, gold).

### F. System screens

404, route error, config error (missing environment variables), full-page loader, offline or
reconnecting, coming soon. Design paper and night variants.

---

## 6. Illustration and asset list

All original vector art, each item as its own Figma component (SVG-exportable):
1. **Gloomjaw**: 4 stages × the actions in 4.3 (key frames for motion: idle, hit, stagger, charge, heal,
   stunned, defeat).
2. **Hero body**: neutral body plus 6 poses; the avatar head parts (all variants from 4.3).
3. **6 weapons**, each with a distinct silhouette, an icon size (24–48px) and a hero-hand size.
4. **8 power-up icons** and **4 team-ability icons**.
5. **8 projectile types**, an impact spark, a shock wave, a heal glow, stars (stunned), a crown, a streak
   torch (3 intensities), a summit flag.
6. **World**: 4 sky moods, 3 hill layers, moon/sun, stars, embers, sparkles, lightning.
7. **Camp**: 2 tents, campfire (2–3 flame frames), rocks, firelight, the monster silhouette with its eye.
8. **Climb**: cliff and rock texture, path, 10 ledges, rune stones, lair (cave glow).
9. **Arena**: ground band and horizon line.
10. **Logo and LogoMark** (paper and night versions), favicon.
11. **Phase wipes**: ink brush edge, slash, dust clouds, light burst (key frames).

---

## 7. Motion (document as notes beside the frames)

| Moment | Spec |
|---|---|
| Buttons and tiles | 120ms press-down (scale 0.96), spring back |
| Screen changes | 200–400ms enter-up (fade and 12px rise); projector phases add a wipe of 500–1000ms |
| Get ready | 1 s per number, a pop on each |
| Question appears | Tiles stagger in 80ms apart |
| Arena attack | wind-up 450ms → projectiles launched over at most 2.2 s (staggered per student, 0.5–0.7 s flight each, arcs) → the total pops at the last impact + 300ms → outcome after 0.9–1.7 s |
| Leaderboard | Scores roll at 0.4 s, characters move at 0.8 s (stagger 80–120ms; climb 0.38 s per ledge, max 1.6 s; leap 1.1 s; slide 0.3 s per ledge), highlights at 3.2 s, settled at 4 s |
| Weapon vote | Title zooms in, then the cards deal in (250/400/550ms) |
| Monster idle | 2.8 s breathing (1.5 s in Rage, 0.7 s shake when Enraged) |
| World | Hills drift for 70–160 s per loop; embers rise over 5–10 s; a lightning flicker every 7 s |
| Emotes | Bubble floats up 4 s; burst 1.2 s |

Reduced motion: show final states only, with no camera shake, wipes or particles.

---

## 8. Accessibility checklist for the design

- Contrast as in rule 8. Check every mood's sky against the text over it.
- Never use colour alone: answer letters and patterns, rank numbers on stones, icons with labels, arrows
  with numbers.
- Focus states for every control (visible 2–3px ring) on paper and night.
- Phone targets at least 48px; projector buttons at least 44px.
- Text never placed on busy art without a backing (banner, veil or pill).
- Screen-reader labels noted for icon-only controls ("Turn music off", "Full screen", "Use", weapons).

---

## 9. Data to use in mockups

- **Teacher:** Ms Rivera, Hillside Secondary.
- **Quizzes:** "Solar System Basics" (Science, 10 questions, Published); "Fractions" (Maths, 12, Draft);
  "Photosynthesis check-in" (shared by Mr Okafor, Edit access).
- **Players:** Ada, Kwame, Zoë, Priya S, Mateo, Hana, Liam O, Aisha, Noah, Mei, Tomás, Ivy, Omar, Sofia R,
  Kai, Freya, Diego, Yuki, Ben T, Amara… (30, with a stress case of 100 and a 16-character name).
- **Battle:**
  - HP 630; per hit 3; specials: Tail Swipe (Normal), Riddle Roar (Rage), Gloom Storm (Enraged);
  - weapons: Thunder Blade (legendary), Inferno Staff (epic), Frost Hammer (rare);
  - energy 65/100.
- **Learning:** objectives "Compare planet sizes", "Order of the planets", "Stars and the Sun"; report
  48% → 81% after review, 72%, 92%.

---

## 10. Handoff: what the Figma file must contain so it can be rebuilt in code

1. **Pages:**
   - Cover;
   - Foundations (variables, type, grid, effects);
   - Components;
   - Illustrations;
   - Paper screens; Projector screens; Phone screens;
   - Motion notes;
   - Reduced-motion frames.
2. **Frames** at 1440×900 (teacher), 1920×1080 **and** 1024×768 (projector), 390×844 **and** 360×740
   (phone).
3. **Layout:**
   - auto layout everywhere it applies;
   - constraints set for the projector (it scales with the viewport height);
   - the arena and climb drawn on a fixed 1600×900 board that scales to fit.
4. **Variables:** colours, type and spacing as Figma variables, with mood modes (calm, rage, enraged,
   victory) and surface modes (paper, night).
5. **Naming:** components named as in the brackets above, and variant properties named after the states
   listed (for example `AnswerTile / state=yourpick / size=phone / letter=B`).
6. **Exports:**
   - every illustration as optimised SVG (flat shapes, no embedded bitmaps, no filters that can't be done
     in CSS);
   - fonts from Google Fonts (name the families and weights).
7. **Annotations:** each screen annotated with its route and which state it shows.

Rebuilding this in Rally means mapping the variables to the Tailwind theme, the components to the React
components listed, and the screens to the routes. All behaviour, data and server rules stay as they are.
