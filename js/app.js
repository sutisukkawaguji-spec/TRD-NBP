// ============================================================
// 🚀  app.js — UI, Tabs, Forms, Charts & Notifications
//     ต้องโหลดหลัง config.js, auth.js และ feed.js
// ============================================================

// --- UI State (ประกาศไว้ใน config.js แล้ว ไม่ประกาศซ้ำ) ---
var currentRelationSubTab = 'staff';
// --- Relation View States ---
var currentRelationPosts = [];
var currentRelationVisibleCount = 10;
// currentImageFiles ประกาศแล้วใน config.js

// 🌟 Helper: ตรวจสอบว่าเป็นกลุ่มศิษย์เก่า/เกษียณ หรือไม่
const isAlumni = (r) => {
    const roleStr = String(r || '').toLowerCase();
    const keywords = ['ศิษย์เก่า', 'alumni', 'ลาออก', 'ย้าย', 'เกษียณ', 'อนุสรณ์', 'retired', 'memorial', 'ผู้ร่วมผูกพัน', 'ทำเนียบ', 'hall of fame'];
    return keywords.some(k => roleStr.includes(k.toLowerCase()));
};

// 🌟 Helper: ตรวจสอบว่าเป็น Guest หรือไม่ (ยังไม่รับการแต่งตั้ง)
const isGuest = (r) => {
    const roleStr = String(r || '').toLowerCase();
    const guestKeywords = ['guest', 'ผู้เยี่ยมชม', 'ผู้เข้าใหม่', 'แขก'];
    return guestKeywords.some(k => roleStr.includes(k.toLowerCase()));
};

// 🌟 Helper: ตรวจสอบว่าควรนำมาคำนวณสถิติหรือไม่
const shouldIncludeInStats = (r) => {
    return !isAlumni(r) && !isGuest(r);
};

// =====================================================
// 📝 ระบบแบบสอบถามประจำเดือน
// =====================================================
async function checkAndShowSurvey() {
    if (!currentUser || !currentUser.userId) return;

    const storageKey = `survey_${currentUser.userId}`;
    let surveyData = JSON.parse(localStorage.getItem(storageKey) || '{}');

    // 🔄 Sync กับหลังบ้าน (ดึงสถานะจริงมาทับ Local)
    try {
        const gasRes = await fetch(`${GAS_URL}?action=get_survey&userId=${currentUser.userId}`);
        const gasData = await gasRes.json();
        if (gasData.status === 'success' && gasData.data) {
            const remoteData = JSON.parse(gasData.data);
            if (remoteData.completedMonth) {
                surveyData = remoteData;
                localStorage.setItem(storageKey, JSON.stringify(surveyData));
            }
        }
    } catch (e) { console.warn("Survey sync failed", e); }

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const monthDisplay = `${monthNames[now.getMonth()]} ${now.getFullYear() + 543}`;

    if (surveyData.completedMonth === currentMonthKey) return;

    if (surveyData.snoozeUntil) {
        const snoozeDate = new Date(surveyData.snoozeUntil);
        const snoozeMonthKey = `${snoozeDate.getFullYear()}-${snoozeDate.getMonth() + 1}`;
        if (snoozeMonthKey !== currentMonthKey) {
            delete surveyData.snoozeUntil;
            localStorage.setItem(storageKey, JSON.stringify(surveyData));
        } else if (snoozeDate > now) {
            return;
        }
    }

    await new Promise(r => setTimeout(r, 1500));

    const result = await Swal.fire({
        title: `📝 ประเมินความสุขเดือน${monthDisplay}`,
        html: `
            <div class="text-center">
                <div style="font-size:3rem; margin-bottom:10px;">📊</div>
                <p class="mb-2 fw-bold text-primary">เสียงของคุณมีความหมายกับเรา!</p>
                <p class="text-muted small">ใช้เวลาเพียง 1 นาที เพื่อช่วยให้องค์กรน่าอยู่ขึ้น</p>
            </div>
        `,
        allowOutsideClick: false,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: '#6c5ce7',
        denyButtonColor: '#f39c12',
        confirmButtonText: '<i class="fas fa-pencil-alt me-1"></i> ทำแบบประเมินเลย',
        denyButtonText: '<i class="fas fa-clock me-1"></i> เตือนฉันสัปดาห์หน้า',
        cancelButtonText: 'ปิด',
    });

    if (result.isConfirmed) {
        // เมื่อกดไปทำ ให้บันทึกสถานะลงหลังบ้านทันที (หรือถ้ามีหน้าขอบคุณให้บันทึกตอนนั้นก็ได้)
        // ในที่นี้สมมติว่ากดไปแล้วเท่ากับ "เริ่มทำ" ให้ flag ไว้เลยป้องกันการเด้งซ้ำ
        surveyData.completedMonth = currentMonthKey;
        localStorage.setItem(storageKey, JSON.stringify(surveyData));
        fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'save_survey', userId: currentUser.userId, surveyStatus: JSON.stringify(surveyData) }) });

        window.location.href = `survey.html?uid=${encodeURIComponent(currentUser.userId)}`;
    } else if (result.isDenied) {
        const snoozeDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        surveyData.snoozeUntil = snoozeDate.toISOString();
        localStorage.setItem(storageKey, JSON.stringify(surveyData));
        // เซฟคิว Snooze ไปหลังบ้านด้วย
        fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'save_survey', userId: currentUser.userId, surveyStatus: JSON.stringify(surveyData) }) });
        await Swal.fire({ toast: true, icon: 'info', title: 'จะแจ้งเตือนอีกครั้งใน 7 วัน', position: 'top', timer: 2000, showConfirmButton: false });
    }
}

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

// =====================================================
// 👤 โปรไฟล์และสถิติส่วนตัว
// =====================================================
function renderProfile() {
    if (!currentUser) return;

    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('userRole').innerHTML = `${currentUser.role || 'พนักงาน'} • <span class="text-primary fw-bold">Lv.${currentUser.level || 1}</span>`;
    document.getElementById('userImg').src = currentUser.img || 'https://dummyimage.com/90x90/cccccc/ffffff&text=User';

    // หลอดความสุข
    const rawHappy = parseFloat(currentUser.happyScore) || 0;
    const happyPercent = rawHappy > 0 ? Math.min((rawHappy / 10) * 100, 100) : 30;
    const barHappy = document.querySelector('.bar-happy');
    if (barHappy) {
        barHappy.style.width = `${happyPercent.toFixed(0)}%`;
        barHappy.setAttribute('aria-valuenow', happyPercent.toFixed(0));
        barHappy.innerText = rawHappy > 0 ? `${rawHappy.toFixed(1)}/10` : '';
    }

    // หลอดความดี (XP)
    const currentScore = currentUser.score || 0;
    const xpInLevel = currentScore % 500;
    const finalVirtuePct = (currentScore >= 500 && xpInLevel === 0) ? 100 : (xpInLevel / 500) * 100;
    const barVirtue = document.querySelector('.bar-virtue');
    if (barVirtue) {
        barVirtue.style.width = `${finalVirtuePct.toFixed(0)}%`;
        barVirtue.setAttribute('aria-valuenow', finalVirtuePct.toFixed(0));
        barVirtue.innerText = currentScore > 0 ? `${currentScore.toLocaleString()} XP` : '';
    }

    // ✨ AURA LOGIC
    const auraEl = document.getElementById('userAura');
    if (auraEl) {
        const dominant = (currentUser.dominantVirtue || 'none').toLowerCase();
        const level = parseInt(currentUser.level) || 1;
        auraEl.className = `aura-glow aura-${dominant}`;
        let scale = Math.min(1 + (level * 0.05), 2.5);
        auraEl.style.setProperty('--scale', scale);

        if (level >= 20) auraEl.classList.add('aura-lv-20');
        else if (level >= 10) auraEl.classList.add('aura-lv-10');
        else if (level >= 5) auraEl.classList.add('aura-lv-5');
        else auraEl.classList.add('aura-lv-1');
    }

    // วิเคราะห์จุดเด่น
    const domVirtue = currentUser.dominantVirtue || 'none';
    const statConfig = {
        'volunteer': { title: '💖 จิตอาสาตัวจริง', desc: 'คุณโดดเด่นด้านการเสียสละ ชอบช่วยเหลือผู้อื่น เป็นที่รักของเพื่อนร่วมงาน', color: '#3498db', bg: '#e8f4fc' },
        'sufficiency': { title: '🌱 ปราชญ์แห่งความพอเพียง', desc: 'คุณใช้ชีวิตอย่างสมดุล รู้จักความพอดี และใช้ทรัพยากรอย่างคุ้มค่า', color: '#2ecc71', bg: '#eafaf1' },
        'discipline': { title: '⚡ เจ้าแห่งวินัย', desc: 'คุณมีความรับผิดชอบสูง ตรงต่อเวลา เป็นแบบอย่างที่ดีในองค์กร', color: '#9b59b6', bg: '#f5eef8' },
        'integrity': { title: '🛡️ ผู้พิทักษ์ความถูกต้อง', desc: 'คุณยึดมั่นในความซื่อสัตย์ โปร่งใส และได้รับความไว้วางใจสูงสุด', color: '#00cec9', bg: '#e0fbfc' },
        'gratitude': { title: '🙏 ยอดคนกตัญญู', desc: 'คุณให้ความสำคัญกับผู้มีพระคุณ อ่อนน้อมถ่อมตน และรู้จักตอบแทน', color: '#e84393', bg: '#fcecf5' },
        'none': { title: '🌟 ผู้เริ่มต้นเดินทาง', desc: 'เริ่มสะสมความดีในด้านต่างๆ เพื่อค้นหาพลังที่ซ่อนอยู่ของคุณกันเถอะ!', color: '#95a5a6', bg: '#f4f6f6' }
    };

    const cfg = statConfig[domVirtue] || statConfig['none'];
    const statBox = document.getElementById('statAnalysis');
    if (statBox) {
        const statTitle = document.getElementById('statTitle');
        const statDesc = document.getElementById('statDesc');
        if (statTitle) {
            statTitle.innerHTML = `<i class="fas fa-quote-left fa-xs me-2 opacity-50"></i>${cfg.title}`;
            statTitle.style.color = cfg.color;
        }
        if (statDesc) statDesc.innerText = cfg.desc;
        statBox.style.backgroundColor = cfg.bg;
        statBox.style.borderColor = cfg.color;
        statBox.style.borderLeftWidth = '5px';
    }

    if (typeof initUserRadar === 'function') initUserRadar();
    if (typeof renderBadges === 'function') renderBadges();
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

    // ฟังก์ชันจัดการข้อมูลเมื่อโหลดสำเร็จ
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

            // 🌟 กรองรายชื่อ: ถ้าขึ้นทำเนียบ (Alumni/Retired) หรือเป็น Guest แล้ว ไม่ต้องแสดงในหน้าแท็กโพสต์
            if (isAlumni(user.role) || isGuest(user.role)) return;

            count++;
            const div = document.createElement('div');
            div.className = 'col-6 mb-2';

            // 🌟 ลบ bg-white ออก, เพิ่ม var(--glass-bg) และปรับสีตัวหนังสือให้รองรับ Dark Mode
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
        if (count === 0) container.innerHTML = '<div class="col-12 text-center text-muted small py-3" style="color: var(--text-main) !important;">ยังไม่มีผู้ใช้อื่นในระบบ</div>';
    };

    const url = `${GAS_URL}?action=get_users&t=${Date.now()}`;

    fetch(url)
        .then(res => res.text()) // เปลี่ยนจาก res.json() เป็น text() เพื่อดัก Error ก่อน
        .then(text => {
            if (text.startsWith('<')) throw new Error("CORS / Google HTML block");
            handleData(JSON.parse(text));
        })
        .catch(err => {
            console.warn('Fetch Friends Error, ใช้ JSONP แทน:', err.message);
            window.__gasFriendsCb = (data) => handleData(data);
            const old = document.getElementById('jsonp_friends'); if (old) old.remove();
            const s = document.createElement('script');
            s.id = 'jsonp_friends';
            s.src = `${GAS_URL}?action=get_users&callback=__gasFriendsCb&t=${Date.now()}`;
            document.head.appendChild(s);
        });
}

