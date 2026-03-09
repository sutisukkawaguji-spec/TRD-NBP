// ============================================================
// 📰  feed.js — Feed Fetching, Rendering & Filtering
//     ต้องโหลดหลัง config.js
// ============================================================

// ----- Media Helpers -----
function getMediaContent(url, note = '') {
    try {
        if (!url) return '';
        url = url.trim();

        // ป้องกัน Error จากตัวอักษรพิเศษเวลาส่งผ่าน onclick
        const safeNote = encodeURIComponent(note || '').replace(/'/g, "%27");

        // 🌟 อัปเดต: เพิ่มการตรวจสอบลิงก์จาก Googleusercontent และ Drive
        const isImageUrl = url.match(/\.(jpeg|jpg|gif|png|webp|bin)($|\?)/i) ||
            url.includes('googleusercontent') ||
            url.includes('drive.google.com') ||
            url.includes('cloudinary');

        if (url.includes(',') || isImageUrl) {
            const urls = url.split(',').map(u => u.trim()).filter(u => u.length > 0);

            // กรองเฉพาะที่เป็นรูปลิงก์จริงๆ (รวมถึงลิงก์ Google เก่าๆ)
            const imgUrls = urls.filter(u =>
                u.match(/\.(jpeg|jpg|gif|png|webp|bin)($|\?)/i) ||
                u.includes('googleusercontent') ||
                u.includes('drive.google.com') ||
                u.includes('cloudinary')
            );

            if (imgUrls.length > 0) {
                const count = imgUrls.length;
                const displayCount = Math.min(count, 5);
                let gridHtml = `<div class="image-grid image-grid-${displayCount}">`;

                window.postImages = window.postImages || {};
                const mediaId = 'media_' + Math.random().toString(36).substr(2, 9);
                window.postImages[mediaId] = imgUrls;

                imgUrls.slice(0, displayCount).forEach((img, idx) => {
                    const isLast = idx === 4 && count > 5;
                    gridHtml += `
                        <div class="grid-img-wrapper" onclick="openImageViewer(window.postImages['${mediaId}'], ${idx}, '${safeNote}')">
                            <img src="${img}" loading="lazy" class="grid-img" onerror="this.src='https://dummyimage.com/300x300/ddd/888&text=Image+Error'">
                            ${isLast ? `<div class="more-overlay">+${count - 5}</div>` : ''}
                        </div>`;
                });
                gridHtml += `</div>`;
                return gridHtml;
            }
        }

        // YouTube Support
        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/))([a-zA-Z0-9_-]{11})/);
        if (ytMatch?.[1]) {
            const vid = ytMatch[1];
            return `<div class="video-container shadow-sm border rounded-4 overflow-hidden mb-2">
                <div class="ratio ratio-16x9">
                    <iframe src="https://www.youtube.com/embed/${vid}?autoplay=0&rel=0" allowfullscreen loading="lazy"></iframe>
                </div>
            </div>`;
        }

        // Direct Video Files
        if (url.match(/\.(mp4|webm|ogg)($|\?)/i)) {
            return `<div class="video-container shadow-sm border rounded-4 overflow-hidden mb-2 bg-dark">
                <div class="ratio ratio-16x9">
                    <video src="${url}" controls preload="metadata"></video>
                </div>
            </div>`;
        }

        // Social Media Links (Premium Cards)
        if (url.includes('tiktok.com')) return createLinkCard(url, 'TikTok', 'fab fa-tiktok', '#000000', 'ดูวิดีโอต้นฉบับบน TikTok');
        if (url.includes('facebook.com') || url.includes('fb.watch')) return createLinkCard(url, 'Facebook', 'fab fa-facebook', '#1877F2', 'รับชมวิดีโอผ่าน Facebook');
        if (url.includes('instagram.com')) return createLinkCard(url, 'Instagram', 'fab fa-instagram', '#E1306C', 'เปิดดูรูปภาพ/วิดีโอใน Instagram');
        if (url.startsWith('http')) return createLinkCard(url, 'External Link', 'fas fa-external-link-alt', '#636e72', 'คลิกเพื่อเปิดลิงก์ภายนอก');

        return '';
    } catch (e) {
        console.warn("Media content render error:", e, url);
        return `<div class="small text-muted p-2 border rounded">ไฟล์แนบไม่สามารถแสดงผลได้</div>`;
    }
}

function createLinkCard(url, name, icon, color, label) {
    return `<a href="${url}" target="_blank" class="text-decoration-none d-block animate__animated animate__fadeIn">
        <div class="social-link-card p-3 rounded-4 border shadow-sm d-flex align-items-center mb-2" style="border-left:5px solid ${color} !important; background: var(--glass-bg);">
            <div class="card-icon me-3 d-flex align-items-center justify-content-center" style="width:50px; height:50px; background:${color}15; color:${color}; border-radius:15px; font-size:1.5rem;">
                <i class="${icon}"></i>
            </div>
            <div class="flex-grow-1 overflow-hidden">
                <div class="fw-bold text-dark mb-0" style="font-size:0.95rem;">${label || name}</div>
                <div class="text-muted text-truncate small">${url}</div>
            </div>
            <div class="ms-2 text-muted opacity-50"><i class="fas fa-chevron-right"></i></div>
        </div>
    </a>`;
}

// ----- Media Preview (Form) -----
function previewMedia(url) {
    const preview = document.getElementById('videoPreviewArea');
    if (!preview) return;
    const html = getMediaContent(url);
    if (html) { preview.innerHTML = html; preview.style.display = 'block'; }
    else { preview.innerHTML = ''; preview.style.display = 'none'; }
}
function clearMedia() {
    document.getElementById('mediaLinkInput').value = '';
    const p = document.getElementById('videoPreviewArea');
    if (p) { p.innerHTML = ''; p.style.display = 'none'; }
}

// ----- Filter Button -----
function setFeedFilter(type, btn) {
    currentFeedFilter = type;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    fetchFeed();
}

// --- Global States for Local Pagination ---
let currentVisibleCount = 10;
const FEED_PAGE_SIZE = 10;

