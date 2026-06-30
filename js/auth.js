// ============================================================
// 🔐  auth.js — LIFF Authentication & User Management
//     ต้องโหลดหลัง config.js
// ============================================================

// --- โหลดรายชื่อผู้ใช้ทั้งหมดเข้า Cache ---
// --- โหลดรายชื่อผู้ใช้ทั้งหมดเข้า Cache ---
async function cacheUsers() {
    const requestedHouse = typeof getActiveHouseCode === 'function'
        ? getActiveHouseCode()
        : (currentUser?.groupCode || window.currentUser?.groupCode || '').trim().toUpperCase();
    const requestId = ++userCacheRequestId;

    if (READ_FROM_SUPABASE && supabaseClient) {
        try {
            let query = supabaseClient.from('Users').select('*');
            const gCode = typeof getActiveHouseCode === 'function'
                ? getActiveHouseCode()
                : (currentUser?.groupCode || window.currentUser?.groupCode || '').trim().toUpperCase();
            const isHQUser = gCode === 'HQ' || gCode === 'ALL';
            if (gCode && !isHQUser) {
                query = query.eq('GroupCode', gCode);
            }
            const { data, error } = await query;

            if (error) throw error;

            if (data) {
                if (requestId !== userCacheRequestId || getActiveHouseCode() !== requestedHouse) return;
                Object.keys(allUsersMap || {}).forEach(key => delete allUsersMap[key]);
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
                        groupCode: u.GroupCode || '', // CACHE GROUP CODE
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
                if (requestId !== userCacheRequestId || getActiveHouseCode() !== requestedHouse) return resolve();
                const scopedUsers = data.filter(u => {
                    if (!requestedHouse || requestedHouse === 'HQ' || requestedHouse === 'ALL') return true;
                    return String(u.groupCode || u.GroupCode || '').trim().toUpperCase() === requestedHouse;
                });
                Object.keys(allUsersMap || {}).forEach(key => delete allUsersMap[key]);
                scopedUsers.forEach(u => { allUsersMap[u.lineId] = u; });
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

function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function versionLineProfileImage(url, dateKey = getLocalDateKey()) {
    let cleanUrl = String(url || '');
    try {
        const parsedUrl = new URL(cleanUrl);
        parsedUrl.searchParams.delete('hm_profile_day');
        cleanUrl = parsedUrl.toString();
    } catch (e) {
        cleanUrl = cleanUrl
            .replace(/([?&])hm_profile_day=[^&#]*/g, '$1')
            .replace(/[?&]$/, '');
    }
    if (!cleanUrl) return '';
    return cleanUrl + (cleanUrl.includes('?') ? '&' : '?') +
        'hm_profile_day=' + encodeURIComponent(dateKey);
}

async function syncLineProfileDaily(force = false) {
    if (!currentUser?.userId || typeof liff === 'undefined') return;

    const todayKey = getLocalDateKey();
    const syncStorageKey = `line_profile_synced_${currentUser.userId}`;
    if (!force && safeGetItem(syncStorageKey) === todayKey) return;

    try {
        if (!liff.isLoggedIn()) return;
        const profile = await liff.getProfile();
        if (!profile || profile.userId !== currentUser.userId) return;

        const metadata = getAuthMetadata(currentUser);
        const versionedImage = metadata.profileImageManual
            ? currentUser.img
            : versionLineProfileImage(profile.pictureUrl || '', todayKey);
        const nextName = metadata.profileNameManual
            ? currentUser.name
            : (profile.displayName || currentUser.name);
        const profileChanged = versionedImage !== currentUser.img || nextName !== currentUser.name;

        currentUser.img = versionedImage || currentUser.img;
        currentUser.name = nextName;
        safeSetItem('liff_pictureUrl', versionedImage);
        safeSetItem('liff_displayName', nextName);
        saveUserSession(currentUser);

        if (allUsersMap?.[currentUser.userId]) {
            allUsersMap[currentUser.userId].img = currentUser.img;
            allUsersMap[currentUser.userId].name = currentUser.name;
        }
        if (typeof renderProfile === 'function') renderProfile();

        if (profileChanged && READ_FROM_SUPABASE && supabaseClient) {
            const { error } = await supabaseClient.from('Users')
                .update({ Image: currentUser.img, Name: currentUser.name })
                .eq('LineID', currentUser.userId);
            if (error) throw error;
        } else if (profileChanged) {
            await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'check_user',
                    userId: currentUser.userId,
                    img: currentUser.img,
                    name: currentUser.name
                })
            });
        }
        safeSetItem(syncStorageKey, todayKey);
        console.log('✅ LINE profile synchronized for', todayKey);
    } catch (e) {
        console.warn('Daily LINE profile sync failed:', e);
    }
}

const PASSWORD_ACCOUNT_DOMAIN = 'accounts.happiness.local';
const USERNAME_PATTERN = /^[a-z]+_[a-z]{2}\d*$/;

function normalizeAccountUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function getPasswordAccountEmail(username) {
    return `${normalizeAccountUsername(username)}@${PASSWORD_ACCOUNT_DOMAIN}`;
}

function getAuthMetadata(userRowOrStats) {
    let stats = userRowOrStats?.VirtueStats || userRowOrStats?.virtueStats || userRowOrStats || {};
    if (typeof stats === 'string') {
        try { stats = JSON.parse(stats); } catch (e) { stats = {}; }
    }
    return {
        authUserId: String(stats?._authUserId || ''),
        username: normalizeAccountUsername(stats?._username),
        provider: String(stats?._authProvider || ''),
        profileNameManual: stats?._profileNameManual === true,
        profileImageManual: stats?._profileImageManual === true
    };
}

async function findUserByAuthId(authUserId) {
    if (!authUserId || !supabaseClient) return null;
    const { data, error } = await supabaseClient
        .from('Users')
        .select('*');
    if (error) throw error;
    return (data || []).find(row => getAuthMetadata(row).authUserId === authUserId) || null;
}

async function invokeAccountAuth(payload) {
    const { data, error } = await supabaseClient.functions.invoke('account-auth', { body: payload });
    if (error) {
        let message = error.message || 'เชื่อมต่อระบบบัญชีไม่สำเร็จ';
        try {
            const responseBody = await error.context?.json();
            message = responseBody?.error || message;
        } catch (e) { }
        throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
}

async function getFunctionErrorMessage(error, fallback = 'ดำเนินการไม่สำเร็จ') {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    try {
        const responseBody = await error.context?.json();
        if (typeof responseBody === 'string') return responseBody;
        return responseBody?.error || responseBody?.message || JSON.stringify(responseBody);
    } catch (e) { }
    if (typeof error.message === 'string') return error.message;
    if (error.message && typeof error.message === 'object') {
        return error.message.error || error.message.message || JSON.stringify(error.message);
    }
    try {
        return JSON.stringify(error);
    } catch (e) {
        return fallback;
    }
}

async function invokeAiPostFunction(body) {
    let accessToken = '';
    try {
        const sessionRes = await supabaseClient?.auth?.getSession();
        accessToken = sessionRes?.data?.session?.access_token || '';
    } catch (e) { }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-post`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${accessToken || SUPABASE_KEY}`
        },
        body: JSON.stringify(body || {})
    });
    const text = await res.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        data = { error: text || `HTTP ${res.status}` };
    }
    if (!res.ok || data?.error) {
        throw new Error(data?.error || data?.message || `Edge Function HTTP ${res.status}`);
    }
    return data;
}

async function getAiPostIdentityPayload() {
    const payload = { lineId: currentUser?.userId || '' };
    const metadata = getAuthMetadata(currentUser || {});
    if (metadata.username) payload.username = metadata.username;
    try {
        const sessionRes = await supabaseClient?.auth?.getSession();
        payload.hasPasswordSession = !!sessionRes?.data?.session?.access_token;
        const sessionUsername = String(sessionRes?.data?.session?.user?.email || '').split('@')[0].trim().toLowerCase();
        if (!payload.username && sessionUsername) payload.username = sessionUsername;
    } catch (e) {
        payload.hasPasswordSession = false;
    }
    try {
        if (typeof liff !== 'undefined') {
            try { await liff.init({ liffId: LIFF_ID }); } catch (initError) { }
        }
        if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
            const token = liff.getIDToken();
            if (token) {
                payload.lineIdToken = token;
                payload.lineClientId = String(LIFF_ID).split('-')[0];
            }
        }
        payload.hasLineToken = !!payload.lineIdToken;
    } catch (e) {
        console.warn('Unable to attach LINE identity for AI post:', e);
        payload.hasLineToken = false;
    }
    return payload;
}

async function refreshPasswordResetBadge(silent = true) {
    const settingsBtn = document.getElementById('accountSettingsBtn');
    if (!settingsBtn || !currentUser || !canManageSystem()) return 0;
    try {
        const result = await invokeAccountAuth({ action: 'list-password-reset-requests' });
        const count = (result.requests || []).length;
        window.pendingPasswordResetCount = count;

        let badge = document.getElementById('passwordResetBadge');
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'passwordResetBadge';
            badge.className = 'notif-count-badge';
            settingsBtn.style.position = settingsBtn.style.position || 'relative';
            settingsBtn.appendChild(badge);
        }
        if (count > 0) {
            badge.style.display = 'flex';
            badge.innerText = count > 9 ? '9+' : String(count);
            settingsBtn.title = `ตั้งค่าบัญชีและโปรไฟล์ (${count} คำขอรีเซ็ตรหัสผ่าน)`;
            if (!silent && typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'info',
                    title: 'มีคำขอรีเซ็ตรหัสผ่าน',
                    text: `มีคำขอรอจัดการ ${count} รายการ`,
                    showCancelButton: true,
                    confirmButtonText: 'เปิดรายการ',
                    cancelButtonText: 'ไว้ก่อน'
                }).then(result => {
                    if (result.isConfirmed) showPasswordResetRequests();
                });
            }
        } else {
            badge.style.display = 'none';
            settingsBtn.title = 'ตั้งค่าบัญชีและโปรไฟล์';
        }
        return count;
    } catch (e) {
        console.warn('Unable to refresh password reset badge:', e);
        return 0;
    }
}

async function restorePasswordAccountSession() {
    if (!supabaseClient) return false;
    const { data } = await supabaseClient.auth.getSession();
    const authUser = data?.session?.user;
    if (!authUser) return false;
    const userRow = await findUserByAuthId(authUser.id);
    if (!userRow) {
        await supabaseClient.auth.signOut();
        return false;
    }
    await checkUser(userRow.LineID, null);
    return true;
}

