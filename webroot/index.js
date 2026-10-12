import { exec as ksuExec, getPackagesInfo, enableInsets } from './kernelsu.js'

const MODDIR = '/data/adb/modules/thermalcore'
const CFG = '/data/adb/thermalcore'
const PKG_RE = /^[A-Za-z0-9_.]+$/
const TEMP_HYST = 7

// ------------------------------------------------------------------ i18n ---

const I18N = {
    en: {
        activeProfile: 'Active profile', socTemp: 'CPU temperature', battTemp: 'Battery temperature',
        chooseProfile: 'Choose a profile',
        profileHint: 'Games in your list switch to their own profile automatically.',
        autoGame: 'Auto game mode', autoGameSub: 'Switch profile when a game from the list is open',
        defaultGameProfile: 'Default game profile', defaultGameProfileSub: 'Used for games without their own profile',
        search: 'Search apps…', loadingApps: 'Loading apps…', noApps: 'No apps found',
        automation: 'Automation',
        autoBattery: 'Battery Saver when screen is off', autoBatterySub: 'Returns to your profile when you unlock',
        notify: 'Status notification', notifySub: 'Always shows the active profile, CPU and battery temperature',
        thermalGuard: 'Thermal guard', tempLimit: 'Temperature limit',
        tempLimitSub: 'Gaming / Performance boost pauses above this and resumes 7°C lower',
        tempWarn: "Higher limits mean longer boost but a hotter device. Android's own thermal protection always stays on.",
        service: 'Service', status: 'Status', platform: 'Platform',
        restart: 'Restart service', sensors: 'Sensors', showLog: 'Show log', hideLog: 'Hide log',
        about: 'About', aboutBy: 'Developed and maintained by <b>ifoknr</b>',
        credits: 'Based on Thermal Manager by Ahmed Al-Nassif. Game list from Licking Thermal by STAN (Apache-2.0).',
        tabProfiles: 'Profiles', tabGames: 'Games', tabSettings: 'Settings',
        balanced: 'Balanced', battery: 'Battery', performance: 'Performance', gaming: 'Gaming',
        balancedDesc: 'Stock behaviour for daily use',
        batteryDesc: 'Big cores capped at 1.4 GHz',
        performanceDesc: 'Fast governor + GPU boost',
        gamingDesc: '1.8 GHz floor, max GPU boost, GOS off',
        srcManual: 'Manual', srcScreenOff: 'Screen off', srcGame: 'Game',
        running: 'Running', stopped: 'Stopped',
        guardActive: 'Thermal guard active: boost paused until {t}°C',
        noSensor: 'No temperature sensor found: the guard is inactive',
        filterAll: 'All apps', filterGames: 'In game list', filterOthers: 'Not in list',
        useDefault: 'Default', gamesCount: '{n} games in list · {m} apps shown',
        saved: 'Saved', profileSet: '{p} profile selected', restarted: 'Service restarted',
        added: 'Added to game list', removed: 'Removed from game list',
        recommended: 'recommended',
    },
    ar: {
        activeProfile: 'الوضع الحالي', socTemp: 'حرارة المعالج', battTemp: 'حرارة البطارية',
        chooseProfile: 'اختر الوضع',
        profileHint: 'الألعاب الموجودة في قائمتك تتحول لوضعها الخاص تلقائياً.',
        autoGame: 'وضع الألعاب التلقائي', autoGameSub: 'يغيّر الوضع عند فتح لعبة من القائمة',
        defaultGameProfile: 'وضع الألعاب الافتراضي', defaultGameProfileSub: 'يُستخدم للألعاب اللي ما لها وضع خاص',
        search: 'ابحث عن تطبيق…', loadingApps: 'جاري تحميل التطبيقات…', noApps: 'لا توجد تطبيقات',
        automation: 'الأتمتة',
        autoBattery: 'توفير البطارية عند إطفاء الشاشة', autoBatterySub: 'يرجع لوضعك عند فتح القفل',
        notify: 'إشعار الحالة', notifySub: 'يعرض دائماً الوضع المفعّل وحرارة المعالج والبطارية',
        thermalGuard: 'الحماية الحرارية', tempLimit: 'حد الحرارة',
        tempLimitSub: 'يتوقف تسريع الألعاب/الأداء فوق هذا الحد ويرجع بعد ما تنزل 7°',
        tempWarn: 'الحد الأعلى يعني تسريع أطول لكن جهاز أسخن. حماية أندرويد الحرارية الأصلية تبقى شغالة دائماً.',
        service: 'الخدمة', status: 'الحالة', platform: 'المنصة',
        restart: 'إعادة تشغيل الخدمة', sensors: 'الحساسات', showLog: 'عرض السجل', hideLog: 'إخفاء السجل',
        about: 'حول', aboutBy: 'تطوير وصيانة <b>ifoknr</b>',
        credits: 'مبني على Thermal Manager لأحمد النصيف. قائمة الألعاب من Licking Thermal لـ STAN (Apache-2.0).',
        tabProfiles: 'الأوضاع', tabGames: 'الألعاب', tabSettings: 'الإعدادات',
        balanced: 'متوازن', battery: 'بطارية', performance: 'أداء', gaming: 'ألعاب',
        balancedDesc: 'إعدادات المصنع للاستخدام اليومي',
        batteryDesc: 'الأنوية الكبيرة محدودة عند 1.4 جيجا',
        performanceDesc: 'استجابة سريعة + تسريع الرسوميات',
        gamingDesc: 'حد أدنى 1.8 جيجا، أقصى تسريع، GOS مطفي',
        srcManual: 'يدوي', srcScreenOff: 'الشاشة مطفية', srcGame: 'لعبة',
        running: 'تعمل', stopped: 'متوقفة',
        guardActive: 'الحماية الحرارية فعالة: التسريع متوقف حتى {t}°',
        noSensor: 'ما فيه حساس حرارة: الحماية غير فعالة',
        filterAll: 'كل التطبيقات', filterGames: 'في قائمة الألعاب', filterOthers: 'خارج القائمة',
        useDefault: 'افتراضي', gamesCount: '{n} لعبة في القائمة · {m} تطبيق معروض',
        saved: 'تم الحفظ', profileSet: 'تم اختيار وضع {p}', restarted: 'تمت إعادة تشغيل الخدمة',
        added: 'أُضيفت لقائمة الألعاب', removed: 'حُذفت من قائمة الألعاب',
        recommended: 'موصى به',
    },
}

