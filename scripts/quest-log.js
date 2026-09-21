const MODULE_ID = "shrimps-quest-influence-tracker";
const SC_MODULE_ID = "segmented-cycle";
const SIMPLE_CALENDAR_MODULE_ID = "foundryvtt-simple-calendar";
const SOCKET_NAME = `module.${MODULE_ID}`;
const SEGMENT_BARS = ["day", "night", "custom"];
const SEGMENT_BAR_LABELS = { day: "Day", night: "Night", custom: "Custom" };

// The Influence tab's seven visual themes, applied to the whole app shell
// (see the --ql-* theme token blocks in styles/quest-log.css) rather than
// just the Influence tab itself. THEME_LABELS backs both the GM's shared
// world-default picker (Quest Log settings) and each client's own personal
// override picker inside the Influence tab.
const INFLUENCE_THEMES = ["dark", "light", "parchment", "midnight", "bloodmoon", "verdant", "frost"];
const THEME_LABELS = {
  dark: "Dark",
  light: "Light",
  parchment: "Parchment",
  midnight: "Midnight",
  bloodmoon: "Bloodmoon",
  verdant: "Verdant",
  frost: "Frost",
};

// Board colour swatches offered when creating/recolouring a Location or NPC
// marker on the Influence board.
const INFLUENCE_SWATCHES = ["#c9a227", "#c0463c", "#5a9c6a", "#7d8fc9", "#b06bc9", "#4fa8b0"];

// Built-in background presets for an Influence region's board, before a GM
// uploads their own image. Kept purely as CSS (no network fetch) so they
// work offline like the rest of the module.
const INFLUENCE_BG_PRESETS = [
  { key: "void", label: "Void", css: "radial-gradient(ellipse at 30% 20%, #26190f 0%, #140f0a 60%, #0a0704 100%)" },
  { key: "parch-map", label: "Old Map", css: "repeating-linear-gradient(115deg, #d9c290 0 2px, #cdb27c 2px 60px), radial-gradient(ellipse at 70% 30%, #e6d4a4 0%, #c9ac72 70%)" },
  { key: "blueprint", label: "Blueprint", css: "linear-gradient(#0e2233,#0e2233), repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 40px)" },
  { key: "slate", label: "Slate", css: "radial-gradient(ellipse at 60% 10%, #33383f 0%, #1c1f24 65%, #121417 100%)" },
];

// The board is a fixed 1600x1000 (8:5) canvas that regions pan/zoom around;
// see the upload tooltip in influence-tab.hbs for why that ratio matters
// for an uploaded background image.
const INFLUENCE_BOARD_W = 1600;
const INFLUENCE_BOARD_H = 1000;

function influenceUid(prefix) {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

/* =========================================================================
   Pure date helpers. All operate on a plain { yearLabel, months:[{name,days}] }
   calendar object and { year, monthIndex, day } date objects, so none of
   this depends on Foundry being loaded and it is easy to reason about.
   ========================================================================= */

function ordinalSuffix(n) {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

function formatDate(calendar, dateObj) {
  const months = calendar.months;
  const month = months[dateObj.monthIndex] || months[0];
  return `${dateObj.day}${ordinalSuffix(dateObj.day)} of ${month.name}, ${dateObj.year} ${calendar.yearLabel}`;
}

function dateKey(d) {
  return `${d.year}-${d.monthIndex}-${d.day}`;
}

function sameDate(a, b) {
  return !!a && !!b && a.year === b.year && a.monthIndex === b.monthIndex && a.day === b.day;
}

function addDays(calendar, dateObj, delta) {
  const months = calendar.months;
  let { year, monthIndex, day } = dateObj;
  day += delta;
  if (delta >= 0) {
    while (day > months[monthIndex].days) {
      day -= months[monthIndex].days;
      monthIndex++;
      if (monthIndex >= months.length) { monthIndex = 0; year++; }
    }
  } else {
    while (day < 1) {
      monthIndex--;
      if (monthIndex < 0) { monthIndex = months.length - 1; year--; }
      day += months[monthIndex].days;
    }
  }
  return { year, monthIndex, day };
}

function shiftMonth(calendar, monthState, delta) {
  const months = calendar.months;
  let { year, monthIndex } = monthState;
  monthIndex += delta;
  if (monthIndex >= months.length) { monthIndex = 0; year++; }
  if (monthIndex < 0) { monthIndex = months.length - 1; year--; }
  return { year, monthIndex };
}

function clampDateToCalendar(calendar, dateObj) {
  const monthIndex = Math.min(dateObj.monthIndex, calendar.months.length - 1);
  const day = Math.min(dateObj.day, calendar.months[monthIndex].days);
  return { ...dateObj, monthIndex, day };
}

/* =========================================================================
   Default data shape, stored whole in a single world setting. Keeping one
   JSON blob (rather than many settings) makes it easy to keep everything
   consistent and to sync to players purely through Foundry's normal
   setting broadcast.
   ========================================================================= */

function defaultData() {
  return {
    nextQuestId: 100,
    nextNoteId: 100,
    nextTabId: 1,
    nextEventId: 100,
    showCalendarSection: true,
    showSegmentSection: true,
    useSimpleCalendar: true,
    calendar: {
      yearLabel: "AE",
      months: [
        { name: "Frostmere", days: 30 },
        { name: "Harrowmoon", days: 30 },
        { name: "Emberfall", days: 30 },
        { name: "Suncrest", days: 30 },
      ],
    },
    currentDateObj: { year: 812, monthIndex: 1, day: 9 },
    calendarEvents: {},
    segmentBarPrevFilled: { day: 0, night: 0, custom: 0 },
    theme: "dark",
    // Quest Log's own record of the Day/Night segment track, shown as two bars
    // in the calendar panel. Kept here (rather than only read from Segmented
    // Cycle) so the panel still works if that module doesn't expose the
    // setting names below; segment-day-*/segment-night-* actions keep this
    // and Segmented Cycle's own settings in step on a best-effort basis.
    segmentDay: { filled: 3, total: 6 },
    segmentNight: { filled: 1, total: 6 },
    tabs: {
      main: { label: "Main Quest", categories: [], quests: [] },
      side: { label: "Side Quest", categories: [], quests: [] },
      rumours: { label: "Rumours", categories: [], quests: [] },
    },
  };
}

function registerSettings() {
  game.settings.register(MODULE_ID, "data", {
    scope: "world",
    config: false,
    type: Object,
    default: defaultData(),
  });
}

function loadQuestData() {
  const data = game.settings.get(MODULE_ID, "data");
  if (!data || !data.tabs) return defaultData();
  // Defensive defaults for anyone upgrading from an earlier shape.
  data.showCalendarSection ??= true;
  data.showSegmentSection ??= true;
  data.useSimpleCalendar ??= true;
  data.calendarEvents ??= {};
  data.segmentBarPrevFilled ??= { day: 0, night: 0, custom: 0 };
  data.theme ??= "dark";
  data.segmentDay ??= { filled: 3, total: 6 };
  data.segmentNight ??= { filled: 1, total: 6 };
  // Belt and braces: filled should never be able to persist above total,
  // whatever wrote it last.
  data.segmentDay.filled = Math.max(0, Math.min(data.segmentDay.total, data.segmentDay.filled));
  data.segmentNight.filled = Math.max(0, Math.min(data.segmentNight.total, data.segmentNight.filled));
  return data;
}

async function saveQuestData(data) {
  if (!game.user.isGM) return;
  await game.settings.set(MODULE_ID, "data", data);
}

/* =========================================================================
   Influence tab data. Regions/Locations/NPCs/relationships are GM-authored
   shared state every client needs to see, so (like the quest data above)
   they live in a single world setting written only by the GM; the
   updateSetting hook below re-renders the app for everyone when it
   changes. Per-viewer preferences (this client's own theme override, and
   this client's own pan/zoom per region) are NOT shared state, so they
   live in client-scoped settings instead, one per viewer, never written to
   the world.
   ========================================================================= */

function defaultInfluenceData() {
  const regionId = influenceUid("reg");
  return {
    nextId: 1,
    activeRegionId: regionId,
    regions: [
      {
        id: regionId,
        name: "World Map",
        background: "void",
        bgScale: 100,
        locations: [],
        npcs: [],
        relationships: [],
        npcRelationships: [],
      },
    ],
  };
}

function registerInfluenceSettings() {
  game.settings.register(MODULE_ID, "influenceData", {
    scope: "world",
    config: false,
    type: Object,
    default: defaultInfluenceData(),
  });
  // "" means "no personal override — follow the GM's shared theme above".
  game.settings.register(MODULE_ID, "influenceTheme", {
    scope: "client",
    config: false,
    type: String,
    default: "",
  });
  // { [regionId]: { pan: {x,y}, zoom } }, purely this client's own camera.
  game.settings.register(MODULE_ID, "influenceView", {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });
}

function loadInfluenceData() {
  const data = game.settings.get(MODULE_ID, "influenceData");
  if (!data || !Array.isArray(data.regions) || !data.regions.length) return defaultInfluenceData();
  for (const region of data.regions) {
    region.locations ??= [];
    region.npcs ??= [];
    region.relationships ??= [];
    region.npcRelationships ??= [];
    region.background ??= "void";
    region.bgScale ??= 100;
  }
  data.nextId ??= 1;
  if (!data.regions.some((r) => r.id === data.activeRegionId)) data.activeRegionId = data.regions[0].id;
  return data;
}

async function saveInfluenceData(data) {
  if (!game.user.isGM) return;
  await game.settings.set(MODULE_ID, "influenceData", data);
}

function loadInfluenceTheme() {
  try {
    return game.settings.get(MODULE_ID, "influenceTheme") || "";
  } catch (err) {
    return "";
  }
}

async function saveInfluenceTheme(theme) {
  await game.settings.set(MODULE_ID, "influenceTheme", theme || "");
}

function loadInfluenceView() {
  try {
    return foundry.utils.deepClone(game.settings.get(MODULE_ID, "influenceView") || {});
  } catch (err) {
    return {};
  }
}

async function saveInfluenceView(view) {
  await game.settings.set(MODULE_ID, "influenceView", view);
}

function findInfluenceRegion(data, id) {
  return data.regions.find((r) => r.id === id) || null;
}

function findInfluenceLocation(region, id) {
  return region.locations.find((l) => l.id === id) || null;
}

function findInfluenceNpc(region, id) {
  return region.npcs.find((n) => n.id === id) || null;
}

function npcsForInfluenceLocation(region, locId) {
  return region.npcs.filter((n) => n.locId === locId);
}

function standaloneInfluenceNpcs(region) {
  return region.npcs.filter((n) => !n.locId);
}

function findInfluenceRel(region, id) {
  return region.relationships.find((r) => r.id === id) || null;
}

function findInfluenceNpcRel(region, id) {
  return region.npcRelationships.find((r) => r.id === id) || null;
}

function influenceRelColor(type) {
  return type === "alliance" ? "var(--ql-good)" : type === "hostile" ? "var(--ql-bad)" : "var(--ql-link-neutral)";
}

function influenceStatClass(v) {
  return v > 0 ? "ql-pos" : v < 0 ? "ql-neg" : "ql-zero";
}

function influenceStatLabel(v) {
  return (v > 0 ? "+" : "") + v;
}

/* =========================================================================
   Optional integrations. Both are best effort: Simple Calendar and
   Segmented Cycle are read through their public settings/API rather than
   a tight dependency, so Quest Log stays fully usable without either.
   ========================================================================= */

function isSimpleCalendarActive() {
  return !!(game.modules.get(SIMPLE_CALENDAR_MODULE_ID)?.active && window.SimpleCalendar?.api);
}

function simpleCalendarDateLabel() {
  try {
    const display = window.SimpleCalendar.api.currentDateTimeDisplay();
    return display?.date || null;
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not read the date from Simple Calendar`, err);
    return null;
  }
}

function currentDateLabel(data) {
  if (data.useSimpleCalendar && isSimpleCalendarActive()) {
    const label = simpleCalendarDateLabel();
    if (label) return label;
  }
  return formatDate(data.calendar, data.currentDateObj);
}

// Simple Calendar's own months, in the { name, days } shape Quest Log's
// date helpers already understand.
function simpleCalendarMonths() {
  try {
    const months = window.SimpleCalendar.api.getAllMonths();
    return months.map((m) => ({ name: m.name, days: m.numberOfDays }));
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not read months from Simple Calendar`, err);
    return null;
  }
}

function simpleCalendarYearPostfix() {
  try {
    return window.SimpleCalendar.api.getCurrentYear()?.postfix || "";
  } catch (err) {
    return "";
  }
}

// Simple Calendar's month/day are 0-indexed; Quest Log's own date objects
// use a 0-indexed monthIndex but a 1-indexed day, so only day needs the +1.
function simpleCalendarCurrentDateObj() {
  try {
    const dt = window.SimpleCalendar.api.currentDateTime();
    return { year: dt.year, monthIndex: dt.month, day: dt.day + 1 };
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not read the current date from Simple Calendar`, err);
    return null;
  }
}

// The calendar (months + label) and "today" that the grid, month nav, and
// quest date pickers should actually use. When synced to Simple Calendar
// this is pulled live from Simple Calendar itself, so the grid never shows
// a different calendar than the date already shown in the top bar; when
// not synced (or Simple Calendar's data isn't readable) it falls back to
// Quest Log's own internal calendar, same as before.
function effectiveCalendar(data) {
  if (data.useSimpleCalendar && isSimpleCalendarActive()) {
    const months = simpleCalendarMonths();
    const dateObj = simpleCalendarCurrentDateObj();
    if (months && months.length && dateObj) {
      return { calendar: { months, yearLabel: simpleCalendarYearPostfix() }, dateObj, live: true };
    }
  }
  return { calendar: data.calendar, dateObj: data.currentDateObj, live: false };
}

function isSegmentedCycleActive() {
  return !!game.modules.get(SC_MODULE_ID)?.active;
}

// Best-effort write-back to Segmented Cycle's own "Filled" settings, so a
// GM adjusting the Day/Night bars from inside Quest Log also moves the
// real module's own widget. Segmented Cycle's exact setting keys aren't
// something Quest Log controls, so this only writes when a setting of
// that name already exists, and never throws if it doesn't; Quest Log's
// own segmentDay/segmentNight values (above) remain the source of truth
// either way, and the "Filled" hook below reads changes back in.
// Set right before we write to Segmented Cycle's own setting, and read by
// the updateSetting hook below to recognise "that change was just us" and
// skip reacting to it. Without this, our own write bounces back through
// applySegmentTick and gets applied a second time, since Foundry's
// updateSetting hook can't otherwise tell our writes apart from someone
// else's (the real widget, a macro, another client).
const _scEchoGuard = { day: false, night: false, custom: false };

function trySyncSegmentedCycleFilled(bar, value) {
  if (!game.user.isGM || !isSegmentedCycleActive() || !SEGMENT_BARS.includes(bar)) return;
  const key = `${bar}Filled`;
  try {
    if (game.settings.settings.has(`${SC_MODULE_ID}.${key}`)) {
      _scEchoGuard[bar] = true;
      game.settings.set(SC_MODULE_ID, key, value);
    }
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not sync ${bar} segment back to Segmented Cycle`, err);
  }
}

