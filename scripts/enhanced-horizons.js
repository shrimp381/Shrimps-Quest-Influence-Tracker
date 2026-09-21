/**
 * Shrimp's Enhanced Horizons
 * A parallax horizon + points-of-interest overlay for the Foundry VTT
 * scene view, with journal-linked POIs, save/load layout presets, a
 * procedural horizon generator, and an expanded diorama "Vantage Point"
 * view.
 *
 * STATUS: v0.1.0 — first module release of the feature set trimmed down
 * from the paid-tier prototype (see the README's Roadmap section). Layer
 * terrain is pre-populated with sensible defaults, ready to edit; Points
 * of Interest start empty — the GM adds their own via "+ Add POI" or the
 * procedural generator. Scene layout (layers, POIs, horizon length,
 * day/night, view lock) saves to and loads from the active scene, exactly
 * like the free "Distant Horizons" module this one is built on top of.
 */

const MODULE_ID = 'shrimps-enhanced-horizons';
const MODULE_BASE = `modules/${MODULE_ID}/`;

// The window's markup, ported from the prototype almost unchanged — the
// only removal is the prototype's own mock battlemap backdrop (#stage),
// which stood in for the real VTT canvas when the UI was being tested on
// its own; inside Foundry the real canvas is already there, so injecting
// a fake one on top of it would just hide the game.
const DISTANT_HORIZONS_MARKUP = `

<div id="dh-window">

  <div id="dh-free-dock-handle" title="Drag to reposition — this browser only">
    <span></span><span></span><span></span>
  </div>

  <div id="dh-titlebar">
    <div id="dh-draghandle">
      <span id="dh-logo" aria-hidden="true"></span>
      <div style="display:flex; flex-direction:column; line-height:1.15; min-width:0;">
        <span id="dh-title">Enhanced Horizons</span>
        <span id="dh-subtitle" class="mono">GM view · double-click to dock</span>
      </div>
    </div>

    <div class="segmented" id="view-toggle">
      <button data-mode="gm" class="active">GM</button>
      <button data-mode="player">Player</button>
    </div>

    <div class="segmented icon-segmented" id="daytime-toggle">
      <button data-time="day" class="active" title="Day"></button>
      <button data-time="night" title="Night"></button>
    </div>

    <button class="cog-btn" id="lock-view-btn" title="Lock view (stop players scrolling)" aria-label="Lock view"></button>

    <button class="cog-btn" id="cog-btn" title="Settings" aria-label="Settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
  </div>

  <div id="horizon-wrap">
    <div id="horizon-view">
      <div id="layers-container" style="position:absolute; inset:0;"></div>
      <div id="vignette"></div>
      <div id="layer-hud" class="hud"><b id="layer-count-text">6</b>/6 layers</div>
      <button class="vantage-toggle-btn" id="vantage-toggle-btn" title="Vantage Point — expanded diorama view" aria-label="Vantage Point">Vantage Point</button>

      <span id="drag-hint">← drag to scan · drag a POI to place it →</span>
    </div>
    <div id="compass-hud" class="hud">
      <span id="compass-text">N 0°</span>
    </div>
  </div>

  <div id="controls">

    <div id="panel-layers" class="panel">
      <h2>
        <span style="display:inline-flex; align-items:center; gap:5px;">
          Layers
          <button class="info-btn" id="layers-info-btn" title="Custom image guidance" aria-label="Custom image guidance">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="11" x2="12" y2="16.5"></line><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"></circle></svg>
          </button>
        </span>
        <span class="label" style="font-weight:400;">toggle · X/Y · image</span>
      </h2>
      <div class="quick-apply">
        <select id="quick-biome-select"></select>
        <button class="btn" id="quick-biome-apply">Apply&nbsp;all</button>
      </div>
      <div id="layer-rows"></div>
    </div>

    <div id="panel-pois" class="panel">
      <h2>
        Points of Interest
        <button class="btn" id="add-poi-btn">+ Add POI</button>
      </h2>
      <div id="poi-table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:27%;">Name</th>
              <th style="width:26%;">Icon</th>
              <th style="width:10%;">Layer</th>
              <th style="width:7%;">Size</th>
              <th style="width:15%;">State</th>
              <th style="width:16%;">Journal</th>
              <th style="width:12%; text-align:right;">—</th>
            </tr>
          </thead>
          <tbody id="poi-list"></tbody>
        </table>
      </div>
    </div>

  </div>

  <div id="dh-resize-handle" title="Drag to resize — this is the minimum size"></div>
</div>

<div id="layers-info-popup" class="info-popup" hidden>
  <h4>Custom Layer Images</h4>
  <p>Recommended: a wide, short PNG (transparent background) drawn as a horizon silhouette — around <code>2400×400px</code> to <code>3600×600px</code>, roughly 6:1 wide. It's stretched to fill the layer's height and tiled sideways, so keep the important shapes clear of the very top/bottom edges.</p>
  <p><strong>Seamless tiling</strong> — when the image's left and right edges don't already line up, turn on <em>Seamless mirror tiling</em> next to the upload (on by default). It mirrors the image and tiles <code>[image][flipped copy]</code> alternately — that guarantees a perfect, jump-free loop for any image, at the cost of every other tile appearing mirrored.</p>
  <p>Prefer a true unbroken loop with no mirroring? Author the source image so its leftmost and rightmost columns already match, then turn tiling off.</p>
  <p><strong>Solid base</strong> — layers can be dragged vertically, which opens a gap beneath artwork that doesn't already reach the bottom edge. For best results, draw your image with a flat, solid-colour base near the bottom (like the bundled Forest presets). If you don't, the module will only fill the exact gap your drag creates, straight down from wherever your art already stops — it won't guess a shape for you, so any hole left by incomplete artwork is yours to fix in the source image.</p>
</div>

<div id="dh-settings" hidden>
  <h3>Compass</h3>
  <div class="setting-sub">
    <select id="opt-compass-mode">
      <option value="full" selected>Full — cardinal + degrees</option>
      <option value="simple">Simple — cardinal only</option>
      <option value="off">Hidden</option>
    </select>
  </div>
  <div class="setting-sub" id="compass-opacity-row">
    <span class="label">Compass opacity</span>
    <input type="range" id="opt-compass-opacity" min="20" max="100" value="80">
  </div>
  <div class="gm-only">
    <div class="setting-row">
      <label for="opt-draghint">Show drag hint</label>
      <input type="checkbox" id="opt-draghint" checked>
    </div>
  </div>
  <hr>
  <h3>Palette</h3>
  <div class="setting-sub">
    <select id="opt-palette">
      <option value="obsidian">Obsidian &amp; Brass</option>
      <option value="verdant">Verdant Camp</option>
      <option value="crimson">Crimson Watch</option>
      <option value="arcane">Arcane Violet</option>
      <option value="ancient">Ancient Parchment</option>
      <option value="desert">Desert Sands</option>
      <option value="hellscape">Hellscape</option>
      <option value="shadow">Shadow</option>
      <option value="fey">Feywild</option>
    </select>
  </div>
  <div class="gm-only">
    <hr>
    <h3>POI Icons</h3>
    <div class="setting-row">
      <label for="opt-fullcolour">Full-colour icons</label>
      <input type="checkbox" id="opt-fullcolour">
    </div>
    <div class="setting-note">Off (default): icons tint to their layer's colour. On: icons render in their own colours or, for uploads, the original image.</div>
  </div>
  <div class="gm-only">
    <hr>
    <h3>Horizon Length</h3>
    <div class="setting-sub">
      <select id="opt-horizon-length">
        <option value="far" selected>Far</option>
        <option value="medium">Medium</option>
        <option value="close">Close</option>
      </select>
    </div>
    <div class="setting-note" id="horizon-length-desc">Full-length horizon — more dragging to scan the whole view.</div>
  </div>
  <div class="gm-only">
    <hr>
    <h3>Docking</h3>
    <div class="setting-row">
      <label for="opt-free-dock">Free Dock</label>
      <input type="checkbox" id="opt-free-dock">
    </div>
    <div class="setting-note">When docked, drag the small handle above the strip to move it anywhere on your own screen instead of the auto-centred position. This is per-browser — it isn't shared with other players.</div>
  </div>
  <div class="gm-only">
    <hr>
    <h3>Presets</h3>
    <div class="eh-inline-row">
      <input type="text" id="preset-name-input" placeholder="Preset name…" maxlength="40">
      <button class="btn" id="preset-save-btn">Save</button>
    </div>
    <div class="eh-list" id="preset-list"></div>
    <div class="setting-note">Saves the current layers, POIs, palette and horizon length as a named preset you can reload later, or swap onto a different scene. Shared with every GM in this world.</div>
  </div>
  <div class="gm-only">
    <hr>
    <h3>Journal Entries</h3>
    <div class="eh-list" id="journal-list"></div>
    <div class="setting-note">This mirrors Foundry's own Journal sidebar. Link an entry to a POI from its row in the table below; once that POI is Discovered, players see a small journal badge on it that opens the real entry.</div>
  </div>
  <div class="gm-only">
    <hr>
    <h3>Procedural Generator</h3>
    <div class="setting-sub">
      <span class="label">Biome</span>
      <select id="gen-biome-select">
        <option value="mountains">Mountains</option>
        <option value="hills">Hills</option>
        <option value="desert">Desert</option>
        <option value="forest">Forest</option>
        <option value="random">Random</option>
        <option value="combo">Combo (mix two)</option>
      </select>
    </div>
    <div class="setting-sub" id="gen-combo-row" hidden>
      <span class="label">Mix</span>
      <select id="gen-combo-a">
        <option value="mountains">Mountains</option>
        <option value="hills">Hills</option>
        <option value="desert">Desert</option>
        <option value="forest">Forest</option>
      </select>
      <select id="gen-combo-b">
        <option value="mountains">Mountains</option>
        <option value="hills" selected>Hills</option>
        <option value="desert">Desert</option>
        <option value="forest">Forest</option>
      </select>
    </div>
    <div class="setting-sub">
      <span class="label">Ruggedness</span>
      <select id="gen-ruggedness-select">
        <option value="calm">Calm</option>
        <option value="rugged" selected>Rugged</option>
        <option value="jagged">Jagged</option>
      </select>
    </div>
    <div class="setting-sub" id="gen-density-row">
      <span class="label">POI density: <span id="gen-density-val">4</span></span>
      <input type="range" id="gen-density-slider" min="2" max="8" value="4">
    </div>
    <div class="eh-inline-row">
      <input type="text" id="gen-seed-input" placeholder="Seed (optional)" maxlength="24">
      <button class="btn" id="gen-randomize-btn" title="Random seed">🎲</button>
    </div>
    <button class="btn" id="gen-generate-btn" style="align-self:flex-start;">Generate horizon</button>
    <div class="setting-note">Replaces the current layers and POIs with a procedurally built horizon from these parameters — same seed always builds the same result.</div>
  </div>
  <div class="gm-only">
    <hr>
    <h3>Window</h3>
    <button class="btn" id="dh-reset-btn">Reset position</button>
  </div>
</div>
`;

function injectDistantHorizonsMarkup(){
  if (document.getElementById('dh-window')) return; // already injected
  const holder = document.createElement('div');
  holder.id = 'shrimp-enhanced-horizons-root';
  holder.innerHTML = DISTANT_HORIZONS_MARKUP;
  document.body.appendChild(holder);
}

