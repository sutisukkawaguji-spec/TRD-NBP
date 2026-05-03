/**
 * 👩‍💼 Happy Meter Guide System v4
 * Spotlight: SVG overlay with cutout — Tooltip ลอยไม่บัง ปุ่มกดได้แน่นอน
 */

const GuideSystem = {
    storageKey: 'happymeter_guide_v1',
    _tip: null,
    _svgOverlay: null,
    _currentSpotlightEl: null,

    async startTour(force = false) {
        if (!force && localStorage.getItem(this.storageKey)) return;
        this._buildUI();
        const steps = this.buildSteps();

        let i = 0;
        while (i < steps.length) {
            const result = await this._runStep(steps[i], i, steps.length);
            if (result === 'next') i++;
            else if (result === 'prev') i = Math.max(0, i - 1);
            else { // 'skip'
                break;
            }
        }
        this._destroy();
        localStorage.setItem(this.storageKey, 'true');
    },

    buildSteps() {
        const steps = [
            { title: '👩‍💼 ยินดีต้อนรับค่ะ', msg: 'ขอพาทัวร์ฟีเจอร์หลักๆ ของ <b>Happy Meter</b> เวอร์ชันใหม่นะคะ โดยจะไล่ไปตามเมนูหลักด้านล่างค่ะ', el: null, tab: null },
        ];

        // 1. 📝 Tab: บันทึก (Record)
        if (this._navVisible('nav-record-btn')) {
            steps.push({ 
                title: '📝 ลงบันทึกความดี', 
                msg: 'เริ่มต้นวันดีๆ ด้วยการบันทึกเรื่องราวความสุข เลือกหมวดหมู่ความดี และกดบันทึกที่นี่ค่ะ', 
                el: '#noteInput', 
                tab: 'record' 
            });
        }

        // 2. 📢 Tab: เรื่องราว (Stories)
        if (this._navVisible('nav-stories-btn')) {
            steps.push({ 
                title: '📢 เรื่องราวของเพื่อน', 
                msg: 'ติดตามกิจกรรมของเพื่อนๆ และร่วมเป็นพยาน (Verify) เพื่อช่วยกันสะสมคะแนนความดีทั้งทีมค่ะ', 
                el: '#nav-stories-btn', 
                tab: 'stories' 
            });
        }

        // 3. 📊 Tab: สถิติ (Stats)
        if (this._navVisible('nav-stats-btn')) {
            steps.push({ 
                title: '📊 สมดุลความดี', 
                msg: 'ตรวจสอบกราฟใยแมงมุม (Radar Chart) เพื่อดูว่าเราเด่นหรือควรเติมความดีในหมวดไหนบ้าง', 
                el: '#userRadarChart', 
                tab: 'stats' 
            });
        }

        // 4. 🏅 Tab: เหรียญ (Badges)
        if (this._navVisible('nav-badges-btn')) {
            steps.push({ 
                title: '🏅 คลังเหรียญสะสม', 
                msg: 'ยิ่งทำดีบ่อย ยิ่งได้รับเหรียญตราเกียรติยศเพิ่มขึ้น สะสมให้ครบทุกเลเวลนะคะ', 
                el: '#badgeContainer', 
                tab: 'badges' 
            });
        }

        // 5. 👥 Tab: ความผูกพัน (Relation)
        if (this._navVisible('nav-relation-btn')) {
            steps.push({ 
                title: '👥 สายสัมพันธ์องค์กร', 
                msg: 'ดูประวัติรายบุคคลและเช็คความผูกพันภายในทีมว่าใครคือ Best Partner ของเรา', 
                el: '#nav-relation-btn', 
                tab: 'relation' 
            });
        }

        // 6. 📈 Tab: ผู้บริหาร (Manager)
        if (this._navVisible('nav-manager-btn')) {
            steps.push({ 
                title: '📈 ดัชนีโมเมนตัม', 
                msg: 'สำหรับผู้บริหาร: ติดตามดัชนีภาพรวมความสุขและสุขภาพใจของทั้งองค์กรได้ที่นี่ค่ะ', 
                el: '#managerLineChart', 
                tab: 'manager' 
            });
        }

        // 7. ⚙️ Settings / Others
        steps.push({ 
            title: '⚙️ ตั้งค่าเพิ่มเติม', 
            msg: 'อย่าลืมเลือกใช้ <b>โหมดกลางคืน (Dark Mode)</b> และเช็ค <b>สภาพอากาศ</b> ได้ที่มุมบนนะคะ', 
            el: '#darkModeToggle', 
            tab: 'record' 
        });

        steps.push({ 
            title: '🎉 พร้อมใช้งานแล้วค่ะ!', 
            msg: 'กดปุ่ม <b>"ทัวร์ใช้งาน"</b> เพื่อดูทัวร์ซ้ำได้ทุกเมื่อ หรือกด <b>"คู่มือ"</b> เพื่ออ่านรายละเอียดทั้งหมดนะคะ 🌸', 
            el: 'button[onclick*="startTour"]', 
            tab: 'record' 
        });

        return steps;
    },

    _navVisible(id) {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none';
    },

    _buildUI() {
        this._destroy(); // ล้างของเก่าก่อน

        // SVG Overlay (วาด "รู" รอบ element ที่ต้องการโฟกัส)
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'guideSvg';
        svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9000;pointer-events:none;transition:opacity 0.3s;';
        // path รูปสี่เหลี่ยมทั้งหน้า (เริ่มต้นมืดหมด ยังไม่มีรู)
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.id = 'guideSvgPath';
        path.setAttribute('fill', 'rgba(0,0,20,0.78)');
        path.setAttribute('fill-rule', 'evenodd');
        svg.appendChild(path);
        document.body.appendChild(svg);
        this._svgOverlay = svg;

        // Tooltip card — fixed position, สูง z-index, pointer-events:auto
        const tip = document.createElement('div');
        tip.id = 'guideTip';
        tip.style.cssText = `
            position:fixed; z-index:10001; pointer-events:auto;
            max-width:270px; min-width:210px;
            background:var(--glass-bg, #fff); border-radius:14px;
            padding:14px 16px 12px;
            box-shadow:0 8px 32px rgba(0,0,0,0.3);
            font-family:'Kanit',sans-serif;
            color:var(--text-color, #333);
            display:none; opacity:0;
            transition:opacity 0.2s;
        `;
        document.body.appendChild(tip);
        this._tip = tip;
    },

    _destroy() {
        document.getElementById('guideSvg')?.remove();
        document.getElementById('guideTip')?.remove();
        this._svgOverlay = null;
        this._tip = null;
        this._currentSpotlightEl = null;
    },

    // อัปเดต SVG path ให้เว้น "รู" รอบ element ที่เลือก
    _updateSpotlight(el) {
        const path = document.getElementById('guideSvgPath');
        if (!path) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (!el) {
            // มืดทั้งหน้า ไม่มีรู
            path.setAttribute('d', `M0,0 H${vw} V${vh} H0 Z`);
            return;
        }

        const r = el.getBoundingClientRect();
        const pad = 8; // padding รอบ element
        const x = Math.max(0, r.left - pad);
        const y = Math.max(0, r.top - pad);
        const w = Math.min(vw, r.right + pad) - x;
        const h = Math.min(vh, r.bottom + pad) - y;
        const rx = 10; // corner radius

        // "รู" สี่เหลี่ยมมุมโค้ง ตรงกลาง SVG มืด
        path.setAttribute('d',
            `M0,0 H${vw} V${vh} H0 Z ` +
            `M${x+rx},${y} H${x+w-rx} Q${x+w},${y} ${x+w},${y+rx} ` +
            `V${y+h-rx} Q${x+w},${y+h} ${x+w-rx},${y+h} ` +
            `H${x+rx} Q${x},${y+h} ${x},${y+h-rx} ` +
            `V${y+rx} Q${x},${y} ${x+rx},${y} Z`
        );
        this._currentSpotlightEl = el;
    },

    // วาง Tooltip ไม่บัง element
    _positionTip(el) {
        const tip = this._tip;
        tip.style.display = 'block';
        // รอให้ browser layout tip ก่อน
        void tip.offsetHeight;

        const margin = 12;
        const tipW = tip.offsetWidth || 250;
        const tipH = tip.offsetHeight || 120;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top, left;

        if (!el) {
            top = (vh - tipH) / 2;
            left = (vw - tipW) / 2;
        } else {
            const r = el.getBoundingClientRect();
            const elMidY = r.top + r.height / 2;
            top = elMidY < vh * 0.5
                ? r.bottom + margin           // element บน → tip ล่าง
                : r.top - tipH - margin;       // element ล่าง → tip บน
            top = Math.max(margin, Math.min(vh - tipH - margin, top));
            left = r.left + r.width / 2 - tipW / 2;
            left = Math.max(margin, Math.min(vw - tipW - margin, left));
        }

        tip.style.top = top + 'px';
        tip.style.left = left + 'px';
        tip.style.opacity = '1';
    },

    _runStep(step, index, total) {
        return new Promise(async (resolve) => {
            // reset opacity ก่อน
            if (this._tip) { this._tip.style.opacity = '0'; this._tip.style.display = 'none'; }

            // สลับแท็บ
            if (step.tab) {
                const navBtn = document.getElementById(`nav-${step.tab}-btn`);
                if (navBtn && typeof switchTab === 'function') switchTab(step.tab, navBtn);
                await new Promise(r => setTimeout(r, 350));
            }

            // หา element และ scroll
            let targetEl = null;
            if (step.el) {
                targetEl = document.querySelector(step.el);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await new Promise(r => setTimeout(r, 450));
                }
            }

            // วาด spotlight
            this._updateSpotlight(targetEl);

            // สร้าง HTML tooltip
            const isFirst = index === 0;
            const isLast = index === total - 1;
            const tip = this._tip;

            tip.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span style="font-size:1.5rem;">👩‍💼</span>
                    <div>
                        <div style="font-size:0.78rem;font-weight:700;color:var(--primary);">${step.title}</div>
                        <div style="font-size:0.62rem;color:#bbb;">${index + 1} / ${total}</div>
                    </div>
                </div>
                <div style="font-size:0.8rem;color:var(--text-color);line-height:1.6;margin-bottom:12px;">${step.msg}</div>
                <div style="display:flex;gap:6px;justify-content:flex-end;align-items:center;">
                    <button data-action="skip" style="font-size:0.7rem;padding:4px 10px;border:1px solid #ddd;background:transparent;border-radius:20px;cursor:pointer;color:#aaa;">ข้าม</button>
                    ${!isFirst ? '<button data-action="prev" style="font-size:0.7rem;padding:4px 10px;border:1px solid #ddd;background:transparent;border-radius:20px;cursor:pointer;color:#666;">◀ ย้อน</button>' : ''}
                    <button data-action="next" style="font-size:0.72rem;padding:5px 14px;border:none;background:var(--primary);color:#fff;border-radius:20px;cursor:pointer;font-weight:700;">
                        ${isLast ? '✅ เสร็จ' : 'ถัดไป ▶'}
                    </button>
                </div>`;

            // วาง tooltip
            this._positionTip(targetEl);

            // ใช้ event delegation บน tip
            const handler = (e) => {
                const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
                if (!action) return;
                tip.removeEventListener('click', handler);
                resolve(action === 'next' ? 'next' : action === 'prev' ? 'prev' : 'skip');
            };
            tip.addEventListener('click', handler);
        });
    }
};


