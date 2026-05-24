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
        const urlParams = new URLSearchParams(window.location.search);
        
        // 🏠 [HOUSE SCAN] เช็คการเชิญชวนเข้ากลุ่ม/บ้านผ่าน QR Code
        const joinHouseParam = urlParams.get('join_house') || urlParams.get('house');
        if (joinHouseParam) {
            safeSetItem('pending_join_house', joinHouseParam);
            console.log('📌 Saved pending join house parameter:', joinHouseParam);
        }

        // 🔑 [AUTO LOGIN LINK] รองรับ ?login_id=... หรือ ?uid=... เพื่อย้ายเปิดใน Safari/Chrome
        const loginIdParam = urlParams.get('login_id') || urlParams.get('uid');
        if (loginIdParam) {
            console.log('🔑 Auto-login parameter found:', loginIdParam);
            Swal.fire({ 
                title: 'กำลังเข้าสู่ระบบ...', 
                allowOutsideClick: false, 
                didOpen: () => Swal.showLoading() 
            });
            
            await checkUser(loginIdParam, null);
            
            // ล้าง URL parameter เพื่อความสะอาดและป้องกันปัญหาโหลดซ้ำ
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
            return;
        }

        // 🛡️ [MAGIC LINK] สำหรับกรรมการตรวจประเมิน (ไม่ต้องล็อกอิน)

        if (urlParams.get('mode') === 'committee_nbp_2026') {
            console.log('🛡️ Entering Committee Magic Link Mode...');
            currentUser = {
                userId: 'COMMITTEE_AUDITOR',
                name: 'กรรมการตรวจประเมิน',
                role: 'Committee',
                img: 'https://cdn-icons-png.flaticon.com/512/1067/1067561.png', // ไอคอนรูปโล่/กรรมการ
                score: 0,
                level: 2, // 🌟 กำหนด Level 2 โดยตรงเพื่อให้ผ่านทุกด่าน
                happyScore: 10.0,
                status: 'active'
            };
            saveUserSession(currentUser);
            finishLoginProcess();
            return;
        }

        // 🌟 1. เช็คเซสชัน: โหลดข้อมูลจากเครื่องมาโชว์ทันที (เข้าแอปไว ไม่ติดหน้าโหลด)
        const savedSession = getUserSession();
        if (savedSession) {
            console.log('🎉 พบเซสชันเดิม โหลดหน้าแอปทันที!');
            
            // 🛡️ [FORCE SYNC] ล้างเวลาโพสต์ล่าสุดเพื่อให้การดึงข้อมูลครั้งแรกจากเซิร์ฟเวอร์เป็นค่าที่ถูกต้องที่สุดเสมอ
            localStorage.removeItem('last_post_time'); 
            
            currentUser = savedSession;
            finishLoginProcess(); // โหลด UI ทันที

            // 🌟 2. อัปเดตข้อมูลเบื้องหลังแบบเงียบๆ (Background Sync) 
            // เพื่อดึงคะแนนล่าสุดและประกาศใหม่ๆ มาแสดงโดยไม่ให้หน้าเว็บค้าง
            
            // Sync LINE profile in background if LIFF is available
            if (typeof liff !== 'undefined') {
                liff.init({ liffId: LIFF_ID }).then(async () => {
                    if (liff.isLoggedIn()) {
                        try {
                            const profile = await liff.getProfile();
                            if (profile) {
                                let profileUpdated = false;
                                if (profile.pictureUrl && profile.pictureUrl !== currentUser.img) {
                                    currentUser.img = profile.pictureUrl;
                                    profileUpdated = true;
                                    safeSetItem('liff_pictureUrl', profile.pictureUrl);
                                }
                                if (profile.displayName && profile.displayName !== currentUser.name) {
                                    currentUser.name = profile.displayName;
                                    profileUpdated = true;
                                    safeSetItem('liff_displayName', profile.displayName);
                                }
                                if (profileUpdated) {
                                    console.log('🔄 LINE profile updated in background:', profile.displayName, profile.pictureUrl);
                                    saveUserSession(currentUser);
                                    if (typeof renderProfile === 'function') renderProfile();
                                    
                                    // Update database
                                    if (READ_FROM_SUPABASE && supabaseClient) {
                                        supabaseClient.from('Users')
                                            .update({ Image: currentUser.img, Name: currentUser.name })
                                            .eq('LineID', currentUser.userId)
                                            .then(({ error }) => {
                                                if (error) console.error("❌ Failed to update image in Supabase:", error);
                                            });
                                    } else {
                                        fetch(GAS_URL, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                                            body: JSON.stringify({
                                                action: 'check_user',
                                                userId: currentUser.userId,
                                                img: currentUser.img,
                                                name: currentUser.name
                                            })
                                        }).catch(err => console.warn("Background GAS sync image update failed:", err));
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn("Background LIFF profile check failed:", e);
                        }
                    }
                }).catch(e => console.warn("Background LIFF init failed:", e));
            }

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
                            currentUser.status = data.Status || currentUser.status;
                            currentUser.groupCode = data.GroupCode || currentUser.groupCode;
                            
                            // Also update image and name from database if newer
                            const cachedLiffPicture = safeGetItem('liff_pictureUrl');
                            const cachedLiffName = safeGetItem('liff_displayName');
                            
                            if (data.Image && data.Image !== currentUser.img) {
                                if (cachedLiffPicture && cachedLiffPicture !== data.Image && currentUser.img === cachedLiffPicture) {
                                    if (READ_FROM_SUPABASE && supabaseClient) {
                                        supabaseClient.from('Users')
                                            .update({ Image: cachedLiffPicture })
                                            .eq('LineID', currentUser.userId)
                                            .then(({ error }) => {
                                                if (error) console.error("❌ Failed to update image in Supabase:", error);
                                            });
                                    }
                                } else {
                                    currentUser.img = data.Image;
                                }
                            }
                            if (data.Name && data.Name !== currentUser.name) {
                                if (cachedLiffName && cachedLiffName !== data.Name && currentUser.name === cachedLiffName) {
                                    if (READ_FROM_SUPABASE && supabaseClient) {
                                        supabaseClient.from('Users')
                                            .update({ Name: cachedLiffName })
                                            .eq('LineID', currentUser.userId)
                                            .then(({ error }) => {
                                                if (error) console.error("❌ Failed to update name in Supabase:", error);
                                            });
                                    }
                                } else {
                                    currentUser.name = data.Name;
                                }
                            }

                            saveUserSession(currentUser);
                            if (typeof renderProfile === 'function') renderProfile();
                        }
                    }).catch(e => console.warn("Supabase background sync failed:", e));
            } else {
                const cachedLiffPictureBg = safeGetItem('liff_pictureUrl');
                const cachedLiffNameBg = safeGetItem('liff_displayName');
                
                fetch(GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ 
                        action: 'check_user', 
                        userId: currentUser.userId, 
                        img: cachedLiffPictureBg || currentUser.img,
                        name: cachedLiffNameBg || currentUser.name
                    })
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
                            currentUser.happyScore = parseFloat(data.user.happyScore) || 0;
                            currentUser.virtueStats = data.user.virtueStats || currentUser.virtueStats;
                            currentUser.role = data.user.role || currentUser.role;
                            currentUser.status = data.user.status || currentUser.status;
                            currentUser.groupCode = data.user.groupCode || currentUser.groupCode;

                            // Also update image and name from database
                            if (data.user.img && data.user.img !== currentUser.img) {
                                if (cachedLiffPictureBg && cachedLiffPictureBg !== data.user.img && currentUser.img === cachedLiffPictureBg) {
                                    // Keep cached version, no overwrite
                                } else {
                                    currentUser.img = data.user.img;
                                }
                            }
                            if (data.user.name && data.user.name !== currentUser.name) {
                                if (cachedLiffNameBg && cachedLiffNameBg !== data.user.name && currentUser.name === cachedLiffNameBg) {
                                    // Keep cached version, no overwrite
                                } else {
                                    currentUser.name = data.user.name;
                                }
                            }

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
            .or(`LineID.eq.${targetUserId},EmployeeID.eq.${targetUserId}`)
            .then(({ data, error }) => {
                if (error) throw error;
                
                const userRow = (data && data.length > 0) ? data[0] : null;

                if (userRow) {
                    let finalName = userRow.Name;
                    let finalImg = userRow.Image;
                    let profileChanged = false;

                    // 🌟 ดึงข้อมูลโปรไฟล์ LINE ที่แคชไว้ล่าสุด (ป้องกันปัญหารูปลิงก์ LINE หมดอายุ หรือไม่ได้เปิดผ่าน LINE)
                    const cachedLiffUserId = safeGetItem('liff_userId');
                    const cachedLiffPicture = safeGetItem('liff_pictureUrl');
                    const cachedLiffName = safeGetItem('liff_displayName');

                    let activeProfile = profile;
                    if (!activeProfile && cachedLiffUserId && (cachedLiffUserId === userRow.LineID || cachedLiffUserId === userRow.EmployeeID)) {
                        activeProfile = {
                            pictureUrl: cachedLiffPicture,
                            displayName: cachedLiffName
                        };
                    }

                    if (activeProfile) {
                        if (activeProfile.pictureUrl && activeProfile.pictureUrl !== userRow.Image) {
                            finalImg = activeProfile.pictureUrl;
                            profileChanged = true;
                        }
                        if (activeProfile.displayName && activeProfile.displayName !== userRow.Name) {
                            finalName = activeProfile.displayName;
                            profileChanged = true;
                        }
                    }

                    if (!finalName) finalName = window.currentUser ? window.currentUser.name : 'Unknown';
                    if (!finalImg) finalImg = window.currentUser ? window.currentUser.img : '';

                    currentUser = {
                        userId: userRow.LineID, // ใช้ LineID เสมอเป็นแกนหลักเพื่อไม่ให้ระเบียนต่าง ๆ หลุดความเชื่อมโยง
                        employeeId: userRow.EmployeeID || '',
                        name: finalName,
                        img: finalImg,
                        role: userRow.Role || 'Guest',
                        level: userRow.Level || 1,
                        score: userRow.Score || 0,
                        happyScore: parseFloat(userRow.HappyScore) || parseFloat(userRow.Happy) || 0,
                        virtueStats: userRow.VirtueStats || {},
                        totalCount: userRow.TotalCount || 0,
                        topFriends: userRow.TopFriends || [],
                        dominantVirtue: userRow.DominantVirtue || 'none',
                        status: userRow.Status || 'active',
                        groupCode: userRow.GroupCode || ''
                    };

                    saveUserSession(currentUser);
                    finishLoginProcess();

                    if (profileChanged) {
                        supabaseClient.from('Users')
                            .update({ Image: finalImg, Name: finalName })
                            .eq('LineID', userRow.LineID)
                            .then(({ error: updateErr }) => {
                                if (updateErr) console.error("❌ Failed to update profile in Supabase:", updateErr);
                                else console.log("✅ Profile updated in Supabase successfully");
                            });
                    }
                    hideLoading();
                    if (typeof Swal !== 'undefined') Swal.close();

                } else {
                    // 🌟 แสดงหน้าจอแจ้งเข้าระบบ
                    if (typeof Swal !== 'undefined') Swal.close();
                    
                    const pendingJoinHouse = safeGetItem('pending_join_house');
                    if (pendingJoinHouse) {
                        console.log('🏠 New user joining house:', pendingJoinHouse, '- redirecting straight to registration form');
                        showRegistrationForm(targetUserId, profile);
                    } else {
                        showAccessRequestScreen(targetUserId, profile);
                    }
                }
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

function runGASCheckUser(targetUserId, profile) {
    const cachedLiffUserId = safeGetItem('liff_userId');
    const cachedLiffPicture = safeGetItem('liff_pictureUrl');
    const cachedLiffName = safeGetItem('liff_displayName');

    let activeProfile = profile;
    if (!activeProfile && cachedLiffUserId && (cachedLiffUserId === targetUserId)) {
        activeProfile = {
            pictureUrl: cachedLiffPicture,
            displayName: cachedLiffName
        };
    }

    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'check_user',
            userId: targetUserId,
            img: activeProfile ? activeProfile.pictureUrl : (window.currentUser ? window.currentUser.img : ''),
            name: activeProfile ? activeProfile.displayName : (window.currentUser ? window.currentUser.name : '')
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
                let finalName = data.user.name;
                let finalImg = data.user.img;

                if (activeProfile) {
                    if (activeProfile.pictureUrl && activeProfile.pictureUrl !== data.user.img) {
                        finalImg = activeProfile.pictureUrl;
                    }
                    if (activeProfile.displayName && activeProfile.displayName !== data.user.name) {
                        finalName = activeProfile.displayName;
                    }
                }

                if (!finalName) finalName = activeProfile ? activeProfile.displayName : (window.currentUser ? window.currentUser.name : 'Unknown');
                if (!finalImg) finalImg = activeProfile ? activeProfile.pictureUrl : (window.currentUser ? window.currentUser.img : '');

                currentUser = {
                    userId: data.user.lineId || targetUserId,
                    employeeId: data.user.employeeId || '',
                    name: finalName,
                    img: finalImg,
                    role: data.user.role || 'Guest',
                    level: data.user.level || 1,
                    score: data.user.score || 0,
                    happyScore: parseFloat(data.user.happyScore) || parseFloat(data.user.happy) || 0,
                    virtueStats: data.user.virtueStats || {},
                    totalCount: data.user.totalCount || 0,
                    topFriends: data.user.topFriends || [],
                    dominantVirtue: data.user.dominantVirtue || 'none',
                    status: data.user.status || '',
                    groupCode: data.user.groupCode || ''
                };

                saveUserSession(currentUser);
                finishLoginProcess(data.config);
                hideLoading();
                if (typeof Swal !== 'undefined') Swal.close();
            } else {
                // 🌟 แสดงหน้าจอแจ้งเข้าระบบ
                if (typeof Swal !== 'undefined') Swal.close();
                
                const pendingJoinHouse = safeGetItem('pending_join_house');
                if (pendingJoinHouse) {
                    console.log('🏠 New user joining house (GAS):', pendingJoinHouse, '- redirecting straight to registration form');
                    showRegistrationForm(targetUserId, profile);
                } else {
                    showAccessRequestScreen(targetUserId, profile);
                }
            }
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

// 🌟 [NEW] หน้าจอแจ้งเข้าระบบสำหรับสมาชิกใหม่ (และตัวเลือกการผูกบัญชี LINE)
async function showAccessRequestScreen(userId, profile) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.classList.remove('hiding');
    }

    const isLineLogin = !!profile;
    let htmlContent = '';

    if (isLineLogin) {
        htmlContent = `
            <div class="text-center p-4 login-card fade-in" style="max-width:380px; background:var(--glass-bg); border-radius:30px; border:1px solid var(--border-color); box-shadow:0 15px 35px rgba(0,0,0,0.1); margin: 0 auto; position: relative; top: 50%; transform: translateY(-50%);">
                <div class="mb-4">
                    <div style="font-size:4.5rem; margin-bottom:15px; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.1));">👋</div>
                    <h4 class="fw-bold mb-2" style="color:var(--primary-color);">สวัสดีครับ</h4>
                    <p class="text-dark fw-bold mb-1">${profile.displayName}</p>
                    <p class="text-muted small">ยังไม่มีบัญชี LINE นี้ในระบบ<br>กรุณาผูกบัญชีกับรหัสพนักงานของคุณเพื่อเข้าใช้งาน</p>
                </div>

                <div class="mb-3 text-start">
                    <label class="small fw-bold mb-1 text-muted">รหัสพนักงานของคุณ</label>
                    <input type="text" id="linkEmployeeId" class="form-control rounded-pill px-3 shadow-none border-1" placeholder="กรอกรหัสพนักงาน..." style="height:45px; font-size:0.9rem;">
                </div>
                
                <button id="btnLinkAccount" class="btn btn-success btn-lg rounded-pill px-5 fw-bold w-100 mb-3 shadow-lg" style="background:#06C755; border:none; height:50px; font-size:1rem;">
                    <i class="fas fa-link me-2"></i>ผูกบัญชีและเข้าสู่ระบบ
                </button>

                <div class="divider mb-3" style="display:flex; align-items:center; color:#999; font-size:0.75rem;">
                    <div style="flex:1; height:1px; background:#eee;"></div>
                    <span class="mx-3">หรือ</span>
                    <div style="flex:1; height:1px; background:#eee;"></div>
                </div>
                
                <button id="btnRequestAccess" class="btn btn-outline-primary btn-lg rounded-pill px-5 fw-bold w-100 mb-3" style="height:50px; font-size:1rem;">
                    <i class="fas fa-user-plus me-2"></i>ลงทะเบียนพนักงานใหม่
                </button>
                
                <button onclick="location.reload()" class="btn btn-link text-muted small text-decoration-none w-100">กลับหน้าหลัก</button>
            </div>
        `;
    } else {
        htmlContent = `
            <div class="text-center p-4 login-card fade-in" style="max-width:380px; background:var(--glass-bg); border-radius:30px; border:1px solid var(--border-color); box-shadow:0 15px 35px rgba(0,0,0,0.1); margin: 0 auto; position: relative; top: 50%; transform: translateY(-50%);">
                <div class="mb-4">
                    <div style="font-size:4.5rem; margin-bottom:15px; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.1));">👋</div>
                    <h4 class="fw-bold mb-2" style="color:var(--primary-color);">สวัสดีครับ</h4>
                    <p class="text-muted small">ไม่พบรหัสพนักงาน <b>"${userId}"</b> ในระบบ<br>กรุณาส่งคำขอลงทะเบียนกับผู้ดูแลระบบ</p>
                </div>
                
                <button id="btnRequestAccess" class="btn btn-primary btn-lg rounded-pill px-5 fw-bold w-100 mb-3 shadow-lg" style="background:linear-gradient(135deg, #6c5ce7, #a29bfe); border:none; height:55px;">
                    <i class="fas fa-paper-plane me-2"></i>แจ้งเข้าระบบ / ลงทะเบียน
                </button>
                
                <button onclick="location.reload()" class="btn btn-link text-muted small text-decoration-none w-100">กลับหน้าหลัก</button>
            </div>
        `;
    }

    document.getElementById('loading').innerHTML = htmlContent;

    if (isLineLogin) {
        document.getElementById('btnLinkAccount').addEventListener('click', () => {
            performAccountLink(userId, profile);
        });
    }

    document.getElementById('btnRequestAccess').addEventListener('click', () => {
        showRegistrationForm(userId, profile);
    });
}

