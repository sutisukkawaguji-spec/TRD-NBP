// ============================================================
// 🩹 app_patch.js — Functions missing from app.js
//    โหลดหลัง app.js เสมอ
// ============================================================

// --- Alias: renderStaffList -> renderStaffTable ---
function renderStaffList(users) {
    const map = {};
    (users || []).forEach(u => {
        const uid = String(u.lineId || u.userId || u.id || '');
        if (uid) map[uid] = u;
    });
    if (typeof renderStaffTable === 'function') renderStaffTable(map);
}

// --- drawPremiumRadar ---
function drawPremiumRadar(ctxId, data, isAlumniFlag, options) {
    options = options || {};
    const ctx = document.getElementById(ctxId);
    if (!ctx) return;
    if (window['chart_' + ctxId]) { window['chart_' + ctxId].destroy(); delete window['chart_' + ctxId]; }
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)';
    const labelColor = isDark ? '#eee' : '#666';
    const mainColor = isAlumniFlag ? '#f1c40f' : '#6c5ce7';
    const bgColor = isAlumniFlag ? 'rgba(241,196,15,0.2)' : 'rgba(108,92,231,0.2)';
    const showLabels = options.showLabels !== false;
    window['chart_' + ctxId] = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: showLabels ? ['จิตอาสา', 'พอเพียง', 'วินัย', 'สุจริต', 'กตัญญู'] : ['','','','',''],
            datasets: [{ data: data || [0,0,0,0,0], backgroundColor: bgColor, borderColor: mainColor, borderWidth: 3, pointBackgroundColor: mainColor, fill: true, tension: 0.2 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { r: { suggestedMin: 0, ticks: { display: false }, grid: { color: gridColor }, angleLines: { color: gridColor }, pointLabels: { display: showLabels, color: labelColor, font: { size: 11, weight: '700' } } } },
            plugins: { legend: { display: false } },
            animation: { duration: 800 }
        }
    });
}

