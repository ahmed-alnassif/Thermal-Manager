import { exec, toast } from './kernelsu.js'
import './md3.js'

document.querySelector('.preload-hidden').classList.remove('preload-hidden')

const MODDIR = '/data/adb/modules/thermal_mode_manager'
const THERMAL_PATH = '/sys/class/thermal/thermal_message/sconfig'

const MODES = {
    '0': { name: 'Balanced', icon: '⚖️' },
    '1': { name: 'Battery', icon: '🔋' },
    '6': { name: 'Performance', icon: '⚡' },
    '19': { name: 'Gaming', icon: '🎮' }
}

async function updateStatus() {
    // Check interface
    const check = await exec(`[ -f ${THERMAL_PATH} ] && echo "1" || echo "0"`)
    const available = check.stdout.trim() === '1'
    
    const interfaceEl = document.getElementById('interface-status')
    interfaceEl.textContent = available ? 'Available' : 'Not Available'
    interfaceEl.className = `status-badge ${available ? 'active' : 'inactive'}`
    
    if (!available) {
        document.getElementById('service-status').textContent = 'Unavailable'
        document.getElementById('service-status').className = 'status-badge inactive'
        return
    }
    
    // Check service
    const pidCheck = await exec(`cat ${MODDIR}/service.pid 2>/dev/null`)
    const pid = pidCheck.stdout.trim()
    let running = false
    
    if (pid) {
        const psCheck = await exec(`ps -p ${pid} | grep -v PID | wc -l`)
        running = parseInt(psCheck.stdout.trim()) > 0
    }
    
    const serviceEl = document.getElementById('service-status')
    serviceEl.textContent = running ? 'Running' : 'Stopped'
    serviceEl.className = `status-badge ${running ? 'active' : 'inactive'}`
    
    // Get mode
    const modeCheck = await exec(`cat ${THERMAL_PATH} 2>/dev/null`)
    const mode = modeCheck.stdout.trim() || '0'
    const info = MODES[mode] || MODES['0']
    
    document.getElementById('current-mode-icon').textContent = info.icon
    document.getElementById('current-mode-name').textContent = info.name
    
    document.querySelectorAll('.mode-card').forEach(card => {
        card.classList.toggle('active', card.dataset.mode === mode)
    })
}

// Mode selection
document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', async () => {
        const mode = card.dataset.mode
        const info = MODES[mode]
        
        await exec(`echo "${mode}" > ${MODDIR}/current_mode`)
        const result = await exec(`echo "${mode}" > ${THERMAL_PATH} 2>&1`)
        
        if (result.errno === 0) {
            await exec(`sh ${MODDIR}/update-desc.sh`)
            toast(`✅ ${info.name} mode`)
            updateStatus()
        } else {
            toast(`❌ Failed`)
        }
    })
})

// Restart service
document.getElementById('restart-btn').addEventListener('click', async () => {
    const pidCheck = await exec(`cat ${MODDIR}/service.pid 2>/dev/null`)
    if (pidCheck.stdout.trim()) {
        await exec(`kill -9 ${pidCheck.stdout.trim()} 2>/dev/null`)
    }
    await exec(`sh ${MODDIR}/service.sh &`)
    toast('Service restarted')
    setTimeout(updateStatus, 1000)
})

// Refresh
document.getElementById('refresh-btn').addEventListener('click', () => {
    updateStatus()
    toast('Refreshed')
})

// Init
updateStatus()
setInterval(updateStatus, 5000)

// Back button
window.addEventListener('back', () => {
    window.webui?.exit()
})

// Open GitHub link
document.getElementById('github-link').addEventListener('click', async () => {
    await exec('am start -a android.intent.action.VIEW -d "https://github.com/ahmed-alnassif"');
})