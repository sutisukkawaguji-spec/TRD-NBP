// ============================================================
// 🚀  app.js — UI, Tabs, Forms, Charts & Notifications
//     ต้องโหลดหลัง config.js, auth.js และ feed.js
// ============================================================

// --- UI State ---
var currentRelationSubTab = 'staff';
var currentRelationPosts = [];
var currentRelationVisibleCount = 10;
var currentImageFiles = [];
var selectedMood = 3;

// =====================================================
// 🛠️ Basic UI Helpers
// =====================================================

function markSurveyDone(userId) {
    if (!userId) return;
    const storageKey = `survey_${userId}`;
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
    data.completedMonth = currentMonthKey;
    delete data.snoozeUntil;
    localStorage.setItem(storageKey, JSON.stringify(data));
}

function showVirtueInfo() {
    Swal.fire({
        title: '📌 คำนิยามและตัวอย่างกิจกรรม',
        html: `
        <div class="text-start fs-6" style="line-height: 1.6;">
            <div class="mb-2">
                <b class="text-success"><i class="fas fa-leaf me-1"></i> พอเพียง (Sufficiency):</b><br>
                <small class="text-muted">พอประมาณ มีเหตุผล มีภูมิคุ้มกัน</small><br>
                ✅ Green Office, ปลูกผักสวนครัว, ลดใช้ไฟฟ้า, แบ่งปันวัสดุเหลือใช้
            </div>
            <div class="mb-2">
                <b class="text-primary"><i class="fas fa-user-clock me-1"></i> วินัย (Discipline):</b><br>
                <small class="text-muted">เคารพกติกา รับผิดชอบต่อหน้าที่</small><br>
                ✅ ตรงต่อเวลา, แต่งกายถูกระเบียบ, Big Cleaning Day, ร่วมกิจกรรมองค์กร
            </div>
            <div class="mb-2">
                <b style="color:#00cec9"><i class="fas fa-shield-alt me-1"></i> สุจริต (Integrity):</b><br>
                <small class="text-muted">ซื่อสัตย์ โปร่งใส ยึดมั่นความถูกต้อง</small><br>
                ✅ No Gift Policy (งดรับของขวัญ), ปฏิเสธสินบน, ทำงานโปร่งใสตรวจสอบได้
            </div>
            <div class="mb-2">
                <b class="text-danger"><i class="fas fa-hands-helping me-1"></i> จิตอาสา (Volunteer):</b><br>
                <small class="text-muted">เสียสละเพื่อส่วนรวม ช่วยเหลือเกื้อกูล</small><br>
                ✅ บริจาคโลหิต, ปลูกป่า, บริจาคสิ่งของ, ช่วยงานเพื่อนร่วมงาน
            </div>
            <div>
                <b class="text-warning"><i class="fas fa-praying-hands me-1"></i> กตัญญู (Gratitude):</b><br>
                <small class="text-muted">สำนึกรู้คุณองค์กรและแผ่นดิน</small><br>
                ✅ ทำบุญตักบาตร, รดน้ำดำหัวผู้ใหญ่, รักษาชื่อเสียงองค์กร, ดูแลทรัพย์สินราชการ
            </div>
        </div>
    `,
        confirmButtonText: 'เข้าใจแล้ว',
        confirmButtonColor: '#6c5ce7',
        width: '90%'
    });
}