// ----- Fetch & Render Feed -----
function fetchFeed(append = false, silent = false, force = false, targetUserId = null) {
    return new Promise((resolve) => {
        // 🛡️ ป้องกันการโหลดซ้อนกัน (รวมทั้งแบบ Silent ด้วย)
        if (isFetchingFeed && !force) return resolve();

        isFetchingFeed = true;

        const container = document.getElementById('feedContainer');

        // ถ้าเป็นการ Force Refresh (กดปุ่มรีเฟรชเอง) ให้ล้างสถานะและแสดง Skeleton กวักรอ
        if (force && container && !append) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted animate__animated animate__pulse animate__infinite">
                    <i class="fas fa-spinner fa-spin fa-2x mb-3 d-block opacity-50"></i>
                    กำลังรีเฟรชใหม่...
                </div>`;
            renderedPostIds.clear();
        }
        const filterType = currentFeedFilter;
        const filterCategory = document.getElementById('filterCategory')?.value || '';
        const filterDate = document.getElementById('filterDate')?.value || '';
        const filterYear = document.getElementById('filterYear')?.value || '';

        // ถ้ามีการระบุ targetUserId (เช่น ดูประวัติในหน้า Relation) ให้ข้าม filter อื่นๆ และเจาะจงคน
        const queryParams = [`action=get_feed`, `limit=${currentFeedLimit}`, `t=${Date.now()}`];
        if (targetUserId) {
            queryParams.push(`userId=${targetUserId}`);
        }

        if (!append) {
            // 🌟 ดึงข้อมูลเยอะหน่อย (100 แถว) เพื่อให้ครอบคลุมการค้นหาในหน้าทำเนียบ และโพสต์ที่ปักหมุดไว้
            currentFeedLimit = 100;
            currentVisibleCount = FEED_PAGE_SIZE; // Reset การแสดงผลกลับไปที่ 10 เมื่อโหลดใหม่
            renderedPostIds.clear();
        }

        if (!container) { isFetchingFeed = false; return resolve(); }

        if (!append && !silent) {
            // แสดง Skeleton Loading (เหมือนเดิม)
            container.innerHTML = `
            <div class="skeleton-card" style="animation: fadeSlideIn 0.3s ease;">
                <div class="d-flex align-items-center mb-3">
                    <div class="skeleton rounded-circle me-3" style="width:45px;height:45px;flex-shrink:0;"></div>
                    <div class="flex-grow-1">
                        <div class="skeleton mb-2" style="height:14px;width:60%;"></div>
                        <div class="skeleton" style="height:12px;width:35%;"></div>
                    </div>
                </div>
                <div class="skeleton mb-2" style="height:160px;width:100%;border-radius:12px;"></div>
                <div class="d-flex gap-2 mt-2">
                    <div class="skeleton" style="height:12px;width:25%;"></div>
                    <div class="skeleton" style="height:12px;width:15%;"></div>
                </div>
            </div>`;
        } else if (append && !silent) {
            const btn = document.getElementById('loadMoreBtnWrapper');
            if (btn) btn.innerHTML = '<button class="btn btn-outline-primary rounded-pill px-4 disabled"><i class="fas fa-spinner fa-spin me-1"></i>กำลังโหลด...</button>';
        }

        // 🌟 ฟังก์ชันหลักสำหรับ Render Feed หลังจากได้ข้อมูลมาแล้ว (ใช้ร่วมกันทั้ง Fetch และ JSONP)
        const handleFeedData = (data) => {
            try {
                const spinIcon = document.getElementById('refresh-icon-spin');
                if (spinIcon) spinIcon.classList.remove('fa-spin');

                // เคลียร์สถานะการโหลดก่อนเป็นอันดับแรก
                isFetchingFeed = false;

                if (!container) { console.error("FetchFeed: Container not found"); return resolve(); }
                if (!currentUser) { console.warn("FetchFeed: No current user"); return resolve(); }

                // 🛡️ ป้องกันการล้างหน้าจอถ้าเป็นการแอบโหลดเบื้องหลัง (Silent) 
                // หรือถ้ามีข้อมูลเดิมอยู่แล้วแต่กำลังจะอัปเดตใหม่
                if (!append) {
                    // ถ้าเป็น Silent และมี Card อยู่แล้ว ไม่ต้องล้างให้กระพริบ
                    const hasCards = container.querySelector('.feed-card');
                    if (!silent || !hasCards) {
                        container.innerHTML = '';
                    }
                } else {
                    document.getElementById('loadMoreBtnWrapper')?.remove();
                }

                if (data?.status === 'error') {
                    if (!silent) {
                        container.innerHTML = `<div class="text-danger text-center mt-5">Error: ${data.message}</div>`;
                    }
                    return resolve(data);
                }
                if (Array.isArray(data)) feed = data;
                else if (data?.feed) { feed = data.feed; if (data.userMap) Object.assign(allUsersMap, data.userMap); }
                if (!Array.isArray(feed)) feed = [];

                // 🌟 สำหรับหน้า Relation Detail เราอาจจะอยากได้ข้อมูลดิบไปจัดการเอง
                if (targetUserId) {
                    isFetchingFeed = false;
                    return resolve({ feed, userMap: data?.userMap });
                }

                fetch(`${GAS_URL}?${queryParams.join('&')}`)
                    .then(res => res.text()) // แปลงเป็นข้อความเพื่อตรวจสอบก่อนแกะ JSON
                    .then(text => {
                        if (text.startsWith('<')) throw new Error("CORS / Google Blocked"); // ดักหน้า HTML ขาวๆ
                        const data = JSON.parse(text);
                        handleFeedData(data);
                    })
                    .catch(err => {
                        console.warn('Feed Loading Blocked, Switching to JSONP...', err.message);
                        // 🛡️ ใช้ JSONP Fallback เมื่อ fetch ปกติล้มเหลว
                        window.__gasFeedCb = (data) => {
                            console.log("JSONP Feed Received");
                            handleFeedData(data);
                        };
                        const oldScript = document.getElementById('jsonp_feed');
                        if (oldScript) oldScript.remove();

                        const script = document.createElement('script');
                        script.id = 'jsonp_feed';
                        script.src = `${GAS_URL}?${queryParams.join('&')}&callback=__gasFeedCb`;

                        // 🌪️ หมุนไอคอนรีเฟรชถ้าเป็นการกดรีเฟรช
                        const spinIcon = document.getElementById('refresh-icon-spin');
                        if (spinIcon && !silent) spinIcon.classList.add('fa-spin');

                        document.head.appendChild(script);
                        // 🌟 Extract [PINNED] indicator (Case-insensitive & Robust)
                        feed.forEach(p => {
                            if (!p) return;
                            let noteText = String(p.note || '').trim();
                            if (/\[PINNED\]/i.test(noteText)) {
                                p.isPinned = true;
                                p.note = noteText.replace(/\[PINNED\]/gi, '').trim();
                            } else {
                                p.isPinned = false;
                                p.note = noteText; // บันทึกค่าที่ trim แล้วลงไป
                            }
                        });

                        globalFeedData = feed;

                        // --- 🔔 ระบบแจ้งเตือนโพสต์ใหม่ (Background Sync) ---
                        const lastSeen = parseInt(safeGetItem('lastSeenStoryCount') || '0');
                        const newCount = feed.length - lastSeen;
                        const navBtn = document.getElementById('nav-stories-btn');
                        const alertEl = document.getElementById('newPostAlert');
                        const isStoriesPage = document.getElementById('page-stories').classList.contains('active');

                        if (newCount > 0) {
                            if (isStoriesPage) {
                                // 🌟 ถ้าอยู่หน้าเรื่องราวอยู่แล้ว ให้ขึ้นแถบแจ้งเตือนด้านบนแทนการเปลี่ยนหน้า
                                if (alertEl && silent) alertEl.style.display = 'block';
                                safeSetItem('lastSeenStoryCount', feed.length); // อัปเดตยอดเพื่อให้ Badge หายไป
                            } else {
                                // ถ้าอยู่หน้าอื่น ให้ขึ้น Badge ที่ปุ่มเมนู
                                navBtn?.querySelector('.nav-notify-badge')?.remove();
                                navBtn?.insertAdjacentHTML('beforeend', `<div class="nav-notify-badge">${newCount}</div>`);
                                if (silent) triggerNotificationEffects?.();
                            }
                        } else if (isStoriesPage) {
                            // ถ้ากดเข้ามาดูแล้ว ให้เคลียร์ Badge และซ่อน Alert
                            if (alertEl) alertEl.style.display = 'none';
                            navBtn?.querySelector('.nav-notify-badge')?.remove();
                            safeSetItem('lastSeenStoryCount', feed.length);
                        }

                        // --- Badge ปุ่ม "รอ Verify" (ยอดที่ "เรา" ยังไม่ได้กด) ---
                        const myId = String(currentUser.userId || currentUser.id || "");
                        const pendingCount = feed.filter(p => {
                            if (!p) return false;
                            const isOwner = String(p.user_line_id || p.userId || "") === myId;
                            const isPublic = p.privacy !== 'private';
                            const verifyList = Array.isArray(p.verifies) ? p.verifies : [];
                            const alreadyVerified = verifyList.some(v => {
                                if (!v) return false;
                                if (typeof v === 'string') return v === myId;
                                return String(v.lineId || v.userId || "") === myId;
                            });

                            // ตรวจสอบว่าเราถูกแท็ก (เป็นทีม) หรือไม่?
                            let taggedList = [];
                            const tags = p.taggedFriends;
                            if (typeof tags === 'string') taggedList = tags.split(',').map(id => id.trim());
                            else if (Array.isArray(tags)) taggedList = tags.map(id => String(id).trim());
                            const amITagged = taggedList.includes(myId);

                            return isPublic && !isOwner && !alreadyVerified && !amITagged;
                        }).length;

                        const pendingBadge = document.getElementById('pending-badge');
                        if (pendingBadge) {
                            pendingBadge.textContent = pendingCount;
                            pendingBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
                        }

                        const filterBtn = document.getElementById('btn-filter-request');
                        if (filterBtn) {
                            if (pendingCount > 0) {
                                filterBtn.style.borderColor = '#e74c3c'; filterBtn.style.color = '#e74c3c'; filterBtn.style.fontWeight = 'bold';
                            } else {
                                filterBtn.style.borderColor = ''; filterBtn.style.color = ''; filterBtn.style.fontWeight = '';
                            }
                        }

                        // --- 🎛️ Filter Logic (อัปเดต: ปลดล็อกให้ Verify ได้ทุกคน) ---
                        const filteredFeed = feed.filter(post => {
                            if (!post) return false;
                            // เช็คว่าเป็นโพสต์ของเราเองหรือไม่
                            const isMyPost = String(post.user_line_id || post.userId || "") === myId;
                            const isPrivate = post.privacy === 'private';

                            // 🌟 เช็คว่าเราเคยกด Verify โพสต์นี้ไปหรือยัง (รองรับโครงสร้างข้อมูลทุกแบบ)
                            const verifyList = Array.isArray(post.verifies) ? post.verifies : [];
                            let alreadyVerified = verifyList.some(v => {
                                if (!v) return false;
                                if (typeof v === 'string') return v === myId;
                                return String(v.lineId || v.userId || "") === myId;
                            });

                            // กฎข้อ 1: ถ้าเป็นโพสต์ส่วนตัว (Private) และไม่ใช่ของเรา ให้ซ่อนทันที
                            if (isPrivate && !isMyPost) return false;

                            // กฎข้อ 2: ถ้าเลือก "เรื่องของฉัน" (ต้องเป็นโพสต์เรา หรือ เราถูกแท็ก)
                            // 🌟 ยกเว้นถ้าเลือก "กิจกรรมเด่น" ให้โชว์ทุกคนที่ถูกปักหมุด
                            if (filterType === 'related' && filterCategory !== 'featured') {
                                let taggedList = [];
                                if (typeof post.taggedFriends === 'string') {
                                    taggedList = post.taggedFriends.split(',').map(id => id.trim());
                                } else if (Array.isArray(post.taggedFriends)) {
                                    taggedList = post.taggedFriends.map(id => String(id).trim());
                                }
                                const amITagged = taggedList.includes(String(currentUser.userId)) || taggedList.includes(currentUser.name);

                                if (!isMyPost && !amITagged) return false;
                            }

                            // กฎข้อ 3: 🌟 ถ้าเลือก "รอ Verify" (ยอดที่เรายังไม่ได้กด)
                            if (filterType === 'request') {
                                // โชว์เฉพาะ: "ไม่ใช่โพสต์เรา" และ "เรายังไม่ได้กดยืนยันให้เขา" และ "เราต้องไม่ใช่คนในทีม"
                                let taggedList = [];
                                const tags = post.taggedFriends;
                                if (typeof tags === 'string') taggedList = tags.split(',').map(id => id.trim());
                                else if (Array.isArray(tags)) taggedList = tags.map(id => String(id).trim());
                                const amITagged = taggedList.includes(myId);

                                if (isMyPost || alreadyVerified || amITagged) {
                                    return false;
                                }
                            }

                            // กฎข้อ 4: ถ้าเลือก "กิจกรรมเด่น" (Featured)
                            if (filterCategory === 'featured') {
                                // 📌 เปลี่ยนตามคำขอ: แสดงเฉพาะโพสต์ที่ Admin/NewsEditor ปักหมุดไว้เท่านั้น (Manual Pin)
                                if (!post.isPinned) return false;
                            } else if (filterCategory && post.virtue !== filterCategory) {
                                return false;
                            }

                            // กฎข้อ 5: ถ้าเลือกปี
                            if (filterYear) {
                                const py = post.timestamp ? new Date(post.timestamp).getFullYear() : '';
                                if (String(py) !== filterYear) return false;
                            }

                            return true;
                        });

                        renderFeedUI(filteredFeed, append);

                        isFetchingFeed = false;
                        resolve();
                    } catch (e) {
                        isFetchingFeed = false;
                        console.error("HandleFeedData Error:", e);
                        if (!silent && !append) {
                            container.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-exclamation-circle text-danger fa-2x mb-3"></i><br>
                        เกิดข้อผิดพลาดในการแสดงผล กรุณาลองใหม่<br>
                        <small class="text-muted">${e.message}</small>
                        <br><button class="btn btn-sm btn-outline-primary mt-2 rounded-pill" onclick="fetchFeed(false, false, true)">ลองรีเฟรชอีกครั้ง</button>
                    </div>`;
                        }
                        resolve();
                    }
            };

            // 🌟 ฟังก์ชันแปลงข้อมูล Feed เป็น HTML (แยกออกมาเพื่อให้ใช้ซ้ำได้)
            function generateFeedHtml(posts, options = {}) {
                const {
                    visibleCount = currentVisibleCount,
                    containerId = 'feedContainer',
                    showRelationBtn = true
                } = options;

                const visibleFeed = posts.slice(0, visibleCount);
                const hasMore = posts.length > visibleCount;

                const virtueMap = { volunteer: '🤝 จิตอาสา', sufficiency: '🌱 พอเพียง', discipline: '📏 วินัย', integrity: '💎 สุจริต', gratitude: '🙏 กตัญญู' };
                const iconMap = { like: '👍', love: '❤️', wow: '😮', laugh: '😂', sad: '😢', pray: '🙏' };
                const myId = String(window.currentUser?.userId || "");

                let htmlBuffer = '';
                visibleFeed.forEach(post => {
                    if (!post || !post.id) return;

                    // กรองความลับเบื้องต้นเพื่อความปลอดภัยตอน Render (กรณีเรียกใช้แยกจุด)
                    const isMyPost = String(post.user_line_id || post.userId || "") === myId;
                    const isPrivate = post.privacy === 'private';
                    if (isPrivate && !isMyPost) return;

                    const postDate = post.timestamp ? new Date(post.timestamp) : null;
                    const isValidDate = postDate && !isNaN(postDate);
                    const isAdmin = currentUser.role && /admin|ผู้บริหาร|manager|บรรณาธิการ|newseditor/i.test(currentUser.role);
                    const canSee = !isPrivate || isMyPost;

                    const tags = post.taggedFriends;
                    const taggedIds = (typeof tags === 'string') ? tags.split(',').map(s => s.trim()).filter(s => s.length > 5)
                        : (Array.isArray(tags) ? tags.map(s => String(s).trim()).filter(s => s.length > 5) : []);

                    const isTeam = taggedIds.length > 0;
                    const amITagged = taggedIds.includes(myId);
                    const verifyList = Array.isArray(post.verifies) ? post.verifies : [];
                    const isVerifiedByMe = verifyList.some(v => {
                        if (!v) return false;
                        if (typeof v === 'string') return v === myId;
                        return String(v.lineId || v.userId || "") === myId;
                    });

                    let teamList = Array.isArray(post.tagged_avatars) ? post.tagged_avatars : [];
                    if (teamList.length === 0 && taggedIds.length > 0 && typeof allUsersMap !== 'undefined')
                        teamList = taggedIds.map(id => allUsersMap[id]).filter(Boolean);

                    let taggedHtml = '';
                    if (isTeam && canSee) {
                        taggedHtml = `<div class="row-participants animate__animated animate__fadeIn"><small class="text-primary me-2 fw-bold"><i class="fas fa-users"></i> Team:</small><div class="d-flex align-items-center">`;
                        teamList.forEach(u => { taggedHtml += `<img src="${u.img}" class="tagged-img" title="${u.name}" loading="lazy" onerror="this.src='https://dummyimage.com/30x30/ccc/888&text=?'">`; });
                        taggedHtml += `</div></div>`;
                    }

                    let witnessHtml = '';
                    if (verifyList.length > 0 && canSee) {
                        witnessHtml = `<div class="row-witness animate__animated animate__fadeIn"><small class="text-success me-2 fw-bold"><i class="fas fa-check-circle"></i> Witness:</small><div class="d-flex align-items-center">`;
                        verifyList.forEach(v => { witnessHtml += `<img src="${v.img}" class="witness-img" title="${v.name}" loading="lazy" onerror="this.src='https://dummyimage.com/30x30/ccc/888&text=?'">`; });
                        witnessHtml += `</div></div>`;
                    }

                    let btnHtml = '';
                    const userLevel = typeof getUserLevel === 'function' ? getUserLevel(currentUser) : 5;
                    if (userLevel === 5) {
                        btnHtml = '<span class="badge bg-light text-muted rounded-pill ms-auto">Read Only</span>';
                    } else if (isPrivate) {
                        if (isMyPost) btnHtml = `<span class="badge bg-secondary rounded-pill ms-auto"><i class="fas fa-lock"></i> Private</span>`;
                    } else if (isMyPost) {
                        if (isTeam) btnHtml = `<span class="badge bg-info text-dark rounded-pill ms-auto"><i class="fas fa-users"></i> Team Work</span>`;
                        else btnHtml = verifyList.length > 0 ? `<span class="badge bg-success rounded-pill ms-auto"><i class="fas fa-check"></i> Approved</span>` : `<span class="badge bg-secondary rounded-pill ms-auto"><i class="fas fa-clock"></i> Pending</span>`;
                    } else {
                        if (amITagged) btnHtml = `<span class="badge bg-light text-primary border rounded-pill ms-auto"><i class="fas fa-user-tag"></i> You're in team</span>`;
                        else btnHtml = isVerifiedByMe ? `<button class="btn btn-sm btn-success rounded-pill ms-auto disabled">Verified</button>` : `<button onclick="verifyPost('${post.id}','${post.user_line_id || post.userId || ""}','${encodeURIComponent(post.user_name || "")}',this)" class="btn btn-sm btn-outline-primary rounded-pill ms-auto">Verify (+3)</button>`;
                    }

                    const likes = Array.isArray(post.likes) ? post.likes : [];
                    let myReaction = likes.find(u => {
                        if (!u) return false;
                        if (typeof u === 'string') return u === myId;
                        return String(u.lineId || u.userId || "") === myId;
                    });
                    let reactIcon = myReaction ? (iconMap[myReaction.type || 'like'] || '👍') : '🤍';

                    const mediaContent = canSee ? getMediaContent(post.image, post.note) : '';
                    const noteContent = canSee ? post.note : '<span class="text-muted fst-italic"><i class="fas fa-lock"></i> Private</span>';

                    let vdoBtnHtml = '';
                    const lnk = post.image || '';
                    if (lnk.includes('youtube') || lnk.includes('youtu.be')) vdoBtnHtml = `<a href="${lnk}" target="_blank" class="btn btn-sm btn-light text-danger rounded-pill border ms-2" style="font-size:0.75rem;"><i class="fab fa-youtube"></i> Watch VDO</a>`;
                    else if (lnk.includes('tiktok')) vdoBtnHtml = `<a href="${lnk}" target="_blank" class="btn btn-sm btn-light text-dark rounded-pill border ms-2" style="font-size:0.75rem;"><i class="fab fa-tiktok"></i> TikTok</a>`;
                    else if (lnk.includes('facebook') || lnk.includes('fb.watch')) vdoBtnHtml = `<a href="${lnk}" target="_blank" class="btn btn-sm btn-light text-primary rounded-pill border ms-2" style="font-size:0.75rem;"><i class="fab fa-facebook"></i> Facebook</a>`;

                    const dateStr = isValidDate ? postDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

                    htmlBuffer += `
        <div id="post-${post.id}" class="glass-card feed-card p-3 mb-3 animate__animated animate__fadeIn">
            <div class="feed-header d-flex align-items-start">
                <img src="${post.user_img || 'https://dummyimage.com/45x45/ddd/888&text=?'}" class="feed-avatar me-2 mt-1" loading="lazy" onerror="this.src='https://dummyimage.com/45x45/ddd/888&text=?'">
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between">
                        <h6 class="mb-0 fw-bold">${post.user_name || 'Unknown'} <span class="pin-indicator">${post.isPinned ? '<i class="fas fa-thumbtack text-warning ms-1" title="กิจกรรมเด่นปักหมุดโดยผู้ดูแล"></i>' : ''}</span></h6>
                        <small class="text-muted" style="font-size:0.7rem;">${dateStr}</small>
                    </div>
                    <small class="text-primary mb-1 d-block fw-bold">${virtueMap[post.virtue] || post.virtue || ''}</small>
                </div>
            </div>
            ${taggedHtml}
            <div class="text-end mb-2 mt-2">${btnHtml}</div>
            <div class="mt-2 mb-2 p-2 bg-light rounded text-dark">${noteContent}</div>
            <div class="mb-2">${mediaContent}</div>
            ${witnessHtml}
            <div class="feed-actions border-top pt-2 d-flex align-items-center mt-2 justify-content-between">
                <div class="d-flex align-items-center">
                    <div class="reaction-wrap position-relative me-3" id="react-wrap-${post.id}">
                        <div class="action-btn ${myReaction ? 'liked' : ''}" onclick="toggleReaction('${post.id}')" oncontextmenu="return false;">
                            <span id="icon-${post.id}" class="me-1">${reactIcon}</span>
                            <span id="count-${post.id}" class="text-muted small">${likes.length}</span>
                        </div>
                        <div id="popup-${post.id}" class="reaction-popup shadow animate__animated animate__bounceIn">
                            <span onclick="submitReaction('${post.id}', 'like')">👍</span>
                            <span onclick="submitReaction('${post.id}', 'love')">❤️</span>
                            <span onclick="submitReaction('${post.id}', 'wow')">😮</span>
                            <span onclick="submitReaction('${post.id}', 'laugh')">😂</span>
                            <span onclick="submitReaction('${post.id}', 'sad')">😢</span>
                            <span onclick="submitReaction('${post.id}', 'pray')">🙏</span>
                        </div>
                    </div>
                    <div class="action-btn" onclick="sharePost('${post.id}')">
                        <i class="far fa-share-square me-1"></i> <span class="small">แชร์</span>
                    </div>
                </div>
                ${vdoBtnHtml}
                <div class="ms-auto d-flex gap-1">
                    ${(isMyPost || isAdmin) ? `<button class="btn btn-sm btn-light border-0 text-primary" onclick="editPost('${post.id}')"><i class="fas fa-edit"></i></button>` : ''}
                    ${(isMyPost || isAdmin) ? `<button class="btn btn-sm btn-light border-0 text-danger" onclick="deletePost('${post.id}')"><i class="fas fa-trash-alt"></i></button>` : ''}
                </div>
            </div>
        </div>`;
                });

                if (hasMore) {
                    const loadMoreAttr = options.loadMoreOnClick || `loadMoreFeed()`;
                    htmlBuffer += `
            <div id="loadMoreBtnWrapper" class="text-center py-4">
                <button class="btn btn-outline-primary rounded-pill px-5 shadow-sm bg-white" onclick="${loadMoreAttr}">
                    <i class="fas fa-chevron-down me-2"></i> ดูเรื่องราวเพิ่มเติม
                </button>
                <div class="text-muted small mt-2">แสดง ${visibleFeed.length} จากทั้งหมด ${posts.length} ชุด</div>
            </div>`;
                }

                return htmlBuffer;
            }

            // 🌟 ฟังก์ชัน Render UI หลัก
            function renderFeedUI(filteredFeed, append = false) {
                const container = document.getElementById('feedContainer');
                if (!container) return;

                if (filteredFeed.length === 0) {
                    if (!append) {
                        const filterType = currentFeedFilter;
                        const msg = filterType === 'request' ? '✅ ไม่มีโพสต์ที่รอ Verify จากคุณ'
                            : filterType === 'related' ? 'ยังไม่มีเรื่องราวของคุณ'
                                : 'ยังไม่มีเรื่องราว';
                        container.innerHTML = `<div class="text-center py-5 text-muted"><i class="fas fa-inbox fa-2x mb-3 d-block opacity-50"></i>${msg}</div>`;
                    }
                    return;
                }

                // Clear renderedPostIds for a fresh render, or add to it for append
                if (!append) {
                    renderedPostIds.clear();
                }

                // Generate HTML for the visible portion of the feed
                const html = generateFeedHtml(filteredFeed, { visibleCount: currentVisibleCount });

                // Update renderedPostIds based on what was actually rendered
                filteredFeed.slice(0, currentVisibleCount).forEach(post => {
                    if (post && post.id) {
                        renderedPostIds.add(post.id);
                    }
                });

                if (append) container.insertAdjacentHTML('beforeend', html);
                else container.innerHTML = html;
            }
        }
    });
}