// Called whenever one of Segmented Cycle's *Filled settings changes. Any
// quest with its Segment Cycle integration enabled and pointed at that bar
// has its ticked count advanced by however much the bar just filled, up to
// its own allocation, mirroring the "automatically tick the segment
// forward" behaviour from the original spec.
async function applySegmentTick(bar, newFilled) {
  if (!game.user.isGM || !SEGMENT_BARS.includes(bar)) return;
  const data = loadQuestData();
  const prev = data.segmentBarPrevFilled[bar] ?? 0;
  const delta = newFilled - prev;
  data.segmentBarPrevFilled[bar] = newFilled;

  // Mirror the real module's Day/Night fill into Quest Log's own bars so
  // the calendar panel stays in step when the change came from elsewhere
  // (the real widget, another macro, etc.), not just from Quest Log itself.
  if (bar === "day") data.segmentDay.filled = Math.max(0, Math.min(data.segmentDay.total, newFilled));
  if (bar === "night") data.segmentNight.filled = Math.max(0, Math.min(data.segmentNight.total, newFilled));

  if (delta > 0) {
    for (const tabKey of Object.keys(data.tabs)) {
      for (const q of data.tabs[tabKey].quests) {
        if (q.segment?.enabled && q.segment.bar === bar && q.status === "active") {
          q.segment.ticked = Math.min(q.segment.allocated, q.segment.ticked + delta);
        }
      }
    }
  }
  await saveQuestData(data);
}

/* =========================================================================
   Cross client actions. World settings can only be written by a GM, so the
   one action a player can trigger (adding a party note) is relayed to a
   connected GM's client over a socket, which applies it and saves as
   normal; the resulting setting update then reaches everyone, including
   the player who asked for it. This mirrors how most Foundry modules
   handle player writes to shared world data, and it does mean a GM needs
   to be online for a player's note to land.
   ========================================================================= */

async function addPlayerNoteLocal(questId, author, text) {
  const data = loadQuestData();
  const loc = findQuestLocation(data, questId);
  if (!loc) return;
  const quest = data.tabs[loc.tabKey].quests[loc.idx];
  const clean = (text || "").trim();
  if (!clean) return;
  quest.playerNotes.push({ id: `p${data.nextNoteId++}`, author, text: clean, date: currentDateLabel(data) });
  await saveQuestData(data);
}

function requestAddPlayerNote(questId, text) {
  if (game.user.isGM) {
    addPlayerNoteLocal(questId, game.user.name, text);
    return;
  }
  game.socket.emit(SOCKET_NAME, { action: "addPlayerNote", questId, text, author: game.user.name });
}

function requestSpotlightQuest(questId, tabKey, title) {
  game.socket.emit(SOCKET_NAME, { action: "spotlightQuest", questId, tabKey, title, from: game.user.name });
  spotlightQuestLocal(questId, tabKey);
}

function spotlightQuestLocal(questId, tabKey) {
  if (!app) app = new QuestLogApp();
  if (!app.rendered) app.render(true);
  app.activeTab = tabKey;
  app.expandedId = questId;
  app.render(false);
  app.bringToTop?.();
}

// Same "Show Players" mechanic as spotlightQuest above, retargeted at the
// Influence board: switches every connected client's app to the given
// region and selects the given location/NPC there, so the whole table ends
// up looking at the same node the GM just called out.
function requestSpotlightInfluence(regionId, selection) {
  game.socket.emit(SOCKET_NAME, { action: "spotlightInfluence", regionId, selection, from: game.user.name });
  spotlightInfluenceLocal(regionId, selection);
}

function spotlightInfluenceLocal(regionId, selection) {
  if (!app) app = new QuestLogApp();
  if (!app.rendered) app.render(true);
  app.activeTab = "influence";
  app.influenceActiveRegionId = regionId;
  app.influenceSelected = selection || null;
  app.render(false);
  app.bringToTop?.();
}

function onSocketMessage(msg) {
  if (!msg) return;

  // GM-only handlers: a player asking the GM's client to write shared data.
  if (game.user.isGM && msg.action === "addPlayerNote") {
    addPlayerNoteLocal(msg.questId, msg.author, msg.text);
    return;
  }

  // Broadcast to everyone, including whoever sent it (harmless no-op there
  // since spotlightQuestLocal already ran for them synchronously).
  if (msg.action === "spotlightQuest" && msg.from !== game.user.name) {
    spotlightQuestLocal(msg.questId, msg.tabKey);
  }
  if (msg.action === "spotlightInfluence" && msg.from !== game.user.name) {
    spotlightInfluenceLocal(msg.regionId, msg.selection);
  }
}

/* =========================================================================
   Shared lookups used by both the app and the socket handler.
   ========================================================================= */

function findQuestLocation(data, id) {
  for (const tabKey of Object.keys(data.tabs)) {
    const idx = data.tabs[tabKey].quests.findIndex((q) => q.id === id);
    if (idx !== -1) return { tabKey, idx };
  }
  return null;
}

function getQuestsLinkedToDate(data, d) {
  const results = [];
  for (const tabKey of Object.keys(data.tabs)) {
    const tab = data.tabs[tabKey];
    for (const q of tab.quests) {
      if (q.linkedDate && sameDate(q.linkedDate, d)) {
        results.push({ questId: q.id, title: q.title, tabLabel: tab.label });
      }
    }
  }
  return results;
}

function buildDayCells(data, year, monthIndex, selectedKey) {
  const months = data.calendar.months;
  const month = months[monthIndex] || months[0];
  const cells = [];
  for (let day = 1; day <= month.days; day++) {
    const d = { year, monthIndex, day };
    const key = dateKey(d);
    const isToday = sameDate(d, data.currentDateObj);
    const isSelected = selectedKey === key;
    const events = data.calendarEvents[key] || [];
    const linked = getQuestsLinkedToDate(data, d);
    const hasMarks = events.length > 0 || linked.length > 0;
    cells.push({
      day,
      key,
      year,
      monthIndex,
      hasMarks,
      style: `position:relative; display:flex; align-items:center; justify-content:center; aspect-ratio:1; min-height:26px; border-radius:6px; border:1px solid ${isToday ? "#C9A227" : "rgba(255,255,255,0.12)"}; background:${isSelected ? "rgba(201,162,39,0.28)" : "rgba(255,255,255,0.03)"}; color:${isToday ? "#e8c96a" : "#cfc6b0"}; font-size:11px; cursor:pointer; font-weight:${isToday ? "700" : "400"};`,
    });
  }
  return cells;
}

function buildMonthOptions(months, selectedIdx) {
  return months.map((m, i) => ({ value: i, label: m.name, selected: i === selectedIdx }));
}

function buildDayOptions(maxDay, selectedDay) {
  const opts = [];
  for (let d = 1; d <= maxDay; d++) opts.push({ value: d, selected: d === selectedDay });
  return opts;
}

function buildSegmentPips(segment) {
  const gap = 3;
  const trackWidth = 110;
  const pipW = Math.max(5, Math.min(14, Math.floor((trackWidth - (segment.allocated - 1) * gap) / segment.allocated)));
  const pips = [];
  for (let i = 0; i < segment.allocated; i++) {
    const filled = i < segment.ticked;
    pips.push({ style: `width:${pipW}px; height:12px; border-radius:3px; background:${filled ? "#C9A227" : "transparent"}; border:1px solid #C9A227;` });
  }
  return pips;
}

// The two ever-present Day/Night bars in the calendar panel. `interactive`
// is only true for a real GM not previewing as a player: players (and a
// previewing GM) see the same bars read-only.
function buildDayNightCells(segState, color, interactive) {
  const cells = [];
  for (let i = 0; i < segState.total; i++) {
    const on = i < segState.filled;
    cells.push({
      n: i,
      style: `flex:1; height:10px; border-radius:2px; background:${on ? color : "rgba(120,110,90,0.25)"}; border:1px solid rgba(201,162,39,0.3);${interactive ? " cursor:pointer;" : ""}`,
    });
  }
  return { cells, label: `${segState.filled} / ${segState.total}`, interactive };
}

/* =========================================================================
   The application itself. Persistent data (quests, tabs, calendar, events)
   lives in the world setting above; everything here on the instance is
   purely local UI state (which tab is showing, what's mid-edit, which
   popover is open) so re-rendering never has to round trip the network.
   ========================================================================= */