let lang = 'en'
try { lang = localStorage.getItem('tc_lang') || (navigator.language || '').startsWith('ar') && 'ar' || 'en' } catch { }

const t = (key, vars = {}) =>
    (I18N[lang][key] ?? I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')

function applyI18n() {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n) })
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh) })
}

// ----------------------------------------------------------------- shell ---

async function sh(cmd) {
    try {
        const { stdout } = await ksuExec(cmd)
        return (stdout || '').trim()
    } catch {
        return ''
    }
}

const writeCfg = (name, value) => sh(`mkdir -p ${CFG} && echo '${value}' > ${CFG}/${name}`)

let toastTimer
function toast(msg) {
    const el = document.getElementById('toast')
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800)
}

// -------------------------------------------------------------- dropdown ---

const CHEVRON = '<svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5H7Z"/></svg>'
const openDropdowns = new Set()

function closeAll(except) {
    openDropdowns.forEach(dd => { if (dd !== except) dd.close() })
}
document.addEventListener('click', () => closeAll())
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll() })

/**
 * Custom dropdown menu.
 * options: () => [{ value, label, sub? }] so labels follow the language
 */
function dropdown(root, options, value, onChange) {
    const dd = { value }
    root.innerHTML = `<button type="button" class="dd-btn"><span class="dd-label"></span>${CHEVRON}</button><div class="dd-menu" role="listbox"></div>`
    const btn = root.querySelector('.dd-btn')
    const menu = root.querySelector('.dd-menu')

    dd.render = () => {
        const opts = options()
        const cur = opts.find(o => o.value === dd.value) || opts[0]
        root.querySelector('.dd-label').textContent = cur ? cur.label : ''
        menu.innerHTML = ''
        opts.forEach(o => {
            const item = document.createElement('button')
            item.type = 'button'
            item.className = 'dd-item' + (o.value === dd.value ? ' selected' : '')
            item.textContent = o.label
            if (o.sub) {
                const s = document.createElement('span')
                s.className = 'dd-sub'
                s.textContent = o.sub
                item.appendChild(s)
            }
            item.addEventListener('click', e => {
                e.stopPropagation()
                dd.close()
                if (o.value === dd.value) return
                dd.value = o.value
                dd.render()
                onChange(o.value)
            })
            menu.appendChild(item)
        })
    }
    dd.set = v => { dd.value = v; dd.render() }
    dd.close = () => { root.classList.remove('open'); openDropdowns.delete(dd) }
    dd.open = () => {
        closeAll(dd)
        // Open upwards when there is no room below (e.g. above the bottom bar)
        const r = btn.getBoundingClientRect()
        root.classList.toggle('up', window.innerHeight - r.bottom < 300 && r.top > 300)
        root.classList.add('open')
        openDropdowns.add(dd)
        menu.querySelector('.selected')?.scrollIntoView({ block: 'nearest' })
    }
    btn.addEventListener('click', e => {
        e.stopPropagation()
        root.classList.contains('open') ? dd.close() : dd.open()
    })
    dd.render()
    return dd
}

