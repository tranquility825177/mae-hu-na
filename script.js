const EMOJIS = ['❤️', '🏃', '📚', '💧', '🧘', '✍️', '🎸', '🥗', '💪', '🌿', '🎨', '🧹', '💊', '🌅', '🎯', '🛌', '🧠', '🚴', '🏋️', '🎵'];
const COLORS = [
    '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
    '#6366f1', '#a855f7', '#8b5cf6', '#ec4899'
];
const COLOR_NAMES = ['Rose', 'Red', 'Orange', 'Amber', 'Yellow', 'Lime', 'Green', 'Teal', 'Cyan', 'Blue', 'Indigo', 'Purple', 'Violet', 'Pink'];
const DAY_S = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let habits = JSON.parse(localStorage.getItem('ht2_habits') || '[]');
let editId = null;
let deleteId = null;
let openMenuId = null;
let selEmoji = '❤️';
let selColor = '#f43f5e';

const today = new Date();
const todayStr = fmt(today);

function fmt(d) { return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function p(n) { return String(n).padStart(2, '0'); }
function uid() { return Math.random().toString(36).slice(2, 9); }
function save() { localStorage.setItem('ht2_habits', JSON.stringify(habits)); }

function hexA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
}

// Header date
document.getElementById('hDate').textContent =
    `${DAY_S[today.getDay()]}, ${MON_S[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

// ── Week strip ───────────────────────────────────────────────────────────────
function renderWeek() {
    const el = document.getElementById('weekStrip');
    el.innerHTML = '';
    const accent = habits[0]?.color || '#a855f7';
    document.documentElement.style.setProperty('--t-accent', accent);
    document.documentElement.style.setProperty('--t-accent-bg', hexA(accent, 0.12));

    const dow = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((dow + 6) % 7));

    for (let i = 0; i < 7; i++) {
        const d = new Date(mon); d.setDate(mon.getDate() + i);
        const ds = fmt(d);
        const isToday = ds === todayStr;
        const hasDone = habits.some(h => h.log?.[ds]);
        const pill = document.createElement('div');
        pill.className = 'day-pill' + (isToday ? ' today' : '') + (hasDone ? ' has-dot' : '');
        pill.innerHTML = `<div class="dp-name">${DAY_S[d.getDay()]}</div>
      <div class="dp-num">${d.getDate()}</div>
      <div class="dp-dot"></div>`;
        el.appendChild(pill);
    }
}

// ── Tracker grid (days=rows, weeks=cols) ─────────────────────────────────────
function buildTracker(habit) {
    const MAX_WEEKS = 18;
    const color = habit.color || '#a855f7';

    const start = new Date(habit.startDate || todayStr);
    const end = new Date(today);

    const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.ceil((diffDays + 1) / 7);

    // Build weeks[w][d] where d=0 is Monday

    const allWeeks = [];

    for (let w = 0; w < totalWeeks; w++) {
        const week = [];

        for (let d = 0; d < 7; d++) {
            const day = new Date(start);
            day.setDate(start.getDate() + w * 7 + d);

            if (day > end) break;

            const ds = fmt(day);

            week.push({
                ds,
                day,
                done: !!(habit.log?.[ds])
            });
        }

        allWeeks.push(week);
    }

    // 🔥 IMPORTANT LINE (sliding window)
    const weeks = allWeeks.slice(-MAX_WEEKS);

    const wrap = document.createElement('div');
    wrap.className = 'tracker-inner';

    // Left: day labels (M blank W blank F blank S)
    const lbls = document.createElement('div');
    lbls.className = 'tracker-day-labels';
    ['M', '', 'W', '', 'F', '', 'S'].forEach(t => {
        const el = document.createElement('div');
        el.className = 'day-label-txt';
        el.textContent = t;
        lbls.appendChild(el);
    });

    // Right: months + cols
    const area = document.createElement('div');
    area.className = 'tracker-cols-area';

    // Month labels row
    const mrow = document.createElement('div');
    mrow.className = 'tracker-months';
    let lastM = -1;
    weeks.forEach((week, wi) => {
        const m = week[0].day.getMonth();
        if (m !== lastM) {
            const lbl = document.createElement('div');
            lbl.className = 'month-lbl';
            lbl.style.left = `${wi * 14}px`;
            lbl.textContent = `${MON_S[m]} '${String(week[0].day.getFullYear()).slice(2)}`;
            mrow.appendChild(lbl);
            lastM = m;
        }
    });

    // Cell grid
    const cols = document.createElement('div');
    cols.className = 'tracker-cols';
    weeks.forEach(week => {
        const col = document.createElement('div');
        col.className = 'tracker-week';
        week.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 't-cell';
            if (day.done) {
                cell.style.background = color;
                cell.style.opacity = '0.9';
            } else if (day.ds === todayStr) {
                cell.style.background = 'transparent';
                cell.style.border = `1.5px solid ${color}`;
            }
            cell.title = day.ds;
            col.appendChild(cell);
        });
        cols.appendChild(col);
    });

    area.appendChild(mrow);
    area.appendChild(cols);
    wrap.appendChild(lbls);
    wrap.appendChild(area);
    return wrap;
}