class QuestLogApp extends Application {
  constructor(options) {
    super(options);
    this.activeTab = "main";
    this.activeCategory = {};
    this.expandedId = null;

    this.showAddForm = false;
    this.draft = { title: "", tab: "main", category: "", summary: "" };

    // Editing an already-logged quest's own title/section/category/summary,
    // as opposed to the "add new quest" form above.
    this.editingQuestId = null;
    this._editDrafts = {};

    this.showCatInput = false;
    this.catDraft = "";

    this.editingTabKey = null;
    this.tabNameDraft = "";
    this.showAddTabInput = false;
    this.newTabDraft = "";

    this.configOpen = false;
    this.viewAsPlayer = false;

    // The Calendar and Segmented Cycle panels are their own small floating
    // windows, docked to the right edge of this one; these two flags are
    // just "is that satellite window open", the widgets themselves live in
    // calendarWidget/segmentWidget below.
    this.calendarPanelOpen = false;
    this.segmentPanelOpen = false;
    this.calendarWidget = null;
    this.segmentWidget = null;
    this.calendarViewMonth = null;
    this.selectedCalendarDay = null;
    this.calendarEventDraft = "";

    this.showJumpPicker = false;
    this.jumpView = null;

    this.questDatePicker = { questId: null, year: 0, monthIndex: 0, day: 1 };

    this._updateDrafts = {};
    this._noteDrafts = {};

    // Influence tab. Its shared data (regions/locations/npcs/relationships)
    // lives in the "influenceData" world setting; everything here is, like
    // the rest of this class, purely local UI state (which node is
    // selected, which menu is open, mid-drag state).
    this.influenceActiveRegionId = null;
    this.influenceSelected = null; // {kind:"location"|"npc"|"locationRel"|"npcRel", id}
    this.influenceLinking = null; // {fromId} while picking the 2nd location to link
    this.influenceLinkingNpc = null; // {fromId} while picking the 2nd NPC to link
    this.showInfluenceRegionMenu = false;
    this.showInfluenceBgMenu = false;
    this.influenceEditingRegionId = null;
    this.influenceRegionNameDraft = "";
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "shrimps-quest-influence-tracker-app",
      title: game.i18n?.localize("QUESTLOG.Title") ?? "Shrimps Quest Log",
      template: `modules/${MODULE_ID}/templates/quest-log.hbs`,
      width: 900,
      height: 760,
      resizable: true,
      classes: ["quest-log-app"],
    });
  }

  /* ---------------- data assembly ---------------- */

  getData() {
    const data = loadQuestData();
    const realIsGm = game.user.isGM;
    // Everything permission-gated below uses this: a GM previewing as a
    // player sees exactly what a player would, while the toggle itself
    // (and anything about the preview state) still checks realIsGm.
    const isGm = realIsGm && !this.viewAsPlayer;
    const calendar = data.calendar;

    // The world-shared default theme (data.theme, set by a GM from the
    // Quest Log settings panel) can be overridden per viewer from inside
    // the Influence tab; that override is a client-scoped preference, not
    // shared, so it never touches the world setting above. Whichever wins
    // recolors the *entire* app shell (title bar, tabs, everything), not
    // just the Influence tab, via the ql-theme-* class on the root element.
    const clientThemeOverride = loadInfluenceTheme();
    const effectiveTheme = clientThemeOverride || data.theme;

    const scSynced = !!(data.useSimpleCalendar && isSimpleCalendarActive());
    const { calendar: activeCalendar, dateObj: activeDateObj } = effectiveCalendar(data);
    const gridData = { ...data, calendar: activeCalendar, currentDateObj: activeDateObj };

    // Reset the panel's month view to "today" whenever it's uninitialised,
    // out of range for whichever calendar is active, or sync was just
    // switched on/off — otherwise it can keep pointing at a month index
    // that belongs to the other calendar entirely.
    if (
      !this.calendarViewMonth ||
      this.calendarViewMonth.monthIndex >= activeCalendar.months.length ||
      this._calendarViewSynced !== scSynced
    ) {
      this.calendarViewMonth = { year: activeDateObj.year, monthIndex: activeDateObj.monthIndex };
    }
    this._calendarViewSynced = scSynced;

    if (!this.jumpView) this.jumpView = { year: data.currentDateObj.year, monthIndex: data.currentDateObj.monthIndex };

    const segmentModuleActive = isSegmentedCycleActive();
    const effectiveShowSegmentSection = data.showSegmentSection && segmentModuleActive;

    const segmentToggleVisible = effectiveShowSegmentSection && data.showCalendarSection;
    const segmentPanelOpen = segmentToggleVisible && this.segmentPanelOpen;
    const daySegments = buildDayNightCells(data.segmentDay, "#e8c468", isGm);
    const nightSegments = buildDayNightCells(data.segmentNight, "#7d8fc9", isGm);

    const activeTab = this.activeTab;
    const isFinished = activeTab === "finished";
    const isInfluence = activeTab === "influence";
    const activeCat = this.activeCategory[activeTab] || "all";

    const realTabOrder = Object.keys(data.tabs);
    const finishedCount = this._getFinishedEntries(data).length;
    const tabOrder = [...realTabOrder, "finished", "influence"];
    const canDeleteTab = realTabOrder.length > 1;
    const tabButtons = tabOrder.map((key) => {
      const active = key === activeTab;
      const label = key === "finished" ? "Finished" : key === "influence" ? (game.i18n?.localize("QUESTLOG.InfluenceTab") ?? "Influence") : data.tabs[key].label;
      const count = key === "finished" ? finishedCount : key === "influence" ? null : data.tabs[key].quests.filter((q) => q.status === "active").length;
      return {
        key,
        label,
        count,
        active,
        style: `background:${active ? "rgba(201,162,39,0.14)" : "transparent"}; color:${active ? "#e8c96a" : "#a89e88"}; border:none; border-bottom:2px solid ${active ? "#C9A227" : "transparent"}; padding:10px 18px; font-size:14px; font-weight:600; cursor:pointer; border-radius:6px 6px 0 0;`,
        canManage: isGm && key !== "finished" && key !== "influence" && canDeleteTab,
        isEditing: this.editingTabKey === key,
        nameDraft: this.editingTabKey === key ? this.tabNameDraft : "",
      };
    });

    let questCards = [];
    let categorySource = [];

    if (isInfluence) {
      // Handled entirely below via _buildInfluenceContext(); the ordinary
      // quest list/category machinery doesn't apply to this tab.
    } else if (isFinished) {
      const entries = this._getFinishedEntries(data);
      categorySource = [...new Set(entries.map((e) => e.quest.category))].sort();
      const filtered = activeCat === "all" ? entries : entries.filter((e) => e.quest.category === activeCat);
      questCards = filtered.map((e) => this._makeQuestCard(gridData, e.quest, this.expandedId === e.quest.id, e.originLabel, isGm, effectiveShowSegmentSection, scSynced, e.tabKey));
    } else {
      const tabKeyForCards = data.tabs[activeTab] ? activeTab : realTabOrder[0];
      const tab = data.tabs[tabKeyForCards];
      categorySource = tab.categories;
      const activeQuests = tab.quests.filter((q) => q.status === "active");
      const filtered = activeCat === "all" ? activeQuests : activeQuests.filter((q) => q.category === activeCat);
      questCards = filtered.map((q) => this._makeQuestCard(gridData, q, this.expandedId === q.id, null, isGm, effectiveShowSegmentSection, scSynced, tabKeyForCards));
    }

    const categoryChips = [{ key: "all", label: "All", active: activeCat === "all" }, ...categorySource.map((c) => ({ key: c, label: c, active: activeCat === c }))].map((chip) => ({
      ...chip,
      style: `background:${chip.active ? "rgba(201,162,39,0.2)" : "rgba(255,255,255,0.05)"}; color:${chip.active ? "#e8c96a" : "#a89e88"}; border:1px solid ${chip.active ? "rgba(201,162,39,0.5)" : "rgba(255,255,255,0.14)"}; border-radius:20px; padding:6px 14px; font-size:12px; cursor:pointer;`,
      canDelete: isGm && !isFinished && chip.key !== "all",
    }));

    const sectionOptions = realTabOrder.map((key) => ({ key, label: data.tabs[key].label }));
    const monthOptions = buildMonthOptions(activeCalendar.months, -1);

    const monthRows = calendar.months.map((m, i) => ({ idx: i, name: m.name, days: m.days, canDelete: calendar.months.length > 1 }));

    const jumpMonth = calendar.months[this.jumpView.monthIndex] || calendar.months[0];
    const jumpMonthLabel = `${jumpMonth.name}, ${this.jumpView.year} ${calendar.yearLabel}`;
    const jumpCells = buildDayCells(data, this.jumpView.year, this.jumpView.monthIndex, null);

    const calMonth = activeCalendar.months[this.calendarViewMonth.monthIndex] || activeCalendar.months[0];
    const calendarMonthLabel = `${calMonth.name}, ${this.calendarViewMonth.year} ${activeCalendar.yearLabel}`;
    const calendarCells = buildDayCells(gridData, this.calendarViewMonth.year, this.calendarViewMonth.monthIndex, this.selectedCalendarDay);

    let selectedCalendarDayLabel = "";
    let selectedCalendarEvents = [];
    let selectedLinkedQuests = [];
    if (this.selectedCalendarDay) {
      const parts = this.selectedCalendarDay.split("-").map((n) => parseInt(n, 10));
      const selDate = { year: parts[0], monthIndex: parts[1], day: parts[2] };
      selectedCalendarDayLabel = formatDate(activeCalendar, selDate);
      selectedCalendarEvents = data.calendarEvents[this.selectedCalendarDay] || [];
      selectedLinkedQuests = getQuestsLinkedToDate(data, selDate);
    }

    return {
      isGm,
      realIsGm,
      viewAsPlayer: this.viewAsPlayer,
      viewToggleLabel: this.viewAsPlayer ? "Exit Preview" : "Preview as Player",
      theme: effectiveTheme,
      themeOptions: INFLUENCE_THEMES.map((key) => ({ key, label: THEME_LABELS[key], active: key === data.theme })),
      currentDate: currentDateLabel(data),
      scActive: isSimpleCalendarActive(),
      scSynced,
      useSimpleCalendar: data.useSimpleCalendar,

      showCalendarSection: data.showCalendarSection,
      segmentModuleActive,
      showSegmentSection: data.showSegmentSection,
      effectiveShowSegmentSection,
      segmentToggleVisible,
      segmentPanelOpen,
      daySegments,
      nightSegments,

      configOpen: this.configOpen,
      calendarYearLabel: calendar.yearLabel,
      monthRows,
      monthOptions,

      showJumpPicker: this.showJumpPicker,
      jumpMonthLabel,
      jumpCells,

      calendarPanelOpen: this.calendarPanelOpen,
      calendarMonthLabel,
      calendarCells,
      hasSelectedCalendarDay: !!this.selectedCalendarDay,
      selectedCalendarDay: this.selectedCalendarDay,
      selectedCalendarDayLabel,
      selectedCalendarEvents,
      hasSelectedLinkedQuests: selectedLinkedQuests.length > 0,
      selectedLinkedQuests,
      calendarEventDraft: this.calendarEventDraft,

      tabButtons,
      showTabAdmin: isGm,
      showAddTabInput: this.showAddTabInput,
      newTabDraft: this.newTabDraft,

      categoryChips,
      showCategoryAdmin: isGm && !isFinished,
      showCatInput: this.showCatInput,
      catDraft: this.catDraft,

      showAddForm: this.showAddForm,
      draft: this.draft,
      sectionOptions,
      draftCategoryOptions: data.tabs[this.draft.tab] ? data.tabs[this.draft.tab].categories : [],

      questCards,
      noQuests: questCards.length === 0,

      isInfluence,
      influence: isInfluence ? this._buildInfluenceContext(isGm, effectiveTheme, data.theme) : null,
    };
  }

  _getFinishedEntries(data) {
    const entries = [];
    for (const key of Object.keys(data.tabs)) {
      const tab = data.tabs[key];
      for (const q of tab.quests) {
        if (q.status !== "active") entries.push({ quest: q, originLabel: tab.label, tabKey: key });
      }
    }
    return entries;
  }

  _makeQuestCard(data, q, isExpanded, originLabel, isGm, effectiveShowSegmentSection, scSynced, tabKey) {
    const finished = q.status !== "active";
    const statusColor = q.status === "active" ? "#C9A227" : q.status === "completed" ? "#5a9c6a" : "#8B0000";
    const titleStyle = finished
      ? `color:${statusColor}; text-decoration:line-through; text-decoration-thickness:2px; opacity:0.75;`
      : "color:var(--ql-text);";

    const revealedNotes = q.updates.filter((n) => n.revealed);
    const updates = q.updates.map((n) => ({
      ...n,
      textStyle: n.revealed ? "color:#c9a227;" : "color:#d8cdbb;",
      metaLine: n.revealed ? `Written ${n.dateWritten} · revealed to players ${n.dateRevealed}` : `Written ${n.dateWritten} · not yet revealed`,
      revealLabel: n.revealed ? "Revealed" : "Reveal",
      revealBtnStyle: n.revealed
        ? "background:rgba(201,162,39,0.25); color:#e8c96a; border:1px solid rgba(201,162,39,0.5); border-radius:6px; padding:3px 8px; font-size:10px; cursor:pointer; white-space:nowrap;"
        : "background:rgba(255,255,255,0.06); color:#a89e88; border:1px solid rgba(255,255,255,0.16); border-radius:6px; padding:3px 8px; font-size:10px; cursor:pointer; white-space:nowrap;",
    }));

    const playerNotes = q.playerNotes.map((n) => ({ ...n, canDelete: isGm }));

    const hasLinkedDate = !!q.linkedDate;
    const linkedDateFull = hasLinkedDate ? formatDate(data.calendar, q.linkedDate) : "";

    const dp = this.questDatePicker;
    const showDatePicker = dp.questId === q.id;
    let datePicker = null;
    if (showDatePicker) {
      const months = data.calendar.months;
      const pickMonth = months[dp.monthIndex] || months[0];
      datePicker = {
        year: dp.year,
        monthOptions: buildMonthOptions(months, dp.monthIndex),
        dayOptions: buildDayOptions(pickMonth.days, dp.day),
      };
    }

    const dayNightIcon = q.segment.enabled && (q.segment.bar === "day" || q.segment.bar === "night") ? q.segment.bar : null;

    const isEditing = this.editingQuestId === q.id;
    const editDraft = this._editDrafts[q.id] || { title: q.title, tab: tabKey, category: q.category, summary: q.summary };
    const editSectionOptions = Object.keys(data.tabs).map((key) => ({ key, label: data.tabs[key].label, selected: key === editDraft.tab }));
    const editCategoryOptions = (data.tabs[editDraft.tab]?.categories || []).map((c) => ({ value: c, selected: c === editDraft.category }));

    return {
      id: q.id,
      tabKey,
      title: q.title,
      titleStyle,
      category: q.category,
      showOrigin: !!originLabel,
      originLabel: originLabel || "",
      status: q.status,
      summary: q.summary,
      dateLogged: q.dateLogged,
      isExpanded,
      chevron: isExpanded ? "▾" : "▸",
      cardStyle: `border-left:3px solid ${statusColor};`,
      dotStyle: `width:9px; height:9px; border-radius:50%; background:${statusColor}; flex:0 0 auto;`,

      isDayLinked: dayNightIcon === "day",
      isNightLinked: dayNightIcon === "night",
      showSpotlight: isGm,
      showEditButton: isGm,
      isEditing,
      editDraft,
      editSectionOptions,
      editCategoryOptions,

      showSegmentChip: isGm && q.segment.enabled && effectiveShowSegmentSection,
      segmentSummary: `${q.segment.ticked}/${q.segment.allocated} (${SEGMENT_BAR_LABELS[q.segment.bar] || "Day"})`,

      showLinkedChip: hasLinkedDate && data.showCalendarSection,
      linkedDateLabel: hasLinkedDate ? formatDate(data.calendar, q.linkedDate) : "",

      showGmSection: isGm,
      updatesHint: q.updates.length ? `(${q.updates.length})` : "",
      updates,
      updateDraft: this._updateDrafts[q.id] || "",

      showRevealedOnly: !isGm && revealedNotes.length > 0,
      revealedNotes,

      hasPlayerNotes: q.playerNotes.length > 0,
      playerNotes,
      noteDraft: this._noteDrafts[q.id] || "",

      showCalendarLink: isGm && data.showCalendarSection,
      scDateNote: scSynced,
      hasLinkedDate,
      linkedDateFull,
      showDatePicker,
      datePicker,

      showSegmentPanel: isGm && effectiveShowSegmentSection,
      segment: {
        enabled: q.segment.enabled,
        bar: q.segment.bar,
        barOptions: SEGMENT_BARS.map((b) => ({ value: b, label: SEGMENT_BAR_LABELS[b], selected: b === q.segment.bar })),
        allocated: q.segment.allocated,
        ticked: q.segment.ticked,
        pips: buildSegmentPips(q.segment),
      },

      status: q.status,
    };
  }

  /* ---------------- Influence tab data assembly ---------------- */

  _buildInfluenceContext(isGm, effectiveTheme) {
    const data = loadInfluenceData();
    if (!this.influenceActiveRegionId || !findInfluenceRegion(data, this.influenceActiveRegionId)) {
      this.influenceActiveRegionId = data.activeRegionId || data.regions[0].id;
    }
    const region = findInfluenceRegion(data, this.influenceActiveRegionId) || data.regions[0];

    const viewPrefs = loadInfluenceView();
    const view = viewPrefs[region.id] || { pan: { x: 40, y: 20 }, zoom: 0.6 };

    const regionOptions = data.regions.map((r) => ({ id: r.id, name: r.name, active: r.id === region.id }));

    const isCustomBg = !!(region.background && region.background.indexOf("data:") === 0);
    const backgroundStyle = isCustomBg
      ? `background:#000 url(${JSON.stringify(region.background)}) center / ${region.bgScale || 100}% ${region.bgScale || 100}% no-repeat;`
      : (() => {
          const preset = INFLUENCE_BG_PRESETS.find((p) => p.key === region.background) || INFLUENCE_BG_PRESETS[0];
          return `background:${preset.css}; background-size:${preset.key === "blueprint" ? "auto,40px 40px,40px 40px" : "cover"};`;
        })();

    const locations = region.locations.map((loc) => this._makeLocationMarker(region, loc));
    const standaloneNpcs = standaloneInfluenceNpcs(region).map((npc) => this._makeNpcMarkerData(region, npc));

    return {
      themeOptions: INFLUENCE_THEMES.map((key) => ({ key, label: THEME_LABELS[key], active: key === effectiveTheme })),
      regionOptions,
      showRegionMenu: this.showInfluenceRegionMenu,
      editingRegionId: this.influenceEditingRegionId,
      regionNameDraft: this.influenceRegionNameDraft,
      showBgMenu: this.showInfluenceBgMenu,
      bgPresets: INFLUENCE_BG_PRESETS.map((p) => ({ ...p, active: region.background === p.key })),
      isCustomBg,
      bgScale: region.bgScale || 100,
      region: { id: region.id, name: region.name },
      zoomPct: Math.round((view.zoom || 0.6) * 100),
      panX: view.pan?.x ?? 40,
      panY: view.pan?.y ?? 20,
      zoom: view.zoom || 0.6,
      backgroundStyle,
      locations,
      standaloneNpcs,
      lines: this._buildInfluenceLines(region),
      linking: !!this.influenceLinking,
      linkingNpc: !!this.influenceLinkingNpc,
      hasInspector: !!this.influenceSelected,
      inspector: this.influenceSelected ? this._buildInfluenceInspector(region, this.influenceSelected, isGm) : null,
    };
  }

  _makeLocationMarker(region, loc) {
    const selected = this.influenceSelected?.kind === "location" && this.influenceSelected.id === loc.id;
    const linkTarget = this.influenceLinking?.fromId === loc.id;
    const expanded = loc.expanded !== false;
    const siblingNpcs = npcsForInfluenceLocation(region, loc.id);
    const linkedCount = siblingNpcs.length;

    // Nested NPCs aren't positioned from their own stored x/y — like the
    // artifact prototype, their on-screen spot is recomputed every render
    // from a fan-out formula keyed on the parent location's position, the
    // NPC's index among siblings, and the sibling count. This keeps a
    // location's children tidy without the GM having to manually arrange
    // them, and only applies while the location is expanded.
    let npcs = [];
    if (expanded && linkedCount > 0) {
      const spread = Math.min(70, 34 + linkedCount * 6);
      const angleSpan = Math.min(140, 40 + linkedCount * 22);
      const startAngle = 90 - angleSpan / 2;
      npcs = siblingNpcs.map((npc, i) => {
        const angle = linkedCount === 1 ? 90 : startAngle + (angleSpan / (linkedCount - 1)) * i;
        const rad = (angle * Math.PI) / 180;
        const dist = 100;
        const nx = loc.x + Math.cos(rad) * dist;
        const ny = loc.y + spread + Math.sin(rad) * 30;
        const marker = this._makeNpcMarkerData(region, npc);
        return {
          ...marker,
          x: nx,
          y: ny,
          lineX1: loc.x,
          lineY1: loc.y + 26,
          lineX2: nx,
          lineY2: ny - 21,
        };
      });
    }

    return {
      id: loc.id,
      name: loc.name,
      x: loc.x,
      y: loc.y,
      color: loc.color,
      image: loc.image || null,
      styleVar: `--inf-tok:${loc.color};`,
      imageStyle: loc.image ? `background-image:url(${JSON.stringify(loc.image)});` : "",
      initial: (loc.name || "?").trim().charAt(0).toUpperCase() || "?",
      selected,
      linkTarget,
      expanded,
      linkedCount,
      npcs,
    };
  }

  _makeNpcMarkerData(region, npc) {
    const selected = this.influenceSelected?.kind === "npc" && this.influenceSelected.id === npc.id;
    const linkTarget = this.influenceLinkingNpc?.fromId === npc.id;
    const showStanding = !!npc.showStats?.standing;
    const showFavour = !!npc.showStats?.favour;
    const showRelationship = !!npc.showStats?.relationship;
    return {
      id: npc.id,
      name: npc.name,
      x: npc.x,
      y: npc.y,
      color: npc.color,
      image: npc.image || null,
      styleVar: `--inf-tok:${npc.color};`,
      imageStyle: npc.image ? `background-image:url(${JSON.stringify(npc.image)});` : "",
      initial: (npc.name || "?").trim().charAt(0).toUpperCase() || "?",
      selected,
      linkTarget,
      showStanding,
      showFavour,
      showRelationship,
      hasStats: showStanding || showFavour || showRelationship,
      standingClass: influenceStatClass(npc.standing),
      standingLabel: influenceStatLabel(npc.standing),
      favourClass: influenceStatClass(npc.favour),
      favourLabel: influenceStatLabel(npc.favour),
      relationshipClass: influenceStatClass(npc.relationship),
      relationshipLabel: influenceStatLabel(npc.relationship),
    };
  }

  _buildInfluenceLines(region) {
    const locLines = region.relationships
      .map((r) => {
        const a = findInfluenceLocation(region, r.a);
        const b = findInfluenceLocation(region, r.b);
        if (!a || !b) return null;
        return {
          id: r.id,
          kind: "location",
          type: r.type,
          label: r.label || "",
          color: influenceRelColor(r.type),
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2,
        };
      })
      .filter(Boolean);
    const npcLines = region.npcRelationships
      .map((r) => {
        const a = findInfluenceNpc(region, r.a);
        const b = findInfluenceNpc(region, r.b);
        if (!a || !b) return null;
        return {
          id: r.id,
          kind: "npc",
          type: r.type,
          label: r.label || "",
          color: influenceRelColor(r.type),
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2,
        };
      })
      .filter(Boolean);
    return [...locLines, ...npcLines];
  }

  _buildInfluenceInspector(region, selected, isGm) {
    if (selected.kind === "locationRel" || selected.kind === "npcRel") {
      const relKind = selected.kind === "locationRel" ? "location" : "npc";
      const rel = relKind === "location" ? findInfluenceRel(region, selected.id) : findInfluenceNpcRel(region, selected.id);
      if (!rel) return null;
      const a = relKind === "location" ? findInfluenceLocation(region, rel.a) : findInfluenceNpc(region, rel.a);
      const b = relKind === "location" ? findInfluenceLocation(region, rel.b) : findInfluenceNpc(region, rel.b);
      return {
        isRelationship: true,
        relKind,
        id: rel.id,
        type: rel.type,
        label: rel.label || "",
        aName: a?.name || "?",
        bName: b?.name || "?",
        kindLabel: relKind === "location" ? "Relationship" : "NPC Relationship",
      };
    }

    const isLocation = selected.kind === "location";
    const node = isLocation ? findInfluenceLocation(region, selected.id) : findInfluenceNpc(region, selected.id);
    if (!node) return null;

    const base = {
      isRelationship: false,
      isLocation,
      isNpc: !isLocation,
      kind: selected.kind,
      kindLabel: isLocation ? "Location" : "NPC / Faction",
      id: node.id,
      name: node.name,
      notes: node.notes || "",
      color: node.color,
      image: node.image || null,
      styleVar: `--inf-tok:${node.color};`,
      imageStyle: node.image ? `background-image:url(${JSON.stringify(node.image)});` : "",
      initial: (node.name || "?").trim().charAt(0).toUpperCase() || "?",
      swatches: INFLUENCE_SWATCHES,
    };

    if (isLocation) {
      base.children = npcsForInfluenceLocation(region, node.id).map((n) => ({ id: n.id, name: n.name, color: n.color }));
      return base;
    }

    base.showStanding = !!node.showStats?.standing;
    base.showFavour = !!node.showStats?.favour;
    base.showRelationship = !!node.showStats?.relationship;
    base.standingClass = influenceStatClass(node.standing);
    base.standingLabel = influenceStatLabel(node.standing);
    base.favourClass = influenceStatClass(node.favour);
    base.favourLabel = influenceStatLabel(node.favour);
    base.relationshipClass = influenceStatClass(node.relationship);
    base.relationshipLabel = influenceStatLabel(node.relationship);
    return base;
  }

  /* ---------------- listeners ---------------- */

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0];
    root.addEventListener("click", (ev) => this._onClick(ev));
    root.addEventListener("change", (ev) => this._onChange(ev));
    this._activateInfluenceBoard(root);
  }

  // Dragging a marker (GM only) or panning the board (anyone) is plain
  // pointer-event manipulation rather than a Handlebars re-render per
  // frame, for a smooth drag; the final position/pan is written back (to
  // the world setting for a marker move, to this client's own view prefs
  // for a pan) only once, on pointerup.
  _activateInfluenceBoard(root) {
    const wrap = root.querySelector(".ql-inf-board-wrap");
    if (!wrap) return;
    wrap.addEventListener("pointerdown", (ev) => this._onInfluencePointerDown(ev, wrap));
  }

  _onInfluencePointerDown(ev, wrap) {
    if (ev.button !== undefined && ev.button !== 0) return;
    const marker = ev.target.closest("[data-marker-id]");
    const data = loadInfluenceData();
    const region = findInfluenceRegion(data, this.influenceActiveRegionId);
    if (!region) return;
    const viewPrefs = loadInfluenceView();
    const view = viewPrefs[region.id] || { pan: { x: 40, y: 20 }, zoom: 0.6 };
    const zoom = view.zoom || 0.6;

    if (marker) {
      // Nested NPCs (fanned out around an expanded location) don't have a
      // free-draggable position at all — like the artifact prototype, their
      // spot is recomputed from the fan-out formula on every render, so a
      // drag would just snap back. Leave the click to the ordinary
      // data-action delegate for selecting them instead.
      if (marker.dataset.markerLocked === "1") return;
      // A click (no meaningful movement) is still handled by the ordinary
      // data-action click delegate below for selecting/linking, so dragging
      // only takes over once the pointer actually moves.
      if (!game.user.isGM) return;
      const kind = marker.dataset.markerKind;
      const id = marker.dataset.markerId;
      const node = kind === "location" ? findInfluenceLocation(region, id) : findInfluenceNpc(region, id);
      if (!node) return;
      const startX = ev.clientX;
      const startY = ev.clientY;
      const origX = node.x;
      const origY = node.y;
      let moved = false;
      try { marker.setPointerCapture(ev.pointerId); } catch (err) { /* not critical */ }
      const onMove = (mv) => {
        const dx = (mv.clientX - startX) / zoom;
        const dy = (mv.clientY - startY) / zoom;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
        node.x = origX + dx;
        node.y = origY + dy;
        marker.style.left = `${node.x}px`;
        marker.style.top = `${node.y}px`;
        marker.classList.add("ql-inf-dragging");
      };
      const onUp = async () => {
        marker.removeEventListener("pointermove", onMove);
        marker.removeEventListener("pointerup", onUp);
        marker.classList.remove("ql-inf-dragging");
        if (moved) await saveInfluenceData(data);
        // The updateSetting hook re-renders everyone (including us) once the
        // write above lands; if nothing moved there's nothing to re-render.
      };
      marker.addEventListener("pointermove", onMove);
      marker.addEventListener("pointerup", onUp, { once: true });
      return;
    }

    // Panning the board itself: purely this client's own camera.
    const board = wrap.querySelector(".ql-inf-board");
    if (!board) return;
    const startX = ev.clientX;
    const startY = ev.clientY;
    const origPan = { x: view.pan?.x ?? 40, y: view.pan?.y ?? 20 };
    wrap.classList.add("ql-panning");
    try { wrap.setPointerCapture(ev.pointerId); } catch (err) { /* not critical */ }
    let finalPan = origPan;
    const onMove = (mv) => {
      finalPan = { x: origPan.x + (mv.clientX - startX), y: origPan.y + (mv.clientY - startY) };
      board.style.transform = `translate(${finalPan.x}px, ${finalPan.y}px) scale(${zoom})`;
    };
    const onUp = async () => {
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.classList.remove("ql-panning");
      const prefs = loadInfluenceView();
      prefs[region.id] = { pan: finalPan, zoom };
      await saveInfluenceView(prefs);
      this.render(false);
    };
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp, { once: true });
  }

  _onClick(ev) {
    const el = ev.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const questId = el.closest("[data-quest-id]")?.dataset.questId ?? el.dataset.questId;

    switch (action) {
      case "toggle-log": Hooks.callAll("questLog.toggle"); break;

      case "toggle-config": this.configOpen = !this.configOpen; this.render(false); break;
      case "close-config": this.configOpen = false; this.render(false); break;
      case "toggle-view": this._guardGm(() => { this.viewAsPlayer = !this.viewAsPlayer; this.render(false); }); break;
      case "set-theme": this._guardGm(() => {
        const data = loadQuestData();
        data.theme = el.dataset.theme;
        saveQuestData(data);
      }); break;

      case "toggle-segment-panel":
        this.segmentPanelOpen = !this.segmentPanelOpen;
        if (this.segmentPanelOpen) this._openSegmentWidget(); else this._closeSegmentWidget();
        this.render(false);
        break;
      case "spotlight-quest": this._guardGm(() => {
        const tabKey = el.dataset.tabKey;
        const quest = (() => {
          const data = loadQuestData();
          const loc = findQuestLocation(data, questId);
          return loc ? data.tabs[loc.tabKey].quests[loc.idx] : null;
        })();
        if (!quest) return;
        requestSpotlightQuest(questId, tabKey, quest.title);
        ChatMessage.create({ content: `<p><strong>${game.i18n?.localize("QUESTLOG.Title") ?? "Shrimps Quest Log"}</strong> — ${game.user.name} is showing everyone <em>${quest.title}</em>.</p>` });
      }); break;

      case "prev-day": this._guardGm(() => this._advanceDate(-1)); break;
      case "next-day": this._guardGm(() => this._advanceDate(1)); break;
      case "open-jump-picker": {
        const data = loadQuestData();
        this.jumpView = { year: data.currentDateObj.year, monthIndex: data.currentDateObj.monthIndex };
        this.showJumpPicker = true;
        this.render(false);
        break;
      }
      case "close-jump-picker": this.showJumpPicker = false; this.render(false); break;
      case "jump-prev-month": { const data = loadQuestData(); this.jumpView = shiftMonth(data.calendar, this.jumpView, -1); this.render(false); break; }
      case "jump-next-month": { const data = loadQuestData(); this.jumpView = shiftMonth(data.calendar, this.jumpView, 1); this.render(false); break; }
      case "jump-today": { const data = loadQuestData(); this.jumpView = { year: data.currentDateObj.year, monthIndex: data.currentDateObj.monthIndex }; this.render(false); break; }
      case "jump-to-day": this._guardGm(() => {
        const d = { year: Number(el.dataset.year), monthIndex: Number(el.dataset.month), day: Number(el.dataset.day) };
        const data = loadQuestData();
        data.currentDateObj = d;
        this.showJumpPicker = false;
        saveQuestData(data);
        this.render(false);
      }); break;

      case "toggle-calendar-panel":
        this.calendarPanelOpen = !this.calendarPanelOpen;
        if (this.calendarPanelOpen) this._openCalendarWidget(); else this._closeCalendarWidget();
        this.render(false);
        break;

      case "segment-day-cell": this._guardGm(() => {
        const n = Number(el.dataset.n);
        const data = loadQuestData();
        const clicked = n + 1;
        this._setDayNightFilled("day", data.segmentDay.filled === clicked ? n : clicked);
      }); break;
      case "segment-night-cell": this._guardGm(() => {
        const n = Number(el.dataset.n);
        const data = loadQuestData();
        const clicked = n + 1;
        this._setDayNightFilled("night", data.segmentNight.filled === clicked ? n : clicked);
      }); break;
      case "segment-day-inc": this._guardGm(() => this._changeDayNightTotal("day", 1)); break;
      case "segment-day-dec": this._guardGm(() => this._changeDayNightTotal("day", -1)); break;
      case "segment-day-reset": this._guardGm(() => this._setDayNightFilled("day", 0)); break;
      case "segment-night-inc": this._guardGm(() => this._changeDayNightTotal("night", 1)); break;
      case "segment-night-dec": this._guardGm(() => this._changeDayNightTotal("night", -1)); break;
      case "segment-night-reset": this._guardGm(() => this._setDayNightFilled("night", 0)); break;
      case "cal-prev-month": { const data = loadQuestData(); this.calendarViewMonth = shiftMonth(data.calendar, this.calendarViewMonth, -1); this.render(false); break; }
      case "cal-next-month": { const data = loadQuestData(); this.calendarViewMonth = shiftMonth(data.calendar, this.calendarViewMonth, 1); this.render(false); break; }
      case "cal-today": { const data = loadQuestData(); this.calendarViewMonth = { year: data.currentDateObj.year, monthIndex: data.currentDateObj.monthIndex }; this.render(false); break; }
      case "select-calendar-day": {
        const key = el.dataset.key;
        this.selectedCalendarDay = this.selectedCalendarDay === key ? null : key;
        this.calendarEventDraft = "";
        this.render(false);
        break;
      }
      case "add-calendar-event": this._guardGm(() => {
        if (!this.selectedCalendarDay) return;
        const text = this.calendarEventDraft.trim();
        if (!text) return;
        const data = loadQuestData();
        const key = this.selectedCalendarDay;
        data.calendarEvents[key] = [...(data.calendarEvents[key] || []), { id: `e${data.nextEventId++}`, text }];
        this.calendarEventDraft = "";
        saveQuestData(data);
      }); break;
      case "delete-calendar-event": this._guardGm(() => {
        const key = el.dataset.key;
        const id = el.dataset.id;
        const data = loadQuestData();
        data.calendarEvents[key] = (data.calendarEvents[key] || []).filter((e) => e.id !== id);
        saveQuestData(data);
      }); break;

      case "set-tab": this.activeTab = el.dataset.key; this.render(false); break;
      case "start-rename-tab": {
        const data = loadQuestData();
        this.editingTabKey = el.dataset.key;
        this.tabNameDraft = data.tabs[el.dataset.key]?.label || "";
        this.render(false);
        break;
      }
      case "cancel-rename-tab": this.editingTabKey = null; this.tabNameDraft = ""; this.render(false); break;
      case "confirm-rename-tab": this._guardGm(() => {
        const key = this.editingTabKey;
        if (!key) return;
        const name = this.tabNameDraft.trim();
        this.editingTabKey = null;
        this.tabNameDraft = "";
        if (!name) { this.render(false); return; }
        const data = loadQuestData();
        data.tabs[key] = { ...data.tabs[key], label: name };
        saveQuestData(data);
      }); break;
      case "delete-tab": this._guardGm(() => {
        const key = el.dataset.key;
        const data = loadQuestData();
        if (!data.tabs[key]) return;
        const removedIds = new Set(data.tabs[key].quests.map((q) => q.id));
        delete data.tabs[key];
        const remaining = Object.keys(data.tabs);
        if (this.activeTab === key) this.activeTab = remaining[0] || "finished";
        if (removedIds.has(this.expandedId)) this.expandedId = null;
        saveQuestData(data);
      }); break;
      case "open-add-tab-input": this.showAddTabInput = true; this.newTabDraft = ""; this.render(false); break;
      case "cancel-add-tab-input": this.showAddTabInput = false; this.newTabDraft = ""; this.render(false); break;
      case "add-tab": this._guardGm(() => {
        const name = this.newTabDraft.trim();
        this.showAddTabInput = false;
        this.newTabDraft = "";
        if (!name) { this.render(false); return; }
        const data = loadQuestData();
        const key = `tab${data.nextTabId++}`;
        data.tabs[key] = { label: name, categories: [], quests: [] };
        this.activeTab = key;
        saveQuestData(data);
      }); break;

      case "set-category": this.activeCategory[this.activeTab] = el.dataset.cat; this.render(false); break;
      case "open-category-input": this.showCatInput = true; this.catDraft = ""; this.render(false); break;
      case "cancel-category-input": this.showCatInput = false; this.catDraft = ""; this.render(false); break;
      case "add-category": this._guardGm(() => {
        const name = this.catDraft.trim();
        this.showCatInput = false;
        this.catDraft = "";
        if (!name) { this.render(false); return; }
        const data = loadQuestData();
        const tab = data.tabs[this.activeTab];
        if (tab && !tab.categories.includes(name)) tab.categories.push(name);
        saveQuestData(data);
      }); break;
      case "delete-category": this._guardGm(() => {
        const cat = el.dataset.cat;
        const data = loadQuestData();
        const tab = data.tabs[this.activeTab];
        if (!tab) return;
        tab.categories = tab.categories.filter((c) => c !== cat);
        if (this.activeCategory[this.activeTab] === cat) this.activeCategory[this.activeTab] = "all";
        saveQuestData(data);
      }); break;

      case "open-add-form": {
        const data = loadQuestData();
        const tab = this.activeTab === "finished" ? Object.keys(data.tabs)[0] : this.activeTab;
        this.showAddForm = true;
        this.draft = { title: "", tab, category: (data.tabs[tab]?.categories || [])[0] || "", summary: "" };
        this.render(false);
        break;
      }
      case "close-add-form": this.showAddForm = false; this.render(false); break;
      case "submit-quest": this._guardGm(() => {
        const title = this.draft.title.trim();
        this.showAddForm = false;
        if (!title) { this.render(false); return; }
        const data = loadQuestData();
        const newQuest = {
          id: `q${data.nextQuestId++}`,
          title,
          category: this.draft.category || "Uncategorised",
          status: "active",
          dateLogged: currentDateLabel(data),
          summary: this.draft.summary.trim() || "No summary yet.",
          updates: [],
          playerNotes: [],
          segment: { enabled: false, bar: "day", allocated: 5, ticked: 0 },
          linkedDate: null,
        };
        data.tabs[this.draft.tab].quests.push(newQuest);
        this.activeTab = this.draft.tab;
        this.expandedId = newQuest.id;
        saveQuestData(data);
      }); break;

      case "toggle-expand": this.expandedId = this.expandedId === questId ? null : questId; this.render(false); break;
      case "delete-quest": this._guardGm(() => {
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        data.tabs[loc.tabKey].quests.splice(loc.idx, 1);
        if (this.expandedId === questId) this.expandedId = null;
        if (this.editingQuestId === questId) this.editingQuestId = null;
        saveQuestData(data);
      }); break;

      case "edit-quest": this._guardGm(() => {
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        const quest = data.tabs[loc.tabKey].quests[loc.idx];
        this.editingQuestId = questId;
        this._editDrafts[questId] = { title: quest.title, tab: loc.tabKey, category: quest.category, summary: quest.summary };
        this.expandedId = questId;
        this.render(false);
      }); break;
      case "cancel-edit-quest": {
        delete this._editDrafts[questId];
        this.editingQuestId = null;
        this.render(false);
        break;
      }
      case "confirm-edit-quest": this._guardGm(() => {
        const draft = this._editDrafts[questId];
        if (!draft) { this.editingQuestId = null; this.render(false); return; }
        const title = draft.title.trim();
        if (!title) return;
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        const quest = data.tabs[loc.tabKey].quests[loc.idx];
        quest.title = title;
        quest.category = draft.category || "Uncategorised";
        quest.summary = draft.summary.trim() || "No summary yet.";
        // Moving sections: pull the quest out of its old tab and into the
        // new one, same as if it had been logged there originally.
        if (draft.tab && draft.tab !== loc.tabKey && data.tabs[draft.tab]) {
          data.tabs[loc.tabKey].quests.splice(loc.idx, 1);
          data.tabs[draft.tab].quests.push(quest);
          this.activeTab = draft.tab;
        }
        delete this._editDrafts[questId];
        this.editingQuestId = null;
        saveQuestData(data);
      }); break;

      case "add-update": this._guardGm(() => {
        const text = (this._updateDrafts[questId] || "").trim();
        if (!text) return;
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        const quest = data.tabs[loc.tabKey].quests[loc.idx];
        const today = currentDateLabel(data);
        quest.updates.push({ id: `n${data.nextNoteId++}`, text, dateWritten: today, revealed: false, dateRevealed: null });
        this._updateDrafts[questId] = "";
        saveQuestData(data);
      }); break;
      case "toggle-reveal": this._guardGm(() => {
        const noteId = el.dataset.noteId;
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        const quest = data.tabs[loc.tabKey].quests[loc.idx];
        const today = currentDateLabel(data);
        let justRevealed = false;
        quest.updates = quest.updates.map((n) => {
          if (n.id !== noteId) return n;
          const revealed = !n.revealed;
          justRevealed = revealed;
          return { ...n, revealed, dateRevealed: revealed ? today : n.dateRevealed };
        });
        saveQuestData(data);
        // The party should be told when an update is actually revealed to
        // them, not when the GM first writes it (or if they un-reveal it).
        if (justRevealed) {
          ChatMessage.create({ content: `<p><strong>${quest.title}</strong> was updated.</p>` });
        }
      }); break;
      case "delete-update": this._guardGm(() => {
        const noteId = el.dataset.noteId;
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        const quest = data.tabs[loc.tabKey].quests[loc.idx];
        quest.updates = quest.updates.filter((n) => n.id !== noteId);
        saveQuestData(data);
      }); break;

      case "add-player-note": {
        const text = (this._noteDrafts[questId] || "").trim();
        if (!text) return;
        requestAddPlayerNote(questId, text);
        this._noteDrafts[questId] = "";
        this.render(false);
        break;
      }
      case "delete-player-note": this._guardGm(() => {
        const noteId = el.dataset.noteId;
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        const quest = data.tabs[loc.tabKey].quests[loc.idx];
        quest.playerNotes = quest.playerNotes.filter((n) => n.id !== noteId);
        saveQuestData(data);
      }); break;

      case "open-set-date": this._guardGm(() => {
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        const quest = data.tabs[loc.tabKey].quests[loc.idx];
        const { dateObj: activeDateObj } = effectiveCalendar(data);
        const base = quest.linkedDate || activeDateObj;
        this.questDatePicker = { questId, year: base.year, monthIndex: base.monthIndex, day: base.day };
        this.render(false);
      }); break;
      case "clear-linked-date": this._guardGm(() => {
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        data.tabs[loc.tabKey].quests[loc.idx].linkedDate = null;
        saveQuestData(data);
      }); break;
      case "quest-date-cancel": this.questDatePicker = { questId: null, year: 0, monthIndex: 0, day: 1 }; this.render(false); break;
      case "quest-date-confirm": this._guardGm(() => {
        const dp = this.questDatePicker;
        if (!dp.questId) return;
        const data = loadQuestData();
        const loc = findQuestLocation(data, dp.questId);
        this.questDatePicker = { questId: null, year: 0, monthIndex: 0, day: 1 };
        if (!loc) return;
        data.tabs[loc.tabKey].quests[loc.idx].linkedDate = { year: dp.year, monthIndex: dp.monthIndex, day: dp.day };
        saveQuestData(data);
      }); break;

      case "segment-inc": this._guardGm(() => this._changeSegmentAllocated(questId, 1)); break;
      case "segment-dec": this._guardGm(() => this._changeSegmentAllocated(questId, -1)); break;
      case "segment-tick": this._guardGm(() => this._forceTick(questId)); break;
      case "segment-reset": this._guardGm(() => {
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        data.tabs[loc.tabKey].quests[loc.idx].segment.ticked = 0;
        saveQuestData(data);
      }); break;

      /* ---- Influence tab ---- */
      case "influence-toggle-region-menu": this.showInfluenceRegionMenu = !this.showInfluenceRegionMenu; this.render(false); break;
      case "influence-select-region": {
        this.influenceActiveRegionId = el.dataset.id;
        this.influenceSelected = null;
        this.showInfluenceRegionMenu = false;
        this.render(false);
        break;
      }
      case "influence-add-region": this._guardGm(() => {
        const data = loadInfluenceData();
        const region = { id: influenceUid("reg"), name: `Region ${data.regions.length + 1}`, background: "void", bgScale: 100, locations: [], npcs: [], relationships: [], npcRelationships: [] };
        data.regions.push(region);
        data.activeRegionId = region.id;
        this.influenceActiveRegionId = region.id;
        saveInfluenceData(data);
      }); break;
      case "influence-start-edit-region": {
        const data = loadInfluenceData();
        const region = findInfluenceRegion(data, el.dataset.id);
        this.influenceEditingRegionId = el.dataset.id;
        this.influenceRegionNameDraft = region?.name || "";
        this.render(false);
        break;
      }
      case "influence-cancel-edit-region": this.influenceEditingRegionId = null; this.render(false); break;
      case "influence-confirm-rename-region": this._guardGm(() => {
        const name = this.influenceRegionNameDraft.trim();
        const id = this.influenceEditingRegionId;
        this.influenceEditingRegionId = null;
        if (!name || !id) { this.render(false); return; }
        const data = loadInfluenceData();
        const region = findInfluenceRegion(data, id);
        if (region) region.name = name;
        saveInfluenceData(data);
      }); break;
      case "influence-delete-region": this._guardGm(() => {
        const data = loadInfluenceData();
        if (data.regions.length <= 1) return;
        const id = el.dataset.id;
        data.regions = data.regions.filter((r) => r.id !== id);
        if (data.activeRegionId === id) data.activeRegionId = data.regions[0].id;
        if (this.influenceActiveRegionId === id) this.influenceActiveRegionId = data.activeRegionId;
        saveInfluenceData(data);
      }); break;

      case "influence-toggle-bg-menu": this.showInfluenceBgMenu = !this.showInfluenceBgMenu; this.render(false); break;
      case "influence-set-region-bg": this._guardGm(() => {
        const data = loadInfluenceData();
        const region = findInfluenceRegion(data, this.influenceActiveRegionId);
        if (!region) return;
        region.background = el.dataset.bg;
        region.bgScale = 100;
        saveInfluenceData(data);
      }); break;

      case "influence-add-location": this._guardGm(() => {
        const data = loadInfluenceData();
        const region = findInfluenceRegion(data, this.influenceActiveRegionId);
        if (!region) return;
        const n = region.locations.length;
        const loc = {
          id: influenceUid("loc"),
          name: "New Location",
          x: 200 + (n % 5) * 220,
          y: 180 + Math.floor(n / 5) * 220,
          color: INFLUENCE_SWATCHES[n % INFLUENCE_SWATCHES.length],
          image: null,
          notes: "",
          expanded: true,
        };
        region.locations.push(loc);
        this.influenceSelected = { kind: "location", id: loc.id };
        saveInfluenceData(data);
      }); break;
      case "influence-toggle-expand": this._guardGm(() => {
        const data = loadInfluenceData();
        const region = findInfluenceRegion(data, this.influenceActiveRegionId);
        if (!region) return;
        const loc = findInfluenceLocation(region, el.dataset.id);
        if (!loc) return;
        loc.expanded = !(loc.expanded !== false);
        saveInfluenceData(data);
      }); break;
      case "influence-add-npc": this._guardGm(() => {
        const data = loadInfluenceData();
        const region = findInfluenceRegion(data, this.influenceActiveRegionId);
        if (!region) return;
        const parent = (this.influenceSelected?.kind === "location" && findInfluenceLocation(region, this.influenceSelected.id)) || region.locations[0];
        if (!parent) return;
        const siblingCount = npcsForInfluenceLocation(region, parent.id).length;
        const npc = {
          id: influenceUid("npc"),
          name: "New NPC",
          color: INFLUENCE_SWATCHES[siblingCount % INFLUENCE_SWATCHES.length],
          image: null,
          standing: 0, favour: 0, relationship: 0,
          notes: "",
          locId: parent.id,
          x: parent.x + 70 + siblingCount * 60,
          y: parent.y + 90,
          showStats: { standing: true, favour: true, relationship: true },
        };
        region.npcs.push(npc);
        this.influenceSelected = { kind: "npc", id: npc.id };
        saveInfluenceData(data);
      }); break;
      case "influence-add-npc-standalone": this._guardGm(() => {
        const data = loadInfluenceData();
        const region = findInfluenceRegion(data, this.influenceActiveRegionId);
        if (!region) return;
        const npc = {
          id: influenceUid("npc"),
          name: "New NPC",
          color: INFLUENCE_SWATCHES[region.npcs.length % INFLUENCE_SWATCHES.length],
          image: null,
          standing: 0, favour: 0, relationship: 0,
          notes: "",
          locId: null,
          x: INFLUENCE_BOARD_W / 2,
          y: 100,
          showStats: { standing: true, favour: true, relationship: true },
        };
        region.npcs.push(npc);
        this.influenceSelected = { kind: "npc", id: npc.id };
        saveInfluenceData(data);
      }); break;

      case "influence-select-node": {
        this.influenceSelected = { kind: el.dataset.kind, id: el.dataset.id };
        // Clicking a node while in link mode records it as the link
        // endpoint instead of just selecting it for the inspector.
        if (this.influenceLinking && el.dataset.kind === "location") {
          this._guardGm(() => this._handleInfluenceLinkClick(el.dataset.id));
          break;
        }
        if (this.influenceLinkingNpc && el.dataset.kind === "npc") {
          this._guardGm(() => this._handleInfluenceNpcLinkClick(el.dataset.id));
          break;
        }
        this.render(false);
        break;
      }
      case "influence-close-inspector": this.influenceSelected = null; this.render(false); break;

      case "influence-delete-node": this._guardGm(() => {
        const kind = el.dataset.kind;
        const id = el.dataset.id;
        const data = loadInfluenceData();
        const region = findInfluenceRegion(data, this.influenceActiveRegionId);
        if (!region) return;
        if (kind === "location") {
          region.locations = region.locations.filter((l) => l.id !== id);
          region.npcs = region.npcs.filter((n) => n.locId !== id);
          region.relationships = region.relationships.filter((r) => r.a !== id && r.b !== id);
        } else if (kind === "npc") {
          region.npcs = region.npcs.filter((n) => n.id !== id);
          region.npcRelationships = region.npcRelationships.filter((r) => r.a !== id && r.b !== id);
        }
        if (this.influenceSelected?.id === id) this.influenceSelected = null;
        saveInfluenceData(data);
      }); break;

      case "influence-delete-relationship": this._guardGm(() => {
        const relKind = el.dataset.kind; // "location" or "npc" — which array this relationship lives in
        const id = el.dataset.id;
        const data = loadInfluenceData();
        const region = findInfluenceRegion(data, this.influenceActiveRegionId);
        if (!region) return;
        if (relKind === "location") region.relationships = region.relationships.filter((r) => r.id !== id);
        else region.npcRelationships = region.npcRelationships.filter((r) => r.id !== id);
        if (this.influenceSelected?.id === id) this.influenceSelected = null;
        saveInfluenceData(data);
      }); break;

      case "influence-toggle-link-mode": this._guardGm(() => {
        this.influenceLinkingNpc = null;
        this.influenceLinking = this.influenceLinking ? null : { fromId: null };
        this.render(false);
      }); break;
      case "influence-toggle-link-npc-mode": this._guardGm(() => {
        this.influenceLinking = null;
        this.influenceLinkingNpc = this.influenceLinkingNpc ? null : { fromId: null };
        this.render(false);
      }); break;

      case "influence-set-rel-type": this._guardGm(() => {
        const data = loadInfluenceData();
        const region = findInfluenceRegion(data, this.influenceActiveRegionId);
        if (!region) return;
        const rel = el.dataset.kind === "location" ? findInfluenceRel(region, el.dataset.id) : findInfluenceNpcRel(region, el.dataset.id);
        if (!rel) return;
        rel.type = el.dataset.type;
        saveInfluenceData(data);
      }); break;

      case "influence-set-node-color": this._guardGm(() => {
        const data = loadInfluenceData();
        const region = findInfluenceRegion(data, this.influenceActiveRegionId);
        if (!region) return;
        const node = el.dataset.kind === "location" ? findInfluenceLocation(region, el.dataset.id) : findInfluenceNpc(region, el.dataset.id);
        if (!node) return;
        node.color = el.dataset.color;
        saveInfluenceData(data);
      }); break;

      case "influence-npc-stat-inc": this._guardGm(() => this._changeInfluenceNpcStat(el.dataset.id, el.dataset.stat, 1)); break;
      case "influence-npc-stat-dec": this._guardGm(() => this._changeInfluenceNpcStat(el.dataset.id, el.dataset.stat, -1)); break;

      case "influence-zoom-in": this._changeInfluenceZoom(0.1); break;
      case "influence-zoom-out": this._changeInfluenceZoom(-0.1); break;
      case "influence-zoom-reset": this._setInfluenceView({ pan: { x: 40, y: 20 }, zoom: 0.6 }); break;

      case "influence-set-theme": {
        const theme = el.dataset.theme;
        saveInfluenceTheme(theme).then(() => this.render(false));
        break;
      }

      case "influence-show-players": this._guardGm(() => {
        const kind = el.dataset.kind;
        const id = el.dataset.id;
        const data = loadInfluenceData();
        const region = findInfluenceRegion(data, this.influenceActiveRegionId);
        if (!region) return;
        const node = kind === "location" ? findInfluenceLocation(region, id) : findInfluenceNpc(region, id);
        if (!node) return;
        requestSpotlightInfluence(region.id, { kind, id });
        ChatMessage.create({ content: `<p><strong>${game.i18n?.localize("QUESTLOG.Title") ?? "Shrimps Quest Log"}</strong> — ${game.user.name} is showing everyone <em>${node.name}</em> on the Influence board.</p>` });
      }); break;

      case "add-month": this._guardGm(() => {
        const data = loadQuestData();
        data.calendar.months.push({ name: "New Month", days: 30 });
        saveQuestData(data);
      }); break;
      case "delete-month": this._guardGm(() => {
        const idx = Number(el.dataset.idx);
        const data = loadQuestData();
        if (data.calendar.months.length <= 1) return;
        data.calendar.months.splice(idx, 1);
        data.currentDateObj = clampDateToCalendar(data.calendar, data.currentDateObj);
        saveQuestData(data);
      }); break;

      default: break;
    }
  }

  _onChange(ev) {
    const el = ev.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const questId = el.closest("[data-quest-id]")?.dataset.questId ?? el.dataset.questId;

    switch (action) {
      case "draft-title-change": this.draft.title = el.value; break;
      case "draft-tab-change": {
        const data = loadQuestData();
        this.draft.tab = el.value;
        this.draft.category = (data.tabs[el.value]?.categories || [])[0] || "";
        this.render(false);
        return;
      }
      case "draft-category-change": this.draft.category = el.value; break;
      case "draft-summary-change": this.draft.summary = el.value; break;

      case "edit-title-change": { if (this._editDrafts[questId]) this._editDrafts[questId].title = el.value; return; }
      case "edit-tab-change": {
        const data = loadQuestData();
        const draft = this._editDrafts[questId];
        if (!draft) return;
        draft.tab = el.value;
        draft.category = (data.tabs[el.value]?.categories || [])[0] || "";
        this.render(false);
        return;
      }
      case "edit-category-change": { if (this._editDrafts[questId]) this._editDrafts[questId].category = el.value; return; }
      case "edit-summary-change": { if (this._editDrafts[questId]) this._editDrafts[questId].summary = el.value; return; }

      case "cat-draft-change": this.catDraft = el.value; break;
      case "new-tab-draft-change": this.newTabDraft = el.value; break;
      case "tab-name-draft-change": this.tabNameDraft = el.value; break;

      case "update-draft-change": this._updateDrafts[questId] = el.value; return;
      case "note-draft-change": this._noteDrafts[questId] = el.value; return;

      case "calendar-event-draft-change": this.calendarEventDraft = el.value; break;

      case "status-change": this._guardGm(() => {
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        data.tabs[loc.tabKey].quests[loc.idx].status = el.value;
        saveQuestData(data);
      }); return;

      case "toggle-segment-enabled": this._guardGm(() => {
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        data.tabs[loc.tabKey].quests[loc.idx].segment.enabled = el.checked;
        saveQuestData(data);
      }); return;
      case "segment-bar-change": this._guardGm(() => {
        const data = loadQuestData();
        const loc = findQuestLocation(data, questId);
        if (!loc) return;
        data.tabs[loc.tabKey].quests[loc.idx].segment.bar = el.value;
        saveQuestData(data);
      }); return;

      case "quest-date-year-change": this.questDatePicker.year = parseInt(el.value, 10) || 0; return;
      case "quest-date-month-change": {
        const data = loadQuestData();
        const { calendar: activeCalendar } = effectiveCalendar(data);
        const monthIndex = parseInt(el.value, 10) || 0;
        const maxDay = activeCalendar.months[monthIndex]?.days || 30;
        this.questDatePicker.monthIndex = monthIndex;
        this.questDatePicker.day = Math.min(this.questDatePicker.day, maxDay);
        this.render(false);
        return;
      }
      case "quest-date-day-change": this.questDatePicker.day = parseInt(el.value, 10) || 1; return;

      case "toggle-show-calendar-section": this._guardGm(() => {
        const data = loadQuestData();
        data.showCalendarSection = el.checked;
        saveQuestData(data);
      }); return;
      case "toggle-show-segment-section": this._guardGm(() => {
        const data = loadQuestData();
        data.showSegmentSection = el.checked;
        saveQuestData(data);
      }); return;
      case "toggle-use-simple-calendar": this._guardGm(() => {
        const data = loadQuestData();
        data.useSimpleCalendar = el.checked;
        saveQuestData(data);
      }); return;
      case "year-label-change": this._guardGm(() => {
        const data = loadQuestData();
        data.calendar.yearLabel = el.value;
        saveQuestData(data);
      }); return;
      case "month-name-change": this._guardGm(() => {
        const idx = Number(el.dataset.idx);
        const data = loadQuestData();
        data.calendar.months[idx].name = el.value;
        saveQuestData(data);
      }); return;
      case "influence-region-name-draft-change": this.influenceRegionNameDraft = el.value; return;

      case "influence-node-name-change": this._guardGm(() => {
        const infData = loadInfluenceData();
        const region = findInfluenceRegion(infData, this.influenceActiveRegionId);
        const node = region && (el.dataset.kind === "location" ? findInfluenceLocation(region, el.dataset.id) : findInfluenceNpc(region, el.dataset.id));
        if (!node) return;
        node.name = el.value;
        saveInfluenceData(infData);
      }); return;
      case "influence-node-notes-change": this._guardGm(() => {
        const infData = loadInfluenceData();
        const region = findInfluenceRegion(infData, this.influenceActiveRegionId);
        const node = region && (el.dataset.kind === "location" ? findInfluenceLocation(region, el.dataset.id) : findInfluenceNpc(region, el.dataset.id));
        if (!node) return;
        node.notes = el.value;
        saveInfluenceData(infData);
      }); return;
      case "influence-rel-label-change": this._guardGm(() => {
        const infData = loadInfluenceData();
        const region = findInfluenceRegion(infData, this.influenceActiveRegionId);
        if (!region) return;
        const rel = el.dataset.kind === "location" ? findInfluenceRel(region, el.dataset.id) : findInfluenceNpcRel(region, el.dataset.id);
        if (!rel) return;
        rel.label = el.value;
        saveInfluenceData(infData);
      }); return;
      case "influence-bg-fit-change": this._guardGm(() => {
        const infData = loadInfluenceData();
        const region = findInfluenceRegion(infData, this.influenceActiveRegionId);
        if (!region) return;
        region.bgScale = Number(el.value) || 100;
        saveInfluenceData(infData);
      }); return;
      case "influence-toggle-npc-stat": this._guardGm(() => {
        const infData = loadInfluenceData();
        const region = findInfluenceRegion(infData, this.influenceActiveRegionId);
        const npc = region && findInfluenceNpc(region, el.dataset.id);
        if (!npc) return;
        npc.showStats = npc.showStats || { standing: true, favour: true, relationship: true };
        npc.showStats[el.dataset.stat] = el.checked;
        saveInfluenceData(infData);
      }); return;
      case "influence-region-bg-upload": this._guardGm(() => this._handleInfluenceImageUpload(el, (dataUrl) => {
        const infData = loadInfluenceData();
        const region = findInfluenceRegion(infData, this.influenceActiveRegionId);
        if (!region) return null;
        region.background = dataUrl;
        region.bgScale = 100;
        return infData;
      })); return;
      case "influence-node-image-upload": this._guardGm(() => this._handleInfluenceImageUpload(el, (dataUrl) => {
        const infData = loadInfluenceData();
        const region = findInfluenceRegion(infData, this.influenceActiveRegionId);
        const node = region && (el.dataset.kind === "location" ? findInfluenceLocation(region, el.dataset.id) : findInfluenceNpc(region, el.dataset.id));
        if (!node) return null;
        node.image = dataUrl;
        return infData;
      })); return;

      case "month-days-change": this._guardGm(() => {
        const idx = Number(el.dataset.idx);
        const days = Math.max(1, parseInt(el.value, 10) || 1);
        const data = loadQuestData();
        data.calendar.months[idx].days = days;
        data.currentDateObj = clampDateToCalendar(data.calendar, data.currentDateObj);
        saveQuestData(data);
      }); return;

      default: break;
    }

    this.render(false);
  }

  _guardGm(fn) {
    if (!game.user.isGM) return;
    fn();
  }

  /* ---------------- Influence tab actions ---------------- */

  _handleInfluenceLinkClick(id) {
    if (!this.influenceLinking.fromId) {
      this.influenceLinking.fromId = id;
      this.render(false);
      return;
    }
    if (this.influenceLinking.fromId === id) return;
    const data = loadInfluenceData();
    const region = findInfluenceRegion(data, this.influenceActiveRegionId);
    if (region) {
      region.relationships.push({ id: influenceUid("rel"), a: this.influenceLinking.fromId, b: id, type: "neutral", label: "" });
    }
    this.influenceLinking = null;
    saveInfluenceData(data);
  }

  _handleInfluenceNpcLinkClick(id) {
    if (!this.influenceLinkingNpc.fromId) {
      this.influenceLinkingNpc.fromId = id;
      this.render(false);
      return;
    }
    if (this.influenceLinkingNpc.fromId === id) return;
    const data = loadInfluenceData();
    const region = findInfluenceRegion(data, this.influenceActiveRegionId);
    if (region) {
      region.npcRelationships.push({ id: influenceUid("nrel"), a: this.influenceLinkingNpc.fromId, b: id, type: "neutral", label: "" });
    }
    this.influenceLinkingNpc = null;
    saveInfluenceData(data);
  }

  _changeInfluenceNpcStat(npcId, stat, delta) {
    if (!["standing", "favour", "relationship"].includes(stat)) return;
    const data = loadInfluenceData();
    const region = findInfluenceRegion(data, this.influenceActiveRegionId);
    const npc = region && findInfluenceNpc(region, npcId);
    if (!npc) return;
    npc[stat] = Math.max(-10, Math.min(10, (npc[stat] || 0) + delta));
    saveInfluenceData(data);
  }

  _changeInfluenceZoom(delta) {
    const data = loadInfluenceData();
    const region = findInfluenceRegion(data, this.influenceActiveRegionId);
    if (!region) return;
    const prefs = loadInfluenceView();
    const current = prefs[region.id] || { pan: { x: 40, y: 20 }, zoom: 0.6 };
    const zoom = Math.max(0.2, Math.min(2, Math.round((current.zoom + delta) * 100) / 100));
    this._setInfluenceView({ pan: current.pan, zoom });
  }

  // Reads the file the GM just picked (a region background or a location/
  // NPC portrait) as a data URL and hands it to `applyFn`, which mutates a
  // freshly loaded copy of influenceData and returns it to be saved (or
  // returns null/undefined to abort, e.g. if the target node has since
  // been deleted). Kept as a data URL (rather than uploaded to the
  // server's Data folder) so this stays a single self-contained world
  // setting, same as the rest of Quest Log's data.
  _handleInfluenceImageUpload(inputEl, applyFn) {
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const updated = applyFn(dataUrl);
      if (updated) saveInfluenceData(updated);
    };
    reader.readAsDataURL(file);
  }

  _setInfluenceView(view) {
    const data = loadInfluenceData();
    const region = findInfluenceRegion(data, this.influenceActiveRegionId);
    if (!region) return;
    const prefs = loadInfluenceView();
    prefs[region.id] = view;
    saveInfluenceView(prefs).then(() => this.render(false));
  }

  _advanceDate(delta) {
    const data = loadQuestData();
    data.currentDateObj = addDays(data.calendar, data.currentDateObj, delta);
    saveQuestData(data);
  }

  _changeSegmentAllocated(questId, delta) {
    const data = loadQuestData();
    const loc = findQuestLocation(data, questId);
    if (!loc) return;
    const seg = data.tabs[loc.tabKey].quests[loc.idx].segment;
    seg.allocated = Math.min(20, Math.max(1, seg.allocated + delta));
    seg.ticked = Math.min(seg.ticked, seg.allocated);
    saveQuestData(data);
  }

  _setDayNightFilled(bar, filled) {
    const data = loadQuestData();
    const state = bar === "day" ? data.segmentDay : data.segmentNight;
    state.filled = Math.max(0, Math.min(state.total, filled));
    data.segmentBarPrevFilled[bar] = state.filled;
    saveQuestData(data);
    trySyncSegmentedCycleFilled(bar, state.filled);
  }

  _changeDayNightTotal(bar, delta) {
    const data = loadQuestData();
    const state = bar === "day" ? data.segmentDay : data.segmentNight;
    state.total = Math.max(1, Math.min(24, state.total + delta));
    state.filled = Math.min(state.filled, state.total);
    saveQuestData(data);
  }

  // One manual segment of time, for the GM's own quest-linked "Force tick"
  // button. Ticks the quest's own progress by one and nudges the matching
  // shared Day/Night bar forward by one, rolling into the other bar if the
  // linked one is already full — same behaviour validated in the mockup.
  _forceTick(questId) {
    const data = loadQuestData();
    const loc = findQuestLocation(data, questId);
    if (!loc) return;
    const seg = data.tabs[loc.tabKey].quests[loc.idx].segment;
    if (seg.ticked >= seg.allocated) return;
    seg.ticked += 1;

    if (seg.bar === "day" || seg.bar === "night") {
      const primary = seg.bar === "day" ? data.segmentDay : data.segmentNight;
      const secondary = seg.bar === "day" ? data.segmentNight : data.segmentDay;
      const secondaryBar = seg.bar === "day" ? "night" : "day";
      if (primary.filled < primary.total) {
        primary.filled += 1;
        data.segmentBarPrevFilled[seg.bar] = primary.filled;
        trySyncSegmentedCycleFilled(seg.bar, primary.filled);
      } else if (secondary.filled < secondary.total) {
        secondary.filled += 1;
        data.segmentBarPrevFilled[secondaryBar] = secondary.filled;
        trySyncSegmentedCycleFilled(secondaryBar, secondary.filled);
      }
    }

    saveQuestData(data);
  }

  /* ---------------- docked satellite windows ---------------- */

  // Keeps the Calendar/Segment widgets pinned to the right edge of this
  // window, stacked one above the other when both are open. Called after
  // opening a widget and whenever this window's own position changes.
  _positionDockWidgets() {
    const gap = 10;
    const left = this.position.left + this.position.width + gap;
    let top = this.position.top;
    for (const widget of [this.segmentWidget, this.calendarWidget]) {
      if (!widget?.rendered) continue;
      widget.setPosition({ left, top });
      top += (widget.position.height || 0) + gap;
    }
  }

  setPosition(pos) {
    const result = super.setPosition(pos);
    this._positionDockWidgets();
    return result;
  }

  async _openSegmentWidget() {
    if (!this.segmentWidget) this.segmentWidget = new SegmentDockWidget(this);
    if (!this.segmentWidget.rendered) await this.segmentWidget.render(true);
    this._positionDockWidgets();
  }

  _closeSegmentWidget() {
    if (this.segmentWidget?.rendered) this.segmentWidget.close();
  }

  async _openCalendarWidget() {
    if (!this.calendarWidget) this.calendarWidget = new CalendarDockWidget(this);
    if (!this.calendarWidget.rendered) await this.calendarWidget.render(true);
    this._positionDockWidgets();
  }

  _closeCalendarWidget() {
    if (this.calendarWidget?.rendered) this.calendarWidget.close();
  }

  async close(options) {
    if (this.segmentWidget?.rendered) await this.segmentWidget.close();
    if (this.calendarWidget?.rendered) await this.calendarWidget.close();
    return super.close(options);
  }
}

