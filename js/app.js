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
            <div class="mb-2"><b class="text-success"><i class="fas fa-leaf me-1"></i> พอเพียง:</b> <small class="text-muted">พอประมาณ มีเหตุผล มีภูมิคุ้มกัน</small><br>✅ Green Office, ลดใช้ไฟฟ้า, แบ่งปันของใช้</div>
            <div class="mb-2"><b class="text-primary"><i class="fas fa-user-clock me-1"></i> วินัย:</b> <small class="text-muted">เคารพกติกา รับผิดชอบต่อหน้าที่</small><br>✅ ตรงต่อเวลา, แต่งกายถูกต้อง, Big Cleaning</div>
            <div class="mb-2"><b style="color:#00cec9"><i class="fas fa-shield-alt me-1"></i> สุจริต:</b> <small class="text-muted">ซื่อสัตย์ โปร่งใส ยึดมั่นความถูกต้อง</small><br>✅ No Gift Policy, ทำงานโปร่งใส</div>
            <div class="mb-2"><b class="text-danger"><i class="fas fa-hands-helping me-1"></i> จิตอาสา:</b> <small class="text-muted">เสียสละเพื่อส่วนรวม ช่วยเหลือผู้อื่น</small><br>✅ บริจาคโลหิต, ปลูกป่า, ช่วยงานส่วนรวม</div>
            <div><b class="text-warning"><i class="fas fa-praying-hands me-1"></i> กตัญญู:</b> <small class="text-muted">สำนึกรู้คุณองค์กรและแผ่นดิน</small><br>✅ ดูแลทรัพย์สินราชการ, รดน้ำดำหัว</div>
        </div>
    `, confirmButtonText: 'เข้าใจแล้ว', confirmButtonColor: '#6c5ce7', width: '90%' });
}

// =====================================================
// 🔄 Tab & Navigation Management
// =====================================================
function switchTab(pageId, el) {
    if (!currentUser) { Swal.fire('เตือน', 'กรุณาเข้าสู่ระบบ', 'warning'); return; }
    if (currentUser.status === 'waiting_approval' && pageId !== 'feed' && pageId !== 'stories') {
        Swal.fire({ icon: 'info', title: 'รอการอนุมัติ', text: 'บัญชีของคุณกำลังรอ Admin ตรวจสอบข้อมูล ระหว่างนี้สามารถดู "เรื่องราว" ได้อย่างเดียวครับ', timer: 3000, showConfirmButton: false });
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
    if (pageId === 'badges' || pageId === 'manager') { if (typeof fetchRewards === 'function') fetchRewards(); }
    if (pageId === 'relation') { closeRelationDetail(); renderRelationTab(); }
    if (pageId === 'stories') {
        const navBtn = document.getElementById('nav-stories-btn');
        navBtn?.querySelector('.nav-notify-dot')?.remove();
        if (typeof fetchFeed === 'function') fetchFeed();
    }
    const header = document.getElementById('header-user');
    if (header) header.style.display = (pageId === 'manager') ? 'none' : 'block';
    if (pageId === 'manager' && typeof fetchManagerData === 'function') fetchManagerData();
}

function updateNavigationVisibility() {
    const mgrTab = document.getElementById('nav-manager-btn');
    const relTab = document.getElementById('nav-relation-btn');
    const statsTab = document.getElementById('nav-stats-btn');
    const badgesTab = document.getElementById('nav-badges-btn');
    const recordTab = document.getElementById('nav-record-btn');
    const storiesTab = document.getElementById('nav-stories-btn');
    const headerUser = document.getElementById('header-user');

    if (!currentUser) {
        [mgrTab, relTab, statsTab, badgesTab, recordTab].forEach(t => t && (t.style.display = 'none'));
        if (storiesTab) storiesTab.style.display = 'flex';
        if (headerUser) headerUser.style.display = 'none';
        return;
    }

    const level = typeof getUserLevel === 'function' ? getUserLevel(currentUser) : 3;
    if (level === 5) { // New Member
        [mgrTab, relTab, badgesTab, recordTab].forEach(t => t && (t.style.display = 'none'));
        [storiesTab, statsTab].forEach(t => t && (t.style.display = 'flex'));
        if (headerUser) headerUser.style.display = 'none';
    } else if (typeof isAlumni === 'function' && isAlumni(currentUser.role) && level > 2) { // Alumni
        [mgrTab, relTab, recordTab].forEach(t => t && (t.style.display = 'none'));
        [storiesTab, statsTab, badgesTab].forEach(t => t && (t.style.display = 'flex'));
        if (headerUser) headerUser.style.display = 'block';
    } else { // Active Staff/Manager
        [storiesTab, statsTab, badgesTab, relTab, recordTab].forEach(t => t && (t.style.display = 'flex'));
        if (mgrTab) mgrTab.style.display = (level <= 2) ? 'flex' : 'none';
        if (headerUser) headerUser.style.display = 'block';
    }
    updateAddAnnounceButton();
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

    if (activeStaff.length > 0) activeStaff.sort((a, b) => (b.score || 0) - (a.score || 0)).forEach(f => renderStaffRow(f, sList));
    else sList.innerHTML = `<div class="text-center py-5 text-muted">ไม่พบรายชื่อบุคลากร</div>`;

    if (hofExecutives.length > 0) {
        const hSection = document.getElementById('hofExecutiveSection'); if (hSection) hSection.style.display = 'block';
        hofExecutives.sort((a, b) => (b.score || 0) - (a.score || 0)).forEach(f => renderStaffRow(f, hList, true));
    }
    if (guestStaff.length > 0) {
        const gSection = document.getElementById('guestSectionArea'); if (gSection) gSection.style.display = 'block';
        guestStaff.forEach(f => renderStaffRow(f, gList));
    }
}

function renderStaffRow(f, container, isHOF = false) {
    const score = parseFloat(f.happyScore || f.avgHappy) || 0;
    let status = isHOF ? 'status-legend' : (score < 5 ? 'status-critical' : (score < 7 ? 'status-warning' : 'status-normal'));
    let approvalHtml = (f.status === 'waiting_approval' && typeof canManageSystem === 'function' && canManageSystem()) ? 
        `<div class="mt-2 d-flex gap-2 p-2 rounded-4" style="background: rgba(108, 92, 231, 0.05); border: 1px dashed var(--primary-color);">
            <button class="btn btn-xs btn-primary flex-grow-1 rounded-pill fw-bold" onclick="event.stopPropagation(); approveUser('${f.id}')">อนุมัติ</button>
            <button class="btn btn-xs btn-outline-danger rounded-pill" onclick="event.stopPropagation(); rejectUser('${f.id}')">ปฏิเสธ</button>
        </div>` : '';

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
                    <div><h6 class="fw-bold mb-0">${f.name}</h6><span class="badge bg-light text-dark border mt-1 small">${f.role}</span></div>
                    <div class="text-end"><div class="fw-bold">${typeof formatCompactNumber === 'function' ? formatCompactNumber(f.score) : f.score} / ${score.toFixed(1)}</div>
                    <div class="progress mt-1" style="height: 4px; width: 60px; margin-left: auto;"><div class="progress-bar" style="width: ${((f.score % 500) / 5)}%; background-color: ${score < 5 ? '#e74c3c' : (score < 7 ? '#f39c12' : '#27ae60')};"></div></div></div>
                </div>
            </div>
        </div>${approvalHtml}`;
    container.appendChild(div);
}