// ── Streak ───────────────────────────────────────────────────────────────────
function getStreak(habit) {
    let s = 0, d = new Date(today);
    while (habit.log?.[fmt(d)]) { s++; d.setDate(d.getDate() - 1); }
    return s;
}

// ── Render habits ─────────────────────────────────────────────────────────────
function renderHabits() {
    const list = document.getElementById('habitsList');
    list.innerHTML = '';

    if (!habits.length) {
        list.innerHTML = `<div class="empty"><div class="empty-icon">🌱</div><p>No habits yet.<br>Tap "Add New Habit" to begin!</p></div>`;
        renderWeek(); return;
    }

    habits.forEach(habit => {
        const done = !!(habit.log?.[todayStr]);
        const streak = getStreak(habit);
        const color = habit.color || '#a855f7';

        const card = document.createElement('div');
        card.className = 'habit-card' + (done ? ' done' : '');

        // HEAD
        const head = document.createElement('div');
        head.className = 'habit-head';

        const icon = document.createElement('div');
        icon.className = 'habit-icon';
        icon.style.background = hexA(color, 0.22);
        icon.textContent = habit.emoji || '❤️';

        const mid = document.createElement('div');
        mid.className = 'habit-mid';
        mid.innerHTML = `<div class="habit-name">${habit.name}</div>
      <div class="habit-streak">${streak > 0 ? '🔥' : '○'} Streak: ${streak}</div>`;

        const chk = document.createElement('div');
        chk.className = 'habit-check-btn' + (done ? ' checked' : '');
        chk.style.background = done ? hexA(color, 0.9) : 'transparent';
        chk.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3.5 10l4.5 4.5 8.5-8.5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
        chk.addEventListener('click', () => toggleHabit(habit.id));

        const menu = document.createElement('div');
        menu.className = 'habit-menu-btn';
        menu.innerHTML = '···';
        menu.addEventListener('click', e => { e.stopPropagation(); openMenu(habit.id, menu); });

        head.appendChild(icon);
        head.appendChild(mid);
        head.appendChild(chk);
        head.appendChild(menu);

        // TRACKER
        const tw = document.createElement('div');
        tw.className = 'tracker-wrap';
        tw.appendChild(buildTracker(habit));

        card.appendChild(head);
        card.appendChild(tw);
        list.appendChild(card);
    });

    renderWeek();
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function toggleHabit(id) {
    const h = habits.find(h => h.id === id);
    if (!h) return;
    if (!h.log) h.log = {};
    if (h.log[todayStr]) delete h.log[todayStr];
    else h.log[todayStr] = true;
    save(); renderHabits();
}

// ── Menu ──────────────────────────────────────────────────────────────────────
function openMenu(id, btn) {
    closeMenu();
    if (openMenuId === id) { openMenuId = null; return; }
    openMenuId = id;
    const dd = document.createElement('div');
    dd.className = 'dropdown'; dd.id = 'openDD';
    dd.innerHTML = `<div class="dd-item" data-a="edit">✏️ &nbsp;Edit</div>
    <div class="dd-item danger" data-a="del">🗑️ &nbsp;Delete</div>`;
    dd.addEventListener('click', e => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        closeMenu();
        if (a === 'edit') doEdit(id);
        if (a === 'del') doConfirm(id);
    });
    btn.appendChild(dd);
}
function closeMenu() { document.getElementById('openDD')?.remove(); openMenuId = null; }
document.addEventListener('click', closeMenu);