/* =========================================================================
   Small satellite windows for the Calendar and Segmented Cycle panels.
   Quest Log opens/closes these itself and keeps them docked to the right
   edge of the main window (see _positionDockWidgets above) whenever it
   moves or resizes, so they read as part of the Quest Log window rather
   than a separate app the person has to manage themselves. Both reuse the
   main app's own getData()/click/change handling rather than duplicating
   it, so every action inside them behaves exactly as it does in the main
   window.
   ========================================================================= */

class QuestLogDockWidget extends Application {
  constructor(parentApp, options) {
    super(options);
    this.parentApp = parentApp;
  }

  getData() {
    return this.parentApp.getData();
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0];
    // Route the action to the main app's own handling (so every action
    // behaves identically whether it's triggered from here or from the
    // main window), then also re-render this widget itself. A lot of what
    // these widgets show (month nav, selected day, drafts) lives only on
    // the main app's instance and is never written to the world setting,
    // so nothing else would ever tell this widget to redraw.
    root.addEventListener("click", (ev) => { this.parentApp._onClick(ev); if (this.rendered) this.render(false); });
    root.addEventListener("change", (ev) => { this.parentApp._onChange(ev); if (this.rendered) this.render(false); });
  }

  async close(options) {
    this._onDockClose();
    return super.close(options);
  }

  _onDockClose() {}
}

