/**
 * 👩‍💼 Happy Meter Guide System
 * ระบบผู้ช่วยสอนการใช้งานแบบอิงตามสิทธิ์ผู้ใช้
 * v2 — Smart Positioning (กล่องหลบจากจุดที่ Highlight)
 */

const GuideSystem = {
    storageKey: 'happymeter_guide_v1',

    async startTour(force = false) {
        if (!force && localStorage.getItem(this.storageKey)) return;

        // นำทางกลับแท็บบันทึกก่อนเริ่ม
        const recordBtn = document.getElementById('nav-record-btn');
        if (recordBtn && typeof switchTab === 'function') {
            switchTab('record', recordBtn);
        }
        await new Promise(r => setTimeout(r, 400));

        const steps = this.buildSteps();
        for (let i = 0; i < steps.length; i++) {
            const result = await this.showStep(steps[i], i, steps.length);
            if (!result) {
                // กด "ข้ามทัวร์"
                localStorage.setItem(this.storageKey, 'true');
                this.ensureTab('record');
                return;
            }
        }

        // จบทัวร์สำเร็จ
        localStorage.setItem(this.storageKey, 'true');
        this.ensureTab('record');
    },

    buildSteps() {
        const steps = [
            {
                title: '👩‍💼 ยินดีต้อนรับสู่ ดี มีสุข 🌸',
                message: `ขอพาทุกท่านทำความรู้จักฟีเจอร์สำคัญๆ คร่าวๆ นะคะ<br>
                          กดปุ่ม <b>"ถัดไป ➡️"</b> เพื่อเรียนรู้ทีละส่วน<br>
                          หรือกด <b>"ข้ามทัวร์นี้"</b> เพื่อเริ่มใช้งานเลยค่ะ`,
                element: null,
                tab: null
            },
            {
                title: '📝 บันทึกความรู้สึกรายวัน',
                message: `นี่คือจุดเริ่มต้นที่สำคัญที่สุดค่ะ<br>
                          อย่าลืมแวะมาบันทึกความรู้สึกและเรื่องราวดีๆ
                          ของแต่ละวันที่ช่องนี้นะคะ เพื่อสร้างพลังใจให้ตนเองและเพื่อนร่วมงานค่ะ`,
                element: '#page-record',
                tab: 'record'
            },
            {
                title: '💡 นิยามหมวดหมู่กิจกรรม',
                message: `ไม่แน่ใจว่าเรื่องราวตรงกับหมวดไหน?<br>
                          กดที่ <b>ไอคอน ❓</b> ตรงหัวข้อ "เลือกหมวดหมู่"
                          เพื่อดูนิยามและตัวอย่างกิจกรรมแต่ละประเภทได้เลยค่ะ`,
                element: 'i[onclick="showVirtueInfo()"]',
                tab: 'record'
            },
            {
                title: '📖 คู่มือการใช้งาน',
                message: `ต้องการข้อมูลละเอียดเพิ่มเติม?<br>
                          กดปุ่ม <b>"คู่มือ"</b> สีฟ้าตรงนี้เพื่อเปิดเอกสาร
                          คู่มือการใช้งานฉบับเต็มได้ทุกเมื่อค่ะ`,
                element: 'a[href*="guide.html"]',
                tab: 'record'
            }
        ];

        if (this.isNavVisible('nav-stories-btn')) {
            steps.push({
                title: '✨ เรื่องราวและ Feed กิจกรรม',
                message: `กดที่เมนูนี้เพื่อดูเรื่องราวของเพื่อนร่วมงาน และร่วมส่งต่อพลังบวกให้กันและกันนะคะ`,
                element: '#nav-stories-btn',
                tab: 'stories'
            });
        }

        if (this.isNavVisible('nav-stats-btn')) {
            steps.push({
                title: '📊 สถิติรายบุคคล',
                message: `ตรวจสอบสถิติความสุขส่วนตัว กราฟแนวโน้ม และเหรียญรางวัลที่สะสมได้ที่แท็บนี้ค่ะ`,
                element: '#nav-stats-btn',
                tab: 'stats'
            });
        }

        if (this.isNavVisible('nav-relation-btn')) {
            steps.push({
                title: '🗺️ ผังความผูกพันในองค์กร',
                message: `ดูเครือข่ายความสัมพันธ์และส่งความห่วงใยให้เพื่อนร่วมงานผ่านแท็บนี้นะคะ`,
                element: '#nav-relation-btn',
                tab: 'relation'
            });
        }

        if (this.isNavVisible('nav-manager-btn')) {
            steps.push({
                title: '💼 ข้อมูลเชิงลึกสำหรับผู้บริหาร',
                message: `<b>พิเศษสำหรับคุณค่ะ!</b><br>
                          ส่วนนี้แสดงการวิเคราะห์เครือข่ายความสุข ตัวชี้วัดองค์กร
                          เพื่อนำไปส่งเสริมทีมงานได้อย่างตรงจุดค่ะ`,
                element: '#nav-manager-btn',
                tab: 'manager'
            });
        }

        steps.push({
            title: '🎉 พร้อมแล้วค่ะ!',
            message: `หากลืมวิธีใช้งาน กดปุ่ม <b>❓</b> ที่ Header ได้เสมอนะคะ<br><br>
                      <i>ขอให้มีความสุขกับการใช้งาน ดี มีสุข ทุกวันค่ะ 🌸</i>`,
            element: '#guideTriggerBtn',
            tab: null
        });

        return steps;
    },

    isNavVisible(id) {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none' && !el.classList.contains('d-none');
    },

    ensureTab(tabName) {
        if (!tabName) return;
        const btn = document.getElementById(`nav-${tabName}-btn`);
        if (btn && typeof switchTab === 'function') switchTab(tabName, btn);
    },

    /**
     * คำนวณ position ของ Swal ให้หลบจาก element ที่ highlight
     * ถ้า element อยู่ครึ่งบนของจอ → เอากล่องไปล่าง
     * ถ้า element อยู่ครึ่งล่างของจอ → เอากล่องไปบน
     */
    getSmartPosition(el) {
        if (!el) return 'center';
        const rect = el.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const elementCenterY = rect.top + rect.height / 2;

        if (elementCenterY < viewportHeight * 0.45) {
            return 'bottom';   // element อยู่บน → กล่องไปล่าง
        } else {
            return 'top';      // element อยู่ล่าง → กล่องไปบน
        }
    },

    async showStep(step, index, total) {
        // สลับแท็บก่อน
        if (step.tab) {
            this.ensureTab(step.tab);
            await new Promise(r => setTimeout(r, 350));
        }

        // หา element และ scroll ไปหา
        let targetEl = null;
        let swalPosition = 'center';
        if (step.element) {
            targetEl = document.querySelector(step.element);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(r => setTimeout(r, 400));

                // คำนวณ position หลังจาก scroll เสร็จแล้ว
                swalPosition = this.getSmartPosition(targetEl);

                // ไฮไลท์ element
                targetEl.style.outline = '3px solid #6c5ce7';
                targetEl.style.outlineOffset = '5px';
                targetEl.style.borderRadius = '8px';
                targetEl.style.zIndex = '9999';
                targetEl.style.position = targetEl.style.position || 'relative';
            }
        }

        const isLast = index === total - 1;
        const stepLabel = `${index + 1} / ${total}`;

        const htmlContent = `
            <div style="font-family:'Kanit',sans-serif; text-align:left; font-size:0.88rem; line-height:1.7;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;
                            border-bottom:1px solid rgba(108,92,231,0.15); padding-bottom:8px;">
                    <div style="font-size:1.8rem;">👩‍💼</div>
                    <div>
                        <div style="font-size:0.65rem; color:#aaa;">ผู้ช่วยสอนการใช้งาน</div>
                        <div style="font-size:0.7rem; font-weight:700; color:#6c5ce7;">${stepLabel}</div>
                    </div>
                </div>
                <div style="color:var(--text-color,#333);">${step.message}</div>
            </div>`;

        const result = await Swal.fire({
            title: step.title,
            html: htmlContent,
            position: swalPosition,
            showCancelButton: true,
            cancelButtonText: '⏩ ข้ามทัวร์',
            confirmButtonText: isLast ? '✅ เริ่มใช้งานเลยค่ะ!' : 'ถัดไป ➡️',
            confirmButtonColor: '#6c5ce7',
            cancelButtonColor: '#b2bec3',
            width: '88%',
            background: 'var(--glass-bg, #fff)',
            backdrop: 'rgba(0,0,80,0.15)',
            allowOutsideClick: false,
            showClass: { popup: 'animate__animated animate__fadeIn animate__faster' },
            hideClass: { popup: 'animate__animated animate__fadeOut animate__faster' }
        });

        // ลบ highlight หลังปิด popup
        if (targetEl) {
            targetEl.style.outline = '';
            targetEl.style.outlineOffset = '';
            targetEl.style.zIndex = '';
        }

        return result.isConfirmed;
    }
};

/**
 * เพิ่มปุ่ม ❓ ไว้ใน Header
 */
function injectGuideButton() {
    if (document.getElementById('guideTriggerBtn')) return;
    const actionArea = document.querySelector('#header-user .col-4 .d-flex');
    if (!actionArea) return;

    const btn = document.createElement('button');
    btn.id = 'guideTriggerBtn';
    btn.className = 'btn btn-sm btn-light rounded-circle shadow-sm';
    btn.style.cssText = 'width:32px;height:32px;display:flex;align-items:center;justify-content:center;padding:0;';
    btn.title = 'พาทัวร์การใช้งาน (กดดูซ้ำได้เสมอ)';
    btn.innerHTML = '<i class="fas fa-question" style="font-size:0.8rem;color:#6c5ce7;"></i>';
    btn.onclick = () => GuideSystem.startTour(true);
    actionArea.appendChild(btn);
}