// =====================================================
// 🤝 ระบบเพื่อนและแท็กทีม
// =====================================================
function fetchFriendsList() {
    if (!currentUser || !currentUser.userId) return;
    const container = document.getElementById('friendListArea');
    if (!container) return;
    container.innerHTML = '<div class="col-12 text-center text-muted small"><div class="spinner-border spinner-border-sm"></div> กำลังโหลดรายชื่อ...</div>';

    const handleData = (data) => {
        if (data && data.status === 'error') {
            container.innerHTML = `<div class="col-12 text-center text-danger small">โหลดรายชื่อไม่สำเร็จ<br><small>${data.message}</small></div>`;
            return;
        }
        container.innerHTML = '';
        let count = 0;
        const usersArray = Array.isArray(data) ? data : (data.users || []);

        usersArray.forEach(user => {
            if (String(user.lineId) === String(currentUser.userId)) return;
            if (typeof isAlumni === 'function' && isAlumni(user.role)) return;
            if (typeof isGuest === 'function' && isGuest(user.role)) return;

            count++;
            const div = document.createElement('div');
            div.className = 'col-6 mb-2';
            div.innerHTML = `
                <div class="friend-item p-2 rounded d-flex align-items-center shadow-sm" 
                     style="background: var(--glass-bg); border: 1px solid var(--border-color); cursor:pointer; transition: all 0.2s;" 
                     data-id="${user.lineId}" onclick="toggleFriend(this)">
                    <img src="${user.img || 'https://dummyimage.com/35x35/cccccc/ffffff&text=Friend'}" class="rounded-circle me-2" width="35" height="35" style="object-fit:cover; border: 1px solid var(--border-color);">
                    <div class="text-truncate small fw-bold" style="max-width: 120px; color: var(--text-main);">${user.name}</div>
                </div>
            `;
            container.appendChild(div);
        });
        if (count === 0) container.innerHTML = '<div class="col-12 text-center text-muted small py-3">ยังไม่มีผู้ใช้อื่นในระบบ</div>';
    };

    if (READ_FROM_SUPABASE && supabaseClient) {
        const cachedUsers = Object.values(allUsersMap);
        if (cachedUsers.length > 0) {
            handleData(cachedUsers);
        } else {
            supabaseClient.from('Users').select('*')
                .then(({ data, error }) => {
                    if (error) throw error;
                    handleData(data.map(u => ({ lineId: u.LineID, name: u.Name, img: u.Image, role: u.Role })));
                })
                .catch(err => runGASFriendsList(handleData));
        }
    } else {
        runGASFriendsList(handleData);
    }
}

function runGASFriendsList(handleData) {
    const url = `${GAS_URL}?action=get_users&t=` + Date.now();
    fetch(url).then(res => res.json()).then(data => handleData(data))
        .catch(err => {
            window.__gasFriendsCb = (data) => handleData(data);
            const s = document.createElement('script');
            s.src = `${GAS_URL}?action=get_users&callback=__gasFriendsCb&t=${Date.now()}`;
            document.head.appendChild(s);
        });
}

function toggleFriend(el) {
    el.classList.toggle('selected');
    if (el.classList.contains('selected')) {
        if (!el.querySelector('.check-mark')) el.innerHTML += '<i class="fas fa-check-circle text-primary ms-auto check-mark"></i>';
    } else {
        el.querySelector('.check-mark')?.remove();
    }
}

function selectAllFriends() {
    const items = document.querySelectorAll('.friend-item');
    const btn = document.getElementById('btnSelectAll');
    if (!btn) return;
    const isSelect = btn.innerHTML.includes('All');
    items.forEach(i => {
        if (isSelect) { if (!i.classList.contains('selected')) toggleFriend(i); }
        else { if (i.classList.contains('selected')) toggleFriend(i); }
    });
    btn.innerHTML = isSelect ? '<i class="fas fa-times me-1"></i>Cancel' : '<i class="fas fa-check-double me-1"></i>All';
    btn.classList.toggle('btn-outline-primary'); btn.classList.toggle('btn-outline-danger');
}

// =====================================================
// 🏅 ระบบเหรียญตรา (UI Interaction)
// =====================================================
function getCalculatedLevel(badgeKey, userStats, userScore, userTotal) {
    const config = badgeConfig[badgeKey];
    if (!config) return 0;
    let currentCount = config.source === 'score' ? userScore : (config.source === 'total' ? userTotal : (userStats[badgeKey] || 0));
    let calculatedLevel = 0;
    for (let i = config.levels.length - 1; i >= 0; i--) {
        if (currentCount >= config.levels[i].count) {
            calculatedLevel = i + 1;
            break;
        }
    }
    return calculatedLevel;
}