// -------------------------------------------------------------- profiles ---

const PROFILES = {
    balanced: { icon: '⚖️', color: 'var(--p-balanced)' },
    battery: { icon: '🔋', color: 'var(--p-battery)' },
    performance: { icon: '⚡', color: 'var(--p-performance)' },
    gaming: { icon: '🎮', color: 'var(--p-gaming)' },
}
const PROFILE_IDS = Object.keys(PROFILES)
const normMode = m => ({ '0': 'balanced', '1': 'battery', '6': 'performance', '19': 'gaming' }[m] || (PROFILES[m] ? m : 'balanced'))

const state = {
    mode: 'balanced', effective: 'balanced', source: 'manual', pkg: '', hot: false,
    temp: 0, limit: 75, running: false, pid: '',
    games: new Set(), appProfiles: {},
}

function renderProfiles() {
    const grid = document.getElementById('profile-grid')
    grid.innerHTML = ''
    PROFILE_IDS.forEach(id => {
        const p = PROFILES[id]
        const card = document.createElement('button')
        card.type = 'button'
        card.className = 'profile' + (state.mode === id ? ' active' : '')
        card.style.setProperty('--c', p.color)
        card.innerHTML = `<span class="p-check"></span><div class="p-icon">${p.icon}</div><div class="p-name"></div><div class="p-desc"></div>`
        card.querySelector('.p-name').textContent = t(id)
        card.querySelector('.p-desc').textContent = t(id + 'Desc')
        card.addEventListener('click', async () => {
            state.mode = id
            renderProfiles()
            await writeCfg('mode', id)
            toast(t('profileSet', { p: t(id) }))
            setTimeout(refreshStatus, 600)
        })
        grid.appendChild(card)
    })
}

function renderHero() {
    const id = state.effective
    const p = PROFILES[id]
    const hero = document.getElementById('hero')
    hero.style.setProperty('--c', p.color)
    document.getElementById('hero-icon').textContent = p.icon
    document.getElementById('hero-name').textContent = t(id)

    const src = document.getElementById('chip-source')
    if (state.source === 'game') {
        const app = apps.find(a => a.pkg === state.pkg)
        src.textContent = `🎮 ${app ? app.label : state.pkg}`
    } else {
        src.textContent = state.source === 'screen_off' ? `🌙 ${t('srcScreenOff')}` : `✋ ${t('srcManual')}`
    }
    const svc = document.getElementById('chip-service')
    svc.textContent = state.running ? `● ${t('running')}` : `● ${t('stopped')}`
    svc.className = 'chip ' + (state.running ? 'ok' : 'bad')

    document.getElementById('temp-now').textContent = state.temp || '--'
    document.getElementById('batt-now').textContent = state.batt || '--'
    document.getElementById('temp-limit').textContent = state.limit
    document.getElementById('temp-fill').style.width = `${Math.min(100, (state.temp / state.limit) * 100)}%`
    const note = document.getElementById('temp-note')
    if (!state.temp) {
        note.hidden = false
        note.textContent = t('noSensor')
    } else if (state.hot) {
        note.hidden = false
        note.textContent = t('guardActive', { t: state.limit - TEMP_HYST })
    } else {
        note.hidden = true
    }

    document.getElementById('svc-status').textContent = state.running ? t('running') : t('stopped')
    document.getElementById('svc-pid').textContent = state.pid || '—'
}