function initDistantHorizonsUI(){
  "use strict";

  const ICONS = {
    lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="1.5"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>`,
    unlock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="1.5"></rect><path d="M8 10V7a4 4 0 0 1 7.4-2.1"></path></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path><path d="M6 7l1 13h10l1-13"></path></svg>`,
    upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"></path><path d="M6 10l6-6 6 6"></path><path d="M4 20h16"></path></svg>`,
    clear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>`,
    eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12C4.5 7 8 4.5 12 4.5S19.5 7 22 12c-2.5 5-6 7.5-10 7.5S4.5 17 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"></circle><path d="M12 2v2.6M12 19.4V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.6M19.4 12H22M4.2 19.8L6 18M18 6l1.8-1.8"></path></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5Z"></path></svg>`,
    sliders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"></line><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"></circle><line x1="4" y1="12" x2="20" y2="12"></line><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"></circle><line x1="4" y1="18" x2="20" y2="18"></line><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none"></circle></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"></path></svg>`,
    journal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"></path><line x1="4" y1="19.5" x2="20" y2="19.5"></line></svg>`
  };

  const STORAGE = {
    layersUpload: 'worlds/<world-id>/enhanced-horizons/layers/',
    poisUpload: 'worlds/<world-id>/enhanced-horizons/pois/'
  };

  const layerConfig = [
    { id:1, color:"#0b0e14", speed:1.0,  baseZ:60, scale:1.0, enabled:true, biome:"mountains-1", yOffset:0, xOffset:0, customImage:null, customImageName:null, customImageRaw:null, mirrorTile:true, tintToColor:true, imageSettingsOpen:false, customImageBuiltin:false },
    { id:2, color:"#232a3d", speed:0.8,  baseZ:50, scale:0.9, enabled:true, biome:"mountains-2", yOffset:0, xOffset:0, customImage:null, customImageName:null, customImageRaw:null, mirrorTile:true, tintToColor:true, imageSettingsOpen:false, customImageBuiltin:false },
    { id:3, color:"#3d4863", speed:0.6,  baseZ:40, scale:0.8, enabled:true, biome:"img:forest-1", yOffset:0, xOffset:0, customImage:null, customImageName:null, customImageRaw:null, mirrorTile:true, tintToColor:true, imageSettingsOpen:false, customImageBuiltin:false },
    { id:4, color:"#5c6a89", speed:0.4,  baseZ:30, scale:0.7, enabled:true, biome:"hills-1",      yOffset:0, xOffset:0, customImage:null, customImageName:null, customImageRaw:null, mirrorTile:true, tintToColor:true, imageSettingsOpen:false, customImageBuiltin:false },
    { id:5, color:"#8b96ac", speed:0.2,  baseZ:20, scale:0.6, enabled:true, biome:"mountains-3",  yOffset:0, xOffset:0, customImage:null, customImageName:null, customImageRaw:null, mirrorTile:true, tintToColor:true, imageSettingsOpen:false, customImageBuiltin:false },
    { id:6, color:"#c7cedb", speed:0.05, baseZ:10, scale:0.5, enabled:true, biome:"mountains-1",  yOffset:0, xOffset:0, customImage:null, customImageName:null, customImageRaw:null, mirrorTile:true, tintToColor:true, imageSettingsOpen:false, customImageBuiltin:false },
  ];

  // Terrain shading ramp (foreground → farthest) per colour palette, so the
  // layers themselves re-tint when the GM switches palette in settings.
  const LAYER_PALETTES = {
    obsidian:  ["#0b0e14","#232a3d","#3d4863","#5c6a89","#8b96ac","#c7cedb"],
    verdant:   ["#0a140d","#173321","#254a30","#3a6a45","#5e8f68","#a8c9a0"],
    crimson:   ["#150a0c","#331419","#4d1f26","#6e2c35","#9c4a52","#d6a2a8"],
    arcane:    ["#0d0b16","#211a3a","#332a5c","#4a3e82","#6f5fb0","#b3a6e6"],
    ancient:   ["#2a1c0f","#4a3220","#6e4f32","#93714a","#b89a6e","#dcc9a0"],
    desert:    ["#241408","#4a2c12","#6e4318","#9c6624","#c9903c","#f0c878"],
    hellscape: ["#0a0605","#2a0f0a","#4d1810","#7a2415","#b03a1a","#e86a2a"],
    shadow:    ["#08090b","#181b1f","#2a2e34","#454b53","#6b7278","#a8b0b8"],
    fey:       ["#0a0f1c","#1a2440","#2a3866","#3f5a92","#5f8ab8","#a8d4d8"],
  };
  function applyLayerPaletteColors(paletteName){
    const ramp = LAYER_PALETTES[paletteName] || LAYER_PALETTES.obsidian;
    layerConfig.forEach((layer, i) => { layer.color = ramp[i] || layer.color; });
  }

  /* ---------------- Biomes: 3 procedural families × 3 numbered variants,
     plus Forest, which is entirely the two hand-drawn images below. ---------------- */
  const BIOME_FAMILIES = [
    { key:'mountains', label:'Mountains', singular:'Mountain' },
    { key:'hills',     label:'Hills',     singular:'Hill' },
    { key:'desert',    label:'Desert',    singular:'Desert' },
  ];
  const VARIANT_PARAMS = {
    1: { seedMul:1.0, seedAdd:0,   ampMul:1.0  },
    2: { seedMul:1.6, seedAdd:57,  ampMul:1.18 },
    3: { seedMul:2.3, seedAdd:113, ampMul:0.82 },
  };
  // Forest has no procedural generator — it's just these two hand-drawn
  // images (value prefixed "img:"). Picking one sets the layer's custom
  // image straight from the bundled asset, still going through the
  // mirror-tile / tint-to-colour pipeline like a manual upload.
  const BUILTIN_LAYER_IMAGES = {
    forest: [
      { key:'forest-1', label:'Forest 1', src: MODULE_BASE + 'assets/forest-hand-1.png' },
      { key:'forest-2', label:'Forest 2', src: MODULE_BASE + 'assets/forest-hand-2.png' },
    ],
  };
  function biomeOptionsHtml(selected){
    const proceduralHtml = BIOME_FAMILIES.map(fam => {
      const opts = [1,2,3].map(v => {
        const val = `${fam.key}-${v}`;
        return `<option value="${val}" ${val===selected?'selected':''}>${fam.singular} ${v}</option>`;
      }).join('');
      return `<optgroup label="${fam.label}">${opts}</optgroup>`;
    }).join('');
    const forestOpts = BUILTIN_LAYER_IMAGES.forest
      .map(b => `<option value="img:${b.key}" ${('img:'+b.key)===selected?'selected':''}>${b.label}</option>`).join('');
    return proceduralHtml + `<optgroup label="Forest">${forestOpts}</optgroup>`;
  }

  const ICON_LABELS = {
    tower:'Tower', mine:'Mineshaft', cave:'Cave', camp:'Camp', ruins:'Ruins',
    bridge:'Bridge', danger:'Danger', village:'Village', tree:'Grove', water:'Water'
  };
  const ICON_FULLCOLOUR = {
    tower:'#9aa1ad', mine:'#7a5236', cave:'#2b2f38', camp:'#d1793f', ruins:'#ab9c80',
    bridge:'#7f92a6', danger:'#b7402f', village:'#caa159', tree:'#4f7d4c', water:'#3f80a8'
  };
  const POI_ICON_DEFS = {
    tower:  (f) => `<svg viewBox="0 0 60 100" width="100%" height="100%" fill="${f}"><path d="M10,100 L10,30 L0,30 L0,10 L15,10 L15,30 L25,30 L25,10 L40,10 L40,30 L30,30 L30,10 L45,10 L45,30 L60,30 L60,100 Z"/></svg>`,
    mine:   (f) => `<svg viewBox="0 0 100 80" width="100%" height="100%" fill="${f}"><polygon points="10,80 30,20 70,20 90,80"/><path d="M40,80 L40,40 L60,40 L60,80 Z" fill="rgba(255,255,255,0.18)"/></svg>`,
    cave:   (f) => `<svg viewBox="0 0 120 70" width="100%" height="100%" fill="${f}"><path d="M0,70 Q40,0 60,0 T120,70 Z"/><path d="M40,70 Q50,30 60,30 T80,70 Z" fill="rgba(255,255,255,0.18)"/></svg>`,
    camp:   (f) => `<svg viewBox="0 0 100 80" width="100%" height="100%" fill="${f}"><path d="M50,8 L92,80 L8,80 Z"/><path d="M50,8 L64,80 L36,80 Z" fill="rgba(0,0,0,0.28)"/></svg>`,
    ruins:  (f) => `<svg viewBox="0 0 60 100" width="100%" height="100%" fill="${f}"><rect x="10" y="6" width="12" height="18"/><rect x="18" y="26" width="24" height="58"/><rect x="8" y="84" width="44" height="10"/></svg>`,
    bridge: (f) => `<svg viewBox="0 0 120 60" width="100%" height="100%" fill="${f}"><path d="M0,60 L0,40 Q60,-8 120,40 L120,60 Z"/><rect x="14" y="40" width="8" height="20"/><rect x="98" y="40" width="8" height="20"/></svg>`,
    danger: (f) => `<svg viewBox="0 0 100 90" width="100%" height="100%" fill="${f}"><path d="M50,2 L98,88 L2,88 Z"/><rect x="45" y="30" width="10" height="30" fill="rgba(0,0,0,0.35)"/><rect x="45" y="66" width="10" height="10" fill="rgba(0,0,0,0.35)"/></svg>`,
    village:(f) => `<svg viewBox="0 0 120 70" width="100%" height="100%" fill="${f}"><path d="M4,70 L4,44 L20,28 L36,44 L36,70 Z"/><path d="M44,70 L44,36 L66,16 L88,36 L88,70 Z"/><path d="M96,70 L96,46 L110,34 L120,46 L120,70 Z" opacity="0.9"/></svg>`,
    tree:   (f) => `<svg viewBox="0 0 60 90" width="100%" height="100%" fill="${f}"><path d="M30,0 L50,35 L42,35 L58,60 L48,60 L60,90 L0,90 L12,60 L2,60 L18,35 L10,35 Z"/></svg>`,
    water:  (f) => `<svg viewBox="0 0 120 60" width="100%" height="100%" fill="${f}"><path d="M0,28 Q15,12 30,28 T60,28 T90,28 T120,28 L120,60 L0,60 Z"/></svg>`
  };

  let state = {
    scrollX: 500,
    viewMode: 'gm',
    compactMode: false,
    // Free Dock is a per-browser display preference, not scene data, so it
    // lives in a client-scoped game.settings entry (registered in
    // registerModuleSettings() below) rather than following the world.
    freeDock: game.settings.get(MODULE_ID, 'freeDockEnabled'),
    freeDockPos: null,
    compassMode: 'full',      // 'full' | 'simple' | 'off'
    compassOpacity: 0.8,
    showDragHint: true,
    fullColourIcons: false,
    palette: 'obsidian',
    horizonLength: 'far',   // 'far' | 'medium' | 'close'
    daytime: 'day',         // 'day' | 'night'
    viewLocked: false,      // true = players can't pan/scroll the horizon
    // Ships empty — POIs are scenario-specific, so the GM adds their own
    // via "+ Add POI" rather than starting from placeholder examples.
    // The layer terrain below is the only thing that ships pre-populated
    // (sensible default depth/biome per layer), since that's meant to be
    // edited/replaced, not built from scratch.
    pois: [],
    nextPoiId: 1
  };

  // Declared up here (rather than down by the Vantage Point wiring, where
  // the toggle button and its click handler live) so updateVisuals() —
  // defined and callable well before that point in this function — can
  // always safely read vantageActive without a TDZ error.
  let vantageActive = false;
  let vantagePrevSize = null;

  // Nearest (L1) to farthest, matching every other "layer order" the
  // Vantage Point diorama (depth index) and the generator (layer picks)
  // need — only enabled layers count, in on-screen depth order.
  function orderedEnabledLayerIds(){
    return layerConfig.filter(l => l.enabled).map(l => l.id);
  }

  function defaultOffsetYForLayer(layerId){
    const layer = layerConfig.find(l => l.id === layerId) || layerConfig[3];
    const invertedIdx = 5 - (layer.id - 1);
    const baseY = 130 + (invertedIdx * 46);
    return 400 - baseY;
  }

  // Tile is 3x the old width so the repeat is far less obvious. Every
  // harmonic's frequency MUST be a whole number of cycles across the tile —
  // sin(2π·k·x/width) only lands on the same value at x=0 and x=width when
  // k is an integer, which is what makes the tile edges line up seamlessly
  // under background-repeat. Variety instead comes from each of the 3
  // numbered variants using its own distinct set of integer harmonics.
  const FREQ_SETS = {
    mountains: { 1:[3,7,13,21,34], 2:[4,9,16,27,41], 3:[2,5,11,19,29] },
    hills:     { 1:[2,5,9,15],     2:[3,7,12,20],     3:[1,4,8,14]     },
    desert:    { 1:[2,4,7],        2:[3,6,10],        3:[1,3,6]        },
  };
  const PHASES = [0, 1.7, 3.9, 0.6, 2.4, 5.0];

  // Small deterministic PRNG (mulberry32) — same integer seed always
  // produces the same sequence, so a given layer's jagged peak layout
  // (Mountain 1) stays fixed across re-renders instead of reshuffling
  // every time initLayers() runs.
  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateBiomePath(biomeFull, layerIdx){
    const [family, variantStr] = biomeFull.split('-');
    const variant = parseInt(variantStr, 10) || 1;
    const vp = VARIANT_PARAMS[variant] || VARIANT_PARAMS[1];
    const width = 3600, height = 400;
    const invertedIdx = 5 - layerIdx;
    const baseY = 130 + (invertedIdx * 46);
    let path = `M 0,${height} L 0,${baseY} `;
    const seed = layerIdx * 123.45 * vp.seedMul + vp.seedAdd;

    if (family === 'mountains' && variant === 1) {
      // Mountain 1: a sharp, jagged alpine skyline rather than the
      // smoother rolling profile variants 2/3 use. Summing several sine
      // harmonics (as the other variants do) always washes back out to
      // a rounded hump — sharp features at different frequencies land
      // at different x positions and average each other away. A real
      // jagged range instead reads as a few dominant angular peaks with
      // straight rocky slopes, so this builds that directly: an
      // envelope (max) of several triangular peaks — genuinely sharp,
      // straight-edged points, not an averaged curve — plus a small
      // sawtooth jitter riding on top for rugged edge detail. Peak
      // placement wraps around the tile width so the seam stays exact.
      const rng = mulberry32(Math.floor((seed + 1000) * 977));
      const peakCount = 4 + Math.floor(rng() * 2); // 4–5 bold summits
      const baseAmp = (92 + invertedIdx * 24) * vp.ampMul;
      const peaks = [];
      for (let i=0;i<peakCount;i++){
        const px = ((i + 0.5) / peakCount) * width + (rng() - 0.5) * (width / peakCount) * 0.7;
        const heightMul = 0.4 + Math.pow(rng(), 1.4) * 1.05; // a few short, one or two dramatic
        const halfWidth = (width / peakCount) * (0.24 + rng() * 0.3); // narrow => steep, knife-edge slopes
        peaks.push({ px: ((px % width) + width) % width, h: baseAmp * heightMul, hw: halfWidth });
      }
      const jitterFreqs = [19, 37, 61];
      for (let x=0; x<=width; x+=6) {
        let dy = 0;
        for (const pk of peaks){
          const d = Math.abs(x - pk.px);
          const wrapD = Math.min(d, width - d);
          const tri = Math.max(0, 1 - wrapD / pk.hw);
          dy = Math.max(dy, tri * pk.h);
        }
        // Fine rocky jaggedness — sharp, low-amplitude cusps riding on
        // the main envelope so it roughens slopes without smoothing
        // out the peaks above.
        let jitter = 0, jAmp = 17;
        for (let i=0;i<jitterFreqs.length;i++){
          jitter += (1 - Math.abs(Math.sin((x/width)*Math.PI*2*jitterFreqs[i] + seed*1.7 + i))) * jAmp;
          jAmp *= 0.5;
        }
        dy += jitter;
        path += `L ${x},${baseY-dy} `;
      }
    } else if (family === 'mountains') {
      const freqs = FREQ_SETS.mountains[variant];
      const amps=[(58+(invertedIdx*15))*vp.ampMul, 30*vp.ampMul, 17*vp.ampMul, 9*vp.ampMul, 5*vp.ampMul];
      for (let x=0; x<=width; x+=10) {
        let dy=0;
        for (let i=0;i<freqs.length;i++) dy += Math.abs(Math.sin((x/width)*Math.PI*2*freqs[i]+seed+PHASES[i])) * amps[i];
        path += `L ${x},${baseY-dy} `;
      }
    } else if (family === 'hills') {
      const freqs = FREQ_SETS.hills[variant];
      const amps=[44*vp.ampMul, 26*vp.ampMul, 14*vp.ampMul, 7*vp.ampMul];
      for (let x=0; x<=width; x+=15) {
        let dy=0;
        for (let i=0;i<freqs.length;i++) dy += Math.sin((x/width)*Math.PI*2*freqs[i]+seed+PHASES[i]) * amps[i];
        path += `L ${x},${baseY-dy} `;
      }
    } else if (family === 'desert') {
      const freqs = FREQ_SETS.desert[variant];
      const amps=[32*vp.ampMul, 17*vp.ampMul, 8*vp.ampMul];
      for (let x=0; x<=width; x+=20) {
        let dy=0;
        for (let i=0;i<freqs.length;i++) dy += Math.sin((x/width)*Math.PI*2*freqs[i]+seed+PHASES[i]) * amps[i];
        path += `L ${x},${baseY+44-dy} `;
      }
    }
    // Forest has no procedural case — it's always one of the two
    // hand-drawn images (BUILTIN_LAYER_IMAGES.forest), routed through the
    // customImage path in initLayers() rather than generateBiomePath.
    path += `L ${width},${baseY} L ${width},${height} Z`;
    return path;
  }

  const dhWindow        = document.getElementById('dh-window');
  const container        = document.getElementById('layers-container');
  const compassHud       = document.getElementById('compass-hud');
  const compassText      = document.getElementById('compass-text');
  const layerCountText   = document.getElementById('layer-count-text');
  const dragHintEl       = document.getElementById('drag-hint');
  const layerRowsEl      = document.getElementById('layer-rows');
  const poiListEl        = document.getElementById('poi-list');

  function escapeHtml(str){
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function readImageFile(file, cb){
    const reader = new FileReader();
    reader.onload = () => cb(reader.result);
    reader.readAsDataURL(file);
  }

  // Builds a [image][horizontally-flipped copy] tile on a canvas. Tiling
  // that doubled image with repeat-x is guaranteed seam-free for ANY
  // source image — the flip means every tile boundary lines up pixel-
  // for-pixel with its neighbour, at the cost of every other repeat
  // appearing mirrored.
  function buildMirrorTile(img, cb){
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) { cb(null, null); return; }
    const canvas = document.createElement('canvas');
    canvas.width = w * 2; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    ctx.save();
    ctx.translate(w * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
    cb(canvas.toDataURL('image/png'), { width: w * 2, height: h });
  }

  // Re-derives layer.customImage (what's actually painted) from
  // layer.customImageRaw (what was uploaded) + layer.mirrorTile. Also
  // reports the painted image's pixel dimensions via the callback's
  // second argument — needed to snap the CSS tile width to a whole
  // pixel (see applyCustomImageSize) so repeat-x tiling never lands on
  // a fractional pixel and shows a hairline seam at the repeat edge.
  function processCustomImage(layer, cb){
    if (!layer.customImageRaw) { cb(null, null); return; }
    const img = new Image();
    img.onload = () => {
      if (layer.mirrorTile) {
        buildMirrorTile(img, cb);
      } else {
        cb(layer.customImageRaw, { width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    img.onerror = () => cb(layer.customImageRaw, null);
    img.src = layer.customImageRaw;
  }

  // The current pixel height of the horizon strip — a fixed constant per
  // view mode (168px normal, 158px compact/docked), not something that
  // needs measuring from layout.
  function horizonHeightPx(){
    return state.compactMode ? 158 : 168;
  }

  // Custom-image layers used `background-size/mask-size: auto 100%`,
  // which lets the browser pick a fractional CSS pixel width for the
  // tile (naturalWidth * containerHeight/naturalHeight is essentially
  // never a whole number). A repeat-x background tiled at a fractional
  // width rounds differently at each tile boundary, which shows up as a
  // faint vertical seam line wherever two tiles meet — this is what the
  // "edges aren't seamless" report was seeing, not a flaw in the
  // artwork or the mirror-doubling itself (pixel-level mirror boundary
  // and wrap-around edges are exact, verified byte-for-byte).
  // Fix: keep height as '100%' (that axis never repeats, so it can't
  // seam), but compute the width in real pixels, rounded to a whole
  // number, so every tile repeat lands on an exact pixel boundary.
  function applyCustomImageSize(layer, bgEl){
    const dims = layer.customImageDims;
    const h = horizonHeightPx();
    if (!dims || !dims.width || !dims.height) {
      bgEl.style.webkitMaskSize = bgEl.style.maskSize = 'auto 100%';
      bgEl.style.backgroundSize = 'auto 100%';
      return;
    }
    const wPx = Math.round(dims.width * (h / dims.height));
    const sizeStr = `${wPx}px 100%`;
    bgEl.style.webkitMaskSize = sizeStr;
    bgEl.style.maskSize = sizeStr;
    bgEl.style.backgroundSize = sizeStr;
  }

  // Re-applies the pixel-snapped tile width to every enabled custom-image
  // layer currently in the DOM. Needed whenever the horizon strip's
  // height changes (168px ↔ 158px on compact-mode toggle) since the
  // computed width depends on that height.
  function refreshCustomImageSizes(){
    layerConfig.forEach(layer => {
      if (!layer.enabled || !layer.customImage) return;
      const bgEl = document.getElementById(`layer-bg-${layer.id}`);
      if (bgEl) applyCustomImageSize(layer, bgEl);
    });
  }

  // Shared by the per-layer biome dropdown and "Apply all": a plain value
  // ("mountains-2") sets a procedural biome and clears any custom image;
  // an "img:" value (Forest's built-in hand-drawn presets) resolves that
  // preset through the same pipeline a manual upload goes through.
  // Calls cb() once the layer is ready to redraw.
  function applyBiomeOrImage(layer, val, cb){
    if (val.startsWith('img:')) {
      const key = val.slice(4);
      const preset = Object.values(BUILTIN_LAYER_IMAGES).flat().find(b => b.key === key);
      if (!preset) { cb(); return; }
      layer.biome = val;
      layer.customImageRaw = preset.src;
      layer.customImageName = preset.label;
      layer.mirrorTile = true;
      layer.tintToColor = true;
      layer.imageSettingsOpen = false;
      // A built-in preset (shipped with the module) is just another biome
      // choice, not a user upload — the row stays a plain dropdown like
      // Mountains/Hills/Desert, with none of the upload-specific chip,
      // tiling/tint toggles or "revert to procedural" control.
      layer.customImageBuiltin = true;
      processCustomImage(layer, (finalUrl, dims) => {
        layer.customImage = finalUrl;
        layer.customImageDims = dims;
        cb();
      });
    } else {
      layer.biome = val;
      layer.customImage = null; layer.customImageName = null; layer.customImageRaw = null;
      layer.customImageDims = null;
      layer.customImageBuiltin = false;
      cb();
    }
  }

  // This filler only ever covers the gap a layer's own upward Y-offset
  // opens beneath it (same amount, no more) — it does NOT try to guess or
  // force any extra "safety" fill for a custom image's own artwork. A
  // synthetic flat rectangle taller than that gap looked wrong: a hard
  // straight edge sitting under organic tree silhouettes. Instead, custom
  // images are expected to already reach their own bottom edge solid (see
  // the Layers info popup's upload guidance) — like the bundled Forest
  // presets do — so this filler and the image's own base line up flush.
  function fillerHeightFor(layer){
    return Math.max(0, -layer.yOffset);
  }

  /* ---------------- Horizon layers ---------------- */
  function initLayers(){
    container.innerHTML = '';
    [...layerConfig].reverse().forEach(layer => {
      if (!layer.enabled) return;

      const filler = document.createElement('div');
      filler.className = 'layer-filler';
      filler.id = `layer-fill-${layer.id}`;
      filler.style.zIndex = layer.baseZ;
      filler.style.background = layer.color;
      filler.style.height = `${fillerHeightFor(layer)}px`;
      container.appendChild(filler);

      const bgWrapper = document.createElement('div');
      bgWrapper.className = 'parallax-layer';
      bgWrapper.id = `layer-bg-${layer.id}`;
      bgWrapper.style.zIndex = layer.baseZ;

      if (layer.customImage) {
        if (layer.tintToColor !== false) {
          // Recolour the uploaded silhouette to this layer's palette shade
          // via a CSS mask (same trick as the shrimp logo / POI icons),
          // so a single uploaded image works at any depth and re-tints
          // automatically when the palette changes.
          bgWrapper.classList.add('masked-custom');
          bgWrapper.style.background = layer.color;
          bgWrapper.style.webkitMaskImage = `url("${layer.customImage}")`;
          bgWrapper.style.maskImage = `url("${layer.customImage}")`;
        } else {
          bgWrapper.classList.remove('masked-custom');
          bgWrapper.style.backgroundImage = `url("${layer.customImage}")`;
        }
        applyCustomImageSize(layer, bgWrapper);
      } else {
        const svgPath = generateBiomePath(layer.biome, layer.id - 1);
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3600 400" preserveAspectRatio="none"><path fill="${layer.color}" d="${svgPath}"/></svg>`;
        bgWrapper.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svgString)}")`;
        bgWrapper.style.backgroundSize = '3600px 100%';
      }

      container.appendChild(bgWrapper);
    });
    const activeCount = layerConfig.filter(l => l.enabled).length;
    layerCountText.textContent = activeCount;
    // Re-apply the per-layer depth variables Vantage Point's diorama tilt
    // reads (--vp-depth) — setLayerDepthVars() is a function declaration,
    // so it's hoisted and safe to call from here even though its own
    // definition sits further down the file, by the Vantage Point wiring.
    setLayerDepthVars();
    renderPOIs();
  }

  /* ---------------- POI icon rendering ---------------- */
  function renderIconMarkup(poi, layer){
    if (poi.customIcon) {
      if (state.fullColourIcons) {
        return `<img src="${poi.customIcon}" style="width:100%;height:100%;object-fit:contain;display:block;">`;
      }
      return `<div style="width:100%;height:100%;background:${layer.color};
        -webkit-mask-image:url('${poi.customIcon}'); mask-image:url('${poi.customIcon}');
        -webkit-mask-size:contain; mask-size:contain;
        -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat;
        -webkit-mask-position:center; mask-position:center;"></div>`;
    }
    const defFn = POI_ICON_DEFS[poi.icon] || POI_ICON_DEFS.tower;
    const fill = state.fullColourIcons ? (ICON_FULLCOLOUR[poi.icon] || '#c9a75c') : layer.color;
    return defFn(fill);
  }

  function renderPOIs(){
    document.querySelectorAll('.poi-container').forEach(el => el.remove());

    state.pois.forEach(poi => {
      const layer = layerConfig.find(l => l.id === parseInt(poi.layer, 10));
      if (!layer || !layer.enabled) return;
      if (poi.state === 'hidden') return;

      const poiEl = document.createElement('div');
      const draggable = state.viewMode === 'gm' && !state.compactMode && !poi.locked;
      poiEl.className = 'poi-container' + (draggable ? ' draggable' : '');
      poiEl.id = `poi-${poi.id}`;
      poiEl.style.zIndex = layer.baseZ + 5;

      const SIZE_MUL = { small:0.45, medium:0.7, large:1.0 };
      const visualScale = layer.scale * 1.4 * (SIZE_MUL[poi.size] || SIZE_MUL.large);
      // Name card only appears once a POI is Discovered — Unknown and
      // Rumored give away that *something* is there, but never its name.
      let html = poi.state === 'discovered'
        ? `<div class="tooltip">${escapeHtml(poi.name)}${poi.locked ? ' 🔒' : ''}</div><div class="poi-mark">`
        : `<div class="poi-mark">`;
      if (poi.locked) html += `<span class="lock-badge">${ICONS.lock}</span>`;

      if (poi.state === 'unknown') {
        html += `<div class="poi-rumor" style="font-size:${20+visualScale*4.5}px;">?</div>`;
      } else if (poi.state === 'rumored') {
        const iconMarkup = renderIconMarkup(poi, layer);
        html += `<div class="poi-rumor" style="font-size:${16+visualScale*3.5}px; margin-bottom:2px;">?</div>
                  <div class="poi-icon" style="width:${44*visualScale}px; height:${44*visualScale}px; opacity:0.35;">${iconMarkup}</div>`;
      } else if (poi.state === 'discovered') {
        const iconMarkup = renderIconMarkup(poi, layer);
        html += `<div class="poi-icon" style="width:${44*visualScale}px; height:${44*visualScale}px;">${iconMarkup}</div>`;
      }
      html += `</div>`;
      // A linked journal only ever shows once the POI is fully Discovered —
      // same "don't give away more than the state allows" rule as the name
      // tooltip above.
      const journal = poi.journalId ? game.journal?.get(poi.journalId) : null;
      if (journal && poi.state === 'discovered') {
        html += `<button class="poi-journal-badge" title="Read: ${escapeHtml(journal.name)}" aria-label="Read journal entry">${ICONS.journal}</button>`;
      }
      poiEl.innerHTML = html;

      if (draggable) {
        poiEl.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          poiDrag = { poi, startClientX: e.clientX, startClientY: e.clientY, startXPos: poi.xPos, startOffsetY: poi.offsetY };
        });
      }
      if (journal && poi.state === 'discovered') {
        const badge = poiEl.querySelector('.poi-journal-badge');
        if (badge) badge.addEventListener('mousedown', (e) => e.stopPropagation());
        if (badge) badge.addEventListener('click', (e) => {
          e.stopPropagation();
          journal.sheet.render(true);
        });
      }

      container.appendChild(poiEl);
    });
    updateVisuals();
    // Covers both direct POI edits and layer edits (initLayers() always
    // calls renderPOIs() at its own end) — one debounced save point for
    // almost every persistable mutation. See "Scene persistence + GM →
    // player sync" below for what's actually shared vs. kept local.
    scheduleSave();
  }

  // Pans the horizon so this POI's marker sits in the centre of the view,
  // solved against its own layer's parallax speed and X-offset. Eases
  // there over time instead of jump-cutting, so the GM/players can track
  // where on the horizon they're being moved to.
  let focusAnim = null;
  function focusOnPoi(poi){
    const layer = layerConfig.find(l => l.id === parseInt(poi.layer, 10));
    if (!layer) return;
    const centerPx = horizonView.clientWidth / 2;
    const target = (poi.xPos + layer.xOffset - centerPx) / (layer.speed || 0.0001);
    animatePanTo(target);
  }

  function animatePanTo(targetScrollX, duration = 650){
    if (focusAnim) cancelAnimationFrame(focusAnim.raf);
    const startX = state.scrollX;
    const delta = targetScrollX - startX;
    if (Math.abs(delta) < 0.5) { state.scrollX = targetScrollX; updateVisuals(); return; }
    const startTime = performance.now();
    const easeInOutCubic = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
    focusAnim = { raf: 0 };
    function step(now){
      const t = Math.min(1, (now - startTime) / duration);
      state.scrollX = startX + delta * easeInOutCubic(t);
      updateVisuals();
      if (t < 1) {
        focusAnim.raf = requestAnimationFrame(step);
      } else {
        focusAnim = null;
      }
    }
    focusAnim.raf = requestAnimationFrame(step);
  }

  function updateVisuals(){
    let rawDeg = (state.scrollX / 10) % 360;
    if (rawDeg < 0) rawDeg += 360;
    const directions = ['N','NE','E','SE','S','SW','W','NW'];
    const dirIndex = Math.round(rawDeg / 45) % 8;
    if (state.compassMode === 'simple') {
      compassText.textContent = directions[dirIndex];
    } else {
      compassText.textContent = `${directions[dirIndex]} ${Math.round(rawDeg)}°`;
    }

    layerConfig.forEach(layer => {
      if (!layer.enabled) return;
      const bgEl = document.getElementById(`layer-bg-${layer.id}`);
      if (bgEl) {
        const posX = `${-state.scrollX * layer.speed + layer.xOffset}px`;
        bgEl.style.backgroundPositionX = posX;
        // Recoloured (masked) custom images are painted via mask-image,
        // not background-image — panning has to move the mask position
        // too, or the terrain shape just sits frozen while everything
        // else scrolls past it.
        if (bgEl.classList.contains('masked-custom')) {
          bgEl.style.webkitMaskPositionX = posX;
          bgEl.style.maskPositionX = posX;
        }
        // The Vantage Point diorama tilt is normally a CSS rule keyed off
        // .vantage-active (see setLayerDepthVars()'s --vp-depth), but an
        // inline style always wins over a class selector — so when it's
        // active, fold the same rotateX/translateZ/translateY into this
        // inline transform too, or panning (which runs through here every
        // frame) would silently flatten the diorama back out.
        if (vantageActive) {
          const ordered = orderedEnabledLayerIds();
          const depthIndex = ordered.indexOf(layer.id);
          const depth = depthIndex === -1 ? 0 : depthIndex;
          bgEl.style.transformOrigin = '50% 100%';
          bgEl.style.transform = `translateY(${layer.yOffset}px) rotateX(14deg) translateZ(${depth * -18}px) translateY(${depth * 4}px)`;
        } else {
          bgEl.style.transform = `translateY(${layer.yOffset}px)`;
        }
      }
      const fillEl = document.getElementById(`layer-fill-${layer.id}`);
      if (fillEl) fillEl.style.height = `${fillerHeightFor(layer)}px`;
    });

    state.pois.forEach(poi => {
      const poiEl = document.getElementById(`poi-${poi.id}`);
      if (!poiEl) return;
      const layer = layerConfig.find(l => l.id === parseInt(poi.layer, 10));
      if (!layer) return;
      // POIs pan at their own layer's parallax speed AND follow that
      // layer's manual X/Y nudge, so they stay pinned to the terrain
      // instead of drifting independently when a layer is offset.
      const visualX = poi.xPos - (state.scrollX * layer.speed) + layer.xOffset;
      poiEl.style.transform = `translateX(${visualX}px) translateY(${layer.yOffset}px)`;
      poiEl.style.bottom = `${poi.offsetY}px`;
    });
  }

  /* ---------------- Horizon pan + POI free placement ---------------- */
  const horizonView = document.getElementById('horizon-view');
  let isPanning = false, panLastX = 0;
  let poiDrag = null;

  // Higher multiplier = the same physical drag covers more world-distance,
  // so there's less scrolling needed to scan the whole horizon.
  const HORIZON_LENGTH_MUL = { far: 1.5, medium: 2.4, close: 3.6 };
  function panMultiplier(){ return HORIZON_LENGTH_MUL[state.horizonLength] || HORIZON_LENGTH_MUL.far; }

  // Lock View only restricts panning in Player view — the GM can always
  // scroll (e.g. to set up the shot) before locking it for the players.
  function canPan(){ return !(state.viewLocked && state.viewMode === 'player'); }

  horizonView.addEventListener('mousedown', (e) => {
    if (!canPan()) return;
    isPanning = true; panLastX = e.clientX; horizonView.classList.add('dragging');
  });
  window.addEventListener('mousemove', (e) => {
    if (poiDrag) {
      const dx = e.clientX - poiDrag.startClientX;
      const dy = e.clientY - poiDrag.startClientY;
      poiDrag.poi.xPos = poiDrag.startXPos + dx;
      poiDrag.poi.offsetY = poiDrag.startOffsetY - dy;
      requestAnimationFrame(updateVisuals);
      return;
    }
    if (!isPanning) return;
    state.scrollX -= (e.clientX - panLastX) * panMultiplier();
    panLastX = e.clientX;
    requestAnimationFrame(updateVisuals);
  });
  window.addEventListener('mouseup', () => {
    isPanning = false; horizonView.classList.remove('dragging');
    // A POI drag updates poi.xPos/offsetY directly every frame (via
    // updateVisuals(), not renderPOIs()) so dragging stays smooth — but
    // that means it never went through renderPOIs()'s scheduleSave()
    // call either, so the new position was never saved or pushed to
    // players. Save once here, when the drag actually ends.
    const wasDraggingPoi = !!poiDrag;
    poiDrag = null;
    if (wasDraggingPoi) scheduleSave();
  });

  horizonView.addEventListener('touchstart', (e) => {
    if (!canPan()) return;
    isPanning = true; panLastX = e.touches[0].clientX;
  }, {passive:true});
  window.addEventListener('touchmove', (e) => {
    if (!isPanning) return;
    state.scrollX -= (e.touches[0].clientX - panLastX) * panMultiplier();
    panLastX = e.touches[0].clientX;
    requestAnimationFrame(updateVisuals);
  }, {passive:true});
  window.addEventListener('touchend', () => { isPanning = false; });

  /* ---------------- Layer rows ---------------- */
  function renderLayerRows(){
    layerRowsEl.innerHTML = '';
    layerConfig.forEach(layer => {
      const row = document.createElement('div');
      row.className = 'layer-row' + (layer.enabled ? '' : ' disabled');

      // A built-in preset (e.g. the default Forest images) is a plain
      // biome choice — same dropdown as Mountains/Hills/Desert, no
      // upload-only chrome. Only a genuine upload gets the image chip,
      // clear/settings buttons and the tiling/tint toggles.
      const isUpload = !!layer.customImage && !layer.customImageBuiltin;
      const showImageSettings = isUpload && layer.imageSettingsOpen;
      const sourceHtml = isUpload
        ? `<span class="img-chip" title="${STORAGE.layersUpload}${layer.customImageName || ''}">🖼 ${escapeHtml(layer.customImageName || 'custom')}</span>
           ${!showImageSettings ? `<button class="icon-btn small image-settings-btn" title="Tiling &amp; tint options">${ICONS.sliders}</button>` : ''}
           <button class="icon-btn small clear-image-btn" title="Revert to procedural biome">${ICONS.clear}</button>`
        : `<select class="layer-biome">${biomeOptionsHtml(layer.biome)}</select>`;

      row.innerHTML = `
        <div class="layer-row-top">
          <input type="checkbox" class="layer-enable" ${layer.enabled ? 'checked' : ''} title="Toggle layer ${layer.id}">
          <span class="idx">${layer.id}</span>
          <span class="swatch" style="background:${layer.color};"></span>
          <div class="layer-source">${sourceHtml}</div>
          <button class="icon-btn small upload-image-btn" title="Upload a custom image for this layer — stored via Foundry's FilePicker under ${STORAGE.layersUpload}">${ICONS.upload}</button>
          <input type="file" accept="image/*" class="layer-file-input" hidden>
        </div>
        ${showImageSettings ? `
        <label class="mirror-tile-row">
          <input type="checkbox" class="layer-mirror-tile" ${layer.mirrorTile ? 'checked' : ''}>
          Seamless mirror tiling <span class="hint">— guarantees a seam-free loop for any image</span>
        </label>
        <label class="mirror-tile-row">
          <input type="checkbox" class="layer-tint" ${layer.tintToColor !== false ? 'checked' : ''}>
          Tint to layer colour <span class="hint">— off keeps the image's own colours (for full-colour art)</span>
        </label>
        <button class="btn small apply-image-settings-btn" style="align-self:flex-start; margin-left:16px;">${ICONS.check} Apply</button>` : ''}
        <div class="offset-row">
          <span class="axis-label">Y</span>
          <input type="range" class="layer-offset-y" min="-140" max="140" value="${layer.yOffset}">
          <span class="val">${layer.yOffset}px</span>
        </div>
        <div class="offset-row">
          <span class="axis-label">X</span>
          <input type="range" class="layer-offset-x" min="-200" max="200" value="${layer.xOffset}">
          <span class="val">${layer.xOffset}px</span>
        </div>`;
      layerRowsEl.appendChild(row);

      row.querySelector('.layer-enable').addEventListener('change', (e) => {
        layer.enabled = e.target.checked;
        row.classList.toggle('disabled', !layer.enabled);
        initLayers();
      });
      const biomeSel = row.querySelector('.layer-biome');
      if (biomeSel) biomeSel.addEventListener('change', (e) => {
        applyBiomeOrImage(layer, e.target.value, () => { renderLayerRows(); initLayers(); });
      });

      const clearBtn = row.querySelector('.clear-image-btn');
      if (clearBtn) clearBtn.addEventListener('click', () => {
        layer.customImage = null; layer.customImageName = null; layer.customImageRaw = null;
        layer.customImageDims = null;
        layer.imageSettingsOpen = false;
        // Forest has no procedural fallback (it's image-only), so clearing
        // an image-based layer needs a real biome to land on.
        if (!layer.biome || layer.biome.startsWith('img:')) layer.biome = 'mountains-1';
        renderLayerRows(); initLayers();
      });

      const imgSettingsBtn = row.querySelector('.image-settings-btn');
      if (imgSettingsBtn) imgSettingsBtn.addEventListener('click', () => {
        layer.imageSettingsOpen = true;
        renderLayerRows();
      });

      const applyBtn = row.querySelector('.apply-image-settings-btn');
      if (applyBtn) applyBtn.addEventListener('click', () => {
        layer.imageSettingsOpen = false;
        renderLayerRows();
      });

      row.querySelector('.upload-image-btn').addEventListener('click', () => row.querySelector('.layer-file-input').click());
      row.querySelector('.layer-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        readImageFile(file, (dataUrl) => {
          layer.customImageRaw = dataUrl; layer.customImageName = file.name;
          if (layer.mirrorTile === undefined) layer.mirrorTile = true;
          if (layer.tintToColor === undefined) layer.tintToColor = true;
          layer.imageSettingsOpen = true;
          layer.customImageBuiltin = false;
          processCustomImage(layer, (finalUrl, dims) => {
            layer.customImage = finalUrl;
            layer.customImageDims = dims;
            renderLayerRows(); initLayers();
          });
        });
      });

      const tintChk = row.querySelector('.layer-tint');
      if (tintChk) tintChk.addEventListener('change', () => {
        layer.tintToColor = tintChk.checked;
        initLayers();
      });

      const mirrorChk = row.querySelector('.layer-mirror-tile');
      if (mirrorChk) mirrorChk.addEventListener('change', () => {
        layer.mirrorTile = mirrorChk.checked;
        processCustomImage(layer, (finalUrl, dims) => {
          layer.customImage = finalUrl;
          layer.customImageDims = dims;
          initLayers();
        });
      });

      row.querySelector('.layer-offset-y').addEventListener('input', (e) => {
        layer.yOffset = parseInt(e.target.value, 10);
        row.querySelector('.offset-row:nth-of-type(2) .val').textContent = `${layer.yOffset}px`;
        requestAnimationFrame(updateVisuals);
      });
      row.querySelector('.layer-offset-x').addEventListener('input', (e) => {
        layer.xOffset = parseInt(e.target.value, 10);
        row.querySelector('.offset-row:nth-of-type(3) .val').textContent = `${layer.xOffset}px`;
        requestAnimationFrame(updateVisuals);
      });
    });
  }

  const quickBiomeSelect = document.getElementById('quick-biome-select');
  quickBiomeSelect.innerHTML = biomeOptionsHtml('mountains-1');
  document.getElementById('quick-biome-apply').addEventListener('click', () => {
    const b = quickBiomeSelect.value;
    let remaining = layerConfig.length;
    const done = () => { remaining--; if (remaining <= 0) { renderLayerRows(); initLayers(); } };
    layerConfig.forEach(l => applyBiomeOrImage(l, b, done));
  });

  /* ---------------- POI table ---------------- */
  const stateLabels = { hidden:'Hidden', unknown:'Unknown', rumored:'Rumored', discovered:'Discovered' };
  const stateOrder = ['hidden','unknown','rumored','discovered'];

  function poiIconOptionsHtml(selected){
    return Object.keys(ICON_LABELS).map(k => `<option value="${k}" ${k===selected?'selected':''}>${ICON_LABELS[k]}</option>`).join('');
  }

  function renderPoiTable(){
    poiListEl.innerHTML = '';
    if (!state.pois.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.style.cssText = 'padding:18px 7px; text-align:center; color:var(--parchment-dim); font-size:11.5px;';
      td.textContent = 'No points of interest yet — click "+ Add POI" to place one.';
      tr.appendChild(td);
      poiListEl.appendChild(tr);
    }
    state.pois.forEach(poi => {
      const tr = document.createElement('tr');
      if (poi.locked) tr.classList.add('locked');

      const tdName = document.createElement('td');
      const nameInput = document.createElement('input');
      nameInput.type = 'text'; nameInput.className = 'poi-name-input'; nameInput.value = poi.name;
      nameInput.addEventListener('change', () => { poi.name = nameInput.value; renderPOIs(); });
      tdName.appendChild(nameInput);

      const tdIcon = document.createElement('td');
      const iconField = document.createElement('div');
      iconField.className = 'poi-icon-field';
      iconField.innerHTML = poi.customIcon
        ? `<span class="img-chip" title="${STORAGE.poisUpload}">🖼 custom</span>
           <button class="icon-btn small clear-icon-btn" title="Revert to a generic icon">${ICONS.clear}</button>`
        : `<select class="poi-icon-select">${poiIconOptionsHtml(poi.icon)}</select>`;
      iconField.innerHTML += `<button class="icon-btn small upload-icon-btn" title="Upload a custom image for this POI — stored via Foundry's FilePicker under ${STORAGE.poisUpload}">${ICONS.upload}</button>
        <input type="file" accept="image/*" class="poi-icon-file" hidden>`;
      tdIcon.appendChild(iconField);

      const iconSel = iconField.querySelector('.poi-icon-select');
      if (iconSel) iconSel.addEventListener('change', () => { poi.icon = iconSel.value; poi.customIcon = null; renderPOIs(); renderPoiTable(); });
      const clearIconBtn = iconField.querySelector('.clear-icon-btn');
      if (clearIconBtn) clearIconBtn.addEventListener('click', () => { poi.customIcon = null; renderPOIs(); renderPoiTable(); });
      iconField.querySelector('.upload-icon-btn').addEventListener('click', () => iconField.querySelector('.poi-icon-file').click());
      iconField.querySelector('.poi-icon-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        readImageFile(file, (dataUrl) => { poi.customIcon = dataUrl; renderPOIs(); renderPoiTable(); });
      });

      const tdLayer = document.createElement('td');
      const layerSel = document.createElement('select');
      layerConfig.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id; opt.textContent = `L${l.id}`;
        if (poi.layer == l.id) opt.selected = true;
        layerSel.appendChild(opt);
      });
      layerSel.addEventListener('change', () => {
        // Keep the POI exactly where it visually is on screen — reassigning
        // a layer shouldn't teleport it, just change which terrain it's
        // pinned to (different pan speed / colour / Y-offset).
        const oldLayer = layerConfig.find(l => l.id === poi.layer);
        const newLayerId = parseInt(layerSel.value, 10);
        const newLayer = layerConfig.find(l => l.id === newLayerId);
        if (oldLayer && newLayer) {
          const visualX = poi.xPos - (state.scrollX * oldLayer.speed) + oldLayer.xOffset;
          poi.xPos = visualX + (state.scrollX * newLayer.speed) - newLayer.xOffset;
          poi.offsetY = poi.offsetY - oldLayer.yOffset + newLayer.yOffset;
        }
        poi.layer = newLayerId;
        renderPOIs();
      });
      tdLayer.appendChild(layerSel);

      const tdSize = document.createElement('td');
      const sizeSel = document.createElement('select');
      sizeSel.className = 'size-sel';
      sizeSel.title = 'Icon size';
      [['small','S'],['medium','M'],['large','L']].forEach(([val,label]) => {
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = label;
        if ((poi.size || 'large') === val) opt.selected = true;
        sizeSel.appendChild(opt);
      });
      sizeSel.addEventListener('change', () => { poi.size = sizeSel.value; renderPOIs(); });
      tdSize.appendChild(sizeSel);

      const tdState = document.createElement('td');
      const stateSel = document.createElement('select');
      stateOrder.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s; opt.textContent = stateLabels[s];
        if (poi.state === s) opt.selected = true;
        stateSel.appendChild(opt);
      });
      stateSel.addEventListener('change', () => { poi.state = stateSel.value; renderPOIs(); });
      tdState.appendChild(stateSel);

      const tdJournal = document.createElement('td');
      const journalSel = document.createElement('select');
      const noneOpt = document.createElement('option');
      noneOpt.value = ''; noneOpt.textContent = '— none —';
      journalSel.appendChild(noneOpt);
      // Foundry's real Journal sidebar — every world JournalEntry, in the
      // order game.journal (a WorldCollection) already sorts them.
      const journalEntries = game.journal ? Array.from(game.journal.contents) : [];
      journalEntries.forEach(j => {
        const opt = document.createElement('option');
        opt.value = j.id; opt.textContent = j.name;
        if (poi.journalId === j.id) opt.selected = true;
        journalSel.appendChild(opt);
      });
      journalSel.addEventListener('change', () => {
        poi.journalId = journalSel.value || null;
        renderPOIs(); renderPoiTable(); scheduleSave();
      });
      tdJournal.appendChild(journalSel);

      const tdActions = document.createElement('td');
      tdActions.className = 'actions-cell';

      const focusBtn = document.createElement('button');
      focusBtn.className = 'icon-btn'; focusBtn.title = 'Centre horizon on this POI';
      focusBtn.innerHTML = ICONS.eye;
      focusBtn.addEventListener('click', () => focusOnPoi(poi));

      const lockBtn = document.createElement('button');
      lockBtn.className = 'icon-btn' + (poi.locked ? ' lock-on' : '');
      lockBtn.title = poi.locked ? 'Unlock position' : 'Lock position';
      lockBtn.innerHTML = poi.locked ? ICONS.lock : ICONS.unlock;
      lockBtn.addEventListener('click', () => { poi.locked = !poi.locked; renderPOIs(); renderPoiTable(); });

      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn danger'; delBtn.title = 'Delete POI';
      delBtn.innerHTML = ICONS.trash;
      delBtn.addEventListener('click', () => {
        state.pois = state.pois.filter(p => p.id !== poi.id);
        renderPOIs(); renderPoiTable();
      });

      tdActions.appendChild(focusBtn); tdActions.appendChild(lockBtn); tdActions.appendChild(delBtn);

      tr.appendChild(tdName); tr.appendChild(tdIcon); tr.appendChild(tdLayer); tr.appendChild(tdSize); tr.appendChild(tdState); tr.appendChild(tdJournal); tr.appendChild(tdActions);
      poiListEl.appendChild(tr);
    });
  }

  document.getElementById('add-poi-btn').addEventListener('click', () => {
    const icons = Object.keys(ICON_LABELS);
    const firstEnabled = layerConfig.find(l => l.enabled) || layerConfig[3];
    state.pois.push({
      id: state.nextPoiId++,
      name: "New Location",
      layer: firstEnabled.id,
      xPos: state.scrollX + 300,
      offsetY: defaultOffsetYForLayer(firstEnabled.id),
      state: "rumored",
      size: "large",
      icon: icons[Math.floor(Math.random()*icons.length)],
      customIcon: null,
      locked: false,
      journalId: null
    });
    renderPOIs(); renderPoiTable();
  });

  /* ---------------- GM / Player toggle ---------------- */
  const viewToggle = document.getElementById('view-toggle');
  const subtitleEl = document.getElementById('dh-subtitle');
  viewToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    state.viewMode = btn.dataset.mode;
    viewToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    dhWindow.classList.toggle('player', state.viewMode === 'player');
    settingsPanel.classList.toggle('player-mode', state.viewMode === 'player');
    applyLockView();
    renderPOIs();
  });

  /* ---------------- Lock View (blocks player panning) ---------------- */
  const lockViewBtn = document.getElementById('lock-view-btn');
  function applyLockView(){
    lockViewBtn.innerHTML = state.viewLocked ? ICONS.lock : ICONS.unlock;
    lockViewBtn.classList.toggle('active', state.viewLocked);
    lockViewBtn.title = state.viewLocked
      ? 'View locked — players can\'t scroll. Click to unlock.'
      : 'Lock view (stop players scrolling)';
    horizonView.classList.toggle('view-locked', state.viewLocked && state.viewMode === 'player');
    updateSubtitle();
  }
  lockViewBtn.addEventListener('click', () => {
    state.viewLocked = !state.viewLocked;
    applyLockView();
    scheduleSave();
  });

  function updateSubtitle(){
    const modeText = state.viewMode === 'gm' ? 'GM view' : 'Player view';
    const lockText = state.viewLocked ? ' · view locked' : '';
    subtitleEl.textContent = modeText + lockText + ' · double-click to dock';
  }
  applyLockView();

  /* ---------------- Day / Night toggle ---------------- */
  const daytimeToggle = document.getElementById('daytime-toggle');
  const horizonWrapEl = document.getElementById('horizon-wrap');
  const dayBtn = daytimeToggle.querySelector('button[data-time="day"]');
  const nightBtn = daytimeToggle.querySelector('button[data-time="night"]');
  dayBtn.innerHTML = ICONS.sun;
  nightBtn.innerHTML = ICONS.moon;
  function applyDaytime(){
    horizonWrapEl.classList.toggle('night', state.daytime === 'night');
    container.classList.toggle('night', state.daytime === 'night');
    dayBtn.classList.toggle('active', state.daytime === 'day');
    nightBtn.classList.toggle('active', state.daytime === 'night');
  }
  daytimeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-time]');
    if (!btn) return;
    state.daytime = btn.dataset.time;
    applyDaytime();
    scheduleSave();
  });
  applyDaytime();

  /* ---------------- Settings menu (body-level, positioned in JS) ---------------- */
  const cogBtn = document.getElementById('cog-btn');
  const settingsPanel = document.getElementById('dh-settings');
  const compassOpacityRow = document.getElementById('compass-opacity-row');

  function positionSettings(){
    const r = cogBtn.getBoundingClientRect();
    const width = 250;
    let left = r.right - width;
    left = Math.max(8, Math.min(window.innerWidth - width - 8, left));
    let top = r.bottom + 6;
    settingsPanel.style.left = left + 'px';
    settingsPanel.style.top = top + 'px';
  }
  function openSettings(){ positionSettings(); settingsPanel.hidden = false; cogBtn.classList.add('active'); renderJournalList(); renderPresetList(); }
  function closeSettings(){ settingsPanel.hidden = true; cogBtn.classList.remove('active'); }
  cogBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsPanel.hidden ? openSettings() : closeSettings();
  });
  document.addEventListener('click', (e) => {
    if (!settingsPanel.hidden && !settingsPanel.contains(e.target) && e.target !== cogBtn) closeSettings();
  });
  window.addEventListener('resize', () => { if (!settingsPanel.hidden) positionSettings(); });

  /* ---------------- Layers info popup (body-level, positioned in JS) ---------------- */
  const layersInfoBtn = document.getElementById('layers-info-btn');
  const layersInfoPopup = document.getElementById('layers-info-popup');
  function positionLayersInfo(){
    const r = layersInfoBtn.getBoundingClientRect();
    const width = 280;
    let left = r.left;
    left = Math.max(8, Math.min(window.innerWidth - width - 8, left));
    let top = r.bottom + 6;
    layersInfoPopup.style.left = left + 'px';
    layersInfoPopup.style.top = top + 'px';
  }
  function openLayersInfo(){ positionLayersInfo(); layersInfoPopup.hidden = false; layersInfoBtn.classList.add('active'); }
  function closeLayersInfo(){ layersInfoPopup.hidden = true; layersInfoBtn.classList.remove('active'); }
  layersInfoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    layersInfoPopup.hidden ? openLayersInfo() : closeLayersInfo();
  });
  document.addEventListener('click', (e) => {
    if (!layersInfoPopup.hidden && !layersInfoPopup.contains(e.target) && e.target !== layersInfoBtn) closeLayersInfo();
  });
  window.addEventListener('resize', () => { if (!layersInfoPopup.hidden) positionLayersInfo(); });

  document.getElementById('opt-compass-mode').addEventListener('change', (e) => {
    state.compassMode = e.target.value;
    compassHud.hidden = state.compassMode === 'off';
    compassOpacityRow.style.display = state.compassMode === 'off' ? 'none' : 'flex';
    updateVisuals();
  });
  document.getElementById('opt-compass-opacity').addEventListener('input', (e) => {
    state.compassOpacity = parseInt(e.target.value, 10) / 100;
    compassHud.style.setProperty('--compass-opacity', state.compassOpacity);
  });
  document.getElementById('opt-draghint').addEventListener('change', (e) => {
    state.showDragHint = e.target.checked;
    dragHintEl.hidden = !state.showDragHint;
  });
  document.getElementById('opt-fullcolour').addEventListener('change', (e) => {
    state.fullColourIcons = e.target.checked;
    renderPOIs();
  });
  document.getElementById('opt-palette').addEventListener('change', (e) => {
    applyPalette(e.target.value);
    // A deliberate GM push — see "Scene persistence + GM → player sync"
    // further down. Takes over for everyone, including a player who'd
    // picked their own palette since the GM's last push.
    pushPaletteIfGm();
  });

  const HORIZON_LENGTH_DESC = {
    far: 'Full-length horizon — more dragging to scan the whole view.',
    medium: 'Balanced — a middle ground between range and reach.',
    close: 'Short horizon — reach any point with minimal dragging.'
  };
  document.getElementById('opt-horizon-length').addEventListener('change', (e) => {
    state.horizonLength = e.target.value;
    document.getElementById('horizon-length-desc').textContent = HORIZON_LENGTH_DESC[state.horizonLength];
    scheduleSave();
  });

  /* ---------------- Window drag ---------------- */
  const draghandle = document.getElementById('dh-draghandle');
  let winDrag = null;

  draghandle.addEventListener('mousedown', (e) => {
    if (state.compactMode) return;
    closeSettings();
    const rect = dhWindow.getBoundingClientRect();
    winDrag = { startClientX: e.clientX, startClientY: e.clientY, startLeft: rect.left, startTop: rect.top };
    dhWindow.classList.add('dragging');
  });
  window.addEventListener('mousemove', (e) => {
    if (!winDrag) return;
    const dx = e.clientX - winDrag.startClientX;
    const dy = e.clientY - winDrag.startClientY;
    let left = winDrag.startLeft + dx;
    let top = winDrag.startTop + dy;
    const rect = dhWindow.getBoundingClientRect();
    left = Math.max(4, Math.min(window.innerWidth - rect.width - 4, left));
    top = Math.max(4, Math.min(window.innerHeight - 40, top));
    dhWindow.style.left = left + 'px';
    dhWindow.style.top = top + 'px';
  });
  window.addEventListener('mouseup', () => { winDrag = null; dhWindow.classList.remove('dragging'); });

  /* ---------------- Compact dock mode ---------------- */
  let savedRect = null;
  let compactPositionTimer = null;

  // Docked mode used to just span the full viewport width flush to the
  // bottom (left:0/right:0/bottom:0), which put it behind Foundry's own
  // scene-controls column, sidebar and hotbar rather than sitting above
  // them. This measures Foundry's real UI chrome and insets the docked
  // strip to fit the gap between the side columns and above the hotbar
  // instead. It looks for Foundry's standard element ids (#ui-left,
  // #sidebar — #ui-right on older versions — and #hotbar); if none of
  // them exist (e.g. this file previewed on its own, outside Foundry)
  // it leaves the CSS fallback inset in place.
  //
  // Foundry v13 restructured these landmarks: #ui-left is no longer the
  // narrow toolbar itself but a much wider layout wrapper around several
  // columns (scene controls + scene navigation), and #sidebar collapses
  // to zero width until a tab is expanded (the visible strip is then a
  // child element, #sidebar-tabs / #sidebar-content). Trusting the
  // landmark element's OWN bounding box — as v11/v12 required — grossly
  // overshoots on v13 (e.g. ~960px instead of the real ~72px toolbar),
  // which is what caused the docked strip to collapse to zero width and
  // land dead-centre on screen. Measuring the widest/narrowest edge among
  // the landmark's own VISIBLE children instead tracks whatever is
  // actually painted on any version — including v11/v12, where the
  // landmark itself has no meaningful children and this simply falls
  // back to its own rect.
  function visibleRightEdge(el){
    if (!el) return null;
    const kids = Array.from(el.children).filter(c => {
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (kids.length) return Math.max(...kids.map(c => c.getBoundingClientRect().right));
    const rect = el.getBoundingClientRect();
    return (rect.width > 0 && rect.height > 0) ? rect.right : null;
  }
  function visibleLeftEdge(el){
    if (!el) return null;
    const kids = Array.from(el.children).filter(c => {
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (kids.length) return Math.min(...kids.map(c => c.getBoundingClientRect().left));
    const rect = el.getBoundingClientRect();
    return (rect.width > 0 && rect.height > 0) ? rect.left : null;
  }
  // Shared by positionCompactDock() and applyFreeDockPosition()'s initial
  // seed — works out the symmetric inset and the bottom clearance above
  // the hotbar from Foundry's current UI chrome. Returns nulls for
  // anything it can't measure so callers can fall back sensibly.
  function measureDockGeometry(){
    const margin = 12;
    const leftEl = document.getElementById('ui-left');
    const rightEl = document.getElementById('sidebar') || document.getElementById('ui-right');
    const hotbarEl = document.getElementById('hotbar');

    // Foundry's left toolbar and right sidebar are very different widths,
    // so docking flush against each one individually left the strip
    // looking visibly off-centre. Instead, work out how much space EACH
    // side actually needs, then reserve the larger of the two on BOTH
    // sides — that keeps the strip truly centred and leaves the same
    // breathing room on the narrower side that the wider one naturally
    // has, so another module's own toolbar buttons or panel have room too.
    let leftNeeded = margin, rightNeeded = margin;
    const leftEdge = visibleRightEdge(leftEl);
    if (leftEdge !== null) leftNeeded = leftEdge + margin;
    const rightEdge = visibleLeftEdge(rightEl);
    if (rightEdge !== null) rightNeeded = Math.max(0, window.innerWidth - rightEdge) + margin;
    const inset = Math.max(leftNeeded, rightNeeded);

    let bottom = null;
    if (hotbarEl) {
      const hRect = hotbarEl.getBoundingClientRect();
      if (hRect.width > 0 && hRect.height > 0) bottom = Math.max(0, window.innerHeight - hRect.top) + margin;
    }
    return { inset, bottom };
  }

  function positionCompactDock(){
    if (!state.compactMode || state.freeDock) return;
    const { inset, bottom } = measureDockGeometry();
    dhWindow.style.left = `${inset}px`;
    dhWindow.style.right = `${inset}px`;
    if (bottom !== null) dhWindow.style.bottom = `${bottom}px`;
  }

  /* ---------------- Free Dock (drag the docked strip anywhere, per-browser) ---------------- */
  function clampFreeDockX(x){
    const w = dhWindow.getBoundingClientRect().width || Math.min(820, window.innerWidth * 0.94);
    return Math.max(0, Math.min(window.innerWidth - w, x));
  }
  function clampFreeDockY(y){
    const h = dhWindow.getBoundingClientRect().height || 158;
    return Math.max(0, Math.min(window.innerHeight - h, y));
  }
  function applyFreeDockPosition(){
    const saved = game.settings.get(MODULE_ID, 'freeDockPos');
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
      dhWindow.style.setProperty('--free-dock-left', `${clampFreeDockX(saved.left)}px`);
      dhWindow.style.setProperty('--free-dock-top', `${clampFreeDockY(saved.top)}px`);
      return;
    }
    // First time Free Dock is turned on: seed it from wherever the
    // auto-centred dock currently sits (recomputed directly here, since
    // positionCompactDock() itself no-ops once state.freeDock is true),
    // so the strip doesn't jump the moment the toggle is flipped.
    const geo = measureDockGeometry();
    const inset = geo.inset;
    const bottom = geo.bottom !== null ? geo.bottom : 60;
    const height = dhWindow.getBoundingClientRect().height || 158;
    const left = inset;
    const top = window.innerHeight - bottom - height;
    dhWindow.style.setProperty('--free-dock-left', `${clampFreeDockX(left)}px`);
    dhWindow.style.setProperty('--free-dock-top', `${clampFreeDockY(top)}px`);
  }

  const freeDockHandle = document.getElementById('dh-free-dock-handle');
  let freeDockDrag = null;
  freeDockHandle.addEventListener('mousedown', (e) => {
    if (!state.compactMode || !state.freeDock) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = dhWindow.getBoundingClientRect();
    freeDockDrag = { startClientX: e.clientX, startClientY: e.clientY, startLeft: rect.left, startTop: rect.top };
  });
  window.addEventListener('mousemove', (e) => {
    if (!freeDockDrag) return;
    const dx = e.clientX - freeDockDrag.startClientX;
    const dy = e.clientY - freeDockDrag.startClientY;
    const left = clampFreeDockX(freeDockDrag.startLeft + dx);
    const top = clampFreeDockY(freeDockDrag.startTop + dy);
    dhWindow.style.setProperty('--free-dock-left', `${left}px`);
    dhWindow.style.setProperty('--free-dock-top', `${top}px`);
  });
  window.addEventListener('mouseup', () => {
    if (!freeDockDrag) return;
    const rect = dhWindow.getBoundingClientRect();
    game.settings.set(MODULE_ID, 'freeDockPos', { left: rect.left, top: rect.top });
    freeDockDrag = null;
  });

  const freeDockChk = document.getElementById('opt-free-dock');
  freeDockChk.checked = state.freeDock;
  freeDockChk.addEventListener('change', (e) => {
    state.freeDock = e.target.checked;
    game.settings.set(MODULE_ID, 'freeDockEnabled', state.freeDock);
    dhWindow.classList.toggle('free-dock', state.freeDock);
    if (state.compactMode) {
      if (state.freeDock) {
        applyFreeDockPosition();
      } else {
        dhWindow.style.removeProperty('--free-dock-left');
        dhWindow.style.removeProperty('--free-dock-top');
        positionCompactDock();
      }
    }
  });

  function enterCompact(){
    if (state.compactMode) return;
    savedRect = {
      left: dhWindow.style.left, top: dhWindow.style.top,
      // Capture the resize handle's explicit size too (undocked-only —
      // it never applies while compact), so it can be restored on exit.
      width: dhWindow.style.width, height: dhWindow.style.height
    };
    state.compactMode = true;
    dhWindow.classList.add('compact');
    dhWindow.classList.toggle('free-dock', state.freeDock);
    dhWindow.style.left = ''; // clear any stale inline left from free-dragging so the CSS fallback can apply if #ui-left isn't found
    // Clear any explicit width/height left over from resizing the window
    // while undocked — the docked strip has its own fixed, auto-sized
    // dimensions (driven by .compact's CSS + the collapsed horizon
    // height), and an inline size from a prior resize would otherwise
    // override that (inline styles beat non-!important CSS), pinning the
    // "docked" strip at whatever size it happened to be resized to
    // instead of collapsing to the slim bottom-hugging strip.
    dhWindow.style.width = '';
    dhWindow.style.height = '';
    refreshCustomImageSizes();
    if (state.freeDock) {
      applyFreeDockPosition();
    } else {
      positionCompactDock();
    }
    // Re-measure on a light interval rather than chasing every possible
    // Foundry event that could resize the sidebar/hotbar (collapsing the
    // sidebar, changing hotbar page count, etc.) — cheap, and catches all
    // of them uniformly.
    compactPositionTimer = window.setInterval(positionCompactDock, 500);
    closeSettings();
    renderPOIs();
  }
  function exitCompact(){
    if (!state.compactMode) return;
    state.compactMode = false;
    dhWindow.classList.remove('compact');
    dhWindow.classList.remove('free-dock');
    dhWindow.style.removeProperty('--free-dock-left');
    dhWindow.style.removeProperty('--free-dock-top');
    if (compactPositionTimer) { window.clearInterval(compactPositionTimer); compactPositionTimer = null; }
    dhWindow.style.right = '';
    dhWindow.style.bottom = '';
    refreshCustomImageSizes();
    if (savedRect) {
      dhWindow.style.left = savedRect.left;
      dhWindow.style.top = savedRect.top;
      // Restore whatever explicit size the user had resized the window to
      // before docking (undocked-only — compact mode ignores these), so a
      // resize isn't silently lost across a dock/undock cycle.
      dhWindow.style.width = savedRect.width;
      dhWindow.style.height = savedRect.height;
    }
    renderPOIs();
  }
  draghandle.addEventListener('dblclick', () => {
    if (!state.compactMode) enterCompact();
  });
  horizonView.addEventListener('dblclick', () => {
    if (state.compactMode) exitCompact();
  });

  /* ---------------- Reset window ---------------- */
  document.getElementById('dh-reset-btn').addEventListener('click', () => {
    dhWindow.style.left = '3vw';
    dhWindow.style.top = '8vh';
    dhWindow.style.width = '';
    dhWindow.style.height = '';
    closeSettings();
  });

  /* ---------------- Journal Entries (read-only mirror of game.journal) ----
     This list is never edited here — it only links Foundry's own world
     Journal Entries to POIs, from the POI table's "Journal" column above.
     Re-rendered whenever the settings panel opens and whenever the real
     Journal directory changes, so a journal created/renamed/deleted while
     this window is open is picked up without a reload. */
  const journalListEl = document.getElementById('journal-list');
  function renderJournalList(){
    journalListEl.innerHTML = '';
    const entries = game.journal ? Array.from(game.journal.contents) : [];
    if (!entries.length) {
      journalListEl.innerHTML = '<div class="eh-empty">No journal entries in this world yet.</div>';
      return;
    }
    entries.forEach(j => {
      const chip = document.createElement('div');
      chip.className = 'eh-chip';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'eh-chip-name';
      nameSpan.innerHTML = ICONS.journal + ' <span></span>';
      nameSpan.querySelector('span').textContent = j.name;
      const actions = document.createElement('div');
      actions.className = 'eh-chip-actions';
      const openBtn = document.createElement('button');
      openBtn.textContent = 'Open';
      openBtn.title = "Open this entry in Foundry's journal sheet";
      openBtn.addEventListener('click', () => j.sheet.render(true));
      actions.appendChild(openBtn);
      chip.appendChild(nameSpan); chip.appendChild(actions);
      journalListEl.appendChild(chip);
    });
  }
  Hooks.on('createJournalEntry', renderJournalList);
  Hooks.on('updateJournalEntry', renderJournalList);
  Hooks.on('deleteJournalEntry', () => { renderJournalList(); renderPoiTable(); });

  /* ---------------- Config library (presets) ----------------
     World-scoped (not per-scene, not per-client): a preset is a reusable
     named horizon layout the GM can save once and drop onto any scene, so
     it's stored in a world game.settings entry (registered below) rather
     than a scene flag. Captures the same fields the scene payload does —
     loading one behaves exactly like the GM building that setup by hand. */
  const presetListEl = document.getElementById('preset-list');
  function renderPresetList(){
    const presets = game.settings.get(MODULE_ID, 'presets') || {};
    const names = Object.keys(presets);
    presetListEl.innerHTML = '';
    if (!names.length) {
      presetListEl.innerHTML = '<div class="eh-empty">No saved presets yet.</div>';
      return;
    }
    names.forEach(name => {
      const chip = document.createElement('div');
      chip.className = 'eh-chip';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'eh-chip-name'; nameSpan.textContent = name;
      const actions = document.createElement('div');
      actions.className = 'eh-chip-actions';
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Load';
      loadBtn.addEventListener('click', () => {
        applyHorizonConfigPayload(presets[name]);
        scheduleSave();
      });
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete'; delBtn.className = 'danger';
      delBtn.addEventListener('click', async () => {
        const current = game.settings.get(MODULE_ID, 'presets') || {};
        delete current[name];
        await game.settings.set(MODULE_ID, 'presets', current);
        renderPresetList();
      });
      actions.appendChild(loadBtn); actions.appendChild(delBtn);
      chip.appendChild(nameSpan); chip.appendChild(actions);
      presetListEl.appendChild(chip);
    });
  }
  document.getElementById('preset-save-btn').addEventListener('click', async () => {
    if (!game.user?.isGM) return;
    const input = document.getElementById('preset-name-input');
    const name = input.value.trim();
    if (!name) return;
    const presets = game.settings.get(MODULE_ID, 'presets') || {};
    presets[name] = buildHorizonConfigPayload();
    await game.settings.set(MODULE_ID, 'presets', presets);
    input.value = '';
    renderPresetList();
  });
  // The 'presets' setting is a shared world value (see registerModuleSettings
  // below) — this fires on every connected client (GM included) whenever
  // any GM saves/loads/deletes one, so the list stays in sync without a
  // manual refresh.
  Hooks.on('updateSetting', (setting) => {
    if (setting.key === `${MODULE_ID}.presets`) renderPresetList();
  });

  /* ---------------- Procedural horizon generator ----------------
     Seeded PRNG (mulberry32, defined earlier) so the same seed always
     produces the same layout, matching the setting note's promise. */
  function hashSeed(str){
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822519);
      h = Math.imul(h ^ (h >>> 13), 3266489917);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }
  const GEN_NAME_PARTS = {
    mountains: ['Peak', 'Pass', 'Crag', 'Outcrop', 'Cairn', 'Ridgeline'],
    hills: ['Barrow', 'Overlook', 'Knoll', 'Hollow', 'Rise', 'Croft'],
    desert: ['Dune', 'Oasis', 'Wastes', 'Mesa', 'Sinkhole', 'Wayshrine'],
    forest: ['Glade', 'Thicket', 'Hollow', 'Grove', 'Deadwood', 'Camp']
  };
  const GEN_ADJECTIVES = ['Old', 'Forsaken', 'Windswept', 'Sunken', 'Broken', "Traveler's", 'Silent', 'Lonely'];
  const RUGGEDNESS_VARIANT = { calm: 1, rugged: 2, jagged: 3 };
  const GEN_BIOME_FAMILIES = ['mountains', 'hills', 'desert', 'forest'];

  document.getElementById('gen-density-slider').addEventListener('input', (e) => {
    document.getElementById('gen-density-val').textContent = e.target.value;
  });
  document.getElementById('gen-randomize-btn').addEventListener('click', () => {
    document.getElementById('gen-seed-input').value = Math.random().toString(36).slice(2, 10);
  });
  document.getElementById('gen-biome-select').addEventListener('change', (e) => {
    document.getElementById('gen-combo-row').hidden = e.target.value !== 'combo';
  });

  function applyFamilyToLayer(l, family, baseVariant, rng, cb){
    if (family === 'forest') {
      const forestVariants = (BUILTIN_LAYER_IMAGES.forest || []).map(b => `img:${b.key}`);
      const val = forestVariants.length ? forestVariants[Math.floor(rng() * forestVariants.length)] : 'mountains-1';
      applyBiomeOrImage(l, val, cb);
    } else {
      let variant = baseVariant + (rng() < 0.5 ? -1 : 1) * (rng() < 0.4 ? 1 : 0);
      variant = Math.min(3, Math.max(1, variant));
      applyBiomeOrImage(l, `${family}-${variant}`, cb);
    }
  }

  document.getElementById('gen-generate-btn').addEventListener('click', () => {
    const biomeChoice = document.getElementById('gen-biome-select').value; // family | 'random' | 'combo'
    const ruggedness = document.getElementById('gen-ruggedness-select').value;
    const density = parseInt(document.getElementById('gen-density-slider').value, 10);
    let seedText = document.getElementById('gen-seed-input').value.trim();
    if (!seedText) { seedText = Math.random().toString(36).slice(2, 10); document.getElementById('gen-seed-input').value = seedText; }
    const seededHash = hashSeed(seedText)();
    const rng = mulberry32(seededHash);
    const baseVariant = RUGGEDNESS_VARIANT[ruggedness] || 2;

    // Resolve what "Random" and "Combo" actually mean for this seed, using
    // the seeded rng so the same seed always resolves the same way.
    let comboA = null, comboB = null, resolvedFamily = biomeChoice;
    let descriptor = biomeChoice;
    if (biomeChoice === 'random') {
      resolvedFamily = GEN_BIOME_FAMILIES[Math.floor(rng() * GEN_BIOME_FAMILIES.length)];
      descriptor = resolvedFamily;
    } else if (biomeChoice === 'combo') {
      comboA = document.getElementById('gen-combo-a').value;
      comboB = document.getElementById('gen-combo-b').value;
      descriptor = comboA === comboB ? comboA : `${comboA}/${comboB}`;
    }
    function familyForLayer(){ return comboA && comboB ? (rng() < 0.5 ? comboA : comboB) : resolvedFamily; }

    // Terrain: every layer gets a resolved biome family (fixed, a single
    // random pick, or one of the two combo picks), with the variant
    // wobbling ±1 around the chosen ruggedness so all 6 depths don't look
    // identically repeated.
    const layerFamilies = new Array(layerConfig.length);
    let remaining = layerConfig.length;
    const finishLayers = () => {
      remaining--;
      if (remaining > 0) return;
      renderLayerRows(); initLayers();

      // POIs: `density` of them (2-8), spread across a reasonable stretch
      // of horizon, each on a random enabled layer, starting Unknown so
      // there's something for the party to discover as they travel.
      state.pois = [];
      const icons = Object.keys(ICON_LABELS);
      const spread = 2200;
      for (let i = 0; i < density; i++) {
        const layerIdx = Math.floor(rng() * layerConfig.length);
        const layerPick = layerConfig[layerIdx];
        const family = layerFamilies[layerIdx] || resolvedFamily || 'mountains';
        const adj = GEN_ADJECTIVES[Math.floor(rng() * GEN_ADJECTIVES.length)];
        const noun = (GEN_NAME_PARTS[family] || GEN_NAME_PARTS.mountains)[Math.floor(rng() * 6)];
        state.pois.push({
          id: state.nextPoiId++,
          name: `${adj} ${noun}`,
          layer: layerPick.id,
          xPos: state.scrollX - spread / 2 + rng() * spread,
          offsetY: defaultOffsetYForLayer(layerPick.id),
          state: 'unknown',
          size: 'large',
          icon: icons[Math.floor(rng() * icons.length)],
          customIcon: null,
          locked: false,
          journalId: null
        });
      }
      renderPOIs(); renderPoiTable();
      ui.notifications?.info(`Enhanced Horizons: generated a ${ruggedness} ${descriptor} horizon (seed "${seedText}") with ${density} POI${density === 1 ? '' : 's'}.`);
      scheduleSave();
    };
    layerConfig.forEach((l, i) => {
      const family = familyForLayer();
      layerFamilies[i] = family;
      applyFamilyToLayer(l, family, baseVariant, rng, finishLayers);
    });
  });

  /* ---------------- Vantage Point mode ----------------
     A separate, larger diorama view of the whole horizon: layers pull
     apart on a simulated depth axis instead of blending flatly. Purely a
     local view toggle — never persisted or synced, same as the prototype. */
  const vantageToggleBtn = document.getElementById('vantage-toggle-btn');

  function setLayerDepthVars(){
    // --vp-depth is harmless outside Vantage Point (only read by the
    // .vantage-active rules), so it's fine to set unconditionally
    // whenever layers are (re)built.
    const ordered = orderedEnabledLayerIds();
    layerConfig.forEach(l => {
      const depthIndex = ordered.indexOf(l.id);
      const depth = depthIndex === -1 ? 0 : depthIndex;
      const bg = document.getElementById(`layer-bg-${l.id}`);
      const fill = document.getElementById(`layer-fill-${l.id}`);
      [bg, fill].forEach(el => {
        if (!el) return;
        el.style.setProperty('--vp-depth', depth);
      });
    });
  }

  function setVantageActive(active){
    vantageActive = active;
    vantageToggleBtn.classList.toggle('active', active);
    horizonWrapEl.classList.toggle('vantage-active', active);
    // Drives the #dh-window.vantage-active CSS, which hides #controls (the
    // Layers/POI panel) and lets #horizon-wrap flex to fill whatever room
    // that frees up — Vantage Point's extra size is for the horizon
    // itself, not the panel underneath it.
    dhWindow.classList.toggle('vantage-active', active);
    if (state.compactMode) {
      // Docked/compact mode is left docked — its height is always
      // content-driven from #horizon-wrap's flex-basis, and the
      // #dh-window.compact.vantage-active CSS rule already grows that
      // basis, so there's no inline window sizing to do here at all.
    } else if (active) {
      // Grow the horizon view itself (roughly doubled, with a little extra
      // for the diorama tilt's own headroom) rather than the whole
      // previous window — #controls is now hidden, so #horizon-wrap gets
      // 100% of whatever height the window is given.
      const horizonRect = horizonWrapEl.getBoundingClientRect();
      const titlebarRect = document.getElementById('dh-titlebar').getBoundingClientRect();
      const windowRect = dhWindow.getBoundingClientRect();
      vantagePrevSize = { width: dhWindow.style.width, height: dhWindow.style.height };
      dhWindow.style.width = `${Math.round(Math.max(windowRect.width * 2, 900))}px`;
      dhWindow.style.height = `${Math.round(titlebarRect.height + Math.max(horizonRect.height * 2.2, 420))}px`;
    } else if (vantagePrevSize) {
      dhWindow.style.width = vantagePrevSize.width;
      dhWindow.style.height = vantagePrevSize.height;
      vantagePrevSize = null;
    }
    setLayerDepthVars();
    // updateVisuals() re-sets each layer's inline transform every call, and
    // that's the transform vantageActive's tilt has to be folded into (see
    // the comment in updateVisuals()) — so re-run it right away instead of
    // waiting for the next pan to pick up the new mode.
    updateVisuals();
  }
  vantageToggleBtn.addEventListener('click', () => setVantageActive(!vantageActive));

  /* ---------------- Window resize (undocked only) ---------------- */
  const resizeHandle = document.getElementById('dh-resize-handle');
  let MIN_WIN_WIDTH = 0, MIN_WIN_HEIGHT = 0;
  let winResize = null;
  function captureMinWindowSize(){
    const rect = dhWindow.getBoundingClientRect();
    MIN_WIN_WIDTH = rect.width;
    MIN_WIN_HEIGHT = rect.height;
  }
  resizeHandle.addEventListener('mousedown', (e) => {
    if (state.compactMode) return;
    e.stopPropagation();
    e.preventDefault();
    closeSettings();
    const rect = dhWindow.getBoundingClientRect();
    winResize = { startClientX: e.clientX, startClientY: e.clientY, startWidth: rect.width, startHeight: rect.height };
  });
  window.addEventListener('mousemove', (e) => {
    if (!winResize) return;
    const dx = e.clientX - winResize.startClientX;
    const dy = e.clientY - winResize.startClientY;
    const maxWidth = window.innerWidth - 8;
    const maxHeight = window.innerHeight - 8;
    const newWidth = Math.max(MIN_WIN_WIDTH, Math.min(maxWidth, winResize.startWidth + dx));
    const newHeight = Math.max(MIN_WIN_HEIGHT, Math.min(maxHeight, winResize.startHeight + dy));
    dhWindow.style.width = `${newWidth}px`;
    dhWindow.style.height = `${newHeight}px`;
  });
  window.addEventListener('mouseup', () => { winResize = null; });

  window.addEventListener('resize', updateVisuals);
  window.addEventListener('resize', positionCompactDock);

  // Any layer whose starting biome is a built-in image preset (e.g. the
  // default Forest layer) needs that image resolved through the canvas
  // pipeline BEFORE the first render, since layer.customImage starts null.
  function preloadBuiltinImages(layers, cb){
    const pending = layers.filter(l => l.biome && l.biome.startsWith('img:') && !l.customImage);
    if (!pending.length) { cb(); return; }
    let remaining = pending.length;
    const done = () => { remaining--; if (remaining <= 0) cb(); };
    pending.forEach(layer => {
      const key = layer.biome.slice(4);
      const preset = BUILTIN_LAYER_IMAGES.forest.find(b => b.key === key);
      if (!preset) { done(); return; }
      layer.customImageRaw = preset.src;
      layer.customImageName = preset.label;
      layer.mirrorTile = true;
      layer.tintToColor = true;
      layer.customImageBuiltin = true;
      processCustomImage(layer, (finalUrl, dims) => {
        layer.customImage = finalUrl;
        layer.customImageDims = dims;
        done();
      });
    });
  }

  /* ---------------- Scene persistence + GM → player sync ----------------
     The shared parts of a horizon setup — terrain layers, POIs, palette,
     horizon length, day/night state and the view lock — are what the GM
     builds and wants every player to see, so they're saved on the current
     *scene* (scene.setFlag) rather than a world setting: a GM running a
     multi-leg journey will typically swap scenes per leg, and each scene
     keeps its own horizon. Free Dock, window position/size, the local
     GM/Player preview toggle, and cosmetic display prefs (compass
     mode/opacity, drag hint, full-colour icons) stay exactly as before —
     purely local, per-browser, never saved or shared.

     Foundry already pushes every Scene update to all connected clients
     over its own socket layer and fires an 'updateScene' hook on each of
     them, and a client that joins later just reads the current flag value
     straight off the scene document — so writing to scene.setFlag is
     *both* the save and the live push to players, no separate socket
     channel needed. Only an actual GM's client may write (game.user.isGM),
     so a player who happens to have the local GM-preview toggle on can
     never overwrite the real shared setup — their edits just won't save. */
  function activeScene(){
    return (typeof canvas !== 'undefined' && canvas.scene) || game.scenes?.viewed || null;
  }
  function buildHorizonConfigPayload(){
    // Palette is deliberately NOT part of this payload — it has its own
    // scene flag and its own sync/apply functions below ("Palette sync"),
    // so that a routine save here (a POI move, a layer edit, day/night...)
    // never carries a stale palette value that would stomp a player's own
    // local override.
    return {
      v: 1,
      layers: layerConfig.map(l => ({ ...l })),
      pois: state.pois.map(p => ({ ...p })),
      nextPoiId: state.nextPoiId,
      horizonLength: state.horizonLength,
      daytime: state.daytime,
      viewLocked: state.viewLocked
    };
  }
  let saveTimer = null;
  // Guards against writing straight back what we just received — set
  // while an incoming (or just-loaded) payload is being applied.
  let applyingRemote = false;
  function scheduleSave(){
    if (!game.user?.isGM) return;
    if (applyingRemote) return;
    const scene = activeScene();
    if (!scene) return;
    if (saveTimer) clearTimeout(saveTimer);
    // Debounced — a POI drag or a burst of layer edits fires this many
    // times a second; only the settled result after ~half a second of
    // quiet actually needs to hit the database and push to players.
    saveTimer = setTimeout(() => {
      saveTimer = null;
      scene.setFlag(MODULE_ID, 'horizonConfig', buildHorizonConfigPayload()).catch(err => {
        console.error(`${MODULE_ID} | failed to save horizon config to scene`, err);
        ui.notifications?.error("Enhanced Horizons: couldn't save to this scene — check your permissions.");
      });
    }, 500);
  }
  function applyHorizonConfigPayload(payload, { rerender = true } = {}){
    if (!payload) return;
    applyingRemote = true;
    try {
      if (Array.isArray(payload.layers) && payload.layers.length) {
        payload.layers.forEach((saved, i) => { if (layerConfig[i] && saved) Object.assign(layerConfig[i], saved); });
      }
      if (Array.isArray(payload.pois)) state.pois = payload.pois.map(p => ({ ...p }));
      if (typeof payload.nextPoiId === 'number') state.nextPoiId = payload.nextPoiId;
      if (payload.horizonLength) {
        state.horizonLength = payload.horizonLength;
        const lenSel = document.getElementById('opt-horizon-length');
        if (lenSel) lenSel.value = state.horizonLength;
        const lenDesc = document.getElementById('horizon-length-desc');
        if (lenDesc) lenDesc.textContent = HORIZON_LENGTH_DESC[state.horizonLength];
      }
      if (payload.daytime) { state.daytime = payload.daytime; applyDaytime(); }
      if (typeof payload.viewLocked === 'boolean') { state.viewLocked = payload.viewLocked; applyLockView(); }
      if (rerender) { renderLayerRows(); initLayers(); renderPoiTable(); }
    } finally {
      applyingRemote = false;
    }
  }
  function loadHorizonConfigForActiveScene(opts){
    const scene = activeScene();
    const payload = scene?.getFlag(MODULE_ID, 'horizonConfig');
    if (payload) applyHorizonConfigPayload(payload, opts);
  }

  /* ---- Palette sync: the GM's palette pushes as an initial/updated
     default, but a player who then picks their own is left alone — not
     immediately re-stomped by the next unrelated config save above (a POI
     move, a layer edit...) — until the GM deliberately pushes a NEW
     palette, which takes over again for everyone. Tracked with a small
     revision number on its own scene flag, kept separate from
     horizonConfig above specifically so "the GM changed the palette again"
     and "something else about the horizon changed" stay distinguishable. */
  let paletteRev = 0;
  let lastAppliedPaletteRev = -1;
  function applyPalette(paletteName){
    state.palette = paletteName;
    document.documentElement.setAttribute('data-palette', state.palette);
    // Re-tint the terrain layers to match the new palette's mood too.
    applyLayerPaletteColors(state.palette);
    renderLayerRows();
    initLayers();
    const paletteSel = document.getElementById('opt-palette');
    if (paletteSel) paletteSel.value = state.palette;
  }
  function pushPaletteIfGm(){
    if (!game.user?.isGM) return;
    const scene = activeScene();
    if (!scene) return;
    paletteRev += 1;
    lastAppliedPaletteRev = paletteRev; // already applied locally by the caller
    scene.setFlag(MODULE_ID, 'horizonPalette', { palette: state.palette, rev: paletteRev }).catch(err => {
      console.error(`${MODULE_ID} | failed to push palette to scene`, err);
      ui.notifications?.error("Enhanced Horizons: couldn't push the palette — check your permissions.");
    });
  }
  function acceptPalettePush(payload){
    if (!payload || typeof payload.rev !== 'number') return;
    // Keep our own counter in step regardless, so a GM who reloads
    // mid-session still hands out fresh, higher revision numbers on their
    // next change instead of reusing one a player has already seen (which
    // would make that later push look stale and get ignored below).
    paletteRev = Math.max(paletteRev, payload.rev);
    // A player's own local override IS allowed to be replaced here — but
    // only by a revision newer than the one they last accepted (their own
    // override doesn't advance lastAppliedPaletteRev), so this only fires
    // for a genuinely new GM push, never for a routine config save that
    // happens to still reference the old palette.
    if (payload.palette && payload.rev > lastAppliedPaletteRev) {
      applyPalette(payload.palette);
      lastAppliedPaletteRev = payload.rev;
    }
  }
  function loadPushedPaletteForActiveScene(){
    const scene = activeScene();
    const payload = scene?.getFlag(MODULE_ID, 'horizonPalette');
    if (payload) acceptPalettePush(payload);
  }

  // React only to changes another client made — never to the echo of our
  // own save, which would otherwise re-render mid-drag or mid-keystroke
  // on the GM's own screen.
  Hooks.on('updateScene', (scene, changes, options, userId) => {
    if (userId === game.user?.id) return;
    if (activeScene()?.id !== scene.id) return;
    if (!changes.flags?.[MODULE_ID]) return;
    if ('horizonConfig' in changes.flags[MODULE_ID]) loadHorizonConfigForActiveScene();
    if ('horizonPalette' in changes.flags[MODULE_ID]) acceptPalettePush(changes.flags[MODULE_ID].horizonPalette);
  });
  // Switching scenes shows that scene's own saved horizon (or the shipped
  // defaults, if the GM hasn't set one up on it yet).
  Hooks.on('canvasReady', () => {
    loadHorizonConfigForActiveScene();
    loadPushedPaletteForActiveScene();
  });

  function boot(){
    // Pull in this scene's saved setup (if any) before the very first
    // paint, so players and a reconnecting GM see the real thing straight
    // away instead of the shipped defaults flashing first.
    loadHorizonConfigForActiveScene({ rerender: false });
    // Separate from the above: this scene's last-pushed palette (or, for
    // the GM's own reload, their own last push).
    loadPushedPaletteForActiveScene();
    preloadBuiltinImages(layerConfig, () => {
      renderLayerRows();
      initLayers();
      renderPoiTable();
      updateVisuals();
      // Deferred until after the above synchronous layout work completes,
      // so the captured "natural size" floor (the resize handle's minimum)
      // reflects the window's real laid-out content, not an empty shell.
      requestAnimationFrame(captureMinWindowSize);
    });
  }


  boot();
}

/* ---------------- Foundry lifecycle ---------------- */

// Free Dock's enabled-state and dragged position are per-browser display
// preferences, not scene data, so they're registered as client-scoped
// settings (config: false — there's a dedicated toggle/handle in the
// module's own UI, no need to also surface these in Foundry's Module
// Settings screen) rather than world-scoped ones. Must be registered in
// 'init', before anything reads them.
function registerModuleSettings(){
  game.settings.register(MODULE_ID, 'freeDockEnabled', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, 'freeDockPos', {
    scope: 'client',
    config: false,
    type: Object,
    default: null
  });
  // Presets are reusable named horizon layouts, not tied to one scene —
  // world-scoped (shared by every GM, not per-browser like Free Dock) so a
  // preset saved by one GM is immediately available to any other.
  game.settings.register(MODULE_ID, 'presets', {
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });
}

Hooks.once('init', () => {
  registerModuleSettings();
});

Hooks.once('ready', () => {
  injectDistantHorizonsMarkup();
  // Hidden until toggled on from the scene controls — see below. Set
  // before boot() runs so there's no one-frame flash of the window.
  document.getElementById('dh-window').style.display = 'none';
  initDistantHorizonsUI();
});

// Adds a toggle button to the Notes scene-controls group (the same group
// journal pins live under) so the GM can show or hide the Distant
// Horizons window without it crowding the token tools. "fa-solid
// fa-mountain" is Font Awesome's layered/overlapping mountain-range
// glyph — matches what the module actually draws, and (unlike a custom
// SVG) renders correctly through every Foundry version's own scene
// control markup without extra wiring.
Hooks.on('getSceneControlButtons', (controls) => {
  // v11/v12 pass an array of control groups; v13 passes an object keyed
  // by group name. "notes" is Foundry's built-in journal-pin tool group.
  const notesControls = Array.isArray(controls)
    ? controls.find(c => c.name === 'notes')
    : controls?.notes;
  if (!notesControls) return;
  const tool = {
    name: 'enhanced-horizons',
    title: "Toggle Shrimp's Enhanced Horizons",
    icon: 'fa-solid fa-mountain',
    toggle: true,
    active: false,
    onClick: (toggled) => {
      const win = document.getElementById('dh-window');
      if (win) win.style.display = toggled ? 'flex' : 'none';
    },
    button: true
  };
  if (Array.isArray(notesControls.tools)) {
    notesControls.tools.push(tool);
  } else if (notesControls.tools) {
    notesControls.tools[tool.name] = tool;
  }
});