function showStaffModal(uid) {
    const user = globalUserStatsMap[uid]; if (!user) return;
    const v = user.virtueStats || {};
    const happyScore = parseFloat(user.happyScore || user.avgHappy || 0);
    const virtueLabel = typeof getDominantVirtueLabel === 'function' ? getDominantVirtueLabel(v) : { label: 'พนักงาน', key: 'none' };
    const virtueDesc = typeof getVirtueDescription === 'function' ? getVirtueDescription(virtueLabel.key) : '';
    const activityRange = typeof getActivityRange === 'function' ? getActivityRange(uid) : '';

    Swal.fire({
        title: 'ข้อมูลบุคลากร',
        html: `
            <div style="text-align:left;" class="staff-modal-content">
                <div class="d-flex align-items-center mb-4"><img src="${user.img || 'https://via.placeholder.com/60'}" style="width:70px;height:70px;border-radius:20px;margin-right:15px;object-fit:cover;"><div><h5 class="fw-bold mb-1">${user.name}</h5><div class="badge bg-light text-primary border">${user.role}</div></div></div>
                <div class="row g-2 mb-3"><div class="col-6"><div class="staff-stat-card"><small>ความสุข</small><br><b>${happyScore.toFixed(1)} / 10</b></div></div><div class="col-6"><div class="staff-stat-card"><small>คะแนนสะสม</small><br><b>${user.score.toLocaleString()} XP</b></div></div></div>
                <div class="staff-stat-card mb-3 p-3"><strong class="text-primary">พลังเด่น: ${virtueLabel.label}</strong><p class="mb-1 text-muted small">${virtueDesc}</p><small class="text-muted d-block mt-1">${activityRange}</small></div>
                <div class="mt-4"><canvas id="staffRadarChart" style="height:200px;"></canvas></div>
                ${typeof canManageSystem === 'function' && canManageSystem() ? `<div class="mt-3 d-flex gap-2"><button class="btn btn-warning btn-sm flex-grow-1" onclick="promoteToAlumni('${user.id}')">ขึ้นทำเนียบ</button><button class="btn btn-primary btn-sm flex-grow-1" onclick="changeUserRole('${user.id}')">เปลี่ยนสิทธิ์</button></div>` : ''}
            </div>`,
        showConfirmButton: false, showCloseButton: true,
        didOpen: () => {
            const dataPoints = [v.volunteer || 0, v.sufficiency || 0, v.discipline || 0, v.integrity || 0, v.gratitude || 0];
            drawPremiumRadar('staffRadarChart', dataPoints);
        }
    });
}