// --- filterRelationStaff ---
function filterRelationStaff() {
    const q = (document.getElementById('relationSearch')?.value || '').toLowerCase();
    document.querySelectorAll('.hof-card').forEach(el => {
        el.style.display = el.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

// --- selectAllFriends ---
function selectAllFriends() {
    const items = document.querySelectorAll('.friend-item');
    const allSelected = Array.from(items).every(el => el.classList.contains('selected'));
    items.forEach(el => { if (allSelected) el.classList.remove('selected'); else el.classList.add('selected'); });
}

// --- closeNotifPanel / markAllNotifRead / readNotif ---
function closeNotifPanel() {
    document.getElementById('notifPanel')?.classList.remove('show');
    document.getElementById('notifBackdrop')?.classList.remove('show');
}

function markAllNotifRead() {
    (appNotifications || []).forEach(n => { if (n.id) localStorage.setItem('notif_read_' + n.id, 'true'); });
    if (typeof renderNotifList === 'function') renderNotifList();
    else document.getElementById('notifBadge') && (document.getElementById('notifBadge').style.display = 'none');
}

function readNotif(id) {
    localStorage.setItem('notif_read_' + id, 'true');
    const item = (appNotifications || []).find(n => n.id === id);
    closeNotifPanel();
    if (item) {
        Swal.fire({ title: item.title, html: '<div class="text-start">' + (item.body || '') + '</div>', confirmButtonText: 'ปิด', confirmButtonColor: '#6c5ce7' });
    }
}

function renderNotifList() {
    const list = document.getElementById('notifList');
    if (!list) return;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    let html = '', unread = 0;
    (appNotifications || []).sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(n => {
        const isUpcoming = n.date && n.date >= today;
        const isRead = localStorage.getItem('notif_read_' + n.id);
        if (!isRead && isUpcoming) unread++;
        const color = (CATEGORY_COLORS || {})[n.category] || '#636e72';
        html += `<div class="notif-item ${isUpcoming ? '' : 'opacity-75'}" style="border-left:4px solid ${!isRead && isUpcoming ? color : 'transparent'};" onclick="readNotif('${n.id}')">
            <div class="fw-bold small">${n.title}</div>
            <div class="text-muted" style="font-size:0.8rem">${n.body || ''}</div>
            <div class="text-muted mt-1" style="font-size:0.7rem">${n.date || ''}</div>
        </div>`;
    });
    list.innerHTML = html || '<div class="notif-empty-state"><div class="notif-empty-icon">🔕</div><div class="notif-empty-text">ยังไม่มีการแจ้งเตือน</div></div>';
    const badge = document.getElementById('notifBadge');
    if (badge) { badge.style.display = unread > 0 ? 'flex' : 'none'; badge.innerText = unread > 9 ? '9+' : unread; }
    const sub = document.getElementById('notifSubtitle');
    if (sub) sub.innerText = (appNotifications || []).length + ' รายการ';
}

// --- fetchAnnouncements ---
async function fetchAnnouncements(silent) {
    try {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            const { data } = await supabaseClient.from('Announcements').select('*').eq('Status', 'active').order('Date', { ascending: false }).limit(50);
            const items = (data || []).map(a => ({
                id: a.ID || a.id, title: a.Title || a.title, body: a.Body || a.body,
                date: a.EventDate || a.Date || a.date, category: a.Category || 'general',
                displayDate: a.EventDate || a.Date, source: 'supabase'
            }));
            appNotifications = items;
            renderNotifList();
            return;
        }
    } catch(e) { console.warn('fetchAnnouncements error:', e); }
}

// --- updateStatAnalysis ---
function updateStatAnalysis(dataPoints) {
    const titles = ['จิตอาสา','พอเพียง','วินัย','สุจริต','กตัญญู'];
    if (!dataPoints || dataPoints.every(v => v === 0)) {
        const el = document.getElementById('statTitle');
        const el2 = document.getElementById('statDesc');
        if (el) el.innerText = '🌱 เริ่มต้นสะสมพลังความดี';
        if (el2) el2.innerText = 'บันทึกกิจกรรมครั้งแรกเพื่อสร้างแผนที่ความดีของคุณ';
        return;
    }
    let maxIdx = 0;
    dataPoints.forEach((v, i) => { if (v > dataPoints[maxIdx]) maxIdx = i; });
    const label = titles[maxIdx];
    const el = document.getElementById('statTitle');
    const el2 = document.getElementById('statDesc');
    if (el) el.innerText = '⭐ พลังเด่น: ' + label;
    if (el2) el2.innerText = typeof getVirtueDescription === 'function' ? getVirtueDescription(['volunteer','sufficiency','discipline','integrity','gratitude'][maxIdx]) : '';
}

// --- openReportModal / closeReportModal / generateMonthlyReport ---
async function openReportModal() {
    document.getElementById('reportModalBackdrop').style.display = 'block';
    document.getElementById('reportModal').style.display = 'block';
    if (typeof generateMonthlyReport === 'function') generateMonthlyReport();
}

function closeReportModal() {
    document.getElementById('reportModalBackdrop').style.display = 'none';
    document.getElementById('reportModal').style.display = 'none';
}

window.generateMonthlyReport = function() {
    const month = document.getElementById('reportMonthSelect')?.value || 'all';
    const content = document.getElementById('reportContentArea');
    if (!content) return;
    let feed = window.globalFeedData || [];
    if (month && month !== 'all') {
        const [y, m] = month.split('-');
        feed = feed.filter(p => { const d = new Date(p.timestamp); return d.getFullYear() == y && (d.getMonth()+1) == m; });
    }
    const approved = feed.filter(p => p.status === 'approved' || Number(p.score) > 0);
    const teamwork = approved.filter(p => String(p.taggedFriends || '').trim().length > 0);
    content.innerHTML = `<div class="p-2 text-start">
        <div class="row g-2 mb-3">
            <div class="col-6"><div class="bg-light p-3 rounded-4 text-center border"><div class="small text-muted">กิจกรรมสำเร็จ</div><h3 class="text-primary fw-bold">${approved.length}</h3></div></div>
            <div class="col-6"><div class="bg-light p-3 rounded-4 text-center border"><div class="small text-muted">กิจกรรมร่วม</div><h3 class="text-info fw-bold">${approved.length > 0 ? Math.round(teamwork.length/approved.length*100) : 0}%</h3></div></div>
        </div>
        <div class="text-muted small text-center">รวม ${feed.length} รายการในช่วงที่เลือก</div>
    </div>`;
};

// --- Reward Modal functions ---
window.openAddRewardModal = function() {
    ['rewardName','rewardImageUrl','rewardImage','rewardTargetVal','rewardEndDate','editRewardId'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    window.currentRewardFile = null;
    const pc = document.getElementById('rewardImagePreviewContainer'); if (pc) pc.style.display = 'none';
    const mo = document.getElementById('rewardMode'); if (mo) { mo.value = '1'; mo.disabled = false; }
    document.getElementById('rewardModalBackdrop').style.display = 'block';
    document.getElementById('rewardModal').style.display = 'block';
    if (typeof toggleRewardModeFields === 'function') toggleRewardModeFields();
};

window.closeRewardModal = function() {
    document.getElementById('rewardModalBackdrop').style.display = 'none';
    document.getElementById('rewardModal').style.display = 'none';
};

window.toggleRewardModeFields = function() {
    const mode = document.getElementById('rewardMode')?.value;
    const label = document.getElementById('rewardTargetLabel');
    const help = document.getElementById('rewardModeHelp');
    if (label) label.innerHTML = mode === '1' ? 'เป้าหมายคะแนนรวม (Lifetime XP)' : 'คะแนนใหม่ที่ต้องสะสม (+XP)';
    if (help) help.innerHTML = mode === '1' ? 'นับคะแนนสะสมรวมทั้งหมด' : 'นับเฉพาะคะแนนใหม่หลังสร้างกิจกรรม';
};

window.removeRewardImage = function() {
    window.currentRewardFile = null;
    ['rewardImage','rewardImageUrl'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const p = document.getElementById('rewardImagePreview'); if (p) p.src = '';
    const c = document.getElementById('rewardImagePreviewContainer'); if (c) c.style.display = 'none';
};

window.editReward = function(id) {
    const r = (window.globalRewardsData || []).find(x => x.id === id); if (!r) return;
    const nameEl = document.getElementById('rewardName'); if (nameEl) nameEl.value = r.name;
    const urlEl = document.getElementById('rewardImageUrl'); if (urlEl) urlEl.value = r.image || '';
    const modeEl = document.getElementById('rewardMode'); if (modeEl) { modeEl.value = r.mode; modeEl.disabled = true; }
    const targetEl = document.getElementById('rewardTargetVal'); if (targetEl) targetEl.value = r.targetVal;
    const editIdEl = document.getElementById('editRewardId'); if (editIdEl) editIdEl.value = r.id;
    const preview = document.getElementById('rewardImagePreview');
    const previewContainer = document.getElementById('rewardImagePreviewContainer');
    if (r.image && preview && previewContainer) { preview.src = r.image; previewContainer.style.display = 'block'; }
    document.getElementById('rewardModalBackdrop').style.display = 'block';
    document.getElementById('rewardModal').style.display = 'block';
    if (typeof toggleRewardModeFields === 'function') toggleRewardModeFields();
};

window.saveReward = async function() {
    const name = document.getElementById('rewardName')?.value.trim();
    const mode = document.getElementById('rewardMode')?.value || '1';
    const targetVal = document.getElementById('rewardTargetVal')?.value;
    const endDate = document.getElementById('rewardEndDate')?.value || '';
    const editId = document.getElementById('editRewardId')?.value || '';
    if (!name || !targetVal) { Swal.fire('แจ้งเตือน', 'กรุณากรอกชื่อและคะแนนเป้าหมาย', 'warning'); return; }
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
        let finalImageUrl = document.getElementById('rewardImageUrl')?.value || '';
        if (window.currentRewardFile && typeof uploadImageToCloudinary === 'function') {
            const uploaded = await uploadImageToCloudinary(window.currentRewardFile);
            if (uploaded) finalImageUrl = uploaded;
        }
        if (supabaseClient) {
            const now = new Date();
            const rwId = editId || ('rw_' + Date.now());
            await supabaseClient.from('Rewards').upsert({ ID: rwId, Name: name, Mode: mode, TargetVal: Number(targetVal), EndDate: endDate || null, Image: finalImageUrl, Status: 'active', Date: now.toISOString().split('T')[0], Time: now.toTimeString().split(' ')[0] });
            window.currentRewardFile = null;
            Swal.fire('สำเร็จ', editId ? 'แก้ไขรางวัลเรียบร้อย' : 'เพิ่มรางวัลใหม่แล้ว', 'success');
            if (typeof closeRewardModal === 'function') closeRewardModal();
            if (typeof fetchRewards === 'function') fetchRewards();
        }
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
};

window.deleteReward = function(id) {
    Swal.fire({ title: 'ยืนยันการลบ?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' }).then(async r => {
        if (r.isConfirmed && supabaseClient) {
            try {
                await supabaseClient.from('Claims').delete().eq('RewardID', id);
                await supabaseClient.from('Rewards').delete().eq('ID', id);
                Swal.fire('ลบสำเร็จ', '', 'success');
                if (typeof fetchRewards === 'function') fetchRewards();
            } catch(e) { Swal.fire('Error', e.message, 'error'); }
        }
    });
};

window.claimReward = function(id) {
    if (!window.currentUser) return;
    Swal.fire({ title: 'ยืนยันการรับรางวัล 🎉', showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#ff9f43' }).then(async r => {
        if (r.isConfirmed && supabaseClient) {
            try {
                const now = new Date();
                await supabaseClient.from('Claims').insert({ RewardID: id, UserID: window.currentUser.userId, UserName: window.currentUser.name, Date: now.toISOString().split('T')[0], Time: now.toTimeString().split(' ')[0], Status: 'pending' });
                Swal.fire('สำเร็จ', 'แจ้งรับรางวัลแล้ว Admin จะติดต่อกลับ', 'success');
                if (typeof fetchRewards === 'function') fetchRewards();
            } catch(e) { Swal.fire('Error', e.message, 'error'); }
        }
    });
};

window.openRewardBox = function(id) {
    const r = (window.globalRewardsData || []).find(x => x.id === id); if (!r) return;
    Swal.fire({
        html: `<div class="text-center"><div style="font-size:5rem">🎁</div><h5>${r.name}</h5><p class="text-muted small">เป้าหมาย ${r.targetVal} XP</p></div>`,
        showCancelButton: true, confirmButtonText: 'แจ้งรับรางวัล', cancelButtonText: 'ปิด', confirmButtonColor: '#ff9f43'
    }).then(res => { if (res.isConfirmed) window.claimReward(id); });
};

window.renderExecutiveRewards = function() {
    const list = document.getElementById('executiveRewardList'); if (!list) return;
    const rewards = window.globalRewardsData || [];
    if (!rewards.length) { list.innerHTML = '<div class="text-center text-muted small py-3">ยังไม่ได้ตั้งของรางวัล</div>'; return; }
    list.innerHTML = rewards.map(r => {
        const claims = (window.globalClaimsData || []).filter(c => c.rewardId === r.id);
        return `<div class="d-flex align-items-center p-2 rounded-3 border shadow-sm bg-white mb-2" style="gap:10px;">
            <div style="min-width:40px;height:40px;border-radius:8px;background:#f8f8f8;display:flex;align-items:center;justify-content:center;">${r.image ? `<img src="${r.image}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;">` : '🎁'}</div>
            <div class="flex-grow-1"><div class="fw-bold small">${r.name}</div><div class="text-muted" style="font-size:0.75rem">เป้า: ${r.targetVal} XP | ผู้แจ้งรับ: ${claims.length} คน</div></div>
            <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="editReward('${r.id}')" style="width:28px;height:28px;padding:0"><i class="fas fa-pen" style="font-size:0.65rem"></i></button>
                <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="deleteReward('${r.id}')" style="width:28px;height:28px;padding:0"><i class="fas fa-trash-alt" style="font-size:0.65rem"></i></button>
            </div>
        </div>`;
    }).join('');
};

// --- checkAndShowWeatherAlert ---
function checkAndShowWeatherAlert(manual) {
    if (manual) {
        Swal.fire({ title: '🌤️ สภาพอากาศ', text: 'ฟีเจอร์นี้ต้องการการตั้งค่า API Key เพิ่มเติม', icon: 'info', confirmButtonText: 'เข้าใจแล้ว' });
    }
}

// --- doLogout ---
function doLogout() {
    Swal.fire({ title: 'ออกจากระบบ?', icon: 'question', showCancelButton: true, confirmButtonText: 'ออก', cancelButtonText: 'ยกเลิก' }).then(r => {
        if (r.isConfirmed) {
            if (typeof liff !== 'undefined') { try { liff.logout(); } catch(e) {} }
            localStorage.removeItem('currentUser');
            location.reload();
        }
    });
}

// --- Image event listener for reward ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('rewardImage')?.addEventListener('change', function(e) {
        const file = e.target.files[0]; if (!file) return;
        window.currentRewardFile = file;
        const reader = new FileReader();
        reader.onload = evt => {
            const preview = document.getElementById('rewardImagePreview');
            const container = document.getElementById('rewardImagePreviewContainer');
            if (preview && container) { preview.src = evt.target.result; container.style.display = 'block'; }
        };
        reader.readAsDataURL(file);
    });

    // Scroll to top button
    window.addEventListener('scroll', () => {
        const btn = document.getElementById('scrollToTopBtn');
        if (btn) btn.classList.toggle('show', window.scrollY > 400);
    });

    // HMI Scroll buttons
    window.updateChartScrollButtons = function() {
        const w = document.getElementById('hmiScrollWrapper');
        const l = document.getElementById('hmiScrollBtnLeft');
        const r = document.getElementById('hmiScrollBtnRight');
        if (!w || !l || !r) return;
        l.style.display = w.scrollLeft > 5 ? 'flex' : 'none';
        r.style.display = w.scrollLeft < (w.scrollWidth - w.clientWidth - 5) ? 'flex' : 'none';
    };

    window.scrollHMI = function(dir) {
        const w = document.getElementById('hmiScrollWrapper'); if (!w) return;
        w.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
    };

    // Dark mode icon init
    const theme = localStorage.getItem('theme') || 'light';
    const icon = document.querySelector('#darkModeToggle i');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-sun text-warning' : 'fas fa-moon';

    // Viewport height fix
    function setVH() { document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px'); }
    window.addEventListener('resize', setVH);
    setVH();
});

// --- toggleDarkMode ---
function toggleDarkMode() {
    const root = document.documentElement;
    const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    const icon = document.querySelector('#darkModeToggle i');
    if (icon) icon.className = newTheme === 'dark' ? 'fas fa-sun text-warning' : 'fas fa-moon';
}

// --- toggleMusic ---
let userMutedMusic = true;
function toggleMusic() {
    const bgMusic = document.getElementById('bgMusic'); if (!bgMusic) return;
    const toggleBtn = document.getElementById('musicToggle');
    const icon = toggleBtn?.querySelector('i');
    if (bgMusic.paused) {
        userMutedMusic = false;
        bgMusic.play().then(() => {
            if (icon) icon.className = 'fas fa-music text-primary';
            toggleBtn?.classList.add('music-playing');
        }).catch(e => { Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: '🔇 เบราว์เซอร์บล็อกเสียง', timer: 2000, showConfirmButton: false }); });
    } else {
        userMutedMusic = true;
        bgMusic.pause();
        if (icon) icon.className = 'fas fa-volume-mute text-muted';
        toggleBtn?.classList.remove('music-playing');
    }
}

