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

        // 🌟 แผนใหม่: ถ้าดึงประวัติรายคน ให้ใช้ action เฉพาะทาง เพื่อความลึกและแม่นยำ
        const action = targetUserId ? 'get_user_posts' : 'get_feed';
        const limit = targetUserId ? 500 : currentFeedLimit; // ถ้าดึงประวัติรายคน ให้ดึงเยอะๆ ไปเลย (Deep Fetch)
        const queryParams = [`action=${action}`, `limit=${limit}`, `t=${Date.now()}`];

        if (targetUserId) {
            queryParams.push(`userId=${targetUserId}`);
        }

        if (!append) {
            // เคลียร์สถานะการ Render เดิม
            currentVisibleCount = FEED_PAGE_SIZE;
            renderedPostIds.clear();
        }

        if (!container) { isFetchingFeed = false; return resolve(); }

        if (!append && !silent) {
            // แสดง Skeleton Loading
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

        // 🌟 ฟังก์ชันหลักสำหรับ Render Feed หลังจากได้ข้อมูลมาแล้ว
        const handleFeedData = (data) => {
            try {
                const spinIcon = document.getElementById('refresh-icon-spin');
                if (spinIcon) spinIcon.classList.remove('fa-spin');

                isFetchingFeed = false;

                if (!container) return resolve();
                if (!currentUser) return resolve();

                // 🛡️ ป้องกันการล้างหน้าจอถ้าเป็นการแอบโหลดเบื้องหลัง (Silent)
                if (!append) {
                    const hasCards = container.querySelector('.feed-card');
                    if (!silent || !hasCards) {
                        container.innerHTML = '';
                    }
                } else {
                    document.getElementById('loadMoreBtnWrapper')?.remove();
                }

                if (data?.status === 'error') {
                    if (!silent) container.innerHTML = `<div class="text-danger text-center mt-5">Error: ${data.message}</div>`;
                    return resolve(data);
                }

                let feed = [];
                if (Array.isArray(data)) feed = data;
                else if (data?.feed) {
                    feed = data.feed;
                    if (data.userMap) Object.assign(allUsersMap, data.userMap);
                }
                if (!Array.isArray(feed)) feed = [];

                // 🌟 Extract [PINNED] indicator
                feed.forEach(p => {
                    if (!p) return;
                    let noteText = String(p.note || '').trim();
                    if (/\[PINNED\]/i.test(noteText)) {
                        p.isPinned = true;
                        p.note = noteText.replace(/\[PINNED\]/gi, '').trim();
                    } else {
                        p.isPinned = false;
                        p.note = noteText;
                    }
                });

                // 🌟 สำหรับหน้า Relation Detail เราจะคืนข้อมูลชุดนี้ไปแสดงผลเอง
                if (targetUserId) {
                    return resolve({ feed, userMap: data?.userMap });
                }

                globalFeedData = feed;

                // --- 🔔 ระบบ Badge แจ้งเตือนยอด Story ---
                const lastSeen = parseInt(safeGetItem('lastSeenStoryCount') || '0');
                const newCount = feed.length - lastSeen;
                const navBtn = document.getElementById('nav-stories-btn');
                const alertEl = document.getElementById('newPostAlert');
                const isStoriesPage = document.getElementById('page-stories').classList.contains('active');

                if (newCount > 0) {
                    if (isStoriesPage) {
                        if (alertEl && silent) alertEl.style.display = 'block';
                        safeSetItem('lastSeenStoryCount', feed.length);
                    } else {
                        navBtn?.querySelector('.nav-notify-badge')?.remove();
                        navBtn?.insertAdjacentHTML('beforeend', `<div class="nav-notify-badge">${newCount}</div>`);
                        if (silent) triggerNotificationEffects?.();
                    }
                }

                // --- 🎛️ Filter Logic (Bypass if targetUserId is present) ---
                const myId = String(currentUser.userId || currentUser.id || "");
                const filteredFeed = targetUserId ? feed : feed.filter(post => {
                    if (!post) return false;
                    const isMyPost = String(post.user_line_id || post.userId || "") === myId;
                    const isPrivate = post.privacy === 'private';
                    const verifyList = Array.isArray(post.verifies) ? post.verifies : [];
                    let alreadyVerified = verifyList.some(v => String(v.lineId || v.userId || v) === myId);

                    if (isPrivate && !isMyPost) return false;

                    if (filterType === 'related' && filterCategory !== 'featured') {
                        let taggedList = String(post.taggedFriends || '').split(',').map(id => id.trim());
                        if (!isMyPost && !taggedList.includes(myId)) return false;
                    }

                    if (filterType === 'request') {
                        let taggedList = String(post.taggedFriends || '').split(',').map(id => id.trim());
                        if (isMyPost || alreadyVerified || taggedList.includes(myId)) return false;
                    }

                    if (filterCategory === 'featured') {
                        if (!post.isPinned) return false;
                    } else if (filterCategory && post.virtue !== filterCategory) {
                        return false;
                    }

                    if (filterYear) {
                        const py = post.timestamp ? new Date(post.timestamp).getFullYear() : '';
                        if (String(py) !== filterYear) return false;
                    }

                    return true;
                });

                renderFeedUI(filteredFeed, append);
                resolve();
            } catch (e) {
                isFetchingFeed = false;
                console.error("HandleFeedData Error:", e);
                resolve();
            }
        };

        // 🚀 เรียกดึงข้อมูล (Fetch or JSONP)
        fetch(`${GAS_URL}?${queryParams.join('&')}`)
            .then(res => res.text())
            .then(text => {
                if (text.startsWith('<')) throw new Error("CORS Blocked");
                handleFeedData(JSON.parse(text));
            })
            .catch(err => {
                console.log('Switching to JSONP...', err.message);
                window.__gasFeedCb = (data) => handleFeedData(data);
                const oldScript = document.getElementById('jsonp_feed');
                if (oldScript) oldScript.remove();
                const script = document.createElement('script');
                script.id = 'jsonp_feed';
                script.src = `${GAS_URL}?${queryParams.join('&')}&callback=__gasFeedCb`;
                document.head.appendChild(script);
            });
    });
}

