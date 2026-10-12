#!/system/bin/sh
# ThermalCore service: applies the selected profile, switches to the game
# profile when a listed game is in the foreground, and keeps a thermal guard.
MODDIR=${0%/*}
CFG=/data/adb/thermalcore
LOG="$CFG/service.log"
ORIG="$CFG/orig"
CPUFREQ=/sys/devices/system/cpu/cpufreq
GED=/sys/module/ged/parameters

# Frequency (kHz) above which a cpufreq policy is treated as a "big" cluster.
# On the Dimensity 9300+ this selects the Cortex-X4 clusters (cpu4-6 / cpu7)
# and leaves the Cortex-A720 cluster (cpu0-3) to the stock scheduler.
BIG_MIN_KHZ=2500000
GAMING_FLOOR_KHZ=1800000
BATTERY_CAP_KHZ=1400000

# Thermal guard (Gaming / Performance): above the limit (deg C) the boosts are
# dropped and Samsung GOS is re-enabled; it resumes at limit - TEMP_HYST.
# The limit is user-selectable but always clamped to TEMP_MIN..TEMP_MAX.
TEMP_LIMIT_DEFAULT=75
TEMP_MIN=60
TEMP_MAX=85
TEMP_HYST=7

mkdir -p "$CFG"
echo $$ > "$CFG/service.pid"

log() {
    echo "$(date '+%m-%d %H:%M:%S') $*" >> "$LOG"
}

# Keep the log small
[ -f "$LOG" ] && [ "$(wc -c < "$LOG")" -gt 65536 ] && : > "$LOG"

until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 3
done
sleep 5

# Defaults (settings live outside the module dir so they survive updates)
[ -f "$CFG/mode" ] || echo balanced > "$CFG/mode"
[ -f "$CFG/auto_battery" ] || echo 0 > "$CFG/auto_battery"
[ -f "$CFG/auto_game" ] || echo 1 > "$CFG/auto_game"
[ -f "$CFG/game_mode" ] || echo gaming > "$CFG/game_mode"
[ -f "$CFG/notify" ] || echo 1 > "$CFG/notify"
[ -f "$CFG/temp_limit" ] || echo "$TEMP_LIMIT_DEFAULT" > "$CFG/temp_limit"
[ -f "$CFG/games.txt" ] || : > "$CFG/games.txt"
[ -f "$CFG/app_profiles" ] || : > "$CFG/app_profiles"

PLATFORM="$(getprop ro.board.platform)"
case "$PLATFORM" in
    mt6989*) log "Platform $PLATFORM (Dimensity 9300/9300+)" ;;
    *) log "WARNING: platform '$PLATFORM' is not mt6989; tweaks are node-guarded but untested here" ;;
esac

# ---------------------------------------------------------------- helpers ---

# w <value> <file>: write if the node exists, never leave it read-only
w() {
    [ -e "$2" ] || return 1
    chmod 644 "$2" 2>/dev/null
    echo "$1" > "$2" 2>/dev/null
}

# Policies of the big clusters (auto-detected by max frequency)
big_policies() {
    for pol in "$CPUFREQ"/policy*; do
        [ -r "$pol/cpuinfo_max_freq" ] || continue
        max=$(cat "$pol/cpuinfo_max_freq" 2>/dev/null)
        [ "$max" -ge "$BIG_MIN_KHZ" ] 2>/dev/null && echo "$pol"
    done
}

has_gov() {   # has_gov <policy> <governor>
    case " $(cat "$1/scaling_available_governors" 2>/dev/null) " in
        *" $2 "*) return 0 ;;
    esac
    return 1
}

# Remember the stock governor of every policy once per boot, before any change
save_original_governors() {
    mkdir -p "$ORIG"
    for pol in "$CPUFREQ"/policy*; do
        [ -r "$pol/scaling_governor" ] || continue
        cat "$pol/scaling_governor" > "$ORIG/$(basename "$pol")" 2>/dev/null
    done
}

# Back to stock limits and stock governors
reset_frequencies() {
    for pol in "$CPUFREQ"/policy*; do
        [ -d "$pol" ] || continue
        w "$(cat "$pol/cpuinfo_min_freq" 2>/dev/null)" "$pol/scaling_min_freq"
        w "$(cat "$pol/cpuinfo_max_freq" 2>/dev/null)" "$pol/scaling_max_freq"
        orig=$(cat "$ORIG/$(basename "$pol")" 2>/dev/null)
        if [ -n "$orig" ]; then
            w "$orig" "$pol/scaling_governor"
        elif has_gov "$pol" schedutil; then
            w schedutil "$pol/scaling_governor"
        fi
    done
}

# MediaTek GED GPU / frame boost
set_gpu_boost() {
    for n in gx_game_mode boost_gpu_enable gx_force_cpu_boost; do
        w "$1" "$GED/$n"
    done
}

# Prefer sugov_ext (MediaTek's governor), fall back to schedutil, and zero the
# up-rate limit in the per-policy directory where it really lives.
apply_fast_governor() {
    for pol in "$CPUFREQ"/policy*; do
        [ -d "$pol" ] || continue
        if has_gov "$pol" sugov_ext; then
            gov=sugov_ext
        elif has_gov "$pol" schedutil; then
            gov=schedutil
        else
            continue
        fi
        w "$gov" "$pol/scaling_governor"
        w 0 "$pol/$gov/up_rate_limit_us"
    done
}

gos_disable() {
    pm disable-user --user 0 com.samsung.android.game.gos >/dev/null 2>&1
    [ "$1" = "all" ] && \
        pm disable-user --user 0 com.samsung.android.game.gametools >/dev/null 2>&1
}

gos_enable() {
    pm enable com.samsung.android.game.gos >/dev/null 2>&1
    pm enable com.samsung.android.game.gametools >/dev/null 2>&1
}

norm_mode() {
    case "$1" in
        gaming|19) echo gaming ;;
        performance|6) echo performance ;;
        battery|1) echo battery ;;
        *) echo balanced ;;
    esac
}

# Hottest relevant thermal zone in deg C (read-only; zones are never modified).
# Prints 0 when no matching zone is found.
get_soc_temp() {
    max=0
    for z in /sys/class/thermal/thermal_zone*; do
        case "$(cat "$z/type" 2>/dev/null)" in
            *cpu*|*soc*|*gpu*|*big*|*mtk*) ;;
            *) continue ;;
        esac
        v=$(cat "$z/temp" 2>/dev/null)
        [ -n "$v" ] || continue
        [ "$v" -gt 1000 ] 2>/dev/null && v=$((v / 1000))
        [ "$v" -gt 0 ] 2>/dev/null && [ "$v" -lt 150 ] 2>/dev/null || continue
        [ "$v" -gt "$max" ] && max=$v
    done
    echo "$max"
}

# Battery temperature in deg C (power_supply reports tenths), 0 if unknown
get_batt_temp() {
    v=$(cat /sys/class/power_supply/battery/temp 2>/dev/null)
    case "$v" in
        ''|*[!0-9-]*) echo 0 ;;
        *) echo $(( (v + 5) / 10 )) ;;
    esac
}

get_temp_limit() {
    l=$(cat "$CFG/temp_limit" 2>/dev/null)
    case "$l" in
        ''|*[!0-9]*) l=$TEMP_LIMIT_DEFAULT ;;
    esac
    [ "$l" -lt "$TEMP_MIN" ] && l=$TEMP_MIN
    [ "$l" -gt "$TEMP_MAX" ] && l=$TEMP_MAX
    echo "$l"
}

# Gaming CPU floor on the big clusters only
apply_gaming_floor() {
    for pol in $(big_policies); do
        max=$(cat "$pol/cpuinfo_max_freq" 2>/dev/null)
        floor=$GAMING_FLOOR_KHZ
        [ "$floor" -gt "$max" ] 2>/dev/null && floor=$max
        w "$floor" "$pol/scaling_min_freq"
    done
}

set_profile() {
    case "$1" in
        gaming)
            gos_disable all
            reset_frequencies
            set_gpu_boost 1
            apply_fast_governor
            apply_gaming_floor
            ;;
        performance)
            gos_disable
            reset_frequencies
            set_gpu_boost 1
            apply_fast_governor
            ;;
        battery)
            gos_enable
            set_gpu_boost 0
            # Reset first so a leftover Gaming floor never exceeds the new cap
            reset_frequencies
            for pol in $(big_policies); do
                w "$BATTERY_CAP_KHZ" "$pol/scaling_max_freq"
                has_gov "$pol" powersave && w powersave "$pol/scaling_governor"
            done
            ;;
        *)
            gos_enable
            set_gpu_boost 0
            reset_frequencies
            ;;
    esac

    log "Profile applied: $1"
    [ -f "$MODDIR/update-desc.sh" ] && sh "$MODDIR/update-desc.sh" "$1"
}

# Released state of the thermal guard: stock frequencies, no GPU boost, GOS on
release_boost() {
    reset_frequencies
    set_gpu_boost 0
    gos_enable
}

screen_is_on() {
    dumpsys power 2>/dev/null | grep -q "mWakefulness=Awake"
}

# Packages of all resumed activities (focused one first). Unlike the focused
# window, these stay on the game while the notification shade or another
# overlay is pulled down, and they include both apps in split screen.
resumed_pkgs() {
    pk=$(dumpsys activity activities 2>/dev/null | grep -E 'ResumedActivity' \
        | sed -n 's/.* u[0-9]* \([^/ }]*\)\/.*/\1/p')
    [ -n "$pk" ] || pk=$(dumpsys window 2>/dev/null | grep -m1 mCurrentFocus \
        | sed -n 's/.* u[0-9]* \([^/ }]*\).*/\1/p')
    echo "$pk"
}