// --- renderAnnouncement (announcement area) ---
function renderAnnouncement(config) {
    const area = document.getElementById('announcementArea'); if (!area) return;
    const items = (config && (config.announcements || config.notifications)) || [];
    const today = new Date().toISOString().split('T')[0];
    const upcoming = items.filter(a => (a.date || a.eventDate || '') >= today && !localStorage.getItem('hide_ann_' + a.id));
    if (!upcoming.length) { area.style.display = 'none'; return; }
    area.innerHTML = upcoming.slice(0, 3).map(a => {
        const id = a.id || 'ann_' + a.title;
        const color = (CATEGORY_COLORS || {})[a.category] || '#636e72';
        return `<div class="announcement-box animate__animated animate__fadeInDown" style="border-left-color:${color};" id="ann-box-${id}">
            <span class="announcement-close" onclick="closeAnnouncementItem('${id}')">&times;</span>
            <div class="fw-bold small">${a.title}</div>
            <div class="text-muted" style="font-size:0.75rem">${a.body || ''}</div>
        </div>`;
    }).join('');
    area.style.display = 'block';
}

function closeAnnouncementItem(id) {
    localStorage.setItem('hide_ann_' + id, 'true');
    const el = document.getElementById('ann-box-' + id);
    if (el) { el.remove(); if (!document.querySelectorAll('.announcement-box').length) document.getElementById('announcementArea').style.display = 'none'; }
}

// --- cacheUsers (used by renderRelationTab fallback) ---
async function cacheUsers() {
    if (!supabaseClient) return;
    try {
        const { data } = await supabaseClient.from('Users').select('*');
        (data || []).forEach(u => {
            const uid = String(u.LineID || '');
            if (!uid) return;
            allUsersMap[uid] = { lineId: uid, name: u.Name, img: u.Image, role: u.Role || 'Staff', score: u.Score || 0 };
        });
    } catch(e) { console.warn('cacheUsers error:', e); }
}

console.log('✅ app_patch.js loaded');