class SegmentDockWidget extends QuestLogDockWidget {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "shrimps-quest-influence-tracker-segment-widget",
      title: "Segmented Cycle",
      template: `modules/${MODULE_ID}/templates/segment-widget.hbs`,
      width: 260,
      height: "auto",
      resizable: false,
      classes: ["quest-log-app", "quest-log-dock-widget"],
    });
  }

  _onDockClose() {
    this.parentApp.segmentPanelOpen = false;
    this.parentApp.segmentWidget = null;
    if (this.parentApp.rendered) this.parentApp.render(false);
  }
}

class CalendarDockWidget extends QuestLogDockWidget {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "shrimps-quest-influence-tracker-calendar-widget",
      title: "Calendar",
      template: `modules/${MODULE_ID}/templates/calendar-widget.hbs`,
      width: 300,
      height: "auto",
      resizable: false,
      classes: ["quest-log-app", "quest-log-dock-widget"],
    });
  }

  _onDockClose() {
    this.parentApp.calendarPanelOpen = false;
    this.parentApp.calendarWidget = null;
    if (this.parentApp.rendered) this.parentApp.render(false);
  }
}

/* =========================================================================
   Scene Controls toolbar button (the "Q" tool, GM only), settings, hooks.
   ========================================================================= */

let app = null;

