# Security

## Reporting a vulnerability

Please email **hello@icarianforge.com** with "Security" in the subject line. Do not open a public issue. Include what you found, how to reproduce it, and what an attacker could do with it. I aim to reply within a few days and will credit you if you'd like.

**In scope:** this repository and the live demo at `navigator.icarianforge.com`.

## How the project is protected

| Area | Control |
|---|---|
| Secrets | None in the repository. Deploy credentials are GitHub repository secrets; the Claude key is a Cloudflare secret and never reaches the browser. |
| Live AI advisor | App-only calls (origin and client-header checks), a 64 KB request cap, per-visitor limits (6 a minute, 20 a day, keyed by an anonymous hash, never a raw IP), and a site-wide daily spend cap enforced in a Durable Object. |
| Decisions | The store re-validates every gate decision and gatekeeper on submit; the UI is never trusted. |
| Browser | HSTS, `X-Content-Type-Options: nosniff`, same-origin framing only, `strict-origin-when-cross-origin` referrers, and camera, microphone, location, and payment access disabled. |
| Data | The public demo keeps everything in each visitor's own browser. There are no accounts and no shared database. |
| Supply chain | Dependabot watches npm and GitHub Actions; CI installs from the lockfile with `npm ci`. |

## Supported versions

Only the latest `main`, which is what the live demo serves.
