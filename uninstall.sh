#!/system/bin/sh
# Runs when the module is removed. At that point the package manager is not up
# yet, so Samsung GOS / Game Tools are re-enabled in the background once the
# system has finished booting. Tip: switch to Balanced in the WebUI before
# removing the module; that re-enables them immediately.

nohup sh -c '
    until [ "$(getprop sys.boot_completed)" = "1" ]; do
        sleep 3
    done
    sleep 10
    pm enable com.samsung.android.game.gos >/dev/null 2>&1
    pm enable com.samsung.android.game.gametools >/dev/null 2>&1
    rm -rf /data/adb/thermalcore
' >/dev/null 2>&1 &

# Frequency limits and GED boost are runtime-only and reset on reboot; make
# sure the GED flags are off in the meantime.
for n in gx_game_mode boost_gpu_enable gx_force_cpu_boost; do
    [ -e "/sys/module/ged/parameters/$n" ] && echo 0 > "/sys/module/ged/parameters/$n" 2>/dev/null
done
exit 0