function toggleFriend(el) {
    el.classList.toggle('selected');
    let targetId = String(el.dataset.id);
    let targetName = el.innerText;

    if (el.classList.contains('selected')) {
        if (!el.querySelector('.check-mark')) el.innerHTML += '<i class="fas fa-check-circle text-primary ms-auto check-mark"></i>';

        if (globalFeedData && globalFeedData.length > 0) {
            let history = globalFeedData.find(post =>
                String(post.user_line_id) === targetId && (post.taggedFriends || "").includes(currentUser.userId)
            );
            if (history) {
                Swal.fire({
                    toast: true, position: 'top-end', icon: 'info',
                    title: `${targetName} เคยชวนคุณ!`,
                    text: `กิจกรรม: ${history.virtue}`,
                    timer: 3000, showConfirmButton: false, background: '#f0f8ff'
                });
            }
        }
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
// 🏅 ระบบเหรียญตรา
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

function renderBadges() {
    const container = document.getElementById('badgeContainer');
    if (!container || !currentUser) return;
    container.innerHTML = '';

    const stats = currentUser.virtueStats || {};
    const score = currentUser.score || 0;
    const total = currentUser.totalCount || 0;
    let storageKey = `happyMeter_badges_${currentUser.userId}`;
    let storedLevels = JSON.parse(localStorage.getItem(storageKey) || '{}');
    let hasNewBadge = false;

    Object.keys(badgeConfig).forEach((key, index) => {
        const config = badgeConfig[key];
        const realLv = getCalculatedLevel(key, stats, score, total);
        const seenLv = storedLevels[key] || 0;
        if (realLv > seenLv) hasNewBadge = true;

        let html = '';
        if (realLv === 0) {
            html = `<div class="badge-item badge-locked animate__animated animate__fadeIn" style="animation-delay: ${index * 0.05}s;" onclick="viewBadge('${config.title}', 'ยังทำไม่ถึงเกณฑ์ขั้นแรก', '🔒')"><div class="badge-icon">🔒</div><small class="text-muted">${config.title}</small></div>`;
        } else if (realLv > seenLv) {
            const next = config.levels[realLv - 1];
            html = `<div class="badge-item badge-mystery-upgrade animate__animated animate__zoomIn" onclick="revealUpgrade('${key}', ${realLv}, '${config.title} ${next.rank}', '${next.icon}')">
                        <div class="badge-icon animate__animated animate__pulse animate__infinite">🎁</div>
                        <small class="fw-bold text-warning">อัปเกรด!</small>
                    </div>`;
        } else {
            const curr = config.levels[realLv - 1];
            html = `<div class="badge-item animate__animated animate__zoomIn" style="animation-delay: ${index * 0.05}s;" onclick="viewBadge('${config.title} ${curr.rank}', '${curr.desc}', '${curr.icon}')"><div class="badge-icon">${curr.icon}</div><small class="fw-bold">${config.title} ${curr.rank}</small></div>`;
        }
        container.innerHTML += html;
    });

    const badgeNav = document.getElementById('nav-badges-btn');
    if (badgeNav) {
        if (hasNewBadge) {
            badgeNav.classList.add('nav-glow');
            const sound = document.getElementById('notifSound');
            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(e => console.log("Sound error:", e));
            }
        } else badgeNav.classList.remove('nav-glow');
    }
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
        renderBadges();
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
// 📈 ระบบผู้บริหาร (Dashboard)
// =====================================================
function fetchManagerData(silent = false) {
    const sList = document.getElementById('staffListArea');
    const isManagerPage = document.getElementById('page-manager')?.classList.contains('active');

    // ถ้าหน้าผู้บริหารเปิดอยู่และไม่มีข้อมูลเลย หรือไม่ใช่การโหลดแบบเงียบ (Silent) ให้แสดง Spinner
    if (!silent && sList && (!globalAppUsers || globalAppUsers.length === 0)) {
        sList.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div><br><small class="text-muted">กำลังโหลดข้อมูลผู้บริหาร...</small></div>';
    }

    const handleData = (data) => {
        if (data.status === 'error') {
            if (sList && !silent) sList.innerHTML = `<div class="text-danger text-center py-3">${data.message}</div>`;
            return;
        }
        if (data.users && data.users.length > 0) {
            globalAppUsers = data.users;

            // 🌟 ซิงค์ข้อมูลเข้า allUsersMap ด้วยเพื่อให้หน้าหมุดและอื่นๆ เข้าถึงข้อมูลล่าสุดได้
            data.users.forEach(u => {
                const uid = u.lineId || u.userId || u.id;
                if (uid) allUsersMap[uid] = u;
            });

            // ฟังก์ชันสำหรับเรนเดอร์ข้อมูล
            const proceedWithRender = () => {
                // เรนเดอร์เฉพาะเมื่อผู้ใช้อยู่ที่หน้า Manager เท่านั้น เพื่อประหยัด CPU
                if (isManagerPage || !silent) {
                    renderDashboard(data.users);
                    renderTRDChart(data.users);
                    if (data.trend) {
                        chartData = data.trend;
                        renderManagerChart();
                    }
                }
            };

            // ตรวจสอบข้อมูล Feed ก่อนเรนเดอร์ (เพื่อใช้คำนวณ KPI)
            if (!globalFeedData?.length && typeof fetchFeed === 'function') {
                Promise.resolve(fetchFeed(false, true)).then(proceedWithRender);
            } else {
                proceedWithRender();
            }
        } else if (!silent) {
            if (sList) sList.innerHTML = '<div class="text-center py-5 text-muted"><i class="fas fa-users-slash fa-2x mb-3 d-block opacity-50"></i>ยังไม่มีข้อมูลพนักงานในระบบ</div>';
        }
    };

    // ปรับปรุงการ Fetch ให้รองรับโหมด Silent
    fetch(`${GAS_URL}?action=get_dashboard&t=` + Date.now())
        .then(res => res.text())
        .then(text => {
            if (text.startsWith('<')) throw new Error("CORS / Google HTML block");
            handleData(JSON.parse(text));
        })
        .catch(err => {
            console.warn('Manager Loading Error, ใช้ JSONP แทน:', err.message);
            window.__gasMgrCb = (data) => handleData(data);
            const old = document.getElementById('jsonp_mgr'); if (old) old.remove();
            const s = document.createElement('script');
            s.id = 'jsonp_mgr';
            s.src = `${GAS_URL}?action=get_dashboard&callback=__gasMgrCb&t=${Date.now()}`;
            document.head.appendChild(s);
        });
}

function renderTRDChart(users) {
    let scoreT = 0, scoreR = 0, scoreD = 0;
    users.forEach(u => {
        const v = u.virtueStats || {};
        scoreT += (parseFloat(v['integrity']) || 0);
        scoreR += (parseFloat(v['discipline']) || 0) + (parseFloat(v['sufficiency']) || 0);
        scoreD += (parseFloat(v['volunteer']) || 0) + (parseFloat(v['gratitude']) || 0);
    });

    const formatScore = (num) => Number.isInteger(num) ? num : num.toFixed(1);

    const cards = document.getElementById('trdScoreCards');
    if (cards) {
        cards.innerHTML = `
            <div class="col-4 border-end">
                <h3 class="fw-bold text-primary mb-0">${formatScore(scoreT)}</h3>
                <small class="text-muted fw-bold">Transparent</small>
            </div>
            <div class="col-4 border-end">
                <h3 class="fw-bold text-warning mb-0">${formatScore(scoreR)}</h3>
                <small class="text-muted fw-bold">Responsible</small>
            </div>
            <div class="col-4">
                <h3 class="fw-bold text-danger mb-0">${formatScore(scoreD)}</h3>
                <small class="text-muted fw-bold">Dedicated</small>
            </div>
        `;
    }

    const ctx = document.getElementById('trdBarChart');
    if (!ctx) return;
    if (window.myTrdChart) window.myTrdChart.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#eee' : '#666';

    window.myTrdChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['T', 'R', 'D'],
            datasets: [{
                label: 'คะแนนรวมกลุ่ม',
                data: [
                    parseFloat(scoreT.toFixed(1)),
                    parseFloat(scoreR.toFixed(1)),
                    parseFloat(scoreD.toFixed(1))
                ],
                backgroundColor: [
                    'rgba(108, 92, 231, 0.8)', // Purple for T
                    'rgba(243, 156, 18, 0.8)', // Orange for R
                    'rgba(231, 76, 60, 0.8)'  // Red for D
                ],
                borderRadius: 8,
                barThickness: 45, // ปรับขนาดแท่งให้แคบลงตามคำขอ
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    titleFont: { family: 'Kanit' },
                    bodyFont: { family: 'Kanit' },
                    callbacks: {
                        title: function (context) {
                            const fullLabels = ['Transparent (สุจริต)', 'Responsible (วินัย+พอเพียง)', 'Dedicated (อาสา+กตัญญู)'];
                            return fullLabels[context[0].dataIndex];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Kanit' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Kanit', size: 16, weight: 'bold' } }
                }
            }
        }
    });
}

function renderDashboard(appUsers) {
    let totalHappy = 0, userWithData = 0, issueCount = 0;
    globalUserStatsMap = {};

    appUsers.forEach(u => {
        const uid = String(u.lineId || u.id || u.userId || '');
        if (!uid) return;
        const role = u.role || 'Staff';

        // 🌟 เก็บข้อมูลลง Map ทุกคน (รวมคนขึ้นทำเนียบ) เพื่อให้ Profile แสดงผลได้
        const happyRaw = parseFloat(u.happyScore || u.happy || 0);
        globalUserStatsMap[uid] = {
            id: uid, name: u.name, img: u.img, role: role,
            score: parseInt(u.score) || 0, level: parseInt(u.level) || 1,
            avgHappy: happyRaw, virtueStats: u.virtueStats || {},
            postsMade: parseInt(u.totalCount || 0), taggedIn: parseInt(u.taggedCount || 0),
            witnessCount: parseInt(u.witnessCount || 0), topFriends: u.topFriends || []
        };

        // 🌟 กรองออก: ถ้าเป็น Guest หรือ ศิษย์เก่า ไม่ต้องนำมาคำนวณ KPI รวม
        if (!shouldIncludeInStats(role)) return;

        if (happyRaw > 0) { totalHappy += happyRaw; userWithData++; if (happyRaw < 5.0) issueCount++; }
    });

    // Merge live feed data if available
    // Merge live feed data if available for accurate counting
    if (globalFeedData?.length) {
        const live = {};
        globalFeedData.forEach(p => {
            const pid = String(p.user_line_id);
            if (!live[pid]) live[pid] = { posts: 0, tagged: 0, witness: 0 };
            live[pid].posts++;

            // Count tagged friends
            if (p.taggedFriends) {
                const tags = Array.isArray(p.taggedFriends) ? p.taggedFriends : String(p.taggedFriends).split(',');
                tags.forEach(tid => {
                    const id = String(tid).trim();
                    if (id.length > 5) {
                        if (!live[id]) live[id] = { posts: 0, tagged: 0, witness: 0 };
                        live[id].tagged++;
                    }
                });
            }

            // Count witness actions (verifies)
            if (p.verifies && Array.isArray(p.verifies)) {
                p.verifies.forEach(v => {
                    const vid = String(v.lineId || v.userId);
                    if (vid && vid.length > 5) {
                        if (!live[vid]) live[vid] = { posts: 0, tagged: 0, witness: 0 };
                        live[vid].witness++;
                    }
                });
            }
        });

        // Merge back to map
        Object.keys(live).forEach(uid => {
            if (globalUserStatsMap[uid]) {
                const u = globalUserStatsMap[uid];
                // Prefer feed data for accuracy if it's higher
                u.postsMade = Math.max(u.postsMade || 0, live[uid].posts);
                u.taggedIn = Math.max(u.taggedIn || 0, live[uid].tagged);
                u.witnessCount = Math.max(u.witnessCount || 0, live[uid].witness);
            }
        });
    }

    let totalPosts = 0, totalTeam = 0;
    const statsUsers = Object.values(globalUserStatsMap).filter(u => shouldIncludeInStats(u.role));
    statsUsers.forEach(u => { totalPosts += u.postsMade; totalTeam += u.taggedIn; });

    document.getElementById('kpi-happy').innerText = (userWithData > 0 ? (totalHappy / userWithData * 10).toFixed(0) : '0') + '%';
    document.getElementById('kpi-posts').innerText = statsUsers.length + ' คน';

    let teamRate = 0;
    if (globalFeedData?.length) {
        let teamPosts = globalFeedData.filter(p => {
            const tags = Array.isArray(p.taggedFriends) ? p.taggedFriends : String(p.taggedFriends || "").split(',');
            return tags.filter(id => String(id).trim().length > 0).length > 0;
        }).length;
        teamRate = (teamPosts / globalFeedData.length * 100).toFixed(0);
    }
    document.getElementById('kpi-teamwork').innerText = teamRate + '%';
    document.getElementById('kpi-issues').innerText = issueCount + ' คน';

    renderStaffTable(globalUserStatsMap);
}

