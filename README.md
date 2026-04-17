# Thermal Manager

This module fixes the thermal mode/profile reset issue on Poco X6 Pro. Normally, the system reverts to default/balanced after switching modes. This module monitors and forces the user-selected mode to persist, providing faster and cleaner profile switching.

## Features
- ⚖️ Balanced
- 🔋 Battery Saver
- ⚡ Performance
- 🎮 Gaming
- 🌙 Auto Battery Saver when screen off (toggle in WebUI)
- WebUI for easy switching
- Persistent mode after reboot
- Background service monitoring

## How It Works
The module continuously monitors the thermal interface and reapplies your selected mode if the system tries to reset it. Switch modes instantly via WebUI without the profile reverting.

## Installation
1. Download the latest release
2. Install via KernelSU Manager
3. Reboot
4. Open WebUI from Modules → Thermal Manager