function loadMoreFeed() {
    currentVisibleCount += FEED_PAGE_SIZE;

    // 🌪️ ใช้ข้อมูลจาก Cache เดิมมารัน Local Pagination (ไม่ต้อง Fetch ใหม่)
    if (globalFeedData && globalFeedData.length > 0) {
        // กรองข้อมูลใหม่ภายใต้เงื่อนไข Filter ปัจจุบัน
        const myId = String(window.currentUser?.userId || "");
        const filterType = currentFeedFilter;
        const filterCategory = document.getElementById('filterCategory')?.value || '';
        const filterYear = document.getElementById('filterYear')?.value || '';

        const filteredFeed = globalFeedData.filter(post => {
            if (!post) return false;
            const isMyPost = String(post.user_line_id || post.userId || "") === myId;
            const isPrivate = post.privacy === 'private';
            const verifyList = Array.isArray(post.verifies) ? post.verifies : [];
            const alreadyVerified = verifyList.some(v => String(v.userId || v.lineId || v) === myId);

            if (isPrivate && !isMyPost) return false;
            if (filterType === 'related' && filterCategory !== 'featured') {
                let taggedList = String(post.taggedFriends || '').split(',').map(id => id.trim());
                if (!isMyPost && !taggedList.includes(myId)) return false;
            }
            if (filterType === 'request') {
                let taggedList = String(post.taggedFriends || '').split(',').map(id => id.trim());
                if (isMyPost || alreadyVerified || taggedList.includes(myId)) return false;
            }
            if (filterCategory === 'featured') { if (!post.isPinned) return false; }
            else if (filterCategory && post.virtue !== filterCategory) return false;
            if (filterYear) {
                const py = post.timestamp ? new Date(post.timestamp).getFullYear() : '';
                if (String(py) !== filterYear) return false;
            }
            return true;
        });

        renderedPostIds.clear(); // เคลียร์เพื่อให้จัดคิว Render ใหม่ได้
        renderFeedUI(filteredFeed, false);
    } else {
        // กรณีไม่มี Cache (เป็นไปได้น้อยมาก)
        currentFeedLimit += 20;
        fetchFeed(true);
    }
}

