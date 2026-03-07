// ============================================================
// 🔐  auth.js — LIFF Authentication & User Management
//     ต้องโหลดหลัง config.js
// ============================================================

// --- โหลดรายชื่อผู้ใช้ทั้งหมดเข้า Cache ---
async function cacheUsers() {
    return new Promise((resolve) => {
        const handleData = (data) => {
            if (Array.isArray(data)) {
                data.forEach(u => { allUsersMap[u.lineId] = u; });
                console.log(`✅ Cached ${data.length} users`);
            }
            resolve();
        };

        fetch(GAS_URL + '?action=get_users&t=' + Date.now())
            .then(res => res.text())
            .then(text => {
                if (text.startsWith('<')) throw new Error("CORS / HTML block");
                handleData(JSON.parse(text));
            })
            .catch(err => {
                console.warn('❌ cacheUsers fetch failed, using JSONP...', err.message);
                window.__gasCacheCb = (data) => handleData(data);
                const old = document.getElementById('jsonp_cache');
                if (old) old.remove();

                const s = document.createElement('script');
                s.id = 'jsonp_cache';
                s.src = `${GAS_URL}?action=get_users&callback=__gasCacheCb&t=${Date.now()}`;
                document.head.appendChild(s);

                // Fallback resolve timer
                setTimeout(() => resolve(), 10000);
            });
    });
}