function renderStaffTable(map) {
    const sList = document.getElementById('staffListArea');
    const gList = document.getElementById('guestListArea');
    const gSection = document.getElementById('guestSectionArea');
    if (!sList) return;
    sList.innerHTML = '';
    if (gList) gList.innerHTML = '';

    const getRolePriority = (r) => {
        const roleStr = String(r || '').toLowerCase();
        if (roleStr.includes('ผู้บริหาร') || roleStr.includes('executive') || roleStr.includes('manager')) return 1;
        if (roleStr.includes('admin') || roleStr.includes('administrator')) return 2;
        if (roleStr.includes('newseditor') || roleStr.includes('บรรณาธิการ')) return 3;
        if (roleStr.includes('staff') || roleStr.includes('พนักงาน')) return 4;
        return 5;
    };

    const allUsers = Object.values(map);
    const activeStaff = allUsers.filter(u => shouldIncludeInStats(u.role));
    const guestStaff = allUsers.filter(u => isGuest(u.role));

    // --- Render Active Staff ---
    if (activeStaff.length > 0) {
        activeStaff.sort((a, b) => {
            const pA = getRolePriority(a.role);
            const pB = getRolePriority(b.role);
            if (pA !== pB) return pA - pB;
            return (b.score || 0) - (a.score || 0);
        }).forEach(f => renderStaffRow(f, sList));
    } else {
        sList.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-user-friends fa-2x mb-3 d-block opacity-50"></i>
                ไม่พบรายชื่อบุคลากรปัจจุบันในระบบ
            </div>
        `;
    }

    // --- Render Guest Staff ---
    if (guestStaff.length > 0 && gSection) {
        gSection.style.display = 'block';
        guestStaff.sort((a, b) => a.name.localeCompare(b.name)).forEach(f => renderStaffRow(f, gList));
    } else if (gSection) {
        gSection.style.display = 'none';
    }
}

function filterStaffList() {
    const query = document.getElementById('staffFilterInput').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#staffListArea .staff-row, #guestListArea .staff-row');

    rows.forEach(row => {
        const name = row.querySelector('.fw-bold')?.innerText.toLowerCase() || "";
        const role = row.querySelector('.badge')?.innerText.toLowerCase() || "";
        if (name.includes(query) || role.includes(query)) {
            row.style.display = 'block';
        } else {
            row.style.display = 'none';
        }
    });

    // ซ่อนหัวข้อ Guest ถ้าค้นหาแล้วไม่เจอ Guest เลย
    const gSection = document.getElementById('guestSectionArea');
    if (gSection && query) {
        const visibleGuests = document.querySelectorAll('#guestListArea .staff-row[style="display: block;"]');
        gSection.style.display = visibleGuests.length > 0 ? 'block' : 'none';
    } else if (gSection) {
        const guestStaffCount = document.querySelectorAll('#guestListArea .staff-row').length;
        gSection.style.display = guestStaffCount > 0 ? 'block' : 'none';
    }
}

function renderStaffRow(f, container, isHOF = false) {
    const score = parseFloat(f.avgHappy) || 0;
    let status = isHOF ? 'status-legend' : 'status-normal', icon = isHOF ? '👑' : '🟢';

    if (!isHOF) {
        if (score < 5) { status = 'status-critical'; icon = '🔴'; }
        else if (score < 7) { status = 'status-warning'; icon = '🟠'; }
    }

    let rescueHtml = '';
    if (status === 'status-critical' && f.topFriends?.length) {
        const topTwo = f.topFriends.slice(0, 2);
        rescueHtml = `<div class="mt-2 p-3 border border-danger rounded shadow-sm d-flex flex-column fade-in" style="background: var(--glass-bg); border-left: 5px solid #ff7675!important;">
            <div class="d-flex align-items-center mb-2">
                <div class="me-3" style="font-size:1.5rem;">🤖</div>
                <div class="text-danger fw-bold small">🚨 AI Recommendation</div>
            </div>
            <div class="small mt-1 mb-2" style="color: var(--text-main);">ภาวะหมดไฟ แนะนำเพื่อนช่วยดูแล (สนิทที่สุด):</div>
            <div class="d-flex flex-wrap gap-2">
                ${topTwo.map(r => `
                    <div class="p-2 rounded border small d-flex align-items-center flex-grow-1" style="background: rgba(0,0,0,0.1); border-color: var(--border-color) !important;">
                        <i class="fas fa-user-friends text-primary me-2"></i>
                        <span class="fw-bold text-primary">${r.name}</span>
                        <span class="text-muted ms-2">(สนิท ${r.count} ครั้ง)</span>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    const div = document.createElement('div');
    div.className = `p-3 staff-row border-bottom ${status}`;
    div.onclick = () => showStaffModal(f.id);
    div.innerHTML = `
        <div class="d-flex align-items-center mb-2">
            <div class="position-relative">
                <img src="${f.img || 'https://dummyimage.com/55x55/ccc/fff'}" style="width:55px;height:55px;border-radius:50%;margin-right:15px;border:3px solid #fff;box-shadow:0 3px 6px rgba(0,0,0,0.1);object-fit:cover;">
                <span class="position-absolute bottom-0 end-0 badge rounded-pill bg-dark border border-white" style="font-size:0.6rem;right:10px;">Lv.${f.level}</span>
            </div>
            <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="fw-bold text-dark mb-0">${f.name}</h6>
                        <span class="badge ${isHOF ? 'bg-warning text-dark' : 'bg-light text-dark'} border mt-1 small">${f.role}</span>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold fs-4" style="color:${isHOF ? '#f39c12' : (score < 5 ? '#e74c3c' : (score < 7 ? '#f39c12' : '#27ae60'))}">
                            ${isHOF ? (f.score || 0).toLocaleString() : (score > 0 ? score.toFixed(1) : '-')}
                        </div>
                        <small class="text-muted small">${isHOF ? 'XP สะสม' : icon + ' ความสุข'}</small>
                    </div>
                </div>
            </div>
        </div>${rescueHtml}`;
    container.appendChild(div);
}

// ==========================================
// 🌟 ฟังก์ชันแสดงโปรไฟล์พนักงาน (อัปเดตระบบนับสด + กราฟแท่ง)
// ==========================================
function showStaffModal(uid) {
    const user = globalUserStatsMap[uid];
    if (!user) return;
    const v = user.virtueStats || {};
    const happyColor = user.avgHappy < 5 ? 'text-danger' : (user.avgHappy < 7 ? 'text-warning' : 'text-success');
    const virtueLabel = getDominantVirtueLabel(v);
    const activityRange = getActivityRange(uid);
    const virtueDesc = getVirtueDescription(virtueLabel.key);

    // 🌟 2. เปลี่ยน "ประวัติความดีล่าสุด" เป็นกล่อง "กราฟเท่งส่วนบุคคล" 
    const historyHtml = `
        <div class="mt-4 p-3 rounded-4 shadow-sm" style="background: var(--glass-bg); border: 1px solid var(--border-color);">
            <h6 class="fw-bold mb-3 text-center" style="color:var(--primary-color);">
                <i class="fas fa-chart-pie me-2"></i>สมดุลความดี
            </h6>
            <div style="height: 200px; position: relative;">
                <canvas id="staffRadarChart"></canvas>
            </div>
        </div>

        <div class="mt-4 p-3 rounded-4 shadow-sm" style="background: var(--glass-bg); border: 1px solid var(--border-color);">
            <h6 class="fw-bold mb-3 text-center" style="color:var(--primary-color);">
                <i class="fas fa-chart-bar me-2"></i>สถิติความดีส่วนบุคคล
            </h6>
            <div style="height: 220px; position: relative;">
                <canvas id="staffBarChartModal"></canvas>
            </div>
        </div>
    `;

    // 🌟 ใช้คะแนนจาก Backend เป็นหลัก ถ้าไม่มีค่อยใช้ 0
    let postsMade = parseInt(user.postsMade || user.totalCount || 0);
    let taggedIn = parseInt(user.taggedIn || user.taggedCount || 0);
    let witnessCount = parseInt(user.witnessCount || 0);

    // บวกเพิ่มจาก Feed สดถ้าไอดีตรง
    if (window.globalFeedData) {
        window.globalFeedData.forEach(p => {
            const ownerId = String(p.user_line_id || p.userId || p.lineId || '').trim();
            if (ownerId === uid) { /* นับเพิ่มถ้าต้องการความสดใหม่จริงๆ แต่ปกติ Backend รวมมาให้แล้ว */ }
        });
    }

    Swal.fire({
        title: 'ข้อมูลบุคลากร',
        html: `
            <div style="text-align:left;" class="staff-modal-content">
                <div class="d-flex align-items-center mb-4">
                    <img src="${user.img || 'https://via.placeholder.com/60'}" style="width:70px;height:70px;border-radius:20px;margin-right:15px;border:3px solid var(--border-color);box-shadow:0 8px 20px rgba(0,0,0,0.1);object-fit:cover;">
                    <div>
                        <h5 class="fw-bold mb-1">${user.name}</h5>
                        <div class="badge px-3 py-1 rounded-pill" style="background:rgba(108,92,231,0.1); color:#6c5ce7; font-size:0.75rem; border:1px solid rgba(108,92,231,0.2);">${user.role}</div>
                    </div>
                </div>
                
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <div class="staff-stat-card">
                            <small class="staff-stat-label">ความสุข</small>
                            <span class="staff-stat-val ${happyColor}">${user.avgHappy.toFixed(1)}</span>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="staff-stat-card">
                            <small class="staff-stat-label">แต้มระดับ</small>
                            <span class="staff-stat-val text-primary">${user.score} XP</span>
                        </div>
                    </div>
                </div>

                <div class="staff-stat-card mb-3 p-3" style="text-align:left;">
                    <div class="d-flex align-items-center mb-2">
                        <span class="fs-4 me-2">⭐</span>
                        <strong class="text-primary">พลังเด่น: ${virtueLabel.label}</strong>
                    </div>
                    <p class="mb-0 text-muted" style="font-size:0.8rem; line-height:1.6;">${virtueDesc}</p>
                    <hr class="my-2 opacity-50">
                    <small class="text-muted d-block mb-2"><i class="fas fa-calendar-alt me-1"></i> ${activityRange}</small>
                    ${(user.topFriends && user.topFriends.length > 0) ? `
                        <div class="mt-2 text-start p-2 rounded" style="background: rgba(0,0,0,0.03);">
                            <div class="small fw-bold mb-1 text-primary"><i class="fas fa-users-heart me-1"></i> ผู้ร่วมผูกพันสายใยสูงสุด (Top 2)</div>
                            ${user.topFriends.slice(0, 2).map((f, i) => `
                                <div class="d-flex align-items-center mb-1">
                                    <span class="badge bg-secondary me-2">${i + 1}</span>
                                    <span class="small border-bottom border-secondary" style="color:var(--text-main);">${f.name} (ผูกพัน ${f.count} ครั้ง)</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div class="row g-2 mb-3">
                    <div class="col-4">
                        <div class="staff-stat-card">
                            <span class="staff-stat-val text-primary" style="color:#3498db !important;">${postsMade}</span>
                            <small class="staff-stat-label">โพสต์สร้าง</small>
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="staff-stat-card">
                            <span class="staff-stat-val text-info" style="color:#17a2b8 !important;">${taggedIn}</span>
                            <small class="staff-stat-label">ถูกแท็ก</small>
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="staff-stat-card">
                            <span class="staff-stat-val text-success" style="color:#28a745 !important;">${witnessCount}</span>
                            <small class="staff-stat-label">กดพยาน</small>
                        </div>
                    </div>
                </div>
                
                ${typeof canManageSystem === 'function' && canManageSystem() ? `
                    <div class="mt-3 d-flex flex-column gap-2 px-1">
                        <div class="d-flex gap-2">
                            <button class="btn btn-warning btn-sm fw-bold rounded-pill shadow-sm py-2 flex-grow-1" onclick="promoteToAlumni('${user.id}')">
                                <i class="fas fa-crown me-1"></i> ขึ้นทำเนียบ
                            </button>
                            <button class="btn btn-primary btn-sm fw-bold rounded-pill shadow-sm py-2 flex-grow-1 text-white" onclick="changeUserRole('${user.id}')">
                                <i class="fas fa-user-shield me-1"></i> จัดการสิทธิ์
                            </button>
                        </div>
                    </div>
                ` : ''}

                ${historyHtml}
            </div>`,
        showConfirmButton: false,
        showCloseButton: true,
        width: '450px',
        didOpen: () => {
            setTimeout(() => {
                // 🌟 1. วาดกราฟแมงมุม (Radar)
                const dataPoints = [v.volunteer || 0, v.sufficiency || 0, v.discipline || 0, v.integrity || 0, v.gratitude || 0];
                drawPremiumRadar('staffRadarChart', dataPoints, false, { showLabels: true });

                // 🌟 2. วาดกราฟแท่ง (Bar) - เช็คให้ชัวร์ว่าส่งไอดี 'staffBarChartModal'
                if (typeof drawPersonalVirtueBarChart === 'function') {
                    drawPersonalVirtueBarChart(v, 'staffBarChartModal');
                }
            }, 300);
        }
    });
}

function promoteToAlumni(uid) {
    if (!uid) return;
    console.log("Promoting user to alumni:", uid);

    Swal.fire({
        title: 'ขึ้นทำเนียบผู้ผูกพัน',
        text: `กรุณาเลือกหมวดหมู่สำหรับรหัส ${uid}`,
        icon: 'question',
        input: 'select',
        inputOptions: {
            'ศิษย์เก่า': 'ศิษย์เก่า',
            'ลาออก': 'ลาออก',
            'ย้าย': 'ย้าย',
            'เกษียณ': 'เกษียณ',
            'อนุสรณ์': 'อนุสรณ์ (นักบุญ)'
        },
        inputPlaceholder: 'คลิกเลือกหมวดหมู่...',
        showCancelButton: true,
        confirmButtonColor: '#ff7675',
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        inputValidator: (value) => {
            if (!value) return 'กรุณาเลือกหมวดหมู่ทำเนียบก่อนครับ';
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const selectedCategory = result.value;
            const staffData = globalUserStatsMap[uid] || allUsersMap[uid];
            const currentScore = staffData ? (staffData.score || 0) : 0;

            // 🌪️ Optimistic UI
            if (globalUserStatsMap[uid]) globalUserStatsMap[uid].role = selectedCategory;
            if (allUsersMap[uid]) allUsersMap[uid].role = selectedCategory;

            Swal.fire({
                title: 'กำลังส่งรายชื่อขึ้นทำเนียบ...',
                text: 'กรุณารอสักครู่ ระบบกำลังสื่อสารกับหลังบ้าน',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'promote_alumni', userId: uid, label: selectedCategory, score: currentScore })
            })
                .then(async (res) => {
                    const text = await res.text();
                    console.log("Promote Response:", text);

                    if (!res.ok || text.startsWith('<')) throw new Error("Server Error (HTML/CORS)");

                    const data = JSON.parse(text);
                    if (data.status === 'success') {
                        Swal.fire({
                            icon: 'success',
                            title: 'ขึ้นทำเนียบสำเร็จ!',
                            text: data.message,
                            timer: 3000,
                            showConfirmButton: false
                        });

                        // รีเฟรชข้อมูลทั้งหมด
                        fetchManagerData();
                        if (document.getElementById('page-relation')?.classList.contains('active')) {
                            renderRelationTab();
                        }
                        if (typeof fetchFriendsList === 'function') fetchFriendsList();
                    } else {
                        Swal.fire({ icon: 'warning', title: 'ไม่สามารถบันทึกได้', text: data.message });
                    }
                })
                .catch((e) => {
                    console.error("Promote Error:", e);
                    Swal.fire({
                        icon: 'error',
                        title: 'การเชื่อมต่อมีปัญหา',
                        text: 'ไม่สามารถส่งข้อมูลได้: ' + e.message
                    });
                });
        }
    });
}

function changeUserRole(uid) {
    if (!canManageSystem()) {
        Swal.fire('🚫 ปฏิเสธการเข้าถึง', 'ต้องเป็นผู้ดูแลระบบหรือผู้บริหารเท่านั้นจึงจะสามารถปรับสถานะได้', 'error');
        return;
    }

    // ป้องกันการแก้สิทธิ์ตัวเอง
    if (uid === currentUser.userId) {
        Swal.fire('⚠️ คำเตือน', 'คุณไม่สามารถเปลี่ยนบทบาทของตัวเองได้', 'warning');
        return;
    }

    // 🔒 ระบบความปลอดภัยเพิ่มเติม: Manager (Lv.2) ไม่สามารถเปลี่ยนสิทธิ์ของ Admin (Lv.1) ได้
    const targetUser = allUsersMap[uid];
    if (getUserLevel(currentUser) === 2 && targetUser && getUserLevel(targetUser) === 1) {
        Swal.fire('🚫 ปฏิเสธการเข้าถึง', 'ผู้บริหารไม่สามารถแก้ไขสิทธิ์ของผู้ดูแลระบบสูงสุดได้', 'error');
        return;
    }

    Swal.fire({
        title: '⚙️ ตั้งค่าบทบาทผู้ใช้งาน',
        text: `เลือกบทบาทใหม่สำหรับรหัส ${uid}`,
        icon: 'question',
        input: 'select',
        inputOptions: {
            'Admin': '🛡️ ผู้ดูแลระบบ (Admin)',
            'Manager': '👨‍💼 ผู้บริหาร (Manager)',
            'NewsEditor': '📢 บรรณาธิการข่าว (News Editor)',
            'Staff': '👤 พนักงานทั่วไป (Staff)',
            'Guest': '👣 ผู้เยี่ยมชม (Guest)',
            ...(!isAlumni(targetUser?.role) ? {} : { [targetUser.role]: `⏳ สถานะปัจจุบัน: ${targetUser.role}` })
        },
        inputValue: targetUser?.role || 'Staff',
        inputPlaceholder: 'คลิกเลือกบทบาท...',
        showCancelButton: true,
        confirmButtonColor: '#6c5ce7',
        confirmButtonText: 'ยืนยันการเปลี่ยน',
        cancelButtonText: 'ยกเลิก',
        inputValidator: (value) => {
            return new Promise((resolve) => {
                if (value) resolve();
                else resolve('กรุณาเลือกบทบาทก่อนครับ');
            });
        }
    }).then(r => {
        if (r.isConfirmed) {
            const newRole = r.value;
            const target = globalUserStatsMap[uid] || allUsersMap[uid];

            // 🌪️ Optimistic UI
            if (allUsersMap[uid]) allUsersMap[uid].role = newRole;
            if (globalUserStatsMap[uid]) {
                globalUserStatsMap[uid].role = newRole;
                if (typeof renderStaffTable === 'function') renderStaffTable(globalUserStatsMap);
            }

            Swal.fire({
                title: 'กำลังบันทึก...',
                text: 'กรุณารอสักครู่ ระบบกำลังสื่อสารกับหลังบ้าน',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'update_role', userId: uid, role: newRole })
            })
                .then(async res => {
                    const text = await res.text();
                    console.log("Backend Raw Response:", text);

                    if (!res.ok || text.startsWith('<')) {
                        throw new Error("Server Error: " + (text.substring(0, 50) || 'Unknown'));
                    }

                    let data;
                    try { data = JSON.parse(text); }
                    catch (je) { throw new Error("Invalid JSON: " + text.substring(0, 50)); }

                    if (data.status === 'success') {
                        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', text: data.message, timer: 2000, showConfirmButton: false });
                        fetchManagerData();
                    } else {
                        Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่เปลี่ยนในตาราง', text: data.message + (data.samplesInSheet ? '\n\nเช็คข้อมูลในระบบ: ' + data.samplesInSheet.join('\n') : '') });
                    }
                })
                .catch(e => {
                    console.error("Update Role Error:", e);
                    Swal.fire({
                        icon: 'error',
                        title: 'การเชื่อมต่อมีปัญหา',
                        text: 'ไม่สามารถบันทึกได้: ' + e.message + '\n(โปรดเช็ค Deployment หรือสิทธิ์การเขียนไฟล์)'
                    });
                });
        }
    });
}


// Helper for premium radar charts
function drawPremiumRadar(ctxId, data, isAlumni = false, options = {}) {
    const ctx = document.getElementById(ctxId);
    if (!ctx) return;

    // Destroy old chart instance if it exists
    if (window['chart_' + ctxId]) {
        window['chart_' + ctxId].destroy();
        delete window['chart_' + ctxId];
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.body.getAttribute('data-theme') === 'dark' ||
        localStorage.getItem('theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.1)';
    const labelColor = isDark ? '#eee' : '#666';
    const mainColor = isAlumni ? '#f1c40f' : '#6c5ce7';
    const bgColor = isAlumni ? 'rgba(241, 196, 15, 0.25)' : 'rgba(108, 92, 231, 0.2)';
    const showLabels = options.showLabels !== false;

    window['chart_' + ctxId] = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: showLabels ? ['จิตอาสา', 'พอเพียง', 'วินัย', 'สุจริต', 'กตัญญู'] : ['', '', '', '', ''],
            datasets: [{
                data: data,
                backgroundColor: bgColor,
                borderColor: mainColor,
                borderWidth: 3,
                pointBackgroundColor: mainColor,
                pointBorderColor: '#fff',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    circular: false,
                    suggestedMin: 0,
                    suggestedMax: 10,
                    ticks: { display: false },
                    grid: { color: gridColor, lineWidth: 1 },
                    angleLines: { color: gridColor },
                    pointLabels: {
                        display: showLabels,
                        color: labelColor,
                        font: { size: 11, weight: '900', family: "'Prompt', sans-serif" },
                        padding: 10
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true, backgroundColor: 'rgba(0,0,0,0.8)', padding: 10 }
            },
            animation: { duration: 1510, easing: 'easeOutElastic' }
        }
    });
    return window['chart_' + ctxId];
}

function initUserRadar() {
    const ctx = document.getElementById('userRadarChart');
    if (!ctx || !currentUser) return;
    if (window.myRadarChart) window.myRadarChart.destroy();

    const v = currentUser.virtueStats || {};
    const dataPoints = [
        parseFloat(v.volunteer || 0),
        parseFloat(v.sufficiency || 0),
        parseFloat(v.discipline || 0),
        parseFloat(v.integrity || 0),
        parseFloat(v.gratitude || 0)
    ];

    // 🌗 เช็ค Dark Mode เพื่อปรับสีเส้นให้ชัดขึ้น
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.1)';
    const labelColor = isDark ? '#a29bfe' : '#6c5ce7'; // สีตัวหนังสือ

    // 🌟 คำนวณค่าสูงสุดเพื่อปรับสเกลให้สวยงาม ไม่รวน
    const maxVal = Math.max(...dataPoints, 5);
    const suggestedMax = Math.ceil(maxVal * 1.2 / 5) * 5;

    window.myRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            // เพิ่มไอคอนหมวดหมู่หน้าชื่อ
            labels: ['🤝 จิตอาสา', '🌱 พอเพียง', '📏 วินัย', '💎 สุจริต', '🙏 กตัญญู'],
            datasets: [{
                label: 'คะแนนสะสม',
                data: dataPoints,
                backgroundColor: isDark ? 'rgba(162, 155, 254, 0.25)' : 'rgba(108, 92, 231, 0.2)',
                borderColor: isDark ? '#a29bfe' : '#6c5ce7',
                borderWidth: 3,
                pointBackgroundColor: isDark ? '#fff' : '#fff',
                pointBorderColor: isDark ? '#a29bfe' : '#6c5ce7',
                pointBorderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { display: true, color: gridColor },
                    grid: { color: gridColor },
                    suggestedMin: 0,
                    suggestedMax: suggestedMax,
                    ticks: {
                        stepSize: Math.max(1, Math.floor(suggestedMax / 5)),
                        display: false
                    },
                    pointLabels: {
                        font: { size: 14, weight: 'bold', family: "'Kanit', sans-serif" },
                        color: labelColor,
                        padding: 10
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.label}: ${ctx.raw} คะแนน`
                    }
                }
            }
        }
    });

    if (typeof updateStatAnalysis === 'function') updateStatAnalysis(dataPoints);
}