function drawPremiumRadar(ctxId, data, isAlumni = false) {
    const ctx = document.getElementById(ctxId); if (!ctx) return;
    new Chart(ctx, {
        type: 'radar',
        data: { labels: ['จิตอาสา', 'พอเพียง', 'วินัย', 'สุจริต', 'กตัญญู'], datasets: [{ data, backgroundColor: 'rgba(108, 92, 231, 0.2)', borderColor: '#6c5ce7', borderWidth: 2 }] },
        options: { scales: { r: { suggestedMin: 0, ticks: { display: false } } }, plugins: { legend: { display: false } } }
    });
}

// =====================================================
// 🤝 ระบบทำเนียบ (Hall of Fame)
// =====================================================
function renderRelationTab() {
    const container = document.getElementById('relationContainer'); if (!container) return;
    const allAlumni = Object.values(globalUserStatsMap).filter(u => typeof isAlumni === 'function' && isAlumni(u.role));
    const execKeywords = ['manager', 'admin', 'executive', 'หัวหน้า', 'ผู้บริหาร', 'ผอ.', 'คลังจังหวัด'];
    const execAlumni = allAlumni.filter(u => execKeywords.some(k => (u.role || '').toLowerCase().includes(k)));
    const staffAlumni = allAlumni.filter(u => !execAlumni.some(ex => ex.id === u.id));
    const activeList = currentRelationSubTab === 'executives' ? execAlumni : staffAlumni;

    let html = `<div class="relation-sub-tabs mb-3"><button class="relation-sub-btn ${currentRelationSubTab === 'executives' ? 'active' : ''}" onclick="setRelationSubTab('executives')">👨‍💼 ผู้บริหาร (${execAlumni.length})</button><button class="relation-sub-btn ${currentRelationSubTab === 'staff' ? 'active' : ''}" onclick="setRelationSubTab('staff')">👥 เพื่อนร่วมงาน (${staffAlumni.length})</button></div>`;
    if (activeList.length === 0) { html += '<div class="text-center py-5 text-muted glass-card">ยังไม่มีรายชื่อในทำเนียบ</div>'; }
    else {
        html += '<div class="hof-grid pb-4">';
        activeList.forEach((u, idx) => {
            const vLabel = typeof getDominantVirtueLabel === 'function' ? getDominantVirtueLabel(u.virtueStats) : { label: 'พนักงาน', color: '#6c5ce7' };
            html += `<div class="hof-card" onclick="openRelationDetail('${u.id}')"><img src="${u.img || 'https://via.placeholder.com/80'}" class="hof-avatar"><h5 class="text-truncate mt-2">${u.name}</h5><small class="badge bg-light text-dark border">${u.role}</small><div class="mt-2 small" style="color:${vLabel.color}"><i class="fas fa-heart me-1"></i>${vLabel.label}</div></div>`;
        });
        html += '</div>';
    }
    container.innerHTML = html;
}