// Same zone filter as service.sh: hottest cpu/soc/gpu/mtk zone, read-only
const TEMP_CMD = `max=0; for z in /sys/class/thermal/thermal_zone*; do case "$(cat $z/type 2>/dev/null)" in *cpu*|*soc*|*gpu*|*big*|*mtk*) v=$(cat $z/temp 2>/dev/null); [ -n "$v" ] || continue; [ "$v" -gt 1000 ] 2>/dev/null && v=$((v/1000)); [ "$v" -gt 0 ] 2>/dev/null && [ "$v" -lt 150 ] 2>/dev/null && [ "$v" -gt "$max" ] && max=$v;; esac; done; echo $max`

async function refreshStatus() {
    const out = await sh(`
        echo "mode=$(cat ${CFG}/mode 2>/dev/null)"
        echo "state=$(cat ${CFG}/state 2>/dev/null)"
        echo "limit=$(cat ${CFG}/temp_limit 2>/dev/null)"
        pid=$(cat ${CFG}/service.pid 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "pid=$pid"
            # Smoothed value written by the service, so UI and notification agree
            echo "temp=$(cut -d' ' -f1 ${CFG}/temp 2>/dev/null)"
        else
            echo "temp=$(${TEMP_CMD})"
        fi
        # Battery reports tenths of a degree
        b=$(cat /sys/class/power_supply/battery/temp 2>/dev/null)
        [ -n "$b" ] && echo "batt=$(( (b + 5) / 10 ))"
    `)
    const kv = Object.fromEntries(out.split('\n').map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
    state.mode = normMode(kv.mode)
    const [eff, source, pkg, hot] = (kv.state || '').split('|')
    state.running = !!kv.pid
    state.pid = kv.pid || ''
    state.effective = state.running && eff ? normMode(eff) : state.mode
    state.source = state.running ? (source || 'manual') : 'manual'
    state.pkg = pkg || ''
    state.hot = hot === '1'
    state.limit = Math.min(85, Math.max(60, parseInt(kv.limit) || 75))
    state.temp = parseInt(kv.temp) || 0
    state.batt = parseInt(kv.batt) || 0
    renderHero()
    document.querySelectorAll('.profile').forEach((c, i) => c.classList.toggle('active', PROFILE_IDS[i] === state.mode))
}

// ----------------------------------------------------------------- games ---

let apps = []
let filter = 'all'
const appDropdowns = []

async function saveGames() {
    const list = [...state.games].filter(p => PKG_RE.test(p)).sort().join('\n')
    const profiles = Object.entries(state.appProfiles)
        .filter(([p, m]) => PKG_RE.test(p) && PROFILES[m])
        .map(([p, m]) => `${p}=${m}`).join('\n')
    // Labels let the status notification show "PUBG Mobile" instead of the package
    const labels = [...state.games].filter(p => PKG_RE.test(p))
        .map(p => `${p}=${(apps.find(a => a.pkg === p)?.label || p).replace(/['"\\\n=]/g, '')}`).join('\n')
    await sh(`mkdir -p ${CFG} && printf '%s\\n' '${list}' | grep . > ${CFG}/games.txt; printf '%s\\n' '${profiles}' | grep . > ${CFG}/app_profiles; printf '%s\\n' '${labels}' | grep . > ${CFG}/labels; true`)
}

function appProfileOptions() {
    return [{ value: '', label: t('useDefault') }, ...['gaming', 'performance', 'balanced'].map(id => ({ value: id, label: `${PROFILES[id].icon} ${t(id)}` }))]
}

function renderApps() {
    const q = document.getElementById('app-search').value.trim().toLowerCase()
    const list = document.getElementById('app-list')
    appDropdowns.length = 0

    const shown = apps
        .filter(a => filter === 'all' || (filter === 'games') === state.games.has(a.pkg))
        .filter(a => !q || a.label.toLowerCase().includes(q) || a.pkg.toLowerCase().includes(q))
        .sort((a, b) => (state.games.has(b.pkg) - state.games.has(a.pkg)) || a.label.localeCompare(b.label))

    document.getElementById('games-counter').textContent = t('gamesCount', { n: state.games.size, m: shown.length })
    list.innerHTML = ''
    if (!shown.length) {
        list.innerHTML = `<div class="empty">${t('noApps')}</div>`
        return
    }

    const frag = document.createDocumentFragment()
    shown.slice(0, 200).forEach(a => {
        const on = state.games.has(a.pkg)
        const row = document.createElement('div')
        row.className = 'app' + (on ? ' on' : '')
        row.innerHTML = `
            <div class="app-icon"></div>
            <div class="app-text"><div class="app-name"></div><div class="app-pkg"></div></div>
            <div class="dropdown"></div>
            <label class="switch"><input type="checkbox" /><span></span></label>`
        const icon = row.querySelector('.app-icon')
        icon.textContent = a.label.charAt(0).toUpperCase()
        const img = new Image()
        img.onload = () => { icon.textContent = ''; icon.appendChild(img) }
        img.src = `ksu://icon/${a.pkg}`
        row.querySelector('.app-name').textContent = a.label
        row.querySelector('.app-pkg').textContent = a.pkg

        const ddRoot = row.querySelector('.dropdown')
        ddRoot.hidden = !on
        appDropdowns.push(dropdown(ddRoot, appProfileOptions, state.appProfiles[a.pkg] || '', async v => {
            if (v) state.appProfiles[a.pkg] = v
            else delete state.appProfiles[a.pkg]
            await saveGames()
            toast(t('saved'))
        }))

        const sw = row.querySelector('input')
        sw.checked = on
        sw.addEventListener('change', async () => {
            if (sw.checked) state.games.add(a.pkg)
            else { state.games.delete(a.pkg); delete state.appProfiles[a.pkg] }
            row.classList.toggle('on', sw.checked)
            ddRoot.hidden = !sw.checked
            await saveGames()
            toast(t(sw.checked ? 'added' : 'removed'))
            document.getElementById('games-counter').textContent = t('gamesCount', { n: state.games.size, m: shown.length })
        })
        frag.appendChild(row)
    })
    list.appendChild(frag)
}

async function loadApps() {
    const out = await sh(`cat ${CFG}/games.txt 2>/dev/null; echo ---; cat ${CFG}/app_profiles 2>/dev/null; echo ---; pm list packages -3 2>/dev/null`)
    const [games = '', profiles = '', pkgs = ''] = out.split('---')
    state.games = new Set(games.split('\n').map(s => s.trim()).filter(p => PKG_RE.test(p)))
    state.appProfiles = {}
    profiles.split('\n').forEach(l => {
        const [p, m] = l.trim().split('=')
        if (PKG_RE.test(p || '') && PROFILES[m]) state.appProfiles[p] = m
    })

    const names = pkgs.split('\n').map(l => l.replace('package:', '').trim()).filter(p => PKG_RE.test(p))
    // Games from the list that are installed as system apps still show up
    state.games.forEach(p => { if (!names.includes(p)) names.push(p) })

    let labels = {}
    try {
        const info = await getPackagesInfo(names)
        ;(Array.isArray(info) ? info : [info]).forEach(i => { if (i?.packageName) labels[i.packageName] = i.appLabel })
    } catch { }
    apps = names.map(pkg => ({ pkg, label: labels[pkg] || pkg }))
    renderApps()
    saveGames()
}

// -------------------------------------------------------------- settings ---

async function loadSettings() {
    const out = await sh(`for f in auto_battery auto_game notify game_mode temp_limit; do echo "$f=$(cat ${CFG}/$f 2>/dev/null)"; done; echo "platform=$(getprop ro.board.platform)"; echo "model=$(getprop ro.product.model)"; echo "version=$(grep '^version=' ${MODDIR}/module.prop | cut -d= -f2)"`)
    const kv = Object.fromEntries(out.split('\n').map(l => l.split('=')))
    document.getElementById('sw-auto-battery').checked = kv.auto_battery === '1'
    document.getElementById('sw-auto-game').checked = kv.auto_game !== '0'
    document.getElementById('sw-notify').checked = kv.notify === '1'
    gameModeDD.set(PROFILES[kv.game_mode] ? kv.game_mode : 'gaming')
    const limit = String(Math.min(85, Math.max(60, parseInt(kv.temp_limit) || 75)))
    tempDD.set(limit)
    document.getElementById('temp-warn').hidden = parseInt(limit) <= 75
    document.getElementById('svc-platform').textContent = kv.platform
        ? `${kv.platform}${kv.platform.startsWith('mt6989') ? ' ✓' : ' ⚠'}` : '—'
    document.getElementById('about-version').textContent = kv.version || ''
    // Show the device the module is running on instead of a fixed model name
    if (kv.model) document.getElementById('brand-sub').textContent = [kv.model, kv.platform].filter(Boolean).join(' · ')
}

function bindSwitch(id, file) {
    document.getElementById(id).addEventListener('change', async e => {
        await writeCfg(file, e.target.checked ? '1' : '0')
        toast(t('saved'))
    })
}

// ------------------------------------------------------------------ init ---

let gameModeDD, tempDD, langDD, filterDD

function relabel() {
    applyI18n()
    renderProfiles()
    renderHero()
    ;[gameModeDD, tempDD, langDD, filterDD, ...appDropdowns].forEach(dd => dd.render())
    renderApps()
    const logBtn = document.getElementById('btn-log')
    logBtn.textContent = t(document.getElementById('log').hidden ? 'showLog' : 'hideLog')
}

function initTabs() {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b === btn))
        document.querySelectorAll('.tab').forEach(tab => { tab.hidden = tab.id !== `tab-${btn.dataset.tab}` })
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }))
}

