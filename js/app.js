// ============================================================
// 馃殌  app.js 鈥� UI, Tabs, Forms, Charts & Notifications
//     喔曕箟喔�竾喙傕斧喔ム笖喔�弗喔编竾 config.js, auth.js 喙佮弗喔� feed.js
// ============================================================

// --- UI State ---
var currentRelationSubTab = 'staff';
var currentRelationPosts = [];
var currentRelationVisibleCount = 10;
// NOTE: currentImageFiles and selectedMood are declared in config.js

// =====================================================
// 馃洜锔� Basic UI Helpers
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
        title: '馃搶 喔勦赋喔權复喔⑧覆喔∴箒喔ム赴喔曕副喔о腑喔⑧箞喔侧竾喔佮复喔堗竵喔｀福喔�',
        html: `
        <div class="text-start fs-6" style="line-height: 1.6;">
            <div class="mb-2"><b class="text-success"><i class="fas fa-leaf me-1"></i> 喔炧腑喙€喔炧傅喔⑧竾:</b> <small class="text-muted">喔炧腑喔涏福喔班浮喔侧笓 喔∴傅喙€喔�笗喔膏笢喔� 喔∴傅喔犩腹喔∴复喔勦父喙夃浮喔佮副喔�</small><br>鉁� Green Office, 喔ム笖喙冟笂喙夃箘喔熰笩喙夃覆, 喙佮笟喙堗竾喔涏副喔權競喔�竾喙冟笂喙�</div>
            <div class="mb-2"><b class="text-primary"><i class="fas fa-user-clock me-1"></i> 喔о复喔權副喔�:</b> <small class="text-muted">喙€喔勦覆喔｀笧喔佮笗喔脆竵喔� 喔｀副喔氞笢喔脆笖喔娻腑喔氞笗喙堗腑喔�笝喙夃覆喔椸傅喙�</small><br>鉁� 喔曕福喔囙笗喙堗腑喙€喔о弗喔�, 喙佮笗喙堗竾喔佮覆喔⑧笘喔灌竵喔曕箟喔�竾, Big Cleaning</div>
            <div class="mb-2"><b style="color:#00cec9"><i class="fas fa-shield-alt me-1"></i> 喔�父喔堗福喔脆笗:</b> <small class="text-muted">喔嬥阜喙堗腑喔�副喔曕涪喙� 喙傕笡喔｀箞喔囙箖喔� 喔⑧付喔斷浮喔编箞喔權竸喔о覆喔∴笘喔灌竵喔曕箟喔�竾</small><br>鉁� No Gift Policy, 喔椸赋喔囙覆喔權箓喔涏福喙堗竾喙冟釜</div>
            <div class="mb-2"><b class="text-danger"><i class="fas fa-hands-helping me-1"></i> 喔堗复喔曕腑喔侧釜喔�:</b> <small class="text-muted">喙€喔�傅喔⑧釜喔ム赴喙€喔炧阜喙堗腑喔�箞喔о笝喔｀抚喔� 喔娻箞喔о涪喙€喔�弗喔粪腑喔溹腹喙夃腑喔粪箞喔�</small><br>鉁� 喔氞福喔脆笀喔侧竸喙傕弗喔�复喔�, 喔涏弗喔灌竵喔涏箞喔�, 喔娻箞喔о涪喔囙覆喔權釜喙堗抚喔權福喔о浮</div>
            <div><b class="text-warning"><i class="fas fa-praying-hands me-1"></i> 喔佮笗喔编笉喔嵿腹:</b> <small class="text-muted">喔�赋喔權付喔佮福喔灌箟喔勦父喔撪腑喔囙竸喙屶竵喔｀箒喔ム赴喙佮笢喙堗笝喔斷复喔�</small><br>鉁� 喔斷腹喙佮弗喔椸福喔编笧喔⑧箤喔�复喔權福喔侧笂喔佮覆喔�, 喔｀笖喔權箟喔赤笖喔赤斧喔编抚</div>
        </div>
    `, confirmButtonText: '喙€喔傕箟喔侧箖喔堗箒喔ム箟喔�', confirmButtonColor: '#6c5ce7', width: '90%' });
}