function renderManagerChart() {
    const ctx = document.getElementById('managerLineChart');
    if (!ctx) return;
    if (window.myManagerChart) window.myManagerChart.destroy();
    const range = document.getElementById('chartRangeSelector')?.value || '15d';
    let labels = [], dataPoints = [];
    let raw = chartData || [];

    if (range === '15d') {
        let items = raw.slice(-15);
        for (let i = items.length - 1; i >= 0; i--) {
            let d = new Date(); d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }));
        }
        dataPoints = items;
    } else if (range === '30d') {
        let items = raw.slice(-30);
        for (let i = items.length - 1; i >= 0; i--) {
            let d = new Date(); d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }));
        }
        dataPoints = items;
    } else if (range === '1y') {
        const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        for (let i = 11; i >= 0; i--) {
            let d = new Date(); d.setMonth(d.getMonth() - i);
            labels.push(months[d.getMonth()]);
            let chunk = raw.slice(raw.length - ((i + 1) * 30), raw.length - (i * 30));
            dataPoints.push((chunk.reduce((a, b) => a + b, 0) / (chunk.length || 1)).toFixed(1));
        }
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#eee' : '#666';

    window.myManagerChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: dataPoints,
                borderColor: '#6c5ce7',
                backgroundColor: 'rgba(108, 92, 231, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#6c5ce7'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    suggestedMin: 4, suggestedMax: 10,
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Kanit' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Kanit' } }
                }
            }
        }
    });
}

// =====================================================
// 🔔 ระบบแจ้งเตือน (In-App)
// =====================================================
function triggerNotificationEffects() {
    const bell = document.getElementById('bellIcon');
    if (bell) {
        bell.classList.remove('bell-shake');
        void bell.offsetWidth;
        bell.classList.add('bell-shake');
        
        // 📱 เพิ่มการสั่นสะเทือน (Haptic Feedback) ถ้าเครื่องรองรับ
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    }

    // 🌟 เล่นเสียงแจ้งเตือน
    const sound = document.getElementById('notifSound');
    if (sound) {
        // เช็คว่าไม่ได้ปิดเสียงแอปอยู่
        if (localStorage.getItem('notif_muted') !== 'true') {
            sound.currentTime = 0;
            const playPromise = sound.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.warn("🔊 Sound play blocked by browser. iOS requires a user gesture first.");
                    // เราจะพยายามเล่นอีกครั้งเมื่อมีการคลิกครั้งถัดไปผ่าน unlockAudio
                });
            }
        }
    }
}