// ----- Reaction -----
function toggleReaction(postId) {
    const popup = document.getElementById(`popup-${postId}`);
    const isVisible = popup.style.display === 'flex';
    document.querySelectorAll('.reaction-popup').forEach(p => p.style.display = 'none');
    if (!isVisible) popup.style.display = 'flex';
}
function closeReaction(postId) {
    setTimeout(() => { document.getElementById(`popup-${postId}`).style.display = 'none'; }, 500);
}
function submitReaction(postId, type) {
    const iconMap = { like: '👍', love: '❤️', wow: '😮', laugh: '😂', sad: '😢', pray: '🙏' };
    const iconEl = document.getElementById(`icon-${postId}`);
    const countEl = document.getElementById(`count-${postId}`);
    const wrap = document.querySelector(`#react-wrap-${postId} .action-btn`);
    if (wrap && !wrap.classList.contains('liked')) {
        countEl.innerText = parseInt(countEl.innerText) + 1;
        wrap.classList.add('liked');
    }
    iconEl.innerText = iconMap[type];
    document.getElementById(`popup-${postId}`).style.display = 'none';
    fetch(GAS_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'like_post', postId, userId: currentUser.userId, reactionType: type }) });
}

// ----- Verify -----
function verifyPost(postId, targetId, targetName, btnElement) {
    // อัปเดต UI ทันที (Optimistic UI) - ทำงานเบื้องหลัง ไม่ขัดจังหวะ
    if (btnElement) {
        const originalContent = btnElement.innerHTML;
        const originalClass = btnElement.className;

        btnElement.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> กำลังบันทึก...';
        btnElement.classList.add('disabled');
        btnElement.style.pointerEvents = 'none';

        fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'verify_post', postId, verifierId: currentUser.userId, targetUserLineId: targetId })
        }).then(() => {
            btnElement.innerHTML = '<i class="fas fa-check-circle me-1"></i> ยืนยันแล้ว (+3)';
            btnElement.className = 'btn btn-sm btn-success rounded-pill ms-auto disabled';
            btnElement.removeAttribute('onclick');

            // แสดง Toast เล็กๆ แทนการใช้ Modal ใหญ่ๆ ที่ต้องกดตกลง
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });
            Toast.fire({
                icon: 'success',
                title: 'ยืนยันสำเร็จ! (+3 คะแนน)'
            });

            // อัปเดตตัวเลขคะแนนแบบเงียบๆ
            if (currentUser) {
                currentUser.score = (currentUser.score || 0) + 3;
                if (typeof renderProfile === 'function') renderProfile();
            }
        }).catch(err => {
            console.error('Verify failed:', err);
            btnElement.innerHTML = originalContent;
            btnElement.className = originalClass;
            btnElement.style.pointerEvents = 'auto';
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถบันทึกการยืนยันได้', timer: 2000 });
        });
    }
}

