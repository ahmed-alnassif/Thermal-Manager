#!/system/bin/sh
MODDIR=/data/adb/modules/thermal_mode_manager
THERMAL_PATH=/sys/class/thermal/thermal_message/sconfig
PID_FILE=${MODDIR}/service.pid

get_mode() {
    cat ${THERMAL_PATH} 2>/dev/null || echo "0"
}

get_mode_name() {
    case $1 in
        0) echo "Balanced ⚖️" ;;
        1) echo "Battery Saver 🔋" ;;
        6) echo "Performance ⚡" ;;
        19) echo "Gaming 🎮" ;;
        *) echo "Unknown" ;;
    esac
}

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
fi

if [ -f ${MODDIR}/module.prop ]; then
    sed "s/^description=.*/${string}/g" ${MODDIR}/module.prop > ${MODDIR}/module.prop.tmp
    grep -q "^description=" ${MODDIR}/module.prop.tmp && cat ${MODDIR}/module.prop.tmp > ${MODDIR}/module.prop
    rm -f ${MODDIR}/module.prop.tmp
    echo "Description updated: ${string}"
else
    echo "module.prop not found"
fi