function openRelationDetail(uid) {
    const user = globalUserStatsMap[uid]; if (!user) return;
    const listView = document.getElementById('relationListView'); const detailView = document.getElementById('relationDetailView');
    if (listView) listView.style.display = 'none'; if (detailView) detailView.style.display = 'block';
    const content = document.getElementById('relationDetailContent');
    if (content) {
        const v = user.virtueStats || {};
        const vLabel = typeof getDominantVirtueLabel === 'function' ? getDominantVirtueLabel(v) : { label: 'พนักงาน', color: '#6c5ce7', key: 'none' };
        content.innerHTML = `<div class="p-4 text-center"><img src="${user.img || 'https://via.placeholder.com/100'}" class="profile-img-large shadow mb-3"><h4 class="fw-bold">${user.name}</h4><div class="badge bg-warning text-dark mb-4">${user.role}</div><div class="staff-stat-card mb-3 p-3"><strong>อัตลักษณ์: ${vLabel.label}</strong><p class="small text-muted">${typeof getVirtueDescription === 'function' ? getVirtueDescription(vLabel.key) : ''}</p></div><div style="height:200px;"><canvas id="relationRadarChart"></canvas></div><div id="relationHistoryContainer" class="mt-4 text-start"><hr><small class="text-muted">ประวัติเรื่องราว</small></div></div>`;
        setTimeout(() => drawPremiumRadar('relationRadarChart', [v.volunteer || 0, v.sufficiency || 0, v.discipline || 0, v.integrity || 0, v.gratitude || 0]), 300);
    }
}

function closeRelationDetail() {
    const list = document.getElementById('relationListView'); const detail = document.getElementById('relationDetailView');
    if (list) list.style.display = 'block'; if (detail) detail.style.display = 'none';
}

// =====================================================
// 📝 ระบบส่งเรื่องราว และ อัปโหลด
// =====================================================
function handleFileSelect(input) {
    const files = Array.from(input.files); if (files.length === 0) return;
    if (currentImageFiles.length + files.length > 20) { Swal.fire('แจ้งเตือน', 'อัปโหลดได้สูงสุด 20 ภาพครับ', 'warning'); return; }
    currentImageFiles = [...currentImageFiles, ...files]; input.value = ""; renderThumbnails();
}

function renderThumbnails() {
    const badge = document.getElementById('imgCountBadge'); if (badge) { badge.innerText = currentImageFiles.length; badge.style.display = currentImageFiles.length > 0 ? 'block' : 'none'; }
    const thumbList = document.getElementById('thumbList'); if (!thumbList) return;
    thumbList.innerHTML = '';
    currentImageFiles.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (e) => { const div = document.createElement('div'); div.className = 'thumb-item'; div.innerHTML = `<img src="${e.target.result}" class="thumb-img"><button class="btn-remove-img" onclick="removeImage(${idx})">&times;</button>`; thumbList.appendChild(div); };
        reader.readAsDataURL(file);
    });
}

function removeImage(idx) { currentImageFiles.splice(idx, 1); renderThumbnails(); }

async function uploadImageToCloudinary(file) {
    const CLOUD_NAME = 'dzh88q2fr'; const PRESET = 'ml_default';
    const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', PRESET);
    try { const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: 'POST', body: formData }); const data = await res.json(); return res.ok ? data.secure_url : null; }
    catch (e) { return null; }
}

