/**
 * 👩‍💼 Happy Meter Guide System
 * ระบบผู้ช่วยสอนการใช้งานแบบอิงตามสิทธิ์ผู้ใช้
 */

const GuideSystem = {
    storageKey: 'happymeter_guide_completed',
    currentStep: 0,
    steps: [],

    /**
     * เริ่มพาทัวร์ (Manual or Automatic)
     */
    async startTour(force = false) {
        if (!force && localStorage.getItem(this.storageKey)) return;

        // นำทางกลับไปหน้าหลักก่อนเริ่มทัวร์
        if (typeof switchTab === 'function') {
            const recordBtn = document.getElementById('nav-record-btn');
            if (recordBtn) switchTab('record', recordBtn);
        }

        this.steps = this.buildSteps();
        this.currentStep = 0;
        this.showStep(0);
    },

    /**
     * สร้างรายการขั้นตอนตามสิ่งที่ปรากฏบนหน้าจอจริง (Role-based)
     */
    buildSteps() {
        const steps = [
            {
                title: 'สวัสดีค่ะ ยินดีต้อนรับสู่ ดี มีสุข 🌸',
                message: 'ดิฉันเป็นผู้ช่วยที่จะพาทุกท่านทำความรู้จักกับฟีเจอร์ต่างๆ เพื่อสร้างองค์กรที่มีความสุขไปด้วยกันนะคะ',
                element: null
            },
            {
                title: 'บันทึกความรู้สึกรายวัน 📝',
                message: 'จุดเริ่มต้นของความสุขคือการรู้เท่าทันใจตนเองค่ะ อย่าลืมแวะมาบันทึกความรู้สึกและเรื่องราวดีๆ ในแต่ละวันตรงนี้นะคะ',
                element: '#page-record',
                onShow: () => this.ensureTab('record')
            },
            {
                title: 'นิยามและความหมาย 💡',
                message: 'หากไม่แน่ใจว่าเรื่องราวของคุณตรงกับหมวดความดีไหน สามารถกดดูนิยามกิจกรรมได้ที่ไอคอนเครื่องหมายคำถามนี้ค่ะ',
                element: 'i[onclick="showVirtueInfo()"]',
                onShow: () => this.ensureTab('record')
            },
            {
                title: 'คู่มือการใช้งาน 📖',
                message: 'ต้องการศึกษารายละเอียดเชิงลึก สามารถกดเข้าดูคู่มือการใช้งานฉบับเต็มได้ทุกเมื่อที่ปุ่มนี้ค่ะ',
                element: 'a[href*="guide.html"]',
                onShow: () => this.ensureTab('record')
            }
        ];

        // เพิ่ม Tab เรื่องราว
        if (this.isVisible('nav-stories-btn')) {
            steps.push({
                title: 'แลกเปลี่ยนเรื่องราวแจ่มใส ✨',
                message: 'มาติดตามและร่วมส่งต่อพลังบวกให้กับเพื่อนร่วมงานผ่านหน้าเรื่องราว (Feed) นี้นะคะ',
                element: '#nav-stories-btn',
                onShow: () => this.ensureTab('stories')
            });
        }

        // เพิ่ม Tab ความผูกพัน
        if (this.isVisible('nav-relation-btn')) {
            steps.push({
                title: 'ผังความผูกพันในองค์กร 🗺️',
                message: 'ดูภาพรวมความเชื่อมโยงและส่งความห่วงใยให้ถึงใจเพื่อนร่วมงานได้ผ่านแผนผังนี้นะคะ',
                element: '#nav-relation-btn',
                onShow: () => this.ensureTab('relation')
            });
        }

        // เพิ่ม Tab ผู้บริหาร (เฉพาะผู้มีสิทธิ์)
        if (this.isVisible('nav-manager-btn')) {
            steps.push({
                title: 'ข้อมูลเชิงลึกสำหรับผู้บริหาร 💼',
                message: 'พิเศษสำหรับคุณค่ะ! ส่วนนี้จะแสดงการวิเคราะห์แนวโน้มเครือข่ายความสุขและตัวชี้วัดสำคัญขององค์กรเพื่อใช้ส่งเสริมทีมงานค่ะ',
                element: '#nav-manager-btn',
                onShow: () => this.ensureTab('manager')
            });
        }

        steps.push({
            title: 'พร้อมเริ่มต้นแล้วค่ะ! ✨',
            message: 'หากลืมวิธีใช้งาน สามารถกดเรียกดิฉันได้เสมอที่ปุ่มเครื่องหมายคำถามด้านบนนะคะ ขอให้มีความสุขในทุกวันค่ะ',
            element: '#guideTriggerBtn'
        });

        return steps;
    },

    isVisible(id) {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none';
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
            return;
        }

        const step = this.steps[index];
        if (step.onShow) step.onShow();

        // หาพิกัดธาตุที่จะ Highlight (ถ้ามี)
        let htmlContent = `<div style="text-align:left; font-size:0.95rem; line-height:1.6; font-family:'Kanit',sans-serif;">
                            <div style="display:flex; align-items:center; gap:12px; margin-bottom:15px;">
                                <div style="font-size:2.5rem;">👩‍💼</div>
                                <div style="font-weight:bold; font-size:1.1rem; color:#6c5ce7;">ผู้ช่วยสอนการใช้งาน</div>
                            </div>
                            ${step.message}
                           </div>`;

        const isLast = index === this.steps.length - 1;

        // สั่งเลื่อนหน้าจอไปยัง Element นั้นๆ
        if (step.element) {
            const target = document.querySelector(step.element);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.style.outline = '3px solid #6c5ce7';
                target.style.outlineOffset = '4px';
                target.classList.add('animate__animated', 'animate__pulse');
            }
        }

        const result = await Swal.fire({
            title: step.title,
            html: htmlContent,
            icon: index === 0 ? 'info' : undefined,
            showCancelButton: true,
            cancelButtonText: 'ข้ามไปเลย',
            confirmButtonText: isLast ? 'เริ่มใช้งานโครงการ ✨' : 'ถัดไป',
            confirmButtonColor: '#6c5ce7',
            cancelButtonColor: '#aaa',
            width: '90%',
            background: 'var(--glass-bg)',
            backdrop: `rgba(0,0,80,0.15)`,
            allowOutsideClick: false
        });

        // ลบ highlight เดิม
        if (step.element) {
            const target = document.querySelector(step.element);
            if (target) {
                target.style.outline = '';
                target.classList.remove('animate__animated', 'animate__pulse');
            }
        }

        if (result.isConfirmed) {
            this.currentStep++;
            this.showStep(this.currentStep);
        } else {
            localStorage.setItem(this.storageKey, 'true');
        }
    }
};

// ติดตั้งปุ่ม Guide ไว้ใน UI
function injectGuideButton() {
    const headerActionArea = document.querySelector('#header-user .col-4 .d-flex');
    if (headerActionArea && !document.getElementById('guideTriggerBtn')) {
        const btn = document.createElement('button');
        btn.id = 'guideTriggerBtn';
        btn.className = 'btn btn-sm btn-light rounded-circle shadow-sm';
        btn.style.width = '32px';
        btn.style.height = '32px';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.title = 'พาทัวร์การใช้งาน';
        btn.innerHTML = '<i class="fas fa-question text-info" style="font-size: 0.8rem;"></i>';
        btn.onclick = () => GuideSystem.startTour(true);
        headerActionArea.appendChild(btn);
    }
}
