# ThermalCore
<p align="center">
  <img src="./banner.png" alt="ThermalCore" width="100%">
</p>


[![Platform](https://img.shields.io/badge/Platform-Android%2014%2B%20%7C%20One%20UI-blue.svg)](https://www.samsung.com)
[![Device](https://img.shields.io/badge/Device-Galaxy%20Tab%20S10%20Ultra-00f0ff.svg)](https://www.samsung.com)
[![SoC](https://img.shields.io/badge/SoC-Dimensity%209300%2B-ff0055.svg)](https://www.mediatek.com)
[![Root](https://img.shields.io/badge/Root-KernelSU%20%7C%20APatch%20%7C%20Magisk-green.svg)](#installation)
[![License](https://img.shields.io/badge/License-GPL--3.0-orange.svg)](LICENSE)

A specialized performance management module custom-tailored for the **Samsung Galaxy Tab S10 Ultra (MediaTek Dimensity 9300+)**. 

ThermalCore (formerly *IFOKNR - Thermal Manager*) is based on [Ahmed Al-Nassif's Thermal Manager](https://github.com/ahmed-alnassif), re-engineered specifically to accommodate Samsung's One UI environment, MediaTek's **All-Big-Core** architecture, and high-refresh-rate gaming—while ensuring **zero conflicts** with secondary thermal-locking modules.

---

## ⚡ What Makes This Fork Different?

* **Zero-Conflict Hardware Handling:** Unlike standard thermal modules, this build explicitly excludes general `thermal_zone` tampering. It operates cleanly alongside secondary thermal modules without competing for kernel thermal locks.
* **Dimensity 9300+ Core Scheduling:** Frequency floor/cap is applied only to the high-frequency clusters (auto-detected by max frequency: the Cortex-X4 cores `cpu4-7`). The Cortex-A720 cluster (`cpu0-3`) stays under the stock scheduler.
* **MediaTek GED GPU Boost:** Directly interfaces with `/sys/module/ged/parameters` to force hardware acceleration during graphics-intensive loads.
* **Samsung GOS Bypass:** Automatically halts Samsung's Game Optimizing Service (`com.samsung.android.game.gos`) and Game Tools in high-performance profiles to prevent aggressive thermal throttling.
* **AMOLED WebUI:** Live status card with SoC temperature, Profiles / Games / Settings tabs, dropdown menus and collapsible sections, in English and Arabic.

---

## 🎯 Profile Breakdown

| Profile | CPU Cluster Policy | GPU Acceleration (GED) | Samsung GOS State | Recommended Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **⚖️ Balanced** | Default dynamic frequencies (`schedutil`) | Stock power curve | Enabled | Daily media, productivity, multi-window tasks |
| **🔋 Battery** | Max frequency capped at **1.4 GHz** (`powersave`) | Low-power mode | Enabled | Reading, long standby, extended battery preservation |
| **⚡ Performance** | Uncapped dynamic boost (`schedutil`) | Level 1 Acceleration | Disabled | Fast app compilation, heavy multitasking |
| **🎮 Gaming** | **1.8 GHz minimum floor** on Cortex-X4 cores (released automatically above the thermal limit) | Max GPU Boost (`gx_game_mode=1`) | Disabled | AAA gaming, emulator workloads, zero micro-stutter |

---

## 🌟 Key Features

* **Auto Game Mode:** When a game from your list is in the foreground, ThermalCore switches to its profile (Gaming by default, or a per-game choice of Gaming / Performance / Balanced) and returns to your profile when you leave. Installed games are detected from a bundled list of 500+ packages; add or remove any app in the *Games* tab.

* **Real-time WebUI:** Seamlessly switch performance modes from inside KernelSU, ReSukiSU, or APatch WebUI without rebooting.
* **Auto Battery Saver:** Background screen-off awareness via power hal checks; instantly transitions to energy-saving states when the screen locks, and restores the active profile upon unlocking.
* **Persistent Settings:** Automatically restores the selected profile upon system reboot.
* **Battery-friendly loop:** The screen state is queried (`dumpsys power`) only when *Auto Battery Saver* is enabled; otherwise the service just re-reads its mode file every 5 s.
* **Thermal Guard:** In Gaming and Performance the hottest CPU/SoC/GPU zone is read (read-only). At the limit (60–85 °C, default 75 °C, set in *Settings → Thermal guard*) the CPU floor and GPU boost are released and Samsung GOS is re-enabled; the profile resumes 7 °C below the limit. Android's own thermal protection is never disabled. If no matching zone is found, the guard is inactive and this is written to `service.log`.
* **Clean uninstall:** `uninstall.sh` re-enables GOS / Game Tools after the next boot. Tip: switch to Balanced before removing the module.

---

## 🛠️ Installation

1. Download the latest `ThermalCore-*.zip` from the [Releases](https://github.com/ifoknr/IFOKNR-THEMAL-MANAGER/releases) page.
2. Open your root manager (**KernelSU**, **ReSukiSU**, **APatch**, or **Magisk**).
3. Navigate to **Modules** → **Install from storage** and select the ZIP file.
4. Reboot your tablet once the installation completes.
5. Launch the interface from **KernelSU/ReSukiSU** → **Modules** → **ThermalCore**.

---

## 🤝 Credits & Acknowledgements

* **Original Developer:** [Ahmed Al-Nassif](https://github.com/ahmed-alnassif) for the initial foundation and WebUI concepts.
* **Game list:** [Licking Thermal](https://github.com/fuckyoustan/Licking-Thermal) by STAN (Apache-2.0, see `NOTICE`).
* **Development & Maintenance:** **[ifoknr](https://github.com/ifoknr)**.

---

## 📄 License
This project is licensed under the [GNU General Public License v3.0](LICENSE).


---

## 📝 Changelog
See [CHANGELOG.md](CHANGELOG.md).