// ----- Delete / Edit -----
function deletePost(postId) {
    Swal.fire({
        title: 'ลบโพสต์นี้?', text: 'คะแนนที่ได้จากโพสต์นี้จะถูกหักออกด้วย', icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#e74c3c', cancelButtonColor: '#aaa',
        confirmButtonText: '🗑️ ลบเลย', cancelButtonText: 'ยกเลิก'
    }).then(r => {
        if (!r.isConfirmed) return;

        // 🌪️ Optimistic UI: หายไปทันทีเพื่อความรวดเร็ว
        const postEl = document.getElementById(`post-${postId}`);
        if (postEl) {
            postEl.style.opacity = '0.3';
            postEl.style.transform = 'scale(0.9)';
            postEl.style.transition = '0.3s';
            setTimeout(() => postEl.style.display = 'none', 300);
        }

        Swal.fire({ toast: true, icon: 'info', title: 'กำลังลบโพสต์...', position: 'top', timer: 1500, showConfirmButton: false });

        fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_post', postId, userId: currentUser.userId }) })
            .then(r => r.json()).then(d => {
                if (d.status === 'success') {
                    Swal.fire({ toast: true, icon: 'success', title: `ลบโพสต์แล้วครับ`, position: 'top', timer: 2000, showConfirmButton: false });

                    // 🌟 ลบออกจาก Local Cache (globalFeedData) ด้วย เพื่อไม่ให้โผล่มาอีก
                    if (window.globalFeedData) {
                        window.globalFeedData = window.globalFeedData.filter(p => String(p.id) !== String(postId));
                    }

                    // อัปเดตข้อมูลคะแนนใหม่เบื้องหลัง
                    if (typeof checkUser === 'function') checkUser();

                    // ถ้าเป็นระดับ Manager ให้แอบรีเฟรช Dashboard ด้วย
                    if (getUserLevel(currentUser) <= 2 && typeof fetchManagerData === 'function') {
                        fetchManagerData(true);
                    }
                } else {
                    if (postEl) postEl.style.display = ''; // คืนค่าถ้าพัง
                    Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: d.message || '' });
                }
            }).catch(() => {
                // ถ้า Catch (เน็ตหลุด) แต่คำสั่งอาจจะไปถึง GAS แล้ว ให้ถือว่าสำเร็จและเช็คใหม่
                if (typeof checkUser === 'function') checkUser();
                if (getUserLevel(currentUser) <= 2 && typeof fetchManagerData === 'function') fetchManagerData(true);
            });
    });
}

