# The Exact Word

*A demo story for Scriare — 13 scenes, four endings.*

**This is a draft to react to, not a thing to keep.** You asked to see how I
write; change all of it, or take the shape and put your own story in it. It
maps one-to-one onto the scaffold already in `other_materials`, so if you
keep the structure you can type it straight in.

---

## Why this story and not another one

Three constraints, and they picked the premise between them.

**It has to be small.** Thirteen scenes is one evening of writing and about
four minutes of playing. That rules out anything needing a world — no
factions, no map, no history the reader has to hold. Two people and a room.

**It has to make the branching matter in a way a viewer can see in ninety
seconds.** So the choices are not "go left / go right" but *what you say*,
and the consequence is not a different room but a different account of what
happened. That's also the only kind of branching that survives being this
short: you can't show a war changing, you can show a sentence changing.

**It should be about the thing the app is for.** It's a tool for choosing
words. So the story is about someone whose job is choosing words, and what
it costs her to choose one. That's not cleverness for its own sake — it
means every feature the video shows is doing narrative work while it
demos. The locked choice isn't a locked door; it's something she can't
bring herself to say yet.

Second person, present tense — the convention in branching fiction, and it
makes the app's unnamed **You** speaker read as intended rather than as a
placeholder.

---

## The cast

| | |
| --- | --- |
| **You** | A court translator. Turkish to German, German to Turkish, eleven years. Never named — the app prints "You" and that's correct here. |
| **Nesrin** | Your supervisor. Not a villain. She has signed off on four hundred of your translations and has never once read the source. |
| **The voice** | On the tape. You know it. The story never shows him. |
| **The Registry** *(location)* | The office. Fourth floor, no windows that open, a kettle that everyone pretends is nobody's. |

**Variables**

| Name | Type | What it means | Set where |
| --- | --- | --- | --- |
| `candour` | number, starts 0 | How much of the truth you've told out loud | Scenes 2, 3, 8 |
| `admitted` | boolean | You've said you know the voice | Scene 3 |
| `hasName` | boolean | You know who the second speaker is | Scene 5 |

---

## 1 · The Registry

*Start scene. Scaffold: **Opening**.*

The tape arrives at ten past seven, which is nine minutes after everyone
else has gone home and one minute after you decided to stay.

It is not a tape. Nobody has used tape since before you started. But the
Registry still calls them tapes, the way it still calls the fourth floor
*upstairs* when there is nothing above it, and you have stopped correcting
people about both.

> **NESRIN:** Forty minutes of it. They want the German by tomorrow.

She is already wearing her coat. She has been wearing her coat, in the way
of a person who has been about to leave for an hour.

> **NESRIN:** It's two men in a car. One of them does most of the talking.

**Choices**

1. *"Whose car?"* → **2 · What She Isn't Saying**
2. *"Leave it. I'll start now."* → **4 · The First Nine Minutes** · sets `candour` +1
3. *"I can't tonight."* → **9 · The Corridor** *(Quiet style)*

---

## 2 · What She Isn't Saying

*Scaffold: **Path B · Beat 1**.*

Nesrin looks at the file rather than at you, which is how you know the
answer is going to be true and incomplete.

> **NESRIN:** It's a case file. You don't need the case.
>
> **NESRIN:** You need the words.

That has been the arrangement for eleven years and you have defended it at
dinner tables. The translator does not need the case. The translator needs
the words. A translator who knows the case starts *helping*.

She puts the file down and does not let go of it.

**Choices**

1. *"I've never asked before."* → **3 · The Name** · sets `hasName` true
2. *"Fine. The words."* → **4 · The First Nine Minutes**

---

## 3 · The Name

*Scaffold: **Path B · Beat 2**. Shows an `@` mention in prose.*

> **NESRIN:** Kaya. The one doing the talking is Kaya.

She says it the way you'd hand someone a hot dish — quickly, and then with
both hands free.

