# Interview Prep — flashcards

A phone app for engineering-manager and architecture interviews, built from my full prep book:
**1,144 cards in 45 decks** — story bank (STAR), leadership principles, 60-second answers to reported manager questions,
the engineering-manager question bank, system-design method and numbers, **100 system-design questions** worked as mock
interviews with AWS and GCP implementations, data-platform design, SRE / DevOps / Agile, AWS and GCP, data & AI, and a glossary.
Everything is generic — usable for any company.

## Put it on your iPhone
1. Open **https://sudiptoimpmail.github.io/interview-prep/** in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open it from the home screen. It runs full-screen and works offline after the first open.

## How it works
- **Study now** shows cards that are due plus up to 20 new ones. Say your answer, tap to reveal, then grade:
  **Again** (comes back this session), **Got it**, or **Easy**. Swipe right for Got it, left for Again.
- Spaced repetition: a card moves to 1, 3, 7, 16, then 35 days as you keep getting it.
- **Star** cards to make a personal shortlist; **search** across every card; **Settings** for text size, dark mode,
  and a copy/paste backup of your progress (progress lives on the phone only).

## Hosting (GitHub Pages)
Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.

## Files
- `index.html`, `app.css`, `app.js` — the app
- `data/cards.json` — all decks and cards
- `sw.js` — offline support; `manifest.webmanifest`, `icon-*.png` — home-screen name and icon

To update the content, regenerate `data/cards.json` and bump the cache name in `sw.js`.
