// =====================================================
// 📝 survey.js — แบบสอบถามและสภาพอากาศ
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

async function checkAndShowWeatherAlert(force = false) {
    if (!currentUser || !currentUser.userId) return;

    if (force) Swal.fire({ title: 'กำลังดึงข้อมูลอากาศ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const storageKey = 'weather_last_alert';
    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

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
            const pm25 = data.pm25;

            let dustAdvise = '';
            if (pm25 !== null && pm25 !== undefined) {
                if (pm25 <= 25) {
                    dustAdvise = '<br>🍀 สำหรับสภาพฝุ่นวันนี้ อากาศสะอาดมากค่ะ ไม่พบฝุ่นละอองที่เป็นอันตราย สามารถทำกิจกรรมกลางแจ้งได้อย่างสบายใจเลยนะคะ';
                } else if (pm25 <= 37.5) {
                    dustAdvise = '<br>🟡 สำหรับสภาพฝุ่นวันนี้ เริ่มมีฝุ่นละอองเล็กน้อยค่ะ หากท่านใดแพ้ง่าย แนะนำให้เริ่มสวมหน้ากากอนามัยเวลาออกนอกอาคารเพื่อความปลอดภัยนะคะ';
                } else if (pm25 <= 75) {
                    dustAdvise = '<br>🟠 สำหรับสภาพฝุ่นวันนี้ ค่อนข้างสูงและเริ่มมีผลต่อสุขภาพค่ะ ขอแนะนำให้ทุกท่าน<b>สวมหน้ากากอนามัยทุกครั้ง</b>ที่ต้องปฏิบัติงานนอกอาคารนะคะ';
                } else {
                    dustAdvise = '<br>🔴 สำหรับสภาพฝุ่นวันนี้ อยู่ในระดับที่เป็นอันตรายมากค่ะ <b>งดกิจกรรมนอกอาคารทุกชนิด</b> และสวมหน้ากากอนามัย N95 ตลอดเวลาเพื่อสุขภาพของทุกท่านนะคะ';
                }
            }

            const isRain = description.includes('ฝน') || description.toLowerCase().includes('rain');
            const rainAdvise = isRain ? '<br>☔ <b>พยากรณ์พบฝนตก:</b> อย่าลืมพกพกร่มหรือเสื้อกันฝนด้วยนะคะ ขับขี่ด้วยความระมัดระวังค่ะ' : '';

            Swal.fire({
                title: `<div style="font-size:1.1rem; color:#6c5ce7;">🌤️ รายงานสภาพอากาศ จ.ระยอง</div>`,
                html: `
                    <div class="text-center">
                        <img src="https://openweathermap.org/img/wn/${icon}@2x.png" style="width:80px; margin-top:-10px;">
                        <div class="mb-3">
                            <span style="font-size:1.8rem; font-weight:900;">${temp}°C</span>
                            <div class="text-muted small">${description}</div>
                        </div>
                        <div class="p-3 rounded-4 bg-light text-start small" style="line-height:1.6; border:1px solid #eee;">
                            ✅ สวัสดีค่ะคุณ ${currentUser.name}, วันนี้ท้องฟ้าแจ่มใส อุณหภูมิประมาณ ${temp} องศาค่ะ
                            ${dustAdvise}
                            ${rainAdvise}
                            <div class="mt-2 text-center text-primary" style="font-weight:600;">รักษาสุขภาพด้วยนะคะ ด้วยรักและห่วงใยจาก Happy Meter ❤️</div>
                        </div>
                    </div>
                `,
                confirmButtonText: 'รับทราบค่ะ',
                confirmButtonColor: '#6c5ce7',
                width: '90%',
                maxWidth: '420px',
                customClass: { popup: 'rounded-4 glass-card' }
            });

            localStorage.setItem(storageKey, today);
        }
    } catch (e) { console.error("Weather alert error:", e); }
}
