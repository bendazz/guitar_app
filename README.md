# Orkney Transposer

A small personal web app for transposing note sequences and viewing the
resulting fingerings on a guitar in **Orkney tuning** (C-G-D-G-C-D), drawn
from an upside-down (lefty-flipped) playing perspective — treble strings
on top, bass on bottom.


## Features

- Type in a sequence of notes via on-screen buttons.
- Pick a source key and a target key; the sequence is transposed and
  re-spelled using the target key's accidentals.
- Click any transposed note to see all available fingerings at fret 7
  and above.
- Click a dot to lock that fingering in for that note.
- Press play to step through the sequence visually at a chosen tempo.

No audio — purely visual.

## Develop

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

```bash
npm run deploy
```

This builds and pushes `dist/` to the `gh-pages` branch of `origin`. Then
in the repo's GitHub Settings → Pages, set the source to the `gh-pages`
branch.

`vite.config.ts` uses `base: './'`, so the build works regardless of the
repo's name or whether it's hosted as a user or project page.