function revealUpgrade(badgeKey, newLevelIdx, title, icon) {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    Swal.fire({
        html: `
            <div class="text-center" style="font-family: 'Kanit', sans-serif;">
                <h3 style="font-weight: 800; color: #f39c12; margin-bottom: 15px;">🎉 ยินดีด้วย! เลื่อนขั้นสำเร็จ</h3>
                <div style="font-size: 5rem; margin-bottom: 10px; filter: drop-shadow(0 5px 15px rgba(243, 156, 18, 0.4)); animation: pulse-mystery 2s infinite ease-in-out;">${icon}</div>
                <h5 style="font-weight: bold; color: var(--text-color);">คุณได้รับเหรียญ <br><span style="color:var(--primary);">${title}</span></h5>
            </div>
        `,
        confirmButtonColor: '#6c5ce7',
        confirmButtonText: 'สุดยอดไปเลย!',
        customClass: { popup: 'glass-card' }
    }).then(() => {
        let storageKey = `happyMeter_badges_${currentUser.userId}`;
        let storedLevels = safeGetJSON(storageKey, {});
        storedLevels[badgeKey] = newLevelIdx;
        safeSetItem(storageKey, storedLevels);
        if (typeof renderBadges === 'function') renderBadges();
    });
}

function viewBadge(title, desc, icon) {
    Swal.fire({
        html: `
            <div class="text-center" style="font-family: 'Kanit', sans-serif;">
                <div style="font-size: 4.5rem; margin-bottom: 10px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));">${icon}</div>
                <h4 style="font-weight: 800; color: var(--primary); margin-bottom: 5px;">${title}</h4>
                <p style="color: #666; font-size: 0.95rem; line-height: 1.5;">${desc}</p>
            </div>
        `,
        confirmButtonColor: '#6c5ce7',
        confirmButtonText: 'ปิดหน้าต่าง',
        customClass: { popup: 'glass-card' }
    });
}

// =====================================================
// 🔄 Tab Management
// =====================================================
function switchTab(pageId, el) {
    if (!currentUser) { Swal.fire('เตือน', 'กรุณาเข้าสู่ระบบ', 'warning'); return; }

    if (currentUser.status === 'waiting_approval' && pageId !== 'feed') {
        Swal.fire({ icon: 'info', title: 'รอการอนุมัติ', text: 'บัญชีของคุณกำลังรอ Admin ตรวจสอบข้อมูล ระหว่างนี้คุณสามารถดู "เรื่องราว" ได้อย่างเดียวนะครับ', timer: 3000, showConfirmButton: false });
        return;
    }

    if (pageId === 'manager' && typeof getUserLevel === 'function' && getUserLevel(currentUser) > 2) {
        Swal.fire({ toast: true, icon: 'error', title: '🚫 ไม่มีสิทธิ์เข้าถึง', position: 'top', timer: 3000, showConfirmButton: false });
        return;
    }

    safetyResumeMusic();
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'auto' });

    if (pageId === 'stats') {
        setTimeout(() => {
            if (typeof initUserRadar === 'function') initUserRadar();
            if (typeof renderManagerChart === 'function') renderManagerChart();
            window.dispatchEvent(new Event('resize'));
        }, 400);
    }
    if (pageId === 'badges' || pageId === 'manager') {
        if (typeof fetchRewards === 'function') fetchRewards();
    }
    if (pageId === 'relation') {
        if (typeof closeRelationDetail === 'function') closeRelationDetail();
        if (typeof renderRelationTab === 'function') renderRelationTab();
    }
    if (pageId === 'stories') {
        const navBtn = document.getElementById('nav-stories-btn');
        navBtn?.querySelector('.nav-notify-dot')?.remove();
        if (typeof fetchFeed === 'function') fetchFeed();
    }

    const header = document.getElementById('header-user');
    if (header) header.style.display = (pageId === 'manager') ? 'none' : 'block';
    
    if (pageId === 'manager' && typeof fetchManagerData === 'function') fetchManagerData();
}

