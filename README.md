# Shrimp's Quest and Influence Tracker

An interactive quest log — GM and player views, tabs and categories, dated updates, party notes, an optional Segmented Cycle tie-in, and its own internal calendar — plus an **Influence tab**: a draggable web of Regions, Locations, and NPCs/Factions with Standing/Favour/Relationship stats, colour-coded relationship lines, seven visual themes, and a "Show Players" spotlight.

## Quest Log

- **Add and edit quests.** Each quest has a title, category, summary, and status (Active, Completed, Failed). Click a quest's summary row to expand it.
- **Tabs.** Quests are split across Main Quest, Side Quest, and Rumours by default. As GM you can rename any tab, delete one (as long as one remains), and add new ones with the "+ Tab" button. Completed and Failed quests are automatically pulled out of their tab and shown, with their title struck through in their status colour, on a fourth "Finished" tab that always exists and can't be deleted.
- **Categories.** Each tab has its own set of categories (city, faction, region, whatever fits), editable and deletable by the GM, used to filter that tab's quest list.
- **Quest Updates.** GM-authored notes that get added to a quest as more of it is revealed. Each one can be toggled between hidden and revealed; once revealed, players see it and it is stamped with the date it was revealed, not the date the GM wrote it. The GM can delete any update or party note.
- **Party Notes.** Anyone can add a note to a quest, and it is signed with their name and the in-game date. The GM can delete any note.
- **Spotlight / Show Players.** A GM can "show" a quest to the whole table — every connected player's Quest Log window pops open (or comes to front) already switched to that quest, alongside a chat message announcing it.
- **Segment Cycle Integration.** Optional, per quest, GM side, and only shown if the Segmented Cycle module is installed and active. Pick which bar (Day, Night, or the custom bar) a quest is tied to and how many segments it needs; as that bar fills up in Segmented Cycle, the quest's own counter ticks forward automatically. A "Force tick" button is there for a manual override.
- **Calendar Link.** Optional, per quest, GM side. Pin a quest to a date on the tracker's own calendar with "Set Date", so the party can see it coming from the calendar panel at a glance. "Change" and "Clear" undo or move it.
- **Internal calendar.** Fully self-contained: name your months, set how many days each one has, and set a year label. The in-game date at the top of the log, the persistent calendar panel, and every date stamped on a quest, update, or note all come from this. If Simple Calendar is installed and active, the tracker can instead show its date at the top of the log (toggle this in the settings cog); the calendar panel below always keeps browsing the tracker's own calendar regardless, since that is what carries the quest deadlines and notes.
- **Calendar panel.** A collapsible panel, top right of the log, showing the current month as a grid. Today is highlighted, and any date with a note or a quest linked to it gets a small dot. Click a date to see what's on it; as GM you can add or delete freeform notes there (upcoming events, deadlines).
- **Settings cog (Config).** Top of the log, GM only. This is also where the **visual theme** lives (see below) — toggle the calendar section and the Segment Cycle section on or off for the whole table, and build out the internal calendar's months from here.
- **Scene Controls button.** A "Shrimp's Quest and Influence Tracker" tool (scroll icon) sits in the canvas Scene Controls toolbar, in the same Notes group Simple Calendar and similar modules use. Click it to open or close the log.

## Influence tab

A separate tab on the same window for mapping out the politics and geography of a region: Locations, the NPCs/Factions tied to them, and the relationships between either.

- **Regions.** Each Region is its own board with its own background, locations, and NPCs. Switch between them or add a new one from the "Region: ..." dropdown at top left.
- **Locations.** "+ Add Location" drops a new location marker on the board. Each one can be renamed, recoloured, given an image, and holds any number of linked NPCs/Factions.
  - **Expand / collapse.** A small −/+ button on a location's token shows or hides its linked NPCs, which fan out automatically around it when expanded (a "N linked" count always shows, whether expanded or not).
- **NPCs / Factions.** "+ Add NPC / Faction" adds one to the currently-selected location (or the first location, if none is selected); "+ Add Unlinked NPC" drops one directly on the board with no location tie. Each has a name, colour, optional image, notes, and three tracked stats — **Standing**, **Favour**, and **Relationship** — steppable up/down and individually toggled on/off for display on its marker.
- **Relationships.** "+ Link Locations" / "+ Link NPCs" put the board into link mode — click two markers to connect them with a coloured line (Alliance/green, Neutral/blue, Hostile/red), which can carry its own label.
- **Background.** Pick one of the built-in presets, or upload your own image from Foundry's own file storage via the Background menu. A custom image gets a **Fit slider** (20–300%) to scale it to the board without cropping — a hover tooltip on the upload button recommends the board's native ratio for the sharpest result.
- **Pan / zoom.** Drag an empty part of the board to pan; the zoom controls (top right of the toolbar) zoom in, out, or reset the view. Each viewer's own pan/zoom is personal and isn't shared.
- **Show Players.** With a location or NPC selected, "Show Players" in its inspector panel spotlights it for the whole table — every connected player's window switches to that region with the same node selected, alongside a chat message announcing it.
- **Images.** Both region backgrounds and location/NPC portraits are picked through Foundry's own File Picker, so anything already in your world's asset storage (or an upload through it) is available — nothing is base64-encoded into the module's data.

## Visual themes

One shared set of seven themes — **Dark, Light, Parchment, Midnight, Bloodmoon, Verdant, Frost** — picked from the Config (settings cog) panel by the GM. It recolors the whole app shell: the ordinary Quest Log UI and the Influence tab both draw from the same palette, so there's a single, table-wide look rather than a separate per-tab setting.

## What is shared vs personal

Every quest, tab, category, update, note, calendar setting, calendar event, and all Influence data (regions, locations, NPCs, relationships) lives in world settings, shared with the whole table. Only a GM can write to them directly; when a player adds a party note, their client asks a connected GM's client to make the change on their behalf, which then syncs back out to everyone as normal. This means **a GM needs to be online for a player's note to be added** — it is not queued if no GM is connected.

Everything else (which tab you're looking at, which quest is expanded, draft text you're mid-typing, your own Influence board pan/zoom, the shared theme choice notwithstanding) is local to your own window and isn't shared or saved for anyone else.

## Optional: Simple Calendar

The tracker works fully without it. If Simple Calendar is installed and active, open the settings cog and turn on "Sync the displayed date with Simple Calendar" to have the top of the log show Simple Calendar's current date instead of the tracker's own, for logging and stamping purposes.

## Optional: Segmented Cycle

The tracker works fully without it, and the Segment Cycle Integration section on a quest is hidden entirely unless the Segmented Cycle module is installed and active. When it is, tie a quest to Day, Night, or the custom bar; every segment that bar fills in Segmented Cycle ticks that quest's counter forward by the same amount, up to whatever you allocated.