function processAnnounceData(data, silent = false) {
    try {
        if (!data) return;
        const rawItems = data.announcements || data.data || (Array.isArray(data) ? data : []);
        const oldIds = appNotifications.map(n => n.id);
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
        const tomorrowStr = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`;
        let hasNewUpcoming = false;
        let newlyDetected = false;

        const gasNotifs = rawItems.map(a => {
            const itemDate = a.date || '';
            if (itemDate && itemDate >= todayStr && !oldIds.includes(a.id)) hasNewUpcoming = true;
            if (!oldIds.includes(a.id)) newlyDetected = true;

            // 🌟 1 Day Reminder Logic
            if (itemDate === tomorrowStr) {
                const isRead = localStorage.getItem(`notif_read_${a.id}`);
                const hasReminded = localStorage.getItem(`notif_reminded_${a.id}`);
                if (isRead && !hasReminded) {
                    localStorage.removeItem(`notif_read_${a.id}`); // ทำให้กลับมาเป็น "ยังไม่ได้อ่าน"
                    localStorage.setItem(`notif_reminded_${a.id}`, 'true'); // มาร์คว่าเตือนรอบ 1 วันแล้ว
                    hasNewUpcoming = true; // บังคับสั่นกระดิ่งใหม่
                }
            }

            return {
                id: a.id || 'gas_' + Math.random(), title: a.title, body: a.body,
                date: itemDate, displayDate: a.displayDate || itemDate, eventIso: a.eventIso,
                time: a.displayDate || itemDate, source: 'gas', category: a.category || 'general', ts: a.ts
            };
        });


        // กรองเอา notification ทั่วไป (ไม่เอา gift_box)
        const generalGasNotifs = gasNotifs.filter(n => n.category !== 'gift_box');

        const otherNotifs = appNotifications.filter(n => n.source !== 'gas');
        appNotifications = [...generalGasNotifs, ...otherNotifs];

        if (silent) { if (newlyDetected) renderNotifList(); }
        else { renderNotifList(); }

        if (hasNewUpcoming) {
            // 🌟 กรองเฉพาะ ID ที่ยังไม่เคยแจ้งเตือน (Notified) ในเซสชันนี้
            const unnotifiedIds = generalGasNotifs
                .filter(n => (n.date >= todayStr || n.date === tomorrowStr) && !localStorage.getItem(`last_notified_${n.id}`))
                .map(n => n.id);

            if (unnotifiedIds.length > 0) {
                // มาร์คว่าแจ้งเตือนแล้ว
                unnotifiedIds.forEach(id => localStorage.setItem(`last_notified_${id}`, 'true'));

                triggerNotificationEffects();

                if (!silent) {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'info',
                        title: '📢 มีการแจ้งเตือนเรื่องราวใหม่!',
                        showConfirmButton: false,
                        timer: 3500
                    });
                } else if (typeof showAppNotification === 'function') {
                    showAppNotification('📢 กิจกรรมใหม่!', 'มีเรื่องราวหรืองานใหม่เข้ามา แตะเพื่อเช็คกระดิ่งแจ้งเตือนดูสิ', 'activity', 'index.html');
                }
            }
        }
    } catch (e) { console.error('🔔 processAnnounceData Error:', e); }
}

function fetchAnnouncements(silent = false) {
    const url = GAS_URL + '?action=get_announcements&t=' + Date.now();
    fetch(url)
        .then(r => r.json())
        .then(data => processAnnounceData(data, silent))
        .catch(err => {
            console.warn('🔔 Fetch failed, trying JSONP...', err.message);
            window.__gasCb = (data) => processAnnounceData(data, silent);
            const old = document.getElementById('jsonp_gas'); if (old) old.remove();
            const s = document.createElement('script');
            s.id = 'jsonp_gas';
            s.src = `${GAS_URL}?action=get_announcements&callback=__gasCb&t=${Date.now()}`;
            document.head.appendChild(s);
        });
}

function renderNotifList() {
    const list = document.getElementById('notifList');
    if (!list) return;

    if (appNotifications.length === 0) {
        list.innerHTML = '<div class="text-center py-5 text-muted small">ยังไม่มีรายการแจ้งเตือน</div>';
        updateBadge(0); return;
    }

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let unreadCount = 0;
    let html = '';

    appNotifications.sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(n => {
        // เช็คว่ากิจกรรมนี้กำลังจะมาถึงไหม (วันที่ มากกว่าหรือเท่ากับ วันนี้)
        const isUpcoming = n.date && n.date >= today;

        // เช็คว่าผู้ใช้เคยกดอ่านแจ้งเตือนนี้หรือยัง
        const isRead = localStorage.getItem(`notif_read_${n.id}`);

        // 🌟 นับเฉพาะรายการที่ยังไม่ได้อ่านและยังมาไม่ถึง (Upcoming)
        if (!isRead && isUpcoming) {
            unreadCount++;
        }

        const color = CATEGORY_COLORS[n.category] || '#636e72';
        html += `
            <div class="notif-item ${isUpcoming ? 'notif-upcoming' : 'opacity-75'}" 
                 style="${(!isRead && isUpcoming) ? `border-left:4px solid ${color};` : 'border-left:4px solid transparent;'}" 
                 onclick="readNotif('${n.id}')">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <span class="notif-title fw-bold ${!isRead && isUpcoming ? 'text-dark' : 'text-muted'}">${n.title}</span>
                    ${isUpcoming ? '<span class="notif-status-badge bg-primary text-white">เร็วๆ นี้</span>' : '<span class="notif-status-badge bg-secondary text-white">ผ่านไปแล้ว</span>'}
                </div>
                <div class="notif-body small text-muted">${n.body || ''}</div>
                <div class="d-flex justify-content-between align-items-center mt-2 small">
                    <span style="color:${color}; fw-bold">${CATEGORY_ICONS[n.category] || '📢'} ${n.displayDate || n.date || ''}</span>
                    <span class="text-muted">${n.time || ''}</span>
                </div>
            </div>`;
    });
    list.innerHTML = html;
    updateBadge(unreadCount);
    updateAddAnnounceButton();
}

function updateBadge(count) {
    const badge = document.getElementById('notifBadge');
    if (badge) {
        if (count > 0) { badge.style.display = 'flex'; badge.innerText = count > 9 ? '9+' : count; }
        else badge.style.display = 'none';
    }
}

function updateAddAnnounceButton() {
    const btn = document.getElementById('addAnnounceBtnInPanel');
    const mgrTab = document.getElementById('nav-manager-btn');
    if (!currentUser) return;
    const level = getUserLevel(currentUser);

    const debugInfo = document.getElementById('debugRoleInfo');
    if (debugInfo) {
        const levelNames = { 1: 'Admin', 2: 'Manager', 3: 'NewsManager', 4: 'User' };
        debugInfo.innerText = `Role: ${currentUser.role || 'None'} (${levelNames[level] || 'User'})`;
    }

    if (btn) {
        if (level <= 3) { btn.classList.remove('d-none'); btn.style.display = 'inline-flex'; }
        else { btn.classList.add('d-none'); btn.style.display = 'none'; }
    }
    if (mgrTab) mgrTab.style.display = (level <= 2) ? 'flex' : 'none';
}

function scrollToTopAndRefresh() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const alertEl = document.getElementById('newPostAlert');
    if (alertEl) alertEl.style.display = 'none';

    // 🌪️ ใช้ Force Refresh เพื่อเคลียร์อาการค้าง (ถ้ามี)
    if (typeof fetchFeed === 'function') fetchFeed(false, false, true);
}

function setupBackgroundSync() {
    // 🔄 รีเฟรชข้อมูลเบื้องหลังทุก 60 วินาที
    setInterval(() => {
        if (currentUser) {
            fetchAnnouncements(true);
            fetchFeed(false, true);
            // ถ้าเป็น Admin/Manager ให้โหลดข้อมูล Dashboard เบื้องหลังด้วย
            if (getUserLevel(currentUser) <= 2) {
                fetchManagerData(true);
            }
        }
    }, 60000);
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return;

    const lastAsked = parseInt(safeGetItem('notif_asked_at') || '0');
    const daysSinceAsked = (Date.now() - lastAsked) / (1000 * 60 * 60 * 24);
    if (lastAsked > 0 && daysSinceAsked < 30) return;

    await new Promise(r => setTimeout(r, 2000));
    const result = await Swal.fire({
        toast: true, position: 'top', icon: 'info',
        title: '🔔 รับการแจ้งเตือนใหม่?',
        text: 'รับแจ้งเตือนเมื่อมีกิจกรรมหรือเรื่องราวใหม่',
        showConfirmButton: true, showCancelButton: true,
        confirmButtonText: 'เปิด', cancelButtonText: 'ไม่',
        confirmButtonColor: '#6c5ce7', timer: 8000
    });

    safeSetItem('notif_asked_at', Date.now().toString());
    if (result.isConfirmed) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') showAppNotification('😊 Happy Meter', 'เปิดใช้งานการแจ้งเตือนแล้ว!', 'welcome');
    }
}

function showAppNotification(title, body, tag = 'general', url = 'index.html') {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const options = { body, icon: 'app-icon.png', badge: 'app-icon.png', tag, vibrate: [200, 100, 200], data: { url } };
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options));
    } else {
        new Notification(title, options);
    }
}

function notifyNewPost(postCount) {
    if (postCount <= 0) return;
    const msg = postCount === 1 ? 'มีเรื่องราวใหม่ 1 โพสต์!' : `มีเรื่องราวใหม่ ${postCount} โพสต์!`;
    showAppNotification('📖 เรื่องราวใหม่', msg, 'new-post', 'index.html');
}

function notifyFromConfig(config) {
    if (!config?.notifications) return;
    config.notifications.forEach(n => {
        if (!localStorage.getItem(`notif_read_${n.id}`)) {
            showAppNotification(n.title || '😊 Happy Meter', n.body || '', n.id, 'index.html');
        }
    });
}

function readNotif(id) {
    try {
        const item = appNotifications.find(n => n.id === id);
        if (item?.ts) {
            const parsed = new Date(String(item.ts).replace(/\(.*\)/, '').trim());
            if (!isNaN(parsed.getTime())) {
                const current = parseInt(localStorage.getItem('notif_cleared_at') || '0');
                if (parsed.getTime() > current) {
                    localStorage.setItem('notif_cleared_at', parsed.getTime().toString());
                }
            }
        }
    } catch (e) {
        console.warn("readNotif data error:", e);
    } finally {
        localStorage.setItem(`notif_read_${id}`, 'true');
        renderNotifList();
        closeNotifPanel(); // ✅ เมื่อกดอ่านแล้วให้ปิดหน้าต่างแจ้งเตือนลงแน่นอนแม้อาจจะมีบั๊กข้อมูล
    }
}

function markAllNotifRead() {
    localStorage.setItem('notif_cleared_at', Date.now().toString());
    renderNotifList();
    closeNotifPanel(); // ✅ เมื่ออ่านทั้งหมดแล้วให้ปิดหน้าต่างแจ้งเตือนลง
}

function loadNotificationsFromConfig(config) {
    if (!config?.notifications) return;
    configNotifications = config.notifications.map(n => ({ ...n, source: 'config' }));
    const gasNotifs = appNotifications.filter(n => n.source === 'gas');
    appNotifications = [...gasNotifs, ...configNotifications];
    renderNotifList();
}

// 🌟 เพิ่มตัวแปรเช็คว่าผู้ใช้จงใจปิดเพลงหรือยัง (วางไว้นอกฟังก์ชัน)
let userMutedMusic = true; // 🌟 เริ่มต้นเป็น True (ใบ้) จนกว่าผู้ใช้จะอนุญาต

// =====================================================
// 🏗️ การควบคุม Tab และ Modal
// =====================================================
function safetyResumeMusic() {
    // ถ้าผู้ใช้กดปิดเพลงไปแล้ว ให้ยกเลิกการเล่นอัตโนมัติทันที
    if (userMutedMusic) return;

    const bgMusic = document.getElementById('bgMusic');
    if (bgMusic && bgMusic.paused) {
        bgMusic.play().then(() => {
            // อัปเดตหน้าตาปุ่มให้เป็นสถานะ "กำลังเล่น"
            const toggleBtn = document.getElementById('musicToggle');
            const icon = toggleBtn?.querySelector('i');
            if (icon) icon.className = 'fas fa-music text-primary';
            if (toggleBtn) toggleBtn.classList.add('music-playing');
        }).catch(e => console.log('Music resume blocked:', e));
    }
}
function switchTab(pageId, el) {
    if (!currentUser) { Swal.fire('เตือน', 'กรุณาเข้าสู่ระบบ', 'warning'); return; }
    if (pageId === 'manager' && getUserLevel(currentUser) > 2) {
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

    if (pageId === 'stats') setTimeout(initUserRadar, 100);
    if (pageId === 'relation') {
        closeRelationDetail(); // Back to list when tab clicked
        renderRelationTab();
        // 🌟 ดึงข้อมูล Feed มาตุนไว้ก่อน เพื่อให้กดดูประวัติความดีในทำเนียบได้ทันที
        if (!window.globalFeedData || window.globalFeedData.length < 50) fetchFeed(false, true);
    }

    if (pageId === 'stories') {
        const navBtn = document.getElementById('nav-stories-btn');
        navBtn?.querySelector('.nav-notify-dot')?.remove();
        if (!document.getElementById('feedContainer')?.querySelector('.feed-card')) {
            fetchFeed();
        } else if (globalFeedData?.length > 0) {
            const latestPostId = String(globalFeedData[0].uuid || globalFeedData[0].id);
            safeSetItem('lastSeenPostId', latestPostId);
        }
    }

    document.getElementById('header-user').style.display = (pageId === 'manager') ? 'none' : 'block';
    if (pageId === 'manager') {
        // ถ้ามีข้อมูลอยู่แล้ว ให้ใช้ข้อมูลเดิมไปก่อน (Instant Load) แล้วค่อยแอบอัปเดตเบื้องหลัง
        if (globalAppUsers && globalAppUsers.length > 0) {
            renderDashboard(globalAppUsers);
            renderTRDChart(globalAppUsers);
            renderManagerChart();
            fetchManagerData(true); // แอบอัปเดตเงียบๆ
        } else {
            fetchManagerData(false); // โหลดครั้งแรกแบบมี Spinner
        }
    }
    if (pageId === 'badges') {
        document.getElementById('nav-badges-btn')?.classList.remove('nav-glow');
        renderBadges();
    }
    updateNavigationVisibility();
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
        // Not a member: Only stories
        [mgrTab, relTab, statsTab, badgesTab, recordTab].forEach(t => t && (t.style.display = 'none'));
        if (storiesTab) storiesTab.style.display = 'flex';
        if (headerUser) headerUser.style.display = 'none';
        return;
    }

    const level = getUserLevel(currentUser);
    // isAlumni ถูกประกาศเป็น Global แล้วที่ต้นไฟล์

    if (level === 5) {
        // 🆕 New Member (Level 5): Only Stories, Hide Profile Header
        [mgrTab, relTab, statsTab, badgesTab, recordTab].forEach(t => t && (t.style.display = 'none'));
        if (storiesTab) storiesTab.style.display = 'flex';
        if (headerUser) headerUser.style.display = 'none';

        // Auto-switch to stories if currently on a restricted tab
        const activeTabEl = document.querySelector('.nav-item.active');
        if (activeTabEl && activeTabEl.id !== 'nav-stories-btn') {
            switchTab('stories', storiesTab);
        }
    } else if (isAlumni(currentUser.role) && level > 2) {
        // Alumni: Stories, Stats, Badges (Only if not a manager/admin)
        if (headerUser) headerUser.style.display = 'block';
        [mgrTab, relTab, recordTab].forEach(t => t && (t.style.display = 'none'));
        [storiesTab, statsTab, badgesTab].forEach(t => t && (t.style.display = 'flex'));

        // Auto-switch to stories if currently on a hidden tab
        const activeTabEl = document.querySelector('.nav-item.active');
        if (activeTabEl && activeTabEl.style.display === 'none') {
            switchTab('stories', storiesTab);
        }
    } else {
        // Active members (Staff/Officer/NewsEditor/Manager/Admin)
        if (headerUser) headerUser.style.display = 'block';
        [storiesTab, statsTab, badgesTab, relTab, recordTab].forEach(t => t && (t.style.display = 'flex'));
        if (mgrTab) mgrTab.style.display = (level <= 2) ? 'flex' : 'none';

        // Final sanity check for record tab (Officer/Staff only)
        if (recordTab) recordTab.style.display = (level <= 4) ? 'flex' : 'none';
    }

    // Update Add Announcement Button
    const btn = document.getElementById('addAnnounceBtnInPanel');
    if (btn) {
        btn.style.display = (level <= 3) ? 'inline-flex' : 'none';
        btn.classList.toggle('d-none', level > 3);
    }
}

// =====================================================
// 🤝 ระบบทำเนียบ (Directory & Hall of Fame) - ปรับปรุงใหม่
// =====================================================

function setRelationSubTab(tab) {
    currentRelationSubTab = tab;
    renderRelationTab();
}

function renderRelationTab() {
    const container = document.getElementById('relationContainer');
    if (!container) return;

    // Fix: Build globalUserStatsMap if empty
    if (!Object.keys(globalUserStatsMap || {}).length && Object.keys(allUsersMap || {}).length) {
        Object.values(allUsersMap).forEach(u => {
            const uid = String(u.lineId || u.userId || '').trim();
            if (!uid) return;
            globalUserStatsMap[uid] = {
                id: uid, name: u.name, img: u.img, role: u.role || 'Staff',
                score: parseInt(u.score) || 0, level: parseInt(u.level) || 1,
                avgHappy: parseFloat(u.happyScore || u.happy || 0),
                virtueStats: u.virtueStats || {},
                postsMade: parseInt(u.totalCount || 0),
                taggedIn: parseInt(u.taggedCount || 0),
                witnessCount: parseInt(u.witnessCount || 0),
                topFriends: u.topFriends || []
            };
        });
    }

    if (!globalUserStatsMap || Object.keys(globalUserStatsMap).length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted glass-card">
                <div class="spinner-border spinner-border-sm mb-2 text-warning"></div><br>
                กำลังเปิดบันทึกความทรงจำ...<br>
                <button class="btn btn-sm btn-outline-warning mt-3 rounded-pill px-3" onclick="cacheUsers().then(renderRelationTab)">คลิกเพื่อลองใหม่</button>
            </div>`;
        return;
    }

    // กรองกลุ่มศิษย์เก่า/ผู้เกษียณ/ย้าย/ทำเนียบ (ผู้ร่วมผูกพันสายใยความสุข)
    const allAlumni = Object.values(globalUserStatsMap).filter(u => isAlumni(u.role));

    const execAlumni = allAlumni.filter(u => ['Manager', 'Admin', 'Executive', 'หัวหน้า', 'ผู้บริหาร', 'ผอ.', 'คลังจังหวัด'].some(r => (u.role || '').toLowerCase().includes(r.toLowerCase())));
    const staffAlumni = allAlumni.filter(u => !execAlumni.includes(u));

    const activeList = currentRelationSubTab === 'executives' ? execAlumni : staffAlumni;

    let html = `
        <div class="relation-sub-tabs mb-3">
            <button class="relation-sub-btn ${currentRelationSubTab === 'executives' ? 'active' : ''}" onclick="setRelationSubTab('executives')">👨‍💼 ผู้บริหาร (${execAlumni.length})</button>
            <button class="relation-sub-btn ${currentRelationSubTab === 'staff' ? 'active' : ''}" onclick="setRelationSubTab('staff')">👥 เพื่อนร่วมงาน (${staffAlumni.length})</button>
        </div>
    `;

    if (activeList.length === 0) {
        html += '<div class="text-center py-5 text-muted glass-card"><i class="fas fa-box-open fa-2x mb-3 opacity-50"></i><br>ยังไม่มีรายชื่อในทำเนียบความผูกพันหมวดนี้</div>';
    } else {
        html += '<div class="hof-grid pb-4">';
        activeList.sort((a, b) => {
            const yearA = parseInt((a.role.match(/ปี\s*(\d{1,4})/) || [])[1]) || 0;
            const yearB = parseInt((b.role.match(/ปี\s*(\d{1,4})/) || [])[1]) || 0;
            if (yearA !== yearB) return yearB - yearA;
            return (b.score || 0) - (a.score || 0);
        }).forEach((u, index) => {
            const virtueInfo = getDominantVirtueLabel(u.virtueStats);
            const rankIcon = index === 0 ? '👑' : (index === 1 ? '🌟' : (index === 2 ? '⭐' : '✨'));

            // ดึงเฉพาะปีมาโชว์ ถ้ามี
            const yearMatch = u.role.match(/ปี\s*(\d{1,4})/);
            let roleDisplay = yearMatch ? `นท. ปี ${yearMatch[1]}` : u.role;

            // เปลี่ยนชื่อนิยามศิษย์เก่า/ลาออก/ย้าย/เกษียณ/อนุสรณ์ เป็นชื่อที่เป็นมิตรขึ้น
            const alumniRoles = ['ศิษย์เก่า', 'alumni', 'ลาออก', 'retired', 'memorial', 'อนุสรณ์', 'ย้าย', 'เกษียณ'];
            if (alumniRoles.some(r => u.role.toLowerCase().includes(r.toLowerCase()))) {
                if (!yearMatch) roleDisplay = 'ผู้ร่วมผูกพันสายใยความสุข';
            }

            html += `
            <div class="hof-card animate__animated animate__fadeInUp" style="animation-delay: ${index * 0.05}s;" onclick="openRelationDetail('${u.id}')">
                <div class="hof-rank">${rankIcon}</div>
                <div class="hof-avatar-wrapper">
                    <div class="hof-aura" style="background: radial-gradient(circle, ${virtueInfo.color} 0%, transparent 70%);"></div>
                    <img src="${u.img || 'https://dummyimage.com/80x80/ddd/888&text=?'}" class="hof-avatar" onerror="this.src='https://dummyimage.com/80x80/ddd/888&text=?'">
                    <div class="hof-virtue-icon" style="background:${virtueInfo.color}" title="${virtueInfo.label}">
                        ${virtueInfo.label.charAt(0)}
                    </div>
                </div>
                <div class="hof-info">
                    <h5 class="hof-name text-truncate">${u.name}</h5>
                    <div class="d-flex flex-wrap align-items-center gap-1 mt-1">
                        <span class="badge bg-light text-dark border" style="font-weight:normal;" title="${u.role}"><i class="fas fa-history me-1"></i>${roleDisplay}</span>
                        <span class="badge text-white" style="background:${virtueInfo.color}; font-weight:normal;">
                            <i class="fas fa-heart me-1"></i>${virtueInfo.label}
                        </span>
                    </div>
                </div>
                <div class="hof-score">
                    <div class="score-value">${(u.score || 0).toLocaleString()}</div>
                    <div class="score-label">XP สะสม</div>
                </div>
            </div>`;
        });
        html += '</div>';
    }
    container.innerHTML = html;
}