function setRelationSubTab(tab) {
    currentRelationSubTab = tab;
    if (typeof renderRelationTab === 'function') renderRelationTab();
}

function safetyResumeMusic() {
    const bgMusic = document.getElementById('bgMusic');
    if (bgMusic && bgMusic.paused && localStorage.getItem('bg_music_enabled') === 'true') {
        bgMusic.play().catch(() => { });
    }
}

// =====================================================
// 📈 Staff Table & Dashboard UI
// =====================================================
function filterStaffList() {
    const query = document.getElementById('staffFilterInput').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#staffListArea .staff-row, #guestListArea .staff-row');
    rows.forEach(row => {
        const name = row.querySelector('.fw-bold')?.innerText.toLowerCase() || "";
        const role = row.querySelector('.badge')?.innerText.toLowerCase() || "";
        row.style.display = (name.includes(query) || role.includes(query)) ? 'block' : 'none';
    });
}

function renderStaffTable(map) {
    const sList = document.getElementById('staffListArea');
    const gList = document.getElementById('guestListArea');
    const hList = document.getElementById('hofExecutiveListArea');
    if (!sList) return;
    sList.innerHTML = ''; if (gList) gList.innerHTML = ''; if (hList) hList.innerHTML = '';

    const allUsers = Object.values(map);
    const activeStaff = allUsers.filter(u => typeof shouldIncludeInStats === 'function' && shouldIncludeInStats(u.role));
    const guestStaff = allUsers.filter(u => typeof isGuest === 'function' && isGuest(u.role));
    const hofExecutives = allUsers.filter(u => typeof isAlumni === 'function' && isAlumni(u.role) && ['Manager', 'Admin', 'Executive', 'หัวหน้า', 'ผู้บริหาร', 'ผอ.', 'คลังจังหวัด'].some(r => (u.role || '').toLowerCase().includes(r.toLowerCase())));

    if (activeStaff.length > 0) {
        activeStaff.sort((a, b) => (b.score || 0) - (a.score || 0)).forEach(f => renderStaffRow(f, sList));
    } else {
        sList.innerHTML = `<div class="text-center py-5 text-muted">ไม่พบรายชื่อบุคลากร</div>`;
    }

    if (hofExecutives.length > 0) {
        const hSection = document.getElementById('hofExecutiveSection');
        if (hSection) hSection.style.display = 'block';
        hofExecutives.sort((a, b) => (b.score || 0) - (a.score || 0)).forEach(f => renderStaffRow(f, hList, true));
    }

    if (guestStaff.length > 0) {
        const gSection = document.getElementById('guestSectionArea');
        if (gSection) gSection.style.display = 'block';
        guestStaff.forEach(f => renderStaffRow(f, gList));
    }
}