function init() {
    try { enableInsets(true) } catch { }
    applyI18n()
    initTabs()
    renderProfiles()

    langDD = dropdown(document.getElementById('dd-lang'),
        () => [{ value: 'en', label: '🌐 English' }, { value: 'ar', label: '🌐 العربية' }],
        lang, v => {
            lang = v
            try { localStorage.setItem('tc_lang', v) } catch { }
            relabel()
        })

    gameModeDD = dropdown(document.getElementById('dd-game-mode'),
        () => ['gaming', 'performance', 'balanced'].map(id => ({ value: id, label: `${PROFILES[id].icon} ${t(id)}` })),
        'gaming', async v => { await writeCfg('game_mode', v); toast(t('saved')) })

    tempDD = dropdown(document.getElementById('dd-temp'),
        () => [60, 65, 70, 75, 80, 85].map(n => ({ value: String(n), label: `${n}°C`, sub: n === 75 ? t('recommended') : '' })),
        '75', async v => {
            await writeCfg('temp_limit', v)
            document.getElementById('temp-warn').hidden = parseInt(v) <= 75
            toast(t('saved'))
            refreshStatus()
        })

    filterDD = dropdown(document.getElementById('dd-filter'),
        () => [{ value: 'all', label: t('filterAll') }, { value: 'games', label: t('filterGames') }, { value: 'others', label: t('filterOthers') }],
        'all', v => { filter = v; renderApps() })

    bindSwitch('sw-auto-battery', 'auto_battery')
    bindSwitch('sw-auto-game', 'auto_game')
    bindSwitch('sw-notify', 'notify')

    let searchTimer
    document.getElementById('app-search').addEventListener('input', () => {
        clearTimeout(searchTimer)
        searchTimer = setTimeout(renderApps, 150)
    })

    document.getElementById('btn-restart').addEventListener('click', async () => {
        await sh(`pid=$(cat ${CFG}/service.pid 2>/dev/null); [ -n "$pid" ] && kill "$pid" 2>/dev/null; nohup sh ${MODDIR}/service.sh >/dev/null 2>&1 &`)
        toast(t('restarted'))
        setTimeout(refreshStatus, 1500)
    })

    // Every thermal zone with its current value; ✓ marks the ones ThermalCore reads
    document.getElementById('btn-sensors').addEventListener('click', async () => {
        const log = document.getElementById('log')
        log.hidden = false
        document.getElementById('btn-log').textContent = t('hideLog')
        log.textContent = (await sh(`for z in /sys/class/thermal/thermal_zone*; do t=$(cat $z/type 2>/dev/null); v=$(cat $z/temp 2>/dev/null); [ -n "$v" ] || continue; [ "$v" -gt 1000 ] 2>/dev/null && v=$((v/1000)); case "$t" in *cpu*|*soc*|*gpu*|*big*|*mtk*) m='✓';; *) m='·';; esac; echo "$v $m $t"; done | sort -rn | awk '{printf "%s %4s°C  %s\\n", $2, $1, $3}'`)) || '—'
    })

    document.getElementById('btn-log').addEventListener('click', async e => {
        const log = document.getElementById('log')
        log.hidden = !log.hidden
        e.target.textContent = t(log.hidden ? 'showLog' : 'hideLog')
        if (!log.hidden) log.textContent = (await sh(`tail -n 60 ${CFG}/service.log 2>/dev/null`)) || '—'
    })

    document.getElementById('btn-github').addEventListener('click', () =>
        sh('am start -a android.intent.action.VIEW -d "https://github.com/ifoknr/IFOKNR-THEMAL-MANAGER"'))

    loadSettings()
    refreshStatus()
    loadApps()
    setInterval(refreshStatus, 4000)
}

init()

window.addEventListener('back', () => window.webui?.exit())