// --- MAIN ENTRY POINT ---
async function main() {
    try {
        // 🌟 1. เช็คเซสชัน: โหลดข้อมูลจากเครื่องมาโชว์ทันที (เข้าแอปไว ไม่ติดหน้าโหลด)
        const savedSession = getUserSession();
        if (savedSession) {
            console.log('🎉 พบเซสชันเดิม โหลดหน้าแอปทันที!');
            currentUser = savedSession;
            finishLoginProcess(); // โหลด UI ทันที

            // 🌟 2. อัปเดตข้อมูลเบื้องหลังแบบเงียบๆ (Background Sync) 
            // เพื่อดึงคะแนนล่าสุดและประกาศใหม่ๆ มาแสดงโดยไม่ให้หน้าเว็บค้าง
            fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'check_user', userId: currentUser.userId, img: currentUser.img })
            })
                .then(async res => {
                    const text = await res.text();
                    return JSON.parse(text);
                })
                .then(data => {
                    if (data.exists) {
                        // อัปเดตเฉพาะตัวเลขและสถานะที่อาจจะเปลี่ยนไป
                        currentUser.score = data.user.score || currentUser.score;
                        currentUser.level = data.user.level || currentUser.level;
                        currentUser.happyScore = parseFloat(data.user.happyScore) || parseFloat(data.user.happy) || currentUser.happyScore;
                        currentUser.virtueStats = data.user.virtueStats || currentUser.virtueStats;
                        currentUser.role = data.user.role || currentUser.role;

                        // เซฟทับข้อมูลเก่าในเครื่องให้เป็นปัจจุบัน
                        saveUserSession(currentUser);

                        // รีเฟรชหน้าโปรไฟล์ให้ตัวเลขคะแนนเด้งเป็นของใหม่
                        if (typeof renderProfile === 'function') renderProfile();

                        // อัปเดตประกาศและการแจ้งเตือนล่าสุด
                        if (data.config) {
                            if (typeof renderAnnouncement === 'function') renderAnnouncement(data.config);
                            if (typeof loadNotificationsFromConfig === 'function') loadNotificationsFromConfig(data.config);
                            if (typeof notifyFromConfig === 'function') notifyFromConfig(data.config);
                        }
                        console.log('🔄 อัปเดตข้อมูลเบื้องหลังเสร็จสมบูรณ์');
                    }
                }).catch(e => console.log('Background sync failed:', e));

            return; // จบการทำงาน ไม่ต้องไปโหลด LIFF ต่อให้เสียเวลา
        }

        // --- 🌟 3. ถ้าไม่มีเซสชันในเครื่อง ค่อยเริ่มกระบวนการล็อกอิน LIFF ตามปกติ ---
        await liff.init({ liffId: LIFF_ID });

        // ตรวจสอบสถานะการล็อกอิน
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            safeSetItem('liff_userId', profile.userId);
            safeSetItem('liff_displayName', profile.displayName);
            safeSetItem('liff_pictureUrl', profile.pictureUrl || '');
            await checkUser(profile.userId, profile);
            return;
        }

        // กรณีอยู่ในแอป LINE (LINE Client) ให้พาไปล็อกอินอัตโนมัติ
        if (liff.isInClient()) {
            liff.login();
            return;
        }

        // --- กรณีเปิดผ่านบราวเซอร์ภายนอก (External Browser) ---

        // 1. เช็คว่ามี Query Params ที่เป็น callback จาก LIFF หรือไม่ (แก้ปัญหา Loop)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('code') || urlParams.has('state')) {
            console.log('🔄 ถอดรหัส LIFF Token...');
            setTimeout(() => {
                if (liff.isLoggedIn()) {
                    window.location.replace(window.location.pathname); // ทิ้ง params แล้วโหลดใหม่
                } else {
                    document.getElementById('loading').innerHTML = `
                        <div class="text-center p-4">
                            <h5 class="text-warning fw-bold">⚠️ เข้าสู่ระบบไม่สำเร็จ</h5>
                            <p class="small text-muted">บราวเซอร์ของคุณอาจจะ<b>บล็อกคุกกี้ (Third-party Cookies)</b> ทำให้ล็อกอินผ่านหน้าเว็บไม่ได้<br><br>แนะนำให้เปิดลิงก์ผ่านแอป <b>LINE</b> โดยตรงครับ</p>
                        </div>
                    `;
                }
            }, 2500);
            return;
        }

        // 2. ถ้าไม่มี session ใน LIFF แต่เคยล็อกอินแล้วและมี Cached ID
        const cachedId = safeGetItem('liff_userId');
        if (cachedId) {
            const cachedName = safeGetItem('liff_displayName');
            const cachedImg = safeGetItem('liff_pictureUrl');
            await checkUser(cachedId, { userId: cachedId, displayName: cachedName || 'ผู้ใช้งาน', pictureUrl: cachedImg || '' });
            return;
        }

        // 3. ถ้าไม่มี session เลย -> แสดงหน้าจอ Login (เก่งดี)
        document.getElementById('loading').innerHTML = `
            <div class="text-center p-4 login-card" style="max-width:380px; background:var(--glass-bg); border-radius:30px; border:1px solid var(--border-color); box-shadow:0 15px 35px rgba(0,0,0,0.1);">
                <div class="mb-4">
                    <img src="app-icon.png" style="width:100px;height:100px;border-radius:24px;box-shadow:0 10px 25px rgba(108,92,231,0.2);margin-bottom:20px;" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3536/3536505.png'">
                    <h3 class="fw-bold mb-1" style="color:var(--primary-color);">เก่งดี</h3>
                    <p class="text-muted small">บันทึกความสุขและสะสมความดีเพื่อทีม</p>
                </div>
                
                <div class="p-3 bg-light rounded-4 mb-4 border-dashed" style="border: 2px dashed #ddd;">
                    <i class="fas fa-info-circle text-primary mb-2"></i>
                    <p class="small text-muted mb-0">เปิดผ่าน LINE ในครั้งแรกเพื่อผูกบัญชี<br>ครั้งต่อไปจะเข้าใช้งานได้ทันที</p>
                </div>

                <button onclick="doLineLogin()" class="btn btn-success btn-lg rounded-pill px-5 fw-bold w-100 mb-3 shadow-lg" style="background:#06C755; border:none; height:55px;">
                    <i class="fab fa-line me-2"></i>เข้าสู่ระบบด้วย LINE
                </button>
                
                <div class="mt-2">
                    <a href="https://liff.line.me/${LIFF_ID}" class="text-decoration-none small fw-bold" style="color:#06C755;">
                        <i class="fas fa-external-link-alt me-1"></i>เปิดในแอป LINE
                    </a>
                </div>
            </div>`;

    } catch (err) {
        console.error('LIFF init error:', err);

        // Fallback: ถ้ามี cache ยังเข้าได้
        const cachedId = safeGetItem('liff_userId');
        const cachedName = safeGetItem('liff_displayName');
        const cachedImg = safeGetItem('liff_pictureUrl');

        if (cachedId) {
            await checkUser(cachedId, { userId: cachedId, displayName: cachedName || 'ผู้ใช้งาน', pictureUrl: cachedImg || '' });
            return;
        }

        const liffUrl = `https://liff.line.me/${LIFF_ID}`;
        document.getElementById('loading').innerHTML = `
            <div class="text-center p-4" style="max-width:360px;">
                <div style="font-size:3rem;">⚠️</div>
                <h6 class="mt-3 mb-2 fw-bold text-warning">เชื่อมต่อ LINE ไม่สำเร็จ</h6>
                <p class="text-muted small mb-3">ตรวจสอบอินเตอร์เน็ต หรือเปิดผ่านแอป LINE</p>
                <button onclick="location.reload()" class="btn btn-outline-primary rounded-pill px-4 mb-2 w-100">
                    <i class="fas fa-sync me-1"></i>ลองใหม่อีกครั้ง
                </button>
                <a href="${liffUrl}" class="btn btn-success rounded-pill px-4 w-100">
                    <i class="fab fa-line me-2"></i>เปิดผ่าน LINE
                </a>
                <div class="mt-3" style="font-size:0.65rem;color:#999;"><b>Debug:</b> ${err.message || err}</div>
            </div>`;
    }
}

