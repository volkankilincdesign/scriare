# Scriare — 90-second video

**Updated for v0.88.1.** The previous version of this script was written on
12 September, before the Dialogue block, before export, and before Daylight
became the default theme. Three beats changed; the argument did not.

## The one thing this video has to land

**Every other branching tool makes you stop writing to do structure.
This one doesn't.**

If a viewer takes away only that sentence, the video worked. Every beat
below exists to show it rather than say it — so the rule for cutting is:
if a shot doesn't show writing continuing uninterrupted, it's the first
thing to go.

The second thing, if there's room: **the structure draws itself from what
you wrote.** That's the graph beat, and it's the most watchable ten seconds
you have.

---

## Before you record

**The story — read this first**

Open **`The Blue Hour — With Conversations.scriare`**, not `The Blue
Hour.scriare`. They are both 32 scenes and they look identical until beat 5:
only the first has the three Dialogue blocks in it. The plain file is what
the test suite and the screenshot tool still load, which is a separate
problem — but for the video it is simply the wrong file, and you will not
find out until you are three beats in.

The conversations are in **s11 Deniz In The Yard** (4 lines), **s15 The Big
Table** (6), and **s20 Hikmet's Office** (5). Beat 5 uses one of them; s20 is
the best-looking of the three and s11 is the shortest to shoot.

**The app**

- **Daylight theme.** It is the default since v0.88.0, so it is what a viewer
  sees when they install the app after watching this. Dark photographs
  slightly better and that is not worth advertising a different app than the
  one they get.
- Window at **1920×1080**, not maximised on a bigger screen — you want the
  recording to be 1:1 pixels, not scaled.
- Content panel and Inspector both open. Story Graph open.
- **The graph opens at a third of the column** — about 329px at this window
  size. That is correct for writing and too short for beat 3, so drag it
  taller for that shot and only that shot. Do not record the whole video
  with a tall graph; the opening proportion is part of the argument.
- No scene renaming or cleanup needed any more. The demo story's scene names
  are real.

**The recording**

- 60fps if your capture allows it. Typing at 30fps looks laggy in a way
  that reads as the app being slow.
- **Hide the mouse cursor when you're typing**, show it when you're
  clicking. Most capture tools can do this; if yours can't, keep the mouse
  still and off to the side during typing shots.
- Slow your typing down about 30%. Real typing speed is illegible at this
  size, and a viewer who can't read the sentence can't see the point.
- No system notifications. Do a dry run with Do Not Disturb on.

**The sound**

Default to **no voiceover** — captions only. It works muted (which is how
most of this gets watched on a portfolio page or LinkedIn), it's easier to
re-cut, and it doesn't date. Optional VO lines are given below if you'd
rather; if you use them, drop the on-screen captions to just the section
titles so the two aren't competing.

Music: something quiet with no drop. If a viewer notices the music, it's
the wrong music.

---

## The beat sheet

Nine beats, 90 seconds. Times are targets, not law — the graph beat is
allowed to run long if it's good.

### 1 · Cold open — 0:00–0:07

**On screen:** Just the page. No panels visible yet (collapse them for this
shot, or crop in). A cursor blinking in an empty scene. You type one full
sentence of the demo story. Nothing else happens.

**Caption:** *(none — let it be silent for three seconds)*

Then: **"A branching narrative editor."**

**Why:** Every tool in this category opens on a node canvas. Opening on a
page is the whole argument, made before a word of it.

**VO alternative:** "This is a tool for writing branching stories."

---

### 2 · The branch, in the middle of the sentence — 0:07–0:22

**On screen:** Still writing. You reach the end of a paragraph, type
`/choice` — the menu appears — Enter. The Choice Block lands in the flow.
You type the first option's text, Tab or click to the second, type that.
Then you keep typing the next paragraph *below it*, without touching
anything else.

**Caption:** **"Type `/choice` and keep going."**

Hold a beat, then: **"The options are ordinary text. Bold one."**
— and you select a word inside an option and hit Ctrl+B.

**Why:** This is the v0.32.0 decision made visible in four seconds, and
it's the one thing no competitor can show. Do not rush the bold — that
tiny moment is the proof.

**VO alternative:** "A choice goes where you type it. Its options are real
sentences — so everything the toolbar does to a sentence, it does to a
choice."

---

### 3 · The graph draws itself — 0:22–0:34

