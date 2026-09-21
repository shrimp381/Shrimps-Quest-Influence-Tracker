# Shrimp's Enhanced Horizons

A floating, draggable **parallax horizon** window for Foundry VTT scenes — the same core
window, layer terrain and Points-of-Interest table as the free
[Shrimp's Distant Horizons](https://github.com/Shrimp381/shrimps-distant-horizons), plus a
handful of deeper tools built on top of it.

## What's in this module (v0.1.0)

Everything the free module does — floating/dockable window, 6-layer parallax terrain with
custom-image uploads, draggable POIs with Unknown/Rumored/Discovered states, day/night,
GM/Player view, Lock View, Free Dock, per-scene save + live GM→player sync — **plus:**

- **Journal-linked POIs.** Link any POI to one of your world's real Journal Entries from
  the POI table's "Journal" column. Once that POI is Discovered, a small journal badge
  appears on its marker — click it (as GM or player) to open the real entry in Foundry's
  own journal sheet. The Journal Entries panel (Settings → Journal Entries) is a read-only
  mirror of your world's Journal sidebar, kept live via Foundry's own hooks.
- **Presets.** Save the current layers, POIs, palette and horizon length as a named preset
  (Settings → Presets), then load it again later — on this scene or a different one.
  Presets are world-scoped (`game.settings`), so every GM in the world shares the same
  library and sees updates immediately.
- **Procedural horizon generator.** Pick a biome (or "Random"/"Combo" to mix two), a
  ruggedness, and a POI density, then generate a full 6-layer horizon with placed POIs from
  a seed (Settings → Procedural Generator). The same seed always produces the same result.
- **Vantage Point.** A one-click expanded diorama view — layers pull apart on a simulated
  depth axis instead of blending flatly, like a popup book. It temporarily grows to fill the
  whole module window (collapsing the Layers/POI panel below it) so there's more room to see
  each layer; toggle it off to return to the normal view. Purely a local display toggle —
  never saved or synced, works the same whether the window is docked or undocked.

**What ships pre-populated vs. blank (on a scene with no saved setup yet):**
- The 6 horizon **layers** come with sensible default terrain so there's something to look
  at immediately — edit, reorder, replace, or run the Procedural Generator to build a new one.
- **Points of Interest start empty.** Use "+ Add POI" or the generator to place some.

## What was deliberately left out of this v0.1.0

This module started life as a heavier, planned "premium" companion to the free Distant
Horizons module — a waypoint/journey mode, a party-position tracker on the horizon, and a
fog-of-war-style discovery veil for Vantage Point were all prototyped alongside the four
features above. None of those felt like they'd earned a premium tier yet, so they were cut
from this release; this v0.1.0 only ships the four features that felt genuinely useful on
their own. They may return in a future version.

## Installing in Foundry VTT

**Manifest URL** (once this repo is published — see below):

```
https://raw.githubusercontent.com/Shrimp381/shrimps-enhanced-horizons/main/module.json
```

In Foundry: **Add-on Modules → Install Module**, paste that URL into the **Manifest URL**
field, and click **Install**. Then enable it from your world's **Manage Modules** list.

Once enabled, open a scene and look in the **Notes** controls group (the same toolbar
group journal pins live in, on the left-hand side of the canvas) for a mountain-range
icon — click it to show or hide the Enhanced Horizons window.

## Project structure

```
shrimps-enhanced-horizons/
├── module.json               Foundry module manifest
├── scripts/
│   └── enhanced-horizons.js  All UI logic (esmodule)
├── styles/
│   └── enhanced-horizons.css
├── assets/
│   ├── shrimp-logo.png
│   ├── forest-hand-1.png
│   └── forest-hand-2.png
├── LICENSE
└── README.md
```

---

## Publishing / updating this on GitHub (manual browser upload — no git CLI)

This project publishes every module through the GitHub website directly, not the `git`
command line. Full steps live in the project's own
**"GitHub manual upload process"** doc; short version:

### First time publishing
1. On github.com, create a new **public** repo named exactly `shrimps-enhanced-horizons`
   (matches `module.json`'s `"id"`). Don't initialize it with a README/license — this
   folder already has them.
2. On the empty repo page, click **uploading an existing file** and drag in the
   **contents** of this folder (`module.json`, `scripts/`, `styles/`, `assets/`,
   `README.md`, `LICENSE`) — not a zip, and not a wrapping parent folder. Commit.
3. Create the release (below) — this is what actually makes the module installable.

### Updating later
1. Confirm `module.json`'s `"version"` has been bumped for the new release.
2. On the repo, replace each changed file (open it → pencil/edit icon, or use
   **Add file → Upload files** to drag a same-named replacement over it). Commit.
3. Create a new release (below) tagged to match the new version.

### Every release: create the GitHub Release with the zip attached
This is the step that actually makes the module downloadable/updatable in Foundry — the
repo files alone aren't enough, since `module.json`'s `"download"` field points at a
release asset.

1. Repo → **Releases** → **Create a new release**.
2. **Tag**: `v0.1.0` (must match `module.json`'s `"version"`, prefixed with `v`).
3. **Release title**: `v0.1.0` (or a short description).
4. **Description**: a brief changelog.
5. **Attach the module zip** — drag it into "Attach binaries". It **must be named
   `module.zip`** exactly (matching the `download` URL's expected filename,
   `.../releases/latest/download/module.zip`), or Foundry's install/update will 404.
6. Leave "Set as the latest release" checked. Click **Publish release**.

### Verifying it worked
- Paste the manifest URL above into a browser — it should show raw JSON with the right
  version, not a 404.
- Paste the `download` URL into a browser — it should trigger a `module.zip` download.
- In Foundry, **Install Module** with the manifest URL and confirm the version shown.

## Listing on Foundry's official package directory (optional)

Once you're happy with a release, submit the module at
[foundryvtt.com/community/manage-packages](https://foundryvtt.com/community/manage-packages)
using the manifest URL above.