// ฟังก์ชันผูกบัญชี LINE กับรหัสพนักงาน
async function performAccountLink(lineId, profile) {
    const employeeIdInput = document.getElementById('linkEmployeeId');
    const employeeId = employeeIdInput?.value?.trim();

    if (!employeeId) {
        Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: 'กรุณากรอกรหัสพนักงานของคุณ', confirmButtonText: 'ตกลง' });
        return;
    }

    Swal.fire({ title: 'กำลังผูกบัญชี...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    if (READ_FROM_SUPABASE && supabaseClient) {
        try {
            // ค้นหารหัสพนักงานในระบบ
            const { data, error } = await supabaseClient.from('Users')
                .select('*')
                .or(`LineID.eq.${employeeId},EmployeeID.eq.${employeeId}`);

            if (error) throw error;

            if (data && data.length > 0) {
                const userRow = data[0];

                // เช็คว่ามี LINE ID อื่นผูกไปแล้วหรือไม่
                if (userRow.LineID && userRow.LineID.startsWith('U') && userRow.LineID !== lineId) {
                    Swal.fire({
                        icon: 'error',
                        title: 'ผูกบัญชีไม่สำเร็จ',
                        text: 'รหัสพนักงานนี้ถูกผูกกับบัญชี LINE อื่นไปแล้ว กรุณาติดต่อผู้ดูแลระบบ'
                    });
                    return;
                }

                // อัปเดตข้อมูลผู้ใช้ ผูก LineID
                const { error: updateErr } = await supabaseClient.from('Users')
                    .update({
                        LineID: lineId,
                        EmployeeID: employeeId,
                        Name: profile.displayName || userRow.Name,
                        Image: profile.pictureUrl || userRow.Image
                    })
                    .eq('LineID', userRow.LineID);

                if (updateErr) throw updateErr;

                Swal.fire({
                    icon: 'success',
                    title: 'ผูกบัญชีสำเร็จ',
                    text: 'ผูกบัญชี LINE กับรหัสพนักงานเรียบร้อยแล้ว!',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    checkUser(lineId, profile);
                });

            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'ไม่พบรหัสพนักงาน',
                    text: 'ไม่พบรหัสพนักงานนี้ในฐานข้อมูล กรุณาตรวจสอบอีกครั้ง หรือเลือก "ลงทะเบียนพนักงานใหม่"'
                });
            }
        } catch (e) {
            console.error('❌ Link account failed:', e);
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้: ' + e.message });
        }
    } else {
        // GAS Fallback Link
        fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'link_user_account',
                lineId: lineId,
                employeeId: employeeId,
                name: profile.displayName,
                img: profile.pictureUrl
            })
        })
        .then(res => res.json())
        .then(resData => {
            if (resData.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'ผูกบัญชีสำเร็จ',
                    text: 'ผูกบัญชี LINE กับรหัสพนักงานเรียบร้อยแล้ว!',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    checkUser(lineId, profile);
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'ไม่พบรหัสพนักงาน',
                    text: resData.message || 'ไม่พบรหัสพนักงานนี้ในระบบ'
                });
            }
        })
        .catch(err => {
            console.error('❌ GAS Link account failed:', err);
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถเชื่อมต่อระบบได้: ' + err.message });
        });
    }
}

