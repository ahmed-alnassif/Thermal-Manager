MODDIR=/data/adb/modules/thermal_mode_manager
THERMAL_PATH=/sys/class/thermal/thermal_message/sconfig
CONFIG_FILE=${MODDIR}/current_mode
PID_FILE=${MODDIR}/service.pid

# Default mode
config_thermal_mode=0

# Wait for thermal interface
until [ -f ${THERMAL_PATH} ]; do
    sleep 5
done

# Function to apply mode
apply_mode() {
    local mode=$1
    if [ -f ${THERMAL_PATH} ]; then
        echo "$mode" > ${THERMAL_PATH} 2>/dev/null
    fi
}

# Function to get current mode
get_mode() {
    cat ${THERMAL_PATH} 2>/dev/null || echo "0"
}

# Function to get mode name
get_mode_name() {
    case $1 in
        0) echo "Balanced ⚖️" ;;
        1) echo "Battery Saver 🔋" ;;
        6) echo "Performance ⚡" ;;
        19) echo "Gaming 🎮" ;;
        *) echo "Unknown" ;;
    esac
}

# Monitor and maintain mode
monitor_mode() {
    while true; do
        if [ -f ${CONFIG_FILE} ]; then
            TARGET=$(cat ${CONFIG_FILE})
        else
            TARGET=${config_thermal_mode}
            echo ${TARGET} > ${CONFIG_FILE}
        fi
        
        CURRENT=$(get_mode)
        
        if [ "${CURRENT}" != "${TARGET}" ]; then
            apply_mode ${TARGET}
        fi
        
        sleep 1
    done
}

# Start monitoring in background
monitor_mode &
echo $! > ${PID_FILE}

# Wait for boot completion
until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 1
done

# Post-boot initialization
sleep 3

# Apply initial mode
if [ ! -f ${CONFIG_FILE} ]; then
    echo ${config_thermal_mode} > ${CONFIG_FILE}
fi

apply_mode $(cat ${CONFIG_FILE})

# Update module description
if [ -f ${THERMAL_PATH} ]; then
    CURRENT=$(get_mode)
    MODE_NAME=$(get_mode_name ${CURRENT})
    
    if [ -f ${PID_FILE} ]; then
        PID=$(cat ${PID_FILE})
        if kill -0 ${PID} 2>/dev/null; then
            string="description=status: active ✅ | mode: ${MODE_NAME}"
        else
            string="description=status: ready 🚀 | mode: ${MODE_NAME}"
        fi
    else
        string="description=status: ready 🚀 | mode: ${MODE_NAME}"
    fi
else
    string="description=status: failed 😭 | interface not found"
    touch ${MODDIR}/disable
fi

if [ -f ${MODDIR}/module.prop ]; then
    sed "s/^description=.*/${string}/g" ${MODDIR}/module.prop > ${MODDIR}/module.prop.tmp
    grep -q "^description=" ${MODDIR}/module.prop.tmp && cat ${MODDIR}/module.prop.tmp > ${MODDIR}/module.prop
    rm -f ${MODDIR}/module.prop.tmp
fi