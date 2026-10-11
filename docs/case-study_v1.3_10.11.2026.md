# The story behind the Navigator

**v1.3 · 10.11.2026** · Dan West · [Try the live demo](https://navigator.icarianforge.com)

---

## Why I built this

If you've worked on an AI project inside a big company, you probably know this feeling. The pilot goes well, everyone's excited, and then things get stuck somewhere between "this works" and "this is live." Nobody's quite sure what stage it's in, what's still missing, or whose turn it is.

I wanted one place that answers those questions plainly, for every AI project at once. That's the Navigator.

## Who it's for

Mostly for the product manager in the middle of it all, the person keeping data, engineering, legal, security, and the business moving in the same direction. But I built it with a few other people in mind too:

- **The executive sponsor**, who just wants to know: are we OK, and where should I worry?
- **The specialists**, who want to know what's being asked of them and by when.
- **Whoever reviews it later**, who needs to see who decided what, and why.

## What changed in v1.3

The first version followed 8 stages. People told me it felt heavy, and they were right. Most AI ideas don't fail in the build. They fail because nobody tested the idea cheaply before spending real money on it.

So v1.3 has five stages and one big rule: **prove it small before you build it big.**

1. **Frame:** is this a problem worth testing with AI? Ends when the sponsor agrees to fund a small test.
2. **Prove:** a short, time-boxed proof of concept on real data with a handful of users. Ends at the Proof gate.
3. **Build:** build it for real, with the evaluation and controls its risk level needs.
4. **Launch:** release it to a pilot group, watch it closely, then expand to everyone.
5. **Run:** keep it working, and once a quarter decide whether it's still worth it.

The plan asks for about 30% less required work than before (26 activities instead of 37 for a low-risk tool, 41 instead of 57 for a high-risk one), without dropping any of the checks that actually protect people.

## The choices I made, and why

### Start small, then earn the right to scale

Before a proof of concept starts, the sponsor and team agree on a short charter: what we believe will happen, how long we'll test it (4 weeks by default), how much we'll spend, how many people will try it, and what "good enough" looks like. Writing the bar down first matters. If you set it afterwards, every test looks like a success.

When the time is up, the **Proof gate** reads the results against that charter and gives a **Scale Potential** score from 0 to 100. It weighs quality, the value signal, what it will cost to run, data readiness, whether pilot users want to keep it, and how committed the sponsor is. Then the sponsor makes one of four calls: **scale**, **iterate** (try once or twice more with a new charter), **pivot** (go back and rethink), or **stop**.

### Stopping early is a good outcome

Every gate can now stop or park a project, not just the Proof gate. A stopped project keeps its lesson, so the next team doesn't repeat it. The dashboard shows the **kill rate** (how many tested ideas were stopped before build money) and the **time to stop**. A healthy portfolio stops some ideas, and stops them quickly. If nothing ever gets stopped, the bar is probably too low.

### The right person decides

Each gate names who can decide it, like the executive sponsor or the operations lead, and it's never the project's own owner. Every decision needs a short reason, and it lands in the decision log. Just opening a gate to look at it isn't a decision, so it no longer counts as a failed attempt. Only asking to move forward before the work is ready does.

### Every team does this a little differently

The whole process lives in one settings file, not in the code. If your company has its own steps or its own review rules, you change that file and everything in the app follows along.

### "Done" should mean done

You can't move a project forward just by ticking boxes. The work has to be finished and the proof behind it has to be signed off. If something's holding a project up, the app tells you exactly what it is, who owns it, and takes you straight to it.

### Small projects shouldn't carry big-project paperwork

A low-risk internal helper gets a light plan. Something that makes important decisions about people gets a lot more care: more testing, clear human override, and sign-off from leadership. Change the risk level and the plan adjusts right away.

### A score is only useful if it tells you what to do next

Each project gets a readiness score, but it never shows up alone. It always comes with what's behind it, what's missing, and what would move it forward.

### The AI helps, people decide

There's an AI advisor you can ask about any part of a project. It can explain and suggest, but it can't approve anything or move a project forward. Those calls stay with people.

The public demo can now use Claude live, with guardrails so it stays affordable and hard to abuse: a few questions a minute per visitor, a daily cap per visitor, a site-wide daily budget, and a log of every call's tokens and cost. When any limit is reached, the built-in guidance takes over, so the app never just breaks.

## What I left out on purpose

- **It's not a compliance system.** It works alongside those tools; it doesn't try to replace them.
- **No shared accounts in the demo.** Everything stays in your own browser, so you can click around freely without bumping into anyone else.
- **No connections to other tools yet** (like Jira). Those come later.

## How I'd know it's working

If I rolled this out with a real team, here's what I'd watch:

- How many ideas get tested, and how many get stopped before build money? (A kill rate of zero is a warning sign.)
- How long does it take to stop an idea that isn't working?
- Are projects that passed the Proof gate reaching production with the value they promised?
- Are fewer problems showing up after launch that should have been caught earlier?
- Are people still updating it a month in, or has it turned into another forgotten spreadsheet?

## What's next

1. Try it with a real team's projects and adjust it based on how they actually work.
2. Let a team share one workspace instead of each person having their own.
3. Connect it to the tools people already use, so nobody has to enter things twice.
4. Add optional rule packs for new regulations as they come along.

## If you're curious how it's built

It's a web app built with React and TypeScript, running on Cloudflare at [navigator.icarianforge.com](https://navigator.icarianforge.com). The core logic is tested automatically every time something changes, and every change goes live only after those tests pass.

I'd love to hear what you think, especially if you've lived through one of those stuck AI projects yourself.

---

*Everyone and everything in the demo is made up (it's Dunder Mifflin, with The Office cast).*
