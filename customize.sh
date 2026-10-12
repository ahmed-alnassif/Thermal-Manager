##########################################################################################
# ThermalCore installer (customize.sh, used by Magisk 20.4+/KernelSU/APatch)
# Module files are extracted automatically; this script prepares settings and perms.
##########################################################################################

CFG=/data/adb/thermalcore

ui_print "****************************************"
ui_print "              ThermalCore               "
ui_print "   Galaxy Tab S10 Ultra (Dimensity 9300) "
ui_print "             by @ifoknr                 "
ui_print "****************************************"

PLATFORM="$(getprop ro.board.platform)"
case "$PLATFORM" in
  mt6989*) ui_print "- Detected platform: $PLATFORM (Dimensity 9300/9300+)" ;;
  *)
    ui_print "! Warning: platform '$PLATFORM' is not mt6989."
    ui_print "! This module is made for the Galaxy Tab S10 Ultra; use at your own risk."
    ;;
esac

mkdir -p "$CFG"

# Carry settings over from IFOKNR - Thermal Manager (v2.x)
OLD=/data/adb/modules/thermal_mode_manager
for f in mode auto_battery temp_limit; do
  [ -f "$OLD/$f" ] && [ ! -f "$CFG/$f" ] && cp "$OLD/$f" "$CFG/$f"
done

# Both modules below drive the same CPU/GPU/thermal nodes and would fight
# with ThermalCore: mark them for removal on the next reboot.
for m in thermal_mode_manager LickingT; do
  if [ -d "/data/adb/modules/$m" ]; then
    touch "/data/adb/modules/$m/remove"
    ui_print "- '$m' conflicts with ThermalCore: it will be removed on reboot"
  fi
done

# Status notification is on from the first install (can be turned off later)
if [ ! -f "$CFG/.notify_init" ]; then
  echo 1 > "$CFG/notify"
  touch "$CFG/.notify_init"
fi

# Seed the game list with the installed games from the bundled list
if [ ! -s "$CFG/games.txt" ]; then
  INSTALLED="$TMPDIR/installed.txt"
  pm list packages 2>/dev/null | sed 's/^package://' > "$INSTALLED"
  grep -Fxf "$MODPATH/games_default.txt" "$INSTALLED" > "$CFG/games.txt" 2>/dev/null
  COUNT=$(grep -c . "$CFG/games.txt" 2>/dev/null)
  ui_print "- Games detected: ${COUNT:-0} (edit the list in the WebUI)"
fi

set_perm_recursive "$MODPATH" 0 0 0755 0644
set_perm "$MODPATH/service.sh" 0 0 0755
set_perm "$MODPATH/uninstall.sh" 0 0 0755
set_perm "$MODPATH/update-desc.sh" 0 0 0755
