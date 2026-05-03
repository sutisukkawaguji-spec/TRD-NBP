// ============================================================
// 📊 dashboard.js — Manager Dashboard & Charts
// ============================================================

async function fetchManagerData(silent = false) {
    if (!silent) {
        Swal.fire({ title: 'กำลังดึงข้อมูลแดชบอร์ด...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    }

    const handleData = (data) => {
        if (!silent) Swal.close();
        if (data.status === 'error') {
            console.error("Dashboard Error:", data.message);
            return;
        }

        const appUsers = data.users || [];
        chartData = data.trend || []; // Used by renderManagerChart

        renderDashboard(appUsers);
        renderTRDChart(appUsers);
        renderManagerChart();

        const sList = document.getElementById('manager-staff-list');
        if (appUsers.length > 0) {
            globalAppUsers = appUsers;
            renderStaffList(appUsers);
        } else if (!silent) {
            if (sList) sList.innerHTML = '<div class="text-center py-5 text-muted"><i class="fas fa-users-slash fa-2x mb-3 d-block opacity-50"></i>ยังไม่มีข้อมูลพนักงานในระบบ</div>';
        }
    };

    if (READ_FROM_SUPABASE && supabaseClient) {
        try {
            const { data: allActs, error: actErr } = await supabaseClient.from('Activities').select('*');
            if (actErr) throw actErr;
            const { data: rawUsers, error: userErr } = await supabaseClient.from('Users').select('*');
            if (userErr) throw userErr;

            const userStatsMap = {};
            rawUsers.forEach(u => {
                const uid = String(u.LineID || u.line_id || u.userId || '');
                if (uid) {
                    userStatsMap[uid] = { 
                        score: 0, total: 0, tagged: 0, witness: 0, sumHappy: 0, count: 0, 
                        virtue: { volunteer: 0, sufficiency: 0, discipline: 0, integrity: 0, gratitude: 0 } 
                    };
                }
            });

            allActs.forEach(p => {
                const status = (p.Status || p.status || '').toLowerCase();
                if (status === 'rejected') return;
                const ownerId = String(p.UserId || p.user_line_id || "").trim();
                const taggedStr = p.Tagged || p.tagged || p.tagged_friends || "";
                const tagged = taggedStr ? String(taggedStr).split(',').map(s => s.trim()).filter(Boolean) : [];
                const virtue = (p.Virtue || p.virtue || '').toLowerCase();
                const score = (status === 'approved') ? (parseInt(p.Score || p.score) || 10) : 0;

                const addStats = (id, isOwner) => {
                    if (!id) return;
                    if (!userStatsMap[id]) userStatsMap[id] = { score: 0, total: 0, tagged: 0, witness: 0, sumHappy: 0, count: 0, virtue: { volunteer: 0, sufficiency: 0, discipline: 0, integrity: 0, gratitude: 0 } };
                    if (isOwner) userStatsMap[id].total += 1;
                    else userStatsMap[id].tagged += 1;
                    userStatsMap[id].score += score;
                    if (virtue && userStatsMap[id].virtue[virtue] !== undefined) userStatsMap[id].virtue[virtue] += score;
                    if (isOwner) {
                        const happyLevel = parseInt(p.Happy || p.HappyLevel || p.happy_level || 0);
                        if (happyLevel > 0) {
                            userStatsMap[id].sumHappy += happyLevel;
                            userStatsMap[id].count += 1;
                        }
                    }
                };
                addStats(ownerId, true);
                tagged.forEach(tid => addStats(tid, false));

                let rawJSON = p.JSON || p.Interactions || {};
                if (typeof rawJSON === 'string') try { rawJSON = JSON.parse(rawJSON); } catch (e) { }
                const verifies = rawJSON.verifies || rawJSON.Verify || [];
                verifies.forEach((v, idx) => {
                    if (!v) return;
                    const vid = String(v.userId || v.lineId || "").trim();
                    if (vid && idx < 2) {
                        if (!userStatsMap[vid]) userStatsMap[vid] = { score: 0, total: 0, tagged: 0, witness: 0, sumHappy: 0, count: 0, virtue: { volunteer: 0, sufficiency: 0, discipline: 0, integrity: 0, gratitude: 0 } };
                        userStatsMap[vid].witness += 1;
                        userStatsMap[vid].score += 3;
                    }
                });
            });

            const mappedUsers = rawUsers.map(u => {
                const uid = String(u.LineID || u.line_id || u.userId || '');
                const stats = userStatsMap[uid] || { score: 0, total: 0, tagged: 0, witness: 0, sumHappy: 0, count: 0, virtue: { volunteer: 0, sufficiency: 0, discipline: 0, integrity: 0, gratitude: 0 } };
                const avgHappyRaw = stats.count > 0 ? (stats.sumHappy / stats.count) : 0;
                const avgHappy10 = Math.min(10, avgHappyRaw * 2);
                const partIndex = Math.min(3, (stats.total || 0) * 0.3);
                const finalHappy = Math.min(10, Math.max(0, (avgHappy10 * 0.7) + partIndex));
                
                const finalScore = stats.score; 
                const finalLevel = Math.floor(finalScore / 500) + 1;
                
                const userData = {
                    lineId: uid, userId: uid, id: uid, name: u.Name || u.name, img: u.Image || u.image, role: u.Role || u.role,
                    score: finalScore, level: finalLevel, happyScore: finalHappy, virtueStats: stats.virtue,
                    totalCount: stats.total, taggedCount: stats.tagged, witnessCount: stats.witness,
                    topFriends: [], firstActive: u.FirstActive || u.first_active || null, status: u.Status || u.status || 'active'
                };
                
                globalUserStatsMap[uid] = userData;
                if (currentUser && uid === currentUser.userId) {
                    Object.assign(currentUser, userData);
                    if (typeof renderProfile === 'function') renderProfile();
                }
                return userData;
            });

            const groupedTrend = {};
            allActs.forEach(a => {
                if (a.Date) groupedTrend[a.Date] = (groupedTrend[a.Date] || 0) + (parseInt(a.Score || a.score) || 10);
            });
            
            // 🌟 [MOMENTUM INDEX] คำนวณแบบสะสม (Cumulative) เริ่มจาก 0 ตามความต้องการของ USER
            let cumulative = 0;
            const trendData = Object.keys(groupedTrend).sort().map(d => {
                cumulative += groupedTrend[d];
                return cumulative;
            });

            handleData({ status: 'success', users: mappedUsers, trend: trendData });
        } catch (err) {
            console.error("Supabase fetchManagerData failed:", err);
            runGASFetchManagerData(handleData);
        }
    } else {
        runGASFetchManagerData(handleData);
    }
}

function runGASFetchManagerData(handleData) {
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
        const getV = (key) => parseFloat(v[key] || v[key.charAt(0).toUpperCase() + key.slice(1)] || 0);

        scoreT += getV('integrity');
        scoreR += getV('discipline') + getV('sufficiency');
        scoreD += getV('volunteer') + getV('gratitude');
    });

    // 🌟 [ABBREVIATION] ใช้ formatScore เพื่อแสดงตัวย่อ เช่น 1.2k
    const formatScoreLocal = (num) => {
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return Number.isInteger(num) ? num : num.toFixed(1);
    };

    const cards = document.getElementById('trdScoreCards');
    if (cards) {
        cards.innerHTML = `
            <div class="col-4 border-end">
                <h3 class="fw-bold text-primary mb-0">${formatScoreLocal(scoreT)}</h3>
                <small class="text-muted fw-bold">Transparent</small>
            </div>
            <div class="col-4 border-end">
                <h3 class="fw-bold text-warning mb-0">${formatScoreLocal(scoreR)}</h3>
                <small class="text-muted fw-bold">Responsible</small>
            </div>
            <div class="col-4">
                <h3 class="fw-bold text-danger mb-0">${formatScoreLocal(scoreD)}</h3>
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
                barThickness: 45,
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
                    ticks: { 
                        color: textColor, 
                        font: { family: 'Kanit' },
                        callback: function(value) {
                            // 🌟 [FIX] แสดงตัวย่อในแกน Y ของกราฟ TRD
                            if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
                            return value;
                        }
                    }
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

        const happyRaw = parseFloat(u.happyScore || u.happy || 0);
        globalUserStatsMap[uid] = {
            id: uid, name: u.name, img: u.img, role: role,
            score: parseInt(u.score) || 0, level: parseInt(u.level) || 1,
            avgHappy: happyRaw, virtueStats: u.virtueStats || {},
            postsMade: parseInt(u.totalCount || 0), taggedIn: parseInt(u.taggedIn || u.taggedCount || 0),
            witnessCount: parseInt(u.witnessCount || 0), topFriends: u.topFriends || [],
            firstActive: u.firstActive || null,
            status: u.status || 'active'
        };

        if (!shouldIncludeInStats(role)) return;

        if (happyRaw > 0) {
            totalHappy += happyRaw;
            userWithData++;
        }

        if (happyRaw < 5.0) {
            issueCount++;
        }
    });

    const avgH = userWithData > 0 ? (totalHappy / userWithData) : 0;
    const progH = (avgH * 10).toFixed(0);

    const hVal = document.getElementById('h-index-val');
    const hProg = document.getElementById('h-index-progress');
    const uCount = document.getElementById('staff-active-count');
    const iCount = document.getElementById('issue-staff-count');

    if (hVal) hVal.innerText = avgH.toFixed(1);
    if (hProg) hProg.style.width = progH + '%';
    if (uCount) uCount.innerText = userWithData;
    if (iCount) iCount.innerText = issueCount;
}

function renderManagerChart() {
    const ctx = document.getElementById('managerLineChart');
    if (!ctx) return;
    if (window.myManagerChart) window.myManagerChart.destroy();

    const range = document.getElementById('chartRangeSelector')?.value || '15d';
    const indexValEl = document.getElementById('current-index-val');
    const indexChangeEl = document.getElementById('index-change-val');
    const indexBadgeEl = document.getElementById('index-status-badge');
    const indexDateEl = document.getElementById('index-date-range');

    let labels = [], dataPoints = [];
    let raw = chartData || [];

    if (raw.length > 0) {
        const currentVal = raw[raw.length - 1];
        const prevVal = raw.length > 1 ? raw[raw.length - 2] : 0;
        const diff = (currentVal - prevVal).toFixed(2);
        const percent = prevVal > 0 ? ((diff / prevVal) * 100).toFixed(2) : '100.00';
        const sign = diff >= 0 ? '+' : '';
        const colorClass = diff >= 0 ? 'text-success' : 'text-danger';
        const caret = diff >= 0 ? 'fa-caret-up' : 'fa-caret-down';

        if (indexValEl) indexValEl.innerText = Number(currentVal).toLocaleString(undefined, { minimumFractionDigits: 2 });
        if (indexChangeEl) {
            indexChangeEl.innerText = `${sign}${diff} (${sign}${percent}%)`;
            indexChangeEl.className = `small fw-bold ${colorClass}`;
        }
        if (indexBadgeEl) {
            indexBadgeEl.innerHTML = `<i class="fas ${caret} me-1"></i> ${diff >= 0 ? 'โมเมนตัมบวก' : 'โมเมนตัมลบ'}`;
            indexBadgeEl.className = `badge rounded-pill bg-white ${colorClass} shadow-sm`;
        }
        if (indexDateEl) {
            const now = new Date();
            indexDateEl.innerText = `Update: ${now.toLocaleDateString('th-TH')} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
    }

    if (range === '15d') {
        let items = raw.slice(-15);
        for (let i = 0; i < items.length; i++) {
            let d = new Date(); d.setDate(d.getDate() - (items.length - 1 - i));
            labels.push(d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }));
        }
        dataPoints = items;
    } else if (range === '30d') {
        let items = raw.slice(-30);
        for (let i = 0; i < items.length; i++) {
            let d = new Date(); d.setDate(d.getDate() - (items.length - 1 - i));
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
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#a29bfe' : '#6c5ce7';

    const isUp = dataPoints.length > 1 ? (dataPoints[dataPoints.length - 1] >= dataPoints[0]) : true;
    const chartColor = isUp ? '#00b894' : '#ff7675';
    const chartBg = isUp ? 'rgba(0, 184, 148, 0.1)' : 'rgba(255, 118, 117, 0.1)';

    window.myManagerChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: dataPoints,
                borderColor: chartColor,
                backgroundColor: chartBg,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHitRadius: 10,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    grid: { color: gridColor, drawBorder: false },
                    ticks: {
                        color: textColor,
                        font: { family: 'Kanit', size: 10 },
                        callback: function (value) { return value.toLocaleString(); }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Kanit', size: 10 } }
                }
            }
        }
    });
}