function showLoginScreen() {
    const loading = document.getElementById('loading');
    if (!loading) return;
    loading.style.display = 'block';
    loading.classList.remove('hiding');
    loading.innerHTML = `
        <div class="text-center p-4 login-card" style="max-width:390px; background:var(--glass-bg); border-radius:30px; border:1px solid var(--border-color); box-shadow:0 15px 35px rgba(0,0,0,.12);">
            <img src="app-icon.png?v=3" style="width:88px;height:88px;border-radius:22px;box-shadow:0 10px 25px rgba(108,92,231,.2);margin-bottom:14px;">
            <h3 class="fw-bold mb-1" style="color:var(--primary-color);">เข้าสู่ระบบ</h3>
            <p class="text-muted small mb-3">ใช้ Username และรหัสผ่าน หรือใช้ LINE เดิมในช่วงเปลี่ยนผ่าน</p>
            <div class="input-group mb-2 border rounded-3 overflow-hidden">
                <span class="input-group-text bg-white border-0"><i class="fas fa-user"></i></span>
                <input type="text" id="manualUsername" class="form-control border-0 shadow-none" autocomplete="username" placeholder="เช่น somchai_ja">
            </div>
            <div class="input-group mb-3 border rounded-3 overflow-hidden">
                <span class="input-group-text bg-white border-0"><i class="fas fa-lock"></i></span>
                <input type="password" id="manualPassword" class="form-control border-0 shadow-none" autocomplete="current-password" placeholder="รหัสผ่านอย่างน้อย 8 ตัว">
            </div>
            <button onclick="doManualLogin()" class="btn btn-primary rounded-pill w-100 fw-bold mb-2" style="height:48px;">
                เข้าสู่ระบบ
            </button>
            <button onclick="showForgotPasswordRequest()" class="btn btn-link w-100 small text-decoration-none mb-2">
                ลืมรหัสผ่าน / ขอให้แอดมินรีเซ็ต
            </button>
            <button onclick="showPasswordRegistration()" class="btn btn-outline-primary rounded-pill w-100 fw-bold mb-3" style="height:45px;">
                สมัครสมาชิกใหม่
            </button>
            <div class="d-flex align-items-center gap-2 my-3 text-muted small"><span class="flex-grow-1 border-top"></span>หรือ<span class="flex-grow-1 border-top"></span></div>
            <button onclick="doLineLogin()" class="btn btn-success rounded-pill w-100 fw-bold" style="height:48px;background:#06C755;border:none;">
                <i class="fab fa-line me-2"></i>เข้าใช้งานด้วย LINE เดิม
            </button>
            <div class="small text-muted mt-3">สมาชิกเดิมสามารถเข้า LINE แล้วตั้ง Username/Password ภายหลังได้ โดยคะแนนและประวัติไม่หาย</div>
        </div>`;
}

async function fileToProfileDataUrl(file) {
    if (!file) return '';
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('รองรับรูป PNG, JPG หรือ WEBP เท่านั้น');
    if (file.size > 10 * 1024 * 1024) throw new Error('รูปต้นฉบับต้องมีขนาดไม่เกิน 10 MB');
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'));
        reader.readAsDataURL(file);
    });
}

async function cropProfileImage(file) {
    if (!file) return '';
    const sourceDataUrl = await fileToProfileDataUrl(file);
    const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('เปิดไฟล์รูปไม่สำเร็จ'));
        img.src = sourceDataUrl;
    });

    const cropSize = 320;
    const outputSize = 512;
    let zoom = 1;
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const getBaseScale = () => Math.max(cropSize / image.naturalWidth, cropSize / image.naturalHeight);
    const clampOffsets = () => {
        const scale = getBaseScale() * zoom;
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        const maxX = Math.max(0, (width - cropSize) / 2);
        const maxY = Math.max(0, (height - cropSize) / 2);
        offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
        offsetY = Math.max(-maxY, Math.min(maxY, offsetY));
    };
    const drawCrop = (canvas, size = cropSize) => {
        const ctx = canvas.getContext('2d');
        const ratio = size / cropSize;
        const scale = getBaseScale() * zoom * ratio;
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(
            image,
            (size - width) / 2 + offsetX * ratio,
            (size - height) / 2 + offsetY * ratio,
            width,
            height
        );
    };

    const result = await Swal.fire({
        title: 'จัดตำแหน่งรูปโปรไฟล์',
        width: 390,
        showCancelButton: true,
        confirmButtonText: 'ใช้รูปนี้',
        cancelButtonText: 'ยกเลิก',
        html: `
            <div class="mx-auto" style="position:relative;width:min(320px,78vw);aspect-ratio:1;overflow:hidden;border-radius:18px;background:#111;touch-action:none;cursor:grab;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15);">
                <canvas id="profileCropCanvas" width="${cropSize}" height="${cropSize}" style="display:block;width:100%;height:100%;touch-action:none;"></canvas>
                <div style="position:absolute;inset:7%;border:2px solid rgba(255,255,255,.9);border-radius:50%;pointer-events:none;box-shadow:0 0 0 999px rgba(0,0,0,.28);"></div>
            </div>
            <div class="d-flex align-items-center gap-2 mt-3 px-2">
                <i class="fas fa-search-minus text-muted"></i>
                <input id="profileCropZoom" type="range" class="form-range mb-0" min="1" max="3" step="0.01" value="1">
                <i class="fas fa-search-plus text-muted"></i>
            </div>
            <div class="small text-muted mt-1">ลากรูปเพื่อเลือกตำแหน่ง และเลื่อนแถบเพื่อย่อหรือขยาย</div>`,
        didOpen: () => {
            const canvas = document.getElementById('profileCropCanvas');
            const zoomInput = document.getElementById('profileCropZoom');
            drawCrop(canvas);

            zoomInput.addEventListener('input', () => {
                zoom = Number(zoomInput.value);
                clampOffsets();
                drawCrop(canvas);
            });
            canvas.addEventListener('pointerdown', event => {
                dragging = true;
                lastX = event.clientX;
                lastY = event.clientY;
                canvas.setPointerCapture(event.pointerId);
            });
            canvas.addEventListener('pointermove', event => {
                if (!dragging) return;
                const displayScale = cropSize / canvas.getBoundingClientRect().width;
                offsetX += (event.clientX - lastX) * displayScale;
                offsetY += (event.clientY - lastY) * displayScale;
                lastX = event.clientX;
                lastY = event.clientY;
                clampOffsets();
                drawCrop(canvas);
            });
            const stopDragging = event => {
                dragging = false;
                if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
            };
            canvas.addEventListener('pointerup', stopDragging);
            canvas.addEventListener('pointercancel', stopDragging);
        },
        preConfirm: () => {
            const output = document.createElement('canvas');
            output.width = outputSize;
            output.height = outputSize;
            drawCrop(output, outputSize);
            return output.toDataURL('image/jpeg', 0.86);
        }
    });

    return result.isConfirmed ? result.value : '';
}

async function showPasswordRegistration() {
    const pendingHouse = String(safeGetItem('pending_join_house') || '').trim().toUpperCase();
    const { value } = await Swal.fire({
        title: 'สมัครสมาชิก',
        width: 430,
        showCancelButton: true,
        confirmButtonText: 'สมัครสมาชิก',
        cancelButtonText: 'ยกเลิก',
        focusConfirm: false,
        html: `
            <div class="text-start">
                <label class="small fw-bold">ชื่อ-นามสกุล</label>
                <input id="accountFullName" class="form-control mb-2" placeholder="ชื่อและนามสกุลจริง">
                <label class="small fw-bold">Username</label>
                <input id="accountUsername" class="form-control mb-1" autocomplete="username" placeholder="เช่น somchai_ja">
                <div class="small text-muted mb-2">ชื่อภาษาอังกฤษ + _ + อักษรนามสกุล 2 ตัวแรก</div>
                <label class="small fw-bold">รหัสผ่าน</label>
                <input id="accountPassword" type="password" class="form-control mb-2" autocomplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร">
                <label class="small fw-bold">ยืนยันรหัสผ่าน</label>
                <input id="accountPasswordConfirm" type="password" class="form-control mb-2" autocomplete="new-password">
                <label class="small fw-bold">บ้าน</label>
                <input id="accountHouse" class="form-control mb-2" value="${pendingHouse}" ${pendingHouse ? 'readonly' : ''} placeholder="กรอกรหัสบ้าน หรือเปิดจาก QR Code">
                <label class="small fw-bold">ตำแหน่ง</label>
                <input id="accountPosition" class="form-control mb-2">
                <label class="small fw-bold">จังหวัด</label>
                <input id="accountProvince" class="form-control mb-2">
                <label class="small fw-bold">รูปโปรไฟล์ (ไม่บังคับ)</label>
                <input id="accountImage" type="file" class="form-control" accept="image/png,image/jpeg,image/webp">
            </div>`,
        preConfirm: async () => {
            const fullName = document.getElementById('accountFullName').value.trim();
            const username = normalizeAccountUsername(document.getElementById('accountUsername').value);
            const password = document.getElementById('accountPassword').value;
            const confirmPassword = document.getElementById('accountPasswordConfirm').value;
            const groupCode = document.getElementById('accountHouse').value.trim().toUpperCase();
            if (!fullName || !groupCode) return Swal.showValidationMessage('กรุณากรอกชื่อและบ้านให้ครบ');
            if (!USERNAME_PATTERN.test(username)) return Swal.showValidationMessage('Username ต้องเป็นรูปแบบ somchai_ja');
            if (password.length < 8) return Swal.showValidationMessage('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
            if (password !== confirmPassword) return Swal.showValidationMessage('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
            return {
                fullName, username, password, groupCode,
                imageFile: document.getElementById('accountImage').files[0] || null,
                position: document.getElementById('accountPosition').value.trim(),
                province: document.getElementById('accountProvince').value.trim()
            };
        }
    });
    if (!value) return;

    if (value.imageFile) {
        try {
            value.imageDataUrl = await cropProfileImage(value.imageFile);
            if (!value.imageDataUrl) return;
        } catch (e) {
            return Swal.fire('ใช้รูปนี้ไม่ได้', e.message, 'error');
        }
    }
    delete value.imageFile;

    Swal.fire({ title: 'กำลังสร้างบัญชี...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const result = await invokeAccountAuth({ action: 'register', ...value });
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: result.email,
            password: value.password
        });
        if (error) throw error;
        localStorage.removeItem('pending_join_house');
        localStorage.removeItem('pending_join_role');
        await checkUser(result.lineId, null);
        Swal.fire('สมัครสำเร็จ', 'บัญชีถูกสร้างและอยู่ระหว่างรอผู้ดูแลบ้านอนุมัติ', 'success');
    } catch (e) {
        Swal.fire('สมัครไม่สำเร็จ', e.message, 'error');
    }
}

async function showAccountSettings() {
    if (!currentUser) return;
    const metadata = getAuthMetadata(currentUser);
    const hasPasswordAccount = !!metadata.authUserId;
    const resetCount = Number(window.pendingPasswordResetCount || 0);
    const { value: action } = await Swal.fire({
        title: 'ตั้งค่าบัญชีและโปรไฟล์',
        showCancelButton: true,
        confirmButtonText: 'ดำเนินการ',
        cancelButtonText: 'ปิด',
        html: `
            <div class="text-start">
                ${!hasPasswordAccount ? `
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="accountAction" id="accountActionLink" value="link" checked>
                        <label class="form-check-label" for="accountActionLink">ตั้ง Username และรหัสผ่าน</label>
                    </div>
                    <hr>` : `
                    <div class="small text-success mb-1"><i class="fas fa-check-circle"></i> Username: <b>${metadata.username}</b></div>
                    <div class="form-check my-2">
                        <input class="form-check-input" type="radio" name="accountAction" id="accountActionPassword" value="password" checked>
                        <label class="form-check-label" for="accountActionPassword">เปลี่ยนรหัสผ่าน</label>
                    </div>
                    <hr>
                `}
                    <div class="form-check my-2">
                        <input class="form-check-input" type="radio" name="accountAction" id="accountActionName" value="name">
                        <label class="form-check-label" for="accountActionName">เปลี่ยนชื่อโปรไฟล์</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="accountAction" id="accountActionImage" value="image">
                        <label class="form-check-label" for="accountActionImage">เปลี่ยนรูปโปรไฟล์</label>
                    </div>
                    ${canManageSystem() ? `
                    <div class="form-check mt-2">
                        <input class="form-check-input" type="radio" name="accountAction" id="accountActionAIKey" value="aiKey">
                        <label class="form-check-label" for="accountActionAIKey">ตั้งค่า AI ช่วยเขียนโพส</label>
                    </div>
                    <div class="form-check mt-2">
                        <input class="form-check-input" type="radio" name="accountAction" id="accountActionResetRequests" value="resetRequests">
                        <label class="form-check-label" for="accountActionResetRequests">จัดการคำขอรีเซ็ตรหัสผ่าน${resetCount ? ` <span class="badge bg-danger">${resetCount}</span>` : ''}</label>
                    </div>` : ''}
                    <div class="form-check mt-2 text-danger">
                        <input class="form-check-input" type="radio" name="accountAction" id="accountActionLogout" value="logout">
                        <label class="form-check-label" for="accountActionLogout">ออกจากระบบ</label>
                    </div>
            </div>`,
        preConfirm: () => document.querySelector('input[name="accountAction"]:checked')?.value
    });
    if (!action) return;
    if (action === 'link') return setupPasswordForLineUser();
    if (action === 'password') return changePasswordAccount();
    if (action === 'name') return changeOwnProfileName();
    if (action === 'image') return uploadOwnProfileImage();
    if (action === 'aiKey') return manageAiPostKey();
    if (action === 'resetRequests') return showPasswordResetRequests();
    if (action === 'logout') return doLogout();
}

const PENDING_LINE_ACCOUNT_SETUP_KEY = 'pending_line_account_setup';

async function resumePendingLineAccountSetup() {
    if (safeGetItem(PENDING_LINE_ACCOUNT_SETUP_KEY) !== '1' || !currentUser) return;
    if (getAuthMetadata(currentUser).authUserId) {
        localStorage.removeItem(PENDING_LINE_ACCOUNT_SETUP_KEY);
        return;
    }

    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) return;
        const profile = await liff.getProfile();
        if (profile.userId !== currentUser.userId) {
            localStorage.removeItem(PENDING_LINE_ACCOUNT_SETUP_KEY);
            return Swal.fire('บัญชี LINE ไม่ตรงกัน', 'กรุณาเข้า LINE ด้วยบัญชีเดิมที่ใช้ในระบบ', 'warning');
        }
        localStorage.removeItem(PENDING_LINE_ACCOUNT_SETUP_KEY);
        setTimeout(() => setupPasswordForLineUser(), 350);
    } catch (e) {
        console.warn('Unable to resume LINE account setup:', e);
    }
}

