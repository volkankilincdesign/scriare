# Demo story scaffold — what's in it

Open `demo-story-scaffold.json` from Scriare's **Open Project**. Save a copy
under a real name before you start, so the scaffold stays as a spare.

**Everything in it is a slot.** Thirteen scenes, the branch wired end to
end, no prose. Every title, choice label and character name is a structural
placeholder in the shape you'd replace it. Nothing here is a story.

---

## The shape

```
                         ┌─ Path A · 1 ─ Path A · 2 ─┐
   Opening ── fork ──────┼─ Path B · 1 ─ Path B · 2 ─┼─ Convergence ─ The Turn ─ Pressure ─┬─ Ending · Earned
                         └─ Path C ─┬───────────────┘                                     ├─ Ending · Refused
                                    └─ Ending · Early                                     └─ Ending · Known
```

Three routes out of the first branch, two of which rejoin and one of which
ends early. Four endings. Shortest route 3 scenes, longest 7 — enough to
show branching without being a thing you have to finish writing to demo.

Scenes are filed into three groups (**Act One**, **Act Two**, **Endings**),
which are the same objects as the boxes on the Story Graph.

## What's already wired, so you don't have to

| Feature | Where to see it |
| --- | --- |
| Speaker on a line | Opening (Second Voice), The Turn (the player) |
| Mentions | Opening (a location), Path B · 1 (a character) |
| Aliases | "Second Voice" answers to `@the other` |
| Variables | `trust` (number), `toldTheTruth`, `knowsTheName` |
| Actions on a choice | Opening and Path A · 1 raise `trust` / set flags |
| A locked choice | **Pressure** — needs `trust` ≥ 2, shows its reason |
| A hidden choice | **Pressure** — only appears if `knowsTheName` |
| Conditional prose | **Convergence** — a paragraph only Path A players see |
| Choice Styles | "Danger" on the demanding option, "Quiet" on two others |
| Endings | Four scenes with no outgoing choices |

Play it once before you write anything. From the start scene, take the
guarded path and you'll see a choice at Pressure that a player who took the
short path never knows existed.

## What to rename

- **Scene titles** — "Path A · Beat 1" is a job description, not a name.
- **Choice labels** — every one is in `[square brackets]`.
- **Characters**: Protagonist, Second Voice. **Locations**: Opening
  Location, Second Location. Renaming reaches every mention and every
  spoken line automatically — that's the point of them being references.
- **Variables** — `trust`, `toldTheTruth`, `knowsTheName` are guesses at
  what a story might track. Rename or replace them; the conditions and
  actions follow the id, not the name.

## What to delete as you go

Each scene opens with one italic line saying what that scene is *for*.
Delete it when you've written the scene. When the word count in **Check
Story** stops being ~277 higher than what you wrote, they're all gone.

## Two things worth knowing

**The player is called "You".** The Turn has a line attributed to the
player rather than to a character, and it prints as "You:". Naming them
something else is a story setting that doesn't exist yet — tell me if the
demo needs it.

**Check Story reports nothing on this file.** Thirteen of thirteen scenes
reachable, no dangling choices, no gates that can't open. If it starts
reporting things as you write, that's it doing its job — but it's worth
knowing the scaffold itself is clean, so anything it says later is yours.
