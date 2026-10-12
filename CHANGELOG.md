# Changelog

## v3.0.3
* New: battery temperature next to the CPU temperature in the WebUI status card and in the status notification (`🌡️ CPU 62°C / 75°C · 🔋 38°C`).

## v3.0.2
* Fixed: the temperature jumped up and down because the hottest core sensor spikes for a moment with every burst of load. The reading is now smoothed (~15 s), the thermal guard trips only after two smoothed readings at the limit, and the WebUI and notification show the same smoothed value.
* New: Settings → Service → Sensors lists every thermal zone with its current value (✓ = used by ThermalCore); the sensors used are also written to the log at boot.
* Changed: status notification temperature updates at most once a minute (3 °C moves), refresh every 10 min.

## v3.0.1
* Fixed: pulling down the notification shade (or another overlay) during a game switched back to the normal profile. Games are now detected from the resumed activities (also covers split screen), and the game profile is only left after ~10 s without the game.
* New: a status notification is on from install and always shows the active profile, the game and the SoC temperature (updated in place; can be turned off in Settings).
* Changed: the WebUI scales with the screen: larger text and controls on tablets, two-column games list and settings on wide screens.

## v3.0.0 — ThermalCore
* Renamed IFOKNR - Thermal Manager → **ThermalCore** (module id `thermalcore`).
* New: auto game mode. A game from the list in the foreground switches to its own profile (default Gaming, per-game override), and back when it closes.
* New: bundled game list (521 packages); installed games are detected at install time.
* New: thermal guard now covers Performance as well as Gaming; the limit is selectable (60–85 °C, default 75 °C) and also pauses the GPU boost.
* New: optional notifications.
* New WebUI: live status card with SoC temperature, Profiles / Games / Settings tabs, dropdown menus, collapsible sections, service log, English + Arabic (RTL).
* Settings moved to `/data/adb/thermalcore` so they survive module updates; v2.x settings are migrated.
* The old `thermal_mode_manager` module and the conflicting `LickingT` module are marked for removal on install.
* Removed unused files (template `update.json`, stray images, `md3.js`).
