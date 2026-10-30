# The story behind the Navigator

**v1.5 · 10.29.2026** · Dan West · [Try the live demo](https://navigator.icarianforge.com)

---

## Why I built this

If you've worked on an AI project inside a big company, you probably know this feeling. The pilot goes well, everyone's excited, and then things get stuck somewhere between "this works" and "this is live." Nobody's quite sure what stage it's in, what's still missing, or whose turn it is.

I wanted one place that answers those questions plainly, for every AI project at once. That's the Navigator.

## What it's built on

I didn't invent a lifecycle from scratch. The eight stages follow the AI system life cycle in ISO/IEC 22989: Discover and Assess are inception, Design and Build are design and development, Validate is verification and validation, Deploy and Operate are deployment and operation, and Improve / Retire covers re-evaluation and retirement. Risk work follows the NIST AI Risk Management Framework, which starts in planning and runs the whole way. The gates come from Stage-Gate: every stage ends in a decision a named person makes.

What I added is the product manager's view on top: who owns the next step, what proof is still missing, and whether it's really ready.

## Who it's for

Mostly for the product manager in the middle of it all, the person keeping data, engineering, legal, security, and the business moving in the same direction. But I built it with a few other people in mind too:

- **The executive sponsor**, who just wants to know: are we OK, and where should I worry?
- **The specialists**, who want to know what's being asked of them and by when.
- **Whoever reviews it later**, who needs to see who decided what, and why.

## The choices I made, and why

### Every team does this a little differently

The whole process (8 stages, from Discover through Operate and Improve) lives in one settings file, not in the code. If your company has its own steps or its own review rules, you change that file and everything in the app follows along.

I didn't want to build something that only works for one team's way of doing things.

### "Done" should mean done

I've seen projects get waved through because someone said the work was done, while the proof was still sitting in an email somewhere. So here, you can't move a project to the next stage just by ticking boxes. The work has to be finished and the proof behind it has to be signed off by someone other than the person who produced it. And if something's holding a project up, the app tells you exactly what it is and who can fix it. No guessing, no chasing people down.

### The right person decides, and "no" is allowed

Every gate names who may decide it, like the Executive Sponsor or the Governance / Risk lead, and the person running the project never approves their own gate. They can say Go, Hold, or Stop. Holding keeps every bit of progress, and stopping early counts as a good outcome, not a failure.

### Small projects shouldn't carry big-project paperwork

A low-risk internal helper tool gets a light plan. Something that makes important decisions about people gets a lot more care: more testing, clear human override, and sign-off from leadership. Change the risk level and the plan adjusts right away.

I think this is what makes people actually want to use a process instead of working around it.

### A score is only useful if it tells you what to do next

Each project gets a readiness score, but it never shows up alone. It always comes with what's behind it, what's missing, and what would move it forward. It also counts things that tend to get skipped, like whether the team running it day to day is ready, and whether people will actually use it.

### The AI helps, people decide

There's a built-in AI advisor you can ask about any part of a project. It can explain and suggest, but it can't approve anything or move a project forward. Those calls stay with people.

It also works for free out of the box, and only uses Claude if you choose to connect it.

## What changed in 2.0, and why

A few weeks after launch I sat down and reviewed the whole thing the way a skeptical design reviewer would. Two findings stung, because they went against the very things I said the Navigator stands for.

**People could sign off their own proof.** The app said "done should mean done," but nothing stopped the person who wrote a piece of evidence from approving it themselves. A few entries in the demo's history showed exactly that. That's the shortcut the whole tool exists to prevent.

**The score and the gate told different stories.** A finished activity earned most of its readiness points even when its proof was missing. So a project could look nearly ready on its score while its gate was firmly shut. If those two disagree, people stop trusting both.

Here's what I changed:

- **Someone else approves the evidence.** Proof moves from draft to review, and then a teammate who isn't its owner approves it with a one-line note. The app remembers who and when, and won't accept any other route.
- **The score follows the gate.** Finished work counts in full only once its proof is approved. Proof in review counts for most of it, a draft for less, and missing proof on gate work counts for nothing.
- **A blocked gate says what to fix first.** When a gate is blocked, the main button is "Resolve next blocker", and just opening a gate to look no longer counts as a failed attempt.
- **Riskier projects prove the idea works before going further.** For moderate and high risk, the feasibility gate now wants a real result on sample data, measured against a bar the team set beforehand.
- **Less to get through.** Starting a project takes a name, a problem, and an owner. The workspace went from seven tabs to five, with the evidence sitting right next to the work it proves. My Overview is now about you, and Portfolio covers everything else.
- **The rules live in one place.** The app itself checks every change, so it doesn't matter which screen made it. A test also walks through the whole demo in a real browser before anything goes live.

None of this added steps for a team that was already doing the work properly. It just makes the shortcuts harder to take, and the score easier to believe.

## What I left out on purpose

- **It's not a compliance system.** It works alongside those tools; it doesn't try to replace them.
- **No shared accounts in the demo.** Everything stays in your own browser, so you can click around freely without bumping into anyone else.
- **No connections to other tools yet** (like Jira). Those come later. I wanted to get the core idea right first.

## How I'd know it's working

If I rolled this out with a real team, here's what I'd watch:

- Are projects moving faster through each stage?
- Are fewer problems showing up after launch that should have been caught earlier?
- Are small, low-risk projects moving quickly, the way they should?
- Are people still updating it a month in, or has it turned into another forgotten spreadsheet?
- Are projects reaching the finish line with real results we can point to?

## What's next

1. Try it with a real team's projects and adjust it based on how they actually work.
2. Let a team share one workspace instead of each person having their own.
3. Connect it to the tools people already use, so nobody has to enter things twice.
4. Add optional rule packs for new regulations as they come along.

## If you're curious how it's built

It's a web app built with React and TypeScript, running on Cloudflare at [navigator.icarianforge.com](https://navigator.icarianforge.com). The core logic is tested automatically every time something changes.

I'd love to hear what you think, especially if you've lived through one of those stuck AI projects yourself.

---

*Everyone and everything in the demo is made up (it's Dunder Mifflin, with The Office cast).*