function toggleApp() {
  if (!app) app = new QuestLogApp();
  if (app.rendered) app.close();
  else app.render(true);
}

function addSceneControlButton(controls) {
  if (Array.isArray(controls)) {
    const tool = {
      name: "shrimpsQuestLog",
      title: "Shrimp's Quest and Influence Tracker",
      icon: "fas fa-scroll",
      button: true,
      onClick: toggleApp,
    };
    const notes = controls.find((c) => c.name === "notes") ?? controls.find((c) => c.name === "token");
    if (notes && !notes.tools.some((t) => t.name === tool.name)) notes.tools.push(tool);
    return;
  }

  const tool = {
    name: "shrimpsQuestLog",
    title: "Shrimp's Quest and Influence Tracker",
    icon: "fas fa-scroll",
    button: true,
    onChange: toggleApp,
  };
  const notes = controls.notes ?? controls.token;
  if (notes && notes.tools && !notes.tools[tool.name]) notes.tools[tool.name] = tool;
}

Hooks.once("init", () => {
  registerSettings();
  registerInfluenceSettings();
  // Foundry's legacy Handlebars partial loader (still available, though
  // deprecated, on v13) — registers influence-tab.hbs under the partial
  // name quest-log.hbs's {{> influence-tab}} expects.
  const loader = foundry.applications?.handlebars?.loadTemplates ?? loadTemplates;
  loader({ "influence-tab": `modules/${MODULE_ID}/templates/influence-tab.hbs` });
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET_NAME, onSocketMessage);
});

