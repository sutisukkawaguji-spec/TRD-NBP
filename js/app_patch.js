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

// --- closeNotifPanel ---
function closeNotifPanel() {
    document.getElementById('notifPanel')?.classList.remove('show');
    document.getElementById('notifBackdrop')?.classList.remove('show');
}

// NOTE: markAllNotifRead, readNotif, renderNotifList, fetchAnnouncements are defined in notifications.js
// Do NOT override them here.

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
    // รองรับทั้ง uppercase (Supabase) และ lowercase (cache เก่า)
    const r = (window.globalRewardsData || []).find(x => (x.ID || x.id) === id); if (!r) return;
    const nameEl = document.getElementById('rewardName'); if (nameEl) nameEl.value = r.Name || r.name || '';
    const urlEl = document.getElementById('rewardImageUrl'); if (urlEl) urlEl.value = r.Image || r.image || '';
    const modeEl = document.getElementById('rewardMode'); if (modeEl) { modeEl.value = r.Mode || r.mode || '1'; modeEl.disabled = true; }
    const targetEl = document.getElementById('rewardTargetVal'); if (targetEl) targetEl.value = r.TargetVal || r.targetVal || '';
    const editIdEl = document.getElementById('editRewardId'); if (editIdEl) editIdEl.value = r.ID || r.id || '';
    const preview = document.getElementById('rewardImagePreview');
    const previewContainer = document.getElementById('rewardImagePreviewContainer');
    const img = r.Image || r.image || '';
    if (img && preview && previewContainer) { preview.src = img; previewContainer.style.display = 'block'; }
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
    const r = (window.globalRewardsData || []).find(x => (x.ID || x.id) === id); if (!r) return;
    const rname = r.Name || r.name || '';
    const rtarget = r.TargetVal || r.targetVal || 100;
    Swal.fire({
        html: `<div class="text-center"><div style="font-size:5rem">&#127873;</div><h5>${rname}</h5><p class="text-muted small">เป้าหมาย ${Number(rtarget).toLocaleString()} XP</p></div>`,
        showCancelButton: true, confirmButtonText: 'แจ้งรับรางวัล', cancelButtonText: 'ปิด', confirmButtonColor: '#ff9f43'
    }).then(res => { if (res.isConfirmed) window.claimReward(id); });
};

window.renderExecutiveRewards = function() {
    const list = document.getElementById('executiveRewardList'); if (!list) return;
    const rewards = window.globalRewardsData || [];
    if (!rewards.length) { 
        list.innerHTML = '<div class="text-center text-muted small py-3"><i class="fas fa-gift opacity-50 me-2"></i>ยังไม่ได้ตั้งของรางวัล</div>'; 
        return; 
    }
    const allClaims = window.globalClaimsData || [];
    list.innerHTML = rewards.map(r => {
        // รองรับทั้ง uppercase (Supabase) และ lowercase (cache)
        const rid = r.ID || r.id || '';
        const rname = r.Name || r.name || 'ไม่มีชื่อ';
        const rimage = r.Image || r.image || '';
        const rtarget = r.TargetVal || r.targetVal || 100;
        const rmode = r.Mode || r.mode || 1;
        const rdesc = r.Description || r.description || '';
        const claims = allClaims.filter(c => (c.rewardId === rid));
        const pendingClaims = claims.filter(c => c.status === 'pending' || !c.status);
        const modeLabel = String(rmode) === '1' ? '📊 คะแนนสะสม' : '⏩ คะแนนใหม่';
        return `<div class="p-3 rounded-4 border shadow-sm mb-2" style="background:var(--glass-bg);">
            <div class="d-flex align-items-center gap-3">
                <div style="min-width:48px;height:48px;border-radius:10px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                    ${rimage ? `<img src="${rimage}" style="width:48px;height:48px;object-fit:cover;">` : '<span style="font-size:1.8rem;">&#127873;</span>'}
                </div>
                <div class="flex-grow-1" style="min-width:0;">
                    <div class="fw-bold text-truncate">${rname}</div>
                    <div class="text-muted" style="font-size:0.75rem;">${modeLabel} | เป้า: <b>${Number(rtarget).toLocaleString()} XP</b> | แจ้งรับ: <b>${claims.length}</b> คน${pendingClaims.length > 0 ? ` <span class="badge bg-warning text-dark" style="font-size:0.65rem;">${pendingClaims.length} รอ</span>` : ''}</div>
                </div>
                <div class="d-flex gap-1 flex-shrink-0">
                    <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="editReward('${rid}')" style="width:30px;height:30px;padding:0;">
                        <i class="fas fa-pen" style="font-size:0.65rem;"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="deleteReward('${rid}')" style="width:30px;height:30px;padding:0;">
                        <i class="fas fa-trash-alt" style="font-size:0.65rem;"></i>
                    </button>
                </div>
            </div>
            ${pendingClaims.length > 0 ? `
            <div class="mt-2 pt-2 border-top">
                <div class="small text-muted mb-1">รออนุมัติ:</div>
                ${pendingClaims.slice(0,3).map(c => `<div class="d-flex justify-content-between align-items-center p-1 rounded bg-light mb-1">
                    <small class="fw-bold">${c.userId || c.UserID || ''}</small>
                    <button class="btn btn-xs btn-success rounded-pill" style="font-size:0.65rem;padding:2px 8px;" onclick="approveClaim('${c.id || ''}','${rid}')"><i class="fas fa-check me-1"></i>อนุมัติ</button>
                </div>`).join('')}
            </div>` : ''}
        </div>`;
    }).join('');
};

