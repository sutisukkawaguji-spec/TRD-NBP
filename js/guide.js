/**
 * 👩‍💼 Happy Meter Guide System v3
 * Spotlight Mode — เบลอทั้งหน้า โฟกัสทีละจุด Tooltip ลอยไม่บัง
 */

const GuideSystem = {
    storageKey: 'happymeter_guide_v1',
    _overlay: null,
    _tooltip: null,
    _prevSpotlight: null,

    async startTour(force = false) {
        if (!force && localStorage.getItem(this.storageKey)) return;

        this._createOverlay();
        const steps = this.buildSteps();

        for (let i = 0; i < steps.length; i++) {
            const cont = await this.showStep(steps[i], i, steps.length);
            if (!cont) {
                this._cleanup();
                localStorage.setItem(this.storageKey, 'true');
                return;
            }
        }

        this._cleanup();
        localStorage.setItem(this.storageKey, 'true');
    },

    buildSteps() {
        const steps = [
            {
                title: '👩‍💼 ยินดีต้อนรับค่ะ',
                msg: 'ขอพาทัวร์ฟีเจอร์หลักๆ ของ <b>ดี มีสุข</b> นะคะ',
                el: null, tab: null
            },
            {
                title: '📝 บันทึกความสุขรายวัน',
                msg: 'เขียนเรื่องราวดีๆ ของวันนี้ แล้วกดบันทึกได้เลยค่ะ',
                el: '#noteInput', tab: 'record'
            },
            {
                title: '😊 เลือกอารมณ์ความรู้สึก',
                msg: 'กดเลือกอิโมจิให้ตรงกับอารมณ์วันนี้ของคุณค่ะ',
                el: '.mood-container', tab: 'record'
            },
            {
                title: '💡 นิยามกิจกรรม',
                msg: 'กดไอคอน ❓ เพื่อดูนิยามและตัวอย่างของแต่ละหมวดความดีค่ะ',
                el: 'i[onclick="showVirtueInfo()"]', tab: 'record'
            },
            {
                title: '📖 คู่มือการใช้งาน',
                msg: 'กดปุ่ม <b>"คู่มือ"</b> สีฟ้าเพื่อเปิดเอกสารฉบับเต็มได้เลยค่ะ',
                el: 'a[href*="guide.html"]', tab: 'record'
            }
        ];

        if (this.isNavVisible('nav-stories-btn'))
            steps.push({ title: '✨ เรื่องราว (Feed)', msg: 'ดูและส่งต่อพลังบวกของเพื่อนร่วมงานที่นี่ค่ะ', el: '#nav-stories-btn', tab: 'stories' });

        if (this.isNavVisible('nav-relation-btn'))
            steps.push({ title: '🗺️ ความผูกพัน', msg: 'ดูผังความสัมพันธ์ในองค์กรที่นี่ค่ะ', el: '#nav-relation-btn', tab: 'relation' });

        if (this.isNavVisible('nav-manager-btn'))
            steps.push({ title: '💼 สำหรับผู้บริหาร', msg: 'Dashboard วิเคราะห์สุขภาวะองค์กรเฉพาะสำหรับคุณค่ะ', el: '#nav-manager-btn', tab: 'manager' });

        steps.push({ title: '🎉 พร้อมใช้งานแล้วค่ะ!', msg: 'กดปุ่ม <b>❓</b> บน Header เพื่อดูทัวร์ซ้ำได้ทุกเมื่อนะคะ 🌸', el: '#guideTriggerBtn', tab: null });

        return steps;
    },

    isNavVisible(id) {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none';
    },

    // สร้าง Overlay + Tooltip ครั้งเดียว
    _createOverlay() {
        // Overlay มืดแบบเรียบๆ — ห้ามใช้ backdrop-filter:blur เพราะจะเบลอจุดที่โฟกัสด้วย
        const ov = document.createElement('div');
        ov.id = 'guideOverlay';
        ov.style.cssText = `
            position:fixed; inset:0; z-index:9990;
            background:rgba(0,0,20,0.0);
            transition:background 0.3s;
            pointer-events:none;
        `;
        document.body.appendChild(ov);
        // Fade in
        requestAnimationFrame(() => {
            ov.style.background = 'rgba(0,0,20,0.0)';
        });
        this._overlay = ov;

        // Tooltip card
        const tip = document.createElement('div');
        tip.id = 'guideTooltip';
        tip.style.cssText = `
            position:fixed; z-index:10000;
            max-width:260px; min-width:200px;
            background:#fff; border-radius:14px;
            padding:14px 16px 12px;
            box-shadow:0 8px 30px rgba(0,0,0,0.25);
            font-family:'Kanit',sans-serif;
            transition:all 0.25s ease;
            display:none;
        `;
        document.body.appendChild(tip);
        this._tooltip = tip;
    },

    _cleanup() {
        this._removeSpotlight();
        document.getElementById('guideOverlay')?.remove();
        document.getElementById('guideTooltip')?.remove();
        this._overlay = null;
        this._tooltip = null;
    },

    _removeSpotlight() {
        if (this._prevSpotlight) {
            const el = this._prevSpotlight;
            el.style.position = '';
            el.style.zIndex = '';
            el.style.boxShadow = el._origShadow || '';
            el.style.borderRadius = '';
            el.style.pointerEvents = '';
            el.style.outline = '';
            el.style.outlineOffset = '';
            this._prevSpotlight = null;
        }
    },

    _spotlightEl(el) {
        this._removeSpotlight();
        if (!el) return;
        el._origShadow = el.style.boxShadow;
        // ใช้ box-shadow ขนาดใหญ่มากๆ เพื่อทำให้พื้นที่รอบ Element มืดลง
        // แต่ตัว Element เองจะยังชัดอยู่ (ไม่ถูก blur)
        el.style.position = 'relative';
        el.style.zIndex = '9995';
        el.style.boxShadow = '0 0 0 4px #a29bfe, 0 0 0 9999px rgba(0,0,20,0.78)';
        el.style.borderRadius = '10px';
        el.style.pointerEvents = 'none';
        el.style.outline = '2px solid rgba(108,92,231,0.8)';
        el.style.outlineOffset = '3px';
        this._prevSpotlight = el;
    },

    // คำนวณตำแหน่ง Tooltip ให้ไม่บัง Element
    _positionTooltip(el, tip) {
        const margin = 14;
        tip.style.display = 'block';
        const tipH = tip.offsetHeight;
        const tipW = tip.offsetWidth;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (!el) {
            // ไม่มี Element → กลางจอ
            tip.style.left = Math.max(8, (vw - tipW) / 2) + 'px';
            tip.style.top = Math.max(8, (vh - tipH) / 2) + 'px';
            return;
        }

        const rect = el.getBoundingClientRect();
        const elCenterY = rect.top + rect.height / 2;

        let top, left;

        if (elCenterY > vh * 0.5) {
            // Element อยู่ล่าง → Tooltip วางบน
            top = Math.max(margin, rect.top - tipH - margin);
        } else {
            // Element อยู่บน → Tooltip วางล่าง
            top = Math.min(vh - tipH - margin, rect.bottom + margin);
        }

        // แนว X: align กับ Element แต่ clamp ให้ไม่เกินขอบ
        left = rect.left + rect.width / 2 - tipW / 2;
        left = Math.max(margin, Math.min(vw - tipW - margin, left));

        tip.style.top = top + 'px';
        tip.style.left = left + 'px';
    },

    showStep(step, index, total) {
        return new Promise(async (resolve) => {
            // สลับแท็บ
            if (step.tab) {
                const btn = document.getElementById(`nav-${step.tab}-btn`);
                if (btn && typeof switchTab === 'function') switchTab(step.tab, btn);
                await new Promise(r => setTimeout(r, 350));
            }

            // หา Element
            let targetEl = null;
            if (step.el) {
                targetEl = document.querySelector(step.el);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await new Promise(r => setTimeout(r, 400));
                }
            }

            // Spotlight
            this._spotlightEl(targetEl);

            // สร้างเนื้อหา Tooltip
            const isLast = index === total - 1;
            const isFirst = index === 0;
            const tip = this._tooltip;

            tip.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span style="font-size:1.4rem;">👩‍💼</span>
                    <div>
                        <div style="font-size:0.75rem;font-weight:700;color:#6c5ce7;line-height:1.2;">${step.title}</div>
                        <div style="font-size:0.6rem;color:#aaa;">${index + 1} / ${total}</div>
                    </div>
                </div>
                <div style="font-size:0.78rem;color:#333;line-height:1.6;margin-bottom:10px;">${step.msg}</div>
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    <button id="gt-skip" style="font-size:0.7rem;padding:4px 10px;border:1px solid #ddd;
                        background:#f9f9f9;border-radius:20px;cursor:pointer;color:#999;">ข้าม</button>
                    ${!isFirst ? `<button id="gt-prev" style="font-size:0.7rem;padding:4px 10px;border:1px solid #ddd;
                        background:#f9f9f9;border-radius:20px;cursor:pointer;color:#555;">◀ ย้อนกลับ</button>` : ''}
                    <button id="gt-next" style="font-size:0.7rem;padding:5px 12px;border:none;
                        background:#6c5ce7;color:#fff;border-radius:20px;cursor:pointer;font-weight:600;">
                        ${isLast ? '✅ เสร็จสิ้น' : 'ถัดไป ▶'}</button>
                </div>`;

            this._positionTooltip(targetEl, tip);

            // Event Listeners
            document.getElementById('gt-next').onclick = () => {
                document.getElementById('gt-next').onclick = null;
                document.getElementById('gt-skip').onclick = null;
                if (document.getElementById('gt-prev')) document.getElementById('gt-prev').onclick = null;
                resolve(true); // ถัดไป
            };
            document.getElementById('gt-skip').onclick = () => {
                resolve(false); // ข้ามทัวร์
            };
            if (!isFirst && document.getElementById('gt-prev')) {
                document.getElementById('gt-prev').onclick = () => {
                    // ย้อนกลับ — resolve(null) แล้วจัดการใน loop
                    resolve('prev');
                };
            }
        });
    }
};

/**
 * เพิ่มปุ่ม ❓ Guide ใน Header
 */
function injectGuideButton() {
    if (document.getElementById('guideTriggerBtn')) return;
    const area = document.querySelector('#header-user .col-4 .d-flex');
    if (!area) return;
    const btn = document.createElement('button');
    btn.id = 'guideTriggerBtn';
    btn.className = 'btn btn-sm btn-light rounded-circle shadow-sm';
    btn.style.cssText = 'width:32px;height:32px;display:flex;align-items:center;justify-content:center;padding:0;';
    btn.title = 'พาทัวร์การใช้งาน';
    btn.innerHTML = '<i class="fas fa-question" style="font-size:0.8rem;color:#6c5ce7;"></i>';
    btn.onclick = () => GuideSystem.startTour(true);
    area.appendChild(btn);
}
