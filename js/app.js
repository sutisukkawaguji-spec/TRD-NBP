// ============================================================
// 🚀  app.js — UI, Tabs, Forms, Charts & Notifications
//     ต้องโหลดหลัง config.js, auth.js และ feed.js
// ============================================================

// --- UI State (ประกาศไว้ใน config.js แล้ว ไม่ประกาศซ้ำ) ---

// =====================================================
// 📝 ระบบแบบสอบถามประจำเดือน
// =====================================================
function checkAndShowSurvey() {
    if (!currentUser || !currentUser.userId) return;

    const storageKey = `survey_${currentUser.userId}`;
    const surveyData = JSON.parse(localStorage.getItem(storageKey) || '{}');

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
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

    setTimeout(() => {
        Swal.fire({
            title: `📝 แบบสอบถามประจำเดือน ${monthDisplay}`,
            html: `
                <div class="text-center">
                    <div style="font-size:2.5rem;">😊</div>
                    <p class="mt-2 mb-1">ร่วมประเมินความสุขประจำเดือนกันเถอะ!</p>
                    <p class="text-muted small">ใช้เวลาแค่ 1 นาที ช่วยให้ผู้บริหารเข้าใจทีม</p>
                </div>
            `,
            allowOutsideClick: true,
            allowEscapeKey: true,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonColor: '#6c5ce7',
            confirmButtonText: '📝 ทำแบบสอบเลย!',
            denyButtonText: '⏰ ทำภายหลัง (7 วัน)',
            cancelButtonText: '❌ ไม่ทำเดือนนี้',
        }).then(result => {
            if (result.isConfirmed) {
                window.location.href = `survey.html?uid=${encodeURIComponent(currentUser.userId)}`;
            } else if (result.isDenied || result.dismiss === Swal.DismissReason.cancel) {
                const snoozeDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                surveyData.snoozeUntil = snoozeDate.toISOString();
                localStorage.setItem(storageKey, JSON.stringify(surveyData));
            }
        });
    }, 5000);
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

    fetch(`${GAS_URL}?action=get_users`)
        .then(res => res.json())
        .then(data => {
            container.innerHTML = '';
            let count = 0;
            data.forEach(user => {
                if (String(user.lineId) === String(currentUser.userId)) return;
                count++;
                const div = document.createElement('div');
                div.className = 'col-6 mb-2';
                div.innerHTML = `
                    <div class="friend-item p-2 border rounded d-flex align-items-center bg-white shadow-sm" style="cursor:pointer; transition: all 0.2s;" data-id="${user.lineId}" onclick="toggleFriend(this)">
                        <img src="${user.img || 'https://dummyimage.com/35x35/cccccc/ffffff&text=Friend'}" class="rounded-circle me-2 border" width="35" height="35" style="object-fit:cover;">
                        <div class="text-truncate small fw-bold" style="max-width: 120px;">${user.name}</div>
                    </div>
                `;
                container.appendChild(div);
            });
            if (count === 0) container.innerHTML = '<div class="col-12 text-center text-muted small py-3">ยังไม่มีผู้ใช้อื่นในระบบ</div>';
        })
        .catch(() => {
            container.innerHTML = '<div class="col-12 text-center text-danger small">โหลดรายชื่อไม่สำเร็จ</div>';
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

    Object.keys(badgeConfig).forEach(key => {
        const config = badgeConfig[key];
        const realLv = getCalculatedLevel(key, stats, score, total);
        const seenLv = storedLevels[key] || 0;
        if (realLv > seenLv) hasNewBadge = true;

        let html = '';
        if (realLv === 0) {
            html = `<div class="badge-item badge-locked" onclick="viewBadge('${config.title}', 'ยังทำไม่ถึงเกณฑ์ขั้นแรก', '🔒')"><div class="badge-icon">🔒</div><small>${config.title}</small></div>`;
        } else if (realLv > seenLv) {
            const next = config.levels[realLv - 1];
            html = `<div class="badge-item badge-mystery-upgrade" onclick="revealUpgrade('${key}', ${realLv}, '${config.title} ${next.rank}', '${next.icon}')"><div class="badge-icon">🎁</div><small>อัปเกรด!</small></div>`;
        } else {
            const curr = config.levels[realLv - 1];
            html = `<div class="badge-item" onclick="viewBadge('${config.title} ${curr.rank}', '${curr.desc}', '${curr.icon}')"><div class="badge-icon">${curr.icon}</div><small>${config.title} ${curr.rank}</small></div>`;
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
        title: 'ยินดีด้วย! อัปเกรดสำเร็จ',
        text: `คุณได้รับเหรียญ "${title}"`,
        imageUrl: `https://dummyimage.com/200x200/eee/000&text=${icon}`,
        imageWidth: 100, imageHeight: 100,
        confirmButtonColor: '#6c5ce7',
        confirmButtonText: 'สุดยอด!'
    }).then(() => {
        let storageKey = `happyMeter_badges_${currentUser.userId}`;
        let storedLevels = safeGetJSON(storageKey, {});
        storedLevels[badgeKey] = newLevelIdx;
        safeSetItem(storageKey, storedLevels);
        renderBadges();
    });
}

function viewBadge(t, d, i) {
    Swal.fire({ title: i + ' ' + t, text: d, confirmButtonColor: '#6c5ce7' });
}

// =====================================================
// 📈 ระบบผู้บริหาร (Dashboard)
// =====================================================
function fetchManagerData() {
    const sList = document.getElementById('staffListArea');
    if (sList) sList.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div><br><small class="text-muted">กำลังโหลดข้อมูล...</small></div>';

    fetch(`${GAS_URL}?action=get_dashboard&t=` + Date.now())
        .then(res => res.json())
        .then(data => {
            if (data.status === 'error') throw new Error(data.message);
            if (data.users?.length > 0) {
                globalAppUsers = data.users;
                if (!globalFeedData?.length) fetchFeed(true).then(() => renderDashboard(data.users));
                else renderDashboard(data.users);
                renderTRDChart(data.users);
            }
            if (data.trend) { chartData = data.trend; renderManagerChart(); }
        })
        .catch(err => { if (sList) sList.innerHTML = `<div class="text-danger text-center py-3">${err.message}</div>`; });
}

function renderTRDChart(users) {
    let scoreT = 0, scoreR = 0, scoreD = 0;
    users.forEach(u => {
        const v = u.virtueStats || {};
        scoreT += (parseInt(v['integrity']) || 0);
        scoreR += (parseInt(v['discipline']) || 0) + (parseInt(v['sufficiency']) || 0);
        scoreD += (parseInt(v['volunteer']) || 0) + (parseInt(v['gratitude']) || 0);
    });

    const cards = document.getElementById('trdScoreCards');
    if (cards) {
        cards.innerHTML = `
            <div class="col-4 border-end">
                <h3 class="fw-bold text-primary mb-0">${scoreT}</h3>
                <small class="text-muted fw-bold">Transparent</small>
            </div>
            <div class="col-4 border-end">
                <h3 class="fw-bold text-warning mb-0">${scoreR}</h3>
                <small class="text-muted fw-bold">Responsible</small>
            </div>
            <div class="col-4">
                <h3 class="fw-bold text-danger mb-0">${scoreD}</h3>
                <small class="text-muted fw-bold">Dedicated</small>
            </div>
        `;
    }

    const ctx = document.getElementById('trdBarChart');
    if (!ctx) return;
    if (window.myTrdChart) window.myTrdChart.destroy();

    window.myTrdChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Transparent (T)', 'Responsible (R)', 'Dedicated (D)'],
            datasets: [{
                label: 'คะแนนรวม',
                data: [scoreT, scoreR, scoreD],
                backgroundColor: [
                    'rgba(52, 152, 219, 0.7)',
                    'rgba(241, 196, 15, 0.7)',
                    'rgba(231, 76, 60, 0.7)'
                ],
                borderColor: [
                    'rgba(52, 152, 219, 1)',
                    'rgba(241, 196, 15, 1)',
                    'rgba(231, 76, 60, 1)'
                ],
                borderWidth: 1,
                borderRadius: 5,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
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
        const happyRaw = parseFloat(u.happyScore || u.happy || 0);
        globalUserStatsMap[uid] = {
            id: uid, name: u.name, img: u.img, role: u.role || 'Staff',
            score: parseInt(u.score) || 0, level: parseInt(u.level) || 1,
            avgHappy: happyRaw, virtueStats: u.virtueStats || {},
            postsMade: parseInt(u.totalCount || 0), taggedIn: parseInt(u.taggedCount || 0),
            witnessCount: parseInt(u.witnessCount || 0), topFriends: u.topFriends || []
        };
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
    Object.values(globalUserStatsMap).forEach(u => { totalPosts += u.postsMade; totalTeam += u.taggedIn; });

    document.getElementById('kpi-happy').innerText = (userWithData > 0 ? (totalHappy / userWithData * 10).toFixed(0) : '0') + '%';
    document.getElementById('kpi-posts').innerText = Object.keys(globalUserStatsMap).length + ' คน';

    let teamRate = 0;
    if (globalFeedData?.length) {
        let teamPosts = globalFeedData.filter(p => (p.taggedFriends || "").split(',').filter(s => s.trim().length > 5).length > 0).length;
        teamRate = (teamPosts / globalFeedData.length * 100).toFixed(0);
    }
    document.getElementById('kpi-teamwork').innerText = teamRate + '%';
    document.getElementById('kpi-issues').innerText = issueCount + ' คน';

    renderStaffTable(globalUserStatsMap);
}

function renderStaffTable(map) {
    const sList = document.getElementById('staffListArea');
    if (!sList) return;
    sList.innerHTML = '';

    Object.values(map).sort((a, b) => (a.avgHappy || 0) - (b.avgHappy || 0)).forEach(f => {
        const score = parseFloat(f.avgHappy) || 0;
        let status = 'status-normal', icon = '🟢';
        if (score < 5) { status = 'status-critical'; icon = '🔴'; }
        else if (score < 7) { status = 'status-warning'; icon = '🟠'; }

        let rescueHtml = '';
        if (status === 'status-critical' && f.topFriends?.length) {
            const r = f.topFriends[0];
            rescueHtml = `<div class="mt-2 p-3 bg-white border border-danger rounded shadow-sm d-flex align-items-start fade-in" style="border-left: 5px solid #ff7675!important;">
                <div class="me-3" style="font-size:1.5rem;">🤖</div>
                <div><div class="text-danger fw-bold small">🚨 AI Recommendation</div><div class="text-dark small mt-1">ภาวะหมดไฟ แนะนำเพื่อนช่วยดูแล:</div>
                <div class="mt-2 p-2 bg-light rounded border small d-flex align-items-center">
                <i class="fas fa-user-friends text-primary me-2"></i><span class="fw-bold text-primary">${r.name}</span><span class="text-muted ms-2">(สนิท ${r.count} ครั้ง)</span></div></div></div>`;
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
                        <div><h6 class="fw-bold text-dark mb-0">${f.name}</h6><span class="badge bg-light text-dark border mt-1 small">${f.role}</span></div>
                        <div class="text-end"><div class="fw-bold fs-4" style="color:${score < 5 ? '#e74c3c' : (score < 7 ? '#f39c12' : '#27ae60')}">${score > 0 ? score.toFixed(1) : '-'}</div>
                        <small class="text-muted small">${icon} ความสุข</small></div>
                    </div>
                </div>
            </div>${rescueHtml}`;
        sList.appendChild(div);
    });
}

function showStaffModal(uid) {
    const user = globalUserStatsMap[uid];
    if (!user) return;
    const v = user.virtueStats || {};
    const happyColor = user.avgHappy < 5 ? 'text-danger' : (user.avgHappy < 7 ? 'text-warning' : 'text-success');

    // Build top-friends HTML
    let friendsHtml = '';
    if (user.topFriends && user.topFriends.length > 0) {
        friendsHtml = '<div class="mt-3"><small class="fw-bold text-muted"><i class="fas fa-heart text-danger me-1"></i>สนิทผู้อื่นกับ:</small><div class="d-flex flex-wrap gap-1 mt-1">';
        user.topFriends.slice(0, 5).forEach(f => {
            friendsHtml += `<span class="badge bg-light text-dark border p-2 rounded-pill">${f.name} (${f.count})</span>`;
        });
        friendsHtml += '</div></div>';
    }

    Swal.fire({
        title: 'ข้อมูลบุคลากร',
        html: `<div style="text-align:left;" class="staff-modal-content">
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
                        <span class="staff-stat-val text-primary">${user.score}</span>
                    </div>
                </div>
            </div>
            
            <div class="row g-2 mb-3">
                <div class="col-4">
                    <div class="staff-stat-card">
                        <span class="staff-stat-val text-primary" style="color:#3498db !important;">${user.postsMade || 0}</span>
                        <small class="staff-stat-label">โพสต์สร้าง</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="staff-stat-card">
                        <span class="staff-stat-val text-info" style="color:#17a2b8 !important;">${user.taggedIn || 0}</span>
                        <small class="staff-stat-label">ถูกแท็ก</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="staff-stat-card">
                        <span class="staff-stat-val text-success" style="color:#28a745 !important;">${user.witnessCount || 0}</span>
                        <small class="staff-stat-label">กดพยาน</small>
                    </div>
                </div>
            </div>
            
            ${friendsHtml}
            
            <div class="mt-4 p-3 rounded-4 border" style="background:rgba(0,0,0,0.02)">
                <small class="fw-bold text-muted d-block mb-2 text-center">กราฟสมดุลพลัง</small>
                <canvas id="staffRadarChart" style="max-height:220px;"></canvas>
            </div>
        </div>`,
        showConfirmButton: false,
        showCloseButton: true,
        width: '450px',
        didOpen: () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const gridColor = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.1)';
            const labelColor = isDark ? '#ddd' : '#666';
            const webColor = isDark ? '#a29bfe' : '#6c5ce7'; // Lighter purple for dark mode

            new Chart(document.getElementById('staffRadarChart'), {
                type: 'radar',
                data: {
                    labels: ['จิตอาสา', 'พอเพียง', 'วินัย', 'สุจริต', 'กตัญญู'],
                    datasets: [{
                        data: [v.volunteer || 0, v.sufficiency || 0, v.discipline || 0, v.integrity || 0, v.gratitude || 0],
                        backgroundColor: isDark ? 'rgba(162, 155, 254, 0.2)' : 'rgba(108, 92, 231, 0.2)',
                        borderColor: webColor,
                        borderWidth: 2,
                        pointBackgroundColor: webColor,
                        pointBorderColor: '#fff',
                        pointRadius: 3
                    }]
                },
                options: {
                    scales: {
                        r: {
                            circular: false, // Pentagon shape
                            suggestedMin: 0,
                            suggestedMax: 10,
                            ticks: { display: false },
                            grid: { color: gridColor },
                            angleLines: { color: gridColor },
                            pointLabels: { color: labelColor, font: { size: 10, weight: 'bold' }, padding: 15 }
                        }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    });
}

function initUserRadar() {
    const ctx = document.getElementById('userRadarChart');
    if (!ctx || !currentUser) return;
    if (window.myRadarChart) window.myRadarChart.destroy();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
    const angleColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
    const labelColor = isDark ? '#ddd' : '#666';
    window.myRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['จิตอาสา', 'พอเพียง', 'วินัย', 'สุจริต', 'กตัญญู'],
            datasets: [{
                label: 'ความดี',
                data: [currentUser.virtueStats.volunteer || 0, currentUser.virtueStats.sufficiency || 0, currentUser.virtueStats.discipline || 0, currentUser.virtueStats.integrity || 0, currentUser.virtueStats.gratitude || 0],
                backgroundColor: 'rgba(255, 193, 7, 0.2)', borderColor: 'rgba(255, 193, 7, 1)', borderWidth: 3, pointRadius: 5,
                pointBackgroundColor: 'rgba(255, 193, 7, 1)', pointBorderColor: '#fff', pointBorderWidth: 2
            }]
        },
        options: {
            scales: {
                r: {
                    angleLines: { display: true, color: angleColor },
                    grid: { circular: false, color: gridColor },
                    suggestedMin: 0, suggestedMax: 10,
                    ticks: { display: false },
                    pointLabels: {
                        color: labelColor,
                        font: { size: 12, weight: 'bold' },
                        padding: 30 // Extra padding to clear icons
                    }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
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

    window.myManagerChart = new Chart(ctx, {
        type: 'line', data: { labels, datasets: [{ data: dataPoints, borderColor: '#0984e3', backgroundColor: 'rgba(9,132,227,0.1)', fill: true, tension: 0.1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { suggestedMin: 4, suggestedMax: 10 } } }
    });
}

// =====================================================
// 🔔 ระบบแจ้งเตือน (In-App)
// =====================================================
function triggerNotificationEffects() {
    const bell = document.getElementById('bellIcon');
    if (bell) { bell.classList.remove('bell-shake'); void bell.offsetWidth; bell.classList.add('bell-shake'); }
    const sound = document.getElementById('notifSound');
    if (sound) { sound.currentTime = 0; sound.play().catch(e => console.log("Sound error:", e)); }
}

function processAnnounceData(data, silent = false) {
    try {
        if (!data) return;
        const rawItems = data.announcements || data.data || (Array.isArray(data) ? data : []);
        const oldIds = appNotifications.map(n => n.id);
        const todayStr = new Date().toISOString().split('T')[0];
        let hasNewUpcoming = false;
        let newlyDetected = false;

        const gasNotifs = rawItems.map(a => {
            const itemDate = a.date || '';
            if (itemDate && itemDate >= todayStr && !oldIds.includes(a.id)) hasNewUpcoming = true;
            if (!oldIds.includes(a.id)) newlyDetected = true;
            return {
                id: a.id || 'gas_' + Math.random(), title: a.title, body: a.body,
                date: itemDate, displayDate: a.displayDate || itemDate,
                time: a.displayDate || itemDate, source: 'gas', category: a.category || 'general', ts: a.ts
            };
        });

        const otherNotifs = appNotifications.filter(n => n.source !== 'gas');
        appNotifications = [...gasNotifs, ...otherNotifs];

        if (silent) { if (newlyDetected) renderNotifList(); }
        else { renderNotifList(); }

        if (hasNewUpcoming && !silent) {
            triggerNotificationEffects();
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: '📢 มีกิจกรรมใหม่ที่กำลังจะถึง!', showConfirmButton: false, timer: 3500 });
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

    const today = new Date().toISOString().split('T')[0];
    const clearedAt = parseInt(localStorage.getItem('notif_cleared_at') || '0');
    let unreadCount = 0, html = '';

    appNotifications.sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(n => {
        let ts = 0; if (n.ts) { try { ts = new Date(String(n.ts).replace(/\(.*\)/, '')).getTime(); } catch (e) { } }
        const isNew = ts > clearedAt;
        const isUpcoming = n.date && n.date >= today;
        if (n.id !== 'test_render' && (isNew || isUpcoming)) unreadCount++;

        const color = CATEGORY_COLORS[n.category] || '#636e72';
        html += `
            <div class="notif-item ${isUpcoming ? 'notif-upcoming' : ''}" style="${isNew ? `border-left:4px solid ${color};` : ''}" onclick="readNotif('${n.id}')">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <span class="notif-title fw-bold">${n.title}</span>
                    ${isUpcoming ? '<span class="notif-status-badge bg-primary text-white">เร็วๆ นี้</span>' : ''}
                    ${isNew && !isUpcoming ? '<span class="notif-status-badge bg-danger text-white">NEW</span>' : ''}
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

function setupBackgroundSync() {
    setInterval(() => { if (currentUser) { fetchAnnouncements(true); fetchFeed(false, true); } }, 120000);
}

function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return;

    const lastAsked = parseInt(safeGetItem('notif_asked_at') || '0');
    const daysSinceAsked = (Date.now() - lastAsked) / (1000 * 60 * 60 * 24);
    if (lastAsked > 0 && daysSinceAsked < 30) return;

    setTimeout(() => {
        Swal.fire({
            toast: true, position: 'top', icon: 'info',
            title: '🔔 รับการแจ้งเตือนใหม่?',
            text: 'รับแจ้งเตือนเมื่อมีกิจกรรมหรือเรื่องราวใหม่',
            showConfirmButton: true, showCancelButton: true,
            confirmButtonText: 'เปิด', cancelButtonText: 'ไม่',
            confirmButtonColor: '#6c5ce7', timer: 8000
        }).then(result => {
            safeSetItem('notif_asked_at', Date.now().toString());
            if (result.isConfirmed) {
                Notification.requestPermission().then(perm => {
                    if (perm === 'granted') showAppNotification('😊 Happy Meter', 'เปิดใช้งานการแจ้งเตือนแล้ว!', 'welcome');
                });
            }
        });
    }, 8000);
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
    const item = appNotifications.find(n => n.id === id);
    if (item?.ts) {
        const parsed = new Date(String(item.ts).replace(/\(.*\)/, '').trim());
        if (!isNaN(parsed.getTime())) {
            const current = parseInt(localStorage.getItem('notif_cleared_at') || '0');
            if (parsed.getTime() > current) localStorage.setItem('notif_cleared_at', parsed.getTime().toString());
        }
    }
    localStorage.setItem(`notif_read_${id}`, 'true');
    renderNotifList();
}

function markAllNotifRead() {
    localStorage.setItem('notif_cleared_at', Date.now().toString());
    renderNotifList();
}

function loadNotificationsFromConfig(config) {
    if (!config?.notifications) return;
    configNotifications = config.notifications.map(n => ({ ...n, source: 'config' }));
    const gasNotifs = appNotifications.filter(n => n.source === 'gas');
    appNotifications = [...gasNotifs, ...configNotifications];
    renderNotifList();
}

// =====================================================
// 🏗️ การควบคุม Tab และ Modal
// =====================================================
function safetyResumeMusic() {
    const bgMusic = document.getElementById('bgMusic');
    if (bgMusic && bgMusic.paused) {
        bgMusic.play().catch(e => console.log('Music resume blocked:', e));
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
    document.getElementById('page-' + pageId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');

    if (pageId === 'stories') {
        const navBtn = document.getElementById('nav-stories-btn');
        navBtn?.querySelector('.nav-notify-badge')?.remove();
        if (!document.getElementById('feedContainer')?.querySelector('.feed-card')) fetchFeed();
        else if (globalFeedData?.length) safeSetItem('lastSeenStoryCount', globalFeedData.length);
    }

    document.getElementById('header-user').style.display = (pageId === 'manager') ? 'none' : 'block';
    if (pageId === 'manager') fetchManagerData();
    if (pageId === 'badges') document.getElementById('nav-badges-btn')?.classList.remove('nav-glow');
    updateAddAnnounceButton();
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
    const files = input.files;
    const badge = document.getElementById('imgCountBadge');
    if (files.length > 0) {
        badge.innerText = files.length; badge.style.display = 'block';
    } else badge.style.display = 'none';

    // Render thumbnails
    const thumbList = document.getElementById('thumbList');
    if (thumbList) thumbList.innerHTML = '';
    currentImageFiles = Array.from(files);
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
    // Re-render
    const dt = new DataTransfer();
    currentImageFiles.forEach(f => dt.items.add(f));
    const input = document.getElementById('fileCam');
    input.files = dt.files;
    handleFileSelect(input);
}

async function submitData() {
    const virtue = document.getElementById('virtueSelect').value;
    const note = document.getElementById('noteInput').value.trim();
    if (!virtue) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกหมวดความดี', 'warning'); return; }

    const tagged = Array.from(document.querySelectorAll('.friend-item.selected')).map(el => el.dataset.id);
    const privacy = document.querySelector('input[name="privacyOption"]:checked').value;

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const image = document.getElementById('mediaLinkInput').value.trim();

    fetch(GAS_URL, {
        method: 'POST', body: JSON.stringify({
            action: 'save_activity', userId: currentUser.userId, virtue, note,
            happy: selectedMood, image, taggedFriends: tagged.join(','), privacy
        })
    }).then(res => res.json()).then(data => {
        if (data.status === 'success') {
            Swal.fire('สำเร็จ!', 'บันทึกความดีแล้ว', 'success').then(() => {
                location.reload();
            });
        } else throw new Error(data.message);
    }).catch(err => Swal.fire('ผิดพลาด', err.message, 'error'));
}

// =====================================================
// 📲 PWA & Service Worker
// =====================================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPromotion();
});

function showInstallPromotion() {
    if (document.getElementById('pwa-install-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'pwa-install-btn';
    btn.className = 'btn btn-primary rounded-pill shadow-lg install-pwa-btn animate__animated animate__bounceInUp';
    btn.innerHTML = '<i class="fas fa-download me-2"></i>ติดตั้งแอปลงเครื่อง';
    btn.style.cssText = 'position:fixed; bottom:80px; left:20px; z-index:9999;';
    btn.onclick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') btn.remove();
            deferredPrompt = null;
        }
    };
    document.body.appendChild(btn);
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed:', err));
    });
}

function initPullToRefresh() {
    let touchStart = 0;
    const pullContainer = document.getElementById('pullRefreshContainer');
    if (!pullContainer) return;

    pullContainer.addEventListener('touchstart', e => {
        if (window.scrollY === 0) touchStart = e.touches[0].clientY;
    }, { passive: true });

    pullContainer.addEventListener('touchmove', e => {
        if (window.scrollY === 0 && touchStart > 0) {
            let pull = e.touches[0].clientY - touchStart;
            if (pull > 50) pullContainer.classList.add('pull-active');
        }
    }, { passive: true });

    pullContainer.addEventListener('touchend', () => {
        if (pullContainer.classList.contains('pull-active')) {
            if (typeof fetchFeed === 'function') fetchFeed();
            pullContainer.classList.remove('pull-active');
        }
        touchStart = 0;
    });
}

// Initialize components
document.addEventListener('DOMContentLoaded', () => {
    initPullToRefresh();
    setupBackgroundSync();
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('notifPanel');
        const bell = document.getElementById('notifBellBtn');
        const modal = document.getElementById('announceModal');
        if (panel?.classList.contains('show') && !panel.contains(e.target) && !bell?.contains(e.target) && !modal?.contains(e.target)) {
            closeNotifPanel();
        }
    });
});

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
        // Try to play, if local fails use fallback
        bgMusic.play().then(() => {
            if (icon) icon.className = 'fas fa-music text-primary';
            if (toggleBtn) toggleBtn.classList.add('music-playing');
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: '🎵 กำลังเล่นเพลง', timer: 1500, showConfirmButton: false });
        }).catch(e => {
            console.warn('Local music failed, trying fallback:', e);
            // Fallback: use online ambient music
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
        bgMusic.pause();
        if (icon) icon.className = 'fas fa-volume-mute text-muted';
        if (toggleBtn) toggleBtn.classList.remove('music-playing');
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: '🔇 หยุดเล่นเพลง', timer: 1500, showConfirmButton: false });
    }
}

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
        return d >= todayStr;
    });

    if (upcoming.length === 0) { area.style.display = 'none'; return; }

    let html = '';
    upcoming.slice(0, 3).forEach(a => {
        const cat = a.category || 'general';
        const icon = CATEGORY_ICONS[cat] || '📢';
        const color = CATEGORY_COLORS[cat] || '#636e72';
        html += `
            <div class="announcement-box" style="display:block; border-left-color:${color};">
                <span class="announcement-close" onclick="this.parentElement.remove()">×</span>
                <div class="d-flex align-items-center gap-2">
                    <span style="font-size:1.3rem;">${icon}</span>
                    <div>
                        <div class="fw-bold small">${a.title || ''}</div>
                        <div class="text-muted" style="font-size:0.75rem;">${a.body || ''}</div>
                        <small class="text-muted" style="font-size:0.65rem;">📅 ${a.displayDate || a.date || ''}</small>
                    </div>
                </div>
            </div>`;
    });
    area.innerHTML = html;
    area.style.display = 'block';
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