// LINE Login handler
function doLineLogin() {
    try {
        // บันทึก URL ปัจจุบันไว้เพื่อให้ redirect กลับมาที่เดิมได้แม่นยำขึ้น
        const currentUrl = window.location.href;
        liff.login({ redirectUri: currentUrl });
    } catch (e) {
        console.error('LIFF Login failed:', e);
        Swal.fire({
            icon: 'error',
            title: 'เข้าสู่ระบบไม่สำเร็จ',
            text: 'กรุณาลองเปิดผ่านแอป LINE โดยตรง หรือตรวจสอบการตั้งค่าคุกกี้ในบราวเซอร์',
            confirmButtonText: 'ตกลง'
        });
    }
}

// --- ตรวจสอบและลงทะเบียนผู้ใช้ ---
function checkUser(userId, profile) {
    console.log('🔍 กำลังตรวจสอบการเชื่อมต่อกับ:', GAS_URL);
    // ทดสอบการเข้าถึง Backend เบื้องต้น
    fetch(GAS_URL + '?action=get_users&limit=1')
        .then(r => console.log('✅ Backend Reachable:', r.ok))
        .catch(e => console.error('❌ Backend Unreachable:', e));

    console.log('กำลังเชื่อมต่อระบบ...');
    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'check_user',
            userId,
            img: profile ? profile.pictureUrl : (window.currentUser ? window.currentUser.img : ''),
            name: profile ? profile.displayName : ''
        })
    })
        .then(async res => {
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Invalid JSON Response:', text);
                throw new Error(text.substring(0, 100) || 'Server returned invalid data format');
            }
        })
        .then(data => {
            if (data.exists) {
                // 1. เก็บข้อมูลผู้ใช้
                currentUser = {
                    userId,
                    name: data.user.name || profile.displayName,
                    img: data.user.img || profile.pictureUrl,
                    role: data.user.role || 'Staff',
                    level: data.user.level || 1,
                    score: data.user.score || 0,
                    happyScore: parseFloat(data.user.happyScore) || parseFloat(data.user.happy) || 0,
                    virtueStats: data.user.virtueStats || {},
                    totalCount: data.user.totalCount || 0,
                    topFriends: data.user.topFriends || [],
                    dominantVirtue: data.user.dominantVirtue || 'none'
                };

                // 🌟 2. เซฟผู้ใช้ลงเซสชัน
                saveUserSession(currentUser);

                // 3. เรียกฟังก์ชันรันหน้าจอแอป
                finishLoginProcess(data.config);

            } else {
                // 4. ถ้าไม่มีข้อมูล ให้ลงทะเบียน
                registerUser(userId, profile);
            }

            // 5. สั่งซ่อนหน้าจอ Loading (เก็บไว้ตรงนี้ที่เดียวพอ จะได้ไม่ซ้ำ)
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.classList.add('hiding');
                setTimeout(() => { loadingEl.style.display = 'none'; loadingEl.classList.remove('hiding'); }, 400);
            }
        })
        .catch(err => {
            console.error('❌ CheckUser Failure:', err);
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.classList.add('hiding');
                setTimeout(() => { loadingEl.style.display = 'none'; loadingEl.classList.remove('hiding'); }, 400);
            }

            Swal.fire({
                icon: 'error',
                title: 'เชื่อมต่อหลังบ้านไม่ได้',
                html: `<b>สาเหตุ:</b> ${err.message}<br><br><small style="font-size:0.65rem; word-break:break-all; color:#888;"><b>Target URL:</b><br>${GAS_URL}</small>`,
                footer: '<div class="text-center"><a href="#" onclick="location.reload()" class="btn btn-sm btn-primary rounded-pill px-3">ลองโหลดหน้าใหม่</a></div>'
            });
        });
}