async function showRegistrationForm(userId, profile) {
    const isManual = !profile;
    const pendingJoinHouse = safeGetItem('pending_join_house') || '';
    const { value: formValues } = await Swal.fire({
        title: '📝 ลงทะเบียนผู้เข้าใหม่',
        html: `
            <div class="text-start">
                ${isManual ? `
                <label class="small fw-bold mb-1">ชื่อ-นามสกุล (Full Name)</label>
                <input id="reg-name" class="swal2-input mt-0" placeholder="ระบุชื่อ-นามสกุล">
                ` : ''}
                <label class="small fw-bold mb-1 mt-3">ตำแหน่ง (Position)</label>
                <input id="reg-pos" class="swal2-input mt-0" placeholder="ระบุตำแหน่งของคุณ">
                <label class="small fw-bold mb-1 mt-3">จังหวัด (Province)</label>
                <input id="reg-province" class="swal2-input mt-0" placeholder="ระบุจังหวัด">
                <label class="small fw-bold mb-1 mt-3">กลุ่ม/บ้าน (House Code)</label>
                ${pendingJoinHouse ? `
                    <div class="p-2 border rounded-3 bg-light text-success fw-bold d-flex align-items-center justify-content-between mb-2" style="font-size:0.9rem; border-color: #d4edda !important; background-color: #d4edda33 !important; color: #155724;">
                        <span>🏠 บ้าน: <b>${pendingJoinHouse}</b></span>
                        <span class="badge bg-success small"><i class="fas fa-qrcode"></i> QR Code</span>
                    </div>
                    <input type="hidden" id="reg-group" value="${pendingJoinHouse}">
                ` : `
                    <select id="reg-group" class="form-select mt-0 rounded-3 shadow-none border" style="font-family:Kanit,sans-serif; height:45px; font-size:0.9rem; border-color:#ccc; width: 100%;">
                        <option value="">-- กรุณาเลือกกลุ่ม/บ้าน --</option>
                        <option value="TRD">บ้าน TRD (ส่วนกลาง)</option>
                        <option value="NBP">บ้าน NBP (นบป.)</option>
                        <option value="SKK">บ้าน SKK (สระแก้ว)</option>
                    </select>
                `}
                <p class="text-muted smallest mt-2">* ข้อมูลของคุณจะถูกส่งให้ Admin ตรวจสอบเพื่ออนุมัติสิทธิ์การใช้งาน</p>
            </div>
        `,
        focusConfirm: false,
        allowOutsideClick: false,
        confirmButtonText: 'ส่งคำขอลงทะเบียน',
        preConfirm: () => {
            const name = isManual ? document.getElementById('reg-name').value.trim() : profile.displayName;
            const pos = document.getElementById('reg-pos').value.trim();
            const province = document.getElementById('reg-province').value.trim();
            const group = document.getElementById('reg-group').value.trim();
            
            if (isManual && !name) {
                Swal.showValidationMessage('กรุณากรอกชื่อ-นามสกุล');
                return false;
            }
            if (!pos || !province) { // 🌟 ไม่บังคับรหัสกลุ่ม
                Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                return false;
            }
            return { name, pos, province, group };
        }
    });

    if (formValues) {
        registerUser(userId, profile, formValues);
    }
}

