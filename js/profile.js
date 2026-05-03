// ============================================================
// 👤 profile.js — Profile Rendering & Stats
// ============================================================

function renderProfile() {
    if (!currentUser) return;
    const pName = document.getElementById('profile-name');
    const pRole = document.getElementById('profile-role');
    const pImg = document.getElementById('profile-img');
    const pScore = document.getElementById('profile-score');
    const pLevel = document.getElementById('profile-level');
    const pProgress = document.getElementById('profile-progress');
    const pXpText = document.getElementById('xp-text');
    const hBar = document.getElementById('happy-meter-bar');
    const hVal = document.getElementById('happy-meter-val');

    if (pName) pName.innerText = currentUser.name || 'พนักงาน';
    if (pRole) pRole.innerText = currentUser.role || 'Staff';
    if (pImg) pImg.src = currentUser.img || 'https://dummyimage.com/100x100/ddd/888&text=User';

    const score = parseInt(currentUser.score || 0);
    const level = Math.floor(score / 500) + 1;
    const progress = (score % 500) / 5;

    if (pScore) pScore.innerText = score.toLocaleString();
    if (pLevel) pLevel.innerText = level;
    if (pProgress) pProgress.style.width = progress + '%';
    if (pXpText) pXpText.innerText = (score % 500) + ' / 500 XP';

    const hScore = parseFloat(currentUser.happyScore || 0);
    if (hBar) hBar.style.width = (hScore * 10) + '%';
    if (hVal) hVal.innerText = hScore.toFixed(1);

    drawPersonalVirtueBarChart(currentUser.virtueStats || {});
}

function initUserRadar() {
    const canvas = document.getElementById('userRadarChart');
    if (!canvas || !currentUser) return;

    if (window.myRadarChart) window.myRadarChart.destroy();

    const v = currentUser.virtueStats || {};
    const getV = (key) => parseFloat(v[key] || v[key.charAt(0).toUpperCase() + key.slice(1)] || 0);

    const dataPoints = [getV('volunteer'), getV('sufficiency'), getV('discipline'), getV('integrity'), getV('gratitude')];
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.1)';
    const labelColor = isDark ? '#a29bfe' : '#6c5ce7';

    window.myRadarChart = new Chart(canvas, {
        type: 'radar',
        data: {
            labels: ['🤝 จิตอาสา', '🌱 พอเพียง', '📏 วินัย', '💎 สุจริต', '🙏 กตัญญู'],
            datasets: [{
                label: 'คะแนนสะสม',
                data: dataPoints,
                backgroundColor: isDark ? 'rgba(162, 155, 254, 0.25)' : 'rgba(108, 92, 231, 0.2)',
                borderColor: isDark ? '#a29bfe' : '#6c5ce7',
                borderWidth: 3,
                pointBackgroundColor: '#fff',
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
                    pointLabels: {
                        font: { size: 14, weight: 'bold', family: "'Kanit', sans-serif" },
                        color: labelColor,
                        padding: 10
                    }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

async function syncUserScore(lineId) {
    if (!lineId || !supabaseClient) return;
    try {
        const { data: uData } = await supabaseClient.from('Users').select('Name').eq('LineID', lineId).maybeSingle();
        if (!uData) return;

        const { data: acts } = await supabaseClient
            .from('Activities')
            .select('*')
            .or(`UserId.eq.${lineId},Tagged.ilike.%${lineId}%`);

        let score = 0;
        let vStats = { volunteer: 0, sufficiency: 0, discipline: 0, integrity: 0, gratitude: 0 };
        let totalCount = 0;
        let taggedCount = 0;
        let sumHappy = 0;
        let happyCount = 0;

        (acts || []).forEach(p => {
            const status = (p.Status || "").toLowerCase();
            const s = (status === 'approved') ? (parseInt(p.Score || p.score) || 10) : 0;
            const isOwner = p.UserId === lineId;
            
            if (isOwner) {
                totalCount++;
                const happyLevel = parseInt(p.Happy || p.HappyLevel || p.happy_level || 0);
                if (happyLevel > 0) {
                    sumHappy += happyLevel;
                    happyCount++;
                }
            } else {
                taggedCount++;
            }

            if (s > 0) {
                score += s;
                if (p.Virtue && vStats[p.Virtue.toLowerCase()] !== undefined) vStats[p.Virtue.toLowerCase()] += s;
            }
        });

        const { data: witnessActs } = await supabaseClient.from('Activities').select('JSON').ilike('JSON', `%${lineId}%`);
        let witnessCount = 0;
        (witnessActs || []).forEach(p => {
            let json = p.JSON;
            if (typeof json === 'string') try { json = JSON.parse(json); } catch(e){}
            const verifies = json.verifies || [];
            verifies.forEach((v, idx) => {
                if (idx < 2 && (v.userId === lineId || v.lineId === lineId)) {
                    score += 3;
                    witnessCount++;
                }
            });
        });

        const avgHappyRaw = happyCount > 0 ? (sumHappy / happyCount) : 0;
        const avgHappy10 = Math.min(10, avgHappyRaw * 2);
        const partIndex = Math.min(3, totalCount * 0.3);
        const finalHappy = Math.min(10, Math.max(0, (avgHappy10 * 0.7) + partIndex));
        const level = Math.floor(score / 500) + 1;
        
        const updatePayload = {
            "Score": score, "Level": level, "VirtueStats": vStats,
            "TotalCount": totalCount, "TaggedCount": taggedCount, "WitnessCount": witnessCount,
            "HappyScore": finalHappy
        };

        await supabaseClient.from('Users').update(updatePayload).eq('LineID', lineId);
        
        if (currentUser && lineId === currentUser.userId) {
            Object.assign(currentUser, {
                score, level, happyScore: finalHappy, virtueStats: vStats,
                totalCount, taggedCount, witnessCount
            });
            if (typeof saveUserSession === 'function') saveUserSession(currentUser);
            renderProfile();
        }
    } catch (e) { console.error(`❌ [Sync] Failed for ${lineId}:`, e); }
}

function renderBadges() {
    const list = document.getElementById('badge-list');
    if (!list || !currentUser) return;

    let html = '';
    const stats = {
        'volunteer': currentUser.virtueStats?.volunteer || 0,
        'sufficiency': currentUser.virtueStats?.sufficiency || 0,
        'discipline': currentUser.virtueStats?.discipline || 0,
        'integrity': currentUser.virtueStats?.integrity || 0,
        'gratitude': currentUser.virtueStats?.gratitude || 0,
        'score': currentUser.score || 0,
        'total': currentUser.totalCount || 0
    };

    for (const [key, category] of Object.entries(badgeConfig)) {
        const count = stats[category.source || key] || 0;
        let currentRank = category.levels[0];
        category.levels.forEach(lvl => { if (count >= lvl.count) currentRank = lvl; });

        html += `
            <div class="col-6 mb-3">
                <div class="glass-card p-3 text-center h-100 animate__animated animate__fadeIn">
                    <div style="font-size:2.5rem; margin-bottom:10px;">${currentRank.icon}</div>
                    <div class="fw-bold small mb-1">${category.title}</div>
                    <div class="badge bg-primary rounded-pill mb-2">${currentRank.rank}</div>
                    <div class="progress" style="height:6px; border-radius:3px;">
                        <div class="progress-bar" style="width:${Math.min(100, (count / category.levels[category.levels.length-1].count) * 100)}%"></div>
                    </div>
                    <div class="text-muted mt-1" style="font-size:0.65rem;">สะสม ${count} / ${category.levels[category.levels.length-1].count}</div>
                </div>
            </div>`;
    }
    list.innerHTML = html;
}
