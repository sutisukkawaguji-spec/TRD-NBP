// ============================================================
// 🔐  auth.js — LIFF Authentication & User Management
//     ต้องโหลดหลัง config.js
// ============================================================

// --- โหลดรายชื่อผู้ใช้ทั้งหมดเข้า Cache ---
// --- โหลดรายชื่อผู้ใช้ทั้งหมดเข้า Cache ---
async function cacheUsers() {
    if (READ_FROM_SUPABASE && supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('Users')
                .select('*');

            if (error) throw error;

            if (data) {
                data.forEach(u => {
                    // Mapping Supabase schema to frontend format
                    allUsersMap[u.LineID] = {
                        lineId: u.LineID,
                        name: u.Name,
                        img: u.Image,
                        role: u.Role,
                        score: u.Score || 0,
                        level: u.Level || 1,
                        lastDate: u.LastDate,
                        lastTime: u.LastTime,
                        department: u.Department,
                        virtueStats: u.VirtueStats || {} // ในกรณีที่มีการเก็บ JSON สถิติไว้
                    };
                });
                console.log(`✅ Cached ${data.length} users from Supabase`);
            }
            return;
        } catch (e) {
            console.error("❌ Supabase cacheUsers failed:", e);
            // Fallback to GAS if Supabase fails
        }
    }

    return new Promise((resolve) => {
        const handleData = (data) => {
            if (Array.isArray(data)) {
                data.forEach(u => { allUsersMap[u.lineId] = u; });
                console.log(`✅ Cached ${data.length} users from GAS`);
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
            if (READ_FROM_SUPABASE && supabaseClient) {
                supabaseClient.from('Users')
                    .select('*')
                    .eq('LineID', currentUser.userId)
                    .single()
                    .then(({ data, error }) => {
                        if (data && !error) {
                            currentUser.score = data.Score || currentUser.score;
                            currentUser.level = data.Level || currentUser.level;
                            currentUser.happyScore = parseFloat(data.HappyScore) || parseFloat(data.Happy) || currentUser.happyScore;
                            currentUser.role = data.Role || currentUser.role;
                            currentUser.virtueStats = data.VirtueStats || currentUser.virtueStats;
                            saveUserSession(currentUser);
                            if (typeof renderProfile === 'function') renderProfile();
                        }
                    }).catch(e => console.warn("Supabase background sync failed:", e));
            } else {
                fetch(GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'check_user', userId: currentUser.userId, img: currentUser.img })
                })
                    .then(async res => {
                        const text = await res.text();
                        return JSON.parse(text);
                    })
                    .then(async data => {
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
                            if (typeof showLifecycleDialogs === 'function') await showLifecycleDialogs(data.config || null);
                            console.log('🔄 อัปเดตข้อมูลเบื้องหลังเสร็จสมบูรณ์');
                        }
                    }).catch(e => console.log('Background sync failed:', e));
            }

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

                <button onclick="doLineLogin()" class="btn btn-success btn-lg rounded-pill px-5 fw-bold w-100 mb-4 shadow-lg" style="background:#06C755; border:none; height:55px;">
                    <i class="fab fa-line me-2"></i>เข้าสู่ระบบด้วย LINE
                </button>

                <div class="divider mb-4" style="display:flex; align-items:center; color:#999; font-size:0.75rem;">
                    <div style="flex:1; height:1px; background:#eee;"></div>
                    <span class="mx-3">หรือ</span>
                    <div style="flex:1; height:1px; background:#eee;"></div>
                </div>

                <div class="manual-login-box">
                    <p class="small text-muted mb-2 fw-bold text-start ps-2">เข้าใช้งานด้วยรหัสพนักงาน</p>
                    <div class="input-group mb-2" style="border-radius:15px; overflow:hidden; border:1px solid #ddd;">
                        <span class="input-group-text bg-white border-0" style="color:var(--primary-color);"><i class="fas fa-user-tag"></i></span>
                        <input type="text" id="manualUserId" class="form-control border-0 shadow-none" placeholder="ระบุรหัสพนักงาน..." style="height:45px; font-size:0.9rem;">
                    </div>
                    <button onclick="doManualLogin()" class="btn btn-primary rounded-pill w-100 fw-bold" style="height:45px; background:linear-gradient(135deg, #6c5ce7, #a29bfe); border:none;">
                        เข้าสู่ระบบ <i class="fas fa-arrow-right ms-1"></i>
                    </button>
                </div>
                
                <div class="mt-4">
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