function editPost(postId) {
    // 🔍 ปรับปรุง: ใช้ String() เพื่อให้เทียบ ID ได้ถูกต้องทั้งแบบตัวเลขและข้อความ
    const post = globalFeedData.find(p => String(p.id) === String(postId));

    if (!post) {
        console.warn('EditPost: Post not found in global cache', postId);
        // ถ้าหาไม่เจอจริงๆ ให้ลองโหลดใหม่
        Swal.fire({
            toast: true, icon: 'info',
            title: 'ไม่พบข้อมูลโพสต์ กรุณารีเฟรชหน้าจอ',
            position: 'top', timer: 3000
        });
        return;
    }

    const virtueMap = { volunteer: '🤝 จิตอาสา', sufficiency: '🌱 พอเพียง', discipline: '📏 วินัย', integrity: '💎 สุจริต', gratitude: '🙏 กตัญญู' };
    const currentNote = post.note || '';
    const currentVirtue = post.virtue || 'volunteer';

    // สร้าง HTML สำหรับ Select
    let optionsHtml = '';
    for (const [key, label] of Object.entries(virtueMap)) {
        optionsHtml += `<option value="${key}" ${key === currentVirtue ? 'selected' : ''}>${label}</option>`;
    }

    Swal.fire({
        title: '✏️ แก้ไขเรื่องราว',
        html: `
            <div class="text-start">
                <label class="small fw-bold text-muted mb-1">หมวดหมู่ความดี:</label>
                <select id="swal-virtue" class="form-select mb-3 rounded-3" style="font-family:Kanit,sans-serif;">
                    ${optionsHtml}
                </select>
                <label class="small fw-bold text-muted mb-1">ข้อความเรื่องราว:</label>
                <textarea id="swal-note" class="form-control rounded-3" rows="4" style="font-family:Kanit,sans-serif;font-size:0.9rem;">${currentNote}</textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#6c5ce7',
        preConfirm: () => {
            const newNote = document.getElementById('swal-note').value;
            const newVirtue = document.getElementById('swal-virtue').value;
            if (!newNote.trim()) {
                Swal.showValidationMessage('กรุณากรอกข้อความ');
                return false;
            }
            return { newNote: newNote.trim(), newVirtue };
        }
    }).then(r => {
        if (!r.isConfirmed) return;
        const { newNote, newVirtue } = r.value;

        // 🌟 Optimistic UI Update - ทำงานเบื้องหลัง ไม่ขัดจังหวะ
        const card = document.getElementById(`post-${postId}`);
        if (card) {
            const noteEl = card.querySelector('.p-2.bg-light.rounded.text-dark');
            const virtueEl = card.querySelector('.text-primary.mb-1.d-block.fw-bold');
            if (noteEl) noteEl.innerText = newNote;
            if (virtueEl) virtueEl.innerText = virtueMap[newVirtue];
        }

        // ⚖️ โยกแต้มกิจกรรม (ถ้ามีการเปลี่ยนหมวดหมู่)
        if (newVirtue !== currentVirtue && currentUser && currentUser.virtueStats) {
            const isVerified = (post.verifies && post.verifies.length > 0);

            // กฎ: ถ้ามีคน verify แล้ว ให้โยกแต้มกิจกรรมหมวดเดิม 1 แต้ม ไปหมวดใหม่ทันที
            // (คะแนนรวมไม่โยก โยกแค่แต้มในแต่ละหมวดเพื่อแสดงในกราฟ)
            if (isVerified) {
                const moveAmount = 1;

                // 1. โยกแต้มของตัวเราเอง (Poster)
                if (currentUser.virtueStats[currentVirtue] !== undefined) {
                    currentUser.virtueStats[currentVirtue] = Math.max(0, currentUser.virtueStats[currentVirtue] - moveAmount);
                }
                currentUser.virtueStats[newVirtue] = (currentUser.virtueStats[newVirtue] || 0) + moveAmount;

                // 2. โยกแต้มของเพื่อนที่ถูกแท็ก (Tagged Friends) ทุกคน
                const taggedIds = post.taggedFriends ? String(post.taggedFriends).split(',').map(s => s.trim()) : [];
                taggedIds.forEach(id => {
                    const friend = allUsersMap[id] || globalUserStatsMap[id];
                    if (friend && friend.virtueStats) {
                        if (friend.virtueStats[currentVirtue] !== undefined) {
                            friend.virtueStats[currentVirtue] = Math.max(0, friend.virtueStats[currentVirtue] - moveAmount);
                        }
                        friend.virtueStats[newVirtue] = (friend.virtueStats[newVirtue] || 0) + moveAmount;
                    }
                });

                // อัปเดต UI ทันทีเพื่อให้คะแนนในกราฟขยับ
                if (typeof renderProfile === 'function') renderProfile();
                if (typeof initUserRadar === 'function') initUserRadar();
                if (typeof renderDashboard === 'function' && globalAppUsers?.length) renderDashboard(globalAppUsers);
            }
        }

        // อัปเดตข้อมูลใน Cache
        post.note = newNote;
        post.virtue = newVirtue;

        // 🚀 ส่งข้อมูลไปหลังบ้าน
        fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'edit_post', postId, newNote, newVirtue, userId: currentUser.userId })
        }).then(res => res.json()).then(d => {
            if (d.status === 'success') {
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                Toast.fire({ icon: 'success', title: 'บันทึกการแก้ไขแล้ว' });
            } else {
                Swal.fire({ icon: 'error', title: 'แก้ไขไม่สำเร็จ', text: d.message || '' });
                fetchFeed(); // ถ้าพลาดให้โหลดใหม่เพื่อคืนค่าเดิม
            }
        }).catch(err => {
            console.error('Edit failed:', err);
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            Toast.fire({ icon: 'info', title: 'บันทึกเรียบร้อย (Background)' });
        });
    });
}


// ----- View Image -----
// ----- Fullscreen Image Viewer (พร้อมระบบพิมพ์ดีด) -----
let viewerImages = [];
let viewerIndex = 0;
let typewriterTimeout;
let isViewerOpen = false;
let currentViewerNote = '';

function openImageViewer(images, index = 0, encodedNote = '') {
    if (typeof images === 'string') images = images.split(',').map(s => s.trim());
    viewerImages = images;
    viewerIndex = index;
    // ถอดรหัสข้อความกลับมา
    currentViewerNote = encodedNote ? decodeURIComponent(encodedNote) : '';

    const viewer = document.getElementById('imageViewer');
    if (!viewer) return;

    // สร้างกล่องข้อความพิมพ์ดีดหากยังไม่มี
    let overlay = document.getElementById('viewerTextOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'viewerTextOverlay';
        viewer.appendChild(overlay);
    }

    viewer.style.display = 'flex';
    isViewerOpen = true;
    updateViewer();
    document.body.style.overflow = 'hidden';

    // เริ่มเล่นเอฟเฟกต์พิมพ์ดีด
    startTypewriter(currentViewerNote);
}

function startTypewriter(text) {
    clearTimeout(typewriterTimeout);
    const overlay = document.getElementById('viewerTextOverlay');
    if (!overlay) return;

    if (!text || !isViewerOpen) {
        overlay.style.display = 'none';
        return;
    }

    overlay.style.display = 'block';
    let i = 0;

    function typeNext() {
        if (!isViewerOpen) return; // หยุดถ้ายกเลิกดูรูปแล้ว

        // พิมพ์ทีละตัว พร้อมเคอร์เซอร์กะพริบ
        overlay.innerHTML = text.substring(0, i + 1) + '<span class="blink-cursor">|</span>';

        // 🌟 หัวใจสำคัญ: สั่งให้กล่อง Scroll ลงล่างสุดอัตโนมัติ 
        // (เมื่อข้อความล้นกล่อง บรรทัดเก่าจะถูกดันขึ้นไปข้างบนเรื่อยๆ)
        overlay.scrollTop = overlay.scrollHeight;

        i++;

        if (i <= text.length) {
            typewriterTimeout = setTimeout(typeNext, 60);
        } else {
            // จบรอบเดียวตามคำขอ: นิ่งไว้ที่ข้อความสุดท้าย
            overlay.innerHTML = text;
        }
    }
    typeNext();
}

function updateViewer() {
    const imgEl = document.getElementById('viewerImg');
    const currentEl = document.getElementById('viewerCurrent');
    const totalEl = document.getElementById('viewerTotal');

    if (imgEl) imgEl.src = viewerImages[viewerIndex];
    if (currentEl) currentEl.innerText = viewerIndex + 1;
    if (totalEl) totalEl.innerText = viewerImages.length;

    document.querySelector('.viewer-prev').style.visibility = viewerImages.length > 1 ? 'visible' : 'hidden';
    document.querySelector('.viewer-next').style.visibility = viewerImages.length > 1 ? 'visible' : 'hidden';
}

function changeViewerImg(dir) {
    viewerIndex += dir;
    if (viewerIndex < 0) viewerIndex = viewerImages.length - 1;
    if (viewerIndex >= viewerImages.length) viewerIndex = 0;
    updateViewer();
}

function closeImageViewer() {
    isViewerOpen = false;
    clearTimeout(typewriterTimeout); // หยุดเอฟเฟกต์ทันที

    const viewer = document.getElementById('imageViewer');
    if (viewer) viewer.style.display = 'none';
    document.body.style.overflow = '';
}

function viewImage(url, note = '') {
    openImageViewer([url], 0, encodeURIComponent(note).replace(/'/g, "%27"));
}

function togglePinPost(postId, encodedCurrentNote, isCurrentlyPinned) {
    if (!currentUser || !currentUser.role || !/admin|ผู้บริหาร|manager|บรรณาธิการ|newseditor/i.test(currentUser.role)) return;

    let decoded = decodeURIComponent(encodedCurrentNote);
    let newNote = isCurrentlyPinned ? decoded.replace(/\[PINNED\]/g, '').trim() : decoded + '\n\n[PINNED]';

    // 🌟 Optimistic UI Update (Background working)
    const card = document.getElementById(`post-${postId}`);
    if (card) {
        const pinIndicator = card.querySelector('.pin-indicator');
        const pinBtn = card.querySelector('.pin-btn');
        const nextPinnedState = !isCurrentlyPinned;
        const encodedNewNote = encodeURIComponent(newNote);

        if (pinIndicator) {
            pinIndicator.innerHTML = nextPinnedState ? '<i class="fas fa-thumbtack text-warning ms-1" title="กิจกรรมเด่นปักหมุดโดยผู้ดูแล"></i>' : '';
        }
        if (pinBtn) {
            pinBtn.className = `btn btn-sm btn-outline-${nextPinnedState ? 'warning' : 'secondary'} pin-btn rounded-circle ms-1`;
            pinBtn.style.background = nextPinnedState ? '#fff3cd' : '';
            // อัปเดต onclick ให้สลับสถานะกลับได้ทันที
            pinBtn.onclick = () => togglePinPost(postId, encodedNewNote, nextPinnedState);
        }
    }

    // 🚀 ส่งข้อมูลไปหลังบ้านแบบไม่บล็อกหน้าจอ
    fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'edit_post', postId, newNote, userId: currentUser.userId }) })
        .then(res => res.json()).then(d => {
            if (d.status === 'success') {
                // อัปเดตข้อมูลในตัวแปร Global ด้วยเพื่อให้การ Render ครั้งหน้า (เช่น Load More) ถูกต้อง
                const post = globalFeedData.find(p => p.id === postId);
                if (post) {
                    post.isPinned = !isCurrentlyPinned;
                    post.note = newNote.replace(/\[PINNED\]/gi, '').trim();
                }

                // 🌟 ถ้ากำลังดู "กิจกรรมเด่น" แล้วเราเลิกปักหมุด ให้ค่อยๆ หายไปจากหน้าจอ
                const filterCategory = document.getElementById('filterCategory')?.value || '';
                if (filterCategory === 'featured' && isCurrentlyPinned && card) {
                    card.classList.add('animate__fadeOutRight');
                    setTimeout(() => card.remove(), 500);
                }

                Swal.fire({ toast: true, icon: 'success', title: isCurrentlyPinned ? 'เลิกปักหมุดแล้ว' : 'ปักหมุดกิจกรรมแล้ว!', position: 'top', timer: 2000, showConfirmButton: false });
            } else {
                Swal.fire({ icon: 'error', title: 'ดำเนินการไม่สำเร็จ', text: d.message || '' });
                fetchFeed(); // ถ้าพลาดให้โหลดใหม่เพื่อคืนค่าเดิม
            }
        }).catch(() => {
            console.error('Pin update failed');
            fetchFeed();
        });
}