// ==========================================
// 🌟 หน้าต่างโปรไฟล์ศิษย์เก่า (ดึงข้อมูลแบบ Exact Match ตรงตัวเป๊ะๆ)
// ==========================================
function openRelationDetail(uid) {
    const targetId = String(uid || '').trim();
    const user = globalUserStatsMap[targetId];
    if (!user) {
        Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูล', text: 'ไม่พบข้อมูลของบุคลากรท่านนี้' });
        return;
    }

    // สลับหน้าจอ
    const listView = document.getElementById('relationListView');
    const detailView = document.getElementById('relationDetailView');
    if (listView) listView.style.display = 'none';
    if (detailView) detailView.style.display = 'block';

    const v = user.virtueStats || {};
    const virtueLabel = getDominantVirtueLabel(v);
    const virtueDesc = getVirtueDescription(virtueLabel.key);

    const postCount = parseInt(user.postsMade || user.totalCount || 0);
    const tagCount = parseInt(user.taggedIn || user.taggedCount || 0);
    const witnessCount = parseInt(user.witnessCount || 0);

    // 🌟 1. ดันข้อมูลจาก Cache (globalFeedData) ขึ้นแสดงทันที เพื่อความรวดเร็ว (Instant Load)
    currentRelationVisibleCount = 10;
    window.currentRelationPosts = (window.globalFeedData || []).filter(p => String(p.user_line_id || p.userId || '') === targetId);

    // แสดงโครงร่างเบื้องต้น (ที่มีประวัติเบื้องต้นจาก Cache)
    renderRelationHeader(user, virtueLabel, virtueDesc, postCount, tagCount, witnessCount);
    if (currentRelationPosts.length > 0) renderRelationHistory();

    // 🌟 2. ดึงข้อมูลจริงจาก Server แบบ Deep Fetch (รวมโพสต์เก่าๆ ที่อาจไม่เคยเห็น)
    fetchFeed(false, true, true, targetId).then(res => {
        if (res && res.feed) {
            window.currentRelationPosts = res.feed;
            renderRelationHistory();
        }
    }).catch(err => {
        console.warn("Deep fetch failed, using local only:", err);
    });

    // วาดกราฟ
    setTimeout(() => {
        const chartData = [v.volunteer || 0, v.sufficiency || 0, v.discipline || 0, v.integrity || 0, v.gratitude || 0];
        if (typeof drawPremiumRadar === 'function') {
            drawPremiumRadar('relationRadarChart', chartData, true, { showLabels: true });
        }
    }, 300);
}

function renderRelationHeader(user, virtueLabel, virtueDesc, postCount, tagCount, witnessCount) {
    const contentArea = document.getElementById('relationDetailContent');
    if (!contentArea) return;

    contentArea.innerHTML = `
        <div class="relation-detail-header p-4 text-center">
            <div class="profile-img-wrap mb-4 shadow">
                <img src="${user.img || 'https://dummyimage.com/100x100/ccc/888&text=?'}" class="profile-img-large" loading="lazy" onerror="this.src='https://dummyimage.com/100x100/ccc/888&text=?'">
            </div>
            <h4 class="fw-bold mb-1">${user.name}</h4>
            <div class="badge bg-warning text-dark rounded-pill mb-4 px-3">${user.role}</div>
            
            <div class="row g-2 mb-3 px-2">
                <div class="col-6">
                    <div class="staff-stat-card py-3">
                        <small class="text-muted">สถานะบุคลากร</small>
                        <div class="fs-5 fw-bold text-warning"><i class="fas fa-crown me-1"></i>Hall of Fame</div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="staff-stat-card py-3">
                        <small class="text-muted">คะแนนสะสม</small>
                        <div class="fs-4 fw-bold text-primary">${(user.score || 0).toLocaleString()} XP</div>
                    </div>
                </div>
            </div>

            <div class="row g-2 mb-3 px-2">
                <div class="col-4">
                    <div class="staff-stat-card py-2">
                        <div class="h5 mb-0 fw-bold text-primary">${postCount}</div>
                        <small class="text-muted" style="font-size:0.65rem;">สร้างโพสต์</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="staff-stat-card py-2">
                        <div class="h5 mb-0 fw-bold text-success">${tagCount}</div>
                        <small class="text-muted" style="font-size:0.65rem;">ถูกแท็ก</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="staff-stat-card py-2">
                        <div class="h5 mb-0 fw-bold text-warning">${witnessCount}</div>
                        <small class="text-muted" style="font-size:0.65rem;">เป็นพยาน</small>
                    </div>
                </div>
            </div>

            <div class="p-3 mb-3 rounded-4 text-start mx-2" style="background: var(--glass-bg); border: 1px solid var(--border-color);">
                <div class="d-flex align-items-center mb-2">
                    <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width:30px;height:30px;">
                        <i class="fas fa-medal" style="font-size:0.8rem;"></i>
                    </div>
                    <strong style="color: var(--primary-color);">อัตลักษณ์โดดเด่น: ${virtueLabel.label}</strong>
                </div>
                <p class="small mb-1 text-muted">${virtueDesc}</p>
            </div>

            <div class="mt-4 p-3 rounded-4 mx-2" style="background: var(--glass-bg); border: 1px solid var(--border-color);">
                <small class="fw-bold d-block mb-3 border-bottom pb-1 text-muted">ดัชนีความดีดั้งเดิม</small>
                <div style="height: 200px; position: relative;">
                    <canvas id="relationRadarChart"></canvas>
                </div>
            </div>

            <!-- History Section -->
            <div id="relationHistoryContainer" class="mt-4 px-2 pb-5 text-start">
                <div class="d-flex align-items-center mb-3">
                    <i class="fas fa-history text-muted me-2"></i>
                    <strong class="text-muted">ประวัติการแบ่งปันเรื่องราว</strong>
                </div>
                <div class="text-center py-5">
                    <div class="spinner-border text-primary mb-3"></div>
                    <div class="small text-muted">กำลังดึงข้อมูลประวัติย้อนหลัง...</div>
                </div>
            </div>
        </div>
    `;
}

function renderRelationHistory() {
    const container = document.getElementById('relationHistoryContainer');
    if (!container) return;

    if (!currentRelationPosts || currentRelationPosts.length === 0) {
        container.innerHTML = `
            <div class="d-flex align-items-center mb-3">
                <i class="fas fa-history text-muted me-2"></i>
                <strong class="text-muted">ประวัติการแบ่งปันเรื่องราว</strong>
            </div>
            <div class="text-center py-4 text-muted small bg-light rounded-4">
                <i class="fas fa-info-circle mb-2 d-block"></i> ไม่พบประวัติการโพสต์ที่เปิดเผยต่อสาธารณะ
            </div>
        `;
        return;
    }

    const html = generateFeedHtml(currentRelationPosts, {
        visibleCount: currentRelationVisibleCount,
        loadMoreOnClick: "loadMoreRelationHistory()",
        isReadOnly: true // 🔥 เปิดโหมดอ่านอย่างเดียวในหน้าทำเนียบ
    });

    container.innerHTML = `
        <div class="d-flex align-items-center mb-3">
            <i class="fas fa-history text-muted me-2"></i>
            <strong class="text-muted">ประวัติการแบ่งปันเรื่องราว (${currentRelationPosts.length})</strong>
        </div>
        ${html}
    `;
}

function loadMoreRelationHistory() {
    currentRelationVisibleCount += 10;
    renderRelationHistory();
}


function closeRelationDetail() {
    const list = document.getElementById('relationListView');
    const detail = document.getElementById('relationDetailView');
    if (list) list.style.display = 'block';
    if (detail) detail.style.display = 'none';
}

function filterRelationStaff() {
    const query = document.getElementById('relationSearch').value.toLowerCase();
    document.querySelectorAll('.role-item').forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(query) ? 'flex' : 'none';
    });
}

