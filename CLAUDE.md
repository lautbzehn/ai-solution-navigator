# Forge AI Solution Navigator

Live at [navigator.icarianforge.com](https://navigator.icarianforge.com). Owner: Dan West.

`main` is the single source of truth, and it is what's live. Every merge to `main` is tested, built, and deployed by `.github/workflows/ci.yml`, which then confirms the live site serves the new build. Always start work from the latest `main`.

## What Dan's commands mean

- **"Change ..."**: make the change on a branch from the latest `main`. Run `npm test` and `npm run build`, push, and open a pull request. Don't merge yet. Reply with what changed in plain words, plus a screenshot for anything visual.
- **"Ship"**: merge the open pull request into `main` with a merge commit. That is the deploy. Check the CI run on `main`, then confirm in one line that it's live, or say what failed and fix it.
- **"Change and ship"**: both, in that order. Only merge once tests and build pass.
- **"Ship" with nothing open**: redeploy by running the CI workflow on `main` (workflow_dispatch).

## Rules

- Never push straight to `main`. Pull requests are how tests guard the live site.
- Never put secrets in the repo or in chat. Deploy credentials are GitHub repository secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). The live advisor's `ANTHROPIC_API_KEY` is a Cloudflare secret.
- Copy in the app and docs is plain, warm, and human, like explaining it over coffee. No em dashes.
- Documents carry a version and date (`vX.X` and `mm.dd.yyyy`) in the file name and on the document.
- All demo data is fictional (Dunder Mifflin, with The Office cast).

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run build
```

Architecture and the methodology config are described in `README.md`.