Hooks.on("questLog.toggle", () => toggleApp());

Hooks.on("getSceneControlButtons", (controls) => {
  addSceneControlButton(controls);
});

Hooks.on("updateSetting", (setting) => {
  const key = setting.key ?? "";

  if (key === `${MODULE_ID}.data`) {
    if (app?.rendered) app.render(false);
    // The docked Calendar/Segment windows don't automatically pick up a
    // change made anywhere else (e.g. force-ticking a segment from the
    // main window, or a player's action arriving over the socket) unless
    // told to redraw explicitly.
    if (app?.segmentWidget?.rendered) app.segmentWidget.render(false);
    if (app?.calendarWidget?.rendered) app.calendarWidget.render(false);
    return;
  }

  // Influence data is world-scoped GM-authored shared state (see
  // saveInfluenceData); re-render for every client the same way the quest
  // data setting above does, so a location drag/edit lands live for
  // everyone, not just the GM who made it.
  if (key === `${MODULE_ID}.influenceData`) {
    if (app?.rendered) app.render(false);
    return;
  }

  if (key.startsWith(`${SC_MODULE_ID}.`)) {
    const settingName = key.split(".")[1];
    const bar = settingName?.endsWith("Filled") ? settingName.replace("Filled", "") : null;
    if (!bar || !SEGMENT_BARS.includes(bar)) return;
    // Ignore the echo of our own write-back (see trySyncSegmentedCycleFilled):
    // without this, Quest Log's own change bounces back through Segmented
    // Cycle's setting and re-applies itself a second time, which is what
    // was pushing a bar's filled count past its total instead of rolling
    // over into the other bar.
    if (_scEchoGuard[bar]) {
      _scEchoGuard[bar] = false;
      return;
    }
    applySegmentTick(bar, setting.value);
  }
});
