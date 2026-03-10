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

async function main()

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

    // จัดการระบบแจ้งเตือนต่างๆ (เฉพาะเมื่อได้ข้อมูล Config ล่าสุดมาแล้ว)
    if (configData) {
        if (typeof renderAnnouncement === 'function') renderAnnouncement(configData);
        if (typeof loadNotificationsFromConfig === 'function') loadNotificationsFromConfig(configData);
        if (typeof notifyFromConfig === 'function') notifyFromConfig(configData);
        showLifecycleDialogs(configData);
    }

    if (typeof updateAddAnnounceButton === 'function') updateAddAnnounceButton();

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

    if (typeof checkAndShowSurvey === 'function') await checkAndShowSurvey();
    if (typeof requestNotificationPermission === 'function') await requestNotificationPermission();
}