function registerUser(userId, profile, extraData = {}) {
    if (window._isRegistering) return; // 🛡️ ป้องกันการสมัครซ้อน
    window._isRegistering = true;

    Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    console.log('📝 กำลังลงทะเบียนผู้ใช้ใหม่:', userId, extraData);

    const payload = {
        action: 'register_user',
        userId,
        userName: extraData.name || (profile ? profile.displayName : 'Unknown'),
        userImg: profile ? profile.pictureUrl : 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        position: extraData.pos || '',
        province: extraData.province || '',
        groupCode: extraData.group || ''
    };

    // 1. บันทึกลง Google Sheets (Backend หลัก)
    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    }).then(async () => {
        // ☁️ [Supabase Sync]
        if (supabaseClient) {
            try {
                const now = new Date();
                await supabaseClient.from('Users').upsert({
                    LineID: userId,
                    EmployeeID: userId.startsWith('U') ? '' : userId,
                    Name: extraData.name || (profile ? profile.displayName : 'Unknown'),
                    Image: profile ? profile.pictureUrl : 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
                    Role: 'Guest', // ค่าเริ่มต้นเป็น Guest รอการอนุมัติ
                    Score: 0,
                    Level: 1,
                    Department: extraData.pos || '', // เก็บตำแหน่งในฟิลด์ Dept
                    Office: extraData.province || '', // เก็บจังหวัดในฟิลด์ Office
                    GroupCode: extraData.group || '',
                    Status: 'waiting_approval',
                    LastDate: now.toISOString().split('T')[0],
                    LastTime: now.toTimeString().split(' ')[0],
                    VisitCount: 1
                });
                console.log('☁️ Supabase: User registration synced');

                 // 📣 [WEB PUSH TRIGGER] แจ้งเตือนแอดมิน/ผู้ดูแลว่ามีผู้สมัครใหม่รอการอนุมัติ
                 const newMemberName = extraData.name || (profile ? profile.displayName : 'Unknown');
                 const houseName = extraData.group || 'Guest';
                 if (typeof triggerPushNotification === 'function') {
                     triggerPushNotification(
                         '🏠 มีผู้สมัครเข้าบ้านใหม่รอการอนุมัติ',
                         `คุณ "${newMemberName}" ได้ส่งคำขอลงทะเบียนเข้ากลุ่มบ้าน ${houseName} แล้ว กรุณาตรวจสอบและอนุมัติสิทธิ์`,
                         window.location.origin + '/index.html',
                         'admin'
                     ).catch(err => console.error('Admin approval request notification error:', err));
                 }

                // 📧 แจ้งเตือน Admin (จำลองการส่งเข้า Inbox Admin)
                // ในระบบจริงอาจบันทึกลงตาราง Inbox/Notifications
            } catch (e) { console.error('☁️ Supabase Sync Error:', e); }
        }

        window._isRegistering = false;
        
        // ล้างค่าบ้านที่กำลังรอเข้าหลังจากลงทะเบียนเสร็จ
        localStorage.removeItem('pending_join_house');

        const magicLoginUrl = `${window.location.origin}${window.location.pathname}?login_id=${userId}`;

        Swal.fire({
            icon: 'success',
            title: 'ส่งคำขอสำเร็จ 🎉',
            html: `
                <div class="text-center mb-3">
                    <p class="mb-3">คำขอเข้ากลุ่มบ้านของคุณได้รับการลงทะเบียนเรียบร้อยแล้ว กรุณารอผู้ดูแลระบบอนุมัติ</p>
                    <span class="badge bg-warning text-dark px-3 py-2 rounded-pill fs-7 mb-3" style="font-size: 0.85rem;">
                        <i class="fas fa-user-clock me-1"></i> สถานะ: รอการอนุมัติ (Guest)
                    </span>
                </div>
                <div class="text-start p-3 rounded-4" style="background: rgba(108, 92, 231, 0.05); border: 1px dashed var(--primary-color); font-family: 'Kanit', sans-serif;">
                    <label class="form-label small fw-bold text-dark mb-1">🔗 ลิงก์เข้าใช้งานด่วนบนบราวเซอร์ทั่วไป:</label>
                    <p class="text-muted mb-2" style="font-size:0.75rem;">คัดลอกลิงก์นี้ไปเปิดบน <b>Safari / Chrome</b> บนอุปกรณ์ของคุณ เพื่อเข้าสู่ระบบและใช้งานโดยไม่ต้องเข้าผ่าน LINE ทุกครั้ง</p>
                    <div class="input-group input-group-sm mb-2 shadow-sm rounded-3 overflow-hidden">
                        <input type="text" id="magicLinkInput" class="form-control border-0 px-2" readonly value="${magicLoginUrl}" style="font-size:0.8rem; height:35px; background:#fff;">
                        <button class="btn btn-primary px-3 fw-bold" style="font-size:0.8rem;" onclick="
                            const copyText = document.getElementById('magicLinkInput');
                            copyText.select();
                            copyText.setSelectionRange(0, 99999);
                            navigator.clipboard.writeText(copyText.value);
                            this.innerHTML = '<i class=&quot;fas fa-check&quot;></i> คัดลอกแล้ว';
                            setTimeout(() => this.innerHTML = 'คัดลอก', 2000);
                        ">คัดลอก</button>
                    </div>
                    <button class="btn btn-sm btn-outline-primary w-100 rounded-pill mt-2 fw-bold" onclick="window.open('${magicLoginUrl}', '_blank')">
                        <i class="fas fa-external-link-alt me-1"></i> เปิดในบราวเซอร์ทันที
                    </button>
                </div>
            `,
            confirmButtonText: 'ตกลง (ไปดูหน้าเรื่องราว)',
            confirmButtonColor: 'var(--primary-color)',
            allowOutsideClick: false
        }).then(() => {
            // โหลดแอปใหม่เพื่อแสดงสถานะ Guest
            checkUser(userId, profile); 
        });
    })
        .catch(err => {
            window._isRegistering = false;
            Swal.fire('Error', 'ลงทะเบียนไม่สำเร็จ (GAS): ' + err.message, 'error');
        });

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