// --- approveClaim: Admin อนุมัติการรับรางวัล ---
window.approveClaim = async function(claimId, rewardId) {
    if (!supabaseClient) return;
    const res = await Swal.fire({ title: 'อนุมัติการแจ้งรับ?', icon: 'question', showCancelButton: true, confirmButtonText: 'อนุมัติ', cancelButtonText: 'ยกเลิก' });
    if (!res.isConfirmed) return;
    try {
        // ถ้ามี id ให้อัปเดตตาม id, ถ้าไม่มี id ให้ filter ตาม RewardID + UserID
        if (claimId) {
            await supabaseClient.from('Claims').update({ Status: 'approved' }).eq('id', claimId);
        } else {
            await supabaseClient.from('Claims').update({ Status: 'approved' }).eq('RewardID', rewardId);
        }
        Swal.fire({ toast: true, icon: 'success', title: 'อนุมัติสำเร็จ', position: 'top', timer: 2000, showConfirmButton: false });
        if (typeof fetchRewards === 'function') fetchRewards();
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
};

// --- checkAndShowWeatherAlert ---
var WEATHER_API_KEY = '0327003ee31fbf98951434c6b2fcea7d';
var DEFAULT_CITY = 'Nong Bua Lam Phu';

async function checkAndShowWeatherAlert(manual) {
    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(DEFAULT_CITY)}&appid=${WEATHER_API_KEY}&units=metric&lang=th`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather API error: ' + res.status);
        const data = await res.json();
        const temp = Math.round(data.main?.temp || 0);
        const feelsLike = Math.round(data.main?.feels_like || 0);
        const humidity = data.main?.humidity || 0;
        const desc = data.weather?.[0]?.description || '';
        const icon = data.weather?.[0]?.icon || '01d';
        const windSpeed = Math.round((data.wind?.speed || 0) * 3.6); // m/s -> km/h
        const cityName = data.name || DEFAULT_CITY;
        const isHot = temp >= 35;
        const isRainy = (data.weather?.[0]?.main || '').toLowerCase().includes('rain');
        const alertColor = isHot ? '#e17055' : (isRainy ? '#0984e3' : '#00b894');
        const alertIcon = isHot ? '☀️🌡️' : (isRainy ? '🌧️' : '⛅');
        if (manual) {
            Swal.fire({
                title: `${alertIcon} สภาพอากาศวันนี้`,
                html: `
                    <div class="text-start p-2">
                        <div class="mb-2" style="font-size:1.1rem;">
                            <img src="https://openweathermap.org/img/wn/${icon}@2x.png" style="width:50px;vertical-align:middle;">
                            <b style="color:${alertColor};font-size:1.5rem;">${temp}°C</b>
                            <small class="text-muted">(รู้สึกเหมือน ${feelsLike}°C)</small>
                        </div>
                        <div class="mb-1"><i class="fas fa-map-marker-alt text-danger me-2"></i><b>${cityName}</b></div>
                        <div class="mb-1"><i class="fas fa-cloud me-2 text-info"></i>${desc}</div>
                        <div class="mb-1"><i class="fas fa-tint me-2 text-primary"></i>ความชื้น: <b>${humidity}%</b></div>
                        <div class="mb-1"><i class="fas fa-wind me-2 text-secondary"></i>ลม: <b>${windSpeed} กม./ชม.</b></div>
                        ${isHot ? '<div class="mt-2 p-2 rounded" style="background:#fff3f3;"><i class="fas fa-exclamation-triangle text-danger me-1"></i><small>อากาศร้อนมาก ดื่มน้ำให้เพียงพอ ระวังโรคลมแดด</small></div>' : ''}
                        ${isRainy ? '<div class="mt-2 p-2 rounded" style="background:#f0f7ff;"><i class="fas fa-umbrella text-primary me-1"></i><small>มีฝน เตรียมร่มก่อนออกนอกบ้าน</small></div>' : ''}
                    </div>`,
                confirmButtonText: 'รับทราบ',
                confirmButtonColor: alertColor,
                width: '90%',
                customClass: { popup: 'glass-card' }
            });
        } else if (isHot || isRainy) {
            // Auto-alert on app open (non-manual)
            Swal.fire({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 5000,
                icon: isHot ? 'warning' : 'info',
                title: `${alertIcon} ${temp}°C – ${desc} – ${cityName}`
            });
        }
    } catch (e) {
        console.warn('Weather API error:', e);
        if (manual) {
            Swal.fire({ title: '🌤️ สภาพอากาศ', text: 'ไม่สามารถดึงข้อมูลได้ขณะนี้: ' + e.message, icon: 'warning', confirmButtonText: 'ตกลง' });
        }
    }
}

// --- doLogout --- (ใช้ clearUserSession จาก auth.js เพื่อล้างส่วนที่ถูกต้อง)
function doLogout() {
    Swal.fire({ title: 'ออกจากระบบ?', icon: 'question', showCancelButton: true, confirmButtonText: 'ออก', cancelButtonText: 'ยกเลิก' }).then(r => {
        if (r.isConfirmed) {
            if (typeof liff !== 'undefined') { try { liff.logout(); } catch(e) {} }
            if (typeof clearUserSession === 'function') clearUserSession();
            else localStorage.removeItem('app_user_session');
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

// --- cacheUsers (delegated to auth.js version) ---
// NOTE: cacheUsers is defined in auth.js and is the authoritative version.
// This stub is kept for compatibility only.

console.log('✅ app_patch.js loaded');
