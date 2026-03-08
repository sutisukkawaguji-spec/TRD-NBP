// ============================================================
// 📰  feed.js — Feed Fetching, Rendering & Filtering
//     ต้องโหลดหลัง config.js
// ============================================================

// ----- Media Helpers -----
function getMediaContent(url, note = '') {
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

// ----- Fetch & Render Feed -----
function fetchFeed(append = false, silent = false) {
    return new Promise((resolve) => {
        if (isFetchingFeed) return resolve();
        if (!silent) isFetchingFeed = true;

        const container = document.getElementById('feedContainer');
        const filterType = currentFeedFilter;
        const filterCategory = document.getElementById('filterCategory')?.value || '';
        const filterDate = document.getElementById('filterDate')?.value || '';
        const filterYear = document.getElementById('filterYear')?.value || '';

        if (!append) {
            // 🌟 ถ้าเลือกเป็นกิจกรรมเด่น ให้ดึงข้อมูลมาเยอะๆ เลย (เช่น 100 แถว) เพื่อค้นหาโพสต์ที่ปักหมุดไว้
            currentFeedLimit = (filterCategory === 'featured') ? 100 : 10;
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
            if (!append) container.innerHTML = '';
            else { document.getElementById('loadMoreBtnWrapper')?.remove(); }

            if (!currentUser) return resolve();

            let feed = [];
            if (data?.status === 'error') {
                container.innerHTML = `<div class="text-danger text-center mt-5">Error: ${data.message}</div>`;
                isFetchingFeed = false;
                return resolve();
            }
            if (Array.isArray(data)) feed = data;
            else if (data?.feed) { feed = data.feed; if (data.userMap) Object.assign(allUsersMap, data.userMap); }
            if (!Array.isArray(feed)) feed = [];

            // 🌟 Extract [PINNED] indicator (Case-insensitive & Robust)
            feed.forEach(p => {
                let noteText = (p.note || '').trim();
                if (/\[PINNED\]/i.test(noteText)) {
                    p.isPinned = true;
                    p.note = noteText.replace(/\[PINNED\]/gi, '').trim();
                } else p.isPinned = false;
            });

            globalFeedData = feed;

            // --- Badge แท็บเรื่องราว ---
            const lastSeen = parseInt(safeGetItem('lastSeenStoryCount') || '0');
            const newStories = feed.length - lastSeen;
            const navBtn = document.getElementById('nav-stories-btn');
            navBtn?.querySelector('.nav-notify-badge')?.remove();
            if (newStories > 0 && !document.getElementById('page-stories').classList.contains('active')) {
                navBtn?.insertAdjacentHTML('beforeend', `<div class="nav-notify-badge">${newStories}</div>`);
                if (silent) triggerNotificationEffects?.();
            } else if (document.getElementById('page-stories').classList.contains('active')) {
                safeSetItem('lastSeenStoryCount', feed.length);
            }

            // --- Badge ปุ่ม "รอ Verify" ---
            const pendingCount = feed.filter(p => {
                const isOwner = String(p.user_line_id) === String(currentUser.userId);
                const alreadyDone = (p.verifies || []).some(v => String(v.lineId) === String(currentUser.userId));
                const isPublic = p.privacy !== 'private';
                const iAmTagged = (p.taggedFriends || '').includes(currentUser.userId);
                return iAmTagged && !alreadyDone && !isOwner && isPublic;
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
                // เช็คว่าเป็นโพสต์ของเราเองหรือไม่
                const isMyPost = String(post.user_line_id || post.userId) === String(currentUser.userId);
                const isPrivate = post.privacy === 'private';

                // 🌟 เช็คว่าเราเคยกด Verify โพสต์นี้ไปหรือยัง (รองรับโครงสร้างข้อมูลทุกแบบ)
                const verifyList = post.verifies || [];
                let alreadyVerified = false;
                if (Array.isArray(verifyList)) {
                    alreadyVerified = verifyList.some(v =>
                        String(v.lineId || v.userId) === String(currentUser.userId) ||
                        String(v) === String(currentUser.userId)
                    );
                }

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

                // กฎข้อ 3: 🌟 ถ้าเลือก "รอ Verify" (แก้ไขใหม่)
                if (filterType === 'request') {
                    // โชว์เฉพาะ: "ไม่ใช่โพสต์เรา" และ "เรายังไม่ได้กดยืนยันให้เขา"
                    if (isMyPost || alreadyVerified) {
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

            if (filteredFeed.length === 0 && !append) {
                const msg = filterType === 'request' ? '✅ ไม่มีโพสต์ที่รอ Verify จากคุณ'
                    : filterType === 'related' ? 'ยังไม่มีเรื่องราวของคุณ'
                        : 'ยังไม่มีเรื่องราว';
                container.innerHTML = `<div class="text-center py-5 text-muted"><i class="fas fa-inbox fa-2x mb-3 d-block opacity-50"></i>${msg}</div>`;
                isFetchingFeed = false;
                return resolve();
            }

            // --- Render Cards ---
            const virtueMap = { volunteer: '🤝 จิตอาสา', sufficiency: '🌱 พอเพียง', discipline: '📏 วินัย', integrity: '💎 สุจริต', gratitude: '🙏 กตัญญู' };
            const iconMap = { like: '👍', love: '❤️', wow: '😮', laugh: '😂', sad: '😢', pray: '🙏' };

            let htmlBuffer = '';
            filteredFeed.forEach(post => {
                if (renderedPostIds.has(post.id)) return;
                renderedPostIds.add(post.id);

                const postDate = post.timestamp ? new Date(post.timestamp) : null;
                const isValidDate = postDate && !isNaN(postDate);
                const isMyPost = String(post.user_line_id) === String(currentUser.userId);
                const isAdmin = currentUser.role && /admin|ผู้บริหาร|manager|บรรณาธิการ|newseditor/i.test(currentUser.role);
                const isPrivate = post.privacy === 'private';
                const canSee = !isPrivate || isMyPost;
                const taggedIds = post.taggedFriends ? String(post.taggedFriends).split(',').map(s => s.trim()).filter(s => s.length > 5) : [];
                const isTeam = taggedIds.length > 0;
                const amITagged = taggedIds.includes(String(currentUser.userId));
                const verifyList = post.verifies || [];
                const isVerifiedByMe = verifyList.some(v => String(v.lineId) === String(currentUser.userId));

                let teamList = post.tagged_avatars || [];
                if (teamList.length === 0 && taggedIds.length > 0)
                    teamList = taggedIds.map(id => allUsersMap[id]).filter(Boolean);

                let taggedHtml = '';
                if (isTeam && canSee) {
                    taggedHtml = `<div class="row-participants animate__animated animate__fadeIn"><small class="text-primary me-2 fw-bold"><i class="fas fa-users"></i> Team:</small><div class="d-flex align-items-center">`;
                    teamList.forEach(u => { taggedHtml += `<img src="${u.img}" class="tagged-img" title="${u.name}" loading="lazy" onerror="this.style.display='none'">`; });
                    taggedHtml += `</div></div>`;
                }

                let witnessHtml = '';
                if (verifyList.length > 0 && canSee) {
                    witnessHtml = `<div class="row-witness animate__animated animate__fadeIn"><small class="text-success me-2 fw-bold"><i class="fas fa-check-circle"></i> Witness:</small><div class="d-flex align-items-center">`;
                    verifyList.forEach(v => { witnessHtml += `<img src="${v.img}" class="witness-img" title="${v.name}" loading="lazy" onerror="this.style.display='none'">`; });
                    witnessHtml += `</div></div>`;
                }

                let btnHtml = '';
                if (isPrivate) {
                    if (isMyPost) btnHtml = `<span class="badge bg-secondary rounded-pill ms-auto"><i class="fas fa-lock"></i> Private</span>`;
                } else if (isMyPost) {
                    if (isTeam) btnHtml = `<span class="badge bg-info text-dark rounded-pill ms-auto"><i class="fas fa-users"></i> Team Work</span>`;
                    else btnHtml = verifyList.length > 0 ? `<span class="badge bg-success rounded-pill ms-auto"><i class="fas fa-check"></i> Approved</span>` : `<span class="badge bg-secondary rounded-pill ms-auto"><i class="fas fa-clock"></i> Pending</span>`;
                } else {
                    if (amITagged) btnHtml = `<span class="badge bg-light text-primary border rounded-pill ms-auto"><i class="fas fa-user-tag"></i> You're in team</span>`;
                    else btnHtml = isVerifiedByMe ? `<button class="btn btn-sm btn-success rounded-pill ms-auto disabled">Verified</button>` : `<button onclick="verifyPost('${post.id}','${post.user_line_id}','${post.user_name}',this)" class="btn btn-sm btn-outline-primary rounded-pill ms-auto">Verify (+3)</button>`;
                }

                let myReaction = (post.likes || []).find(u => String(u.lineId) === String(currentUser.userId));
                let reactIcon = myReaction ? (iconMap[myReaction.type] || '❤️') : '🤍';

                const mediaContent = canSee ? getMediaContent(post.image, post.note) : '';
                const noteContent = canSee ? post.note : '<span class="text-muted fst-italic"><i class="fas fa-lock"></i> Private</span>';

                let vdoBtnHtml = '';
                const lnk = post.image || '';
                if (lnk.includes('youtube') || lnk.includes('youtu.be')) vdoBtnHtml = `<a href="${lnk}" target="_blank" class="btn btn-sm btn-light text-danger rounded-pill border ms-2" style="font-size:0.75rem;"><i class="fab fa-youtube"></i> Watch VDO</a>`;
                else if (lnk.includes('tiktok')) vdoBtnHtml = `<a href="${lnk}" target="_blank" class="btn btn-sm btn-light text-dark rounded-pill border ms-2" style="font-size:0.75rem;"><i class="fab fa-tiktok"></i> TikTok</a>`;
                else if (lnk.includes('facebook') || lnk.includes('fb.watch')) vdoBtnHtml = `<a href="${lnk}" target="_blank" class="btn btn-sm btn-light text-primary rounded-pill border ms-2" style="font-size:0.75rem;"><i class="fab fa-facebook"></i> Facebook</a>`;

                const dateStr = isValidDate ? postDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

                htmlBuffer += `
            <div class="glass-card feed-card p-3 mb-3 animate__animated animate__fadeIn">
                <div class="feed-header d-flex align-items-start">
                    <img src="${post.user_img}" class="feed-avatar me-2 mt-1" loading="lazy" onerror="this.src='https://dummyimage.com/45x45/ddd/888&text=?'">
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between">
                            <h6 class="mb-0 fw-bold">${post.user_name} ${post.isPinned ? '<i class="fas fa-thumbtack text-warning ms-1" title="กิจกรรมเด่นปักหมุดโดยผู้ดูแล"></i>' : ''}</h6>
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
                <div class="feed-actions border-top pt-2 d-flex align-items-center mt-2">
                    <div class="reaction-wrapper me-1" id="react-wrap-${post.id}">
                        <div class="reaction-popup" id="popup-${post.id}" style="display:none;" onmouseleave="closeReaction('${post.id}')">
                            <span class="reaction-btn" onclick="submitReaction('${post.id}','like')">👍</span>
                            <span class="reaction-btn" onclick="submitReaction('${post.id}','love')">❤️</span>
                            <span class="reaction-btn" onclick="submitReaction('${post.id}','laugh')">😂</span>
                            <span class="reaction-btn" onclick="submitReaction('${post.id}','wow')">😮</span>
                            <span class="reaction-btn" onclick="submitReaction('${post.id}','pray')">🙏</span>
                        </div>
                        <div class="action-btn ${myReaction ? 'liked' : ''}" onclick="toggleReaction('${post.id}')">
                            <span id="icon-${post.id}" style="font-size:1.2rem;">${reactIcon}</span>
                            <span id="count-${post.id}" class="ms-1" style="font-size:0.9rem;">${post.likes ? post.likes.length : 0}</span>
                        </div>
                    </div>
                    ${vdoBtnHtml}
                    <div class="ms-auto d-flex align-items-center gap-2">
                        <span class="fs-4">${post.happy == 3 ? '😁' : (post.happy == 2 ? '😐' : '😞')}</span>
                        ${isMyPost ? `
                        <button class="btn btn-sm btn-outline-secondary rounded-circle" style="width:28px;height:28px;padding:0;font-size:0.75rem;"
                            onclick="editPost('${post.id}','${encodeURIComponent(post.note || '')}')" title="แก้ไข"><i class="fas fa-pen"></i></button>
                        <button class="btn btn-sm btn-outline-danger rounded-circle" style="width:28px;height:28px;padding:0;font-size:0.75rem;"
                            onclick="deletePost('${post.id}')" title="ลบ"><i class="fas fa-trash"></i></button>` : ''}
                        ${isAdmin ? `
                        <button class="btn btn-sm btn-outline-${post.isPinned ? 'warning' : 'secondary'} rounded-circle ms-1" style="width:28px;height:28px;padding:0;font-size:0.75rem; ${post.isPinned ? 'background:#fff3cd;' : ''}"
                            onclick="togglePinPost('${post.id}','${encodeURIComponent(post.note || '')}', ${post.isPinned})" title="ปักหมุดกิจกรรมเด่น"><i class="fas fa-thumbtack"></i></button>` : ''}
                    </div>
                </div>
            </div>`;
            });

            if (htmlBuffer) container.insertAdjacentHTML('beforeend', htmlBuffer);

            if (feed.length >= currentFeedLimit) {
                container.insertAdjacentHTML('beforeend',
                    `<div id="loadMoreBtnWrapper" class="text-center mt-3 mb-5">
                    <button class="btn btn-outline-primary rounded-pill px-4" onclick="loadMoreFeed()"><i class="fas fa-arrow-down me-1"></i>ดูเรื่องราวเพิ่มเติม</button>
                </div>`);
            }
            isFetchingFeed = false;
            resolve();
        };

        // 🚀 1. ลองดึงแบบปกติก่อน (fetch) -> 2. ดัก Error ถ้าเจอ HTML หน้าล็อกอิน -> 3. สลับไปใช้ JSONP ทันที
        fetch(`${GAS_URL}?action=get_feed&limit=${currentFeedLimit}&t=${Date.now()}`)
            .then(res => res.text()) // แปลงเป็นข้อความเพื่อตรวจสอบก่อนแกะ JSON
            .then(text => {
                if (text.startsWith('<')) throw new Error("CORS / Google Blocked"); // ดักหน้า HTML ขาวๆ
                handleFeedData(JSON.parse(text));
            })
            .catch(err => {
                console.warn('Feed Loading Blocked, Switching to JSONP...', err.message);
                // 🛡️ ใช้ JSONP Fallback เมื่อ fetch ปกติล้มเหลว
                window.__gasFeedCb = (data) => handleFeedData(data);
                const oldScript = document.getElementById('jsonp_feed');
                if (oldScript) oldScript.remove();

                const script = document.createElement('script');
                script.id = 'jsonp_feed';
                script.src = `${GAS_URL}?action=get_feed&limit=${currentFeedLimit}&callback=__gasFeedCb&t=${Date.now()}`;
                document.head.appendChild(script);

                // หมดเวลา (Timeout) ถ้า JSONP ก็ยังพัง
                setTimeout(() => {
                    if (isFetchingFeed) {
                        if (container) container.innerHTML = `<div class="text-center py-5 text-danger"><i class="fas fa-exclamation-triangle fa-2x mb-3 d-block opacity-50"></i>โหลดไม่สำเร็จ ลองรีเฟรชหน้าใหม่อีกครั้ง</div>`;
                        isFetchingFeed = false;
                    }
                    resolve();
                }, 10000);
            });
    });
}

function loadMoreFeed() {
    currentFeedLimit += 10;
    fetchFeed(true);
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
    Swal.fire({
        title: 'ยืนยันความดี?',
        text: `คุณต้องการเป็นพยานให้ ${targetName} ใช่ไหม?`,
        icon: 'question', showCancelButton: true,
        confirmButtonText: 'ยืนยัน (+3 คะแนน)', confirmButtonColor: '#6c5ce7',
        cancelButtonText: 'ยกเลิก', reverseButtons: true
    }).then(result => {
        if (!result.isConfirmed) return;
        Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
        fetch(GAS_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ action: 'verify_post', postId, verifierId: currentUser.userId, targetUserLineId: targetId })
        }).then(() => {
            if (btnElement) {
                btnElement.innerHTML = '<i class="fas fa-check-circle"></i> ยืนยันแล้ว (+3)';
                btnElement.className = 'btn btn-sm btn-success rounded-pill ms-auto disabled';
                btnElement.removeAttribute('onclick');
            }
            Swal.fire({ icon: 'success', title: 'สำเร็จ!', text: 'คุณได้รับคะแนนพยาน +3 คะแนน', timer: 1500, showConfirmButton: false })
                .then(() => checkUser(currentUser.userId, currentUser));
        }).catch(err => Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + err.message, 'error'));
    });
}

// ----- Delete / Edit -----
function deletePost(postId) {
    Swal.fire({
        title: 'ลบโพสต์นี้?', text: 'คะแนนที่ได้จากโพสต์นี้จะถูกหักออกด้วย', icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#e74c3c', cancelButtonColor: '#aaa',
        confirmButtonText: '🗑️ ลบเลย', cancelButtonText: 'ยกเลิก'
    }).then(r => {
        if (!r.isConfirmed) return;
        Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_post', postId, userId: currentUser.userId }) })
            .then(r => r.json()).then(d => {
                if (d.status === 'success') {
                    Swal.fire({ toast: true, icon: 'success', title: `ลบโพสต์แล้ว (-${d.scoreDeducted || 0} คะแนน)`, position: 'top', timer: 3000, showConfirmButton: false });
                    fetchFeed();
                } else Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: d.message || '' });
            }).catch(() => { Swal.fire({ toast: true, icon: 'success', title: 'ลบโพสต์แล้ว', position: 'top', timer: 3000, showConfirmButton: false }); fetchFeed(); });
    });
}