function registerUser(userId, profile) {
    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'register_user', userId, userName: profile.displayName, userImg: profile.pictureUrl })
    }).then(() => checkUser(userId, profile))
        .catch(err => Swal.fire('Error', 'ลงทะเบียนไม่สำเร็จ: ' + err.message, 'error'));
}

// ==========================================
// 🔐 ระบบจัดการ Session (Local Storage)
// ==========================================
function saveUserSession(userData) {
    localStorage.setItem('app_user_session', JSON.stringify(userData));
    console.log('✅ บันทึกเซสชันผู้ใช้เต็มรูปแบบลงเครื่องแล้ว');
}

function getUserSession() {
    const sessionStr = localStorage.getItem('app_user_session');
    if (!sessionStr) return null;
    try { return JSON.parse(sessionStr); }
    catch (e) { clearUserSession(); return null; }
}

function clearUserSession() {
    localStorage.removeItem('app_user_session');
    // เคลียร์ค่าของเก่าด้วยเผื่อเหลือซาก
    localStorage.removeItem('liff_userId');
    localStorage.removeItem('liff_displayName');
    localStorage.removeItem('liff_pictureUrl');
    console.log('🗑️ ล้างเซสชันออกจากระบบเรียบร้อย');
}

// --- ฟังก์ชันจัดเตรียมหน้าจอ (แยกออกมาเพื่อให้โค้ดอ่านง่าย) ---
function finishLoginProcess(configData = null) {
    if (typeof renderProfile === 'function') renderProfile();
    if (typeof updateNavigationVisibility === 'function') updateNavigationVisibility();
    if (typeof fetchAnnouncements === 'function') fetchAnnouncements();

    cacheUsers().then(() => {
        if (typeof fetchFeed === 'function') fetchFeed();
        if (typeof fetchFriendsList === 'function') fetchFriendsList();

        const relTab = document.getElementById('page-relation');
        if (relTab && relTab.classList.contains('active')) {
            if (typeof renderRelationTab === 'function') renderRelationTab();
        }
    });

    if (safeGetItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        const icon = document.querySelector('#darkModeToggle i');
        if (icon) icon.className = 'fas fa-sun text-warning';
    }

    if (typeof canViewDashboard === 'function' && canViewDashboard()) {
        if (typeof fetchManagerData === 'function') fetchManagerData();
    }

    // จัดการระบบแจ้งเตือนต่างๆ 
    if (configData) {
        if (typeof renderAnnouncement === 'function') renderAnnouncement(configData);
        if (typeof loadNotificationsFromConfig === 'function') loadNotificationsFromConfig(configData);
        if (typeof notifyFromConfig === 'function') notifyFromConfig(configData);
        showLifecycleDialogs(configData);
    } else {
        showLifecycleDialogs({});
    }

    if (typeof updateAddAnnounceButton === 'function') updateAddAnnounceButton();
    if (typeof requestNotificationPermission === 'function') requestNotificationPermission();

    // 🌟 ก๊อปปี้โค้ดชุดนี้ไปวางตรงนี้เลยครับ (ก่อนปิดปีกกาฟังก์ชัน) 🌟
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.classList.add('hiding');
        setTimeout(() => {
            loadingEl.style.display = 'none';
            loadingEl.classList.remove('hiding');
        }, 400);
    }
}

async function showLifecycleDialogs(config) {
    const APP_LOCAL_VERSION = '2.5.1';
    const configVersion = config?.version || APP_LOCAL_VERSION;
    const localVer = safeGetItem('appVersion');

    if (localVer !== configVersion) {
        const updateMsg = config?.message || `
        <div class="text-start" style="font-size:0.9rem;line-height:1.7;">
            <span class="badge bg-success mb-2">Version ${configVersion}</span><br>
            ✅ <b>ความเสถียร:</b> แก้ไขข้อผิดพลาดต่างๆ<br>
            ✅ <b>Badge แท็บ:</b> ระบบ Notification ปรับปรุงใหม่
        </div>`;
        await Swal.fire({
            title: config?.title || '🆕 อัปเดตระบบใหม่!',
            html: updateMsg, icon: 'info',
            confirmButtonText: '👍 รับทราบ!',
            confirmButtonColor: '#6c5ce7',
            allowOutsideClick: false
        });
        safeSetItem('appVersion', configVersion);
    }
    if (typeof checkAndShowSurvey === 'function') checkAndShowSurvey();
}