# First listed game among the resumed packages
foreground_game() {
    for pk in $(resumed_pkgs); do
        is_game "$pk" && { echo "$pk"; return; }
    done
}

is_game() {
    [ -n "$1" ] && grep -qx "$1" "$CFG/games.txt" 2>/dev/null
}

# Per-app profile from app_profiles ("pkg=mode"), else the default game mode
game_profile_for() {
    p=$(grep -m1 "^$1=" "$CFG/app_profiles" 2>/dev/null | cut -d= -f2)
    [ -n "$p" ] || p=$(cat "$CFG/game_mode" 2>/dev/null)
    norm_mode "$p"
}

# ---------------------------------------------------- status notification ---
# One notification (tag "thermalcore") that is updated in place with the active
# profile and the SoC temperature. It is re-posted on every change, so it comes
# back if it was swiped away.
NOTIF_TAG=thermalcore
NOTIF_LAST=""
NOTIF_TIME=0
NOTIF_TEMP=0

notif_key() {
    dumpsys notification 2>/dev/null \
        | grep -o "0|com.android.shell|[0-9]*|$NOTIF_TAG|[0-9]*" | head -n1
}

profile_label() {
    case "$1" in
        gaming) echo "🎮 Gaming" ;;
        performance) echo "⚡ Performance" ;;
        battery) echo "🔋 Battery" ;;
        *) echo "⚖️ Balanced" ;;
    esac
}