function doLogout() {
    Swal.fire({
        title: 'ออกจากระบบ?',
        text: "คุณต้องการออกจากระบบเพื่อเริ่มเซสชันใหม่หรือไม่?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff7675',
        cancelButtonColor: '#aaa',
        confirmButtonText: 'ใช่, ออกจากระบบ',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            clearUserSession();
            location.reload();
        }
    });
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

    if (currentUser && currentUser.status === 'waiting_approval') {
        if (typeof switchTab === 'function') switchTab('stories');
    } else {
        if (typeof switchTab === 'function') switchTab('stories');
    }

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

    // 🌟 [REALTIME SYNC] เริ่มระบบรับข้อมูลแบบเรียลไทม์
    if (typeof setupRealtimeListeners === 'function') setupRealtimeListeners();

    // 🌟 [BACKGROUND SYNC] ตั้งเวลาดึงข้อมูลใหม่เบื้องหลังทุกๆ 5 นาที (300,000 ms)
    if (!window._bgSyncTimer) {
        window._bgSyncTimer = setInterval(() => {
            console.log('🔄 Automatic Background Sync...');
            if (typeof fetchManagerData === 'function') fetchManagerData(true);
            if (typeof fetchFeed === 'function') fetchFeed(false, true); // Refresh feed silently
        }, 300000); 
    }

    // 🌟 [WEB PUSH INITIALIZATION]
    if (typeof initPushNotification === 'function') {
        setTimeout(() => {
            initPushNotification().catch(err => console.error('Push Init Error:', err));
        }, 1500);
    }

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


    if (typeof checkAndShowWeatherAlert === 'function') await checkAndShowWeatherAlert();
    if (typeof requestNotificationPermission === 'function') await requestNotificationPermission();
}