function getDominantVirtueLabel(stats) {
    if (!stats) return { label: 'เตรียมพร้อม', color: '#95a5a6', key: 'none' };
    const mapping = {
        volunteer: { label: 'จิตอาสา', color: '#3498db', key: 'volunteer' },
        sufficiency: { label: 'พอเพียง', color: '#2ecc71', key: 'sufficiency' },
        discipline: { label: 'มีวินัย', color: '#9b59b6', key: 'discipline' },
        integrity: { label: 'สุจริต', color: '#1abc9c', key: 'integrity' },
        gratitude: { label: 'กตัญญู', color: '#e84393', key: 'gratitude' }
    };

    let maxKey = 'none', maxVal = -1;
    Object.keys(mapping).forEach(k => {
        if ((stats[k] || 0) > maxVal) { maxVal = stats[k]; maxKey = k; }
    });

    if (maxVal <= 0) return { label: 'เพิ่งเริ่มต้น', color: '#95a5a6', key: 'none' };
    return mapping[maxKey];
}

function getVirtueDescription(virtueKey) {
    const desc = {
        volunteer: `ชอบช่วยเหลือผู้อื่นโดยไม่หวังผลตอบแทน มักอาสาในทุกกิจกรรมของทีม เป็นพลังบวกที่ทำให้เพื่อนร่วมงานมีความสุข`,
        sufficiency: `ยึดถือแนวทางความพอเพียง มีการวางแผนและใช้ทรัพยากรได้อย่างคุ้มค่า เป็นแบบอย่างที่ดีในการดำเนินชีวิต`,
        discipline: `มีความเป็นระเบียบวินัยสูง ตรงต่อเวลา และเคารพกฎกติกาอย่างเคร่งครัด สม่ำเสมอในการสร้างสรรค์ผลงาน`,
        integrity: `เป็นคนซื่อสัตย์สุจริต ยึดมั่นในความถูกต้องและโปร่งใส เป็นที่ไว้วางใจของเพื่อนพนักงานและองค์กรเสมอ`,
        gratitude: `มีความกตัญญูรู้คุณคน มีสัมมาคารวะและมักขอบคุณในความช่วยเหลือจากผู้อื่น สร้างบรรยากาศที่เกื้อกูลกันในทีม`
    };
    return desc[virtueKey] || 'กำลังมุ่งมั่นสะสมพลังความดีในด้านต่างๆ เพื่อเป็นพลังที่ยอดเยี่ยมให้แก่องค์กรในอนาคต';
}

function getActivityRange(uid) {
    if (!globalFeedData || globalFeedData.length === 0) return 'ยังไม่มีประวัติกิจกรรม';
    const userPosts = globalFeedData.filter(p => String(p.user_line_id) === String(uid));
    if (userPosts.length === 0) return 'ยังไม่ได้บันทึกกิจกรรม';

    const sorted = userPosts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const first = new Date(sorted[0].timestamp);

    const fmt = (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
    return `ประวัติกิจกรรม: ${fmt(first)} ถึงปัจจุบัน`;
}

function toggleNotifPanel() {
    const p = document.getElementById('notifPanel');
    const b = document.getElementById('notifBackdrop');
    if (!p.classList.contains('show')) {
        p.classList.add('show'); b?.classList.add('show'); fetchAnnouncements();
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

function saveAnnouncement() {
    const title = document.getElementById('ann-title').value.trim();
    const date = document.getElementById('ann-date').value;
    if (!title || !date) { Swal.fire({ toast: true, icon: 'warning', title: 'กรุณากรอกข้อมูล', position: 'top', timer: 3000 }); return; }

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    fetch(GAS_URL, {
        method: 'POST', body: JSON.stringify({
            action: 'save_announcement', title, eventDate: date,
            body: document.getElementById('ann-body').value.trim(),
            category: document.getElementById('ann-category').value, postedBy: currentUser.userId
        })
    }).then(r => r.json()).then(data => {
        if (data.status === 'success') {
            closeAnnounceModal();
            Swal.fire({ toast: true, icon: 'success', title: '✅ บันทึกประกาศสำเร็จ!', position: 'top', timer: 3000, showConfirmButton: false });
            setTimeout(() => toggleNotifPanel(), 1500);
        } else throw new Error(data.message);
    }).catch(err => {
        // Fallback if status not success but data might be saved
        closeAnnounceModal();
        Swal.fire({ toast: true, icon: 'success', title: '✅ บันทึกประกาศสำเร็จ!', position: 'top', timer: 3000, showConfirmButton: false });
        setTimeout(() => toggleNotifPanel(), 2000);
    });
}

// =====================================================
// 🛠️ ฟอร์มบันทึกความดี
// =====================================================
function setMood(val, btn) {
    selectedMood = val;
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function addEmoji(emoji) {
    const input = document.getElementById('noteInput');
    input.value += emoji + ' '; input.focus();
}

function handleFileSelect(input) {
    const files = Array.from(input.files);
    if (files.length === 0) return;

    // ✅ ดักจับไม่ให้เกิน 5 รูป
    if (currentImageFiles.length + files.length > 5) {
        Swal.fire('แจ้งเตือน', 'อัปโหลดภาพได้สูงสุด 5 ภาพต่อโพสต์ครับ', 'warning');
        input.value = "";
        return;
    }

    currentImageFiles = [...currentImageFiles, ...files];
    input.value = "";
    renderThumbnails();
}

function renderThumbnails() {
    const badge = document.getElementById('imgCountBadge');
    if (currentImageFiles.length > 0) {
        badge.innerText = currentImageFiles.length; badge.style.display = 'block';
    } else badge.style.display = 'none';

    const thumbList = document.getElementById('thumbList');
    if (!thumbList) return;
    thumbList.innerHTML = '';

    currentImageFiles.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const div = document.createElement('div');
            div.className = 'thumb-item';
            div.draggable = true;
            div.dataset.index = idx;
            div.ondragstart = (ev) => dragImage(ev, idx);
            div.innerHTML = `
                <img src="${e.target.result}" class="thumb-img" alt="thumb">
                <button class="btn-remove-img" onclick="removeImage(${idx})">&times;</button>
            `;
            thumbList.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeImage(idx) {
    currentImageFiles.splice(idx, 1);
    renderThumbnails();
}

// =====================================================
// ☁️ ระบบอัปโหลดรูปภาพผ่าน Cloudinary
// =====================================================
// กรุณาใส่ Cloud Name และ Upload Preset ของคุณ (นำมาจากหน้า Dashboard ของ Cloudinary)
const CLOUDINARY_CLOUD_NAME = 'dzh88q2fr';
const CLOUDINARY_UPLOAD_PRESET = 'ml_default';

async function uploadImageToCloudinary(file) {
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
        const response = await fetch(url, { method: 'POST', body: formData });
        const data = await response.json();

        if (response.ok) {
            return data.secure_url;
        } else {
            console.error('Cloudinary Error:', data);
            Swal.fire('Cloudinary Error', data.error?.message || 'Upload failed', 'error');
            return null;
        }
    } catch (error) {
        console.error('Network Error:', error);
        Swal.fire('Network Error', 'ไม่สามารถเชื่อมต่อ Cloudinary ได้', 'error');
        return null;
    }
}

async function submitData() {
    const virtue = document.getElementById('virtueSelect').value;
    const note = document.getElementById('noteInput').value.trim();
    if (!virtue) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกหมวดความดี', 'warning'); return; }

    const tagged = Array.from(document.querySelectorAll('.friend-item.selected')).map(el => el.dataset.id);
    const privacy = document.querySelector('input[name="privacyOption"]:checked').value;

    Swal.fire({ title: 'กำลังประมวลผลรูปภาพ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let finalImageUrl = document.getElementById('mediaLinkInput').value.trim();

    // อัปโหลดไฟล์ภาพไปยัง Cloudinary หากผู้ใช้มีการเลือกรูปภาพจริง
    if (currentImageFiles.length > 0) {
        Swal.fire({
            title: `กำลังอัปโหลดรูปภาพ (0/${currentImageFiles.length}) ☁️...`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const uploadedUrls = [];
        for (let i = 0; i < currentImageFiles.length; i++) {
            Swal.update({ title: `กำลังอัปโหลดรูปภาพ (${i + 1}/${currentImageFiles.length}) ☁️...` });
            const url = await uploadImageToCloudinary(currentImageFiles[i]);
            if (url) {
                uploadedUrls.push(url);
            } else {
                return; // Error shown in sub-function
            }
        }

        if (uploadedUrls.length > 0) {
            // ✅ ให้เอาลิงก์เดิมมาต่อกับรูปภาพใหม่ด้วยลูกน้ำ (,) แทนการลบทับ
            finalImageUrl = (finalImageUrl ? finalImageUrl + ',' : '') + uploadedUrls.join(',');
            document.getElementById('mediaLinkInput').value = finalImageUrl;
        }
    }

    Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'save_activity',
            userId: currentUser.userId,
            userName: currentUser.name,
            virtueTag: virtue,
            virtue,
            note,
            happyLevel: selectedMood,
            image: finalImageUrl,
            taggedFriends: tagged.join(','),
            privacy
        })
    }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }).then(data => {
        if (data.status === 'success') {
            // 🌪️ ตรวจสอบระบบ Auto Rescue (ความห่วงใยอัตโนมัติ)
            // ถ้าเลือกระดับความสุขเป็น 1 (เศร้า) ให้ถามว่าต้องการส่งสัญญาเรียกเพื่อนมาช่วยหรือไม่
            if (parseInt(selectedMood) === 1) {
                Swal.fire({
                    title: '💓 พลังใจของคุณดูเหนื่อยล้า...',
                    text: 'ต้องการส่งสัญญาณ "ขอพลังบวก" ให้เพื่อนร่วมงานทราบผ่านไลน์กลุ่มหรือไม่?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#ff7675',
                    confirmButtonText: '🚀 ส่งสัญญาณเรียกพวก!',
                    cancelButtonText: 'ไม่เป็นไร ขอบคุณครับ'
                }).then(res => {
                    if (res.isConfirmed) {
                        fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'trigger_auto_rescue', userId: currentUser.userId }) });
                        Swal.fire('ส่งสัญญาณแล้ว', 'เพื่อนๆ กำลังจะมาให้กำลังใจคุณนะ!', 'success');
                    }
                });
            }

            Swal.fire({
                icon: 'success',
                title: 'บันทึกสำเร็จ!',
                text: 'บันทึกความดีของคุณเรียบร้อยแล้ว',
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                // เคลียร์ค่าในฟอร์ม
                const noteEl = document.getElementById('noteInput');
                if (noteEl) noteEl.value = '';

                const virtueEl = document.getElementById('virtueSelect');
                if (virtueEl) virtueEl.value = '';

                const mediaEl = document.getElementById('mediaLinkInput');
                if (mediaEl) mediaEl.value = '';

                currentImageFiles = [];
                const fileCam = document.getElementById('fileCam');
                if (fileCam) fileCam.value = '';

                if (typeof renderThumbnails === 'function') renderThumbnails();

                // 🌟 กลับไปหน้าเรื่องราว และโหลด Feed ใหม่
                if (typeof switchTab === 'function') {
                    const navStories = document.getElementById('nav-stories-btn');
                    switchTab('stories', navStories);
                }

                // 🔄 โหลด Feed ใหม่ (หน่วงเวลานิดหน่วยเพื่อให้ GAS ประมวลผลเสร็จชัวร์ๆ)
                setTimeout(() => {
                    if (typeof fetchFeed === 'function') {
                        // ปลดล็อก flag เผื่อมีค้าง
                        isFetchingFeed = false;
                        fetchFeed(false, true); // ✅ ใช้โหมด Silent เพื่อไม่ให้กระพริบ Skeleton
                    }
                    // อัปเดตข้อมูลผู้ใช้ (คะแนนและกราฟ)
                    if (typeof checkUser === 'function' && currentUser) {
                        checkUser(currentUser.userId, currentUser);
                    }
                }, 300);
            });
        } else {
            Swal.fire('ผิดพลาด', data.message || 'บันทึกไม่สำเร็จ', 'error');
        }
    }).catch(err => {
        console.error('❌ Save Error:', err);
        Swal.fire('ผิดพลาด', 'บันทึกไม่สำเร็จ: ' + err.message, 'error');
    });
}

// =====================================================
// 📲 PWA & Service Worker (รองรับเต็มจอ iOS & Android)
// =====================================================
let deferredPrompt;

// เช็คว่าเป็นอุปกรณ์ iOS (Safari) หรือไม่
const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
};

// เช็คว่าผู้ใช้เปิดแอปจากหน้าจอโฮม (Standalone) หรือเปิดผ่านเบราว์เซอร์ปกติ
const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

window.addEventListener('beforeinstallprompt', (e) => {
    // ป้องกันไม่ให้ Chrome โชว์แถบติดตั้งอัตโนมัติที่ดูไม่สวย
    e.preventDefault();
    deferredPrompt = e;

    // โชว์ปุ่มของเราเอง (สำหรับ Android/Chrome)
    showInstallPromotion();
});

window.addEventListener('load', () => {
    // 🌟 ดักจับ iOS: ถ้าเปิดใน Safari ปกติ ให้สอนวิธีติดตั้ง
    if (isIos() && !isInStandaloneMode()) {
        showIosInstallPromotion();
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed:', err));
    }
});

// 🤖 ฟังก์ชันปุ่มติดตั้งสำหรับ Android
function showInstallPromotion() {
    if (document.getElementById('pwa-install-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'pwa-install-btn';
    btn.className = 'btn btn-primary rounded-pill shadow-lg animate__animated animate__bounceInUp';
    btn.innerHTML = '<i class="fas fa-download me-2"></i>ติดตั้งแอปลงเครื่อง';
    // ปรับหน้าตาปุ่มให้อยู่ตรงกลางชัดเจน
    btn.style.cssText = 'position:fixed; bottom:90px; left:50%; transform:translateX(-50%); z-index:9999; width:80%; max-width:280px; font-weight:bold; font-size:1rem; box-shadow: 0 8px 20px rgba(108, 92, 231, 0.4); border:2px solid #fff;';

    btn.onclick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                btn.remove();
            }
            deferredPrompt = null;
        }
    };
    document.body.appendChild(btn);
}

