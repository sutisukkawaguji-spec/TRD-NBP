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
        // 🌟 1. เช็คเซสชัน (Persistent Storage)
        // โหลดข้อมูลจากเครื่องมาโชว์ทันที เพื่อให้เข้าแอปได้รวดเร็ว (Happy UX)
        let savedSession = getUserSession();
        
        // ถ้าไม่มี Full Session ลองเช็ค Backup ID (เผื่อ Session เคลียร์แต่ LIFF ID ยังอยู่)
        if (!savedSession) {
            const backupId = safeGetItem('liff_userId');
            if (backupId) {
                console.log('💡 พบ Backup ID ลองฟื้นฟูเซสชัน...');
                savedSession = {
                    userId: backupId,
                    name: safeGetItem('liff_displayName') || 'User',
                    img: safeGetItem('liff_pictureUrl') || ''
                };
            }
        }

        if (savedSession) {
            console.log('🎉 พบเซสชันเดิม เข้าสู่ระบบทันที!');
            currentUser = savedSession;
            finishLoginProcess(); // โหลด UI ทันทีไม่ต้องรอ

            // รัน LIFF.init เงียบๆ ในพื้นหลัง
            liff.init({ liffId: LIFF_ID }).then(() => {
                // ถ้าใน LIFF มีการล็อกอินใหม่ (เช่น เปลี่ยนเครื่อง/เปลี่ยน ID) ให้ซิงค์ใหม่
                if (liff.isLoggedIn()) {
                    liff.getProfile().then(p => {
                        if (p.userId !== currentUser.userId) {
                            console.log('🔄 พบการเปลี่ยนผู้ใช้ใน LINE, กำลังรีโหลดสิทธิ์...');
                            checkUser(p.userId, p);
                        }
                    });
                }
            }).catch(e => console.log('Silent LIFF init failed:', e));

            // อัปเดตข้อมูลเบื้องหลัง (Background Sync) 
            fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'check_user', userId: currentUser.userId, img: currentUser.img })
            })
                .then(async res => JSON.parse(await res.text()))
                .then(async data => {
                    if (data.exists) {
                        currentUser = { ...currentUser, ...data.user, userId: currentUser.userId };
                        saveUserSession(currentUser);
                        if (typeof renderProfile === 'function') renderProfile();
                        // ❌ ลบ showLifecycleDialogs ออกจากนี้ — เพราะ finishLoginProcess จัดการแล้ว
                        // การเรียกซ้ำที่นี่ทำให้ Weather + Guide เด้งพร้อมกัน (Race Condition)
                        console.log('🔄 อัปเดตข้อมูลเบื้องหลังเสร็จสมบูรณ์');
                    }
                }).catch(e => console.log('Background sync failed:', e));

            return; // จบการทำงานสำหรับผู้มีเซสชัน
        }

        // --- 🌟 2. ถ้าไม่มีเซสชันเลย ค่อยเริ่มกระบวนการล็อกอิน LIFF ---
        await liff.init({ liffId: LIFF_ID });

        // ลบ Query String (code, state) เพื่อความสะอาด
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('code') || urlParams.has('state') || urlParams.has('liff.state')) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // กรณี Logged In แล้ว (อาจจะเพิ่งกลับมาจาก Redirect)
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            // เก็บ Backup ไว้กันพลาด
            safeSetItem('liff_userId', profile.userId);
            safeSetItem('liff_displayName', profile.displayName);
            safeSetItem('liff_pictureUrl', profile.pictureUrl || '');

            await checkUser(profile.userId, profile);
            return;
        }

        // --- 🌟 3. กรณีไม่ได้ล็อกอิน (No Session & No LIFF Login) ---

        // 🔧 [แก้ไข]: ถ้าเปิดในแอป LINE ให้ล้อกอินอัตโนมัติทันที ไม่ต้องถาม
        if (liff.isInClient()) {
            console.log('🚀 กำลังล็อกอินอัตโนมัติภายใน LINE...');
            doLineLogin();
            return;
        }

        // --- กรณีเปิดผ่านบราวเซอร์ภายนอก (External Browser) แสดงหน้า Login Selection ---
        document.getElementById('loading').innerHTML = `
            <div class="login-page-wrapper animate__animated animate__fadeIn" style="position:fixed; top:0; left:0; width:100%; height:100%; background:#ffffff; display:flex; align-items:center; justify-content:center; z-index:10001; font-family:'Kanit', sans-serif;">
                <div class="login-card-line" style="width:90%; max-width:380px; text-align:center;">
                    <div class="mb-5">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" style="width:80px; height:80px; margin-bottom:20px;">
                        <h4 class="fw-bold" style="color:#000;">เข้าสู่ระบบ ดี มีสุข</h4>
                        <p class="text-muted small">ระบบ "ดี มีสุข" จะเชื่อมต่อข้อมูลผ่านบัญชี LINE ของคุณ</p>
                    </div>

                    <div class="mb-4">
                        <button onclick="doLineLogin()" class="btn w-100 mb-3 d-flex align-items-center justify-content-center" style="background:#06C755; color:#fff; height:54px; border-radius:4px; font-weight:600; border:none; font-size:1.05rem;">
                             เข้าสู่ระบบด้วย LINE
                        </button>
                    </div>

                    <div class="d-flex align-items-center my-4">
                        <hr class="flex-grow-1" style="opacity:0.1;">
                        <span class="mx-3 text-muted" style="font-size:0.7rem; font-weight:bold;">หรือเข้าใช้งานด้วย</span>
                        <hr class="flex-grow-1" style="opacity:0.1;">
                    </div>

                    <!-- Staff ID Secondary Option -->
                    <div class="mb-3">
                         <div class="input-group mb-2" style="height:48px;">
                            <input type="text" id="staffIdInput" class="form-control text-center" style="border-radius:4px; border:1px solid #ddd; background:#f9f9f9;" placeholder="รหัสพนักงาน หรือ User ID">
                        </div>
                        <button onclick="doStaffLogin()" class="btn btn-outline-secondary w-100 small" style="height:40px; border-radius:4px; font-size:0.85rem; border:1px solid #ddd; color:#666;">
                            ตกลง
                        </button>
                    </div>

                    <div class="mt-5 pt-4" style="border-top:1px solid #f0f0f0;">
                        <p class="text-muted mb-0" style="font-size:0.7rem;">
                            การเข้าสู่ระบบ แสดงว่าคุณยอมรับ <a href="#" class="text-decoration-none" style="color:#000; font-weight:bold;">ข้อกำหนดการใช้งาน</a> <br>
                            และ <a href="#" class="text-decoration-none" style="color:#000; font-weight:bold;">นโยบายความเป็นส่วนตัว</a>
                        </p>
                    </div>
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

// Staff ID Login handler
function doStaffLogin() {
    const id = document.getElementById('staffIdInput').value.trim();
    if (!id) {
        Swal.fire('กรุณากรอกรหัส', 'โปรดระบุรหัสพนักงานหรือ ID ของคุณ', 'warning');
        return;
    }

    // แสดง Loading
    Swal.fire({
        title: 'กำลังตรวจสอบรหัส...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    // ตรวจสอบกับเซิร์ฟเวอร์
    checkUser(id, null);
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
    // 🌟 1. กรณีเรียกแบบสั้น (เช่น checkUser()) ให้ใช้ข้อมูลจาก currentUser
    const targetUserId = userId || (window.currentUser ? window.currentUser.userId : null);
    if (!targetUserId) {
        console.warn('checkUser: No userId provided and no currentUser found.');
        return;
    }

    console.log('🔍 กำลังตรวจสอบการเชื่อมต่อกับ:', GAS_URL);

    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'check_user',
            userId: targetUserId,
            img: profile ? profile.pictureUrl : (window.currentUser ? window.currentUser.img : ''),
            name: profile ? profile.displayName : (window.currentUser ? window.currentUser.name : '')
        })
    })
        .then(async res => {
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Invalid JSON Response:', text);
                throw new Error(text.substring(0, 50) || 'Server returned invalid data format');
            }
        })
        .then(data => {
            if (data.exists) {
                // 1. เก็บข้อมูลผู้ใช้ (รวมข้อมูลจาก Backend และ Profile/Cache)
                const finalName = data.user.name || (profile ? profile.displayName : (window.currentUser ? window.currentUser.name : 'Unknown'));
                const finalImg = data.user.img || (profile ? profile.pictureUrl : (window.currentUser ? window.currentUser.img : ''));

                currentUser = {
                    userId: targetUserId,
                    name: finalName,
                    img: finalImg,
                    role: data.user.role || 'Guest',
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
                // 4. ถ้าไม่มีข้อมูล และมี Profile ใหม่ ให้ลงทะเบียน
                if (profile) registerUser(targetUserId, profile);
                else {
                    console.error('❌ User not found and no profile provided to register.');
                    // Show a helpful error for the user
                    Swal.fire('ไม่พบข้อมูล', 'ไม่พบบัญชีผู้ใช้งานในระบบ และไม่ได้รับข้อมูลจาก LINE เพื่อลงทะเบียนใหม่ กรุณาลองล็อกอินผ่านแอป LINE อีกครั้งครับ', 'error');
                }
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
async function finishLoginProcess(configData = null) {
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
    }
    // ✅ ซ่อน Loading Screen ก่อน — แล้วค่อยแสดง Popup ต่างๆ ทีหลัง
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.classList.add('hiding');
        setTimeout(() => {
            loadingEl.style.display = 'none';
            loadingEl.classList.remove('hiding');
        }, 400);
    }

    // รอให้ Fade เสร็จก่อนแสดง Popup
    await new Promise(r => setTimeout(r, 500));

    // 🌟 เรียก Lifecycle Dialogs เสมอ (Survey, Weather, Guide)
    await showLifecycleDialogs(configData || {});

    if (typeof updateAddAnnounceButton === 'function') updateAddAnnounceButton();
}

async function showLifecycleDialogs(config) {
    if (config && config.version) {
        const configVersion = config.version;
        const localVer = safeGetItem('appVersion');

        // 🌟 แก้ไข: ถ้า Version ตรงกันแล้ว ไม่ต้องเด้งซ้ำ (ป้องกันการเด้งทุกครั้งที่เปิดแอป)
        if (localVer !== configVersion) {
            let updateTitle = config?.title || '🆕 อัปเดตระบบใหม่!';
            let updateMsg = config?.message;

            // 🔔 นำข่าวล่าสุดจาก "กระดิ่ง" (Notifications) ใน Config มาโชว์แทนข้อความ Hardcode 
            if (config.notifications && config.notifications.length > 0) {
                const latestNotif = config.notifications[0];
                updateTitle = `📢 ${latestNotif.title}`;
                updateMsg = `
                <div class="text-start" style="font-size:0.95rem;line-height:1.6;">
                    ${latestNotif.body}
                    <hr class="my-3 opacity-25">
                    <small class="text-muted"><i class="fas fa-clock me-1"></i>ประกาศเมื่อ: ${latestNotif.time}</small>
                </div>`;
            }

            if (!updateMsg) {
                updateMsg = `<div class="text-start" style="font-size:0.9rem;line-height:1.7;">
                    <span class="badge bg-success mb-2">Version ${configVersion}</span><br>
                    ✅ <b>ความเสถียร:</b> แก้ไขข้อผิดพลาดต่างๆ และปรับปรุงประสิทธิภาพ
                </div>`;
            }

            await Swal.fire({
                title: updateTitle,
                html: updateMsg,
                icon: 'info',
                confirmButtonText: '👍 รับทราบ!',
                confirmButtonColor: '#6c5ce7',
                allowOutsideClick: false,
                width: '92%',
                customClass: {
                    container: 'swal-high-zindex'
                }
            });

            // บันทึกเวอร์ชันที่อ่านแล้วลง LocalStorage เพื่อไม่ให้เด้งซ้ำจนกว่าจะมี Version ใหม่จาก GAS
            safeSetItem('appVersion', configVersion);
        }
    }

    if (typeof checkAndShowSurvey === 'function') {
        await checkAndShowSurvey();
        await new Promise(r => setTimeout(r, 800)); // เว้นจังหวะนิดนึง
    }

    if (typeof checkAndShowWeatherAlert === 'function') {
        await checkAndShowWeatherAlert();
        await new Promise(r => setTimeout(r, 800)); // เว้นจังหวะนิดนึง
    }

    if (typeof requestNotificationPermission === 'function') {
        await requestNotificationPermission();
        await new Promise(r => setTimeout(r, 800)); // เว้นจังหวะนิดนึง
    }

    // ❓ ระบบผู้ช่วยสอนการใช้งาน (👩‍💼) — เรียกหลังทุกอย่างจบแล้ว
    if (typeof GuideSystem !== 'undefined') {
        await GuideSystem.startTour();
    }
}
