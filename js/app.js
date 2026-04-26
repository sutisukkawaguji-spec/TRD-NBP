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

// 🌟 Helper: ฟอร์แมตตัวเลขคะแนน (เช่น 1000 -> 1k)
const formatCompactNumber = (val) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M 🔥';
    if (val >= 10000) return (val / 1000).toFixed(0) + 'k ⭐';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
    return val || 0;
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

    await new Promise(r => setTimeout(r, 300));

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

// =====================================================
// 🌤️ ระบบแจ้งเตือนสภาพอากาศ (Weather Alert)
// =====================================================
async function checkAndShowWeatherAlert(force = false) {
    if (!currentUser || !currentUser.userId) return;
    
    // 🌍 ถ้ากดเอง (Force) ให้เคลียร์ค่า Loading/Wait ก่อนเพื่อให้เด้งทันที
    if (force) Swal.fire({ title: 'กำลังดึงข้อมูลอากาศ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const storageKey = 'weather_last_alert';
    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    // 🔔 แจ้งเตือนแค่ "วันละครั้ง" เพื่อไม่ให้รบกวนผู้ใช้งาน (ยกเว้นกดปุ่มเอง)
    if (!force && localStorage.getItem(storageKey) === today) {
        console.log("🌤️ Weather alert already shown today.");
        return;
    }

    try {
        const url = `${GAS_URL}?action=get_weather&t=${Date.now()}`;
        const res = await fetch(url);
        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("🌤️ Weather API returned invalid JSON:", text.substring(0, 150));
            return;
        }

        if (data.status === 'success') {
            const { temp, description, city, icon } = data;
            const wind = data.wind_speed || 0;
            const pm25 = data.pm25;

            // 1. เตรียมข้อแนะนำเรื่องฝุ่น (Dust Advice) ตามระดับ
            let dustAdvise = '';
            if (pm25 !== null && pm25 !== undefined) {
                if (pm25 <= 25) {
                    dustAdvise = '<br>🍀 สำหรับสภาพฝุ่นวันนี้ อากาศสะอาดมากค่ะ ไม่พบฝุ่นละอองที่เป็นอันตราย สามารถทำกิจกรรมกลางแจ้งได้อย่างสบายใจเลยนะคะ';
                } else if (pm25 <= 37.5) {
                    dustAdvise = '<br>🟡 สำหรับสภาพฝุ่นวันนี้ เริ่มมีฝุ่นละอองเล็กน้อยค่ะ หากท่านใดแพ้ง่าย แนะนำให้เริ่มสวมหน้ากากอนามัยเวลาออกนอกอาคารเพื่อความปลอดภัยนะคะ';
                } else if (pm25 <= 75) {
                    dustAdvise = '<br>🟠 สำหรับสภาพฝุ่นวันนี้ ค่อนข้างสูงและเริ่มมีผลต่อสุขภาพค่ะ ขอแนะนำให้ทุกท่าน<b>สวมหน้ากากอนามัยทุกครั้ง</b>ที่ต้องปฏิบัติงานนอกอาคารนะคะ';
                } else {
                    dustAdvise = '<br>🔴 <b>แจ้งเตือน: ค่าฝุ่นวันนี้อยู่ในระดับอันตรายค่ะ</b> ขอความร่วมมือทุกท่านสวมหน้ากาก N95 ตลอดเวลาที่อยู่นอกอาคาร และเลี่ยงกิจกรรมกลางแจ้งหากไม่จำเป็นนะคะ';
                }
            }

            // 2. เตรียม PM2.5 Badge (ส่วนแสดงผลภาพ)
            let pm25Html = '';
            if (pm25 !== null && pm25 !== undefined) {
                let pm25Label, pm25Color, pm25Emoji;
                if (pm25 <= 25) { pm25Label = 'ดี'; pm25Color = '#00b894'; pm25Emoji = '🟢'; }
                else if (pm25 <= 37.5) { pm25Label = 'ปานกลาง'; pm25Color = '#fdcb6e'; pm25Emoji = '🟡'; }
                else if (pm25 <= 75) { pm25Label = 'เริ่มมีผลต่อสุขภาพ'; pm25Color = '#e67e22'; pm25Emoji = '🟠'; }
                else { pm25Label = 'อันตราย'; pm25Color = '#e74c3c'; pm25Emoji = '🔴'; }

                const pm25Display = pm25 < 1 ? '< 1' : pm25.toFixed(1);
                pm25Html = `
                    <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(0,0,0,0.05);
                                border-radius:20px; padding:4px 12px; margin-top:6px; font-size:0.8rem;">
                        <span>${pm25Emoji}</span>
                        <span>PM2.5: <b style="color:${pm25Color};">${pm25Display} μg/m³</b></span>
                        <span style="color:${pm25Color}; font-weight:600;">(${pm25Label})</span>
                    </div>`;
            }

            // 3. ประกอบข้อความตามสภาพอากาศ (Weather Logic)
            let title, message, confirmText, badgeColor;
            const isRainy = /ฝน|rain|storm|thunderstorm|drizzle/i.test(description);

            if (temp >= 38) {
                title = '🚨 อากาศร้อนจัดมากวันนี้ค่ะ!';
                badgeColor = '#e74c3c';
                message = `ขณะนี้ที่ <b>${city}</b> อุณหภูมิสูงถึง <b style="color:#e74c3c; font-size:1.2rem;">${temp.toFixed(1)}°C</b> ลมพัด <b>${wind} กม./ชม.</b> ค่ะ<br><br>
                    🌡️ <b>แนวทางกิจกรรม:</b> แนะนำให้จัดกิจกรรมในที่ร่มหรืออาคารที่มีอากาศถ่ายเทนะคะ เลี่ยงการออกแดดจัดเพื่อป้องกันโรคลมแดด และดื่มน้ำให้บ่อยขึ้นค่ะ
                    ${dustAdvise}<br><br>
                    <i>ด้วยความห่วงใยต่อสุขภาพของทุกท่านนะคะ 💕</i>`;
                confirmText = 'รับทราบค่ะ จะดูแลตัวเองนะคะ 🙏';
            } else if (temp >= 35) {
                title = '☀️ อากาศร้อนวันนี้ค่ะ';
                badgeColor = '#e67e22';
                message = `ขณะนี้ที่ <b>${city}</b> อุณหภูมิสูง <b style="color:#e67e22;">${temp.toFixed(1)}°C</b> ลมพัด <b>${wind} กม./ชม.</b> ค่ะ<br><br>
                    ☀️ <b>แนวทางกิจกรรม:</b> หากต้องมีกิจกรรมภาคสนาม แนะนำให้เร่งทำให้เสร็จก่อนเที่ยง หรือรอช่วงเย็นที่แดดร่มลมตกจะเหมาะกว่าค่ะ อย่าลืมพกน้ำดื่มติดตัวไว้ด้วยนะคะ
                    ${dustAdvise}<br><br>
                    <i>ด้วยความห่วงใยและหวังให้ทุกท่านแข็งแรงสดใสตลอดวันนะคะ 🌸</i>`;
                confirmText = 'รับทราบค่ะ ขอบคุณนะคะ 🙏';
            } else if (isRainy) {
                title = '🌧️ มีรายงานฝนตกในพื้นที่ค่ะ';
                badgeColor = '#0984e3';
                message = `ขณะนี้ที่ <b>${city}</b> สภาพอากาศ <b>${description}</b> ลมพัดแรง <b>${wind} กม./ชม.</b> ค่ะ<br><br>
                    ☔ <b>แนวทางกิจกรรม:</b> แนะนำให้ปรับย้ายกิจกรรมมาทำในอาคารทั้งหมดนะคะ และระวังถนนลื่นเป็นพิเศษหากต้องเดินทางปฏิบัติงานค่ะ
                    ${dustAdvise}<br><br>
                    <i>ด้วยความห่วงใยและขอให้ปฏิบัติหน้าที่อย่างปลอดภัยนะคะ ☔</i>`;
                confirmText = 'รับทราบค่ะ จะระวังเป็นพิเศษค่ะ 🌂';
            } else if (temp >= 25) {
                title = '🌤️ รายงานสภาพอากาศวันนี้ค่ะ';
                badgeColor = '#00b894';
                message = `ขณะนี้ที่ <b>${city}</b> อากาศ <b>${description}</b> อุณหภูมิ <b style="color:#00b894;">${temp.toFixed(1)}°C</b> ลมพัดสบาย <b>${wind} กม./ชม.</b> ค่ะ<br><br>
                    🌸 <b>แนวทางกิจกรรม:</b> อากาศเป็นใจแบบนี้ เหมาะมากสำหรับการลงพื้นที่ทำกิจกรรมกลุ่มหรือจิตอาสา จะช่วยให้ทุกท่านทำงานได้อย่างสดชื่นและมีพลังค่ะ
                    ${dustAdvise}<br><br>
                    <i>ขอให้เป็นวันที่ราบรื่นและมีความสุขกับการทำงานนะคะ 😊</i>`;
                confirmText = 'ขอบคุณค่ะ 😊';
            } else {
                title = '🌡️ สัมผัสอากาศเย็นเล็กน้อยค่ะ';
                badgeColor = '#74b9ff';
                message = `ขณะนี้ที่ <b>${city}</b> อุณหภูมิอยู่ที่ <b style="color:#74b9ff;">${temp.toFixed(1)}°C</b> ลมเย็นพัด <b>${wind} กม./ชม.</b> ค่ะ<br><br>
                    🧣 <b>แนวทางกิจกรรม:</b> แนะนำให้เน้นกิจกรรมที่ช่วยเคลื่อนไหวร่างกายเพื่อสร้างความอบอุ่น และสวมเสื้อผ้าให้อบอุ่นเพื่อป้องกันไข้หวัดนะคะ
                    ${dustAdvise}<br><br>
                    <i>ด้วยความห่วงใยและรักษาสุขภาพให้แข็งแรงเสมอนะคะ 💙</i>`;
                confirmText = 'รับทราบค่ะ ขอบคุณนะคะ 🙏';
            }

            // 4. แสดงผล Popup
            await new Promise(r => setTimeout(r, 2000));
            const sound = document.getElementById('notifSound');
            if (sound) { sound.currentTime = 0; sound.play().catch(() => {}); }

            await Swal.fire({
                html: _buildWeatherPopup({ title, badgeColor, city, icon, temp, wind, pm25, pm25Html, description, message }),
                confirmButtonText: confirmText,
                confirmButtonColor: badgeColor,
                width: '93%',
                background: 'var(--glass-bg)',
                backdrop: 'rgba(0,0,80,0.18)',
                showClass: { popup: 'animate__animated animate__fadeInDown' },
                hideClass: { popup: 'animate__animated animate__fadeOutUp' }
            });

            localStorage.setItem(storageKey, today);
        } else {
            console.warn("🌤️ Weather API error:", data.message);
        }
    } catch (e) {
        console.warn("🌤️ Weather alert system error:", e);
    }
}

// ─── Helper: สร้าง HTML ภายใน Popup ─────────────────────────────────────────
function _buildWeatherPopup({ title, badgeColor, city, icon, temp, wind, pm25, pm25Html, description, message }) {
    return `
        <div style="font-family:'Kanit',sans-serif; text-align:center;">
            <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:12px;">
                <div style="font-size:2.4rem; line-height:1;">👩‍💼</div>
                <div style="text-align:left;">
                    <div style="font-size:0.68rem; color:#aaa; font-weight:500; letter-spacing:0.5px;">รายงานสภาพอากาศ · ${city}</div>
                    <div style="font-size:1rem; font-weight:700; color:${badgeColor}; line-height:1.3;">${title}</div>
                </div>
            </div>
            <div style="background:rgba(0,0,0,0.04); border-left:4px solid ${badgeColor};
                        border-radius:0 12px 12px 0; padding:12px 14px; text-align:left; margin:8px 0;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <img src="https://openweathermap.org/img/wn/${icon}@2x.png"
                         style="width:52px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.15));">
                    <div>
                        <div style="font-size:0.78rem; color:#888;">🌬️ ลม ${wind} กม./ชม.</div>
                        ${pm25 !== null && pm25 !== undefined ? `<div style="font-size:0.78rem; color:#888;">😷 PM2.5: ${pm25} μg/m³</div>` : ''}
                        ${pm25Html ? pm25Html : ''}
                    </div>
                </div>
                <div style="font-size:0.88rem; line-height:1.75; color: var(--text-color, #333); margin-top:6px;">${message}</div>
            </div>
            <div style="font-size:0.65rem; color:#bbb; margin-top:8px;">📡 ข้อมูลจาก OpenWeatherMap · อัปเดตทุก 30 นาที</div>
        </div>`;
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
            postsMade: parseInt(u.totalCount || 0), taggedIn: parseInt(u.taggedIn || u.taggedCount || 0),
            witnessCount: parseInt(u.witnessCount || 0), topFriends: u.topFriends || [],
            firstActive: u.firstActive || null
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
    let singleRate = 0;
    if (globalFeedData?.length) {
        let teamPosts = globalFeedData.filter(p => {
            const tags = Array.isArray(p.taggedFriends) ? p.taggedFriends : String(p.taggedFriends || "").split(',');
            return tags.filter(id => String(id).trim().length > 0).length > 0;
        }).length;
        teamRate = (teamPosts / globalFeedData.length * 100).toFixed(0);
        singleRate = (100 - teamRate).toFixed(0);
    }
    document.getElementById('kpi-teamwork').innerText = teamRate + '%';
    if (document.getElementById('kpi-single')) {
        document.getElementById('kpi-single').innerText = singleRate + '%';
    }
    document.getElementById('kpi-issues').innerText = issueCount + ' คน';

    // 🤖 สร้างกล่องสรุปภาพรวมอัจฉริยะ
    const avgHappyNum = userWithData > 0 ? (totalHappy / userWithData).toFixed(1) : 0;
    const summaryBox = document.getElementById('execSummaryBox');
    const summaryText = document.getElementById('execSummaryText');
    if (summaryBox && summaryText) {
        summaryBox.style.display = 'block';
        summaryText.innerHTML = `📊 <b>สรุปภาพรวม:</b> ปัจจุบันองค์กรมีสมาชิก <b>${statsUsers.length}</b> คน ดัชนีความสุขเฉลี่ยอยู่ที่ <b>${avgHappyNum}</b> กิจกรรมส่วนใหญ่เป็นการทำ${teamRate >= 50 ? 'ร่วมกัน' : 'แบบเดี่ยว'} (<b>${teamRate >= 50 ? teamRate : singleRate}%</b>) โดยมีผู้ที่ต้องดูแลใกล้ชิด <b class="${issueCount > 0 ? 'text-danger' : 'text-success'}">${issueCount}</b> คน สำหรับดัชนี <b>HAPPY METER INDEX (HMI)</b> มีแนวโน้มสะท้อนถึงการมีส่วนร่วมที่สม่ำเสมอ`;
    }

    renderStaffTable(globalUserStatsMap);
}

function renderStaffTable(map) {
    const sList = document.getElementById('staffListArea');
    const gList = document.getElementById('guestListArea');
    const hList = document.getElementById('hofExecutiveListArea');
    const gSection = document.getElementById('guestSectionArea');
    const hSection = document.getElementById('hofExecutiveSection');
    if (!sList) return;
    sList.innerHTML = '';
    if (gList) gList.innerHTML = '';
    if (hList) hList.innerHTML = '';

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
        sList.innerHTML = `<div class="text-center py-5 text-muted"><i class="fas fa-user-friends fa-2x mb-3 d-block opacity-50"></i>ไม่พบรายชื่อบุคลากรปัจจุบันในระบบ</div>`;
    }

    // --- Render Executive Hall of Fame ---
    const hofExecutives = allUsers.filter(u => isAlumni(u.role) && ['Manager', 'Admin', 'Executive', 'หัวหน้า', 'ผู้บริหาร', 'ผอ.', 'คลังจังหวัด'].some(r => (u.role || '').toLowerCase().includes(r.toLowerCase())));
    if (hofExecutives.length > 0 && hSection) {
        hSection.style.display = 'block';
        hofExecutives.sort((a, b) => (b.score || 0) - (a.score || 0)).forEach(f => renderStaffRow(f, hList, true));
    } else if (hSection) {
        hSection.style.display = 'none';
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
                        <div class="fw-bold" style="font-size: 1.1rem; color:${isHOF ? '#f39c12' : (score < 5 ? '#e74c3c' : (score < 7 ? '#f39c12' : '#27ae60'))}">
                            ${formatCompactNumber(f.score)} / ${score > 0 ? score.toFixed(1) : '-'}
                        </div>
                        <small class="text-muted" style="font-size:0.65rem;">คะแนน / ความสุข</small>
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
            
            // 🌟 ตรวจสอบสิทธิเดิม ถ้าเป็นผู้บริหาร ให้พ่วงคำว่า "ผู้บริหาร" ไว้หน้าชื่อทำเนียบด้วย
            let finalLabel = selectedCategory;
            const originalRole = staffData ? (staffData.role || '').toLowerCase() : '';
            const execKeywords = ['manager', 'admin', 'executive', 'หัวหน้า', 'ผู้บริหาร', 'ผอ.', 'คลังจังหวัด'];
            if (execKeywords.some(k => originalRole.includes(k))) {
                finalLabel = 'ผู้บริหาร (' + selectedCategory + ')';
            }

            // 🌪️ Optimistic UI
            if (globalUserStatsMap[uid]) globalUserStatsMap[uid].role = finalLabel;
            if (allUsersMap[uid]) allUsersMap[uid].role = finalLabel;

            Swal.fire({
                title: 'กำลังส่งรายชื่อขึ้นทำเนียบ...',
                text: 'กรุณารอสักครู่ ระบบกำลังสื่อสารกับหลังบ้าน',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'promote_alumni', userId: uid, label: finalLabel, score: currentScore })
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
                        label: (ctx) => ` ${ctx.label}: ${ctx.raw} จุด`
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
    const indexValEl = document.getElementById('current-index-val');
    const indexChangeEl = document.getElementById('index-change-val');
    const indexBadgeEl = document.getElementById('index-status-badge');
    const indexDateEl = document.getElementById('index-date-range');

    let labels = [], dataPoints = [];
    let raw = chartData || [];

    // --- 📊 Update Index Summary (SET Style) ---
    if (raw.length > 0) {
        const currentVal = raw[raw.length - 1];
        const prevVal = raw.length > 1 ? raw[raw.length - 2] : 1000;
        const diff = (currentVal - prevVal).toFixed(2);
        const percent = ((diff / prevVal) * 100).toFixed(2);
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
    
    // Determine gradient color based on trend
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
                        callback: function(value) { return value.toLocaleString(); }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Kanit', size: 10 } }
                }
            }
        }
    });

    // Update scroll buttons visibility
    setTimeout(() => {
        if (typeof window.updateChartScrollButtons === 'function') {
            window.updateChartScrollButtons();
            const wrapper = document.getElementById('hmiScrollWrapper');
            if (wrapper && !wrapper.dataset.listener) {
                wrapper.addEventListener('scroll', window.updateChartScrollButtons);
                wrapper.dataset.listener = 'true';
            }
        }
    }, 200);
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
                    hasNewUpcoming = true;
                    if (pageId === 'badges' || pageId === 'manager') {
                        if (pageId === 'manager') {
                            // ผู้บริหาร: ดึงใหม่เสมอเพื่อให้ได้ claims ล่าสุด
                            if (window.fetchRewards) window.fetchRewards();
                        } else {
                            // badges: ใช้ cache ถ้ามีแล้ว ดึงใหม่ถ้ายังไม่มี
                            if (!window.globalRewardsData || window.globalRewardsData.length === 0) {
                                if (window.fetchRewards) window.fetchRewards();
                            } else {
                                if (window.renderUserRewards) window.renderUserRewards();
                            }
                        }
                    }
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

        // 🔥 Render เสมอเมื่อข้อมูลมาถึง เพื่อให้มั่นใจว่า UI อัปเดตล่าสุด
        renderNotifList();

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
        .then(data => {
            if (data && data.status === 'error') {
                console.warn('📢 Server returned error for announcements:', data.message);
                renderNotifList(); // Render empty/error state
                return;
            }
            processAnnounceData(data, silent === true);
        })
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
        if (item) {
            // มาร์คว่าอ่านแล้ว
            localStorage.setItem(`notif_read_${id}`, 'true');
            if (item.ts) {
                const parsed = new Date(String(item.ts).replace(/\(.*\)/, '').trim());
                if (!isNaN(parsed.getTime())) {
                    const current = parseInt(localStorage.getItem('notif_cleared_at') || '0');
                    if (parsed.getTime() > current) {
                        localStorage.setItem('notif_cleared_at', parsed.getTime().toString());
                    }
                }
            }
            
            renderNotifList();
            closeNotifPanel(); 

            // 🌟 แสดงรายละเอียดข่าวแบบเต็มหน้าจอ (SweetAlert)
            const color = (typeof CATEGORY_COLORS !== 'undefined') ? CATEGORY_COLORS[item.category] : '#6c5ce7';
            const icon = (typeof CATEGORY_ICONS !== 'undefined') ? CATEGORY_ICONS[item.category] : '📢';

            Swal.fire({
                title: `<div style="text-align:left; font-size:1.15rem; font-weight:700;">${item.title}</div>`,
                html: `
                    <div class="text-start" style="font-family: 'Kanit', sans-serif;">
                        <div class="mb-2">
                            <span class="badge" style="background:${color}20; color:${color}; border:1px solid ${color}40; font-size:0.7rem; padding:4px 10px;">
                                ${icon} ${item.category || 'ทั่วไป'}
                            </span>
                        </div>
                        <div class="text-muted small mb-3">
                            <i class="fas fa-calendar-alt me-1"></i> ${item.displayDate || item.date} ${item.time || ''}
                        </div>
                        <div style="font-size: 0.95rem; line-height: 1.7; color: var(--text-color); white-space: pre-wrap; max-height: 60vh; overflow-y: auto; padding-right: 5px;">
                            ${item.body || 'ไม่มีรายละเอียดเพิ่มเติม'}
                        </div>
                    </div>
                `,
                confirmButtonText: 'เข้าใจแล้ว',
                confirmButtonColor: color,
                width: '92%',
                maxWidth: '420px',
                customClass: {
                    container: 'swal-high-zindex',
                    popup: 'glass-card rounded-4'
                }
            });
        }
    } catch (e) {
        console.warn("readNotif data error:", e);
        closeNotifPanel();
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
    if (pageId === 'badges' || pageId === 'manager') {
        if (pageId === 'manager') {
            if (window.fetchRewards) window.fetchRewards();
        } else if (!window.globalRewardsData || window.globalRewardsData.length === 0) {
            if (window.fetchRewards) window.fetchRewards();
        } else {
            if (window.renderUserRewards) window.renderUserRewards();
        }
    }
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

    // 👨‍💼 กรองผู้บริหารในทำเนียบ (เช็คทั้ง Role เดิม และ Label ที่เราพ่วงคำว่าผู้บริหารเข้าไป)
    const execKeywords = ['manager', 'admin', 'executive', 'หัวหน้า', 'ผู้บริหาร', 'ผอ.', 'คลังจังหวัด', 'director', 'ceo'];
    const execAlumni = allAlumni.filter(u => {
        const r = (u.role || '').toLowerCase();
        return execKeywords.some(k => r.includes(k.toLowerCase()));
    });
    const staffAlumni = allAlumni.filter(u => !execAlumni.some(ex => ex.id === u.id));

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
            let roleDisplay = u.role; 
            
            if (u.role.includes('ผู้บริหาร (')) {
                const parts = u.role.match(/ผู้บริหาร\s*\((.*?)\)\s*(ปี\s*\d{1,4})?/);
                if (parts) {
                    roleDisplay = parts[1] + (parts[2] ? ' ' + parts[2] : '');
                }
            } else if (isAlumni(u.role) && !yearMatch) {
                roleDisplay = 'ผู้ร่วมผูกพันสายใยความสุข';
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
                    <div class="score-value" style="font-size: 0.95rem;">${formatCompactNumber(u.score)} / ${u.avgHappy > 0 ? u.avgHappy.toFixed(1) : '-'}</div>
                    <div class="score-label">คะแนน / ความสุข</div>
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
    const userStat = globalUserStatsMap[uid] || allUsersMap[uid];
    let firstDate = null;

    // 🌟 1. ลองใช้ข้อมูลที่ Backend ส่งมาให้ (แม่นยำที่สุด เพราะดูจากประวัติทั้งหมดในชีต)
    if (userStat && userStat.firstActive) {
        firstDate = new Date(userStat.firstActive);
    } 
    // 🌟 2. Fallback: ถ้าไม่มีข้อมูลจาก Backend ให้ลองหาจาก globalFeedData (ที่มีอยู่ใน Cache)
    else if (globalFeedData && globalFeedData.length > 0) {
        const userPosts = globalFeedData.filter(p => String(p.user_line_id) === String(uid));
        if (userPosts.length > 0) {
            const sorted = userPosts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            firstDate = new Date(sorted[0].timestamp);
        }
    }

    if (!firstDate || isNaN(firstDate.getTime())) {
        return (userStat && userStat.postsMade > 0) ? 'มีประวัติกิจกรรมแล้ว' : 'ยังไม่ได้บันทึกกิจกรรม';
    }

    const fmt = (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
    return `ประวัติกิจกรรม: ${fmt(firstDate)} ถึงปัจจุบัน`;
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

    // ✅ ดักจับไม่ให้เกิน 20 รูป
    if (currentImageFiles.length + files.length > 20) {
        Swal.fire('แจ้งเตือน', 'อัปโหลดภาพได้สูงสุด 20 ภาพต่อโพสต์ครับ', 'warning');
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

// ==========================================
// 📈 ระบบควบคุมกราฟ HMI (Momentum Index)
// ==========================================
window.updateChartScrollButtons = function() {
    const wrapper = document.getElementById('hmiScrollWrapper');
    const leftBtn = document.getElementById('hmiScrollBtnLeft');
    const rightBtn = document.getElementById('hmiScrollBtnRight');
    if (!wrapper || !leftBtn || !rightBtn) return;

    const scrollLeft = wrapper.scrollLeft;
    const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;

    leftBtn.style.display = scrollLeft > 5 ? 'flex' : 'none';
    rightBtn.style.display = scrollLeft < maxScroll - 5 ? 'flex' : 'none';
};

window.scrollHMI = function(direction) {
    const wrapper = document.getElementById('hmiScrollWrapper');
    if (!wrapper) return;
    
    // Use responsive scroll amount (70% of view width) or fixed 300px if very wide
    const scrollAmount = Math.min(300, wrapper.clientWidth * 0.8);
    
    if (direction === 'left') {
        wrapper.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
        wrapper.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
};

// ==========================================
// 🏃 ระบบติดตามการเข้าใช้งาน (App Entry)
// ==========================================
async function trackAppVisit() {
    if (!currentUser || !currentUser.userId) return;
    
    // ป้องกันการบันทึกซ้ำในเซสชันสั้นๆ (Throttle)
    const lastVisit = sessionStorage.getItem('last_visit_tracked');
    const now = Date.now();
    if (lastVisit && (now - parseInt(lastVisit)) < 600000) return; // 10 นาที

    try {
        await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'track_visit',
                userId: currentUser.userId,
                userName: currentUser.name || ''
            })
        });
        sessionStorage.setItem('last_visit_tracked', now.toString());
        console.log("✅ บันทึกการเข้าใช้งานแล้ว");
    } catch (e) { console.warn("Visit tracking failed", e); }
}

// ==========================================
// 📄 ระบบสร้างรายงาน PDF (Monthly & Individual)
// ==========================================

async function openReportModal() {
    document.getElementById('reportModalBackdrop').style.display = 'block';
    document.getElementById('reportModal').style.display = 'block';
    
    const select = document.getElementById('reportMonthSelect');
    if (select) select.innerHTML = '<option value="">กำลังโหลดข้อมูลประวัติ...</option>';
    
    try {
        // ดึงข้อมูล Feed ย้อนหลังมากขึ้น (2000 รายการ) เพื่อให้มีข้อมูลย้อนหลัง 12 เดือน
        const res = await fetch(`${GAS_URL}?action=get_feed&limit=2000&t=${Date.now()}`);
        const data = await res.json();
        const feed = data.feed || [];
        
        // อัปเดต Cache กลางเพื่อให้หน้าจออื่นๆ ได้ใช้ข้อมูลที่ดึงมาใหม่ด้วย
        if (feed.length > (window.globalFeedData || []).length) {
            window.globalFeedData = feed;
        }

        if (select) {
            select.innerHTML = '<option value="all">ข้อมูลทั้งหมด (All Time)</option>';
            
            if (feed.length > 0) {
                const months = new Set();
                feed.forEach(p => {
                    if (p.timestamp) {
                        const d = new Date(p.timestamp);
                        if (!isNaN(d.getTime())) {
                            const monthStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                            months.add(monthStr);
                        }
                    }
                });
                
                const sortedMonths = Array.from(months).sort().reverse(); // ใหม่ไปเก่า
                // กรองเอาเฉพาะ 12 เดือนล่าสุดที่มีข้อมูล
                const displayMonths = sortedMonths.slice(0, 12);
                
                displayMonths.forEach(m => {
                    const [y, mm] = m.split('-');
                    const thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
                    const label = thaiMonths[parseInt(mm)-1] + ' ' + (parseInt(y)+543);
                    select.innerHTML += `<option value="${m}">${label}</option>`;
                });
            }
        }
    } catch (e) {
        console.error("Report Deep Fetch failed", e);
        if (select) select.innerHTML = '<option value="all">ข้อมูลทั้งหมด (All Time)</option>';
    }
    
    if (typeof generateMonthlyReport === 'function') generateMonthlyReport();
}

function closeReportModal() {
    document.getElementById('reportModalBackdrop').style.display = 'none';
    document.getElementById('reportModal').style.display = 'none';
}

window.generateMonthlyReport = function() {
    const month = document.getElementById('reportMonthSelect').value;
    const content = document.getElementById('reportContentArea');
    content.innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin me-2"></i>กำลังวิเคราะห์ข้อมูลเชิงลึก...</div>';
    
    setTimeout(() => {
        let filteredFeed = window.globalFeedData || [];
        let previousFeed = window.globalFeedData || [];
        let monthLabel = 'ข้อมูลทั้งหมดจนถึงปัจจุบัน';
        let hasPrevious = false;
        
        if (month !== 'all') {
            const [y, m] = month.split('-');
            filteredFeed = filteredFeed.filter(p => {
                if (!p.timestamp) return false;
                const d = new Date(p.timestamp);
                return d.getFullYear() == y && (d.getMonth() + 1) == m;
            });
            
            // หาข้อมูลเดือนก่อนหน้าเพื่อเปรียบเทียบ
            let prevM = parseInt(m) - 1;
            let prevY = parseInt(y);
            if (prevM === 0) { prevM = 12; prevY -= 1; }
            previousFeed = (window.globalFeedData || []).filter(p => {
                if (!p.timestamp) return false;
                const d = new Date(p.timestamp);
                return d.getFullYear() == prevY && (d.getMonth() + 1) == prevM;
            });
            hasPrevious = true;
            
            const thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
            monthLabel = `ประจำเดือน ${thaiMonths[parseInt(m)-1]} ${parseInt(y)+543}`;
        } else {
            hasPrevious = false;
        }
        
        // --- คำนวณเดือนนี้ ---
        const totalPosts = filteredFeed.length;
        let teamwork = 0;
        let virtueCounts = { volunteer: 0, sufficiency: 0, discipline: 0, integrity: 0, gratitude: 0 };
        filteredFeed.forEach(p => {
            const tags = Array.isArray(p.taggedFriends) ? p.taggedFriends : String(p.taggedFriends || "").split(',');
            if (tags.filter(id => String(id).trim().length > 0).length > 0) teamwork++;
            if (p.virtue && virtueCounts[p.virtue] !== undefined) virtueCounts[p.virtue]++;
        });
        const teamworkRate = totalPosts > 0 ? ((teamwork / totalPosts) * 100).toFixed(0) : 0;
        
        // --- คำนวณเดือนก่อนหน้า ---
        const prevTotal = previousFeed.length;
        let prevTeamwork = 0;
        previousFeed.forEach(p => {
            const tags = Array.isArray(p.taggedFriends) ? p.taggedFriends : String(p.taggedFriends || "").split(',');
            if (tags.filter(id => String(id).trim().length > 0).length > 0) prevTeamwork++;
        });
        const prevTeamRate = prevTotal > 0 ? ((prevTeamwork / prevTotal) * 100).toFixed(0) : 0;
        
        const virtueNameMap = { volunteer:'จิตอาสา (D)', sufficiency:'พอเพียง (R)', discipline:'วินัย (R)', integrity:'สุจริต (T)', gratitude:'กตัญญู (D)' };
        let sortedVirtues = Object.entries(virtueCounts).sort((a,b) => b[1]-a[1]);
        const topVirtue = sortedVirtues[0];
        const lowestVirtue = sortedVirtues[sortedVirtues.length - 1];
        
        let insightText = '';
        if (totalPosts === 0) {
            insightText = 'ไม่มีข้อมูลกิจกรรมในระบบสำหรับช่วงเวลานี้';
        } else {
            let trendVolText = '';
            let trendTeamText = '';
            
            if (hasPrevious) {
                const diffVol = totalPosts - prevTotal;
                if (diffVol > 0) trendVolText = `<b>เพิ่มขึ้น ${diffVol} รายการ</b> จากเดือนที่แล้ว สะท้อนถึงโมเมนตัมระดับองค์กรเชิงบวก`;
                else if (diffVol < 0) trendVolText = `<b>ลดลง ${Math.abs(diffVol)} รายการ</b> จากเดือนที่แล้ว ควรมีการกระตุ้นกิจกรรมเพิ่มเติม`;
                else trendVolText = `มีจำนวนทรงตัวเท่ากับเดือนที่แล้ว`;
                
                const diffTeam = teamworkRate - prevTeamRate;
                if (diffTeam > 0) trendTeamText = `และมีสัดส่วนการทำกิจกรรมร่วมกันสูงขึ้น <b>+${diffTeam}%</b> บ่งชี้ว่าบุคลากรมีการบูรณาการข้ามสายงานที่ดีขึ้น`;
                else if (diffTeam < 0) trendTeamText = `แต่สัดส่วนการทำกิจกรรมร่วมกันลดลง <b>${diffTeam}%</b> ซึ่งอาจบ่งบอกถึงความรู้สึกโดดเดี่ยวในการทำงาน (Silo Effect)`;
                else trendTeamText = `สัดส่วนการทำงานร่วมกันมีความคงที่`;
            } else {
                trendVolText = `มีการกระจายตัวอยู่ในหลายหมวดหมู่`;
                trendTeamText = `โดยเน้นไปที่${teamworkRate > 50 ? 'การทำกิจกรรมร่วมกับผู้อื่น' : 'การทำกิจกรรมส่วนบุคคล'}เป็นหลัก`;
            }
            
            insightText = `
                <p>ใน ${monthLabel} องค์กรมีการขับเคลื่อนกิจกรรมความดีรวมทั้งสิ้น <b>${totalPosts} รายการ</b> 
                โดย ${trendVolText} ${trendTeamText}</p>
                
                <p class="mt-2 mb-1 fw-bold text-dark"><i class="fas fa-balance-scale text-primary me-1"></i> มิติความสมดุล (TRD Core Values)</p>
                <p>หมวดหมู่ที่มีการปฏิบัติมากที่สุดคือ <b>${virtueNameMap[topVirtue[0]]}</b> (${topVirtue[1]} รายการ) แสดงให้เห็นถึงค่านิยมหลักที่แข็งแกร่งในด้านนี้ 
                ในขณะที่ <b>${virtueNameMap[lowestVirtue[0]]}</b> เป็นด้านที่มีการปฏิบัติน้อยที่สุด (${lowestVirtue[1]} รายการ) 
                <span class="text-danger">ฝ่ายบริหารควรพิจารณาจัดกิจกรรมหรือให้รางวัลจูงใจ (Incentives) ในด้าน ${virtueNameMap[lowestVirtue[0]]} เพื่อสร้างสมดุลให้กับวัฒนธรรมองค์กร</span></p>
                
                <p class="mt-2 mb-1 fw-bold text-dark"><i class="fas fa-project-diagram text-primary me-1"></i> มิติความผูกพันและเครือข่าย</p>
                <p>จากกิจกรรมทั้งหมด มีถึง <b>${teamworkRate}%</b> ที่เกิดการ Tag เพื่อนร่วมงาน ถือเป็นสัญญาณของจิตวิญญาณแห่งการทำงานเป็นทีม (Team Spirit) การมีส่วนร่วมระดับนี้จะช่วยลดปัญหาความขัดแย้งและเพิ่มบรรยากาศที่น่าทำงาน (Happy Workplace)</p>
            `;
        }
        
        const html = `
            <div class="p-1" style="color:#333; font-family:'Kanit',sans-serif; text-align:left;">
                <p class="text-center text-muted small border-bottom pb-2 mb-3">${monthLabel}</p>
                
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <div class="bg-light p-2 rounded text-center" style="border:1px solid #e0e0e0;">
                            <div class="small text-muted">กิจกรรมความดี</div>
                            <h4 class="mb-0 text-primary fw-bold">${totalPosts}</h4>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="bg-light p-2 rounded text-center" style="border:1px solid #e0e0e0;">
                            <div class="small text-muted">กิจกรรมร่วม</div>
                            <h4 class="mb-0 text-info fw-bold">${teamworkRate}%</h4>
                        </div>
                    </div>
                </div>
                
                <div class="rounded-3 p-3 shadow-sm bg-white" style="border-left:4px solid #6c5ce7; font-size: 0.85rem; line-height: 1.6;">
                    ${insightText}
                </div>
            </div>
        `;
        content.innerHTML = html;
    }, 500);
};

window.addEventListener('resize', setViewportHeight);
setViewportHeight();

// ==========================================
// 🎁 ระบบจัดการและแสดงของรางวัล (Reward System)
// ==========================================

window.globalRewardsData = [];
window.globalClaimsData = [];
window.currentRewardFile = null; // เก็บไฟล์ไว้ชั่วคราวก่อนกดบันทึก

window.fetchRewards = async function() {
    try {
        const res = await fetch(GAS_URL + '?action=get_rewards');
        const data = await res.json();
        if (data.rewards) {
            window.globalRewardsData = data.rewards;
            window.globalClaimsData = data.claims || [];
            if (typeof renderExecutiveRewards === 'function') renderExecutiveRewards();
            if (typeof renderUserRewards === 'function') renderUserRewards();
        }
    } catch (e) {
        console.error("Failed to fetch rewards", e);
    }
};

window.renderExecutiveRewards = function() {
    const list = document.getElementById('executiveRewardList');
    if (!list) return;
    
    if (!window.globalRewardsData || window.globalRewardsData.length === 0) {
        list.innerHTML = '<div class="text-center text-muted small py-3">ยังไม่ได้ตั้งของรางวัล</div>';
        return;
    }
    
    let html = '';
    window.globalRewardsData.forEach(r => {
        let claimants = [];
        let eligible = [];
        
        (window.globalClaimsData || []).forEach(cl => {
            if (cl.rewardId === r.id) {
                const statsMap = window.globalUserStatsMap || {};
                let u = statsMap[cl.userId];
                if (!u) { const found = Object.values(statsMap).find(x => String(x.id) === String(cl.userId)); if (found) u = found; }
                if (!u) { const fu = (window.allUsersMap||{})[cl.userId]; u = fu ? {name:fu.name,userId:cl.userId,img:fu.img} : {name:cl.userName,userId:cl.userId,img:null}; }
                claimants.push(u);
            }
        });

        if (window.globalUserStatsMap && window.globalFeedData) {
            Object.keys(window.globalUserStatsMap).forEach(uid => {
                const u = window.globalUserStatsMap[uid];
                if (!u || !u.name) return;
                if (claimants.find(c => String(c.userId || c.id) === String(uid))) return;

                let isEligible = false;
                if (r.mode == 1) {
                    if ((u.score || 0) >= r.targetVal) isEligible = true;
                } else if (r.mode == 2) {
                    let gainedXP = 0;
                    window.globalFeedData.forEach(p => {
                        if (p.timestamp && (new Date(p.timestamp).getTime() > r.createdTs)) {
                            if (String(p.user_line_id).trim() === String(uid).trim()) gainedXP += Number(p.score) || 0;
                            if (p.verifies && Array.isArray(p.verifies)) {
                                p.verifies.forEach(v => {
                                    const vid = (typeof v === 'object') ? (v.userId || v.lineId) : v;
                                    if (String(vid).trim() === String(uid).trim()) gainedXP += 3;
                                });
                            }
                        }
                    });
                    if (gainedXP >= r.targetVal) isEligible = true;
                }
                if (isEligible) eligible.push(u);
            });
        }
        
        let achieversHtml = '';
        if (claimants.length > 0 || eligible.length > 0) {
            const combined = [...claimants, ...eligible];
            const faceHtml = combined.slice(0, 5).map(a => `<img src="${a.img || 'https://dummyimage.com/30x30/ccc/fff'}" class="rounded-circle border" style="width:24px; height:24px; margin-right:-8px;" title="${a.name}">`).join('');
            const moreCount = combined.length > 5 ? `<span class="badge bg-secondary ms-2" style="font-size:0.6rem;">+${combined.length - 5}</span>` : '';
            
            achieversHtml = `
            <div class="mt-2 pt-2 border-top">
                <button class="btn btn-sm btn-light w-100 text-start d-flex justify-content-between align-items-center rounded-3" onclick="document.getElementById('achievers_${r.id}').classList.toggle('d-none')">
                    <span class="small fw-bold text-success"><i class="fas fa-users me-1"></i> ผู้ได้รับ/มีสิทธิ์ (${combined.length})</span>
                    <div class="d-flex align-items-center">${faceHtml}${moreCount}</div>
                </button>
                <div id="achievers_${r.id}" class="d-none mt-2 p-2 bg-light rounded-3 small border" style="max-height: 180px; overflow-y: auto;">
                    ${claimants.length > 0 ? `<div class="fw-bold mb-1 text-primary"><i class="fas fa-check-circle"></i> แจ้งรับรางวัลแล้ว:</div>` : ''}
                    ${claimants.map(a => {
                        const cl = window.globalClaimsData.find(c => c.rewardId === r.id && String(c.userId) === String(a.userId || a.id));
                        const dateStr = cl && cl.timestamp ? new Date(cl.timestamp).toLocaleString('th-TH', { hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' }) : '';
                        return `<div class="d-flex align-items-center mb-1 ms-2 justify-content-between">
                            <div class="d-flex align-items-center">
                                <img src="${a.img || 'https://dummyimage.com/30x30/ccc/fff'}" class="rounded-circle me-2" style="width:20px; height:20px;"> 
                                <span>${a.name}</span>
                            </div>
                            <span class="text-muted" style="font-size:0.65rem;">${dateStr}</span>
                        </div>`;
                    }).join('')}
                    
                    ${eligible.length > 0 ? `<div class="fw-bold mt-2 mb-1 text-muted"><i class="fas fa-clock"></i> ยังไม่ได้กดแจ้งรับ:</div>` : ''}
                    ${eligible.map(a => `<div class="d-flex align-items-center mb-1 ms-2 opacity-75"><img src="${a.img || 'https://dummyimage.com/30x30/ccc/fff'}" class="rounded-circle me-2" style="width:20px; height:20px;"> <span>${a.name}</span></div>`).join('')}
                </div>
            </div>`;
        } else {
            achieversHtml = `<div class="mt-2 pt-2 border-top text-center small text-muted">ยังไม่มีผู้ได้รับรางวัล</div>`;
        }

        const modeBadge = r.mode == 1 ? '<span class="badge bg-success ms-1" style="font-size:0.6rem;">เป้าหมายรวม</span>' : '<span class="badge" style="background:#ff9f43; font-size:0.6rem; margin-left:4px;">ภารกิจพิเศษ</span>';
        const imgStr = r.image ? `<img src="${r.image}" style="width:50px; height:50px; object-fit:cover; border-radius:10px;">` : `<div class="bg-light rounded d-flex align-items-center justify-content-center" style="width:50px; height:50px;"><i class="fas fa-gift text-muted"></i></div>`;
        
        html += `
        <div class="d-flex flex-column p-2 rounded-3 shadow-sm bg-white border mb-2">
            <div class="d-flex align-items-center" style="gap: 12px;">
                ${imgStr}
                <div class="flex-grow-1 min-w-0">
                    <div class="fw-bold text-truncate" style="font-size: 0.9rem;">${r.name} ${modeBadge}</div>
                    <div class="small text-muted">เป้าหมาย: <span class="text-primary fw-bold">${r.mode == 2 ? '+' : ''}${r.targetVal} XP</span></div>
                </div>
                <div class="d-flex flex-column gap-1">
                    <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="editReward('${r.id}')" style="width: 28px; height: 28px; padding: 0;" title="แก้ไข">
                        <i class="fas fa-pen" style="font-size:0.7rem;"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="deleteReward('${r.id}')" style="width: 28px; height: 28px; padding: 0;" title="ลบ">
                        <i class="fas fa-trash-alt" style="font-size:0.7rem;"></i>
                    </button>
                </div>
            </div>
            ${achieversHtml}
        </div>`;
    });
    list.innerHTML = html;
};

window.renderUserRewards = function() {
    const challengeList = document.getElementById('challengeRewardList');
    const milestoneList = document.getElementById('milestoneRewardList');
    const challengeZone = document.getElementById('rewardChallengeZone');
    const milestoneZone = document.getElementById('rewardMilestoneZone');
    const noRewardsMsg  = document.getElementById('noRewardsMessage');
    if (!challengeList || !milestoneList) return;
    const rewards = window.globalRewardsData || [];
    if (rewards.length === 0) {
        if (challengeZone) challengeZone.style.display = 'none';
        if (milestoneZone) milestoneZone.style.display = 'none';
        if (noRewardsMsg) noRewardsMsg.style.display = 'block';
        return;
    }
    if (noRewardsMsg) noRewardsMsg.style.display = 'none';
    const challenges = rewards.filter(r => r.mode == 2);
    const milestones  = rewards.filter(r => r.mode == 1);
    let lifetimeXP = 0;
    if (window.currentUser) {
        if (window.globalUserStatsMap && window.globalUserStatsMap[window.currentUser.userId]) {
            lifetimeXP = window.globalUserStatsMap[window.currentUser.userId].score || 0;
        } else {
            lifetimeXP = window.currentUser.score || 0;
        }
    }
    if (!document.getElementById('rewardCardStyles')) {
        const st = document.createElement('style');
        st.id = 'rewardCardStyles';
        st.textContent = [
            '@keyframes rwGlow{from{box-shadow:0 0 15px rgba(255,159,67,.4),0 0 30px rgba(255,159,67,.2)}to{box-shadow:0 0 35px rgba(255,159,67,.9),0 0 70px rgba(255,159,67,.4)}}',
            '@keyframes rwGlowGreen{from{box-shadow:0 0 15px rgba(40,167,69,.4)}to{box-shadow:0 0 35px rgba(40,167,69,.9),0 0 70px rgba(40,167,69,.4)}}',
            '@keyframes rwBounce{from{transform:translateY(0)scale(1)}to{transform:translateY(-10px)scale(1.1)}}',
            '@keyframes rwPulse{0%,100%{opacity:1}50%{opacity:.35}}',
            '@keyframes rwShine{0%,100%{filter:brightness(1)}50%{filter:brightness(1.45)}}',
            '.reward-gift-card { background: var(--glass-bg) !important; border: 1.5px solid var(--border-color) !important; color: var(--text-color) !important; }',
            '.reward-inner-box { background: #fff; } [data-theme="dark"] .reward-inner-box { background: #2a2a40; }',
            '.reward-overlay-card { background: #fff; color: #444; } [data-theme="dark"] .reward-overlay-card { background: #252538; color: #f0f0f0; }',
            '.reward-progress-bg { background: #f4f4f4; } [data-theme="dark"] .reward-progress-bg { background: #1a1a2e; }'
        ].join('');
        document.head.appendChild(st);
    }
    function buildCard(r, xp, color, isChallenge) {
        const target   = r.targetVal;
        const pct      = Math.min(100, Math.round((xp / target) * 100));
        const unlocked = xp >= target;
        const claimed  = (window.globalClaimsData || []).some(
            c => c.rewardId === r.id && String(c.userId) === String((window.currentUser||{}).userId));
        const glow = color === '#28a745' ? 'rwGlowGreen' : 'rwGlow';
        let box;
        if (claimed) {
            const inner = r.image ? `<img src="${r.image}" style="width:100%;height:100%;object-fit:cover;">` : `<i class="fas fa-gift fa-4x" style="color:${color};"></i>`;
            box = `<div style="text-align:center;"><div class="reward-inner-box" style="width:150px;height:150px;border-radius:24px;overflow:hidden;margin:0 auto;border:3px solid ${color};box-shadow:0 0 20px ${color}60;display:flex;align-items:center;justify-content:center;">${inner}</div><div class="mt-2 badge text-white fw-bold px-3 py-2 rounded-pill" style="background:${color};font-size:.75rem;"><i class="fas fa-check me-1"></i> แจ้งรับแล้ว</div></div>`;
        } else if (unlocked) {
            box = `<div onclick="openRewardBox('${r.id}')" style="text-align:center;cursor:pointer;"><div class="reward-inner-box" style="width:150px;height:150px;border-radius:24px;margin:0 auto;border:3px solid ${color};display:flex;align-items:center;justify-content:center;animation:${glow} 1.4s ease-in-out infinite alternate;"><i class="fas fa-gift" style="font-size:4rem;color:${color};animation:rwBounce .9s ease-in-out infinite alternate;"></i></div><div class="mt-2 fw-bold" style="font-size:.82rem;color:${color};animation:rwPulse 1.4s ease-in-out infinite;"><i class="fas fa-hand-point-up me-1"></i> แตะเพื่อเปิดกล่อง!</div></div>`;
        } else {
            box = `<div style="text-align:center;cursor:not-allowed;"><div class="reward-inner-box" style="width:150px;height:150px;border-radius:24px;margin:0 auto;border:2px dashed #d0d0d0;display:flex;align-items:center;justify-content:center;position:relative;"><i class="fas fa-gift" style="font-size:4rem;color:#c0c0c0;"></i><div class="reward-inner-box" style="position:absolute;top:-14px;right:-14px;width:32px;height:32px;border-radius:50%;border:2px solid #ccc;display:flex;align-items:center;justify-content:center;"><i class="fas fa-lock" style="font-size:.75rem;color:#aaa;"></i></div></div><div class="mt-2 small text-muted" style="font-size:.72rem;">ต้องการอีก ${Math.max(0, target - xp)} XP</div></div>`;
        }
        const dateStr = r.endDate ? `<div class="small text-danger text-center mt-1" style="font-size:.68rem;"><i class="far fa-clock"></i> ${new Date(r.endDate).toLocaleDateString('th-TH')}</div>` : '';
        const displayName = claimed ? r.name : '🎁 รางวัลปริศนา';
        return `<div class="reward-gift-card" style="border-radius:20px;padding:20px 10px 14px;text-align:center;transition:transform .2s;${unlocked && !claimed ? 'border:2px solid '+color+'!important;box-shadow:0 6px 24px '+color+'30!important;' : ''}">${box}<div class="fw-bold mt-3 mb-1 px-1" style="font-size:.85rem;color:${unlocked ? color : '#666'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${displayName}</div><div class="d-flex justify-content-between" style="color:#aaa;font-size:.65rem;margin-bottom:4px;"><span>${isChallenge ? 'ใหม่: ' : 'รวม: '}${xp} XP</span><span>${target} XP</span></div><div style="height:8px;background:#ececec;border-radius:10px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${unlocked ? color : '#b0bec5'};border-radius:10px;${unlocked && !claimed ? 'animation:rwShine 2s linear infinite;' : ''}transition:width .8s ease;"></div></div><div style="font-size:.6rem;color:#bbb;margin-top:3px;">${pct}%</div>${dateStr}</div>`;
    }
    if (milestones.length > 0) {
        if (milestoneZone) milestoneZone.style.display = 'block';
        let h = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;">';
        milestones.forEach(r => { h += buildCard(r, lifetimeXP, '#28a745', false); });
        milestoneList.innerHTML = h + '</div>';
    } else if (milestoneZone) { milestoneZone.style.display = 'none'; }
    if (challenges.length > 0) {
        if (challengeZone) challengeZone.style.display = 'block';
        let h = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;">';
        challenges.forEach(r => {
            let gainedXP = 0;
            if (window.currentUser && window.globalFeedData) {
                window.globalFeedData.forEach(p => {
                    if (p.timestamp && (new Date(p.timestamp).getTime() > r.createdTs)) {
                        if (String(p.user_line_id).trim() === String(window.currentUser.userId).trim()) gainedXP += Number(p.score) || 0;
                        if (p.verifies && Array.isArray(p.verifies)) {
                            p.verifies.forEach(v => {
                                const vid = (typeof v === 'object') ? (v.userId || v.lineId) : v;
                                if (String(vid).trim() === String(window.currentUser.userId).trim()) gainedXP += 3;
                            });
                        }
                    }
                });
            }
            h += buildCard(r, gainedXP, '#ff9f43', true);
        });
        challengeList.innerHTML = h + '</div>';
    } else if (challengeZone) { challengeZone.style.display = 'none'; }
};

window.openRewardBox = function(id) {
    const r = (window.globalRewardsData || []).find(x => x.id === id);
    if (!r) return;
    const isChallenge = r.mode == 2;
    const accentColor = isChallenge ? '#ff9f43' : '#28a745';
    const glow        = isChallenge ? 'rwGlow' : 'rwGlowGreen';
    let currentXP = 0;
    if (isChallenge) {
        if (window.currentUser && window.globalFeedData) {
            window.globalFeedData.forEach(p => {
                if (p.timestamp && (new Date(p.timestamp).getTime() > r.createdTs)) {
                    if (String(p.user_line_id).trim() === String(window.currentUser.userId).trim()) currentXP += Number(p.score) || 0;
                    if (p.verifies && Array.isArray(p.verifies)) {
                        p.verifies.forEach(v => {
                            const vid = (typeof v === 'object') ? (v.userId || v.lineId) : v;
                            if (String(vid).trim() === String(window.currentUser.userId).trim()) currentXP += 3;
                        });
                    }
                }
            });
        }
    } else {
        if (window.globalUserStatsMap && window.currentUser && window.globalUserStatsMap[window.currentUser.userId]) {
            currentXP = window.globalUserStatsMap[window.currentUser.userId].score || 0;
        } else if (window.currentUser) {
            currentXP = window.currentUser.score || 0;
        }
    }
    const pct = Math.min(100, Math.round((currentXP / r.targetVal) * 100));
    const imgHtml = r.image ? `<img src="${r.image}" style="width:100%;height:100%;object-fit:cover;border-radius:20px;">` : `<i class="fas fa-gift" style="font-size:6rem;color:${accentColor};animation:rwBounce .9s ease-in-out infinite alternate;"></i>`;
    document.getElementById('rwOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'rwOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:rgba(0,0,0,0.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;flex-direction:column;animation:fadeIn .3s ease;';
    overlay.innerHTML = `<style>@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes boxReveal{0%{transform:scale(.4) rotate(-8deg);opacity:0}60%{transform:scale(1.1) rotate(2deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}</style><button onclick="document.getElementById('rwOverlay').remove()" style="position:fixed;top:18px;right:18px;width:40px;height:40px;border:none;background:rgba(255,255,255,.15);border-radius:50%;color:#fff;font-size:1.2rem;cursor:pointer;z-index:100000;display:flex;align-items:center;justify-content:center;"><i class="fas fa-times"></i></button><div class="reward-overlay-card" style="border-radius:28px;padding:30px 24px 24px;max-width:320px;width:88%;text-align:center;box-shadow:0 20px 80px rgba(0,0,0,.4);animation:boxReveal .5s cubic-bezier(.22,1,.36,1) both;"><div style="width:200px;height:200px;margin:0 auto 18px;border-radius:20px;overflow:hidden;border:3px solid ${accentColor};box-shadow:0 0 40px ${accentColor}70;display:flex;align-items:center;justify-content:center;animation:${glow} 1.5s ease-in-out infinite alternate;">${imgHtml}</div><div style="font-size:1.2rem;font-weight:700;color:${accentColor};margin-bottom:6px;">${r.name}</div><div style="font-size:.78rem;color:#888;margin-bottom:18px;">${isChallenge ? 'ภารกิจพิเศษ' : 'รางวัลกิจกรรมทำความดี'}</div><div class="reward-progress-bg" style="border-radius:14px;padding:12px 14px;margin-bottom:18px;text-align:left;"><div class="d-flex justify-content-between" style="font-size:.72rem;color:#888;margin-bottom:6px;"><span>คะแนน${isChallenge ? 'ใหม่' : 'สะสม'}</span><span style="font-weight:700;color:${accentColor};">${currentXP} / ${r.targetVal} XP</span></div><div style="height:12px;background:#e0e0e0;border-radius:10px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${accentColor};border-radius:10px;animation:rwShine 2s linear infinite;transition:width .8s ease;"></div></div><div style="text-align:right;font-size:.62rem;color:#bbb;margin-top:4px;">${pct}%</div></div><button onclick="document.getElementById('rwOverlay').remove(); claimReward('${r.id}');" style="width:100%;padding:13px;border:none;border-radius:14px;font-size:1rem;font-weight:700;color:#fff;background:${accentColor};cursor:pointer;box-shadow:0 4px 14px ${accentColor}50;letter-spacing:.4px;"><i class="fas fa-star me-2"></i> แจ้งรับรางวัล</button><button onclick="document.getElementById('rwOverlay').remove();" style="margin-top:10px;width:100%;padding:10px;border:1.5px solid #ddd;background:#fff;border-radius:12px;cursor:pointer;font-size:.85rem;color:#888;">ปิด</button></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
};

window.openAddRewardModal = function() {
    if (typeof closeRewardModal === 'function') closeRewardModal();
    const title = document.getElementById('rewardModalTitle');
    if (title) title.innerHTML = '<i class="fas fa-plus me-2"></i>เพิ่มของรางวัลใหม่';
    
    ['rewardName', 'rewardImageUrl', 'rewardImage', 'rewardTargetVal', 'rewardEndDate', 'editRewardId'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    window.currentRewardFile = null; // ล้างไฟล์ที่เลือกไว้
    
    const preview = document.getElementById('rewardImagePreview');
    if (preview) preview.src = '';
    const previewContainer = document.getElementById('rewardImagePreviewContainer');
    if (previewContainer) previewContainer.style.display = 'none';
    
    const mode = document.getElementById('rewardMode');
    if (mode) { mode.value = '1'; mode.disabled = false; }
    const targetVal = document.getElementById('rewardTargetVal');
    if (targetVal) targetVal.disabled = false;
    
    if (typeof toggleRewardModeFields === 'function') toggleRewardModeFields();
    
    const backdrop = document.getElementById('rewardModalBackdrop');
    if (backdrop) backdrop.style.display = 'block';
    const modal = document.getElementById('rewardModal');
    if (modal) modal.style.display = 'block';
};

window.editReward = function(id) {
    const r = (window.globalRewardsData || []).find(x => x.id === id);
    if (!r) return;
    const title = document.getElementById('rewardModalTitle');
    if (title) title.innerHTML = '<i class="fas fa-pen me-2"></i>แก้ไขของรางวัล';
    
    const nameEl = document.getElementById('rewardName'); if (nameEl) nameEl.value = r.name;
    const urlEl = document.getElementById('rewardImageUrl'); if (urlEl) urlEl.value = r.image || '';
    
    window.currentRewardFile = null; // ล้างไฟล์ที่อาจค้างอยู่

    const preview = document.getElementById('rewardImagePreview');
    const previewContainer = document.getElementById('rewardImagePreviewContainer');
    if (r.image && preview && previewContainer) {
        preview.src = r.image;
        previewContainer.style.display = 'block';
    } else if (preview && previewContainer) {
        preview.src = '';
        previewContainer.style.display = 'none';
    }
    
    const imgEl = document.getElementById('rewardImage'); if (imgEl) imgEl.value = '';
    const modeEl = document.getElementById('rewardMode'); if (modeEl) { modeEl.value = r.mode; modeEl.disabled = true; }
    const targetEl = document.getElementById('rewardTargetVal'); if (targetEl) { targetEl.value = r.targetVal; targetEl.disabled = false; }
    
    const endEl = document.getElementById('rewardEndDate');
    if (endEl) {
        if (r.endDate) {
            const d = new Date(r.endDate);
            const tzoffset = (new Date()).getTimezoneOffset() * 60000;
            endEl.value = (new Date(d - tzoffset)).toISOString().split('T')[0];
        } else {
            endEl.value = '';
        }
    }
    
    const editIdEl = document.getElementById('editRewardId'); if (editIdEl) editIdEl.value = r.id;
    if (typeof toggleRewardModeFields === 'function') toggleRewardModeFields();
    
    const backdrop = document.getElementById('rewardModalBackdrop'); if (backdrop) backdrop.style.display = 'block';
    const modal = document.getElementById('rewardModal'); if (modal) modal.style.display = 'block';
};

window.closeRewardModal = function() {
    const backdrop = document.getElementById('rewardModalBackdrop'); if (backdrop) backdrop.style.display = 'none';
    const modal = document.getElementById('rewardModal'); if (modal) modal.style.display = 'none';
};

window.toggleRewardModeFields = function() {
    const modeEl = document.getElementById('rewardMode');
    const labelEl = document.getElementById('rewardTargetLabel');
    const helpEl = document.getElementById('rewardModeHelp');
    if (!modeEl || !labelEl || !helpEl) return;
    
    if (modeEl.value === '1') {
        labelEl.innerHTML = 'เป้าหมายคะแนนรวม (Lifetime XP)';
        helpEl.innerHTML = 'พนักงานทุกคนที่สะสมคะแนนจากอดีตถึงปัจจุบันจนถึงเป้าจะได้รับรางวัลนี้';
    } else {
        labelEl.innerHTML = 'คะแนนใหม่ที่ต้องสะสมเพิ่ม (+XP)';
        helpEl.innerHTML = 'นับเฉพาะคะแนนที่ทำได้ใหม่หลังจากสร้างกิจกรรมนี้เป็นต้นไป (เริ่มนับ 0 ใหม่ทุกคน)';
    }
};

document.getElementById('rewardImage')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    window.currentRewardFile = file; // เก็บไฟล์ไว้ก่อน ยังไม่บันทึก

    const reader = new FileReader();
    reader.onload = function(evt) {
        const preview = document.getElementById('rewardImagePreview');
        const container = document.getElementById('rewardImagePreviewContainer');
        if (preview && container) {
            preview.src = evt.target.result;
            container.style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
});

window.removeRewardImage = function() {
    window.currentRewardFile = null; // ล้างไฟล์ที่เลือกไว้
    
    // หมายเหตุ: เราจะไม่สั่งลบจาก Cloudinary ทันทีตามที่ผู้ใช้แจ้ง 
    // เพราะถ้าเขายังไม่กดบันทึก รูปเดิมในฐานข้อมูลยังต้องคงอยู่
    
    ['rewardImage', 'rewardImageUrl'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const preview = document.getElementById('rewardImagePreview'); if (preview) preview.src = '';
    const container = document.getElementById('rewardImagePreviewContainer'); if (container) container.style.display = 'none';
};

window.saveReward = async function() {
    const nameEl = document.getElementById('rewardName');
    const modeEl = document.getElementById('rewardMode');
    const targetEl = document.getElementById('rewardTargetVal');
    const endEl = document.getElementById('rewardEndDate');
    const urlEl = document.getElementById('rewardImageUrl');
    const editIdEl = document.getElementById('editRewardId');
    if (!nameEl || !targetEl) return;

    const name = nameEl.value.trim();
    const mode = modeEl ? modeEl.value : '1';
    const targetVal = targetEl.value;
    const endDate = endEl ? endEl.value : '';
    const editId = editIdEl ? editIdEl.value : '';
    
    if (!name || !targetVal) {
        Swal.fire('แจ้งเตือน', 'กรุณากรอกชื่อและคะแนนเป้าหมายให้ครบถ้วน', 'warning');
        return;
    }
    
    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading(), allowOutsideClick: false});
    
    try {
        let finalImageUrl = urlEl ? urlEl.value : '';
        
        // อัปโหลดรูปภาพไปยัง Cloudinary เฉพาะตอนกดบันทึกเท่านั้น
        if (window.currentRewardFile && typeof uploadImageToCloudinary === 'function') {
            Swal.update({ title: 'กำลังอัปโหลดรูปภาพไปยัง Cloudinary...' });
            const uploadedUrl = await uploadImageToCloudinary(window.currentRewardFile);
            if (uploadedUrl) {
                finalImageUrl = uploadedUrl;
            } else {
                Swal.fire('ข้อผิดพลาด', 'อัปโหลดรูปภาพไม่สำเร็จ', 'error');
                return;
            }
        }

        const payload = {
            action: editId ? 'edit_reward' : 'save_reward',
            rewardId: editId,
            name: name,
            mode: mode,
            targetVal: targetVal,
            endDate: endDate,
            image: finalImageUrl
        };
        
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        
        if (data.status === 'success') {
            window.currentRewardFile = null; // ล้างค่าหลังบันทึกสำเร็จ
            Swal.fire('สำเร็จ', editId ? 'แก้ไขรางวัลเรียบร้อย' : 'เพิ่มรางวัลใหม่เรียบร้อยแล้ว', 'success');
            if (typeof closeRewardModal === 'function') closeRewardModal();
            if (typeof fetchRewards === 'function') fetchRewards();
        } else {
            Swal.fire('ข้อผิดพลาด', data.message || 'บันทึกไม่สำเร็จ', 'error');
        }
    } catch(err) {
        console.error(err);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์', 'error');
    }
};

window.deleteReward = function(id) {
    Swal.fire({
        title: 'ยืนยันการลบ?',
        text: 'รางวัลนี้จะถูกยกเลิกและลบออกจากระบบทันที',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ใช่, ลบทิ้งเลย',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
            try {
                const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({action: 'delete_reward', rewardId: id}) });
                const data = await res.json();
                if (data.status === 'success') {
                    Swal.fire('ลบสำเร็จ', '', 'success');
                    if (typeof fetchRewards === 'function') fetchRewards();
                } else {
                    Swal.fire('ผิดพลาด', data.message || '', 'error');
                }
            } catch(e) {
                Swal.fire('ผิดพลาด', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'error');
            }
        }
    });
};

window.claimReward = function(id) {
    if (!window.currentUser) return;
    Swal.fire({
        title: 'ยืนยันการรับรางวัล 🎉',
        text: 'คุณต้องการแจ้งความประสงค์เพื่อรับรางวัลชิ้นนี้ใช่หรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันแจ้งรับ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#ff9f43'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังบันทึกข้อมูล...', didOpen: () => Swal.showLoading() });
            try {
                const payload = {
                    action: 'claim_reward',
                    rewardId: id,
                    userId: window.currentUser.userId,
                    userName: window.currentUser.name
                };
                const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
                const data = await res.json();
                if (data.status === 'success') {
                    Swal.fire({
                        title: 'สำเร็จ! 🥳',
                        html: `แจ้งรับรางวัลเรียบร้อยแล้ว!<br><br><small class="text-muted">กรุณาติดต่อรับรางวัลกับทาง HR หรือผู้ดูแลระบบครับ</small>`,
                        icon: 'success',
                        confirmButtonColor: '#ff9f43'
                    });
                    if (typeof fetchRewards === 'function') fetchRewards();
                } else {
                    Swal.fire('ผิดพลาด', data.message || 'บันทึกไม่สำเร็จ', 'error');
                }
            } catch (e) {
                Swal.fire('ผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์', 'error');
            }
        }
    });
};