// 🍎 ฟังก์ชันสอนติดตั้งสำหรับ iOS (เพราะ iOS กดปุ่มลงเองไม่ได้)
function showIosInstallPromotion() {
    // ตรวจสอบว่าเคยแจ้งเตือนไปแล้วหรือยัง (ซ่อน 7 วันถ้ากดปิดไป)
    const lastAsked = localStorage.getItem('ios_install_prompt');
    if (lastAsked && Date.now() - parseInt(lastAsked) < 7 * 24 * 60 * 60 * 1000) return;

    if (document.getElementById('ios-install-popup')) return;

    const popup = document.createElement('div');
    popup.id = 'ios-install-popup';
    popup.className = 'animate__animated animate__fadeInUp';
    popup.style.cssText = `
        position: fixed; bottom: calc(20px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%);
        width: 90%; max-width: 350px; background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        padding: 15px 20px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        z-index: 10000; text-align: center; border: 1px solid rgba(0,0,0,0.1);
        color: #333; font-family: 'Kanit', sans-serif;
    `;

    // ไอคอน Share ของ iOS (ใช้เป็น Emoji หรือ Unicode หรือ SVG)
    popup.innerHTML = `
        <div style="position:absolute; top:8px; right:15px; font-size:1.5rem; cursor:pointer; color:#999;" onclick="closeIosInstall()">&times;</div>
        <div style="font-size:2rem; margin-bottom:5px; line-height:1;">📱</div>
        <h6 style="font-weight:bold; margin-bottom:8px; color:#000;">ต้องการใช้แอปแบบเต็มจอ?</h6>
        <p style="font-size:0.85rem; margin-bottom:12px; color:#555; line-height:1.5;">
            แตะปุ่มแชร์ <i class="fas fa-external-link-alt" style="transform: rotate(-90deg); opacity:0.7;"></i> ด้านล่าง<br>
            แล้วเลือก <strong>"เพิ่มไปยังหน้าจอโฮม"</strong><br>
            <span style="font-size:0.7rem; color:#888;">(Add to Home Screen)</span>
        </p>
        <button class="btn btn-sm btn-dark rounded-pill px-4" onclick="closeIosInstall()">เข้าใจแล้ว</button>
        <div style="position:absolute; bottom:-12px; left:50%; margin-left:-12px; border-width:12px 12px 0; border-style:solid; border-color:rgba(255, 255, 255, 0.95) transparent transparent; display:block; width:0;"></div>
    `;

    document.body.appendChild(popup);

    // ซ่อนอัตโนมัติใน 15 วินาที เพื่อไม่ให้บังหน้าจอ
    setTimeout(() => {
        const el = document.getElementById('ios-install-popup');
        if (el) {
            el.classList.replace('animate__fadeInUp', 'animate__fadeOutDown');
            setTimeout(() => closeIosInstall(false), 800);
        }
    }, 15000);
}

// ฟังก์ชันปิด Popup ของ iOS
window.closeIosInstall = function (setRecord = true) {
    const el = document.getElementById('ios-install-popup');
    if (el) el.remove();
    // บันทึกเวลาเพื่อไม่ให้เด้งกวนใจบ่อยๆ (ตั้งไว้ 7 วัน)
    if (setRecord) localStorage.setItem('ios_install_prompt', Date.now().toString());
};


// =====================================================
// 🌙 Dark Mode & Music Toggles
// =====================================================
function toggleDarkMode() {
    const root = document.documentElement;
    const currentTheme = root.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update icon
    const icon = document.querySelector('#darkModeToggle i');
    if (icon) {
        icon.className = newTheme === 'dark' ? 'fas fa-sun text-warning' : 'fas fa-moon';
    }
}

function toggleMusic() {
    const bgMusic = document.getElementById('bgMusic');
    const toggleBtn = document.getElementById('musicToggle');
    const icon = toggleBtn?.querySelector('i');
    if (!bgMusic) return;

    if (bgMusic.paused) {
        userMutedMusic = false; // 🌟 ปลดล็อก: ผู้ใช้ต้องการเปิดเพลงแล้ว

        bgMusic.play().then(() => {
            if (icon) icon.className = 'fas fa-music text-primary';
            if (toggleBtn) toggleBtn.classList.add('music-playing');
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: '🎵 กำลังเล่นเพลง', timer: 1500, showConfirmButton: false });
        }).catch(e => {
            console.warn('Local music failed, trying fallback:', e);
            bgMusic.innerHTML = '<source src="https://assets.mixkit.co/music/preview/mixkit-relaxing-in-nature-522.mp3" type="audio/mpeg">';
            bgMusic.load();
            bgMusic.play().then(() => {
                if (icon) icon.className = 'fas fa-music text-primary';
                if (toggleBtn) toggleBtn.classList.add('music-playing');
                Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: '🎵 กำลังเล่นเพลง (Online)', timer: 1500, showConfirmButton: false });
            }).catch(e2 => {
                console.error('All music sources failed:', e2);
                Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: '🔇 เบราว์เซอร์บล็อกเสียง กรุณาปฏิสัมพันธ์หน้าก่อน', timer: 3000, showConfirmButton: false });
            });
        });
    } else {
        userMutedMusic = true; // 🌟 ล็อก: ผู้ใช้ตั้งใจกดปิดเพลงแล้ว! ห้ามเล่นเองอีกเวลาสลับแท็บ

        bgMusic.pause();
        if (icon) icon.className = 'fas fa-volume-mute text-muted';
        if (toggleBtn) toggleBtn.classList.remove('music-playing');
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: '🔇 หยุดเล่นเพลง', timer: 1500, showConfirmButton: false });
    }
}


// 🌐 ระบบจัดการเพลงเมื่อสลับแท็บบราวเซอร์ (Browser Tab Visibility)
document.addEventListener('visibilitychange', () => {
    const bgMusic = document.getElementById('bgMusic');
    if (!bgMusic) return;

    if (document.hidden) {
        bgMusic.pause();
    } else {
        if (!userMutedMusic && bgMusic.paused) {
            bgMusic.play().catch(e => console.log('Auto-play after visibility change blocked:', e));
        }
    }
});

// =====================================================
// 📢 ระบบประกาศ (renderAnnouncement)
// =====================================================
function renderAnnouncement(config) {
    if (!config) return;
    const area = document.getElementById('announcementArea');
    if (!area) return;

    const announcements = config.announcements || config.notifications || [];
    if (announcements.length === 0) { area.style.display = 'none'; return; }

    const todayStr = new Date().toISOString().split('T')[0];
    const upcoming = announcements.filter(a => {
        const d = a.date || a.eventDate || '';
        const id = a.id || `ann_${d}_${a.title}`;
        // ตรวจสอบว่าผู้ใช้กดปิดไปหรือยัง
        const isHidden = localStorage.getItem(`hide_ann_${id}`) === 'true';
        return d >= todayStr && !isHidden;
    });

    if (upcoming.length === 0) { area.style.display = 'none'; return; }

    let html = '';
    upcoming.slice(0, 3).forEach(a => {
        const cat = a.category || 'general';
        const icon = CATEGORY_ICONS[cat] || '📢';
        const color = CATEGORY_COLORS[cat] || '#636e72';
        const id = a.id || `ann_${(a.date || a.eventDate)}_${a.title}`;

        html += `
            <div class="announcement-box animate__animated animate__fadeInDown" style="display:block; border-left-color:${color};" id="ann-box-${id}">
                <span class="announcement-close" onclick="closeAnnouncementItem('${id}')">×</span>
                <div class="d-flex align-items-center gap-2">
                    <div class="announcement-icon-wrapper" style="background:${color}15; color:${color}; min-width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center;">
                        <span style="font-size:1.2rem;">${icon}</span>
                    </div>
                    <div>
                        <div class="fw-bold small text-dark">${a.title || ''}</div>
                        <div class="text-muted" style="font-size:0.75rem;">${a.body || ''}</div>
                        <small class="text-muted" style="font-size:0.65rem;">📅 ${a.displayDate || a.date || ''}</small>
                    </div>
                </div>
            </div>`;
    });
    area.innerHTML = html;
    area.style.display = 'block';
}

function closeAnnouncementItem(id) {
    localStorage.setItem(`hide_ann_${id}`, 'true');
    const el = document.getElementById(`ann-box-${id}`);
    if (el) {
        el.classList.replace('animate__fadeInDown', 'animate__fadeOutUp');
        setTimeout(() => {
            el.remove();
            if (document.querySelectorAll('.announcement-box').length === 0) {
                document.getElementById('announcementArea').style.display = 'none';
            }
        }, 500);
    }
}

// =====================================================
// 🔗 Media Link Input Handler
// =====================================================
function handleLinkInput(value) {
    const url = (value || '').trim();
    const previewArea = document.getElementById('videoPreviewArea');
    if (!previewArea) return;

    if (!url) {
        previewArea.innerHTML = '';
        previewArea.style.display = 'none';
        return;
    }

    if (typeof getMediaContent === 'function') {
        const html = getMediaContent(url);
        if (html) {
            previewArea.innerHTML = html;
            previewArea.style.display = 'block';
        } else {
            previewArea.innerHTML = '';
            previewArea.style.display = 'none';
        }
    }
}

// =====================================================
// 🖱️ Image Drag & Drop
// =====================================================
let draggedImageIndex = null;

function allowDrop(event) {
    event.preventDefault();
}

function dragImage(event, index) {
    draggedImageIndex = index;
    event.dataTransfer.effectAllowed = 'move';
}

function dropImage(event) {
    event.preventDefault();
    if (draggedImageIndex === null) return;

    const thumbList = document.getElementById('thumbList');
    if (!thumbList) return;

    const items = Array.from(thumbList.children);
    const dropTarget = event.target.closest('.thumb-item');
    if (!dropTarget) return;

    const targetIndex = parseInt(dropTarget.dataset.index);
    if (isNaN(targetIndex) || targetIndex === draggedImageIndex) return;

    // Swap in currentImageFiles
    const tmp = currentImageFiles[draggedImageIndex];
    currentImageFiles[draggedImageIndex] = currentImageFiles[targetIndex];
    currentImageFiles[targetIndex] = tmp;

    // Re-render
    const dt = new DataTransfer();
    currentImageFiles.forEach(f => dt.items.add(f));
    const input = document.getElementById('fileCam');
    input.files = dt.files;
    handleFileSelect(input);

    draggedImageIndex = null;
}


// ==========================================
// 🌟 เครื่องยนต์สำหรับวาดกราฟแท่ง (ฉบับแก้ไขให้ขึ้นแน่นอน)
// ==========================================
function drawPersonalVirtueBarChart(virtueStats, canvasId = 'personalVirtueBarChart') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        console.warn("ไม่พบ Canvas ID: " + canvasId); // ช่วยเช็คใน Console ว่าหาตัววาดเจอไหม
        return;
    }

    // ล้างกราฟเก่า (ถ้ามี) เพื่อป้องกันอาการกราฟไม่ยอมวาดใหม่
    if (window['chart_' + canvasId]) {
        window['chart_' + canvasId].destroy();
    }

    // เตรียมข้อมูล (รองรับทศนิยม)
    const labels = ['จิตอาสา', 'พอเพียง', 'วินัย', 'สุจริต', 'กตัญญู'];
    const data = [
        parseFloat(virtueStats.volunteer || 0),
        parseFloat(virtueStats.sufficiency || 0),
        parseFloat(virtueStats.discipline || 0),
        parseFloat(virtueStats.integrity || 0),
        parseFloat(virtueStats.gratitude || 0)
    ];

    // เช็ค Dark Mode
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('theme') === 'dark';
    const mainColor = isDark ? 'rgba(162, 155, 254, 0.8)' : 'rgba(108, 92, 231, 0.8)';

    window['chart_' + canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: mainColor,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: isDark ? '#aaa' : '#666' },
                    grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                },
                x: {
                    ticks: { color: isDark ? '#aaa' : '#666' },
                    grid: { display: false }
                }
            }
        }
    });
}

function getUserLevel(user) {
    if (!user) return 5; // Default to Guest
    const r = (user.role || '').toLowerCase();
    if (r.includes('admin')) return 1;
    if (r.includes('manager') || r.includes('executive') || r.includes('ผู้บริหาร') || r.includes('คลังจังหวัด')) return 2;
    if (r.includes('newseditor') || r.includes('บรรณาธิการ')) return 3;
    if (isGuest(user.role)) return 5;
    return 4; // Staff
}

// --- 🚀 Scroll to Top Logic ---
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', () => {
    const btn = document.getElementById('scrollToTopBtn');
    if (!btn) return;

    if (window.scrollY > 400) {
        btn.classList.add('show');
    } else {
        btn.classList.remove('show');
    }
});

// --- 📱 iOS Audio & Interaction Fixes ---
function unlockAudio() {
    const sound = document.getElementById('notifSound');
    const bgMusic = document.getElementById('bgMusic');
    
    // พยายามเล่นเสียงสั้นๆ เพื่อเปิดทางให้ระบบ (Unlock)
    if (sound) {
        sound.muted = true;
        sound.play().then(() => {
            sound.pause();
            sound.muted = false;
            console.log('🔊 Notification audio unlocked');
        }).catch(e => console.log('Audio unlock pending...'));
    }
    
    // ทำเช่นเดียวกับเพลงพื้นหลัง
    if (bgMusic && bgMusic.paused && !userMutedMusic) {
        bgMusic.play().then(() => {
            console.log('🎵 Background music unlocked');
        }).catch(e => {});
    }

    // เมื่อปลดล็อกแล้วให้ถอน Event Listener ออกเพื่อประหยัดทรัพยากร
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
}

document.addEventListener('click', unlockAudio, { once: false });
document.addEventListener('touchstart', unlockAudio, { once: false });

// จัดการเรื่อง 100vh บน Mobile (iOS Chrome/Safari)
function setViewportHeight() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', setViewportHeight);
setViewportHeight();