// =====================================================
// 馃攧 Tab & Navigation Management
// =====================================================
function switchTab(pageId, el) {
    if (!currentUser) { Swal.fire('喙€喔曕阜喔�笝', '喔佮福喔膏笓喔侧箑喔傕箟喔侧釜喔灌箞喔｀赴喔氞笟', 'warning'); return; }
    if (currentUser.status === 'waiting_approval' && pageId !== 'feed' && pageId !== 'stories') {
        Swal.fire({ icon: 'info', title: '喔｀腑喔佮覆喔｀腑喔權父喔∴副喔曕复', text: '喔氞副喔嵿笂喔掂競喔�竾喔勦父喔撪竵喔赤弗喔编竾喔｀腑 Admin 喔曕福喔о笀喔�腑喔氞競喙夃腑喔∴腹喔� 喔｀赴喔�抚喙堗覆喔囙笝喔掂箟喔�覆喔∴覆喔｀笘喔斷腹 "喙€喔｀阜喙堗腑喔囙福喔侧抚" 喙勦笖喙夃腑喔⑧箞喔侧竾喙€喔斷傅喔⑧抚喔勦福喔编笟', timer: 3000, showConfirmButton: false });
        return;
    }
    if (pageId === 'manager' && typeof getUserLevel === 'function' && getUserLevel(currentUser) > 2) {
        Swal.fire({ toast: true, icon: 'error', title: '馃毇 喙勦浮喙堗浮喔掂釜喔脆笚喔樴复喙屶箑喔傕箟喔侧笘喔多竾', position: 'top', timer: 3000, showConfirmButton: false });
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
    if (header) header.style.display = 'block'; // แสดง header ทุกแท็บ (Manager ก็แสดง)
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
// 馃 喔｀赴喔氞笟喔椸赋喙€喔權傅喔⑧笟 (Hall of Fame)
// =====================================================
function renderRelationTab() {
    const container = document.getElementById('relationContainer'); if (!container) return;
    
    // แสดงบุคลากรทั้งหมด: ผู้ปฏิบัติงาน + ทำเนียบ
    const allUsers = Object.values(globalUserStatsMap);
    const allAlumni = allUsers.filter(u => typeof isAlumni === 'function' && isAlumni(u.role));
    const activeStaff = allUsers.filter(u => !isAlumni(u.role) && !isGuest(u.role) && u.name);
    
    const execKeywords = ['manager', 'admin', 'executive', 'ผู้บริหาร', 'ผู้อำนวยการ', 'ผอ.', 'หัวหน้าฟักชัน'];
    const execAlumni = allAlumni.filter(u => execKeywords.some(k => (u.role || '').toLowerCase().includes(k)));
    const staffAlumni = allAlumni.filter(u => !execAlumni.some(ex => ex.id === u.id));
    
    const tabs = [
        { id: 'active', label: '👥 บุคลากร', count: activeStaff.length },
        { id: 'alumni', label: '🏅 ทำเนียบ', count: allAlumni.length },
        { id: 'executives', label: '👨‍💼 ผู้บริหาร', count: execAlumni.length },
    ];
    
    let activeList;
    if (currentRelationSubTab === 'executives') activeList = execAlumni;
    else if (currentRelationSubTab === 'alumni') activeList = staffAlumni;
    else { activeList = activeStaff; currentRelationSubTab = 'active'; }

    let html = `<div class="relation-sub-tabs mb-3">`;
    tabs.forEach(t => {
        html += `<button class="relation-sub-btn ${currentRelationSubTab === t.id ? 'active' : ''}" onclick="setRelationSubTab('${t.id}')">${t.label} <span class="badge bg-secondary rounded-pill ms-1" style="font-size:0.65rem;">${t.count}</span></button>`;
    });
    html += `</div>`;
    
    if (activeList.length === 0) { 
        html += `<div class="text-center py-5 text-muted glass-card">
            <div style="font-size:3rem;">&#128101;</div>
            <div class="mt-2">ยังไม่มีข้อมูลในหมวดนี้</div>
        </div>`; 
    } else {
        html += '<div class="hof-grid pb-4">';
        activeList.sort((a, b) => (b.score || 0) - (a.score || 0)).forEach(u => {
            const vLabel = typeof getDominantVirtueLabel === 'function' ? getDominantVirtueLabel(u.virtueStats) : { label: 'มุ่งมั่น', color: '#6c5ce7' };
            const scoreText = u.score > 0 ? `<div class="small text-muted mt-1">${(u.score || 0).toLocaleString()} XP</div>` : '';
            html += `<div class="hof-card" onclick="openRelationDetail('${u.id}')">
                <img src="${u.img || 'https://via.placeholder.com/80'}" class="hof-avatar" onerror="this.src='https://via.placeholder.com/80'">
                <h5 class="text-truncate mt-2">${u.name}</h5>
                <small class="badge bg-light text-dark border">${u.role}</small>
                <div class="mt-2 small" style="color:${vLabel.color}">
                    <i class="fas fa-heart me-1"></i>${vLabel.label}
                </div>
                ${scoreText}
            </div>`;
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
        const vLabel = typeof getDominantVirtueLabel === 'function' ? getDominantVirtueLabel(v) : { label: '喔炧笝喔编竵喔囙覆喔', color: '#6c5ce7', key: 'none' };
        content.innerHTML = `<div class="p-4 text-center"><img src="${user.img || 'https://via.placeholder.com/100'}" class="profile-img-large shadow mb-3"><h4 class="fw-bold">${user.name}</h4><div class="badge bg-warning text-dark mb-4">${user.role}</div><div class="staff-stat-card mb-3 p-3"><strong>喔副喔曕弗喔编竵喔┼笓喙: ${vLabel.label}</strong><p class="small text-muted">${typeof getVirtueDescription === 'function' ? getVirtueDescription(vLabel.key) : ''}</p></div><div style="height:200px;"><canvas id="relationRadarChart"></canvas></div><div id="relationHistoryContainer" class="mt-4 text-start"><hr><small class="text-muted">喔涏福喔班抚喔编笗喔脆箑喔｀阜喙堗腑喔囙福喔侧抚</small></div></div>`;
        setTimeout(() => drawPremiumRadar('relationRadarChart', [v.volunteer || 0, v.sufficiency || 0, v.discipline || 0, v.integrity || 0, v.gratitude || 0]), 300);
    }
}

function closeRelationDetail() {
    const list = document.getElementById('relationListView'); const detail = document.getElementById('relationDetailView');
    if (list) list.style.display = 'block'; if (detail) detail.style.display = 'none';
}

function setRelationSubTab(tab) { currentRelationSubTab = tab; renderRelationTab(); }

// =====================================================
// 馃摑 喔｀赴喔氞笟喔箞喔囙箑喔｀阜喙堗腑喔囙福喔侧抚 喙佮弗喔 喔副喔涏箓喔弗喔
// =====================================================
function handleFileSelect(input) {
    const files = Array.from(input.files); if (files.length === 0) return;
    if (currentImageFiles.length + files.length > 20) { Swal.fire('喙佮笀喙夃竾喙€喔曕阜喔笝', '喔副喔涏箓喔弗喔斷箘喔斷箟喔腹喔囙釜喔膏笖 20 喔犩覆喔炧竸喔｀副喔', 'warning'); return; }
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

function setMood(val, btn) { selectedMood = val; document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
function addEmoji(emoji) { const input = document.getElementById('noteInput'); if (input) { input.value += emoji + ' '; input.focus(); } }

async function submitData() {
    const virtue = document.getElementById('virtueSelect').value; const note = document.getElementById('noteInput').value.trim();
    if (!virtue) { Swal.fire('喙佮笀喙夃竾喙€喔曕阜喔笝', '喔佮福喔膏笓喔侧箑喔ム阜喔竵喔浮喔о笖喔勦抚喔侧浮喔斷傅', 'warning'); return; }
    const tagged = Array.from(document.querySelectorAll('.friend-item.selected')).map(el => el.dataset.id);
    const privacy = document.querySelector('input[name="privacyOption"]:checked').value;

    Swal.fire({ title: '喔佮赋喔ム副喔囙腑喔编笡喙傕斧喔ム笖喔｀腹喔涏笭喔侧笧...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    let finalImageUrl = document.getElementById('mediaLinkInput')?.value.trim() || '';
    if (currentImageFiles.length > 0) {
        const urls = [];
        for (let i = 0; i < currentImageFiles.length; i++) {
            Swal.update({ title: `喔佮赋喔ム副喔囙腑喔编笡喙傕斧喔ム笖 (${i + 1}/${currentImageFiles.length})` });
            const url = await uploadImageToCloudinary(currentImageFiles[i]); if (url) urls.push(url);
        }
        finalImageUrl = (finalImageUrl ? finalImageUrl + ',' : '') + urls.join(',');
    }

    Swal.fire({ title: '喔佮赋喔ム副喔囙笟喔编笝喔椸付喔...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const now = new Date(); const uuid = 'sup_' + Date.now().toString(36);
        const { error } = await supabaseClient.from('Activities').insert({
            UUID: uuid, Date: now.toLocaleDateString('en-CA'), Time: now.toTimeString().split(' ')[0], UserId: currentUser.userId, UserName: currentUser.name, Virtue: virtue, Note: note, Happy: parseInt(selectedMood), Image: finalImageUrl, Tagged: tagged.join(','), Privacy: privacy, JSON: { likes: [], verifies: [] }, Status: privacy === 'private' ? 'private' : 'waiting_verify', Score: 0
        });
        if (error) throw error;
        Swal.fire('喔氞副喔權笚喔多竵喔赋喙€喔｀箛喔', '喙佮笂喔｀箤喙€喔｀阜喙堗腑喔囙福喔侧抚喙€喔｀傅喔⑧笟喔｀箟喔涪喔勦福喔编笟', 'success');
        document.getElementById('noteInput').value = ''; currentImageFiles = []; renderThumbnails(); switchTab('stories', document.getElementById('nav-stories-btn'));
        if (typeof fetchFeed === 'function') fetchFeed(false, true);
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

// =====================================================
// 馃弲 喔｀赴喔斷副喔氞箑喔ム箑喔о弗 & 喙€喔福喔掂涪喔嵿笗喔｀覆 UI
// =====================================================
function getCalculatedLevel(badgeKey, userStats, userScore, userTotal) {
    const config = badgeConfig[badgeKey]; if (!config) return 0;
    let currentCount = config.source === 'score' ? userScore : (config.source === 'total' ? userTotal : (userStats[badgeKey] || 0));
    let calculatedLevel = 0;
    for (let i = config.levels.length - 1; i >= 0; i--) { if (currentCount >= config.levels[i].count) { calculatedLevel = i + 1; break; } }
    return calculatedLevel;
}

function revealUpgrade(badgeKey, newLevelIdx, title, icon) {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    Swal.fire({ html: `<div class="text-center"><h3 style="color:#f39c12;">馃帀 喙€喔ム阜喙堗腑喔權競喔编箟喔權釜喔赤箑喔｀箛喔</h3><div style="font-size:5rem;">${icon}</div><h5>喔勦父喔撪箘喔斷箟喔｀副喔氞箑喔福喔掂涪喔 <span style="color:var(--primary);">${title}</span></h5></div>`, confirmButtonColor: '#6c5ce7', confirmButtonText: '喔父喔斷涪喔笖!', customClass: { popup: 'glass-card' } });
}

function viewBadge(title, desc, icon) {
    Swal.fire({ html: `<div class="text-center"><div style="font-size:4.5rem;">${icon}</div><h4 style="color:var(--primary);">${title}</h4><p>${desc}</p></div>`, confirmButtonColor: '#6c5ce7', confirmButtonText: '喔涏复喔', customClass: { popup: 'glass-card' } });
}

// =====================================================
// 馃敂 喔｀赴喔氞笟喔涏福喔班竵喔侧辅 UI
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

async function saveAnnouncement() {
    const title = document.getElementById('ann-title').value.trim(); const date = document.getElementById('ann-date').value;
    const body = document.getElementById('ann-body').value.trim(); const category = document.getElementById('ann-category').value;
    if (!title || !date) { Swal.fire('喙€喔曕阜喔笝', '喔佮福喔膏笓喔侧竵喔｀腑喔佮斧喔编抚喔傕箟喔箒喔ム赴喔о副喔權笚喔掂箞', 'warning'); return; }
    Swal.fire({ title: '喔佮赋喔ム副喔囙笟喔编笝喔椸付喔...', didOpen: () => Swal.showLoading() });
    try {
        if (READ_FROM_SUPABASE && supabaseClient) {
            await supabaseClient.from('Announcements').insert({ ID: 'ann_'+Date.now(), Title: title, Body: body, EventDate: date, Category: category, PostedBy: currentUser.userId, Date: new Date().toISOString().split('T')[0], Time: new Date().toTimeString().split(' ')[0], Status: 'active' });
        } else {
            await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'save_announcement', title, eventDate: date, body, category, postedBy: currentUser.userId }) });
        }
        closeAnnounceModal(); Swal.fire('喔赋喙€喔｀箛喔', '喔氞副喔權笚喔多竵喔涏福喔班竵喔侧辅喙佮弗喙夃抚', 'success'); if (typeof fetchAnnouncements === 'function') fetchAnnouncements();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

// =====================================================
// 馃洜锔 Admin & Maintenance
// =====================================================
async function approveUser(lineId) { if (!supabaseClient) return; try { await supabaseClient.from('Users').update({ Status: 'active', Role: 'Staff' }).eq('LineID', lineId); Swal.fire('喔赋喙€喔｀箛喔', '喔笝喔膏浮喔编笗喔脆箒喔ム箟喔', 'success'); if (typeof fetchManagerData === 'function') fetchManagerData(); } catch (e) { Swal.fire('Error', e.message, 'error'); } }
async function rejectUser(lineId) { if (!supabaseClient) return; try { await supabaseClient.from('Users').update({ Status: 'rejected' }).eq('LineID', lineId); Swal.fire('喙€喔｀傅喔⑧笟喔｀箟喔涪', '喔涏笍喔脆箑喔笜喙佮弗喙夃抚', 'info'); if (typeof fetchManagerData === 'function') fetchManagerData(); } catch (e) { Swal.fire('Error', e.message, 'error'); } }
async function repairAllUserScores() { if (!supabaseClient) return; Swal.fire({ title: '喔涏福喔班浮喔о弗喔溹弗...', didOpen: () => Swal.showLoading() }); try { const { data } = await supabaseClient.from('Users').select('LineID'); for (const u of data) { if (typeof syncUserScore === 'function') await syncUserScore(u.LineID); } Swal.fire('喔赋喙€喔｀箛喔', '喔｀傅喙€喔熰福喔娻竸喔笝喙€喔椸笝喔曕箤喙佮弗喔班竸喔班箒喔權笝喔椸父喔佮竸喔權箒喔ム箟喔', 'success').then(() => location.reload()); } catch (e) { Swal.fire('Error', e.message, 'error'); } }

// =====================================================
// 馃殌 Initialization & Tracking
// =====================================================
async function trackAppVisit() {
    if (!currentUser || !currentUser.userId) return;
    try { const now = new Date(); if (supabaseClient) { await supabaseClient.from('Users').update({ LastDate: now.toLocaleDateString('en-CA'), LastTime: now.toTimeString().split(' ')[0] }).eq('LineID', currentUser.userId); } }
    catch (e) { console.warn('Visit track error:', e); }
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
function safetyResumeMusic() { const m = document.getElementById('bgMusic'); if (m && m.paused && localStorage.getItem('bg_music_enabled') === 'true') m.play().catch(()=>{}); }
function scrollToTopAndRefresh() { window.scrollTo({ top: 0, behavior: 'smooth' }); if (typeof fetchFeed === 'function') fetchFeed(false, false, true); }
function setupBackgroundSync() { setInterval(() => { if (currentUser) { if (typeof fetchAnnouncements === 'function') fetchAnnouncements(true); if (typeof fetchFeed === 'function') fetchFeed(false, true); } }, 60000); }

// =====================================================
// 馃巵 喔｀赴喔氞笟喔｀覆喔囙抚喔编弗 UI
// =====================================================
window.fetchRewards = async function () {
    if (!supabaseClient) return;
    try {
        const { data: rewards } = await supabaseClient.from('Rewards').select('*').order('Date', { ascending: false });
        window.globalRewardsData = (rewards || []).filter(r => r.Status !== 'inactive');
        const { data: claims } = await supabaseClient.from('Claims').select('*');
        window.globalClaimsData = (claims || []).map(c => ({ rewardId: c.RewardID, userId: c.UserID, status: c.Status }));
        if (typeof renderUserRewards === 'function') renderUserRewards();
        if (typeof renderExecutiveRewards === 'function') renderExecutiveRewards();
    } catch (e) { console.error('Rewards error:', e); }
};

window.renderUserRewards = function () {
    const clist = document.getElementById('challengeRewardList'); const mlist = document.getElementById('milestoneRewardList');
    if (!clist || !mlist) return; const rewards = window.globalRewardsData || []; const lifetimeXP = currentUser?.score || 0;
    const buildCard = (r, xp, color) => {
        const target = r.TargetVal || 100; const pct = Math.min(100, Math.round((xp / target) * 100));
        const unlocked = xp >= target; const claimed = (window.globalClaimsData || []).some(c => c.rewardId == r.ID && String(c.userId) == String(currentUser.userId));
        const icon = claimed ? 'fa-check-circle' : (unlocked ? 'fa-gift animate__animated animate__bounce animate__infinite' : 'fa-lock');
        return `<div class="glass-card p-3 text-center mb-3"><div class="mb-2 text-${unlocked ? 'warning' : 'muted'}"><i class="fas ${icon} fa-3x"></i></div><div class="fw-bold small">${r.Name}</div><div class="progress mt-2" style="height:6px;"><div class="progress-bar" style="width:${pct}%; background:${color}"></div></div>${unlocked && !claimed ? `<button class="btn btn-xs btn-primary mt-2 rounded-pill" onclick="claimReward('${r.ID}', '${r.Name}')">喙佮弗喔佮福喔侧竾喔о副喔�</button>` : ''}</div>`;
    };
    mlist.innerHTML = rewards.filter(r => r.Mode == 1).map(r => buildCard(r, lifetimeXP, '#28a745')).join('');
    clist.innerHTML = rewards.filter(r => r.Mode == 2).map(r => buildCard(r, 0, '#ff9f43')).join('');
};

async function claimReward(id, title) {
    const res = await Swal.fire({ title: '喔⑧阜喔權涪喔编笝喔佮覆喔｀福喔编笟喔｀覆喔囙抚喔编弗?', text: `喙冟笂喙夃竸喔班箒喔權笝喙佮弗喔� ${title}?`, showCancelButton: true });
    if (res.isConfirmed && supabaseClient) { try { await supabaseClient.from('Claims').insert({ RewardID: id, UserID: currentUser.userId, Date: new Date().toISOString() }); Swal.fire('喔�赋喙€喔｀箛喔�', '喙佮笀喙夃竾喔｀副喔氞福喔侧竾喔о副喔ム箒喔ム箟喔�', 'success'); fetchRewards(); } catch (e) { Swal.fire('Error', e.message, 'error'); } }
}

// =====================================================
// ?? Staff Table & Dashboard UI
// =====================================================
function filterStaffList() {
    const query = document.getElementById("staffFilterInput").value.toLowerCase().trim();
    const rows = document.querySelectorAll("#staffListArea .staff-row, #guestListArea .staff-row");
    rows.forEach(row => {
        const name = row.querySelector(".fw-bold")?.innerText.toLowerCase() || "";
        const role = row.querySelector(".badge")?.innerText.toLowerCase() || "";
        row.style.display = (name.includes(query) || role.includes(query)) ? "block" : "none";
    });
}

function renderStaffTable(map) {
    const sList = document.getElementById("staffListArea");
    const gList = document.getElementById("guestListArea");
    const hList = document.getElementById("hofExecutiveListArea");
    if (!sList) return;
    sList.innerHTML = ""; if (gList) gList.innerHTML = ""; if (hList) hList.innerHTML = "";
    const allUsers = Object.values(map);
    const activeStaff = allUsers.filter(u => typeof shouldIncludeInStats === "function" && shouldIncludeInStats(u.role));
    const guestStaff = allUsers.filter(u => typeof isGuest === "function" && isGuest(u.role));
    const hofExecutives = allUsers.filter(u => typeof isAlumni === "function" && isAlumni(u.role) && ["Manager", "Admin", "Executive", "搜撬归�", "假楹迷艘�", "纪.", "づ学ㄑ�茄�"].some(r => (u.role || "").toLowerCase().includes(r.toLowerCase())));
    if (activeStaff.length > 0) activeStaff.sort((a, b) => (b.score || 0) - (a.score || 0)).forEach(f => renderStaffRow(f, sList));
    else sList.innerHTML = "<div class=\"text-center py-5 text-muted\">淞杈好衣�柰贺づ摇�</div>";
    if (hofExecutives.length > 0) {
        const hSection = document.getElementById("hofExecutiveSection"); if (hSection) hSection.style.display = "block";
        hofExecutives.sort((a, b) => (b.score || 0) - (a.score || 0)).forEach(f => renderStaffRow(f, hList, true));
    }
    if (guestStaff.length > 0) {
        const gSection = document.getElementById("guestSectionArea"); if (gSection) gSection.style.display = "block";
        guestStaff.forEach(f => renderStaffRow(f, gList));
    }
}

function renderStaffRow(f, container, isHOF = false) {
    const score = parseFloat(f.happyScore || f.avgHappy) || 0;
    let status = isHOF ? "status-legend" : (score < 5 ? "status-critical" : (score < 7 ? "status-warning" : "status-normal"));
    let approvalHtml = (f.status === "waiting_approval" && typeof canManageSystem === "function" && canManageSystem()) ? 
        `<div class="mt-2 d-flex gap-2 p-2 rounded-4" style="background: rgba(108, 92, 231, 0.05); border: 1px dashed var(--primary-color);">
            <button class="btn btn-xs btn-primary flex-grow-1 rounded-pill fw-bold" onclick="event.stopPropagation(); approveUser(\"${f.id}\")">凸亓训�</button>
            <button class="btn btn-xs btn-outline-danger rounded-pill" onclick="event.stopPropagation(); rejectUser(\"${f.id}\")">化脏矢</button>
        </div>` : "";
    const div = document.createElement("div");
    div.className = `p-3 staff-row border-bottom ${status}`;
    div.onclick = () => showStaffModal(f.id);
    div.innerHTML = `
        <div class="d-flex align-items-center mb-2">
            <div class="position-relative">
                <img src="${f.img || "https://dummyimage.com/55x55/ccc/fff"}" style="width:55px;height:55px;border-radius:50%;margin-right:15px;object-fit:cover;">
                <span class="position-absolute bottom-0 end-0 badge rounded-pill bg-dark border border-white" style="font-size:0.6rem;">Lv.${f.level}</span>
            </div>
            <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-center">
                    <div><h6 class="fw-bold mb-0">${f.name}</h6><span class="badge bg-light text-dark border mt-1 small">${f.role}</span></div>
                    <div class="text-end"><div class="fw-bold">${typeof formatCompactNumber === "function" ? formatCompactNumber(f.score) : f.score} / ${score.toFixed(1)}</div>
                    <div class="progress mt-1" style="height: 4px; width: 60px; margin-left: auto;"><div class="progress-bar" style="width: ${((f.score % 500) / 5)}%; background-color: ${score < 5 ? "#e74c3c" : (score < 7 ? "#f39c12" : "#27ae60")};"></div></div></div>
                </div>
            </div>
        </div>${approvalHtml}`;
    container.appendChild(div);
}

function showStaffModal(uid) {
    const user = globalUserStatsMap[uid]; if (!user) return;
    const v = user.virtueStats || {};
    const happyScore = parseFloat(user.happyScore || user.avgHappy || 0);
    const virtueLabel = typeof getDominantVirtueLabel === "function" ? getDominantVirtueLabel(v) : { label: "竟选б�", key: "none" };
    const virtueDesc = typeof getVirtueDescription === "function" ? getVirtueDescription(virtueLabel.key) : "";
    const activityRange = typeof getActivityRange === "function" ? getActivityRange(uid) : "";
    Swal.fire({
        title: "㈤土倥贺づ摇�",
        html: `
            <div style="text-align:left;" class="staff-modal-content">
                <div class="d-flex align-items-center mb-4"><img src="${user.img || "https://via.placeholder.com/60"}" style="width:70px;height:70px;border-radius:20px;margin-right:15px;object-fit:cover;"><div><h5 class="fw-bold mb-1">${user.name}</h5><div class="badge bg-light text-primary border">${user.role}</div></div></div>
                <div class="row g-2 mb-3"><div class="col-6"><div class="staff-stat-card"><small>で伊守�</small><br><b>${happyScore.toFixed(1)} / 10</b></div></div><div class="col-6"><div class="staff-stat-card"><small>ば峁故惺�</small><br><b>${user.score.toLocaleString()} XP</b></div></div></div>
                <div class="staff-stat-card mb-3 p-3"><strong class="text-primary">九学啻韫: ${virtueLabel.label}</strong><p class="mb-1 text-muted small">${virtueDesc}</p><small class="text-muted d-block mt-1">${activityRange}</small></div>
                <div class="mt-4"><canvas id="staffRadarChart" style="height:200px;"></canvas></div>
                ${typeof canManageSystem === "function" && canManageSystem() ? `<div class="mt-3 d-flex gap-2"><button class="btn btn-warning btn-sm flex-grow-1" onclick="promoteToAlumni(\"${user.id}\")">⒅楣酚喙章�</button><button class="btn btn-primary btn-sm flex-grow-1" onclick="changeUserRole(\"${user.id}\")">嗷耪杪故苑冈�</button></div>` : ""}
            </div>`,
        showConfirmButton: false, showCloseButton: true,
        didOpen: () => {
            const dataPoints = [v.volunteer || 0, v.sufficiency || 0, v.discipline || 0, v.integrity || 0, v.gratitude || 0];
            if (typeof drawPremiumRadar === "function") drawPremiumRadar("staffRadarChart", dataPoints);
        }
    });
}

// =====================================================
// Admin Actions (Missing from cleanup)
// =====================================================
async function promoteToAlumni(uid) {
    const user = globalUserStatsMap[uid]; if (!user) return;
    const { value: year } = await Swal.fire({ title: 'ขึ้นทำเนียบ ' + user.name, input: 'text', inputLabel: 'ปี พ.ศ.', inputPlaceholder: '2567', showCancelButton: true });
    if (!year || !supabaseClient) return;
    const newRole = 'ศิษย์เก่า (' + user.role + ') ปี ' + year;
    try { await supabaseClient.from('Users').update({ Role: newRole }).eq('LineID', uid); Swal.close(); Swal.fire('สำเร็จ', user.name + ' ขึ้นทำเนียบแล้ว', 'success'); if (typeof fetchManagerData === 'function') fetchManagerData(); }
    catch (e) { Swal.fire('Error', e.message, 'error'); }
}

async function changeUserRole(uid) {
    const user = globalUserStatsMap[uid]; if (!user) return;
    const roles = ['Admin', 'Manager', 'NewsEditor', 'Staff', 'Guest'];
    const opts = {};
    roles.forEach(r => { opts[r] = r; });
    const { value: newRole } = await Swal.fire({ title: 'เปลี่ยนสิทธิ์ ' + user.name, input: 'select', inputOptions: opts, inputValue: user.role, showCancelButton: true });
    if (!newRole || !supabaseClient) return;
    try { await supabaseClient.from('Users').update({ Role: newRole }).eq('LineID', uid); Swal.fire('สำเร็จ', 'เปลี่ยนเป็น ' + newRole + ' แล้ว', 'success'); if (typeof fetchManagerData === 'function') fetchManagerData(); }
    catch (e) { Swal.fire('Error', e.message, 'error'); }
}

function drawPersonalVirtueBarChart(stats, canvasId) {
    canvasId = canvasId || 'personalVirtueBarChart';
    const canvas = document.getElementById(canvasId);
    if (!canvas) return; // ไม่มี canvas นี้ในหน้านี้ — ข้ามได้เลย
    if (canvas._chart) { canvas._chart.destroy(); }
    const virtues = [
        { key: 'volunteer', label: 'จิตอาสา', color: '#3498db' },
        { key: 'sufficiency', label: 'พอเพียง', color: '#2ecc71' },
        { key: 'discipline', label: 'วินัย', color: '#9b59b6' },
        { key: 'integrity', label: 'สุจริต', color: '#1abc9c' },
        { key: 'gratitude', label: 'กตัญญู', color: '#e84393' }
    ];
    canvas._chart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: virtues.map(function(v) { return v.label; }),
            datasets: [{ data: virtues.map(function(v) { return stats[v.key] || 0; }), backgroundColor: virtues.map(function(v) { return v.color + 'cc'; }), borderRadius: 8 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

// === MISSING FUNCTIONS PATCH ===