function editPost(postId, encodedNote) {
    const currentNote = decodeURIComponent(encodedNote);
    Swal.fire({
        title: '✏️ แก้ไขโพสต์', input: 'textarea', inputValue: currentNote,
        inputAttributes: { rows: 4, style: 'font-family:Kanit,sans-serif;font-size:0.9rem;' },
        showCancelButton: true, confirmButtonText: '💾 บันทึก', cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#6c5ce7',
        preConfirm: v => { if (!v?.trim()) { Swal.showValidationMessage('กรุณากรอกข้อความ'); return false; } return v.trim(); }
    }).then(r => {
        if (!r.isConfirmed) return;
        Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'edit_post', postId, newNote: r.value, userId: currentUser.userId }) })
            .then(res => res.json()).then(d => {
                if (d.status === 'success') { Swal.fire({ toast: true, icon: 'success', title: '✅ แก้ไขโพสต์แล้ว!', position: 'top', timer: 3000, showConfirmButton: false }); fetchFeed(); }
                else Swal.fire({ icon: 'error', title: 'แก้ไขไม่สำเร็จ', text: d.message || '' });
            }).catch(() => { Swal.fire({ toast: true, icon: 'success', title: '✅ แก้ไขโพสต์แล้ว!', position: 'top', timer: 3000, showConfirmButton: false }); fetchFeed(); });
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
            typewriterTimeout = setTimeout(typeNext, 60); // ความเร็ว 60ms ต่อตัวอักษร (ปรับเลขให้น้อยลง = พิมพ์เร็วขึ้น)
        } else {
            // เมื่อพิมพ์จบ รอ 4 วินาที แล้ววนลูปใหม่ตั้งแต่ต้น
            typewriterTimeout = setTimeout(() => {
                startTypewriter(text);
            }, 4000);
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

    Swal.fire({ title: isCurrentlyPinned ? 'กำลังเลิกปักหมุด...' : 'กำลังปักหมุด...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'edit_post', postId, newNote, userId: currentUser.userId }) })
        .then(res => res.json()).then(d => {
            if (d.status === 'success') { Swal.fire({ toast: true, icon: 'success', title: isCurrentlyPinned ? 'เลิกปักหมุดแล้ว' : 'ปักหมุดกิจกรรมแล้ว!', position: 'top', timer: 3000, showConfirmButton: false }); fetchFeed(); }
            else Swal.fire({ icon: 'error', title: 'ดำเนินการไม่สำเร็จ', text: d.message || '' });
        }).catch(() => { fetchFeed(); Swal.close(); });
}