async function setupPasswordForLineUser() {
    if (!String(currentUser?.userId || '').startsWith('U')) {
        return Swal.fire('ไม่สามารถเชื่อมได้', 'ฟังก์ชันนี้ใช้สำหรับสมาชิกเดิมที่เข้าใช้งานผ่าน LINE', 'info');
    }
    if (typeof liff === 'undefined') return Swal.fire('กรุณาเปิดผ่าน LINE', '', 'info');
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
            safeSetItem(PENDING_LINE_ACCOUNT_SETUP_KEY, '1');
            liff.login();
            return;
        }
    } catch (e) {
        return Swal.fire('ยืนยัน LINE ไม่สำเร็จ', e.message, 'error');
    }
    const { value } = await Swal.fire({
        title: 'ตั้งค่าบัญชีใหม่',
        showCancelButton: true,
        confirmButtonText: 'เชื่อมบัญชี',
        html: `
            <input id="linkUsername" class="swal2-input" placeholder="เช่น somchai_ja">
            <input id="linkPassword" type="password" class="swal2-input" placeholder="รหัสผ่านอย่างน้อย 8 ตัว">
            <input id="linkPasswordConfirm" type="password" class="swal2-input" placeholder="ยืนยันรหัสผ่าน">`,
        preConfirm: () => {
            const username = normalizeAccountUsername(document.getElementById('linkUsername').value);
            const password = document.getElementById('linkPassword').value;
            if (!USERNAME_PATTERN.test(username)) return Swal.showValidationMessage('Username ต้องเป็นรูปแบบ somchai_ja');
            if (password.length < 8) return Swal.showValidationMessage('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
            if (password !== document.getElementById('linkPasswordConfirm').value) return Swal.showValidationMessage('รหัสผ่านไม่ตรงกัน');
            return { username, password };
        }
    });
    if (!value) return;
    Swal.fire({ title: 'กำลังเชื่อมบัญชี...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const lineIdToken = liff.getIDToken();
        if (!lineIdToken) throw new Error('LINE ไม่ได้ส่งข้อมูลยืนยันตัวตน กรุณาเปิดระบบผ่านแอป LINE แล้วลองอีกครั้ง');
        const result = await invokeAccountAuth({
            action: 'link-line',
            lineId: currentUser.userId,
            lineIdToken,
            lineClientId: String(LIFF_ID).split('-')[0],
            ...value
        });
        const { error } = await supabaseClient.auth.signInWithPassword({ email: result.email, password: value.password });
        if (error) throw error;
        currentUser.virtueStats = {
            ...(currentUser.virtueStats || {}),
            _authUserId: (await supabaseClient.auth.getUser()).data.user?.id,
            _username: value.username,
            _authProvider: 'password'
        };
        saveUserSession(currentUser);
        Swal.fire('เชื่อมบัญชีสำเร็จ', 'ครั้งต่อไปสามารถใช้ Username และรหัสผ่านได้', 'success');
    } catch (e) {
        Swal.fire('เชื่อมบัญชีไม่สำเร็จ', e.message, 'error');
    }
}

async function changePasswordAccount() {
    const { value: password } = await Swal.fire({
        title: 'เปลี่ยนรหัสผ่าน',
        input: 'password',
        inputPlaceholder: 'รหัสผ่านใหม่อย่างน้อย 8 ตัว',
        showCancelButton: true,
        inputValidator: value => value.length < 8 ? 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' : undefined
    });
    if (!password) return;
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) return Swal.fire('เปลี่ยนรหัสผ่านไม่สำเร็จ', error.message, 'error');
    Swal.fire('เรียบร้อย', 'เปลี่ยนรหัสผ่านแล้ว', 'success');
}

async function showForgotPasswordRequest() {
    const { value } = await Swal.fire({
        title: 'ลืมรหัสผ่าน',
        showCancelButton: true,
        confirmButtonText: 'ส่งคำขอให้แอดมิน',
        cancelButtonText: 'ยกเลิก',
        html: `
            <div class="text-start">
                <label class="form-label small fw-bold">Username</label>
                <input id="forgotUsername" class="form-control mb-2" autocomplete="username" placeholder="เช่น somchai_ja">
                <label class="form-label small fw-bold">รายละเอียดเพิ่มเติม (ถ้ามี)</label>
                <textarea id="forgotNote" class="form-control" rows="2" placeholder="เช่น ชื่อจริง / บ้าน / เบอร์ติดต่อ"></textarea>
                <div class="small text-muted mt-2">ระบบจะส่งคำขอให้แอดมินบ้านตรวจสอบ แล้วตั้งรหัสชั่วคราวให้</div>
            </div>`,
        preConfirm: () => {
            const username = normalizeAccountUsername(document.getElementById('forgotUsername').value);
            const note = document.getElementById('forgotNote').value.trim();
            if (!USERNAME_PATTERN.test(username)) return Swal.showValidationMessage('กรุณากรอก Username รูปแบบ somchai_ja');
            return { username, note };
        }
    });
    if (!value) return;

    Swal.fire({ title: 'กำลังส่งคำขอ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await invokeAccountAuth({ action: 'request-password-reset', ...value });
        Swal.fire('ส่งคำขอแล้ว', 'ระบบแจ้งเตือนไปยัง Admin/Manager ของบ้านแล้ว หากคุณเป็น admin ที่ลืมรหัสเอง ให้ติดต่อ admin คนอื่นหรือ superadmin เพื่อรีเซ็ตให้', 'success');
    } catch (e) {
        Swal.fire('ส่งคำขอไม่สำเร็จ', e.message, 'error');
    }
}

async function showPasswordResetRequests() {
    if (!canManageSystem()) return Swal.fire('ไม่มีสิทธิ์', 'เมนูนี้สำหรับ Admin/Manager เท่านั้น', 'warning');
    Swal.fire({ title: 'กำลังโหลดคำขอ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const result = await invokeAccountAuth({ action: 'list-password-reset-requests' });
        const requests = result.requests || [];
        if (!requests.length) return Swal.fire('ยังไม่มีคำขอ', 'ยังไม่มีสมาชิกขอรีเซ็ตรหัสผ่านในบ้านที่คุณดูแล', 'info');

        const rows = requests.map((item, index) => `
            <button type="button" class="list-group-item list-group-item-action text-start reset-request-row" data-index="${index}">
                <div class="fw-bold">${escapeHtml(item.name || '-')}</div>
                <div class="small text-muted">Username: ${escapeHtml(item.username || '-')} | บ้าน: ${escapeHtml(item.groupCode || '-')}</div>
                <div class="small text-muted">${item.requestedAt ? new Date(item.requestedAt).toLocaleString('th-TH') : ''}</div>
                ${item.note ? `<div class="small mt-1">${escapeHtml(item.note)}</div>` : ''}
            </button>
        `).join('');

        const { value: selectedIndex } = await Swal.fire({
            title: 'คำขอรีเซ็ตรหัสผ่าน',
            width: 560,
            showCancelButton: true,
            showConfirmButton: false,
            cancelButtonText: 'ปิด',
            html: `<div class="list-group">${rows}</div>`,
            didOpen: () => {
                document.querySelectorAll('.reset-request-row').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Swal.getPopup().dataset.selectedIndex = btn.dataset.index;
                        Swal.clickConfirm();
                    });
                });
            },
            preConfirm: () => Number(Swal.getPopup().dataset.selectedIndex ?? -1)
        });
        if (selectedIndex === undefined || selectedIndex < 0) return;
        return approvePasswordResetRequest(requests[selectedIndex]);
    } catch (e) {
        Swal.fire('โหลดคำขอไม่สำเร็จ', e.message, 'error');
    }
}