# App label saved by the WebUI, else the package name
app_label() {
    l=$(grep -m1 "^$1=" "$CFG/labels" 2>/dev/null | cut -d= -f2-)
    echo "${l:-$1}" | tr -d "'\"\\\\"
}

# notify_status <profile> <source> <pkg> <hot> <temp> <limit> [force]
notify_status() {
    [ "$(cat "$CFG/notify" 2>/dev/null)" = "1" ] || return 0
    now=$(date +%s)
    key="$1|$2|$3|$4"
    diff=$(( $5 - NOTIF_TEMP )); [ "$diff" -lt 0 ] && diff=$(( -diff ))
    # Post on a state change; temperature-only updates at most every 60 s
    # (and only on a 3 C move), plus a refresh every 10 min.
    if [ -z "$7" ] && [ "$key" = "$NOTIF_LAST" ]; then
        if [ $((now - NOTIF_TIME)) -lt 600 ]; then
            [ "$diff" -ge 3 ] && [ $((now - NOTIF_TIME)) -ge 60 ] || return 0
        fi
    fi
    title="ThermalCore · $(profile_label "$1")"
    if [ "$5" -gt 0 ] 2>/dev/null; then
        body="🌡️ CPU $5°C / $6°C"
    else
        body="🌡️ CPU --"
    fi
    [ "${BATT:-0}" -gt 0 ] 2>/dev/null && body="$body · 🔋 ${BATT}°C"
    case "$2" in
        game) body="$body · $(app_label "$3")" ;;
        screen_off) body="$body · Screen off" ;;
    esac
    [ "$4" = "1" ] && body="$body · ⏸ Boost paused (hot)"
    su -lp 2000 -c "cmd notification post -S bigtext -t '$title' $NOTIF_TAG '$body'" >/dev/null 2>&1
    NOTIF_LAST="$key"; NOTIF_TIME=$now; NOTIF_TEMP=$5
}

# Hide the notification when the option is turned off (best effort: snooze it)
notify_hide() {
    k=$(notif_key)
    [ -n "$k" ] && su -lp 2000 -c "cmd notification snooze --for 31536000000 '$k'" >/dev/null 2>&1
    NOTIF_LAST=""
}

notify_unhide() {
    k=$(notif_key)
    [ -n "$k" ] || k="0|com.android.shell|2020|$NOTIF_TAG|2000"
    su -lp 2000 -c "cmd notification unsnooze '$k'" >/dev/null 2>&1
}

# Snapshot for the WebUI: effective profile, why, game package, guard state
write_state() {
    echo "$1|$2|$3|$4" > "$CFG/state"
}

# ------------------------------------------------------------------- main ---

save_original_governors

if [ -z "$(big_policies)" ]; then
    log "No cpufreq policy >= ${BIG_MIN_KHZ} kHz found: CPU floor/cap will not be applied"
fi
ZONES=""
for z in /sys/class/thermal/thermal_zone*; do
    t=$(cat "$z/type" 2>/dev/null)
    case "$t" in *cpu*|*soc*|*gpu*|*big*|*mtk*) ZONES="$ZONES $t" ;; esac