function renderStaffRow(f, container, isHOF = false) {
    const score = parseFloat(f.happyScore || f.avgHappy) || 0;
    let status = isHOF ? 'status-legend' : (score < 5 ? 'status-critical' : (score < 7 ? 'status-warning' : 'status-normal'));
    
    let approvalHtml = '';
    if (f.status === 'waiting_approval' && typeof canManageSystem === 'function' && canManageSystem()) {
        approvalHtml = `
            <div class="mt-2 d-flex gap-2 p-2 rounded-4" style="background: rgba(108, 92, 231, 0.05); border: 1px dashed var(--primary-color);">
                <button class="btn btn-xs btn-primary flex-grow-1 rounded-pill fw-bold" onclick="event.stopPropagation(); approveUser('${f.id}')">อนุมัติ</button>
                <button class="btn btn-xs btn-outline-danger rounded-pill" onclick="event.stopPropagation(); rejectUser('${f.id}')">ปฏิเสธ</button>
            </div>`;
    }

    const div = document.createElement('div');
    div.className = `p-3 staff-row border-bottom ${status}`;
    div.onclick = () => showStaffModal(f.id);
    div.innerHTML = `
        <div class="d-flex align-items-center mb-2">
            <div class="position-relative">
                <img src="${f.img || 'https://dummyimage.com/55x55/ccc/fff'}" style="width:55px;height:55px;border-radius:50%;margin-right:15px;object-fit:cover;">
                <span class="position-absolute bottom-0 end-0 badge rounded-pill bg-dark border border-white" style="font-size:0.6rem;">Lv.${f.level}</span>
            </div>
            <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="fw-bold mb-0">${f.name}</h6>
                        <span class="badge bg-light text-dark border mt-1 small">${f.role}</span>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold">${typeof formatCompactNumber === 'function' ? formatCompactNumber(f.score) : f.score} / ${score.toFixed(1)}</div>
                        <div class="progress mt-1" style="height: 4px; width: 60px; margin-left: auto;">
                            <div class="progress-bar" style="width: ${((f.score % 500) / 5)}%; background-color: ${score < 5 ? '#e74c3c' : (score < 7 ? '#f39c12' : '#27ae60')};"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>${approvalHtml}`;
    container.appendChild(div);
}

// =====================================================
// 👤 Staff Modal (Detailed View)
// =====================================================
function showStaffModal(uid) {
    const user = globalUserStatsMap[uid];
    if (!user) return;
    const v = user.virtueStats || {};
    const happyScore = parseFloat(user.happyScore || user.avgHappy || 0);
    const virtueLabel = typeof getDominantVirtueLabel === 'function' ? getDominantVirtueLabel(v) : { label: 'พนักงาน', key: 'none' };
    const virtueDesc = typeof getVirtueDescription === 'function' ? getVirtueDescription(virtueLabel.key) : '';
    const activityRange = typeof getActivityRange === 'function' ? getActivityRange(uid) : '';

    Swal.fire({
        title: 'ข้อมูลบุคลากร',
        html: `
            <div style="text-align:left;" class="staff-modal-content">
                <div class="d-flex align-items-center mb-4">
                    <img src="${user.img || 'https://via.placeholder.com/60'}" style="width:70px;height:70px;border-radius:20px;margin-right:15px;object-fit:cover;">
                    <div>
                        <h5 class="fw-bold mb-1">${user.name}</h5>
                        <div class="badge bg-light text-primary border">${user.role}</div>
                    </div>
                </div>
                <div class="row g-2 mb-3">
                    <div class="col-6"><div class="staff-stat-card"><small>ความสุข</small><br><b>${happyScore.toFixed(1)} / 10</b></div></div>
                    <div class="col-6"><div class="staff-stat-card"><small>คะแนนสะสม</small><br><b>${user.score.toLocaleString()} XP</b></div></div>
                </div>
                <div class="staff-stat-card mb-3 p-3">
                    <strong class="text-primary">พลังเด่น: ${virtueLabel.label}</strong>
                    <p class="mb-1 text-muted small">${virtueDesc}</p>
                    <small class="text-muted d-block mt-1">${activityRange}</small>
                </div>
                <div class="mt-4"><canvas id="staffRadarChart" style="height:200px;"></canvas></div>
                ${typeof canManageSystem === 'function' && canManageSystem() ? `
                    <div class="mt-3 d-flex gap-2">
                        <button class="btn btn-warning btn-sm flex-grow-1" onclick="promoteToAlumni('${user.id}')">ขึ้นทำเนียบ</button>
                        <button class="btn btn-primary btn-sm flex-grow-1" onclick="changeUserRole('${user.id}')">เปลี่ยนสิทธิ์</button>
                    </div>` : ''}
            </div>`,
        showConfirmButton: false, showCloseButton: true,
        didOpen: () => {
            const dataPoints = [v.volunteer || 0, v.sufficiency || 0, v.discipline || 0, v.integrity || 0, v.gratitude || 0];
            drawPremiumRadar('staffRadarChart', dataPoints);
        }
    });
}