// 🌟 ฟังก์ชันแปลงข้อมูล Feed เป็น HTML (รองรับ Local Pagination)
function generateFeedHtml(posts, options = {}) {
    const {
        visibleCount = currentVisibleCount,
        loadMoreOnClick = "loadMoreFeed()",
        isReadOnly = false // 🔥 เพิ่ม Option สำหรับปิดการแก้ไข (ใช้ในหน้าทำเนียบ)
    } = options;

    const visibleFeed = posts.slice(0, visibleCount);
    const hasMore = posts.length > visibleCount;

    const virtueMap = { volunteer: '🤝 จิตอาสา', sufficiency: '🌱 พอเพียง', discipline: '📏 วินัย', integrity: '💎 สุจริต', gratitude: '🙏 กตัญญู' };
    const iconMap = { like: '👍', love: '❤️', wow: '😮', laugh: '😂', sad: '😢', pray: '🙏' };
    const myId = String(window.currentUser?.userId || "");

    let htmlBuffer = '';
    visibleFeed.forEach(post => {
        if (!post || !post.id) return;

        // 🆔 ระบุตัวตนผู้ใช้ปัจจุบัน (ใช้จาก currentUser ใน config.js)
        const currentUserId = String(currentUser?.userId || currentUser?.id || window.currentUser?.userId || "");
        // ตรวจสอบว่าเป็นโพสต์ของเราเองหรือไม่ (เช็คทั้ง user_line_id และ userId จาก GAS)
        const postAuthorId = String(post.user_line_id || post.userId || "");
        const isMyPost = (postAuthorId !== "" && postAuthorId === currentUserId);

        // 👮 สิทธิ์กว้าง: ปักหมุด/ลบโพสต์ผู้อื่น (Manager / Admin / Editor)
        const isManagerOrAdmin = (currentUser && currentUser.role && /admin|ผู้ดูแล|ผู้บริหาร|manager|บรรณาธิการ|newseditor|เจ้าหน้าที่|officer/i.test(currentUser.role));
        // 🛡️ สิทธิ์เข้มงวด: แก้ไขโพสต์ผู้อื่น (Admin เท่านั้น)
        const isStrictAdmin = (currentUser && currentUser.role && /admin|ผู้ดูแลระบบ/i.test(currentUser.role));

        const postDate = post.timestamp ? new Date(post.timestamp) : null;
        const dateStr = (postDate && !isNaN(postDate)) ? postDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

        const tags = post.taggedFriends;
        const taggedIds = (typeof tags === 'string') ? tags.split(',').map(s => s.trim()) : [];
        const isTeam = taggedIds.length > 0;
        const verifyList = Array.isArray(post.verifies) ? post.verifies : [];

        // เช็คว่าเรายืนยันไปหรือยัง
        const isVerifiedByMe = verifyList.some(v => String(v.userId || v.lineId || v) === currentUserId);

        let taggedHtml = '';
        if (isTeam) {
            taggedHtml = `<div class="row-participants animate__animated animate__fadeIn"><small class="text-primary me-2 fw-bold"><i class="fas fa-users"></i> Team:</small><div class="d-flex align-items-center">`;
            const teamList = Array.isArray(post.tagged_avatars) ? post.tagged_avatars : (typeof allUsersMap !== 'undefined' ? taggedIds.map(id => allUsersMap[id]).filter(Boolean) : []);
            teamList.forEach(u => { taggedHtml += `<img src="${u.img}" class="tagged-img" title="${u.name}" loading="lazy" onerror="this.src='https://dummyimage.com/30x30/ccc/888&text=?'">`; });
            taggedHtml += `</div></div>`;
        }

        let witnessHtml = '';
        if (verifyList.length > 0) {
            witnessHtml = `<div class="row-witness animate__animated animate__fadeIn"><small class="text-success me-2 fw-bold"><i class="fas fa-check-circle"></i> Witness:</small><div class="d-flex align-items-center">`;
            verifyList.forEach(v => { witnessHtml += `<img src="${v.img}" class="witness-img" title="${v.name}" loading="lazy" onerror="this.src='https://dummyimage.com/30x30/ccc/888&text=?'">`; });
            witnessHtml += `</div></div>`;
        }

        const likes = Array.isArray(post.likes) ? post.likes : [];
        const myReaction = likes.find(u => String(u.lineId || u.userId || u) === myId);
        const reactIcon = myReaction ? (iconMap[myReaction.type || 'like'] || '👍') : '🤍';

        htmlBuffer += `
        <div id="post-${post.id}" class="glass-card feed-card p-3 mb-3 animate__animated animate__fadeIn ${post.isPinned ? 'border-primary' : ''}">
            <div class="feed-header d-flex align-items-start">
                <img src="${post.user_img || 'https://dummyimage.com/45x45/ddd/888&text=?'}" class="feed-avatar me-2 mt-1" loading="lazy">
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between">
                        <div class="d-flex align-items-center">
                            <h6 class="mb-0 fw-bold">${post.user_name || 'Unknown'}</h6>
                            ${post.isPinned ? '<span class="badge bg-warning text-dark ms-2" style="font-size:0.6rem;"><i class="fas fa-thumbtack me-1"></i>ปักหมุดข่าว</span>' : ''}
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            ${(!isMyPost && !taggedIds.includes(currentUserId) && !isVerifiedByMe && post.status === 'waiting_verify') ? `
                                <button class="btn btn-xs btn-outline-success rounded-pill px-2 shadow-sm animate__animated animate__pulse animate__infinite" style="font-size:0.65rem;" onclick="verifyPost('${post.id}', '${post.user_line_id}', '${post.user_name}', this)">
                                    <i class="fas fa-check-circle me-1"></i> เป็นพยาน (+3)
                                </button>` : ''}
                            ${isVerifiedByMe ? `<span class="badge bg-success text-white rounded-pill" style="font-size:0.6rem;"><i class="fas fa-check-circle me-1"></i> ยืนยันแล้ว</span>` : ''}
                            <small class="text-muted" style="font-size:0.7rem;">${dateStr}</small>
                        </div>
                    </div>
                    <small class="text-primary mb-1 d-block fw-bold">${virtueMap[post.virtue] || post.virtue || ''}</small>
                </div>
            </div>
            ${taggedHtml}
            <div class="mt-2 mb-2 p-2 bg-light rounded text-dark">${post.note || ''}</div>
            <div class="mb-2">${getMediaContent(post.image, post.note)}</div>
            ${witnessHtml}
            <div class="feed-actions border-top pt-2 d-flex align-items-center mt-2 justify-content-between">
                <div class="d-flex align-items-center">
                    <div class="reaction-wrap position-relative me-3" id="react-wrap-${post.id}">
                        <div class="action-btn ${myReaction ? 'liked' : ''}" onclick="toggleReaction('${post.id}')">
                            <span id="icon-${post.id}" class="me-1">${reactIcon}</span>
                            <span id="count-${post.id}" class="text-muted small">${likes.length}</span>
                        </div>
                        <div id="popup-${post.id}" class="reaction-popup shadow animate__animated animate__bounceIn">
                            ${Object.keys(iconMap).map(k => `<span onclick="submitReaction('${post.id}', '${k}')">${iconMap[k]}</span>`).join('')}
                        </div>
                    </div>
                </div>
                    ${isVerifiedByMe ? `<span class="badge bg-success-subtle text-success rounded-pill mx-1" style="font-size:0.6rem;"><i class="fas fa-check-circle me-1"></i> พยานยืนยันแล้ว</span>` : ''}
                
                <div class="ms-auto d-flex gap-1 align-items-center">
                    ${(!isReadOnly && (post.isPinned || isManagerOrAdmin)) ? `
                        <button class="btn btn-sm border-0 rounded-pill px-2 feed-manage-btn ${post.isPinned ? 'text-primary' : 'text-muted'}" style="font-size:0.75rem;" onclick="togglePinPost('${post.id}')" title="${post.isPinned ? 'เลิกปักหมุด' : 'ปักหมุดข่าว'}">
                            <i class="fas fa-thumbtack"></i>
                        </button>
                    ` : ''}

                    ${(!isReadOnly && (isMyPost || isStrictAdmin)) ? `
                        <button class="btn btn-sm border-0 rounded-pill px-2 feed-manage-btn text-primary" style="font-size:0.75rem;" onclick="editPost('${post.id}')" title="แก้ไขโพสต์">
                            <i class="fas fa-edit"></i>
                        </button>
                    ` : ''}
                    
                    ${(!isReadOnly && (isMyPost || isStrictAdmin)) ? `
                        <button class="btn btn-sm border-0 rounded-pill px-2 feed-manage-btn text-danger" style="font-size:0.75rem;" onclick="deletePost('${post.id}')" title="ลบโพสต์">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>`;
    });

    if (hasMore) {
        htmlBuffer += `
            <div id="loadMoreBtnWrapper" class="text-center py-4">
                <button class="btn btn-outline-primary rounded-pill px-5 shadow-sm bg-white" onclick="${loadMoreOnClick}">
                    <i class="fas fa-chevron-down me-2"></i> ดูเรื่องราวเพิ่มเติม
                </button>
                <div class="text-muted small mt-2">แสดง ${visibleFeed.length} จากทั้งหมด ${posts.length} ชุด</div>
            </div>`;
    }
    return htmlBuffer;
}

// 🌟 ฟังก์ชัน Render ลง Container หลัก
function renderFeedUI(filteredFeed, append = false) {
    const container = document.getElementById('feedContainer');
    if (!container) return;

    if (filteredFeed.length === 0 && !append) {
        container.innerHTML = `<div class="text-center py-5 text-muted"><i class="fas fa-inbox fa-2x mb-3 d-block opacity-50"></i>ยังไม่มีเรื่องราว</div>`;
        return;
    }

    const html = generateFeedHtml(filteredFeed, { visibleCount: currentVisibleCount });
    if (append) container.insertAdjacentHTML('beforeend', html);
    else container.innerHTML = html;
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
    if (!popup) return;
    const isVisible = popup.style.display === 'flex';

    // ปิดอันอื่นก่อน
    document.querySelectorAll('.reaction-popup').forEach(p => p.style.display = 'none');

    if (!isVisible) {
        popup.style.display = 'flex';
        // คลิกข้างนอกให้ปิด
        const closeHandler = (e) => {
            if (!popup.contains(e.target) && !e.target.closest(`.action-btn`)) {
                popup.style.display = 'none';
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);
    }
}
function closeReaction(postId) {
    setTimeout(() => { document.getElementById(`popup-${postId}`).style.display = 'none'; }, 500);
}
function submitReaction(postId, type) {
    const iconMap = { like: '👍', love: '❤️', wow: '😮', laugh: '😂', sad: '😢', pray: '🙏' };
    const iconEl = document.getElementById(`icon-${postId}`);
    const countEl = document.getElementById(`count-${postId}`);
    const wrap = document.querySelector(`#react-wrap-${postId} .action-btn`);
    if (wrap) {
        if (!wrap.classList.contains('liked')) {
            countEl.innerText = parseInt(countEl.innerText) + 1;
            wrap.classList.add('liked');
        }
        // เลื่อนเปลี่ยนไอคอนทันที
        iconEl.innerText = iconMap[type];
    }
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
            Swal.fire({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true,
                icon: 'success',
                title: 'ยืนยันสำเร็จ! (+3 คะแนน)'
            });

            // 💾 อัปเดตข้อมูลใน Cache เพื่อให้สถานะยังคงอยู่เมื่อเลื่อนหน้าจอ
            const post = globalFeedData.find(p => String(p.id) === String(postId));
            if (post) {
                if (!post.verifies) post.verifies = [];
                // จำลองว่าเราเป็นคนยืนยันเพิ่มเข้าไป
                post.verifies.push({
                    userId: currentUser.userId,
                    name: currentUser.name,
                    img: currentUser.img
                });

                // หากต้องการให้ปุ่มหายไปทันทีและกลายเป็น Badge เขียว
                // เราไม่จำเป็นต้องเรียก generateFeedHtml ใหม่ เพื่อความลื่นไหล
            }

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

                    // 🌟 ลบออกจาก Local Cache ทุกแหล่ง เพื่อไม่ให้โผล่มาอีก
                    if (window.globalFeedData) {
                        window.globalFeedData = window.globalFeedData.filter(p => String(p.id) !== String(postId));
                    }
                    if (window.currentRelationPosts) {
                        window.currentRelationPosts = window.currentRelationPosts.filter(p => String(p.id) !== String(postId));
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
    // 🔍 ปรับปรุง: ตรวจสอบจากทุกแหล่งข้อมูลที่มี
    const allPosts = [...(window.globalFeedData || []), ...(window.currentRelationPosts || [])];
    const post = allPosts.find(p => String(p.id) === String(postId));

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

/* togglePinPost merged into later implementation */
// 🌟 ฟังก์ชันปักหมุด/เลิกปักหมุด
// 🌟 ฟังก์ชันปักหมุด/เลิกปักหมุด (Merged & Finalized)
function togglePinPost(postId) {
    if (!currentUser || !/admin|ผู้บริหาร|manager|บรรณาธิการ|newseditor/i.test(currentUser.role || '')) {
        Swal.fire('🚫 ปฏิเสธ', 'คุณไม่มีสิทธิ์จัดลำดับเรื่องราว', 'error');
        return;
    }

    // 🔍 ค้นหาโพสต์จาก Cache (ทั้งหน้า Feed หลัก และหน้า Profile)
    const allPosts = [...(window.globalFeedData || []), ...(window.currentRelationPosts || [])];
    const post = allPosts.find(p => String(p.id) === String(postId));

    if (!post) {
        console.warn('Pin: Post not found', postId);
        Swal.fire('ผิดพลาด', 'ไม่พบข้อมูลเรื่องราวในระบบชั่วคราว (ลองรีเฟรชหน้าจออีกครั้ง)', 'error');
        return;
    }

    const isPinned = !!post.isPinned;
    const currentNoteText = String(post.note || '').trim();
    // เพิ่ม/ลบสัญลักษณ์ [PINNED] ท้ายข้อความเพื่อสื่อสารกับหลังบ้าน (กฎเดิม)
    const newNote = isPinned ? currentNoteText : `${currentNoteText}\n\n[PINNED]`;

    Swal.fire({
        title: isPinned ? 'เลิกปักหมุดเรื่องราว?' : 'ปักหมุดเรื่องราวนี้?',
        text: isPinned ? 'เรื่องราวนี้จะกลับไปอยู่ตามลำดับเวลาปกติ' : 'เรื่องราวนี้จะถูกแสดงอยู่ด้านบนสุดสำหรับทุกคนในหน้ากิจกรรมเด่น',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#6c5ce7',
        confirmButtonText: 'ตกลง',
        cancelButtonText: 'ยกเลิก'
    }).then(r => {
        if (!r.isConfirmed) return;

        Swal.fire({
            toast: true, icon: 'info',
            title: 'กำลังบันทึก...', position: 'top',
            showConfirmButton: false, timer: 1000
        });

        fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'edit_post',
                postId: post.id,
                newNote: newNote,
                newVirtue: post.virtue || 'volunteer', // รักษาหมวดเดิมไว้
                userId: currentUser.userId
            })
        }).then(res => res.json()).then(data => {
            if (data.status === 'success') {
                Swal.fire({ toast: true, icon: 'success', title: 'ดำเนินการสำเร็จ', position: 'top', timer: 2000, showConfirmButton: false });

                // อัปเดต Cache ทั่วทั้งระบบทันที (ไม่ต้องโหลดใหม่ทั้งหมด)
                post.isPinned = !isPinned;
                if (post.isPinned) {
                    // ถ้ากำลังปักหมุด ให้มั่นใจว่า Note ไม่มีคำว่า [PINNED] ซ้อน (เพราะ handleFeedData จะกรองออกอยู่แล้ว)
                }

                // สั่ง Reload Feed แบบเงียบๆ เพื่อจัดเรียงใหม่ตามความสำคัญ
                if (typeof fetchFeed === 'function') fetchFeed(false, true, true);
            } else {
                Swal.fire('ผิดพลาด', data.message || 'ไม่สามารถบันทึกได้', 'error');
            }
        }).catch(e => {
            console.error("Pin Post Error:", e);
            Swal.fire('ผิดพลาด', 'การเชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
        });
    });
}

// ----- End of Feed Helpers -----
