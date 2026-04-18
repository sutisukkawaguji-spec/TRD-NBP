/**
 * 👩‍💼 Happy Meter Guide System
 * ระบบผู้ช่วยสอนการใช้งานแบบอิงตามสิทธิ์ผู้ใช้
 */

const GuideSystem = {
    storageKey: 'happymeter_guide_v1',
    currentStep: 0,
    steps: [],

    /**
     * เริ่มพาทัวร์ (force = true สำหรับกดปุ่มดูซ้ำเอง)
     */
    async startTour(force = false) {
        if (!force && localStorage.getItem(this.storageKey)) return;

        // นำทางกลับแท็บบันทึก ก่อนเริ่มทัวร์
        const recordBtn = document.getElementById('nav-record-btn');
        if (recordBtn && typeof switchTab === 'function') {
            switchTab('record', recordBtn);
        }
        await new Promise(r => setTimeout(r, 400));

        this.steps = this.buildSteps();
        this.currentStep = 0;
        await this.showStep(0);
    },

    /**
     * สร้างรายการขั้นตอนแบบ Role-based
     */
    buildSteps() {
        const steps = [];

        // Step 0: Welcome
        steps.push({
            title: '👩‍💼 สวัสดีค่ะ ยินดีต้อนรับสู่ ดี มีสุข 🌸',
            message: `ก่อนเริ่มใช้งาน ขอพาทัวร์ฟีเจอร์สำคัญๆ คร่าวๆ นะคะ
                      ทุกท่านสามารถกดปุ่ม <b>"ถัดไป"</b> เพื่อเรียนรู้แต่ละส่วน
                      หรือกด <b>"ข้ามทัวร์นี้"</b> หากต้องการเริ่มใช้งานเลยค่ะ`,
            element: null
        });

        // Step 1: หน้าบันทึกความรู้สึก
        steps.push({
            title: '📝 บันทึกความรู้สึกรายวัน',
            message: `นี่คือจุดเริ่มต้นที่สำคัญที่สุดค่ะ อย่าลืมบันทึกความรู้สึกและเรื่องราวดีๆ
                      ของวันนั้นๆ ตรงส่วนนี้นะคะ เพื่อสร้างพลังใจให้ตนเองและเพื่อนร่วมงานค่ะ`,
            element: '#page-record',
            onShow: () => this.ensureTab('record')
        });

        // Step 2: นิยามกิจกรรม
        steps.push({
            title: '💡 นิยามและหมวดหมู่กิจกรรม',
            message: `หากไม่แน่ใจว่าเรื่องราวที่ทำตรงกับหมวดความดีไหน
                      สามารถกดดูนิยามกิจกรรมได้ทันทีที่ไอคอน <b>เครื่องหมายคำถาม (❓)</b>
                      ตรงส่วนเลือกหมวดหมู่ด้านล่างนี้ค่ะ`,
            element: 'i[onclick="showVirtueInfo()"]',
            onShow: () => this.ensureTab('record')
        });

        // Step 3: คู่มือ
        steps.push({
            title: '📖 คู่มือการใช้งานฉบับเต็ม',
            message: `ต้องการข้อมูลเชิงลึกเพิ่มเติม สามารถกดปุ่ม <b>"คู่มือ"</b> สีฟ้าตรงนี้
                      เพื่อเปิดเอกสารคำแนะนำการใช้งานแบบละเอียดได้ทุกเมื่อค่ะ`,
            element: 'a[href*="guide.html"]',
            onShow: () => this.ensureTab('record')
        });

        // Step 4: Tab เรื่องราว (Feed)
        if (this.isNavVisible('nav-stories-btn')) {
            steps.push({
                title: '✨ เรื่องราวและ Feed กิจกรรม',
                message: `มาติดตามและร่วมส่งต่อพลังบวกให้กับเพื่อนร่วมงาน
                          ผ่านหน้า <b>"เรื่องราว"</b> นี้นะคะ กดไอคอนที่แถบเมนูด้านล่าง
                          เพื่อสลับไปยังส่วนนี้ได้เลยค่ะ`,
                element: '#nav-stories-btn',
                onShow: () => this.ensureTab('stories')
            });
        }

        // Step 5: Tab สถิติ
        if (this.isNavVisible('nav-stats-btn')) {
            steps.push({
                title: '📊 สถิติรายบุคคล',
                message: `ตรวจสอบสถิติและพัฒนาการด้านความสุขของตนเองได้ที่ <b>แท็บสถิติ</b> นี้ค่ะ
                          ดูกราฟแนวโน้มและเหรียญรางวัลที่สะสมมาได้เลยค่ะ`,
                element: '#nav-stats-btn',
                onShow: () => this.ensureTab('stats')
            });
        }

        // Step 6: Tab ความผูกพัน
        if (this.isNavVisible('nav-relation-btn')) {
            steps.push({
                title: '🗺️ ผังความผูกพันในองค์กร',
                message: `ดูภาพรวมเครือข่ายความสัมพันธ์และร่วมส่งต่อพลังใจ
                          ให้ถึงเพื่อนร่วมงานผ่าน <b>แท็บความผูกพัน</b> ที่นี่นะคะ`,
                element: '#nav-relation-btn',
                onShow: () => this.ensureTab('relation')
            });
        }

        // Step 7: Tab ผู้บริหาร (เฉพาะผู้มีสิทธิ์)
        if (this.isNavVisible('nav-manager-btn')) {
            steps.push({
                title: '💼 ข้อมูลเชิงลึกสำหรับผู้บริหาร',
                message: `<b>พิเศษสำหรับคุณค่ะ!</b> ส่วนนี้แสดงการวิเคราะห์
                          แนวโน้มสุขภาวะและตัวชี้วัดสำคัญขององค์กร
                          เพื่อนำไปส่งเสริมทีมงานได้อย่างตรงจุดค่ะ`,
                element: '#nav-manager-btn',
                onShow: () => this.ensureTab('manager')
            });
        }

        // Step สุดท้าย: จบทัวร์
        steps.push({
            title: '🎉 พร้อมเริ่มต้นแล้วค่ะ!',
            message: `หากลืมวิธีการใช้งาน สามารถเรียกดูทัวร์ซ้ำได้ทุกเมื่อ
                      โดยกดปุ่ม <b>❓</b> ที่อยู่ด้านบนขวาของรูปโปรไฟล์นะคะ<br><br>
                      <i>ขอให้มีความสุขกับการใช้งาน ดี มีสุข ทุกวันนะคะ 🌸</i>`,
            element: null,
            onShow: () => this.ensureTab('record')
        });

        return steps;
    },

    isNavVisible(id) {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none' && !el.classList.contains('d-none');
    },

    ensureTab(tabName) {
        const btnId = `nav-${tabName}-btn`;
        const btn = document.getElementById(btnId);
        if (btn && typeof switchTab === 'function') {
            switchTab(tabName, btn);
        }
    },

    async showStep(index) {
        if (index < 0 || index >= this.steps.length) {
            localStorage.setItem(this.storageKey, 'true');
            this.ensureTab('record');
            return;
        }

        const step = this.steps[index];
        const isLast = index === this.steps.length - 1;
        const stepNum = `${index + 1} / ${this.steps.length}`;

        // สลับแท็บก่อน (ถ้าต้องการ)
        if (step.onShow) {
            step.onShow();
            await new Promise(r => setTimeout(r, 300));
        }

        // Highlight Element
        let targetEl = null;
        if (step.element) {
            targetEl = document.querySelector(step.element);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetEl.style.outline = '3px solid #6c5ce7';
                targetEl.style.outlineOffset = '5px';
                targetEl.style.borderRadius = '8px';
                targetEl.style.transition = 'all 0.3s';
                await new Promise(r => setTimeout(r, 300));
            }
        }

        const htmlContent = `
            <div style="font-family:'Kanit',sans-serif; text-align:left; font-size:0.9rem; line-height:1.7;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; border-bottom:1px solid rgba(0,0,0,0.08); padding-bottom:10px;">
                    <div style="font-size:2rem;">👩‍💼</div>
                    <div>
                        <div style="font-size:0.65rem; color:#aaa; font-weight:500;">ผู้ช่วยสอนการใช้งาน</div>
                        <div style="font-size:0.7rem; color:#6c5ce7; font-weight:600;">${stepNum}</div>
                    </div>
                </div>
                <div style="color: var(--text-color, #333);">${step.message}</div>
            </div>`;

        const result = await Swal.fire({
            title: step.title,
            html: htmlContent,
            showCancelButton: true,
            cancelButtonText: '⏩ ข้ามทัวร์นี้',
            confirmButtonText: isLast ? '✅ เริ่มใช้งานเลยค่ะ!' : 'ถัดไป ➡️',
            confirmButtonColor: '#6c5ce7',
            cancelButtonColor: '#b2bec3',
            width: '90%',
            background: 'var(--glass-bg, #fff)',
            backdrop: 'rgba(0,0,80,0.2)',
            allowOutsideClick: false,
            showClass: { popup: 'animate__animated animate__fadeInDown animate__faster' },
            hideClass: { popup: 'animate__animated animate__fadeOutUp animate__faster' }
        });

        // ลบ highlight
        if (targetEl) {
            targetEl.style.outline = '';
            targetEl.style.outlineOffset = '';
        }

        if (result.isConfirmed) {
            this.currentStep++;
            await this.showStep(this.currentStep);
        } else {
            // กด "ข้ามทัวร์นี้"
            localStorage.setItem(this.storageKey, 'true');
            this.ensureTab('record');
        }
    }
};

/**
 * เพิ่มปุ่ม ❓ ผู้ช่วยสอนการใช้งาน ไปที่ Header
 */
function injectGuideButton() {
    if (document.getElementById('guideTriggerBtn')) return; // ไม่สร้างซ้ำ

    const actionArea = document.querySelector('#header-user .col-4 .d-flex');
    if (!actionArea) return;

    const btn = document.createElement('button');
    btn.id = 'guideTriggerBtn';
    btn.className = 'btn btn-sm btn-light rounded-circle shadow-sm';
    btn.style.cssText = 'width:32px; height:32px; display:flex; align-items:center; justify-content:center; padding:0;';
    btn.title = 'พาทัวร์การใช้งาน';
    btn.innerHTML = '<i class="fas fa-question" style="font-size:0.8rem; color:#6c5ce7;"></i>';
    btn.onclick = () => GuideSystem.startTour(true);
    actionArea.appendChild(btn);
}