// Manual Login handler using Employee ID (UserId)
function doManualLogin() {
    const userIdInput = document.getElementById('manualUserId');
    const userId = userIdInput?.value?.trim();

    if (!userId) {
        Swal.fire({
            icon: 'warning',
            title: 'ข้อมูลไม่ครบ',
            text: 'กรุณาระบุรหัสพนักงานของคุณ',
            confirmButtonText: 'ตกลง'
        });
        return;
    }

    Swal.fire({
        title: 'กำลังตรวจสอบ...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    // เรียกใช้ checkUser โดยไม่ต้องมี profile ของ LINE
    // ถ้าพบรหัสในฐานข้อมูล ระบบจะพาเข้าสู่แอปทันที
    checkUser(userId, null);
}

// --- ตรวจสอบและลงทะเบียนผู้ใช้ ---
function checkUser(userId, profile) {
    // 🌟 1. กรณีเรียกแบบสั้น (เช่น checkUser()) ให้ใช้ข้อมูลจาก currentUser
    const targetUserId = userId || (window.currentUser ? window.currentUser.userId : null);
    if (!targetUserId) {
        console.warn('checkUser: No userId provided and no currentUser found.');
        return;
    }

    console.log('🔍 กำลังตรวจสอบการเชื่อมต่อกับ:', READ_FROM_SUPABASE ? 'Supabase' : 'GAS');

    if (READ_FROM_SUPABASE && supabaseClient) {
        supabaseClient.from('Users')
            .select('*')
            .eq('LineID', targetUserId)
            .single()
            .then(({ data, error }) => {
                if (error && error.code !== 'PGRST116') throw error; // PGRST116 is 'no rows returned'

                if (data) {
                    const finalName = data.Name || (profile ? profile.displayName : (window.currentUser ? window.currentUser.name : 'Unknown'));
                    const finalImg = data.Image || (profile ? profile.pictureUrl : (window.currentUser ? window.currentUser.img : ''));

                    currentUser = {
                        userId: targetUserId,
                        name: finalName,
                        img: finalImg,
                        role: data.Role || 'Guest',
                        level: data.Level || 1,
                        score: data.Score || 0,
                        happyScore: parseFloat(data.HappyScore) || parseFloat(data.Happy) || 0,
                        virtueStats: data.VirtueStats || {},
                        totalCount: data.TotalCount || 0,
                        topFriends: data.TopFriends || [],
                        dominantVirtue: data.DominantVirtue || 'none'
                    };

                    saveUserSession(currentUser);
                    finishLoginProcess(); // Note: we might not have 'config' here yet, it will use defaults or hit GAS later

                } else {
                    if (profile) registerUser(targetUserId, profile);
                    else {
                        console.error('❌ User not found and no profile provided to register.');
                        Swal.fire('ไม่พบข้อมูล', 'ไม่พบบัญชีผู้ใช้งานในระบบ และไม่ได้รับข้อมูลจาก LINE เพื่อลงทะเบียนใหม่ กรุณาลองล็อกอินผ่านแอป LINE อีกครั้งครับ', 'error');
                    }
                }
                hideLoading();
            })
            .catch(err => {
                console.error('❌ Supabase CheckUser Failure:', err);
                // Fallback to GAS if Supabase fails
                runGASCheckUser(targetUserId, profile);
            });
    } else {
        runGASCheckUser(targetUserId, profile);
    }
}

// Separate GAS checkUser logic to keep code clean
function runGASCheckUser(targetUserId, profile) {
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
            try { return JSON.parse(text); } catch (e) {
                console.error('Invalid JSON Response:', text);
                throw new Error(text.substring(0, 50) || 'Server returned invalid data format');
            }
        })
        .then(data => {
            if (data.exists) {
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

                saveUserSession(currentUser);
                finishLoginProcess(data.config);
            } else {
                if (profile) registerUser(targetUserId, profile);
                else {
                    console.error('❌ User not found and no profile provided to register.');
                    Swal.fire('ไม่พบข้อมูล', 'ไม่พบบัญชีผู้ใช้งานในระบบ และไม่ได้รับข้อมูลจาก LINE เพื่อลงทะเบียนใหม่ กรุณาลองล็อกอินผ่านแอป LINE อีกครั้งครับ', 'error');
                }
            }
            hideLoading();
        })
        .catch(err => {
            console.error('❌ CheckUser GAS Failure:', err);
            hideLoading();
            Swal.fire({
                icon: 'error',
                title: 'เชื่อมต่อหลังบ้านไม่ได้',
                html: `<b>สาเหตุ:</b> ${err.message}<br><br><small style="font-size:0.65rem; word-break:break-all; color:#888;"><b>Target URL:</b><br>${GAS_URL}</small>`,
                footer: '<div class="text-center"><a href="#" onclick="location.reload()" class="btn btn-sm btn-primary rounded-pill px-3">ลองโหลดหน้าใหม่</a></div>'
            });
        });
}

function hideLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.classList.add('hiding');
        setTimeout(() => { loadingEl.style.display = 'none'; loadingEl.classList.remove('hiding'); }, 400);
    }
}

function registerUser(userId, profile) {
    if (window._isRegistering) return; // 🛡️ ป้องกันการสมัครซ้อน
    window._isRegistering = true;

    console.log('📝 กำลังลงทะเบียนผู้ใช้ใหม่:', userId);

    // 1. บันทึกลง Google Sheets (Backend หลัก)
    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'register_user', userId, userName: profile.displayName, userImg: profile.pictureUrl })
    }).then(async () => {
        // ☁️ [Supabase Sync]
        if (supabaseClient) {
            try {
                const now = new Date();
                await supabaseClient.from('Users').upsert({
                    LineID: userId,
                    Name: profile.displayName,
                    Image: profile.pictureUrl,
                    Role: 'Guest',
                    Score: 0,
                    Level: 1,
                    LastDate: now.toISOString().split('T')[0],
                    LastTime: now.toTimeString().split(' ')[0],
                    VisitCount: 1
                });
                console.log('☁️ Supabase: User registration synced');
            } catch (e) { console.error('☁️ Supabase Sync Error:', e); }
        }

        window._isRegistering = false;
        checkUser(userId, profile); // กลับไปตรวจสอบอีกครั้งเพื่อเข้าแอป
    })
        .catch(err => {
            window._isRegistering = false;
            Swal.fire('Error', 'ลงทะเบียนไม่สำเร็จ (GAS): ' + err.message, 'error');
        });

    // 2. [Supabase] บันทึกลงฐานข้อมูลสำรอง (Parallel Sync)
    if (supabaseClient) {
        const now = new Date();
        supabaseClient.from('Users').upsert({
            "LineID": userId,
            "Name": profile.displayName,
            "Image": profile.pictureUrl,
            "Role": 'Guest',
            "Score": 100,
            "Level": 1,
            "LastDate": now.toISOString().split('T')[0],
            "LastTime": now.toTimeString().split(' ')[0]
        }).then(res => {
            if (res.error) console.error('☁️ Supabase Registration Error:', res.error);
            else console.log('☁️ Supabase: User registered/updated');
        });
    }
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

    if (typeof fetchManagerData === 'function') {
        fetchManagerData(true); // 🌟 บังคับโหลดเพื่อดึง chartData สำหรับหน้าสถิติของทุกคน
    }

    // จัดการระบบแจ้งเตือนต่างๆ (เฉพาะเมื่อได้ข้อมูล Config ล่าสุดมาแล้ว)
    if (configData) {
        if (typeof renderAnnouncement === 'function') renderAnnouncement(configData);
        if (typeof loadNotificationsFromConfig === 'function') loadNotificationsFromConfig(configData);
        if (typeof notifyFromConfig === 'function') notifyFromConfig(configData);
    }
    showLifecycleDialogs(configData);

    if (typeof updateAddAnnounceButton === 'function') updateAddAnnounceButton();
    if (typeof trackAppVisit === 'function') trackAppVisit();

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
    if (window._lifecycleRunning) return;
    window._lifecycleRunning = true;

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
                allowOutsideClick: false
            });

            // บันทึกเวอร์ชันที่อ่านแล้วลง LocalStorage เพื่อไม่ให้เด้งซ้ำจนกว่าจะมี Version ใหม่จาก GAS
            safeSetItem('appVersion', configVersion);
        }
    }

    if (typeof checkAndShowSurvey === 'function') await checkAndShowSurvey();
    if (typeof checkAndShowWeatherAlert === 'function') await checkAndShowWeatherAlert();
    if (typeof requestNotificationPermission === 'function') await requestNotificationPermission();
}