// ============================================================
// ⚡ Realtime Update: ระบบรับการเปลี่ยนแปลงข้อมูลแบบเรียลไทม์
// ============================================================
function setupRealtimeListeners() {
    if (!READ_FROM_SUPABASE || !supabaseClient) return;

    console.log('⚡ Initializing Supabase Realtime Listeners...');

    // 1. รับการแจ้งเตือนเมื่อมีการโพสต์ หรือแก้ไขข้อมูล (Activities)
    supabaseClient
        .channel('activities-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Activities' }, payload => {
            console.log('🔔 Realtime: Activities movement detected!', payload.eventType);
            
            // 🚀 [IMMEDIATE CALCULATION] ดึงข้อมูลมาคำนวณใหม่ทันทีเพื่อให้คะแนนขยับ
            if (typeof fetchManagerData === 'function') {
                fetchManagerData(true); 
            }

            // รีเฟรช Feed แบบเงียบๆ
            if (typeof fetchFeed === 'function') {
                fetchFeed(false, true); 
            }

            // ถ้าเป็นงานที่เกี่ยวกับเราโดยตรง (เราเป็นคนโพสต์ หรือถูกแท็ก หรือถูกยืนยัน)
            const post = payload.new || payload.old;
            if (post && currentUser) {
                const isRelated = 
                    post.UserId === currentUser.userId || 
                    (post.Tagged && post.Tagged.includes(currentUser.userId)) ||
                    (payload.eventType === 'UPDATE' && post.JSON && post.JSON.includes(currentUser.userId));

                if (isRelated) {
                    console.log('✨ [TARGETED] การเคลื่อนไหวนี้เกี่ยวข้องกับคุณ! กำลังรีเฟรชแต้มส่วนตัว...');
                    // เพิ่มความเร็วในการเห็นผลสำหรับเจ้าของเครื่อง
                    setTimeout(() => {
                        if (typeof renderProfile === 'function') renderProfile();
                    }, 500);
                }
            }
        })
        .subscribe();

    // 2. รับการแจ้งเตือนเมื่อมีการอัปเดตข้อมูลผู้ใช้ (Users) เช่น คะแนนเปลี่ยน
    supabaseClient
        .channel('users-realtime')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Users' }, payload => {
            const updatedUser = payload.new;
            if (!updatedUser) return;

            console.log('🔔 Realtime: User data updated', updatedUser.LineID);

            // ถ้าข้อมูลที่เปลี่ยนเป็นของเราเอง ให้รีเฟรชโปรไฟล์ทันที
            if (currentUser && updatedUser.LineID === currentUser.userId) {
                currentUser.score = updatedUser.Score || currentUser.score;
                currentUser.level = updatedUser.Level || currentUser.level;
                currentUser.happyScore = parseFloat(updatedUser.HappyScore) || parseFloat(updatedUser.Happy) || currentUser.happyScore;
                if (updatedUser.Image) currentUser.img = updatedUser.Image;
                if (updatedUser.Name) currentUser.name = updatedUser.Name;
                
                saveUserSession(currentUser);
                if (typeof renderProfile === 'function') renderProfile();
            }

            // อัปเดตข้อมูลใน Cache กลางด้วย
            if (updatedUser.LineID && allUsersMap[updatedUser.LineID]) {
                const mappedUpdate = {
                    lineId: updatedUser.LineID,
                    name: updatedUser.Name || allUsersMap[updatedUser.LineID].name,
                    img: updatedUser.Image || allUsersMap[updatedUser.LineID].img,
                    role: updatedUser.Role || allUsersMap[updatedUser.LineID].role,
                    score: updatedUser.Score || allUsersMap[updatedUser.LineID].score,
                    level: updatedUser.Level || allUsersMap[updatedUser.LineID].level,
                    lastDate: updatedUser.LastDate || allUsersMap[updatedUser.LineID].lastDate,
                    lastTime: updatedUser.LastTime || allUsersMap[updatedUser.LineID].lastTime,
                    department: updatedUser.Department || allUsersMap[updatedUser.LineID].department,
                    virtueStats: updatedUser.VirtueStats || allUsersMap[updatedUser.LineID].virtueStats
                };
                Object.assign(allUsersMap[updatedUser.LineID], mappedUpdate);
            }
        })
        .subscribe();
}