**On screen:** Cut (don't pan) to the Story Graph with the full story in it
— 32 scenes in five chapters. Let it sit for one second. Then drag a scene,
and let the connection follow it. Then fold **one** chapter — it collapses
to a single block and the crossing links bundle into one labelled edge.

**Caption:** **"The map is made of what you wrote."**

**Why:** The fold is the best single second in the app. It's legible at
thumbnail size, which matters — this is the frame you'll use as the video's
poster image.

**One thing to know about folding, since v0.87.0:** the camera re-frames
only when a fold leaves nothing on screen. Fold a chapter you are looking
at and nothing moves, which is what you want here. Fold *all five* and the
camera will jump to the folded blocks — a good shot in its own right (five
chapter boxes, then one unfolds) but a different one, so decide which you
are taking before you hit record rather than discovering the jump in the
edit.

**VO alternative:** "You never draw the map. It's made of what you wrote."

---

### 4 · Characters — 0:34–0:44

**On screen:** Back in the editor, mid-sentence. Type `@` and the first
three letters of a character who already exists — pick her from the menu.
Keep typing the rest of the sentence. Then, in the Content panel, rename
her — and cut to the sentence you just wrote, now saying the new name.

Use **Nesrin Aydın**. Rename her to anything; the point is the sentence
changing, not the name.

**Caption:** **"`@` names a character."**
Then, on the rename: **"Rename her once. Every sentence follows."**

**Why:** This is the references-not-copies decision, and it's the one that
makes people who've maintained a story bible sit up.

**VO alternative:** "Type @ to name a character. Nothing stores her name —
only who she is. So renaming her rewrites nothing, and changes everything."

---

### 5 · A whole conversation, on the page — 0:44–0:58

*This beat replaces the old "`@` at the start of a line" beat. The Dialogue
block contains that idea — its lines carry speakers — and it is the feature
nothing else in this category can show at all.*

**On screen:** Scroll to **Hikmet's Office** (s20). The Dialogue block is
sitting in the prose, open: five player lines, each with the reply
underneath and who answers it. Let it sit for two full seconds before you
touch anything — the shot *is* the shape of it.

Then, in three moves:

1. Click into a line and type a word, so it's clear this is the page and not
   a dialogue editor you opened.
2. Click a line's reply and change a word there too.
3. Click one line's row in the Inspector and show that it carries a
   condition and an effect — then stop. Do not configure anything; beat 6
   does that.

**Caption:** **"A whole conversation. On the page. As one thing."**

Then, smaller: **"Every line can have a condition, a consequence, and an
answer."**

**Why:** This is the headline feature and the only beat a competitor cannot
answer. Twine's unit is the passage, so a twelve-line conversation is twelve
passages or one passage of macros — the shape of it is never on screen.
articy can hold it, but in a node graph away from the prose. Scriare's
answer is that the conversation is *in the paragraph flow*, which is what
the two seconds of stillness at the top of this beat are for.

**If the video runs long, shorten this to the two seconds of stillness plus
move 1.** Do not cut it.

**VO alternative:** "A conversation is one thing on the page — the lines
they can say, what comes back, and what each one costs."

---

### 6 · What a choice is — 0:58–1:08

**On screen:** Click into a choice. The Inspector opens on that option. Set
its destination from the dropdown. Then add a condition: pick **resolve**,
pick "is at least", type **3**. Set it to **Lock**.

**Caption:** **"Where it goes. What it needs."**
Then, smaller: **"No syntax anywhere in the app."**

**Why:** This is the hardest beat to make watchable — it's dropdowns. Keep
it to three clicks and cut the moment the condition is set. The payoff is
the next beat, so this one is setup.

Use `resolve >= 3` specifically, because the story already has that exact
gate on **"Raise your hand and ask to be heard"** in *The Count Is Called*.
What you set here is what beat 7 then shows locked, which means the two
beats are one demonstration instead of two unrelated ones.

**VO alternative:** "Everything a branch needs — where it goes, what it
requires, what it changes — is a dropdown. There's no syntax anywhere in
this app."

---

### 7 · Play it — 1:08–1:22

**On screen:** Press Play, **on the Night ground**. Read for a second — the
prose, the speaker's name in front of her line, and the variable readout
visible at the edge. Then the choices appear in *The Count Is Called*, and
**"Raise your hand and ask to be heard" is locked, with its reason showing**:
*Requires resolve is at least 3.* Click a different one. The scene changes.

**Caption:** **"And then you play it."**

**Why:** The locked choice with its reason visible is the single clearest
"this is a real tool" frame in the whole video. Make sure it's on screen
long enough to read — three full seconds, even if it feels slow in the
edit. It won't to a viewer seeing it once.

**Two deliberate choices here.** The **variable readout stays on camera** —
it tells a stranger this is a tool rather than a story, and that is worth
more than the tidier frame. And Play on **Night** while the editor beats
were on **Daylight**, because that contrast is the point: a theme is the
writer's room, a ground is the reader's page. They are not the same setting
and the video is the easiest place to show it without explaining it.

**VO alternative:** "And then you play it. The choice they haven't earned
says so."

---

### 8 · It leaves the app — 1:22–1:30

*This beat replaces Check Story. Reasoning under "What moved and why".*

**On screen:** Exit Play. Export. Then cut to **a browser** — a plain
window, no app visible — with the exported file open and playing. Click one
choice so it moves. Then, in one second, switch the reader's ground from
Paper to Night inside the exported file.

**Caption:** **"One file. Opens anywhere. Nothing installed."**

**Why:** The question in a viewer's head by now is "can I actually ship
something with this?", and the only honest way to answer it is to leave the
app on camera. A browser window with no editor in frame is the whole answer.
The ground switch is three frames of work and it proves the export is a real
reader rather than a dump of the text.

**Shoot this one last**, after everything else is in the can — it is the
only beat that needs a second application on screen, and a stray bookmarks
bar or a tab from your own life in frame is the kind of thing you only
notice in the edit. Use a clean browser profile.

**VO alternative:** "It exports to one file that opens in any browser, with
nothing installed."

---

### 9 · End card — 1:30–1:36

**On screen:** The logo on the app's own background. Under it, small:

> **Scriare**
> A branching narrative editor
> volkankilinc.com

**Why:** Your name goes on the site, not the card. The card's job is to be
screenshot-able.

---

## What moved and why

Three changes from the September script, in case you disagree with any of
them later and want the reasoning rather than just the diff.

**Beat 5 was "`@` at the start of a line says who's speaking." It is now the
Dialogue block.** The old beat was good and the new one contains it — the
block's lines carry speakers, so the idea survives inside a beat that also
shows the feature the whole positioning rests on. Keeping both would have
pushed the video to 110 seconds to show one idea twice.

**Beat 8 was Check Story. It is now export.** Check Story is the beat that
says "someone thought about the twentieth hour of use", which is a real
virtue and the wrong argument for a first meeting. Export answers the
question a viewer is actually holding. Check Story is not wasted — it is the
first beat to add back in a longer cut, below.

**Dark became Daylight.** Not a taste change: Daylight is the default since
v0.88.0, so Dark on camera would mean the app a viewer installs after
watching looks different from the one they watched. Play Mode on Night then
does double duty as the theme/ground distinction.

---

## Shot list

Record these as separate takes. Assembling nine clean shots beats salvaging
one long one, and it means a fluffed beat costs twenty seconds instead of
the whole session.

| # | Shot | Needs | Length to capture |
| --- | --- | --- | --- |
| 1 | Empty scene, type a sentence | — | 15s |
| 2 | `/choice`, type both options, bold a word | — | 30s |
| 3 | Graph: sit, drag a scene, fold one chapter | Graph dragged taller | 25s |
| 4a | `@` mid-sentence, pick Nesrin Aydın | — | 15s |
| 4b | Rename her, cut to the sentence | — | 15s |
| 5 | Dialogue block in s20: sit, edit a line, edit a reply, show the Inspector row | **The Conversations file** | 30s |
| 6 | Inspector: destination, `resolve` is at least 3, Lock | — | 20s |
| 7 | Play on Night: read, see the locked choice, pick another | `resolve` below 3 | 25s |
| 8 | Export, then the file playing in a clean browser, switch ground | Clean browser profile | 25s |
| 9 | End card | — | 5s |

**Nothing needs staging any more.** The old script had you break a link by
hand so Check Story had something true to report; the locked choice in beat
7 is already in the story, at *The Count Is Called*, gated on `resolve >= 3`.
Just do not play your way up to 3 before you record it.

---

## If it runs long

Cut in this order. The first three lose nothing structural:

1. The drag in beat 3 — keep the fold, drop the drag.
2. Beat 5 down to the two seconds of stillness plus one edit.
3. Beat 1 down to four seconds.
4. The ground switch at the end of beat 8.

Do **not** cut beat 2, beat 5 or beat 7 for time. Those are the argument,
the differentiator and the payoff.

## If you make a longer version

In this order: **Check Story** first (open it, click a finding, land on the
broken choice with the Inspector already pointing at it — the *taking you
there* is the point, not the list). Then **search**: type `aydin` into the
Content Browser and watch it find Nesrin Aydın. Three seconds, and for a
Turkish-speaking viewer it is the moment the tool stops being a toy.

---

## The 30-second cut

For social, where nobody watches 90 seconds: beats **2, 3 and 7**, in that
order, one caption each.

- **"Type `/choice` and keep going."**
- **"The map is made of what you wrote."**
- **"And then you play it."**

Those three are the ones that read **muted and small**, which is the whole
requirement on a feed.

**For a portfolio page or a job application, cut it differently: 2, 5, 7.**
There the captions actually get read and the viewer is evaluating you, so
the conversation beat earns its place over the graph — it is the beat that
shows a design decision rather than a nice animation. Same three captions,
with beat 5's in the middle.

Either way, **the fold is the poster frame.** It is the most legible still
in the whole video at thumbnail size.

---

## Three things that will make it look amateur

1. **The wrong story file.** `The Blue Hour.scriare` has no Dialogue blocks
   in it. You will reach beat 5 and find nothing to shoot.
2. **A cursor hunting for a menu.** Know exactly where you're clicking
   before you hit record. Hesitation reads as the app being confusing.
3. **Captions that describe what's visible.** "Here we click the Inspector"
   is noise. Every caption above says what it *means*, not what it shows —
   keep that rule for anything you add.