function drawPremiumRadar(ctxId, data, isAlumni = false) {
    const ctx = document.getElementById(ctxId);
    if (!ctx) return;
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['จิตอาสา', 'พอเพียง', 'วินัย', 'สุจริต', 'กตัญญู'],
            datasets: [{ data, backgroundColor: 'rgba(108, 92, 231, 0.2)', borderColor: '#6c5ce7', borderWidth: 2 }]
        },
        options: { scales: { r: { suggestedMin: 0, ticks: { display: false } } }, plugins: { legend: { display: false } } }
    });
}

function drawPersonalVirtueBarChart(stats, canvasId = 'personalVirtueBarChart') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const v = stats || {};
    const labels = ['🤝 อาสา', '🌱 พอเพียง', '📏 วินัย', '💎 สุจริต', '🙏 กตัญญู'];
    const data = [v.volunteer || 0, v.sufficiency || 0, v.discipline || 0, v.integrity || 0, v.gratitude || 0];
    const colors = ['#3498db', '#2ecc71', '#9b59b6', '#1abc9c', '#e84393'];

    if (window['chart_' + canvasId]) window['chart_' + canvasId].destroy();
    window['chart_' + canvasId] = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 5 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true }, y: { grid: { display: false } } } }
    });
}

// =====================================================
// 🛠️ Admin & Maintenance
// =====================================================
async function approveUser(lineId) {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from('Users').update({ Status: 'active', Role: 'Staff' }).eq('LineID', lineId);
        Swal.fire('สำเร็จ', 'อนุมัติการใช้งานแล้ว', 'success');
        if (typeof fetchManagerData === 'function') fetchManagerData();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

async function rejectUser(lineId) {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from('Users').update({ Status: 'rejected' }).eq('LineID', lineId);
        Swal.fire('เรียบร้อย', 'ปฏิเสธคำขอแล้ว', 'info');
        if (typeof fetchManagerData === 'function') fetchManagerData();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

async function repairAllUserScores() {
    if (!supabaseClient) return;
    Swal.fire({ title: 'กำลังประมวลผล...', didOpen: () => Swal.showLoading() });
    try {
        const { data: allUsers } = await supabaseClient.from('Users').select('LineID');
        for (const u of allUsers) {
            if (typeof syncUserScore === 'function') await syncUserScore(u.LineID);
        }
        Swal.fire('สำเร็จ', 'รีเฟรชคอนเทนต์และคะแนนทุกคนแล้ว', 'success').then(() => location.reload());
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

// =====================================================
// 🔔 ระบบประกาศและแจ้งเตือน UI
// =====================================================
function toggleNotifPanel() {
    const p = document.getElementById('notifPanel');
    const b = document.getElementById('notifBackdrop');
    if (!p.classList.contains('show')) {
        p.classList.add('show'); b?.classList.add('show'); if (typeof fetchAnnouncements === 'function') fetchAnnouncements();
    } else {
        p.classList.remove('show'); b?.classList.remove('show');
    }
}

function closeNotifPanel() {
    document.getElementById('notifPanel').classList.remove('show');
    document.getElementById('notifBackdrop')?.classList.remove('show');
}

function openAnnounceModal() {
    closeNotifPanel();
    document.getElementById('ann-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('announceModalBackdrop').style.display = 'block';
    document.getElementById('announceModal').style.display = 'block';
}

function closeAnnounceModal() {
    document.getElementById('announceModalBackdrop').style.display = 'none';
    document.getElementById('announceModal').style.display = 'none';
}

async function saveAnnouncement() {
    const title = document.getElementById('ann-title').value.trim();
    const date = document.getElementById('ann-date').value;
    const body = document.getElementById('ann-body').value.trim();
    const category = document.getElementById('ann-category').value;
    if (!title || !date) { Swal.fire({ toast: true, icon: 'warning', title: 'กรุณากรอกข้อมูล', position: 'top', timer: 3000 }); return; }

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        if (READ_FROM_SUPABASE && supabaseClient) {
            const now = new Date();
            const { error } = await supabaseClient.from('Announcements').insert({
                ID: 'ann_' + Date.now(), Title: title, Body: body, EventDate: date, Category: category,
                PostedBy: currentUser.userId, Date: now.toISOString().split('T')[0], Time: now.toTimeString().split(' ')[0], Status: 'active'
            });
            if (error) throw error;
        } else {
            const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'save_announcement', title, eventDate: date, body, category, postedBy: currentUser.userId }) });
            const data = await res.json();
            if (data.status !== 'success') throw new Error(data.message);
        }
        closeAnnounceModal();
        Swal.fire({ toast: true, icon: 'success', title: '✅ บันทึกประกาศสำเร็จ!', position: 'top', timer: 3000, showConfirmButton: false });
        setTimeout(() => toggleNotifPanel(), 1500);
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

// =====================================================
// 📝 ฟอร์มบันทึกความดี และอัปโหลด
// =====================================================
function setMood(val, btn) {
    selectedMood = val;
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function addEmoji(emoji) {
    const input = document.getElementById('noteInput');
    if (input) { input.value += emoji + ' '; input.focus(); }
}

function handleFileSelect(input) {
    const files = Array.from(input.files);
    if (files.length === 0) return;
    if (currentImageFiles.length + files.length > 20) {
        Swal.fire('แจ้งเตือน', 'อัปโหลดภาพได้สูงสุด 20 ภาพต่อโพสต์ครับ', 'warning');
        input.value = ""; return;
    }
    currentImageFiles = [...currentImageFiles, ...files];
    input.value = ""; renderThumbnails();
}

function renderThumbnails() {
    const badge = document.getElementById('imgCountBadge');
    if (badge) { badge.innerText = currentImageFiles.length; badge.style.display = currentImageFiles.length > 0 ? 'block' : 'none'; }
    const thumbList = document.getElementById('thumbList');
    if (!thumbList) return;
    thumbList.innerHTML = '';
    currentImageFiles.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'thumb-item';
            div.innerHTML = `<img src="${e.target.result}" class="thumb-img"><button class="btn-remove-img" onclick="removeImage(${idx})">&times;</button>`;
            thumbList.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeImage(idx) { currentImageFiles.splice(idx, 1); renderThumbnails(); }

async function uploadImageToCloudinary(file) {
    const CLOUD_NAME = 'dzh88q2fr';
    const PRESET = 'ml_default';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', PRESET);
    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        return res.ok ? data.secure_url : null;
    } catch (e) { return null; }
}

async function submitData() {
    const virtue = document.getElementById('virtueSelect').value;
    const note = document.getElementById('noteInput').value.trim();
    if (!virtue) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกหมวดความดี', 'warning'); return; }
    const tagged = Array.from(document.querySelectorAll('.friend-item.selected')).map(el => el.dataset.id);
    const privacy = document.querySelector('input[name="privacyOption"]:checked').value;

    Swal.fire({ title: 'กำลังอัปโหลดรูปภาพ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    let finalImageUrl = document.getElementById('mediaLinkInput')?.value.trim() || '';
    if (currentImageFiles.length > 0) {
        const urls = [];
        for (let i = 0; i < currentImageFiles.length; i++) {
            Swal.update({ title: `กำลังอัปโหลดรูปภาพ (${i + 1}/${currentImageFiles.length})` });
            const url = await uploadImageToCloudinary(currentImageFiles[i]);
            if (url) urls.push(url);
        }
        finalImageUrl = (finalImageUrl ? finalImageUrl + ',' : '') + urls.join(',');
    }

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const now = new Date();
        const uuid = 'sup_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const { error } = await supabaseClient.from('Activities').insert({
            UUID: uuid, Date: now.toLocaleDateString('en-CA'), Time: now.toTimeString().split(' ')[0],
            UserId: currentUser.userId, UserName: currentUser.name, Virtue: virtue, Note: note,
            Happy: parseInt(selectedMood), Image: finalImageUrl, Tagged: tagged.join(','),
            Privacy: privacy, JSON: { likes: [], verifies: [] }, Status: privacy === 'private' ? 'private' : 'waiting_verify', Score: 0
        });
        if (error) throw error;
        
        Swal.fire('บันทึกสำเร็จ!', 'เรื่องราวของคุณถูกแชร์แล้ว', 'success');
        document.getElementById('noteInput').value = '';
        currentImageFiles = []; renderThumbnails();
        switchTab('stories', document.getElementById('nav-stories-btn'));
        if (typeof fetchFeed === 'function') fetchFeed(false, true);
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

// =====================================================
// 🎁 ระบบของรางวัล (Admin & User)
// =====================================================
window.fetchRewards = async function () {
    if (!supabaseClient) return;
    try {
        const { data: rewards } = await supabaseClient.from('Rewards').select('*');
        window.globalRewardsData = rewards || [];
        const { data: claims } = await supabaseClient.from('Claims').select('*');
        window.globalClaimsData = (claims || []).map(c => ({ rewardId: c.RewardID, userId: c.UserID }));
        if (typeof renderUserRewards === 'function') renderUserRewards();
    } catch (e) { console.error('Rewards fetch failed:', e); }
};

window.renderUserRewards = function () {
    const clist = document.getElementById('challengeRewardList');
    const mlist = document.getElementById('milestoneRewardList');
    if (!clist || !mlist) return;
    const rewards = window.globalRewardsData || [];
    const lifetimeXP = currentUser?.score || 0;

    const buildCard = (r, xp, color) => {
        const target = r.TargetVal || 100;
        const pct = Math.min(100, Math.round((xp / target) * 100));
        const unlocked = xp >= target;
        const claimed = (window.globalClaimsData || []).some(c => c.rewardId == r.ID && String(c.userId) == String(currentUser.userId));
        const icon = claimed ? 'fa-check-circle' : (unlocked ? 'fa-gift animate__animated animate__bounce animate__infinite' : 'fa-lock');
        return `<div class="glass-card p-3 text-center mb-3">
            <div class="mb-2 text-${unlocked ? 'warning' : 'muted'}"><i class="fas ${icon} fa-3x"></i></div>
            <div class="fw-bold small">${r.Name}</div>
            <div class="progress mt-2" style="height:6px;"><div class="progress-bar" style="width:${pct}%; background:${color}"></div></div>
            ${unlocked && !claimed ? `<button class="btn btn-xs btn-primary mt-2 rounded-pill" onclick="claimReward('${r.ID}', '${r.Name}')">แลกรางวัล</button>` : ''}
        </div>`;
    };
    mlist.innerHTML = rewards.filter(r => r.Mode == 1).map(r => buildCard(r, lifetimeXP, '#28a745')).join('');
    clist.innerHTML = rewards.filter(r => r.Mode == 2).map(r => buildCard(r, 0, '#ff9f43')).join('');
};

async function claimReward(id, title) {
    const res = await Swal.fire({ title: 'ยืนยันการรับรางวัล?', text: `ต้องการใช้คะแนนแลก ${title}?`, showCancelButton: true });
    if (res.isConfirmed && supabaseClient) {
        try {
            await supabaseClient.from('Claims').insert({ RewardID: id, UserID: currentUser.userId, Date: new Date().toISOString() });
            Swal.fire('สำเร็จ', 'แจ้งรับรางวัลแล้ว กรุณาติดต่อ HR', 'success');
            fetchRewards();
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
}

// =====================================================
// 🔄 Initialization Helpers
// =====================================================
function scrollToTopAndRefresh() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof fetchFeed === 'function') fetchFeed(false, false, true);
}

function setupBackgroundSync() {
    setInterval(() => {
        if (currentUser) {
            if (typeof fetchAnnouncements === 'function') fetchAnnouncements(true);
            if (typeof fetchFeed === 'function') fetchFeed(false, true);
        }
    }, 60000);
}