> **NESRIN:** You didn't ask me that.

You didn't. And you know the name, and she knows you know it, and neither
of these facts is going to be said out loud in the Registry at seven in the
evening with her coat on.

**Choices**

1. *"I didn't ask you anything."* → **6 · The Convergence** · sets `candour` +1
2. *"Thank you."* → **6 · The Convergence**

---

## 4 · The First Nine Minutes

*Scaffold: **Path A · Beat 1**.*

The first nine minutes are a man complaining about a roundabout.

This is the part nobody believes about the job. Forty minutes of tape is
thirty-four minutes of a roundabout, a cousin's wedding, the price of a
part for a washing machine, and six minutes that someone will read out in a
room with a flag in it.

At eleven minutes and forty seconds the second man laughs.

You stop the recording. You put both hands flat on the desk. You start it
again and he laughs again, in exactly the same place, because that is how
recordings work, and it is still him.

**Choices**

1. *"Nesrin — I know this voice."* → **5 · Saying It** · sets `admitted` true, `candour` +2
2. *Say nothing. Keep typing.* → **6 · The Convergence**

---

## 5 · Saying It

*Scaffold: **Path A · Beat 2**.*

She stops in the doorway with one arm in her coat.

> **NESRIN:** Personally?

> **You:** He taught me. Nineteen years ago. Sight translation, Thursdays.

Nesrin comes back into the room. She does not sit down — sitting down would
make it a conversation — but she comes back in, and she puts the file on
the desk instead of holding it.

> **NESRIN:** Then I'll give it to Aykut in the morning.

> **NESRIN:** That's not a punishment. That's the rule, and the rule is
> there for you, not for him.

**Choices**

1. *"Give it to Aykut."* → **10 · Ending: Given Away**
2. *"Let me finish tonight."* → **6 · The Convergence**

---

## 6 · The Convergence

*Scaffold: **Convergence**. Holds the conditional paragraph.*

By nine the roundabout is behind you and the six minutes are in front of
you, and the six minutes are one sentence long.

*(Conditional — shown only if `admitted` is true)*
> Nesrin is still here. She has not offered to help, because she can't, and
> she has not left, because she won't. She is reading something on her phone
> that she read an hour ago.

You play the sentence eleven times. You write down what it is in Turkish,
which takes four seconds, and then you sit with what it is in German, which
takes the rest of your life so far.

**Choices**

1. *Type it out.* → **7 · The Exact Word**

---

## 7 · The Exact Word

*Scaffold: **The Turn**. This is the scene the story exists for.*

The sentence is: **Onu hallettik.**

And *hallettik* is the problem, because *hallettik* is what you say about a
blocked drain, a lost invoice, a cousin who needed a job. It is the most
ordinary word in the language. It means: it is no longer a thing you have
to think about.

In German you can write **erledigt** — *dealt with*, *taken care of*, the
word a plumber uses.

Or you can write **beseitigt** — *removed*, *disposed of*, the word that
will be read out in the room with the flag, slowly, twice.

Both are correct. One of them is a decision.

> **You:** Neither of these is what he said.

> **NESRIN:** Neither of them ever is. Pick one.

**Choices**

1. *Type `erledigt`.* → **8 · What You Sign** · sets `candour` +1
2. *Type `beseitigt`.* → **8 · What You Sign**
3. *Type `erledigt`, and a footnote.* → **8 · What You Sign** · sets `candour` +2

---

## 8 · What You Sign

*Scaffold: **Pressure**. Three choices: one always open, one locked, one hidden.*

At the bottom of every translation there is a line with your name under it
and one sentence above it, and the sentence is: *I certify that the above
is a complete and faithful rendering of the recording provided.*

You have signed it four hundred times. Tonight you read it.

**Choices**

1. *Sign it.* → **11 · Ending: Faithful**

2. *"I want it on the record that the word is ambiguous."*
   → **12 · Ending: On the Record**
   · **requires `candour` at least 3** · **Lock** — shown greyed out with
   its reason, because she cannot say this until she has said the smaller
   things first

