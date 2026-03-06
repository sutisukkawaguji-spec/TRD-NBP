// ============================================================
// 🔐  auth.js — LIFF Authentication & User Management
//     ต้องโหลดหลัง config.js
// ============================================================

// --- โหลดรายชื่อผู้ใช้ทั้งหมดเข้า Cache ---
async function cacheUsers() {
    try {
        const res = await fetch(GAS_URL + '?action=get_users&t=' + Date.now());
        const data = await res.json();
        if (Array.isArray(data)) {
            data.forEach(u => { allUsersMap[u.lineId] = u; });
            console.log(`✅ Cached ${data.length} users`);
        }
    } catch (err) {
        console.error('❌ cacheUsers failed:', err);
        return Promise.resolve();
    }
}

// --- MAIN ENTRY POINT ---
async function main() {
    try {
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
    console.log('กำลังเชื่อมต่อระบบ...');
    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'check_user', userId })
    })
        .then(res => res.json())
        .then(data => {
            if (data.exists) {
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

                renderProfile();
                updateNavigationVisibility();



                if (typeof fetchAnnouncements === 'function') fetchAnnouncements();

                cacheUsers().then(() => {
                    fetchFeed();
                    fetchFriendsList();
                    // ถ้าอยู่ที่หน้าทำเนียบ ให้วาดใหม่ทันทีที่ข้อมูลมา
                    const relTab = document.getElementById('page-relation');
                    if (relTab && relTab.classList.contains('active')) {
                        if (typeof renderRelationTab === 'function') renderRelationTab();
                    }
                });

                // ตั้งค่า Dark Mode
                if (safeGetItem('theme') === 'dark') {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    const icon = document.querySelector('#darkModeToggle i');
                    if (icon) icon.className = 'fas fa-sun text-warning';
                }

                // โหลด Dashboard ถ้ามีสิทธิ์
                if (canViewDashboard()) fetchManagerData();

                // Sequential Dialogs
                async function showLifecycleDialogs(config) {
                    const APP_LOCAL_VERSION = '2.5.1';
                    const configVersion = config?.version || APP_LOCAL_VERSION;
                    const localVer = safeGetItem('appVersion');

                    if (localVer !== configVersion) {
                        const updateMsg = config?.message || `
                        <div class="text-start" style="font-size:0.9rem;line-height:1.7;">
                            <span class="badge bg-success mb-2">Version ${configVersion}</span><br>
                            ✅ <b>ความเสถียร:</b> แก้ไขข้อผิดพลาดต่างๆ<br>
                            ✅ <b>Badge แท็บ:</b> ระบบ Notification ปรับปรุงใหม่<br>
                            ✅ <b>Browser Login:</b> เปิดในบราวเซอร์ได้โดยไม่ loop
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
                    checkAndShowSurvey();
                }

                if (data.config) {
                    renderAnnouncement(data.config);
                    loadNotificationsFromConfig(data.config);
                    notifyFromConfig(data.config);
                }

                showLifecycleDialogs(data.config);
                updateAddAnnounceButton();
                requestNotificationPermission();

            } else {
                registerUser(userId, profile);
            }

            // Fade-out loading
            const loadingEl = document.getElementById('loading');
            loadingEl.classList.add('hiding');
            setTimeout(() => { loadingEl.style.display = 'none'; loadingEl.classList.remove('hiding'); }, 400);
        })
        .catch(err => {
            console.warn('Connection error:', err);
            if (!currentUser) {
                Swal.fire({ icon: 'info', title: 'ระบบกำลังเชื่อมต่อ...', text: 'กรุณารอครู่หนึ่ง', timer: 3000, showConfirmButton: false });
            }
            const loadingEl = document.getElementById('loading');
            loadingEl.classList.add('hiding');
            setTimeout(() => { loadingEl.style.display = 'none'; loadingEl.classList.remove('hiding'); }, 400);
        });
}

function registerUser(userId, profile) {
    fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'register_user', userId, userName: profile.displayName, userImg: profile.pictureUrl })
    }).then(() => checkUser(userId, profile));
}