async function submitData() {
    const virtue = document.getElementById('virtueSelect').value; const note = document.getElementById('noteInput').value.trim();
    if (!virtue) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกหมวดความดี', 'warning'); return; }
    const tagged = Array.from(document.querySelectorAll('.friend-item.selected')).map(el => el.dataset.id);
    const privacy = document.querySelector('input[name="privacyOption"]:checked').value;

    Swal.fire({ title: 'กำลังอัปโหลดรูปภาพ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    let finalImageUrl = document.getElementById('mediaLinkInput')?.value.trim() || '';
    if (currentImageFiles.length > 0) {
        const urls = [];
        for (let i = 0; i < currentImageFiles.length; i++) {
            Swal.update({ title: `กำลังอัปโหลด (${i + 1}/${currentImageFiles.length})` });
            const url = await uploadImageToCloudinary(currentImageFiles[i]); if (url) urls.push(url);
        }
        finalImageUrl = (finalImageUrl ? finalImageUrl + ',' : '') + urls.join(',');
    }

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const now = new Date(); const uuid = 'sup_' + Date.now().toString(36);
        const { error } = await supabaseClient.from('Activities').insert({
            UUID: uuid, Date: now.toLocaleDateString('en-CA'), Time: now.toTimeString().split(' ')[0], UserId: currentUser.userId, UserName: currentUser.name, Virtue: virtue, Note: note, Happy: parseInt(selectedMood), Image: finalImageUrl, Tagged: tagged.join(','), Privacy: privacy, JSON: { likes: [], verifies: [] }, Status: privacy === 'private' ? 'private' : 'waiting_verify', Score: 0
        });
        if (error) throw error;
        Swal.fire('บันทึกสำเร็จ!', 'แชร์เรื่องราวเรียบร้อยครับ', 'success');
        document.getElementById('noteInput').value = ''; currentImageFiles = []; renderThumbnails(); switchTab('stories', document.getElementById('nav-stories-btn'));
        if (typeof fetchFeed === 'function') fetchFeed(false, true);
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

// =====================================================
// 🔔 ระบบประกาศ UI
// =====================================================
function toggleNotifPanel() {
    const p = document.getElementById('notifPanel'); const b = document.getElementById('notifBackdrop');
    if (!p.classList.contains('show')) { p.classList.add('show'); b?.classList.add('show'); if (typeof fetchAnnouncements === 'function') fetchAnnouncements(); }
    else { p.classList.remove('show'); b?.classList.remove('show'); }
}

function updateAddAnnounceButton() {
    const btn = document.getElementById('addAnnounceBtnInPanel'); if (!btn || !currentUser) return;
    const level = typeof getUserLevel === 'function' ? getUserLevel(currentUser) : 4;
    btn.style.display = (level <= 3) ? 'inline-flex' : 'none';
}

function openAnnounceModal() { document.getElementById('announceModalBackdrop').style.display = 'block'; document.getElementById('announceModal').style.display = 'block'; }
function closeAnnounceModal() { document.getElementById('announceModalBackdrop').style.display = 'none'; document.getElementById('announceModal').style.display = 'none'; }

// =====================================================
// 🚀 Initialization & Tracking
// =====================================================
async function trackAppVisit() {
    if (!currentUser || !currentUser.userId) return;
    try {
        const now = new Date();
        if (supabaseClient) {
            await supabaseClient.from('Users').update({ LastDate: now.toLocaleDateString('en-CA'), LastTime: now.toTimeString().split(' ')[0] }).eq('LineID', currentUser.userId);
        }
    } catch (e) { console.warn('Visit track error:', e); }
}

function fetchFriendsList() {
    const container = document.getElementById('friendListArea'); if (!container) return;
    const cachedUsers = Object.values(allUsersMap);
    if (cachedUsers.length > 0) {
        container.innerHTML = '';
        cachedUsers.forEach(u => {
            if (u.lineId === currentUser.userId) return;
            const div = document.createElement('div'); div.className = 'col-6 mb-2'; div.innerHTML = `<div class="friend-item p-2 rounded d-flex align-items-center shadow-sm" data-id="${u.lineId}" onclick="toggleFriend(this)"><img src="${u.img || 'https://via.placeholder.com/35'}" class="rounded-circle me-2" width="35" height="35" style="object-fit:cover;"> <div class="text-truncate small fw-bold">${u.name}</div></div>`; container.appendChild(div);
        });
    }
}

function toggleFriend(el) { el.classList.toggle('selected'); }
function setRelationSubTab(tab) { currentRelationSubTab = tab; renderRelationTab(); }
function safetyResumeMusic() { const m = document.getElementById('bgMusic'); if (m && m.paused && localStorage.getItem('bg_music_enabled') === 'true') m.play().catch(()=>{}); }
function scrollToTopAndRefresh() { window.scrollTo({ top: 0, behavior: 'smooth' }); if (typeof fetchFeed === 'function') fetchFeed(false, false, true); }
function setupBackgroundSync() { setInterval(() => { if (currentUser) { if (typeof fetchAnnouncements === 'function') fetchAnnouncements(true); if (typeof fetchFeed === 'function') fetchFeed(false, true); } }, 60000); }