async function manageAiPostKey() {
    if (!canManageSystem()) return Swal.fire('ไม่มีสิทธิ์', 'เมนูนี้สำหรับ Admin/Manager เท่านั้น', 'warning');
    if (!supabaseClient) return Swal.fire('ยังตั้งค่าไม่ได้', 'ไม่พบการเชื่อมต่อ Supabase', 'warning');

    Swal.fire({ title: 'กำลังตรวจสอบสถานะ AI...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        let configured = false;
        let statusWarning = '';
        const identity = await getAiPostIdentityPayload();
        try {
            const statusRes = await invokeAiPostFunction({ action: 'status', ...identity });
            configured = !!statusRes?.configured;
        } catch (statusError) {
            statusWarning = await getFunctionErrorMessage(statusError, 'ยังตรวจสถานะเดิมไม่ได้ แต่สามารถวาง API key แล้วกดบันทึกได้');
        }

        const keyResult = await Swal.fire({
            title: 'ตั้งค่า AI ช่วยเขียนโพส',
            showCancelButton: true,
            showDenyButton: configured,
            confirmButtonText: 'บันทึก API key',
            denyButtonText: 'ลบ API key',
            cancelButtonText: 'ปิด',
            html: `
                <div class="text-start">
                    <div class="alert ${configured ? 'alert-success' : 'alert-warning'} py-2 small">
                        ${configured ? 'ตั้งค่า API key แล้ว เจ้าหน้าที่สามารถใช้ AI ช่วยเขียนโพสได้' : (statusWarning || 'ยังไม่ได้ตั้งค่า API key')}
                    </div>
                    <label class="form-label small fw-bold">AI API key</label>
                    <input id="aiPostApiKey" type="password" class="form-control" autocomplete="off" placeholder="Gemini API key หรือ OpenAI sk-...">
                    <div class="small text-muted mt-2">รองรับ Gemini และ OpenAI ใส่เฉพาะ API key ไม่ต้องใส่ URL/model ระบบจะเข้ารหัสเก็บไว้ เจ้าหน้าที่จะใช้งานได้แต่ไม่เห็น key</div>
                </div>`,
            preConfirm: () => {
                const apiKey = document.getElementById('aiPostApiKey').value.trim();
                if (!apiKey) return Swal.showValidationMessage('กรุณาวาง API key ก่อนบันทึก');
                return { action: 'save-key', apiKey };
            }
        });

        if (keyResult.value?.action === 'save-key') {
            Swal.fire({ title: 'กำลังบันทึก API key...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await invokeAiPostFunction({ ...keyResult.value, ...identity });
            return Swal.fire('บันทึกแล้ว', 'เจ้าหน้าที่สามารถใช้ AI ช่วยเขียนโพสได้แล้ว', 'success');
        }

        if (keyResult.isDenied) {
            const confirmDelete = await Swal.fire({
                icon: 'warning',
                title: 'ลบ API key?',
                text: 'หลังลบแล้ว ปุ่ม AI ช่วยเขียนโพสจะใช้งานไม่ได้จนกว่าจะตั้งค่าใหม่',
                showCancelButton: true,
                confirmButtonText: 'ลบ',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#d33'
            });
            if (!confirmDelete.isConfirmed) return;
            Swal.fire({ title: 'กำลังลบ API key...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await invokeAiPostFunction({ action: 'delete-key', ...identity });
            return Swal.fire('ลบแล้ว', 'ปิดการใช้งาน AI ช่วยเขียนโพสแล้ว', 'success');
        }
    } catch (e) {
        const message = await getFunctionErrorMessage(e, 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ');
        let identity = {};
        try { identity = await getAiPostIdentityPayload(); } catch (diagError) { }
        Swal.fire({
            icon: 'error',
            title: 'ตั้งค่า AI ไม่สำเร็จ',
            width: 560,
            html: `
                <div class="text-start">
                    <div class="alert alert-danger py-2 mb-2">${escapeHtml(message)}</div>
                    <div class="small text-muted">
                        สถานะยืนยันตัวตน: Username/Password = ${identity.hasPasswordSession ? 'พบ' : 'ไม่พบ'},
                        LINE token = ${identity.hasLineToken ? 'พบ' : 'ไม่พบ'}
                    </div>
                    <div class="small text-muted mt-2">
                        หากขึ้นว่าไม่พบทั้งสองอย่าง ให้เปิดระบบผ่าน LINE อีกครั้ง หรือเข้าสู่ระบบด้วย Username/Password ของ Admin แล้วลองบันทึกใหม่
                    </div>
                </div>`
        });
    }
}

async function approvePasswordResetRequest(request) {
    const generated = `Happy${Math.floor(100000 + Math.random() * 900000)}`;
    const { value } = await Swal.fire({
        title: 'ตั้งรหัสชั่วคราว',
        showCancelButton: true,
        confirmButtonText: 'รีเซ็ตรหัสผ่าน',
        cancelButtonText: 'ยกเลิก',
        html: `
            <div class="text-start">
                <div class="mb-2">สมาชิก: <b>${escapeHtml(request.name || '-')}</b></div>
                <div class="small text-muted mb-2">Username: ${escapeHtml(request.username || '-')} | บ้าน: ${escapeHtml(request.groupCode || '-')}</div>
                <label class="form-label small fw-bold">รหัสชั่วคราว</label>
                <input id="resetTempPassword" class="form-control" value="${generated}" autocomplete="new-password">
                <div class="small text-danger mt-2">แจ้งรหัสนี้ให้เจ้าของบัญชีโดยตรง เมื่อเข้าได้แล้วระบบจะบังคับตั้งรหัสใหม่</div>
            </div>`,
        preConfirm: () => {
            const tempPassword = document.getElementById('resetTempPassword').value.trim();
            if (tempPassword.length < 8) return Swal.showValidationMessage('รหัสชั่วคราวต้องมีอย่างน้อย 8 ตัวอักษร');
            return { tempPassword };
        }
    });
    if (!value) return;

    Swal.fire({ title: 'กำลังรีเซ็ตรหัสผ่าน...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await invokeAccountAuth({
            action: 'approve-password-reset',
            targetLineId: request.lineId,
            tempPassword: value.tempPassword
        });
        refreshPasswordResetBadge(true);
        Swal.fire({
            icon: 'success',
            title: 'รีเซ็ตรหัสแล้ว',
            html: `<div class="text-start">Username: <b>${escapeHtml(request.username)}</b><br>รหัสชั่วคราว: <b>${escapeHtml(value.tempPassword)}</b><br><small class="text-muted">ให้ผู้ใช้เข้าสู่ระบบแล้วตั้งรหัสใหม่ทันที</small></div>`
        });
    } catch (e) {
        Swal.fire('รีเซ็ตไม่สำเร็จ', e.message, 'error');
    }
}

async function enforcePasswordResetIfNeeded(userRow) {
    const stats = userRow?.VirtueStats || {};
    if (!stats._passwordResetRequired) return false;
    const { value: password } = await Swal.fire({
        title: 'กรุณาตั้งรหัสผ่านใหม่',
        input: 'password',
        inputPlaceholder: 'รหัสผ่านใหม่อย่างน้อย 8 ตัว',
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonText: 'บันทึกรหัสใหม่',
        inputValidator: value => value.length < 8 ? 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' : undefined
    });
    if (!password) throw new Error('กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน');
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) throw error;
    await invokeAccountAuth({ action: 'clear-password-reset-required' });
    userRow.VirtueStats = {
        ...stats,
        _passwordResetRequired: false,
        _passwordResetRequest: null
    };
    return true;
}

async function getLineProfileProof() {
    if (typeof liff === 'undefined') return {};
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) return {};
        return {
            lineId: currentUser.userId,
            lineIdToken: liff.getIDToken(),
            lineClientId: String(LIFF_ID).split('-')[0]
        };
    } catch (e) {
        return {};
    }
}

async function changeOwnProfileName() {
    const { value: profileName } = await Swal.fire({
        title: 'เปลี่ยนชื่อโปรไฟล์',
        input: 'text',
        inputValue: currentUser?.name || '',
        inputPlaceholder: 'ชื่อที่ต้องการแสดง',
        showCancelButton: true,
        confirmButtonText: 'บันทึกชื่อ',
        inputValidator: value => {
            const name = String(value || '').trim();
            if (name.length < 2) return 'กรุณาระบุชื่ออย่างน้อย 2 ตัวอักษร';
            if (name.length > 80) return 'ชื่อต้องไม่เกิน 80 ตัวอักษร';
        }
    });
    if (!profileName) return;

    try {
        Swal.fire({ title: 'กำลังบันทึกชื่อ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const result = await invokeAccountAuth({
            action: 'update-profile',
            profileName: String(profileName).trim(),
            ...(await getLineProfileProof())
        });
        currentUser.name = result.profileName;
        currentUser.virtueStats = {
            ...(currentUser.virtueStats || {}),
            _profileNameManual: true
        };
        saveUserSession(currentUser);
        if (allUsersMap[currentUser.userId]) allUsersMap[currentUser.userId].name = result.profileName;
        if (typeof renderProfile === 'function') renderProfile();
        Swal.fire('เรียบร้อย', 'เปลี่ยนชื่อโปรไฟล์แล้ว', 'success');
    } catch (e) {
        Swal.fire('เปลี่ยนชื่อไม่สำเร็จ', e.message, 'error');
    }
}

async function uploadOwnProfileImage() {
    const { value: file } = await Swal.fire({
        title: 'เปลี่ยนรูปโปรไฟล์',
        input: 'file',
        inputAttributes: { accept: 'image/png,image/jpeg,image/webp' },
        showCancelButton: true
    });
    if (!file) return;
    try {
        const imageDataUrl = await cropProfileImage(file);
        if (!imageDataUrl) return;
        Swal.fire({ title: 'กำลังอัปโหลดรูป...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const result = await invokeAccountAuth({
            action: 'update-profile',
            imageDataUrl,
            ...(await getLineProfileProof())
        });
        currentUser.img = result.imageUrl;
        currentUser.virtueStats = {
            ...(currentUser.virtueStats || {}),
            _profileImageManual: true
        };
        saveUserSession(currentUser);
        if (allUsersMap[currentUser.userId]) allUsersMap[currentUser.userId].img = result.imageUrl;
        if (typeof renderProfile === 'function') renderProfile();
        Swal.fire('เรียบร้อย', 'อัปเดตรูปโปรไฟล์แล้ว', 'success');
    } catch (e) {
        Swal.fire('อัปโหลดไม่สำเร็จ', e.message, 'error');
    }
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

            // เช็คว่าเป็นการแต่งตั้งแอดมินบ้านใหม่หรือไม่
            const makeAdminParam = urlParams.get('make_admin') || urlParams.get('admin');
            if (makeAdminParam === 'true') {
                safeSetItem('pending_join_role', 'Admin');
                console.log('📌 Saved pending join role parameter: Admin');
            } else {
                localStorage.removeItem('pending_join_role');
            }
        }

        // Legacy direct-login links are no longer trusted. Remove the identifier
        // and continue to the normal password/LINE authentication screen.
        const loginIdParam = urlParams.get('login_id') || urlParams.get('uid');
        if (loginIdParam) {
            const cleanParams = new URLSearchParams(window.location.search);
            cleanParams.delete('login_id');
            cleanParams.delete('uid');
            const searchStr = cleanParams.toString();
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + (searchStr ? '?' + searchStr : '');
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
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
                status: 'active',
                // Keep the existing committee URL, but scope it to the real house code.
                groupCode: 'TRD'
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
            const isResumingLineAccountSetup = safeGetItem(PENDING_LINE_ACCOUNT_SETUP_KEY) === '1';
            if (isResumingLineAccountSetup) resumePendingLineAccountSetup();

            // 🌟 2. อัปเดตข้อมูลเบื้องหลังแบบเงียบๆ (Background Sync) 
            // เพื่อดึงคะแนนล่าสุดและประกาศใหม่ๆ มาแสดงโดยไม่ให้หน้าเว็บค้าง
            
            // Sync LINE profile in background if LIFF is available
            if (typeof liff !== 'undefined' && !isResumingLineAccountSetup) {
                liff.init({ liffId: LIFF_ID }).then(async () => {
                    if (liff.isLoggedIn()) {
                        await syncLineProfileDaily(true);
                    }
                }).catch(e => console.warn("Background LIFF init failed:", e));
            }

            if (currentUser && currentUser.userId === 'COMMITTEE_AUDITOR') {
                console.log("🛡️ Committee Auditor detected - bypassing background database sync");
                return;
            }

            if (READ_FROM_SUPABASE && supabaseClient) {
                Promise.all([
                    supabaseClient.from('Users').select('*').eq('LineID', currentUser.userId).maybeSingle(),
                    supabaseClient.from('SystemConfig').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
                ]).then(async ([userRes, configRes]) => {
                    const data = userRes.data;
                    const error = userRes.error;
                    if (error || !data || data.Status === 'rejected') {
                        console.warn("User not found or rejected in Supabase background sync, logging out...");
                        localStorage.removeItem('app_user_session');
                        window.currentUser = null;
                        location.reload();
                        return;
                    }
                    if (data && !error) {
                        const oldStatus = currentUser.status;
                        const oldRole = currentUser.role;

                        const oldGroupCode = currentUser.groupCode;

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
                        const profileMetadata = getAuthMetadata(currentUser);

                        if (data.Image && data.Image !== currentUser.img) {
                            if (!profileMetadata.profileImageManual && cachedLiffPicture && cachedLiffPicture !== data.Image && currentUser.img === cachedLiffPicture) {
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
                            if (!profileMetadata.profileNameManual && cachedLiffName && cachedLiffName !== data.Name && currentUser.name === cachedLiffName) {
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

                        // รีโหลดผู้ใช้และฟีดถ้ารหัสบ้านเปลี่ยนไป
                        if (oldGroupCode !== currentUser.groupCode) {
                            console.log('🔄 House GroupCode updated from', oldGroupCode, 'to', currentUser.groupCode, '- refreshing cached users & feed');
                            cacheUsers().then(() => {
                                if (typeof fetchFeed === 'function') fetchFeed(false, true, true);
                                if (typeof fetchFriendsList === 'function') fetchFriendsList();
                            });
                        }

                        // ตรวจสอบความเปลี่ยนแปลงสถานะเพื่อปลดล็อค UI ทันที
                        if ((oldStatus === 'waiting_approval' || oldRole?.toLowerCase() === 'guest') && 
                            currentUser.status === 'active' && currentUser.role?.toLowerCase() !== 'guest') {
                            console.log('🎉 Status updated to Active! Updating UI...');
                            Swal.fire({
                                title: '🎉 ได้รับการอนุมัติแล้ว!',
                                text: 'บัญชีของคุณได้รับการอนุมัติแล้ว ยินดีต้อนรับเข้าสู่ระบบ ดี มีสุข!',
                                icon: 'success',
                                confirmButtonText: 'เริ่มต้นใช้งาน',
                                confirmButtonColor: '#6c5ce7'
                            }).then(() => {
                                if (typeof updateNavigationVisibility === 'function') updateNavigationVisibility();
                                if (typeof fetchFeed === 'function') fetchFeed();
                            });
                        }

                        // ประมวลผลการตั้งค่าคอนฟิกเวอร์ชันระบบจาก Supabase
                        let configObj = null;
                        if (configRes && configRes.data) {
                            configObj = {
                                version: configRes.data.version,
                                title: configRes.data.title,
                                message: configRes.data.message,
                                notifications: configRes.data.notifications || []
                            };
                        } else {
                            // Fallback config from GAS
                            try {
                                const res = await fetch(GAS_URL + (GAS_URL.includes('?') ? '&' : '?') + 'action=get_config_only');
                                const resJson = await res.json();
                                if (resJson && resJson.config) {
                                    configObj = resJson.config;
                                }
                            } catch(e) {
                                console.warn('GAS fallback config fetch failed:', e);
                            }
                        }

                        if (configObj) {
                            if (typeof renderAnnouncement === 'function') renderAnnouncement(configObj);
                            if (typeof loadNotificationsFromConfig === 'function') loadNotificationsFromConfig(configObj);
                            if (typeof notifyFromConfig === 'function') notifyFromConfig(configObj);

                            // ตรวจเช็คว่าต้อง Sync เลขเวอร์ชันในโค้ดปัจจุบันไปยังฐานข้อมูลหรือไม่
                            if (typeof APP_VERSION !== 'undefined') {
                                const dbVer = configObj.version;
                                if (dbVer !== APP_VERSION) {
                                    console.log(`🚀 Version mismatch in background: Code=${APP_VERSION}, DB=${dbVer}. Updating...`);
                                    await syncCodeVersionToDatabases(APP_VERSION);
                                    configObj.version = APP_VERSION;
                                }
                            }

                            if (typeof showLifecycleDialogs === 'function') await showLifecycleDialogs(configObj);
                        }
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
                        if (!data || !data.exists || (data.user && data.user.status === 'rejected')) {
                            console.warn("User not found or rejected in GAS background sync, logging out...");
                            localStorage.removeItem('app_user_session');
                            window.currentUser = null;
                            location.reload();
                            return;
                        }
                        if (data.exists) {
                            const oldStatus = currentUser.status;
                            const oldRole = currentUser.role;

                            const oldGroupCode = currentUser.groupCode;

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

                            // รีโหลดผู้ใช้และฟีดถ้ารหัสบ้านเปลี่ยนไป
                            if (oldGroupCode !== currentUser.groupCode) {
                                console.log('🔄 House GroupCode updated from', oldGroupCode, 'to', currentUser.groupCode, 'via GAS - refreshing cached users & feed');
                                cacheUsers().then(() => {
                                    if (typeof fetchFeed === 'function') fetchFeed(false, true, true);
                                    if (typeof fetchFriendsList === 'function') fetchFriendsList();
                                });
                            }

                            // ตรวจสอบความเปลี่ยนแปลงสถานะเพื่อปลดล็อค UI ทันที
                            if ((oldStatus === 'waiting_approval' || oldRole?.toLowerCase() === 'guest') && 
                                currentUser.status === 'active' && currentUser.role?.toLowerCase() !== 'guest') {
                                console.log('🎉 Status updated to Active via GAS! Updating UI...');
                                Swal.fire({
                                    title: '🎉 ได้รับการอนุมัติแล้ว!',
                                    text: 'บัญชีของคุณได้รับการอนุมัติแล้ว ยินดีต้อนรับเข้าสู่ระบบ ดี มีสุข!',
                                    icon: 'success',
                                    confirmButtonText: 'เริ่มต้นใช้งาน',
                                    confirmButtonColor: '#6c5ce7'
                                }).then(() => {
                                    if (typeof updateNavigationVisibility === 'function') updateNavigationVisibility();
                                    if (typeof fetchFeed === 'function') fetchFeed();
                                });
                            }

                            // อัปเดตประกาศและการแจ้งเตือนล่าสุด
                            if (data.config) {
                                if (typeof renderAnnouncement === 'function') renderAnnouncement(data.config);
                                if (typeof loadNotificationsFromConfig === 'function') loadNotificationsFromConfig(data.config);
                                if (typeof notifyFromConfig === 'function') notifyFromConfig(data.config);

                                // ตรวจเช็คว่าต้อง Sync เลขเวอร์ชันในโค้ดปัจจุบันไปยังฐานข้อมูลหรือไม่
                                if (typeof APP_VERSION !== 'undefined') {
                                    const dbVer = data.config.version;
                                    if (dbVer !== APP_VERSION) {
                                        console.log(`🚀 Version mismatch in background (GAS): Code=${APP_VERSION}, DB=${dbVer}. Updating...`);
                                        await syncCodeVersionToDatabases(APP_VERSION);
                                        data.config.version = APP_VERSION;
                                    }
                                }
                            }
                            if (typeof showLifecycleDialogs === 'function') await showLifecycleDialogs(data.config || null);
                            console.log('🔄 อัปเดตข้อมูลเบื้องหลังเสร็จสมบูรณ์');
                        }
                    }).catch(e => console.log('Background sync failed:', e));
            }

            return; // จบการทำงาน ไม่ต้องไปโหลด LIFF ต่อให้เสียเวลา
        }

        // Complete a LINE OAuth callback automatically during the transition.
        if (urlParams.has('code') || urlParams.has('state')) {
            await liff.init({ liffId: LIFF_ID });
            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                safeSetItem('liff_userId', profile.userId);
                safeSetItem('liff_displayName', profile.displayName);
                safeSetItem('liff_pictureUrl', profile.pictureUrl || '');
                await checkUser(profile.userId, profile);
                return;
            }
        }

        if (await restorePasswordAccountSession()) return;

        // No local session: show the new account login first. LINE remains
        // available as a safe transition path for existing members.
        showLoginScreen();
        return;

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
                    // ล้างเฉพาะพารามิเตอร์ของ OAuth/LIFF แต่รักษาพารามิเตอร์นำทาง (เช่น postId) ไว้
                    const cleanParams = new URLSearchParams(window.location.search);
                    cleanParams.delete('code');
                    cleanParams.delete('state');
                    cleanParams.delete('liffClientId');
                    const searchStr = cleanParams.toString();
                    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + (searchStr ? '?' + searchStr : '');
                    window.location.replace(newUrl); // โหลดใหม่โดยยังคงรักษา postId และอื่นๆ ไว้
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
                    <img src="app-icon.png?v=3" style="width:100px;height:100px;border-radius:24px;box-shadow:0 10px 25px rgba(108,92,231,0.2);margin-bottom:20px;" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3536/3536505.png'">
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
                    <a href="https://liff.line.me/${LIFF_ID}${window.location.search}" class="text-decoration-none small fw-bold" style="color:#06C755;">
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

        const liffUrl = `https://liff.line.me/${LIFF_ID}${window.location.search}`;
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
async function doLineLogin() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            safeSetItem('liff_userId', profile.userId);
            safeSetItem('liff_displayName', profile.displayName);
            safeSetItem('liff_pictureUrl', profile.pictureUrl || '');
            await checkUser(profile.userId, profile);
            return;
        }
        liff.login();
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

// Username/password login. Existing LINE login remains available separately.
async function doManualLogin() {
    const username = normalizeAccountUsername(document.getElementById('manualUsername')?.value);
    const password = document.getElementById('manualPassword')?.value || '';

    if (!USERNAME_PATTERN.test(username) || !password) {
        Swal.fire({
            icon: 'warning',
            title: 'ข้อมูลไม่ครบ',
            text: 'กรุณากรอก Username รูปแบบ somchai_ja และรหัสผ่าน',
            confirmButtonText: 'ตกลง'
        });
        return;
    }

    Swal.fire({
        title: 'กำลังตรวจสอบ...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: getPasswordAccountEmail(username),
            password
        });
        if (error) throw error;
        const userRow = await findUserByAuthId(data.user.id);
        if (!userRow) throw new Error('ไม่พบข้อมูลสมาชิกที่เชื่อมกับ Username นี้');
        await enforcePasswordResetIfNeeded(userRow);
        await checkUser(userRow.LineID, null);
    } catch (e) {
        Swal.fire('เข้าสู่ระบบไม่สำเร็จ', e.message || 'Username หรือรหัสผ่านไม่ถูกต้อง', 'error');
    }
}

// --- ตรวจสอบและลงทะเบียนผู้ใช้ ---
function checkUser(userId, profile) {
    // 🌟 1. กรณีเรียกแบบสั้น (เช่น checkUser()) ให้ใช้ข้อมูลจาก currentUser
    let targetUserId = userId || (window.currentUser ? window.currentUser.userId : null);
    if (!targetUserId) {
        console.warn('checkUser: No userId provided and no currentUser found.');
        return;
    }

    // แปลงรหัสพนักงานให้เป็นตัวพิมพ์ใหญ่เพื่อป้องกันปัญหาระบบแยกตัวพิมพ์เล็ก-ใหญ่ (Case-sensitivity)
    if (typeof targetUserId === 'string' && !(targetUserId.startsWith('U') && targetUserId.length === 33)) {
        targetUserId = targetUserId.toUpperCase();
    }

    console.log('🔍 กำลังตรวจสอบการเชื่อมต่อกับ:', READ_FROM_SUPABASE ? 'Supabase' : 'GAS', 'สำหรับ ID:', targetUserId);

    if (READ_FROM_SUPABASE && supabaseClient) {
        Promise.all([
            supabaseClient.from('Users').select('*').or(`LineID.eq.${targetUserId},EmployeeID.eq.${targetUserId}`),
            supabaseClient.from('SystemConfig').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
        ]).then(async ([userRes, configRes]) => {
            if (userRes.error) throw userRes.error;
            const data = userRes.data;
            const userRow = (data && data.length > 0) ? data[0] : null;

            if (userRow) {
                let finalName = userRow.Name;
                let finalImg = userRow.Image;
                let profileChanged = false;
                const profileMetadata = getAuthMetadata(userRow);

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
                    if (!profileMetadata.profileImageManual && activeProfile.pictureUrl && activeProfile.pictureUrl !== userRow.Image) {
                        finalImg = activeProfile.pictureUrl;
                        profileChanged = true;
                    }
                    if (!profileMetadata.profileNameManual && activeProfile.displayName && activeProfile.displayName !== userRow.Name) {
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

                // Parse config
                let configData = null;
                if (configRes && configRes.data) {
                    configData = {
                        version: configRes.data.version,
                        title: configRes.data.title,
                        message: configRes.data.message,
                        notifications: configRes.data.notifications || []
                    };
                } else {
                    // Fallback to GAS config
                    try {
                        const res = await fetch(GAS_URL + (GAS_URL.includes('?') ? '&' : '?') + 'action=get_config_only');
                        const resData = await res.json();
                        if (resData && resData.config) {
                            configData = resData.config;
                        }
                    } catch (e) {
                        console.warn('⚠️ Fallback GAS config fetch failed:', e);
                    }
                }

                // ตรวจเช็คว่าต้อง Sync เลขเวอร์ชันในโค้ดปัจจุบันไปยังฐานข้อมูลหรือไม่
                if (typeof APP_VERSION !== 'undefined') {
                    const dbVer = configData ? configData.version : null;
                    if (dbVer !== APP_VERSION) {
                        console.log(`🚀 Version mismatch detected: Code=${APP_VERSION}, DB=${dbVer}. Updating databases...`);
                        await syncCodeVersionToDatabases(APP_VERSION);
                        configData = {
                            version: APP_VERSION,
                            title: `TRD Happiness v${APP_VERSION}`,
                            message: "ระบบได้รับการอัปเดตเวอร์ชันใหม่โดยอัตโนมัติ",
                            notifications: configData ? configData.notifications : []
                        };
                    }
                }

                finishLoginProcess(configData);

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
                // 🌟 ไม่พบผู้ใช้ในฐานข้อมูล (ถูกลบ/ไม่เคยมี) -> ดีดออกและล้างเซสชัน
                localStorage.removeItem('app_user_session');
                window.currentUser = null;
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
                // 🌟 ไม่พบผู้ใช้ในฐานข้อมูล (ถูกลบ/ไม่เคยมี) -> ดีดออกและล้างเซสชัน
                localStorage.removeItem('app_user_session');
                window.currentUser = null;
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

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f8fafc' : '#1e293b';
    const labelColor = isDark ? '#94a3b8' : '#64748b';
    const cardBg = isDark ? 'rgba(30, 30, 45, 0.98)' : 'rgba(255, 255, 255, 0.98)';
    const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    if (isLineLogin) {
        htmlContent = `
            <div class="text-center p-4 login-card fade-in" style="max-width:380px; background:${cardBg}; border-radius:30px; border:1px solid ${cardBorder}; box-shadow:0 15px 35px rgba(0,0,0,0.15); margin: 0 auto; position: relative; top: 50%; transform: translateY(-50%); font-family: 'Kanit', sans-serif;">
                <div class="mb-4">
                    <div style="font-size:4.5rem; margin-bottom:15px; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.1));">👋</div>
                    <h4 class="fw-bold mb-2" style="color:var(--primary-color);">สวัสดีครับ</h4>
                    <p class="fw-bold mb-1" style="color:${textColor};">${profile.displayName}</p>
                    <p class="small" style="color:${labelColor}; line-height: 1.4;">ยังไม่มีบัญชี LINE นี้ในระบบ<br>กรุณาผูกบัญชีกับรหัสพนักงานของคุณเพื่อเข้าใช้งาน</p>
                </div>

                <div class="mb-3 text-start">
                    <label class="small fw-bold mb-1" style="color:${labelColor};">รหัสพนักงานของคุณ</label>
                    <input type="text" id="linkEmployeeId" class="form-control rounded-pill px-3 shadow-none border" placeholder="กรอกรหัสพนักงาน..." style="height:45px; font-size:0.9rem; background-color:${isDark ? '#1e293b' : '#ffffff'}; color:${textColor}; border-color:${isDark ? '#334155' : '#cbd5e1'};">
                </div>
                
                <button id="btnLinkAccount" class="btn btn-lg rounded-pill px-5 fw-bold w-100 mb-3 shadow" style="background:#06C755; color:#ffffff; border:none; height:50px; font-size:1rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <i class="fas fa-link me-2"></i>ผูกบัญชีและเข้าสู่ระบบ
                </button>

                <div class="divider mb-3" style="display:flex; align-items:center; color:${labelColor}; font-size:0.75rem;">
                    <div style="flex:1; height:1px; background:${isDark ? '#334155' : '#e2e8f0'};"></div>
                    <span class="mx-3">หรือ</span>
                    <div style="flex:1; height:1px; background:${isDark ? '#334155' : '#e2e8f0'};"></div>
                </div>
                
                <button id="btnRequestAccess" class="btn btn-lg rounded-pill px-5 fw-bold w-100 mb-3" style="height:50px; font-size:1rem; background-color: ${isDark ? '#4f46e5' : '#6366f1'}; color: #ffffff; border: none; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <i class="fas fa-user-plus me-2"></i>ลงทะเบียนพนักงานใหม่
                </button>
                
                <button onclick="location.reload()" class="btn btn-link small text-decoration-none w-100" style="color:${labelColor}; font-size:0.85rem;">กลับหน้าหลัก</button>
            </div>
        `;
    } else {
        htmlContent = `
            <div class="text-center p-4 login-card fade-in" style="max-width:380px; background:${cardBg}; border-radius:30px; border:1px solid ${cardBorder}; box-shadow:0 15px 35px rgba(0,0,0,0.15); margin: 0 auto; position: relative; top: 50%; transform: translateY(-50%); font-family: 'Kanit', sans-serif;">
                <div class="mb-4">
                    <div style="font-size:4.5rem; margin-bottom:15px; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.1));">👋</div>
                    <h4 class="fw-bold mb-2" style="color:var(--primary-color);">สวัสดีครับ</h4>
                    <p class="small" style="color:${textColor}; line-height: 1.4;">ไม่พบรหัสพนักงาน <b style="color: ${isDark ? '#fd79a8' : '#e84393'};">"${userId}"</b> ในระบบ<br><span style="color:${labelColor};">กรุณาส่งคำขอลงทะเบียนกับผู้ดูแลระบบ</span></p>
                </div>
                
                <button id="btnRequestAccess" class="btn btn-lg rounded-pill px-5 fw-bold w-100 mb-3 shadow" style="background:linear-gradient(135deg, #6c5ce7, #8a7df0); color:#ffffff; border:none; height:55px; font-size:1.05rem; box-shadow: 0 4px 15px rgba(108, 92, 231, 0.35); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <i class="fas fa-paper-plane me-2"></i>แจ้งเข้าระบบ / ลงทะเบียน
                </button>
                
                <button onclick="location.reload()" class="btn btn-link small text-decoration-none w-100" style="color:${labelColor}; font-size:0.85rem;">กลับหน้าหลัก</button>
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
    const pendingJoinRole = safeGetItem('pending_join_role') || '';
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f8fafc' : '#1e293b';
    const labelColor = isDark ? '#94a3b8' : '#475569';
    const inputBg = isDark ? '#1e293b' : '#ffffff';
    const inputBorder = isDark ? '#334155' : '#cbd5e1';
    const popupBg = isDark ? '#0f172a' : '#ffffff';

    const { value: formValues } = await Swal.fire({
        title: '📝 ลงทะเบียนผู้เข้าใช้งานใหม่',
        background: popupBg,
        color: textColor,
        confirmButtonColor: '#3b82f6',
        confirmButtonText: 'ส่งคำขอลงทะเบียน',
        cancelButtonText: 'ยกเลิก',
        showCancelButton: true,
        cancelButtonColor: isDark ? '#334155' : '#64748b',
        focusConfirm: false,
        allowOutsideClick: false,
        html: `
            <div class="text-start" style="font-family: 'Kanit', sans-serif;">
                ${isManual ? `
                <label class="small fw-bold mb-1" style="color: ${labelColor}; display: block; font-size: 0.85rem;">ชื่อ-นามสกุล (Full Name)</label>
                <input id="reg-name" class="swal2-input mt-0 mb-3" style="width: 100%; box-sizing: border-box; font-size: 0.95rem; margin: 0; padding: 10px 12px; background-color: ${inputBg}; color: ${textColor}; border: 1px solid ${inputBorder}; border-radius: 8px; font-family: 'Kanit', sans-serif;" placeholder="ระบุชื่อ-นามสกุล">
                ` : ''}
                <label class="small fw-bold mb-1" style="color: ${labelColor}; display: block; font-size: 0.85rem; margin-top: 12px;">ตำแหน่ง (Position)</label>
                <input id="reg-pos" class="swal2-input mt-0 mb-3" style="width: 100%; box-sizing: border-box; font-size: 0.95rem; margin: 0; padding: 10px 12px; background-color: ${inputBg}; color: ${textColor}; border: 1px solid ${inputBorder}; border-radius: 8px; font-family: 'Kanit', sans-serif;" placeholder="ระบุตำแหน่งของคุณ">
                <label class="small fw-bold mb-1" style="color: ${labelColor}; display: block; font-size: 0.85rem; margin-top: 12px;">จังหวัด (Province)</label>
                <input id="reg-province" class="swal2-input mt-0 mb-3" style="width: 100%; box-sizing: border-box; font-size: 0.95rem; margin: 0; padding: 10px 12px; background-color: ${inputBg}; color: ${textColor}; border: 1px solid ${inputBorder}; border-radius: 8px; font-family: 'Kanit', sans-serif;" placeholder="ระบุจังหวัด">
                <label class="small fw-bold mb-1" style="color: ${labelColor}; display: block; font-size: 0.85rem; margin-top: 12px; margin-bottom: 6px;">กลุ่ม/บ้าน (House Code)</label>
                ${pendingJoinHouse ? `
                    <div class="p-2 border rounded-3 text-success fw-bold d-flex align-items-center justify-content-between mb-2" style="font-size:0.9rem; border-color: ${isDark ? '#1e4620' : '#d4edda'} !important; background-color: ${isDark ? '#14301633' : '#d4edda33'} !important; color: ${isDark ? '#81c784' : '#155724'};">
                        <span>🏠 บ้าน: <b>${pendingJoinHouse}</b> ${pendingJoinRole === 'Admin' ? '<span class="text-danger">(สิทธิ์แอดมินบ้านใหม่)</span>' : ''}</span>
                        <span class="badge bg-success small"><i class="fas fa-qrcode"></i> QR Code</span>
                    </div>
                    <input type="hidden" id="reg-group" value="${pendingJoinHouse}">
                ` : `
                    <select id="reg-group" class="form-select mt-0 rounded-3 shadow-none" style="font-family: 'Kanit', sans-serif; height:45px; font-size:0.95rem; border: 1px solid ${inputBorder}; background-color: ${inputBg}; color: ${textColor}; width: 100%; border-radius: 8px; padding: 0 12px;">
                        <option value="" style="background-color: ${inputBg}; color: ${textColor};">-- กรุณาเลือกกลุ่ม/บ้าน --</option>
                        <option value="TRD" style="background-color: ${inputBg}; color: ${textColor};">บ้าน TRD (ส่วนกลาง)</option>
                        <option value="NBP" style="background-color: ${inputBg}; color: ${textColor};">บ้าน NBP (นบป.)</option>
                        <option value="SKK" style="background-color: ${inputBg}; color: ${textColor};">บ้าน SKK (สระแก้ว)</option>
                        <option value="HQ" style="background-color: ${inputBg}; color: ${textColor};">สำนักงานส่วนกลาง / กรม (HQ)</option>
                    </select>
                `}
                <p class="text-muted mt-3" style="font-size: 0.75rem; color: ${isDark ? '#64748b' : '#64748b'} !important; line-height: 1.4; margin-bottom: 0;">
                    ${pendingJoinRole === 'Admin' ? '* คุณจะได้รับสิทธิ์เป็นผู้ดูแลระบบ (Admin) ของบ้านใหม่นี้ทันทีเมื่อลงทะเบียนสำเร็จ' : '* ข้อมูลของคุณจะถูกส่งให้ Admin ตรวจสอบเพื่ออนุมัติสิทธิ์การใช้งาน'}
                </p>
            </div>
        `,
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

    const pendingRole = safeGetItem('pending_join_role') || 'Guest';
    const pendingStatus = pendingRole === 'Admin' ? 'active' : 'waiting_approval';

    const payload = {
        action: 'register_user',
        userId,
        userName: extraData.name || (profile ? profile.displayName : 'Unknown'),
        userImg: profile ? profile.pictureUrl : 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        position: extraData.pos || '',
        province: extraData.province || '',
        groupCode: extraData.group || '',
        role: pendingRole,
        status: pendingStatus
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
                const { error: syncErr } = await supabaseClient.from('Users').upsert({
                    ID: userId,
                    LineID: userId,
                    // LINE users do not have an employee ID yet. Use null because
                    // the database unique constraint treats repeated empty strings as duplicates.
                    EmployeeID: userId.startsWith('U') ? null : userId,
                    Name: extraData.name || (profile ? profile.displayName : 'Unknown'),
                    Image: profile ? profile.pictureUrl : 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
                    Role: pendingRole, // สิทธิ์ตามที่ระบบบันทึกไว้ (Admin หรือ Guest)
                    Score: 0,
                    Level: 1,
                    Department: extraData.pos || '', // เก็บตำแหน่งในฟิลด์ Dept
                    Office: extraData.province || '', // เก็บจังหวัดในฟิลด์ Office
                    GroupCode: extraData.group || '',
                    Status: pendingStatus, // สถานะตามสิทธิ์ (active หรือ waiting_approval)
                    LastDate: now.toISOString().split('T')[0],
                    LastTime: now.toTimeString().split(' ')[0],
                    VisitCount: 1
                });
                if (syncErr) throw syncErr;
                console.log('☁️ Supabase: User registration synced');

                 // 📣 [WEB PUSH TRIGGER] แจ้งเตือนแอดมิน/ผู้ดูแลว่ามีผู้สมัครใหม่รอการอนุมัติ (เฉพาะกรณีสมัครเข้าบ้านธรรมดา)
                 if (pendingRole !== 'Admin') {
                     const newMemberName = extraData.name || (profile ? profile.displayName : 'Unknown');
                     const houseName = extraData.group || 'Guest';
                     if (typeof triggerPushNotification === 'function') {
                         triggerPushNotification(
                             '🏠 มีผู้สมัครเข้าบ้านใหม่รอการอนุมัติ',
                             `คุณ "${newMemberName}" ได้ส่งคำขอลงทะเบียนเข้ากลุ่มบ้าน ${houseName} แล้ว กรุณาตรวจสอบและอนุมัติสิทธิ์`,
                             window.location.origin + '/index.html?tab=manager',
                             'admin',
                             extraData.group
                         ).catch(err => console.error('Admin approval request notification error:', err));
                     }
                 }

                // 📧 แจ้งเตือน Admin (จำลองการส่งเข้า Inbox Admin)
                // ในระบบจริงอาจบันทึกลงตาราง Inbox/Notifications
            } catch (e) {
                console.error('☁️ Supabase Sync Error:', e);
                const isDuplicateEmployeeId = String(e?.message || e).includes('Users_EmployeeID_key');
                Swal.fire({
                    icon: 'error',
                    title: 'บันทึกข้อมูลลงฐานข้อมูลไม่สำเร็จ',
                    html: isDuplicateEmployeeId
                        ? 'รหัสพนักงานนี้มีสมาชิกใช้งานอยู่แล้ว กรุณาเข้าสู่ระบบแล้วเลือก <b>ผูกบัญชีกับรหัสพนักงานเดิม</b> หรือติดต่อผู้ดูแลบ้าน'
                        : `<b>สาเหตุ:</b> ${e.message || e}<br><br><small class="text-muted">กรุณาตรวจสอบว่าได้สร้างคอลัมน์ <b>Status</b> และ <b>GroupCode</b> ในตาราง Users บน Supabase แล้วหรือไม่</small>`,
                    confirmButtonText: 'ตกลง'
                });
                window._isRegistering = false;
                return;
            }
        }

        window._isRegistering = false;
        
        // ล้างค่าบ้านและสิทธิ์ที่กำลังรอเข้าหลังจากลงทะเบียนเสร็จ
        localStorage.removeItem('pending_join_house');
        localStorage.removeItem('pending_join_role');

        const successHtml = pendingRole === 'Admin' ? `
            <div class="text-center mb-0">
                <p class="mb-3">ยินดีต้อนรับ! บัญชีของคุณได้รับการลงทะเบียนในฐานะผู้ดูแลระบบ (Admin) ของบ้านใหม่ <b>"${extraData.group}"</b> เรียบร้อยแล้ว</p>
                <span class="badge bg-success text-white px-3 py-2 rounded-pill fs-7 mb-0" style="font-size: 0.85rem;">
                    <i class="fas fa-check-circle me-1"></i> สถานะ: เปิดใช้งานแล้ว (Admin)
                </span>
            </div>
        ` : `
            <div class="text-center mb-0">
                <p class="mb-3">คำขอเข้ากลุ่มบ้านของคุณได้รับการลงทะเบียนเรียบร้อยแล้ว กรุณารอผู้ดูแลระบบอนุมัติ</p>
                <span class="badge bg-warning text-dark px-3 py-2 rounded-pill fs-7 mb-0" style="font-size: 0.85rem;">
                    <i class="fas fa-user-clock me-1"></i> สถานะ: รอการอนุมัติ (Guest)
                </span>
            </div>
        `;

        Swal.fire({
            icon: 'success',
            title: pendingRole === 'Admin' ? 'เปิดบ้านและแต่งตั้ง Admin สำเร็จ 🎉' : 'ส่งคำขอสำเร็จ 🎉',
            html: successHtml,
            confirmButtonText: pendingRole === 'Admin' ? 'ตกลง (เข้าสู่หน้าหลัก)' : 'ตกลง (ไปดูหน้าเรื่องราว)',
            confirmButtonColor: '#6c5ce7',
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

async function clearUserSession() {
    localStorage.removeItem('app_user_session');
    // เคลียร์ค่าของเก่าด้วยเผื่อเหลือซาก
    localStorage.removeItem('liff_userId');
    localStorage.removeItem('liff_displayName');
    localStorage.removeItem('liff_pictureUrl');
    localStorage.removeItem(PENDING_LINE_ACCOUNT_SETUP_KEY);
    window.pendingPasswordResetCount = 0;
    currentUser = null;
    window.currentUser = null;
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase.auth.token')) localStorage.removeItem(key);
    });
    if (supabaseClient) {
        try { await supabaseClient.auth.signOut({ scope: 'local' }); } catch (e) { console.warn('Supabase signOut failed:', e); }
    }
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
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังออกจากระบบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await clearUserSession();
            window.location.replace(window.location.origin + window.location.pathname);
        }
    });
}

// --- ฟังก์ชันจัดเตรียมหน้าจอ (แยกออกมาเพื่อให้โค้ดอ่านง่าย) ---
function finishLoginProcess(configData = null) {
    if (typeof renderProfile === 'function') renderProfile();
    if (typeof updateNavigationVisibility === 'function') updateNavigationVisibility();
    if (typeof fetchAnnouncements === 'function') fetchAnnouncements();
    setTimeout(() => refreshPasswordResetBadge(false), 1200);

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

    // 🌟 [DEEP LINK ROUTER] นำทางการคลิกแจ้งเตือนไปยังส่วนต่างๆ
    setTimeout(() => {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab');
            const actionParam = urlParams.get('action');
            const postIdParam = urlParams.get('postId');

            if (tabParam) {
                const navBtn = document.getElementById(`nav-${tabParam}-btn`);
                if (navBtn && typeof switchTab === 'function') {
                    switchTab(tabParam, navBtn);
                }
            } else if (actionParam === 'announcements') {
                if (typeof toggleNotifPanel === 'function') {
                    toggleNotifPanel();
                }
            } else if (actionParam === 'passwordResetRequests') {
                refreshPasswordResetBadge(true).then(() => showPasswordResetRequests());
            } else if (postIdParam) {
                const navStories = document.getElementById('nav-stories-btn');
                if (typeof switchTab === 'function') {
                    switchTab('stories', navStories);
                }
                
                let attempts = 0;
                const checkAndOpen = setInterval(() => {
                    const allPosts = [...(window.globalFeedData || []), ...(window.currentRelationPosts || [])];
                    const post = allPosts.find(p => p && String(p.uuid || p.id).trim() === String(postIdParam).trim());
                    if (post) {
                        clearInterval(checkAndOpen);
                        if (typeof openTikTokPostViewer === 'function') {
                            openTikTokPostViewer(postIdParam);
                        }
                    }
                    attempts++;
                    if (attempts > 50) clearInterval(checkAndOpen);
                }, 100);
            }
        } catch (e) {
            console.error('Deep link routing error:', e);
        }
    }, 600);

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
    if (typeof syncLineProfileDaily === 'function') syncLineProfileDaily();

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

    if (!window._lineProfileVisibilitySync) {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && typeof syncLineProfileDaily === 'function') {
                syncLineProfileDaily(true);
            }
        });
        window._lineProfileVisibilitySync = true;
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

// ⚡ ฟังก์ชันสำหรับอัปเดตเวอร์ชันโค้ดไปยังฐานข้อมูลทั้งระบบหลักและระบบสำรอง
async function syncCodeVersionToDatabases(newVersion) {
    const title = `TRD Happiness v${newVersion}`;
    const message = "ระบบได้รับการอัปเดตเวอร์ชันใหม่";

    // 1. อัปเดตไปยังระบบหลัก (Supabase)
    if (READ_FROM_SUPABASE && supabaseClient) {
        try {
            // เซ็ตแถว Active เก่าให้เป็น False
            await supabaseClient.from('SystemConfig').update({ is_active: false }).eq('is_active', true);
            
            // เพิ่มแถวเวอร์ชันใหม่และตั้งให้เป็น Active
            const { error } = await supabaseClient.from('SystemConfig').insert({
                version: newVersion,
                title: title,
                message: message,
                notifications: [],
                is_active: true
            });
            if (error) throw error;
            console.log('✅ Successfully updated active version in Supabase to', newVersion);
        } catch (e) {
            console.error('❌ Failed to update active version in Supabase:', e);
        }
    }

    // 2. อัปเดตไปยังระบบสำรอง (GAS / Google Sheets)
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'save_system_config',
                version: newVersion,
                title: title,
                message: message,
                notifications: []
            })
        });
        const resData = await res.json();
        if (resData && resData.status === 'success') {
            console.log('✅ Successfully updated active version in GAS to', newVersion);
        } else {
            console.warn('⚠️ GAS version update response was not success:', resData);
        }
    } catch (e) {
        console.error('❌ Failed to update active version in GAS:', e);
    }
}

async function showLifecycleDialogs(config) {
    if (window._lifecycleRunning) return;
    window._lifecycleRunning = true;

    if (config && config.version) {
        const configVersion = config.version;
        const localVer = safeGetItem('appVersion');

        if (localVer && localVer !== configVersion) {
            // แสดง Loader สั้นๆ เพื่ออธิบายการรีโหลดระบบให้ดูพรีเมียม
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: '🔄 กำลังอัปเดตระบบ...',
                    text: `กำลังเตรียมปรับปรุงเป็นเวอร์ชัน ${configVersion}`,
                    allowOutsideClick: false,
                    showConfirmButton: false,
                    didOpen: () => { Swal.showLoading(); }
                });
            }

            // บันทึกเวอร์ชันใหม่ลง LocalStorage
            safeSetItem('appVersion', configVersion);

            // รอ 1 วินาทีแล้วโหลดใหม่เพื่อล้างแคช Android/LINE
            setTimeout(() => {
                const urlParams = new URLSearchParams(window.location.search);
                urlParams.set('t', Date.now());
                const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?' + urlParams.toString();
                window.location.replace(newUrl);
            }, 1000);
            return;
        } else if (!localVer) {
            // บันทึกเวอร์ชันเริ่มต้นสำหรับผู้ใช้ใหม่/การเข้าใช้งานครั้งแรกเพื่อป้องกันการรีโหลดซ้ำซ้อน
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
            if (canManageSystem()) refreshPasswordResetBadge(true);

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
        registration.update(); // 🌟 บังคับตรวจสอบและอัปเดต Service Worker เสมอเมื่อเปิดแอป
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
async function triggerPushNotification(title, body, url = '/', targetLineId = 'all', customGroupCode = null) {
    if (!READ_FROM_SUPABASE || !supabaseClient) return;

    const groupCode = customGroupCode ||
        (typeof getActiveHouseCode === 'function'
            ? getActiveHouseCode()
            : (currentUser?.groupCode || window.currentUser?.groupCode || ''));

    // 🌟 แปลง URL เป็น Absolute URL เสมอและแนบ openExternalBrowser=1 เพื่อให้เปิดเข้า PWA นอก LINE โดยตรง
    if (url) {
        try {
            let urlObj;
            if (url.startsWith('http://') || url.startsWith('https://')) {
                urlObj = new URL(url);
                // เช็คว่าชี้ไปที่ root domain ตรงๆ โดยไม่มี subpath ของระบบจริง/ระบบทดสอบ (แก้ปัญหากลุ่มหน้าเว็บบน github pages)
                if (urlObj.pathname === '/index.html' || urlObj.pathname === '/') {
                    const currentHref = window.location.href;
                    const baseDir = currentHref.substring(0, currentHref.lastIndexOf('/') + 1);
                    const targetPath = 'index.html' + urlObj.search;
                    urlObj = new URL(targetPath, baseDir);
                }
            } else {
                // หากเป็น path สัมพัทธ์ เช่น /index.html?postId=... หรือ index.html
                const currentHref = window.location.href;
                const baseDir = currentHref.substring(0, currentHref.lastIndexOf('/') + 1);
                const cleanPath = url.startsWith('/') ? url.substring(1) : url;
                urlObj = new URL(cleanPath, baseDir);
            }
            // แนบพารามิเตอร์เพื่อให้เปิดด้วยเบราว์เซอร์หลักนอกแอป LINE (เพื่อสลับเข้า PWA ดีมีสุข ที่ติดตั้งไว้โดยตรง)
            urlObj.searchParams.set('openExternalBrowser', '1');
            
            // หากมี targetLineId ที่ระบุเฉพาะเจาะจง (ไม่ใช่ 'all') ให้แนบ uid สำหรับการล็อกอินอัตโนมัติ (Auto-login)
            const cleanLineId = String(targetLineId || '').trim();
            if (cleanLineId && cleanLineId !== 'all' && cleanLineId.startsWith('U') && cleanLineId.length >= 30) {
                urlObj.searchParams.set('uid', cleanLineId);
            }
            url = urlObj.href;
        } catch (e) {
            console.error('URL rewrite with openExternalBrowser error:', e);
        }
    }

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
                targetLineId: targetLineId,
                groupCode: groupCode
            })
        });
        const result = await response.json();
        console.log('📢 Push Notification trigger response:', result);
        return result;
    } catch (e) {
        console.error('❌ Failed to trigger Push Notification:', e);
    }
}

// ฟังก์ชันสำหรับส่งการแจ้งเตือนไปยังผู้ดูแลระบบ/ผู้บริหารประจำกลุ่มบ้านของตนเอง
async function notifyHouseManagers(title, body, url = '/') {
    if (!READ_FROM_SUPABASE || !supabaseClient || !window.allUsersMap) return;
    const myGroup = typeof getActiveHouseCode === 'function'
        ? getActiveHouseCode()
        : (currentUser?.groupCode || window.currentUser?.groupCode || '').trim().toUpperCase();
    if (!myGroup || myGroup === 'HQ' || myGroup === 'ALL') return;

    const managers = Object.values(window.allUsersMap).filter(u => {
        const uGroup = (u.groupCode || '').trim().toUpperCase();
        if (uGroup !== myGroup) return false;
        
        const uRole = String(u.role || '').toLowerCase();
        return uRole.includes('manager') || 
               uRole.includes('admin') || 
               uRole.includes('ผู้บริหาร') || 
               uRole.includes('ผู้ดูแลระบบ');
    });

    for (const mgr of managers) {
        const myId = (currentUser?.userId || window.currentUser?.lineId || '');
        if (mgr.lineId && mgr.lineId !== myId) {
            try {
                await triggerPushNotification(title, body, url, mgr.lineId);
            } catch (err) {
                console.error(`Failed to notify manager ${mgr.name}:`, err);
            }
        }
    }
}


// คัดลอกลิงก์ล็อกอินด่วน (Magic Link) สำหรับใช้เปิดนอก LINE
function copyMagicLink() {
    Swal.fire({
        icon: 'info',
        title: 'เปลี่ยนเป็นบัญชีที่ปลอดภัย',
        text: 'ลิงก์ล็อกอินด่วนถูกยกเลิกแล้ว กรุณาตั้ง Username และรหัสผ่านแทน',
        confirmButtonText: 'ตั้งค่าบัญชี'
    }).then(result => {
        if (result.isConfirmed) showAccountSettings();
    });
    return;
    
    // Copy to clipboard
    navigator.clipboard.writeText(magicLoginUrl).then(() => {
        Swal.fire({
            icon: 'success',
            title: 'คัดลอกลิงก์ด่วนแล้ว 🎉',
            html: `
                <div class="text-start">
                    <p class="small text-muted mb-2">ลิงก์ล็อกอินด่วน (Magic Link):</p>
                    <div class="p-2 bg-light rounded text-break mb-3" style="font-size:0.8rem; font-family: monospace; border: 1px solid #ddd;">${magicLoginUrl}</div>
                    <p class="small text-muted mb-0">คุณสามารถนำลิงก์นี้ไปเปิดบน <b>Safari / Chrome</b> ในอุปกรณ์ใดก็ได้เพื่อเข้าสู่ระบบอัตโนมัติทันที</p>
                </div>
            `,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#6c5ce7'
        });
    }).catch(err => {
        // Fallback if clipboard API fails
        Swal.fire({
            title: 'ลิงก์ล็อกอินด่วน (Magic Link)',
            html: `
                <div class="text-start">
                    <p class="small text-muted mb-2">คัดลอกลิงก์ด้านล่างเพื่อไปเปิดใน Safari/Chrome บนอุปกรณ์ของคุณ:</p>
                    <input type="text" id="manualCopyLink" class="form-control text-center" readonly value="${magicLoginUrl}" onclick="this.select()">
                </div>
            `,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#6c5ce7'
        });
    });
}