// ============================================================
// 📱ระบบ Web Push Notification (Android / iOS PWA)
// ============================================================

// แปลง VAPID Public Key จาก Base64 เป็น Uint8Array
function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// เริ่มต้นระบบ Push Notification
async function initPushNotification() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push Notifications are not supported in this browser.');
        return;
    }

    // เฉพาะผู้ใช้ที่ล็อกอินสมบูรณ์แล้วเท่านั้น
    if (!currentUser || !currentUser.userId) {
        console.warn('initPushNotification: No logged in user found.');
        return;
    }

    try {
        // 1. ตรวจสอบว่า Service Worker พร้อมใช้งานแล้วหรือไม่
        const registration = await navigator.serviceWorker.register('sw.js');
        console.log('Service Worker registered successfully:', registration.scope);

        // 2. หากยังไม่ได้รับอนุญาตแจ้งเตือน หรือถูกบล็อกไว้
        if (Notification.permission === 'denied') {
            console.warn('Notifications are blocked by the user.');
            return;
        }

        // 3. กำหนด VAPID Public Key (สำหรับสื่อสารระหว่างแอปกับเบราว์เซอร์)
        const publicKey = 'BLZySK6qzklQzPBardLy77Y_Spqt85pVvJB0ESISrRwRHFAJ4SyN9rOGPHGmaAW5eNlRliVuz3_kSl1w-X7-o5A'; 

        // 4. ขอสิทธิ์และเปิดกล่องรับข้อความ (Subscribe)
        // ยกเลิกการลงทะเบียนเครื่องเดิมก่อนหน้า เพื่อให้สามารถใช้กุญแจ VAPID อันใหม่ได้ราบรื่น
        let subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            console.log('🔄 Unsubscribing old subscription to apply new VAPID key...');
            await subscription.unsubscribe();
        }

        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(publicKey)
        });

        // 5. ส่งข้อมูล Token ไปเก็บันทึกบน Supabase
        if (READ_FROM_SUPABASE && supabaseClient) {
            const subObj = subscription.toJSON();
            const p256dh = subObj.keys.p256dh;
            const auth = subObj.keys.auth;

            const { error } = await supabaseClient.from('UserSubscriptions').upsert({
                LineID: currentUser.userId,
                endpoint: subscription.endpoint,
                p256dh: p256dh,
                auth: auth,
                platform: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'android'
            }, { onConflict: 'endpoint' });

            if (error) {
                console.error('❌ Failed to save Subscription to Supabase:', error);
            } else {
                console.log('✅ Subscription successfully saved/updated in Supabase');
            }
        }
    } catch (error) {
        console.error('❌ Error during Push Notification setup:', error);
    }
}

// ฟังก์ชันสำหรับเรียกยิง Push Notification ไปยังหลังบ้าน (Supabase Edge Function)
async function triggerPushNotification(title, body, url = '/', targetLineId = 'all') {
    if (!READ_FROM_SUPABASE || !supabaseClient) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({
                title: title,
                body: body,
                url: url,
                targetLineId: targetLineId
            })
        });
        const result = await response.json();
        console.log('📢 Push Notification trigger response:', result);
        return result;
    } catch (e) {
        console.error('❌ Failed to trigger Push Notification:', e);
    }
}