3. *"Ask Kaya what he meant. He's two floors down."*
   → **13 · Ending: Two Floors Down**
   · **requires `hasName`** · **Hide** — a player who never asked whose car
   it was does not know there is anyone to ask

---

## 9 · Ending: The Corridor

*Scaffold: **Ending · Early**. Reached from scene 1.*

The corridor light is on a timer that has never once outlasted the walk to
the stairs.

In the morning it will be done, correctly, by someone who did not know the
voice, and that will be the best translation this office produces all year.

You will not hear the tape. You will hear, in March, a sentence read out on
the radio in German, and you will know which Turkish word is underneath it,
and you will be the only person in the country who does.

**THE END**

---

## 10 · Ending: Given Away

*Scaffold: **Ending · Refused**, reached early via scene 5.*

Aykut is twenty-six and very good and has never met anyone in his life who
later turned up on a tape.

He renders it *beseitigt*. He is not wrong. He asks you, in June, over the
kettle that is nobody's, whether you ever get anything that feels heavy,
and you say: sometimes the wedding parts.

**THE END**

---

## 11 · Ending: Faithful

*Scaffold: **Ending · Refused**.*

You sign it at ten past eleven, four hours after it arrived, and the
sentence above your name is true. It is complete. It is faithful.

Faithful to what he said. Which was a word about a drain.

You turn off the lamp and the Registry does the thing it does at night,
which is to look exactly like an office.

**THE END**

---

## 12 · Ending: On the Record

*Scaffold: **Ending · Earned**. Requires `candour` ≥ 3.*

> **NESRIN:** You understand they'll strike the note.

> **You:** Then they'll strike it.

She takes the file with the note stapled to the front, and she does not
argue, and at the door she says the only thing she says all night that
isn't procedure:

> **NESRIN:** Eleven years. I've never read a source document. Not once.

> **NESRIN:** I always thought that was the discipline.

**THE END**

---

## 13 · Ending: Two Floors Down

*Scaffold: **Ending · Known**. Requires `hasName`.*

He is in the small interview room, the one with the good chairs, which
tells you what kind of witness they think he is.

He is older in the way that surprises you, which is to say exactly as much
older as nineteen years.

> **KAYA:** *Hallettik.*
>
> **KAYA:** Nesrin sent you to ask me what it means?

> **You:** No.

> **KAYA:** Good. Then you already know.
>
> **KAYA:** Write down what he said. Not what he did.

Which is the first thing he ever taught you, and you will think about
whether he was allowed to say it for a long time.

**THE END**

---

## If you keep the shape but not the story

The structure does the work, so it survives a full rewrite. What it needs:

- **One irreversible decision in the middle** (scene 7) that isn't about
  where to go, only about what to say.
- **Two things a player might not learn** — a name (`hasName`) and an
  admission (`candour`) — so that two of the four endings are genuinely not
  available to a careless reader.
- **One ending reachable in ninety seconds** (scene 9), so the story has a
  floor as well as a ceiling.
- **A second character who is not an obstacle.** Nesrin is right about
  everything and it doesn't help. That's worth more in thirteen scenes than
  an antagonist.

What I'd cut first if it's too long: scene 10. It's the least interesting
ending and its only job is to catch a path.

---

## Notes for typing it in

- Everything marked `> **NAME:**` is a speaker-attributed line — `@` at the
  head of the line, not typed text.
- **Kaya** and **Nesrin** are characters; **The Registry** is a location.
  Kaya only ever appears as a mention until scene 13, which is deliberate.
- Scene 6's indented block is a **Conditional** (`/conditional`), gated on
  `admitted`.
- Scene 8's second and third choices are the **Lock** and **Hide**
  demonstrations — and they're also the whole point of the scene, which is
  the ideal case: a feature that would still be there if the app had no
  features to show.
