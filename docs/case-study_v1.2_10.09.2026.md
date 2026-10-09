# The story behind the Navigator

**v1.2 · 10.09.2026** · Dan West · [Try the live demo](https://navigator.icarianforge.com)

---

## Why I built this

If you've worked on an AI project inside a big company, you probably know this feeling. The pilot goes well, everyone's excited, and then things get stuck somewhere between "this works" and "this is live." Nobody's quite sure what stage it's in, what's still missing, or whose turn it is.

I wanted one place that answers those questions plainly, for every AI project at once. That's the Navigator.

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

I've seen projects get waved through because someone said the work was done, while the proof was still sitting in an email somewhere. So here, you can't move a project to the next stage just by ticking boxes. The work has to be finished and the proof behind it has to be signed off. And if something's holding a project up, the app tells you exactly what it is and who can fix it. No guessing, no chasing people down.

### Small projects shouldn't carry big-project paperwork

A low-risk internal helper tool gets a light plan. Something that makes important decisions about people gets a lot more care: more testing, clear human override, and sign-off from leadership. Change the risk level and the plan adjusts right away.

I think this is what makes people actually want to use a process instead of working around it.

### A score is only useful if it tells you what to do next

Each project gets a readiness score, but it never shows up alone. It always comes with what's behind it, what's missing, and what would move it forward. It also counts things that tend to get skipped, like whether the team running it day to day is ready, and whether people will actually use it.

### The AI helps, people decide

There's a built-in AI advisor you can ask about any part of a project. It can explain and suggest, but it can't approve anything or move a project forward. Those calls stay with people.

It also works for free out of the box, and only uses Claude if you choose to connect it.

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