// ── Modal ─────────────────────────────────────────────────────────────────────
const overlay = document.getElementById('modalOverlay');
const habitInput = document.getElementById('habitInput');

function openModal(title) {
    document.getElementById('modalTitle').textContent = title;
    renderEmojiPicker(); renderColorPicker();
    overlay.classList.add('open');
    setTimeout(() => habitInput.focus(), 300);
}
function closeModal() {
    overlay.classList.remove('open');
    habitInput.value = ''; editId = null;
    selEmoji = '❤️'; selColor = '#f43f5e';
}

document.getElementById('addBtn').addEventListener('click', () => { editId = null; openModal('New Habit'); });
document.getElementById('btnCancel').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

document.getElementById('btnSave').addEventListener('click', () => {
    const name = habitInput.value.trim();
    if (!name) { habitInput.style.borderColor = '#f87171'; setTimeout(() => habitInput.style.borderColor = '', 1200); return; }
    if (editId) {
        const h = habits.find(h => h.id === editId);
        if (h) { h.name = name; h.emoji = selEmoji; h.color = selColor; }
    } else {
        habits.push({
            id: uid(),
            name,
            emoji: selEmoji,
            color: selColor,
            log: {},
            startDate: todayStr // ✅ ADD THIS
        });
    }
    save(); renderHabits(); closeModal();
});
habitInput.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btnSave').click(); });

function doEdit(id) {
    const h = habits.find(h => h.id === id);
    if (!h) return;
    editId = id; habitInput.value = h.name;
    selEmoji = h.emoji || '❤️'; selColor = h.color || '#f43f5e';
    openModal('Edit Habit');
}

function doConfirm(id) { deleteId = id; document.getElementById('confirmOverlay').classList.add('open'); }
document.getElementById('confirmNo').addEventListener('click', () => { document.getElementById('confirmOverlay').classList.remove('open'); deleteId = null; });
document.getElementById('confirmYes').addEventListener('click', () => {
    if (deleteId) { habits = habits.filter(h => h.id !== deleteId); save(); renderHabits(); }
    document.getElementById('confirmOverlay').classList.remove('open'); deleteId = null;
});

// ── Emoji picker ──────────────────────────────────────────────────────────────
function renderEmojiPicker() {
    const p = document.getElementById('emojiPicker');
    p.innerHTML = '';
    document.documentElement.style.setProperty('--sel-color', selColor);
    EMOJIS.forEach(em => {
        const b = document.createElement('div');
        b.className = 'emoji-opt' + (em === selEmoji ? ' sel' : '');
        b.textContent = em;
        b.addEventListener('click', () => { selEmoji = em; renderEmojiPicker(); });
        p.appendChild(b);
    });
}

// ── Color picker ──────────────────────────────────────────────────────────────
function renderColorPicker() {
    const p = document.getElementById('colorPicker');
    p.innerHTML = '';
    document.documentElement.style.setProperty('--sel-color', selColor);
    COLORS.forEach((c, i) => {
        const s = document.createElement('div');
        s.className = 'color-sw' + (c === selColor ? ' sel' : '');
        s.style.background = c;
        s.style.setProperty('--sw-col', c);
        s.title = COLOR_NAMES[i] || c;
        s.addEventListener('click', () => {
            selColor = c;
            document.documentElement.style.setProperty('--sel-color', c);
            renderColorPicker();
            renderEmojiPicker(); // update emoji sel border color
        });
        p.appendChild(s);
    });
}

// ── Settings ──────────────────────────────────────────────────────────────────
document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.add('open');
    document.getElementById('settingsOverlay').classList.add('open');
});
function closeSettings() {
    document.getElementById('settingsPanel').classList.remove('open');
    document.getElementById('settingsOverlay').classList.remove('open');
}
document.getElementById('settingsClose').addEventListener('click', closeSettings);
document.getElementById('settingsOverlay').addEventListener('click', closeSettings);

// ── Init ──────────────────────────────────────────────────────────────────────
renderEmojiPicker();
renderColorPicker();
renderHabits();