done
log "Temperature sensors used:${ZONES:- none}"
if [ "$(get_soc_temp)" = "0" ]; then
    log "No usable thermal zone found: thermal guard is inactive"
fi

LAST_MODE=""
LAST_PKG=""
HOT=0
GAME_PKG=""
GAME_MISS=0
NOTIFY_ON=""
TEMP_X10=0
OVER=0

while true; do
    USER_MODE=$(norm_mode "$(cat "$CFG/mode" 2>/dev/null)")
    EFFECTIVE="$USER_MODE"
    SOURCE=manual
    PKG=""

    # dumpsys is expensive: only query when a feature that needs it is enabled
    AUTO_BAT=$(cat "$CFG/auto_battery" 2>/dev/null)
    AUTO_GAME=$(cat "$CFG/auto_game" 2>/dev/null)
    SCREEN=on
    if [ "$AUTO_BAT" = "1" ] && ! screen_is_on; then
        SCREEN=off
        EFFECTIVE=battery
        SOURCE=screen_off
    fi
    if [ "$SCREEN" = "on" ] && [ "$AUTO_GAME" = "1" ]; then
        FG=$(foreground_game)
        if [ -n "$FG" ]; then
            GAME_PKG="$FG"
            GAME_MISS=0
        elif [ -n "$GAME_PKG" ]; then
            # Leave the game profile only after two misses in a row (~10 s),
            # so short overlays never drop the profile.
            GAME_MISS=$((GAME_MISS + 1))
            [ "$GAME_MISS" -ge 2 ] && GAME_PKG=""
        fi
        if [ -n "$GAME_PKG" ]; then
            PKG="$GAME_PKG"
            EFFECTIVE=$(game_profile_for "$GAME_PKG")
            SOURCE=game
        fi
    else
        GAME_PKG=""
        GAME_MISS=0
    fi

    if [ "$EFFECTIVE" != "$LAST_MODE" ]; then
        HOT=0
        OVER=0
        set_profile "$EFFECTIVE"
        LAST_MODE="$EFFECTIVE"
        write_state "$EFFECTIVE" "$SOURCE" "$PKG" "$HOT"
        LAST_PKG="$PKG"
    elif [ "$PKG" != "$LAST_PKG" ]; then
        write_state "$EFFECTIVE" "$SOURCE" "$PKG" "$HOT"
        LAST_PKG="$PKG"
    fi

    # Core sensors spike for a moment with every burst of load, so the raw
    # hottest value is smoothed (exponential average, ~15 s) before it is shown
    # or used by the guard.
    RAW=$(get_soc_temp)
    if [ "$RAW" -gt 0 ] 2>/dev/null; then
        if [ "$TEMP_X10" -eq 0 ]; then
            TEMP_X10=$((RAW * 10))
        else
            TEMP_X10=$(( (TEMP_X10 * 2 + RAW * 10) / 3 ))
        fi
    fi
    TEMP=$(( (TEMP_X10 + 5) / 10 ))
    BATT=$(get_batt_temp)
    echo "$TEMP $RAW $BATT" > "$CFG/temp"
    LIMIT=$(get_temp_limit)

    # Thermal guard for the boosted profiles
    case "$EFFECTIVE" in
        gaming|performance)
            # Trip only after two smoothed readings in a row at the limit
            if [ "$TEMP" -ge "$LIMIT" ]; then
                OVER=$((OVER + 1))
            else
                OVER=0
            fi
            if [ "$HOT" = "0" ] && [ "$OVER" -ge 2 ]; then
                HOT=1
                release_boost
                write_state "$EFFECTIVE" "$SOURCE" "$PKG" "$HOT"
                log "Thermal guard: ${TEMP}C (raw ${RAW}C) >= ${LIMIT}C, boost released and GOS re-enabled"
            elif [ "$HOT" = "1" ] && [ "$TEMP" -le $((LIMIT - TEMP_HYST)) ]; then
                HOT=0
                set_profile "$EFFECTIVE"
                write_state "$EFFECTIVE" "$SOURCE" "$PKG" "$HOT"
                log "Thermal guard: ${TEMP}C (raw ${RAW}C), $EFFECTIVE restored"
            fi
            ;;
    esac

    # Status notification follows the switch in the WebUI
    N=$(cat "$CFG/notify" 2>/dev/null)
    if [ "$N" != "$NOTIFY_ON" ]; then
        if [ "$N" = "1" ]; then
            [ -n "$NOTIFY_ON" ] && notify_unhide
            notify_status "$EFFECTIVE" "$SOURCE" "$PKG" "$HOT" "$TEMP" "$LIMIT" force
        elif [ -n "$NOTIFY_ON" ]; then
            notify_hide
        fi
        NOTIFY_ON="$N"
    else
        notify_status "$EFFECTIVE" "$SOURCE" "$PKG" "$HOT" "$TEMP" "$LIMIT"
    fi

    sleep 5
done
