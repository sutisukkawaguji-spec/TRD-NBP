// ============================================================
// 📰  feed.js — Feed Fetching, Rendering & Filtering
//     ต้องโหลดหลัง config.js
// ============================================================

// ----- Media Helpers -----
function getMediaContent(url, note = '', postId = '') {
    try {
        if (!url) return '';
        url = url.trim();

        // ป้องกัน Error จากตัวอักษรพิเศษเวลาส่งผ่าน onclick
        const safeNote = encodeURIComponent(note || '').replace(/'/g, "%27");

        const urls = url.split(',').map(u => u.trim()).filter(u => u.length > 0);
        if (urls.length === 0) return '';

        const imgUrls = [];
        const nonImgUrls = [];

        urls.forEach(u => {
            const isImage = u.match(/\.(jpeg|jpg|gif|png|webp|bin)($|\?)/i) ||
                u.includes('googleusercontent') ||
                u.includes('drive.google.com') ||
                u.includes('cloudinary');
            if (isImage) {
                imgUrls.push(u);
            } else {
                nonImgUrls.push(u);
            }
        });

        let mediaHtml = '';

        // 1. แสดงผลวิดีโอหรือลิงก์การ์ดก่อน
        nonImgUrls.forEach(u => {
            // YouTube Support
            const ytMatch = u.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/))([a-zA-Z0-9_-]{11})/);
            if (ytMatch?.[1]) {
                const vid = ytMatch[1];
                mediaHtml += `<div class="video-container shadow-sm border rounded-4 overflow-hidden mb-2">
                    <div class="ratio ratio-16x9">
                        <iframe src="https://www.youtube.com/embed/${vid}?autoplay=0&rel=0" allowfullscreen loading="lazy"></iframe>
                    </div>
                </div>`;
                return;
            }

            // Direct Video Files
            if (u.match(/\.(mp4|webm|ogg)($|\?)/i)) {
                mediaHtml += `<div class="video-container shadow-sm border rounded-4 overflow-hidden mb-2 bg-dark">
                    <div class="ratio ratio-16x9">
                        <video src="${u}" controls preload="metadata"></video>
                    </div>
                </div>`;
                return;
            }

            // Social Media Links (Premium Cards)
            if (u.includes('tiktok.com')) {
                mediaHtml += createLinkCard(u, 'TikTok', 'fab fa-tiktok', '#000000', 'ดูวิดีโอต้นฉบับบน TikTok');
            } else if (u.includes('facebook.com') || u.includes('fb.watch')) {
                mediaHtml += createLinkCard(u, 'Facebook', 'fab fa-facebook', '#1877F2', 'รับชมวิดีโอผ่าน Facebook');
            } else if (u.includes('instagram.com')) {
                mediaHtml += createLinkCard(u, 'Instagram', 'fab fa-instagram', '#E1306C', 'เปิดดูรูปภาพ/วิดีโอใน Instagram');
            } else if (u.startsWith('http')) {
                mediaHtml += createLinkCard(u, 'External Link', 'fas fa-external-link-alt', '#636e72', 'คลิกเพื่อเปิดลิงก์ภายนอก');
            }
        });

        // 2. แสดงผลตารางรูปภาพต่อท้าย
        if (imgUrls.length > 0) {
            const count = imgUrls.length;
            const displayCount = Math.min(count, 5);
            let gridHtml = `<div class="image-grid image-grid-${displayCount}">`;

            window.postImages = window.postImages || {};
            const mediaId = 'media_' + Math.random().toString(36).substr(2, 9);
            window.postImages[mediaId] = imgUrls;

            imgUrls.slice(0, displayCount).forEach((img, idx) => {
                const isLast = idx === 4 && count > 5;
                let displayImg = img;
                gridHtml += `
                    <div class="grid-img-wrapper" onclick="openTikTokPostViewer('${postId}', false, ${idx}); event.stopPropagation();">
                        <img src="${displayImg}" loading="lazy" class="grid-img" onerror="this.src='https://dummyimage.com/300x300/ddd/888&text=Image+Error'">
                        ${isLast ? `<div class="more-overlay">+${count - 5}</div>` : ''}
                    </div>`;
            });
            gridHtml += `</div>`;
            mediaHtml += gridHtml;
        }

        return mediaHtml;
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
function fetchFeed(append = false, silent = false, force = false, targetUserId = null, resetCount = true) {
    return new Promise((resolve) => {
        // 🛡️ ป้องกันการโหลดซ้อนกัน (รวมทั้งแบบ Silent ด้วย)
        if (isFetchingFeed && !force) return resolve();

        isFetchingFeed = true;

        const container = document.getElementById('feedContainer');

        // ถ้าเป็นการ Force Refresh (กดปุ่มรีเฟรชเอง) และไม่ใช่การโหลดประวัติรายคน ให้ล้างสถานะและแสดง Skeleton กวักรอ
        if (force && container && !append && !targetUserId) {
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
        } else {
            if (filterCategory) queryParams.push(`filterCategory=${filterCategory}`);
            if (filterYear) queryParams.push(`filterYear=${filterYear}`);
            if (filterType) queryParams.push(`filterType=${filterType}`);
            const myId = String(window.currentUser?.userId || window.currentUser?.id || "");
            if (myId) queryParams.push(`myId=${myId}`);
        }

        if (!append && resetCount) {
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

                // 🌟 อัปเดตจำนวนทั้งหมดจาก Server
                window.globalFeedTotal = data.totalCount || feed.length;

                // 🌟 [NEW] แสดงตัวเลขแจ้งเตือนถ้ามีโพสต์ใหม่
                const lastSeen = parseInt(localStorage.getItem('last_seen_feed_count') || 0);
                if (window.globalFeedTotal > lastSeen) {
                    const diff = window.globalFeedTotal - lastSeen;
                    const badge = document.getElementById('nav-stories-badge');
                    const currentTab = document.querySelector('.nav-item.active')?.id;
                    
                    // แสดง Badge เฉพาะถ้าเราไม่ได้อยู่ที่หน้า "เรื่องราว"
                    if (badge && currentTab !== 'nav-stories-btn') {
                        badge.innerText = diff > 99 ? '99+' : diff;
                        badge.style.display = 'block';
                    }
                }

                // 🌟 สำหรับหน้า Relation Detail เราจะคืนข้อมูลชุดนี้ไปแสดงผลเอง
                if (targetUserId) {
                    return resolve({ feed, userMap: data?.userMap, totalCount: data.totalCount });
                }

                globalFeedData = feed;


                // --- 🔔 ระบบ Red Dot แจ้งเตือนเรื่องราวใหม่ (Red Dot Notification) ---
                if (!targetUserId && feed.length > 0) {
                    const latestPostId = String(feed[0].uuid || feed[0].id);
                    const lastSeenId = safeGetItem('lastSeenPostId');
                    const navBtn = document.getElementById('nav-stories-btn');
                    const isStoriesPage = document.getElementById('page-stories')?.classList.contains('active');

                    if (latestPostId !== lastSeenId) {
                        if (isStoriesPage) {
                            // ถ้าอยู่หน้าเรื่องราวแล้ว ให้บันทึกว่าเห็นโพสต์ล่าสุดแล้ว
                            safeSetItem('lastSeenPostId', latestPostId);
                            navBtn?.querySelector('.nav-notify-dot')?.remove();
                        } else {
                            // ถ้าอยู่หน้าอื่น และยังไม่มีจุดแดง ให้แสดงจุดแดง
                            if (navBtn && !navBtn.querySelector('.nav-notify-dot')) {
                                navBtn.insertAdjacentHTML('beforeend', `<div class="nav-notify-dot"></div>`);
                            }
                        }
                    } else if (isStoriesPage) {
                        // เคลียร์จุดแดงถ้าอยู่หน้าเรื่องราว
                        navBtn?.querySelector('.nav-notify-dot')?.remove();
                    }
                }

                // --- 🎛️ Filter Logic (Bypass if targetUserId is present) ---
                const myId = String(currentUser.userId || currentUser.id || "");
                const userIds = Object.keys(allUsersMap || {});
                const filteredFeed = targetUserId ? feed : feed.filter(post => {
                    if (!post) return false;
                    
                    // ระบบความปลอดภัยฝั่ง UI: ตรวจสอบว่าผู้เขียนโพสต์อยู่ในบ้านเดียวกัน (มีข้อมูลใน allUsersMap)
                    const postAuthorId = String(post.user_line_id || post.userId || "");
                    if (postAuthorId && userIds.length > 0 && !allUsersMap[postAuthorId]) {
                        return false;
                    }

                    // ซ่อนโพสต์หากถูกกดไม่ชอบเนื่องจากความไม่เหมาะสมเกินเกณฑ์ (ยกเว้นเจ้าของและแอดมิน)
                    if (typeof isPostHiddenDueToDislikes === 'function' && isPostHiddenDueToDislikes(post)) {
                        const isMyPost = postAuthorId === myId;
                        const role = String(window.currentUser?.role || "").toLowerCase();
                        const isAdmin = /admin|ผู้ดูแลระบบ/i.test(role);
                        if (!isMyPost && !isAdmin) {
                            return false;
                        }
                    }

                    // 🌟 กรองความปลอดภัยเพิ่มเติม: ถ้าไม่ใช่ผู้ใช้ระดับ HQ/ALL ให้เห็นเฉพาะโพสต์ของบ้านตัวเองเท่านั้น
                    const myGroup = (window.currentUser?.groupCode || '').trim().toUpperCase();
                    const isHQOrAll = myGroup === 'HQ' || myGroup === 'ALL' || isCommittee(window.currentUser?.role);
                    if (!isHQOrAll && myGroup) {
                        const author = allUsersMap[postAuthorId];
                        const authorGroup = (author?.groupCode || author?.group_code || '').trim().toUpperCase();
                        if (authorGroup !== myGroup) {
                            return false;
                        }
                    }

                    const isMyPost = postAuthorId === myId;
                    const isPrivate = post.privacy === 'private';
                    const verifyList = Array.isArray(post.verifies) ? post.verifies : (post.interactions?.verifies || []);
                    let alreadyVerified = verifyList.some(v => {
                        const vid = String(v.userId || v.lineId || v).trim();
                        return vid === myId && vid !== "";
                    });

                    if (isPrivate && !isMyPost) return false;

                    if (filterType === 'related' && filterCategory !== 'featured') {
                        let taggedList = String(post.taggedFriends || '').split(',').map(id => id.trim());
                        if (!isMyPost && !taggedList.includes(myId)) return false;
                    }

                    if (filterType === 'request') {
                        let taggedList = String(post.taggedFriends || '').split(',').map(id => id.trim());
                        // กรองออกถ้า: เป็นโพสต์เราเอง OR เรายืนยันไปแล้ว OR เราถูกแท็ก OR สถานะไม่ใช่รอการยืนยันแล้ว
                        if (isMyPost || alreadyVerified || taggedList.includes(myId) || post.status !== 'waiting_verify') return false;
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

                // 🔔 อัปเดตตัวเลขแจ้งเตือนที่ปุ่ม "รอ Verify"
                updatePendingBadge(feed);

                resolve();
            } catch (e) {
                isFetchingFeed = false;
                console.error("HandleFeedData Error:", e);
                resolve();
            }
        };

        // 🚀 เรียกดึงข้อมูล (Fetch from Supabase if enabled)
        if (READ_FROM_SUPABASE && supabaseClient) {
            (async () => {
                try {
                    let query = supabaseClient.from('Activities').select('*', { count: 'exact' });

                    if (targetUserId) {
                        // 🌟 ค้นหาทั้งที่เป็นคนโพสต์เอง (UserId) หรือเป็นคนถูกแท็ก (Tagged)
                        query = query.or(`UserId.eq.${targetUserId},Tagged.ilike.%${targetUserId}%`);
                    } else {
                        // กรองตามรายชื่อพนักงานที่มีรหัสอยู่ในบ้านเดียวกัน
                        const userIds = Object.keys(allUsersMap || {});
                        if (userIds.length > 0) {
                            query = query.in('UserId', userIds);
                        } else {
                            query = query.in('UserId', ['dummy_non_existent']);
                        }

                        // Privacy Filter: Only public or own private posts
                        const myId = String(window.currentUser?.userId || window.currentUser?.id || "");
                        if (myId) {
                            query = query.or(`Privacy.eq.public,UserId.eq.${myId}`);
                        } else {
                            query = query.eq('Privacy', 'public');
                        }

                        // Category Filter
                        if (filterCategory === 'featured') {
                            query = query.ilike('Note', '%[PINNED]%');
                        } else if (filterCategory) {
                            query = query.eq('Virtue', filterCategory);
                        }

                        // Year Filter
                        if (filterYear) {
                            query = query.gte('Date', `${filterYear}-01-01`).lte('Date', `${filterYear}-12-31`);
                        }

                        // Type Filter
                        if (filterType === 'related') {
                            if (myId) {
                                query = query.or(`UserId.eq.${myId},Tagged.ilike.%${myId}%`);
                            }
                        } else if (filterType === 'request') {
                            if (myId) {
                                query = query.neq('UserId', myId).eq('Status', 'waiting_verify');
                            }
                        }
                    }

                    // Sort and Limit
                    query = query.order('Date', { ascending: false }).order('Time', { ascending: false }).limit(limit);

                    const { data, error, count } = await query;
                    if (error) throw error;

                    // Mapping Supabase data to expected Frontend format
                    const mappedFeed = (data || [])
                        .filter(p => p.UserId && p.Date && (p.Virtue || p.Note || p.Image)) // กรองเข้มงวด: ต้องมี UserId, วันที่ และเนื้อหาอย่างใดอย่างหนึ่ง
                        .map(p => {
                            const poster = allUsersMap[p.UserId] || { name: p.UserName || 'Unknown', img: '' };
                            let interactions = { likes: [], verifies: [] };
                            try {
                                if (p.JSON) interactions = typeof p.JSON === 'string' ? JSON.parse(p.JSON) : p.JSON;
                            } catch (e) { }

                            return {
                                id: p.id,
                                uuid: p.UUID,
                                timestamp: p.Date + 'T' + (p.Time || '00:00:00'),
                                date: p.Date,
                                time: p.Time,
                                user_line_id: p.UserId,
                                user_name: poster.name,
                                user_img: poster.img,
                                virtue: p.Virtue,
                                note: p.Note,
                                image: p.Image,
                                happy: p.Happy,
                                taggedFriends: p.Tagged,
                                status: p.Status,
                                privacy: p.Privacy,
                                interactions: interactions,
                                likes: interactions.likes || [],
                                verifies: interactions.verifies || []
                            };
                        });

                    handleFeedData({ status: 'success', feed: mappedFeed, totalCount: count || mappedFeed.length });
                } catch (e) {
                    console.error("❌ Supabase fetchFeed failed, falling back to GAS:", e);
                    // Fallback to GAS if Supabase fails
                    performGASFetch();
                }
            })();
            return;
        }

        // 🚀 Fallback or Default: เรียกดึงข้อมูลจาก GAS
        function performGASFetch() {
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
        }

        performGASFetch();
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
    // 🌟 เช็คว่ามีรายการมากกว่าพื้นที่จะโชว์ หรือ มีข้อมูลในฐานข้อมูลที่ยังไม่ได้โหลดมา
    const hasMore = posts.length > visibleCount || (globalFeedData.length >= currentFeedLimit && (window.globalFeedTotal || 0) > globalFeedData.length);

    const virtueMap = { volunteer: '🤝 จิตอาสา', sufficiency: '🌱 พอเพียง', discipline: '📏 วินัย', integrity: '💎 สุจริต', gratitude: '🙏 กตัญญู' };
    const iconMap = { like: '👍', love: '❤️', wow: '😮', laugh: '😂', sad: '😢', pray: '🙏' };
    const myId = String(window.currentUser?.userId || "");

    let htmlBuffer = '';
    visibleFeed.forEach(post => {
        if (!post || (!post.id && !post.uuid)) return;

        // 🆔 ใช้ UUID เป็นหลัก ถ้าไม่มีให้ใช้ ID แถว (Row Index) สำรอง
        const actualId = post.uuid || post.id;

        // 🆔 ระบุตัวตนผู้ใช้ปัจจุบัน (ใช้จาก currentUser ใน config.js)
        const currentUserId = String(currentUser?.userId || currentUser?.id || window.currentUser?.userId || "");
        // ตรวจสอบว่าเป็นโพสต์ของเราเองหรือไม่ (เช็คทั้ง user_line_id และ userId จาก GAS)
        const postAuthorId = String(post.user_line_id || post.userId || "");
        const isMyPost = (postAuthorId !== "" && postAuthorId === currentUserId);

        const role = String(currentUser?.role || "").toLowerCase();
        const isAdmin = /admin|ผู้ดูแลระบบ/i.test(role);
        const isManager = /manager|ผู้บริหาร/i.test(role);
        const isEditor = /newseditor|บรรณาธิการ/i.test(role);
        const isGuest = /guest|แขก/i.test(role);

        const postDate = post.timestamp ? new Date(post.timestamp) : null;
        const dateStr = (postDate && !isNaN(postDate)) ? postDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

        const tags = post.taggedFriends;
        const taggedIds = (typeof tags === 'string') ? tags.split(',').map(s => s.trim()) : [];
        const isTeam = taggedIds.length > 0;

        // 👮 การจำกัดสิทธิ์ (Permissions)
        const canPin = isAdmin || isManager || isEditor; // ปักหมุดได้ (Manager/Editor/Admin)
        const canEditOthers = isAdmin; // แก้โพสต์คนอื่นได้ (Admin เท่านั้น)
        const canEditOwn = (isMyPost && !isGuest); // แก้โพสต์ตัวเองได้ (ยกเว้น Guest)
        const canVerify = (!isMyPost && !isGuest && !taggedIds.includes(currentUserId) && post.status === 'waiting_verify');

        // ข้อมูลพยาน (Witness) - ใช้จากตัวแปร verifies ที่ GAS ส่งมาให้ ถ้าไม่มีให้ใช้ตัวเลือกสำรอง
        const verifyList = Array.isArray(post.verifies) ? post.verifies : (post.interactions?.verifies || []);

        // เช็คว่าเรายืนยันไปหรือยัง
        const isVerifiedByMe = verifyList.some(v => {
            const vid = String(v.userId || v.lineId || v).trim();
            return vid === currentUserId && vid !== "";
        });

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
            verifyList.forEach(v => {
                const vImg = (typeof v === 'object' && v.img) ? v.img : 'https://dummyimage.com/30x30/ccc/888&text=?';
                const vName = (typeof v === 'object' && v.name) ? v.name : 'พยาน';
                witnessHtml += `<img src="${vImg}" class="witness-img" title="${vName}" loading="lazy" onerror="this.src='https://dummyimage.com/30x30/ccc/888&text=?'">`;
            });
            witnessHtml += `</div></div>`;
        }

        const likes = Array.isArray(post.likes) ? post.likes : (post.interactions?.likes || []);
        const myReaction = likes.find(u => {
            const lid = String(u.lineId || u.userId || u).trim();
            return lid === myId && lid !== "";
        });

        const comments = (() => {
            let c = post.interactions?.comments || post.comments || [];
            if (typeof c === 'string') { try { c = JSON.parse(c); } catch(e) { c = []; } }
            return Array.isArray(c) ? c : [];
        })();
        const commentCount = comments.length;
        const reactIcon = myReaction ? (iconMap[myReaction.type || 'like'] || '👍') : '🤍';

        htmlBuffer += `
        <div id="post-${actualId}" class="glass-card feed-card p-3 mb-3 animate__animated animate__fadeIn ${post.isPinned ? 'border-primary pinned-card' : ''}">
            ${post.isPinned ? `
            <div class="pinned-banner">
                <i class="fas fa-thumbtack me-2"></i>ปักหมุดข่าว
            </div>` : ''}
            <div class="feed-header d-flex align-items-start">
                <img src="${post.user_img || 'https://dummyimage.com/45x45/ddd/888&text=?'}" class="feed-avatar me-2 mt-1" loading="lazy" onerror="this.src='https://dummyimage.com/45x45/ddd/888&text=?'; this.onerror=null;">
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between">
                        <div class="d-flex align-items-center">
                            <h6 class="mb-0 fw-bold">${post.user_name || 'Unknown'}</h6>
                        </div>
                        <div class="d-flex flex-column align-items-end">
                            <small class="text-muted mb-1" style="font-size:0.7rem;">${dateStr}</small>
                            ${(canVerify && !isVerifiedByMe) ? `
                                <button class="btn btn-xs btn-outline-success rounded-pill px-2 shadow-sm animate__animated animate__pulse animate__infinite" style="font-size:0.65rem;" onclick="verifyPost('${actualId}', '${post.user_line_id}', '${post.user_name}', this)">
                                    <i class="fas fa-check-circle me-1"></i> เป็นพยาน (+3)
                                </button>` : ''}
                            ${isVerifiedByMe ? `<span class="badge bg-success text-white rounded-pill" style="font-size:0.6rem;"><i class="fas fa-check-circle me-1"></i> ยืนยันแล้ว</span>` : ''}
                        </div>
                    </div>
                    <small class="text-primary mb-1 d-block fw-bold">${virtueMap[post.virtue] || post.virtue || ''}</small>
                </div>
            </div>
            ${taggedHtml}
            <div class="mt-2 mb-2 p-2 bg-light rounded text-dark">${post.note || ''}</div>
            ${(() => {
                let noticesHtml = '';
                if (typeof isPostHiddenDueToDislikes === 'function' && isPostHiddenDueToDislikes(post)) {
                    noticesHtml += `
                        <div class="py-2 px-3 my-2 rounded-4 notice-alert-inappropriate">
                            <span>🚫 โพสต์นี้ถูกซ่อนสำหรับสมาชิกทั่วไปเนื่องจากรายงานความไม่เหมาะสม</span>
                        </div>`;
                }
                if (typeof getConfirmedDuplicatePostId === 'function') {
                    const dupId = getConfirmedDuplicatePostId(post);
                    if (dupId) {
                        noticesHtml += `
                            <div class="d-flex align-items-center justify-content-between py-2 px-3 my-2 rounded-4 animate__animated animate__pulse animate__infinite notice-alert-duplicate" onclick="openTikTokPostViewer('${dupId}'); event.stopPropagation();">
                                <span>⚠️ กิจกรรมเดียวกัน กดที่นี่เพื่อดู</span>
                            </div>`;
                    }
                }
                return noticesHtml;
            })()}
            <div class="mb-2">${getMediaContent(post.image, post.note, actualId)}</div>
            ${witnessHtml}
            <div class="feed-comments-ticker" id="comments-ticker-${actualId}" style="cursor: pointer;" onclick="openTikTokPostViewer('${actualId}', true); event.stopPropagation();"></div>
            <div class="feed-actions border-top pt-2 d-flex align-items-center mt-2 justify-content-between">
                <div class="d-flex align-items-center">
                    <div class="reaction-wrap position-relative me-3" id="react-wrap-${actualId}">
                        <div class="action-btn ${myReaction ? 'liked' : ''}" onclick="toggleReaction('${actualId}')">
                            <span id="icon-${actualId}" class="me-1">${reactIcon}</span>
                            <span id="count-${actualId}" class="text-muted small">${likes.length}</span>
                        </div>
                        <div id="popup-${actualId}" class="reaction-popup shadow animate__animated animate__bounceIn">
                            ${Object.keys(iconMap).map(k => `<span onclick="submitReaction('${actualId}', '${k}')">${iconMap[k]}</span>`).join('')}
                        </div>
                    </div>
                    <button class="btn btn-sm border-0 bg-transparent d-flex align-items-center gap-1 text-muted" style="font-size:0.82rem;" onclick="openTikTokPostViewer('${actualId}', true); event.stopPropagation();" title="แสดงความคิดเห็น">
                        <i class="far fa-comment-dots" style="font-size:1rem;"></i>
                        <span id="comment-count-${actualId}" class="small">${commentCount > 0 ? commentCount : ''}</span>
                    </button>
                    <button class="btn btn-sm border-0 bg-transparent d-flex align-items-center gap-1 text-muted ms-2" style="font-size:0.82rem;" onclick="shareFeedPost('${actualId}', event);" title="แชร์โพสต์">
                        <i class="fas fa-share" style="font-size:0.95rem;"></i>
                        <span class="small">แชร์</span>
                    </button>
                </div>
                    ${isVerifiedByMe ? `<span class="badge bg-success-subtle text-success rounded-pill mx-1" style="font-size:0.6rem;"><i class="fas fa-check-circle me-1"></i> พยานยืนยันแล้ว</span>` : ''}
                
                <div class="ms-auto d-flex gap-1 align-items-center">
                    ${(!isReadOnly && (canPin || canEditOwn || canEditOthers)) ? `
                        <div class="post-options-dropdown" style="position: relative; display: inline-block;">
                            <button class="post-menu-btn btn btn-sm border-0 rounded-pill px-2" style="font-size:0.95rem;" onclick="togglePostDropdown('${actualId}', event)" title="ตัวเลือก">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div id="dropdown-${actualId}" class="post-menu-dropdown-content">
                                ${canPin ? `
                                    <button class="btn btn-sm text-start w-100 border-0 bg-transparent px-3 py-2" onclick="togglePinPost('${actualId}'); event.stopPropagation();">
                                        <i class="fas fa-thumbtack me-2" style="color: #f39c12; width:14px;"></i> ${post.isPinned ? 'เลิกปักหมุด' : 'ปักหมุดข่าว'}
                                    </button>
                                ` : ''}
                                ${(canEditOwn || canEditOthers) ? `
                                    <button class="btn btn-sm text-start w-100 border-0 bg-transparent px-3 py-2" onclick="editPost('${actualId}'); event.stopPropagation();">
                                        <i class="fas fa-edit me-2" style="color: #6c5ce7; width:14px;"></i> แก้ไขโพสต์
                                    </button>
                                    <div style="height:1px; background: var(--border-color); margin: 2px 12px;"></div>
                                    <button class="btn btn-sm text-start w-100 border-0 bg-transparent px-3 py-2 text-danger" onclick="deletePost('${actualId}'); event.stopPropagation();">
                                        <i class="fas fa-trash-alt me-2" style="width:14px;"></i> ลบโพสต์
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            ${!isReadOnly ? `
            <div class="feed-quick-comment d-flex align-items-center gap-2 mt-2 pt-2 border-top">
                <img src="${currentUser?.img || 'https://dummyimage.com/28x28/ddd/888&text=?'}" class="rounded-circle flex-shrink-0" style="width:28px;height:28px;object-fit:cover;" onerror="this.src='https://dummyimage.com/28x28/ddd/888&text=?'">
                <input type="text" class="form-control form-control-sm rounded-pill" id="quick-comment-${actualId}" placeholder="เขียนความคิดเห็น..." onkeydown="if(event.key==='Enter'){submitQuickComment('${actualId}',this);event.preventDefault();}" onclick="event.stopPropagation();">
                <button class="btn btn-primary btn-sm rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center" style="width:30px;height:30px;padding:0;" onclick="submitQuickComment('${actualId}', document.getElementById('quick-comment-${actualId}')); event.stopPropagation();">
                    <i class="fas fa-paper-plane" style="font-size:0.7rem;"></i>
                </button>
            </div>` : ''}
        </div>`;
    });

    const totalCount = window.globalFeedTotal || posts.length;
    const totalLabel = (typeof currentFeedFilter !== 'undefined' && currentFeedFilter === 'all') 
        ? `โพสต์ทั้งหมด ${totalCount}` 
        : `รายการที่กรองได้ ${posts.length}`;

    htmlBuffer += `
        <div id="loadMoreBtnWrapper" class="text-center py-4">
            ${hasMore ? `
            <button class="btn btn-outline-primary rounded-pill px-5 shadow-sm bg-white mb-2" onclick="${loadMoreOnClick}">
                <i class="fas fa-chevron-down me-2"></i> ดูเรื่องราวเพิ่มเติม
            </button>
            ` : ''}
            <div class="text-muted small">แสดง ${visibleFeed.length} จาก ${totalLabel} รายการ</div>
        </div>`;

    return htmlBuffer;
}

// 🌟 ส่งคอมเม้นต์เร็วจากใต้การ์ดฟีดโดยไม่ต้องเปิด Viewer
async function submitQuickComment(postId, inputEl) {
    if (!currentUser) return;
    if (!inputEl) return;
    const text = (inputEl.value || '').trim();
    if (!text) { inputEl.focus(); return; }

    const myId = String(currentUser.userId || currentUser.id || '');
    const allPosts = [...(window.globalFeedData || []), ...(window.currentRelationPosts || [])];
    const post = allPosts.find(p => p && String(p.uuid || p.id).trim() === String(postId).trim());
    if (!post) return;

    const newComment = {
        userId: myId,
        userName: currentUser.name,
        userImg: currentUser.img || currentUser.avatar || 'https://dummyimage.com/30x30/ccc/888&text=?',
        text: text,
        time: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        likes: []
    };

    let comments = post.interactions?.comments || post.comments || [];
    if (typeof comments === 'string') { try { comments = JSON.parse(comments); } catch(e) { comments = []; } }
    if (!Array.isArray(comments)) comments = [];
    comments.push(newComment);

    if (post.interactions) post.interactions.comments = comments;
    else post.comments = comments;

    // Clear input and update count badge
    inputEl.value = '';
    const countEl = document.getElementById(`comment-count-${postId}`);
    if (countEl) countEl.textContent = comments.length;

    // Animate send button briefly
    const btn = inputEl.nextElementSibling;
    if (btn) { btn.classList.add('btn-success'); setTimeout(() => btn.classList.remove('btn-success'), 800); }

    // Sync to Supabase + push notifications
    if (READ_FROM_SUPABASE && supabaseClient) {
        try {
            const { data: postData } = await supabaseClient.from('Activities').select('JSON, UserId, Tagged').eq('UUID', postId).maybeSingle();
            let interactions = postData?.JSON || { likes: [], verifies: [] };
            if (typeof interactions === 'string') interactions = JSON.parse(interactions);
            interactions.comments = comments;
            await supabaseClient.from('Activities').update({ 'JSON': interactions }).eq('UUID', postId);

            if (typeof triggerPushNotification === 'function') {
                const ownerId = postData?.UserId;
                const cleanOwnerId = String(ownerId || '').trim().toLowerCase();
                const cleanMyId = String(myId || '').trim().toLowerCase();
                // แจ้งเตือนเจ้าของโพสต์ (ยกเว้นตัวเอง)
                if (cleanOwnerId && cleanOwnerId !== cleanMyId) {
                    triggerPushNotification(
                        '💬 มีคนแสดงความคิดเห็นในโพสต์ของคุณ!',
                        `${currentUser.name} ได้คอมเม้นต์: ${text}`,
                        window.location.origin + '/index.html?postId=' + postId + '&commentIndex=' + (comments.length - 1),
                        ownerId
                    ).catch(err => console.error(err));
                }
                // แจ้งเตือนผู้ถูกแท็ก (ยกเว้นตัวเอง)
                const taggedIds = (postData?.Tagged || '').split(',').map(s => s.trim()).filter(Boolean);
                taggedIds.forEach(tid => {
                    const cleanTid = String(tid || '').trim().toLowerCase();
                    if (cleanTid && cleanTid !== cleanMyId) {
                        triggerPushNotification(
                            '💬 มีคนแสดงความคิดเห็นในกิจกรรมร่วมของคุณ!',
                            `${currentUser.name} ได้คอมเม้นต์: ${text}`,
                            window.location.origin + '/index.html?postId=' + postId + '&commentIndex=' + (comments.length - 1),
                            tid
                        ).catch(err => console.error(err));
                    }
                });
            }
        } catch(e) { console.error('Quick comment sync error:', e); }
    }

    // Update ticker if this is the active centered post
    if (_currentActivePostId === postId) startCommentsTicker(postId);
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
    // 🌪️ ตรวจสอบว่าใน Cache ที่โหลดมา มีรายการที่ตรงเงื่อนไข Filter กี่รายการ
    const myId = String(window.currentUser?.userId || "");
    const filterType = currentFeedFilter;
    const filterCategory = document.getElementById('filterCategory')?.value || '';
    const filterYear = document.getElementById('filterYear')?.value || '';

    const postsInCache = (globalFeedData || []).filter(post => {
        if (!post) return false;
        const isMyPost = String(post.user_line_id || post.userId || "") === myId;
        const isPrivate = post.privacy === 'private';
        const verifyList = Array.isArray(post.verifies) ? post.verifies : (post.interactions?.verifies || []);
        const alreadyVerified = verifyList.some(v => {
            const vid = String(v.userId || v.lineId || v).trim();
            return vid === myId && vid !== "";
        });

        if (isPrivate && !isMyPost) return false;
        if (filterType === 'related' && filterCategory !== 'featured') {
            let taggedList = String(post.taggedFriends || '').split(',').map(id => id.trim());
            if (!isMyPost && !taggedList.includes(myId)) return false;
        }
        if (filterType === 'request') {
            let taggedList = String(post.taggedFriends || '').split(',').map(id => id.trim());
            if (isMyPost || alreadyVerified || taggedList.includes(myId) || post.status !== 'waiting_verify') return false;
        }
        if (filterCategory === 'featured') { if (!post.isPinned) return false; }
        else if (filterCategory && post.virtue !== filterCategory) return false;
        if (filterYear) {
            const py = post.timestamp ? new Date(post.timestamp).getFullYear() : '';
            if (String(py) !== filterYear) return false;
        }
        return true;
    });

    // 🌪️ ถ้าจำนวนที่จะโชว์เพิ่ม มันไปสุดทางของ Cache แล้ว แต่ยังมีข้อมูลใน DB ที่ยังไม่ได้ดึงมา
    // หรือถ้าใน Cache ไม่มีข้อมูลที่ตรงเงื่อนไขเลยแต่ยังไม่ถึงท้ายสุดของ DB
    if ((currentVisibleCount + FEED_PAGE_SIZE > postsInCache.length || postsInCache.length === 0) && (window.globalFeedTotal || 0) > (globalFeedData || []).length) {
        // แสดงสถานะโหลดบนปุ่ม
        const btnWrapper = document.getElementById('loadMoreBtnWrapper');
        if (btnWrapper) btnWrapper.innerHTML = '<button class="btn btn-outline-primary rounded-pill px-5 disabled bg-white shadow-sm"><i class="fas fa-spinner fa-spin me-2"></i>กำลังขุดหาเรื่องราว...</button>';

        currentFeedLimit += FEED_PAGE_SIZE;
        currentVisibleCount += FEED_PAGE_SIZE;
        fetchFeed(false, true, false, null, false); // append=false, silent=true, resetCount=false
        return;
    }

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
            const verifyList = Array.isArray(post.verifies) ? post.verifies : (post.interactions?.verifies || []);
            const alreadyVerified = verifyList.some(v => {
                const vid = String(v.userId || v.lineId || v).trim();
                return vid === myId && vid !== "";
            });

            if (isPrivate && !isMyPost) return false;
            if (filterType === 'related' && filterCategory !== 'featured') {
                let taggedList = String(post.taggedFriends || '').split(',').map(id => id.trim());
                if (!isMyPost && !taggedList.includes(myId)) return false;
            }
            if (filterType === 'request') {
                let taggedList = String(post.taggedFriends || '').split(',').map(id => id.trim());
                if (isMyPost || alreadyVerified || taggedList.includes(myId) || post.status !== 'waiting_verify') return false;
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
    // 🛡️ [READ-ONLY] กฎกรรมการ: ห้ามให้ความรู้สึก
    if (isCommittee(currentUser?.role)) {
        Swal.fire('โหมดเยี่ยมชม', 'สิทธิ์กรรมการใช้สำหรับตรวจประเมินเท่านั้น ไม่สามารถกดหัวใจได้ค่ะ', 'info');
        return;
    }
    if (!currentUser) return;

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

    // ค้นหาข้อมูลเจ้าของโพสต์จาก Cache เบื้องต้น
    const cachedPost = globalFeedData.find(p => String(p.uuid || p.id) === String(postId));
    const cachedOwnerId = cachedPost ? cachedPost.user_line_id : null;

    // ☁️ [Supabase Sync]
    if (READ_FROM_SUPABASE && supabaseClient) {
        (async () => {
            try {
                const { data: postData } = await supabaseClient.from('Activities').select('JSON, UserId, Tagged, UserName').eq('UUID', postId).maybeSingle();
                let interactions = postData?.JSON || { likes: [], verifies: [] };
                if (typeof interactions === 'string') interactions = JSON.parse(interactions);

                const ownerId = postData?.UserId || cachedOwnerId;
                
                // ตรวจสอบว่าเคยกดไลก์เรื่องนี้มาก่อนแล้วหรือไม่ (เพื่อลดการส่ง Push สแปมกรณีสลับไอคอนเล่น)
                const alreadyLiked = (interactions.likes || []).some(l => (l.userId || l.lineId) === currentUser.userId);

                // ลบ Reaction เดิมของคนนี้ออกก่อน (ถ้ามี)
                interactions.likes = (interactions.likes || []).filter(l => (l.userId || l.lineId) !== currentUser.userId);
                // เพิ่มอันใหม่เข้าไป
                interactions.likes.push({ userId: currentUser.userId, type: type });

                await supabaseClient.from('Activities').update({ "JSON": interactions }).eq('UUID', postId);
                console.log('☁️ Supabase: Reaction updated');

                // ส่ง Notification แจ้งเตือนเจ้าของโพสต์ และผู้ถูกแท็ก
                if (typeof triggerPushNotification === 'function' && !alreadyLiked) {
                    const thaiReaction = iconMap[type] || '👍';
                    
                    // 1. แจ้งเตือนเจ้าของโพสต์ (ถ้าไม่ใช่คนไลก์เอง)
                    if (ownerId && ownerId !== currentUser.userId) {
                        triggerPushNotification(
                            '❤️ มีคนถูกใจเรื่องราวของคุณ!',
                            `${currentUser.name} ได้ส่งความรู้สึก ${thaiReaction} ให้เรื่องราวความดีของคุณ`,
                            window.location.origin + '/index.html?postId=' + postId,
                            ownerId
                        ).catch(err => console.error('Like notify error:', err));
                    }

                    // 2. แจ้งเตือนผู้ถูกแท็กด้วยในโพสต์
                    const taggedStr = postData?.Tagged || cachedPost?.taggedFriends || '';
                    const taggedIds = typeof taggedStr === 'string' ? taggedStr.split(',').map(s => s.trim()).filter(Boolean) : [];
                    taggedIds.forEach(tid => {
                        if (tid !== currentUser.userId) {
                            triggerPushNotification(
                                '❤️ มีคนถูกใจกิจกรรมร่วมของคุณ!',
                                `${currentUser.name} ได้ส่งความรู้สึก ${thaiReaction} ให้กิจกรรมที่คุณมีส่วนร่วม`,
                                window.location.origin + '/index.html?postId=' + postId,
                                tid
                            ).catch(err => console.error('Like tag notify error:', err));
                        }
                    });
                }
            } catch (e) { console.error('☁️ Supabase Reaction Error:', e); }
        })();
        return;
    }

    fetch(GAS_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'like_post', postId, userId: currentUser.userId, reactionType: type }) });

    // ส่งแจ้งเตือนสำหรับโหมดธรรมดา (GAS)
    if (typeof triggerPushNotification === 'function') {
        const thaiReaction = iconMap[type] || '👍';
        if (cachedOwnerId && cachedOwnerId !== currentUser.userId) {
            triggerPushNotification(
                '❤️ มีคนถูกใจเรื่องราวของคุณ!',
                `${currentUser.name} ได้ส่งความรู้สึก ${thaiReaction} ให้เรื่องราวความดีของคุณ`,
                window.location.origin + '/index.html?postId=' + postId,
                cachedOwnerId
            ).catch(err => console.error('Like notify error:', err));
        }

        // แจ้งเตือนผู้ถูกแท็กด้วยในโพสต์ (GAS)
        const taggedStr = cachedPost?.taggedFriends || '';
        const taggedIds = typeof taggedStr === 'string' ? taggedStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        taggedIds.forEach(tid => {
            if (tid !== currentUser.userId) {
                triggerPushNotification(
                    '❤️ มีคนถูกใจกิจกรรมร่วมของคุณ!',
                    `${currentUser.name} ได้ส่งความรู้สึก ${thaiReaction} ให้กิจกรรมที่คุณมีส่วนร่วม`,
                    window.location.origin + '/index.html?postId=' + postId,
                    tid
                ).catch(err => console.error('Like tag notify error:', err));
            }
        });
    }
}

// ----- Verify -----
function verifyPost(postId, targetId, targetName, btnElement) {
    // 🛡️ [READ-ONLY] กฎกรรมการ: ห้ามยืนยันความดี
    if (isCommittee(currentUser?.role)) {
        Swal.fire('โหมดเยี่ยมชม', 'สิทธิ์กรรมการใช้สำหรับตรวจประเมินเท่านั้น ไม่สามารถกดยืนยันความดีได้ค่ะ', 'info');
        return;
    }
    if (!currentUser) return;

    if (!postId || !currentUser) return;

    if (btnElement) {
        const originalContent = btnElement.innerHTML;
        const originalClass = btnElement.className;

        btnElement.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>...';
        btnElement.classList.add('disabled');
        btnElement.style.pointerEvents = 'none';

        // ☁️ [Supabase ONLY Mode]
        if (READ_FROM_SUPABASE && supabaseClient) {
            (async () => {
                try {
                    // 1. ดึงข้อมูลโพสต์ปัจจุบันจาก Supabase
                    const { data: postData, error: fetchErr } = await supabaseClient
                        .from('Activities')
                        .select('*')
                        .eq('UUID', postId)
                        .single();

                    if (!postData || fetchErr) throw new Error("ไม่พบข้อมูลโพสต์ในระบบ");

                    let interactions = postData.JSON || { likes: [], verifies: [] };
                    if (typeof interactions === 'string') interactions = JSON.parse(interactions);
                    if (!interactions.verifies) interactions.verifies = [];

                    // 2. ตรวจสอบโควตารายสัปดาห์ (Quota Check)
                    // 🌟 กฎใหม่: ยืนยันได้ไม่เกิน 2 โพสต์/สัปดาห์ และคนเดิมไม่เกิน 2 ครั้ง
                    const getStartOfWeek = () => {
                        const now = new Date();
                        const day = now.getDay() || 7; // Sunday is 7
                        const monday = new Date(now);
                        monday.setHours(-24 * (day - 1), 0, 0, 0);
                        return monday.toISOString().split('T')[0];
                    };

                    const startOfWeek = getStartOfWeek();
                    const { data: weeklyVerifies, error: quotaErr } = await supabaseClient
                        .from('Activities')
                        .select('UserId, JSON')
                        .gte('Date', startOfWeek)
                        .ilike('JSON', `%${currentUser.userId}%`);

                    if (!quotaErr && weeklyVerifies) {
                        let totalVerifiesThisWeek = 0;
                        let verifiesForThisPerson = 0;
                        const ownerId = String(postData.UserId || "").trim();

                        weeklyVerifies.forEach(vPost => {
                            let vJson = vPost.JSON;
                            if (typeof vJson === 'string') try { vJson = JSON.parse(vJson); } catch(e){}
                            const list = vJson.verifies || vJson.Verify || [];
                            
                            const iVerifiedThis = list.some(v => {
                                const vid = (typeof v === 'object' ? (v.userId || v.lineId || "") : v).toString().trim();
                                return vid === currentUser.userId;
                            });

                            if (iVerifiedThis) {
                                totalVerifiesThisWeek++;
                                if (String(vPost.UserId || "").trim() === ownerId) {
                                    verifiesForThisPerson++;
                                }
                            }
                        });

                        if (totalVerifiesThisWeek >= 5) {
                            finalizeVerifyUI(btnElement, 'quota_exceeded', 'คุณใช้สิทธิ์ยืนยันครบโควตา 5 ครั้งในสัปดาห์นี้แล้ว');
                            return;
                        }
                        if (verifiesForThisPerson >= 1) {
                            finalizeVerifyUI(btnElement, 'quota_exceeded', 'คุณกดยืนยันให้เพื่อนคนนี้ครบโควตา 1 ครั้งในสัปดาห์นี้แล้ว');
                            return;
                        }
                    }

                    // 3. ตรวจสอบว่าเคยยืนยันโพสต์นี้หรือยัง
                    const alreadyIn = interactions.verifies.some(v => {
                        const vid = (typeof v === 'object' ? (v.userId || v.lineId || "") : v).toString().trim();
                        return vid === currentUser.userId;
                    });
                    
                    if (alreadyIn) {
                        finalizeVerifyUI(btnElement, 'already_verified', 'คุณเคยยืนยันโพสต์นี้แล้ว');
                        return;
                    }

                    // 4. เตรียมข้อมูลพยาน
                    interactions.verifies.push({
                        userId: currentUser.userId,
                        name: currentUser.name,
                        img: currentUser.img
                    });

                    let updatePayload = { "JSON": interactions };
                    let verifierPoints = 0;
                    let ownerPoints = 0;

                    // กฎการให้คะแนนพยาน: 2 คนแรกได้คนละ 1 แต้ม (🌟 ปรับลดเพื่อความสมดุล)
                    if (interactions.verifies.length <= 2) {
                        verifierPoints = 1;
                    }

                    // กฎการอนุมัติโพสต์: เมื่อพยานครบ 2 คน โพสต์จะ Approved (+10 แต้มทั้งทีม)
                    if (interactions.verifies.length >= 2 && postData.Status === 'waiting_verify') {
                        updatePayload.Status = 'approved';
                        updatePayload.Score = 10;
                        ownerPoints = 10 - (parseInt(postData.Score) || 0); 
                    }

                    // 5. บันทึกการอัปเดตลง Activities
                    const { error: updateErr } = await supabaseClient.from('Activities').update(updatePayload).eq('UUID', postId);
                    if (updateErr) throw updateErr;

                    // 📣 [WEB PUSH TRIGGER] แจ้งเตือนเมื่อมีคนกดยืนยันความดี
                    if (typeof triggerPushNotification === 'function' && postData.UserId) {
                        const isApproved = updatePayload.Status === 'approved';
                        
                        // 1. แจ้งเตือนเจ้าของโพสต์ (ถ้าไม่ใช่คนกดตรวจเอง)
                        if (postData.UserId !== currentUser.userId) {
                            const notifTitle = isApproved ? '🎉 เรื่องราวความดีของคุณได้รับอนุมัติแล้ว!' : '✅ เรื่องราวของคุณได้รับการยืนยัน!';
                            const notifBody = isApproved 
                                ? `ยินดีด้วย! พยานยืนยันครบถ้วนแล้ว เรื่องราวความดีของคุณได้รับการอนุมัติ (+10 XP)` 
                                : `${currentUser.name} ได้กดยืนยันความดีให้กับเรื่องราวของคุณ`;

                            triggerPushNotification(
                                notifTitle,
                                notifBody,
                                window.location.origin + '/index.html?postId=' + postId,
                                postData.UserId
                            ).catch(err => console.error('Verify notify error:', err));
                        }

                        // 2. แจ้งเตือนเพื่อนร่วมทีมที่ถูกแท็ก (ส่งแจ้งเตือนทั้งการยืนยันทั่วไปและการได้รับการอนุมัติ)
                        if (postData.Tagged) {
                            const taggedIds = postData.Tagged.split(',').map(s => s.trim()).filter(Boolean);
                            taggedIds.forEach(tid => {
                                if (tid !== currentUser.userId) { // ไม่เตือนคนที่กดยืนยันเอง
                                    const tagNotifTitle = isApproved 
                                        ? '🎉 กิจกรรมที่คุณมีส่วนร่วมได้รับอนุมัติแล้ว!' 
                                        : '✅ กิจกรรมที่คุณมีส่วนร่วมได้รับการยืนยัน!';
                                    const tagNotifBody = isApproved 
                                        ? `ยินดีด้วย! กิจกรรมร่วมกับ ${postData.UserName || 'เพื่อน'} ได้รับอนุมัติและรับ +10 XP แล้ว`
                                        : `${currentUser.name} ได้กดยืนยันความดีให้กับกิจกรรมร่วมของทีมคุณ`;

                                    triggerPushNotification(
                                        tagNotifTitle,
                                        tagNotifBody,
                                        window.location.origin + '/index.html?postId=' + postId,
                                        tid
                                    ).catch(err => console.error('Verify tag notify error:', err));
                                }
                            });
                        }
                    }

                    // 6. อัปเดตข้อมูลพยาน และคะแนน (Authoritative Sync)
                    if (typeof syncUserScore === 'function') {
                        syncUserScore(currentUser.userId); // รีเฟรชคะแนนพยาน (ตัวเรา)
                        
                        const teamIds = [postData.UserId, ...(postData.Tagged ? postData.Tagged.split(',').filter(Boolean) : [])];
                        teamIds.forEach(tid => syncUserScore(tid.trim()));
                    }

                    console.log('☁️ Supabase: Verification triggered sync');
                    finalizeVerifyUI(btnElement, 'success', 'ยืนยันสำเร็จ +1 คะแนน', postId);

                } catch (e) {
                    console.error('☁️ Supabase Verify Error:', e);
                    btnElement.innerHTML = originalContent;
                    btnElement.classList.remove('disabled');
                    btnElement.style.pointerEvents = 'auto';
                    Swal.fire('Error', 'ไม่สามารถยืนยันได้: ' + e.message, 'error');
                }
            })();
            return;
        }

        // --- Fallback to GAS ---
        fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'verify_post', postId, verifierId: currentUser.userId, targetUserLineId: targetId })
        })
            .then(async (res) => {
                const text = await res.text();
                const data = JSON.parse(text);
                if (data.status === 'success' || data.status === 'already_verified') {
                    finalizeVerifyUI(btnElement, data.status, data.message, postId);
                    if (data.status === 'success') {
                        currentUser.score = (currentUser.score || 0) + 3;
                    }
                } else throw new Error(data.message);
            })
            .catch((e) => {
                btnElement.innerHTML = originalContent;
                btnElement.classList.remove('disabled');
                btnElement.style.pointerEvents = 'auto';
                Swal.fire('Error', 'การเชื่อมต่อขัดข้อง: ' + e.message, 'error');
            });
    }
}

// Helper function to finalize UI after verification
function finalizeVerifyUI(btnElement, status, message, postId) {
    btnElement.innerHTML = '<i class="fas fa-check-circle me-1"></i> ยืนยันแล้ว';
    btnElement.className = 'btn btn-xs btn-success rounded-pill disabled';
    btnElement.style.pointerEvents = 'none';
    btnElement.setAttribute('disabled', 'true');
    btnElement.removeAttribute('onclick');

    Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
        icon: status === 'success' ? 'success' : 'info',
        title: message
    });

    if (postId) {
        // อัปเดตข้อมูลใน Cache
        const allPosts = [...(window.globalFeedData || []), ...(window.currentRelationPosts || [])];
        const post = allPosts.find(p => p && (String(p.uuid || p.id).trim() === String(postId).trim()));
        if (post) {
            if (!post.verifies) post.verifies = [];
            const alreadyInList = post.verifies.some(v => String(v.userId || v.lineId || v).trim() === String(currentUser.userId).trim());
            if (!alreadyInList) {
                post.verifies.push({ userId: currentUser.userId, name: currentUser.name, img: currentUser.img });
            }
            updatePendingBadge(window.globalFeedData);
            if (currentFeedFilter === 'request') {
                const el = document.getElementById(`post-${postId}`);
                if (el) {
                    el.style.opacity = '0.3';
                    setTimeout(() => el.style.display = 'none', 500);
                }
            }
        }
    }
    if (typeof renderProfile === 'function') renderProfile();
    // 🌟 [FIX] รีเฟรชสถิติและ Dashboard ทันทีเพื่อให้คะแนนเปลี่ยนตามที่ Verify
    if (typeof fetchManagerData === 'function') {
        fetchManagerData(true);
    }
}

// ----- Delete / Edit -----
function deletePost(postId) {
    // 🛡️ [READ-ONLY] กฎกรรมการ: ห้ามลบข้อมูล
    if (isCommittee(currentUser?.role)) {
        Swal.fire('โหมดเยี่ยมชม', 'สิทธิ์กรรมการใช้สำหรับตรวจประเมินเท่านั้น ไม่สามารถลบข้อมูลได้ค่ะ', 'info');
        return;
    }
    if (!currentUser) return;

    Swal.fire({
        title: 'ลบโพสต์นี้?', text: 'คะแนนที่ได้จากโพสต์นี้จะถูกหักออกด้วย', icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#e74c3c', cancelButtonColor: '#aaa',
        confirmButtonText: '🗑️ ลบเลย', cancelButtonText: 'ยกเลิก'
    }).then(async r => {
        if (!r.isConfirmed) return;

        // 🌪️ Optimistic UI
        const postEl = document.getElementById(`post-${postId}`);
        if (postEl) {
            postEl.style.opacity = '0.3';
            postEl.style.transform = 'scale(0.9)';
            postEl.style.transition = '0.3s';
            setTimeout(() => postEl.style.display = 'none', 300);
        }

        Swal.fire({ toast: true, icon: 'info', title: 'กำลังลบจาก Supabase...', position: 'top', timer: 1500, showConfirmButton: false });

        // ☁️ [Supabase ONLY Test Mode]
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient
                    .from('Activities')
                    .delete()
                    .eq('UUID', postId);

                // 🔍 [FIX] หาเจ้าของและผู้ที่ถูกแท็กก่อนลบ เพื่อไปรีเฟรชคะแนนให้ถูกต้อง
                const post = (window.globalFeedData || []).find(p => (p.uuid || p.id) == postId);
                const affectedIds = post ? [post.UserId, ...(post.Tagged ? String(post.Tagged).split(',').filter(Boolean) : [])] : [];

                if (error) throw error;

                console.log('☁️ Supabase Test Mode: Post deleted');

                // 🗑️ [CLOUDINARY CLEANUP] ลบรูปออกจาก Cloudinary ผ่าน GAS
                if (post && post.image) {
                    fetch(GAS_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'delete_image', urls: post.image })
                    }).then(() => console.log('🗑️ Cloudinary cleanup requested'));
                }
                
                // 🛡️ [FORCE SYNC] ล้างเวลาโพสต์ล่าสุดเพื่อให้การคำนวณใหม่มีผลทันที
                localStorage.removeItem('last_post_time');

                // อัปเดตคะแนนของผู้ที่เกี่ยวข้องทันที และรอให้เสร็จก่อนรีเฟรชภาพรวม
                if (typeof syncUserScore === 'function' && affectedIds.length > 0) {
                    const validIds = affectedIds.filter(id => id && typeof id === 'string');
                    await Promise.all(validIds.map(id => syncUserScore(id.trim())));
                }

                Swal.fire({ toast: true, icon: 'success', title: `ลบโพสต์และปรับปรุงคะแนนเรียบร้อย`, position: 'top', timer: 2000, showConfirmButton: false });

                // อัปเดต Cache และ UI
                if (window.globalFeedData) {
                    window.globalFeedData = window.globalFeedData.filter(p => p && String(p.id).trim() !== String(postId).trim() && String(p.uuid).trim() !== String(postId).trim());
                }
                renderFeedUI(window.globalFeedData);

                // รีเฟรช Dashboard ภาพรวม
                if (typeof fetchManagerData === 'function') {
                    fetchManagerData(true);
                }
                return;

            } catch (e) {
                console.error('☁️ Supabase Delete Error:', e);
                if (postEl) postEl.style.display = ''; // คืนค่าถ้าพลาด
                Swal.fire('Error', 'ลบไม่สำเร็จ: ' + (e.message || e), 'error');
                return;
            }
        }
    });
}

function editPost(postId) {
    // 🔍 ปรับปรุง: ตรวจสอบจากทุกแหล่งข้อมูลที่มี และเช็คทั้ง id/uuid
    const allPosts = [...(window.globalFeedData || []), ...(window.currentRelationPosts || [])];
    const post = allPosts.find(p => p && (String(p.id).trim() === String(postId).trim() || String(p.uuid).trim() === String(postId).trim()));

    if (!post) {
        console.warn('EditPost: Post not found in global cache', postId);
        Swal.fire('ผิดพลาด', 'ไม่พบข้อมูลเรื่องราวที่จะแก้ไข (กรุณารีเฟรช)', 'error');
        return;
    }

    const targetPostId = post.uuid || post.id;
    const virtueMap = { volunteer: '🤝 จิตอาสา', sufficiency: '🌱 พอเพียง', discipline: '📏 วินัย', integrity: '💎 สุจริต', gratitude: '🙏 กตัญญู' };
    const currentNote = post.note || '';
    const currentVirtue = post.virtue || 'volunteer';
    const currentImages = post.image ? post.image.split(',').map(u => u.trim()).filter(Boolean) : [];

    // 🌟 แยกรูปและลิงก์ออกจากกัน
    let actualImages = [];
    let currentLink = '';
    currentImages.forEach(item => {
        if (item.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) || item.includes('googleusercontent') || item.includes('drive.google.com') || item.includes('cloudinary')) {
            actualImages.push(item);
        } else {
            // ถ้าไม่ใช่รูป ถือว่าเป็นลิงก์สื่อ
            if (!currentLink) currentLink = item;
            else window.removedOriginalImages = window.removedOriginalImages ? window.removedOriginalImages.concat(item) : [item];
        }
    });

    // 🎨 สถานะชั่วคราวสำหรับรูปภาพในโหมดแก้ไข
    window.tempEditItems = [...actualImages]; // [url1, url2, File1, File2, ...]
    window.removedOriginalImages = []; // [url_removed1, url_removed2]

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
                <textarea id="swal-note" class="form-control rounded-3" rows="3" style="font-family:Kanit,sans-serif;font-size:0.9rem;">${currentNote}</textarea>
                
                <div class="mt-3">
                    <label class="small fw-bold text-muted mb-2 d-block">จัดการรูปภาพและลิงก์สื่อ (สูงสุด 20 รายการ):</label>
                    <div id="edit-thumb-list" class="d-flex flex-wrap gap-2 mb-2" style="max-height:160px; overflow-y:auto; padding:5px;"></div>
                    <input type="file" id="edit-file-input" class="d-none" multiple accept="image/*" onchange="handleEditFileSelect(this)">
                    <button type="button" class="btn btn-sm btn-outline-primary rounded-pill w-100 py-2 mb-2" onclick="document.getElementById('edit-file-input').click()">
                        <i class="fas fa-camera me-1"></i> เพิ่มหรือเปลี่ยนรูปภาพ
                    </button>
                    <div class="input-group input-group-sm mb-2">
                        <span class="input-group-text bg-white border-end-0"><i class="fas fa-link text-success"></i></span>
                        <input type="text" id="edit-media-link" class="form-control border-start-0" placeholder="วางลิงก์ YouTube / TikTok / FB / หรือเว็บภายนอก" value="${currentLink}">
                        <button class="btn btn-outline-secondary" type="button" onclick="document.getElementById('edit-media-link').value='';"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            </div>
        `,
        didOpen: () => {
            renderEditThumbs();
        },
        showCancelButton: true,
        confirmButtonText: '💾 บันทึก',
        cancelButtonColor: '#aaa',
        confirmButtonColor: '#6c5ce7',
        preConfirm: async () => {
            const newNote = document.getElementById('swal-note').value;
            const newVirtue = document.getElementById('swal-virtue').value;
            if (!newNote.trim()) { Swal.showValidationMessage('กรุณากรอกข้อความ'); return false; }

            Swal.update({ title: 'กำลังอัปโหลดรูปภาพใหม่...', showConfirmButton: false });

            // ☁️ 1. อัปโหลดรูปใหม่ (ถ้ามี)
            const finalUrls = [];
            for (let item of window.tempEditItems) {
                if (typeof item === 'string') {
                    finalUrls.push(item);
                } else if (item instanceof File) {
                    const uploadedUrl = await uploadImageToCloudinary(item);
                    if (uploadedUrl) finalUrls.push(uploadedUrl);
                }
            }

            // 🌟 2. ดึงลิงก์สื่อที่แก้ไขใหม่มาต่อท้าย
            const newLink = document.getElementById('edit-media-link').value.trim();
            if (newLink) {
                finalUrls.push(newLink);
            }

            return {
                newNote: newNote.trim(),
                newVirtue,
                newImage: finalUrls.join(','),
                removedImages: window.removedOriginalImages
            };
        }
    }).then(r => {
        if (!r.isConfirmed) return;
        const { newNote, newVirtue, newImage, removedImages } = r.value;

        if (READ_FROM_SUPABASE && supabaseClient) {
            (async () => {
                try {
                    const { error } = await supabaseClient.from('Activities').update({
                        "Note": newNote,
                        "Virtue": newVirtue,
                        "Image": newImage
                    }).eq('UUID', targetPostId);

                    if (error) throw error;

                    console.log('☁️ Supabase: Post updated');
                    handleEditSuccess(targetPostId, newNote, newVirtue, newImage, removedImages);
                } catch (e) {
                    console.error('☁️ Supabase Edit Error:', e);
                    Swal.fire('Error', 'ไม่สามารถบันทึกลง Supabase ได้: ' + e.message, 'error');
                }
            })();
            return;
        }

        fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'edit_post',
                postId: targetPostId,
                userId: currentUser.userId,
                newNote,
                newVirtue,
                newImage,
                removedImages
            })
        }).then(res => res.json()).then(data => {
            if (data.status === 'success') {
                handleEditSuccess(targetPostId, newNote, newVirtue, newImage, removedImages);
            } else {
                Swal.fire('ข้อผิดพลาด', data.message, 'error');
            }
        });
    });
}

function handleEditSuccess(targetPostId, newNote, newVirtue, newImage, removedImages = []) {
    // 🗑️ [CLOUDINARY CLEANUP] ลบรูปที่ถูกนำออกออกจาก Cloudinary
    if (removedImages && removedImages.length > 0) {
        fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete_image', urls: removedImages })
        }).then(() => console.log('🗑️ Cloudinary cleanup for edited post requested'));
    }

    if (window.globalFeedData) {
        const postIdx = window.globalFeedData.findIndex(p => (p.uuid || p.id) == targetPostId);
        if (postIdx !== -1) {
            const post = window.globalFeedData[postIdx];
            post.note = newNote;
            post.virtue = newVirtue;
            post.image = newImage;
            updateSinglePostUI(targetPostId);

            // 🔍 [FIX] รีเฟรชคะแนนของผู้ที่เกี่ยวข้องทันที เพราะหมวดหมู่หรือสถานะอาจเปลี่ยน
            const affectedIds = [post.UserId, ...(post.Tagged ? String(post.Tagged).split(',').filter(Boolean) : [])];
            if (typeof syncUserScore === 'function') {
                affectedIds.filter(id => id && typeof id === 'string').forEach(id => syncUserScore(id.trim()));
            }
        }
    }
    Swal.fire({
        icon: 'success',
        title: 'บันทึกเรียบร้อย',
        toast: true,
        position: 'top-end',
        timer: 2000,
        showConfirmButton: false
    });

    // 🌟 [BACKGROUND UPDATE] อัปเดตข้อมูลภาพรวมเบื้องหลังทันที
    if (typeof fetchManagerData === 'function') {
        fetchManagerData(true);
    }
}

// --- Helper Functions for Image Editing ---
function handleEditFileSelect(input) {
    const files = Array.from(input.files);
    if (window.tempEditItems.length + files.length > 20) {
        Swal.showValidationMessage('เพิ่มรูปได้สูงสุด 20 รูปครับ');
        return;
    }
    window.tempEditItems = [...window.tempEditItems, ...files];
    renderEditThumbs();
}

function renderEditThumbs() {
    const list = document.getElementById('edit-thumb-list');
    if (!list) return;
    list.innerHTML = '';

    window.tempEditItems.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'position-relative shadow-sm thumb-item';
        div.setAttribute('data-index', idx); // เก็บ index เดิมไว้
        div.style.cssText = 'width:70px; height:70px; border-radius:10px; overflow:hidden; background:#f0f0f0; border:1px solid #eee; cursor:grab;';

        let src = '';
        if (typeof item === 'string') src = item;
        else src = URL.createObjectURL(item);

        div.innerHTML = `
            <img src="${src}" style="width:100%; height:100%; object-fit:cover; pointer-events:none;">
            <button onclick="removeEditItem(${idx}); event.stopPropagation();" class="btn btn-danger btn-sm rounded-circle position-absolute d-flex align-items-center justify-content-center shadow" 
                style="width:22px; height:22px; padding:0; top:2px; right:2px; font-size:12px; z-index:10; border:2px solid #fff;">&times;</button>
        `;
        list.appendChild(div);
    });

    // 🚀 เปิดใช้งานการลากวาง (Sortable)
    if (typeof Sortable !== 'undefined') {
        new Sortable(list, {
            animation: 150,
            ghostClass: 'bg-light',
            onEnd: function () {
                // อัปเดต Array ตามลำดับใหม่ใน DOM
                const newOrder = [];
                const items = list.querySelectorAll('.thumb-item');
                items.forEach(el => {
                    const oldIndex = parseInt(el.getAttribute('data-index'));
                    newOrder.push(window.tempEditItems[oldIndex]);
                });
                window.tempEditItems = newOrder;

                // ไม่ต้อง render ใหม่ (เพราะ DOM สลับให้เองแล้ว) 
                // แต่ถ้าจะแก้ index สำหรับปุ่มลบ อาจจะต้องแอบแก้ attribute หรือ render ใหม่เบาๆ
                items.forEach((el, newIdx) => {
                    el.setAttribute('data-index', newIdx);
                    const btn = el.querySelector('button');
                    if (btn) btn.setAttribute('onclick', `removeEditItem(${newIdx}); event.stopPropagation();`);
                });
            }
        });
    }
}

function removeEditItem(idx) {
    const item = window.tempEditItems[idx];
    if (typeof item === 'string') {
        window.removedOriginalImages.push(item);
    }
    window.tempEditItems.splice(idx, 1);
    renderEditThumbs();
}

// ----- View Image -----
let touchStartX = 0;
let touchEndX = 0;
let viewerImages = [];
let viewerIndex = 0;
let isViewerOpen = false;
let typewriterTimeout = null;
let currentViewerNote = '';

function openImageViewer(images, index = 0, encodedNote = '') {
    if (typeof images === 'string') images = images.split(',').map(s => s.trim());
    viewerImages = images;
    viewerIndex = index;
    // ถอดรหัสข้อความกลับมา
    currentViewerNote = encodedNote ? decodeURIComponent(encodedNote) : '';

    const viewer = document.getElementById('imageViewer');
    if (!viewer) return;

    // ระบบปัดหน้าจอ (Swipe) - เพิ่ม listener ครั้งเดียวถ้ายังไม่มี
    if (!viewer.dataset.listenerAdded) {
        viewer.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
        viewer.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) changeViewerImg(1); // Swipe Left
                else changeViewerImg(-1); // Swipe Right
            }
        }, { passive: true });
        viewer.dataset.listenerAdded = "true";
    }

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

    // หากความยาวเกิน 50 ตัวอักษร ให้แสดงผลทั้งหมดทันที
    if (text.length > 50) {
        overlay.innerHTML = text;
        overlay.scrollTop = overlay.scrollHeight;
        return;
    }

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

    if (imgEl) {
        let displayImg = viewerImages[viewerIndex];
        imgEl.src = displayImg;
    }
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
    clearTimeout(tiktokTypewriterTimeout); // หยุดเอฟเฟกต์ติ๊กต๊อก

    const viewer = document.getElementById('imageViewer');
    if (viewer) viewer.style.display = 'none';
    document.body.style.overflow = '';

    // ล้างสถานะติ๊กต๊อก
    window.currentTikTokPost = null;
    window.currentTikTokImageIndex = 0;

    // เคลียร์พารามิเตอร์ postId จาก URL
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
}

function viewImage(url, note = '') {
    openImageViewer([url], 0, encodeURIComponent(note).replace(/'/g, "%27"));
}

/* togglePinPost merged into later implementation */
// 🌟 ฟังก์ชันปักหมุด/เลิกปักหมุด
// 🌟 ฟังก์ชันปักหมุด/เลิกปักหมุด (Merged & Finalized)
function togglePinPost(postId) {
    // 🔍 ค้นหาโพสต์จาก Cache
    const allPosts = [...(window.globalFeedData || []), ...(window.currentRelationPosts || [])];
    const postIdx = allPosts.findIndex(p => p && (String(p.id).trim() === String(postId).trim() || String(p.uuid).trim() === String(postId).trim()));
    const post = allPosts[postIdx];

    if (!post) return;

    // UI Update ทันที (Optimistic)
    const isPinned = !!post.isPinned;
    post.isPinned = !isPinned; // สลับสถานะใน Cache

    // 🌟 อัปเดตการ์ดฟีดในหน้าแรกทันทีโดยไม่ต้องโหลดหน้าจอใหม่
    const actualId = post.uuid || post.id || postId;
    const postcardEl = document.getElementById(`post-${actualId}`) || document.getElementById(`post-${postId}`);
    if (postcardEl) {
        if (post.isPinned) {
            postcardEl.classList.add('border-primary', 'pinned-card');
            if (!postcardEl.querySelector('.pinned-banner')) {
                const banner = document.createElement('div');
                banner.className = 'pinned-banner';
                banner.innerHTML = '<i class="fas fa-thumbtack me-2"></i>ปักหมุดข่าว';
                postcardEl.insertBefore(banner, postcardEl.firstChild);
            }
        } else {
            postcardEl.classList.remove('border-primary', 'pinned-card');
            const banner = postcardEl.querySelector('.pinned-banner');
            if (banner) banner.remove();
        }

        // อัปเดตข้อความปุ่มในเมนู Dropdown จุดสามจุด
        const dropdownEl = document.getElementById(`dropdown-${actualId}`) || document.getElementById(`dropdown-${postId}`);
        if (dropdownEl) {
            const pinMenuBtn = Array.from(dropdownEl.querySelectorAll('button')).find(btn => btn.getAttribute('onclick')?.includes('togglePinPost'));
            if (pinMenuBtn) {
                pinMenuBtn.innerHTML = `<i class="fas fa-thumbtack me-2" style="color: #f39c12; width:14px;"></i> ${post.isPinned ? 'เลิกปักหมุด' : 'ปักหมุดข่าว'}`;
            }
        }
    }

    // 🌟 อัปเดตในปุ่มสัญลักษณ์ของ TikTok Viewer Sidebar (ถ้าผู้ใช้เปิดแผงนี้อยู่)
    if (window.currentTikTokPost && String(window.currentTikTokPost.uuid || window.currentTikTokPost.id).trim() === String(actualId).trim()) {
        window.currentTikTokPost.isPinned = post.isPinned;
        const pinBadge = document.getElementById('tiktokPinnedBadge');
        if (pinBadge) {
            pinBadge.style.display = post.isPinned ? 'inline-block' : 'none';
        }
    }

    // อัปเดตสีปุ่มดั้งเดิม (ถ้ามีใช้ปุ่ม ID pin-btn-*)
    const pinBtn = document.getElementById(`pin-btn-${postId}`) || document.getElementById(`pin-btn-${actualId}`);
    if (pinBtn) {
        pinBtn.className = `btn btn-sm border-0 rounded-pill px-2 feed-manage-btn ${post.isPinned ? 'text-primary' : 'text-muted'}`;
    }

    const currentNoteText = String(post.note || '').trim();
    // เพิ่ม/ลบสัญลักษณ์ [PINNED] โดยไม่ใช้ Newline เยอะๆ
    const newNote = post.isPinned ? `${currentNoteText} [PINNED]` : currentNoteText.replace(/\[PINNED\]/gi, '').trim();

    // ☁️ [Supabase Sync]
    if (READ_FROM_SUPABASE && supabaseClient) {
        (async () => {
            try {
                const { error } = await supabaseClient.from('Activities').update({ "Note": newNote }).eq('UUID', postId);
                if (error) throw error;
                console.log('☁️ Supabase: Pin status updated');
                Swal.fire({ toast: true, icon: 'success', title: post.isPinned ? 'ปักหมุดแล้ว' : 'เลิกปักหมุดแล้ว', position: 'top-end', timer: 1500, showConfirmButton: false });
            } catch (e) {
                console.error('☁️ Supabase Pin Error:', e);
                // Rollback
                post.isPinned = isPinned;
                if (pinBtn) pinBtn.className = `btn btn-sm border-0 rounded-pill px-2 feed-manage-btn ${isPinned ? 'text-primary' : 'text-muted'}`;
            }
        })();
        return;
    }

    // ส่ง GAS ทำงานเบื้องหลัง (Background)
    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'edit_post',
            postId: post.uuid || post.id,
            newNote: newNote,
            newVirtue: post.virtue || 'volunteer',
            userId: currentUser.userId
        })
    }).then(res => res.text()).then(text => {
        const data = JSON.parse(text);
        if (data.status === 'success') {
            Swal.fire({ toast: true, icon: 'success', title: post.isPinned ? 'ปักหมุดแล้ว' : 'เลิกปักหมุดแล้ว', position: 'top-end', timer: 1500, showConfirmButton: false });
        }
    }).catch(e => {
        // Rollback ถ้าพัง
        post.isPinned = isPinned;
        if (pinBtn) pinBtn.className = `btn btn-sm border-0 rounded-pill px-2 feed-manage-btn ${isPinned ? 'text-primary' : 'text-muted'}`;
        console.error("Pin failed:", e);
    });
}

/**
 * 🔄 อัปเดตเฉพาะการ์ดโพสต์เดียว (Partial UI Refresh)
 * เพื่อไม่ให้หน้าจอกระโดดไปด้านบน และให้ความไหลลื่นสูงสุด
 */
function updateSinglePostUI(postId) {
    const post = window.globalFeedData.find(p => (p.uuid || p.id) == postId);
    if (!post) return;

    const postcardEl = document.getElementById(`post-${postId}`);
    if (!postcardEl) return;

    // จำลองการ Render เฉพาะส่วนเนื้อหา (Content)
    const virtueMap = { volunteer: '🤝 จิตอาสา', sufficiency: '🌱 พอเพียง', discipline: '📏 วินัย', integrity: '💎 สุจริต', gratitude: '🙏 กตัญญู' };

    // 1. อัปเดตหัวข้อหมวดหมู่
    const virtueEl = postcardEl.querySelector('.text-primary.mb-1.d-block.fw-bold');
    if (virtueEl) virtueEl.innerText = virtueMap[post.virtue] || post.virtue || '';

    // 2. อัปเดตข้อความเรื่องราว (Note)
    const noteEl = postcardEl.querySelector('.mt-2.mb-2.p-2.bg-light.rounded.text-dark');
    if (noteEl) noteEl.innerText = post.note || '';

    // 3. อัปเดตรูปภาพ (ดึงจากกล่องถัดจากข้อความ)
    if (noteEl && noteEl.nextElementSibling) {
        noteEl.nextElementSibling.innerHTML = getMediaContent(post.image, post.note, postId);
    }

    // 🌟 เพิ่ม Highlight ชั่วคราวเพื่อให้ผู้ใช้รู้ว่าจุดไหนเปลี่ยน
    postcardEl.classList.add('partial-update-active');
    setTimeout(() => postcardEl.classList.remove('partial-update-active'), 2000);
}

// ----- End of Feed Helpers -----

/**
 * 🔔 อัปเดตตัวเลขแจ้งเตือนบนปุ่ม "รอ Verify"
 * โดยนับจากโพสต์ที่สถานะเป็น waiting_verify และเรายังไม่ได้ยืนยัน
 */
function updatePendingBadge(feed) {
    const badge = document.getElementById('pending-badge');
    if (!badge || !currentUser) return;

    const myId = String(currentUser.userId || currentUser.id || "");
    const pendingCount = feed.filter(post => {
        if (!post || !post.status) return false;

        const isMyPost = String(post.user_line_id || post.userId || "") === myId;
        const isPrivate = post.privacy === 'private';

        const verifyList = Array.isArray(post.verifies) ? post.verifies : (post.interactions?.verifies || []);
        const alreadyVerified = verifyList.some(v => {
            const vid = String(v.userId || v.lineId || v).trim();
            return vid === myId && vid !== "";
        });

        const taggedList = String(post.taggedFriends || '').split(',').map(id => id.trim());

        // เงื่อนไขเดียวกับ Filter 'request': ต้องรอการยืนยัน, ไม่ใช่โพสต์เรา, เรายังไม่ยืนยัน, และเราไม่โดนแท็ก
        return post.status === 'waiting_verify' && !isMyPost && !alreadyVerified && !taggedList.includes(myId) && !isPrivate;
    }).length;

    if (pendingCount > 0) {
        badge.innerText = pendingCount > 99 ? '99+' : pendingCount;
        badge.style.display = 'inline-block';
        
        // ถ้าเป็นรายการใหม่จริงๆ (นับเพิ่มขึ้น) อาจจะใส่ Animation เล็กน้อย
        badge.classList.add('animate__animated', 'animate__bounceIn');
        setTimeout(() => badge.classList.remove('animate__animated', 'animate__bounceIn'), 1000);
    } else {
        badge.style.display = 'none';
    }

    // 🌟 [NEW] อัปเดต Badge ที่แถบเมนูด้านล่างด้วย (เพื่อให้เห็นแม้จะอยู่หน้าอื่น)
    const navBadge = document.getElementById('nav-stories-badge');
    if (navBadge) {
        const lastSeen = parseInt(localStorage.getItem('last_seen_feed_count') || 0);
        const newPosts = Math.max(0, (window.globalFeedTotal || 0) - lastSeen);
        
        // ยอดรวมแจ้งเตือน = โพสต์ใหม่ + โพสต์ที่รอเรายืนยัน
        const totalAlerts = newPosts + pendingCount;
        
        if (totalAlerts > 0) {
            navBadge.innerText = totalAlerts > 99 ? '99+' : totalAlerts;
            navBadge.style.display = 'block';
        } else {
            // ถ้าไม่มีอะไรใหม่และไม่ได้อยู่หน้าเรื่องราว ให้ซ่อน Badge
            const currentTab = document.querySelector('.nav-item.active')?.id;
            if (currentTab !== 'nav-stories-btn') {
                navBadge.style.display = 'none';
            }
        }
    }
}


/* ==============================================================
   📱 TikTok Split View & Center Detection JS Logic
   ============================================================== */

// Global States for TikTok split viewer
window.currentTikTokPost = null;
window.currentTikTokImageIndex = 0;
let tiktokTypewriterTimeout = null;

// Observer states
let _currentActivePostId = null;
let _commentsTickerInterval = null;

// 1. toggleDropdown and closeDropdowns for 3-dots post menu
function togglePostDropdown(postId, event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${postId}`);
    if (!dropdown) return;
    const isShown = dropdown.classList.contains('show');
    closePostDropdowns();
    closeCommentDropdowns();
    if (!isShown) {
        dropdown.classList.add('show');
    }
}

function closePostDropdowns() {
    document.querySelectorAll('.post-menu-dropdown-content').forEach(d => {
        d.classList.remove('show');
    });
}

// 1.1 toggleDropdown and closeDropdowns for 3-dots comment menu
function toggleCommentDropdown(index, event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById(`comment-dropdown-${index}`);
    if (!dropdown) return;
    const isShown = dropdown.classList.contains('show');
    closePostDropdowns();
    closeCommentDropdowns();
    if (!isShown) {
        dropdown.classList.add('show');
    }
}

function closeCommentDropdowns() {
    document.querySelectorAll('.comment-menu-dropdown-content').forEach(d => {
        d.classList.remove('show');
    });
}

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    closePostDropdowns();
    closeCommentDropdowns();
});

// Override openImageViewer to call openTikTokPostViewer
const originalOpenImageViewer = openImageViewer;
openImageViewer = function(images, index = 0, encodedNote = '') {
    let imgArray = images;
    if (typeof images === 'string') imgArray = images.split(',').map(s => s.trim()).filter(Boolean);
    
    // Find post containing this image
    const allPosts = [...(window.globalFeedData || []), ...(window.currentRelationPosts || [])];
    const post = allPosts.find(p => {
        if (!p || !p.image) return false;
        const pImgs = p.image.split(',').map(s => s.trim()).filter(Boolean);
        return pImgs.includes(imgArray[0]);
    });
    
    if (post) {
        const postId = post.uuid || post.id;
        openTikTokPostViewer(postId, false, index);
    } else {
        openTikTokPostViewer(null, false, index, imgArray, encodedNote);
    }
};

// Override changeViewerImg for TikTok slider support
const originalChangeViewerImg = changeViewerImg;
changeViewerImg = function(dir) {
    if (window.currentTikTokPost) {
        if (viewerImages.length <= 1) return;
        viewerIndex += dir;
        if (viewerIndex < 0) viewerIndex = viewerImages.length - 1;
        if (viewerIndex >= viewerImages.length) viewerIndex = 0;
        
        renderTikTokImage();
    } else {
        originalChangeViewerImg(dir);
    }
};

// Main open function for TikTok viewer
function openTikTokPostViewer(postId, focusCommentInput = false, imageIndex = 0, fallbackImages = null, fallbackNote = '') {
    let post = null;
    if (postId) {
        const allPosts = [...(window.globalFeedData || []), ...(window.currentRelationPosts || [])];
        post = allPosts.find(p => p && String(p.uuid || p.id).trim() === String(postId).trim());
    }

    // Dynamic Supabase load if post is not in local cache but postId is provided
    if (!post && postId && READ_FROM_SUPABASE && supabaseClient) {
        Swal.fire({
            title: 'กำลังโหลดข้อมูล...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });
        
        supabaseClient.from('Activities').select('*').eq('UUID', postId).maybeSingle().then(({ data: p, error }) => {
            Swal.close();
            if (p && !error) {
                const poster = allUsersMap[p.UserId] || { name: p.UserName || 'Unknown', img: '' };
                let interactions = { likes: [], verifies: [] };
                try {
                    if (p.JSON) interactions = typeof p.JSON === 'string' ? JSON.parse(p.JSON) : p.JSON;
                } catch (e) { }

                const mappedPost = {
                    id: p.id,
                    uuid: p.UUID,
                    timestamp: p.Date + 'T' + (p.Time || '00:00:00'),
                    date: p.Date,
                    time: p.Time,
                    user_line_id: p.UserId,
                    user_name: poster.name,
                    user_img: poster.img,
                    virtue: p.Virtue,
                    note: p.Note,
                    image: p.Image,
                    happy: p.Happy,
                    taggedFriends: p.Tagged,
                    status: p.Status,
                    privacy: p.Privacy,
                    interactions: interactions,
                    likes: interactions.likes || [],
                    verifies: interactions.verifies || []
                };
                
                // Save to cache
                window.globalFeedData = window.globalFeedData || [];
                window.globalFeedData.push(mappedPost);
                
                // Re-call
                openTikTokPostViewer(postId, focusCommentInput, imageIndex);
            } else {
                Swal.fire('ไม่พบโพสต์', 'โพสต์ที่ระบุอาจถูกลบหรือไม่มีอยู่จริง', 'error');
            }
        });
        return;
    }

    if (!post) {
        // Fallback / Mock post if not found
        post = {
            uuid: postId || null,
            id: postId || null,
            user_name: 'ระบบ',
            user_img: 'https://dummyimage.com/45x45/ddd/888&text=S',
            note: fallbackNote ? decodeURIComponent(fallbackNote) : '',
            virtue: 'sufficiency',
            likes: [],
            dislikes: [],
            comments: []
        };
        viewerImages = fallbackImages || [];
    } else {
        viewerImages = String(post.image || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    window.currentTikTokPost = post;
    viewerIndex = imageIndex;

    const viewer = document.getElementById('imageViewer');
    if (!viewer) return;

    // Swipe gestures
    if (!viewer.dataset.listenerAdded) {
        let touchStartX = 0;
        let touchEndX = 0;
        viewer.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
        viewer.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) changeViewerImg(1);
                else changeViewerImg(-1);
            }
        }, { passive: true });
        viewer.dataset.listenerAdded = "true";
    }

    viewer.style.display = 'block';
    isViewerOpen = true;
    document.body.style.overflow = 'hidden';

    // Update deep link in address bar
    if (postId) {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?postId=' + postId;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }

    // Set layout elements
    document.getElementById('tiktokAuthorImg').src = post.user_img || 'https://dummyimage.com/45x45/ddd/888&text=?';
    document.getElementById('tiktokAuthorName').innerText = post.user_name || 'Unknown';
    
    const postDate = post.timestamp ? new Date(post.timestamp) : null;
    const dateStr = (postDate && !isNaN(postDate)) ? postDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
    document.getElementById('tiktokPostDate').innerText = dateStr;

    const virtueMap = { volunteer: '🤝 จิตอาสา', sufficiency: '🌱 พอเพียง', discipline: '📏 วินัย', integrity: '💎 สุจริต', gratitude: '🙏 กตัญญู' };
    document.getElementById('tiktokVirtueBadge').innerText = virtueMap[post.virtue] || post.virtue || '';

    const pinBadge = document.getElementById('tiktokPinnedBadge');
    if (pinBadge) {
        pinBadge.style.display = post.isPinned ? 'inline-block' : 'none';
    }

    // Play typewriter effect on note - BYPASSED per user request to show in full immediately
    const noteEl = document.getElementById('tiktokPostNote');
    if (noteEl) {
        noteEl.innerHTML = (post.note || '').replace(/\n/g, '<br>');
    }

    // Team (Tagged friends)
    const taggedEl = document.getElementById('tiktokTaggedFriends');
    if (taggedEl) {
        const taggedIds = (typeof post.taggedFriends === 'string') ? post.taggedFriends.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (taggedIds.length > 0) {
            const teamList = Array.isArray(post.tagged_avatars) ? post.tagged_avatars : (typeof allUsersMap !== 'undefined' ? taggedIds.map(id => allUsersMap[id]).filter(Boolean) : []);
            let taggedHtml = '<small class="text-primary me-2 fw-bold"><i class="fas fa-users"></i> Team:</small>';
            teamList.forEach(u => {
                taggedHtml += `<img src="${u.img}" class="tagged-img" title="${u.name}" style="width:24px; height:24px; border-radius:50%; margin-right:4px;" onerror="this.src='https://dummyimage.com/30x30/ccc/888&text=?';">`;
            });
            taggedEl.innerHTML = taggedHtml;
            taggedEl.style.display = 'block';
        } else {
            taggedEl.style.display = 'none';
        }
    }

    // Witness List
    const witnessEl = document.getElementById('tiktokWitnessList');
    if (witnessEl) {
        const verifyList = Array.isArray(post.verifies) ? post.verifies : (post.interactions?.verifies || []);
        if (verifyList.length > 0) {
            let witnessHtml = '<small class="text-success me-2 fw-bold"><i class="fas fa-check-circle"></i> Witness:</small>';
            verifyList.forEach(v => {
                const vImg = (typeof v === 'object' && v.img) ? v.img : 'https://dummyimage.com/30x30/ccc/888&text=?';
                const vName = (typeof v === 'object' && v.name) ? v.name : 'พยาน';
                witnessHtml += `<img src="${vImg}" class="witness-img" title="${vName}" style="width:24px; height:24px; border-radius:50%; margin-right:4px;" onerror="this.src='https://dummyimage.com/30x30/ccc/888&text=?';">`;
            });
            witnessEl.innerHTML = witnessHtml;
            witnessEl.style.display = 'block';
        } else {
            witnessEl.style.display = 'none';
        }
    }

    // Likes count and status
    const likes = Array.isArray(post.likes) ? post.likes : (post.interactions?.likes || []);
    const myId = String(currentUser?.userId || currentUser?.id || window.currentUser?.userId || "");
    const myReaction = likes.find(u => {
        const lid = String(u.lineId || u.userId || u).trim();
        return lid === myId && lid !== "";
    });
    document.getElementById('tiktokLikeCount').innerText = likes.length;
    const likeIcon = document.getElementById('tiktokLikeIcon');
    if (myReaction) {
        likeIcon.style.color = 'var(--accent)';
    } else {
        likeIcon.style.color = '#ccc';
    }

    // Dislikes status (no counts displayed)
    const dislikes = post.interactions?.dislikes || post.dislikes || [];
    const isDislikedByMe = dislikes.some(d => (typeof d === 'object' ? d.userId : d) === myId);
    updateDislikeButtonUI(isDislikedByMe);

    // Comments & image grid loading
    renderTikTokCommentsList();
    renderTikTokImage();

    // Focus comment input if requested
    if (focusCommentInput) {
        setTimeout(() => {
            const input = document.getElementById('tiktokCommentInput');
            if (input) input.focus();
        }, 300);
    }
}

// Start conditional typewriter effect
function startTikTokTypewriter(text, el) {
    clearTimeout(tiktokTypewriterTimeout);
    if (!el) return;
    if (!text) {
        el.innerHTML = '';
        return;
    }
    
    // If text length is > 50 characters, display immediately
    if (text.length > 50) {
        el.innerHTML = text;
        return;
    }
    
    let i = 0;
    el.innerHTML = '';
    
    function typeNext() {
        if (!window.currentTikTokPost) return; // Stop if viewer closed
        
        el.innerHTML = text.substring(0, i + 1) + '<span class="blink-cursor">|</span>';
        i++;
        if (i <= text.length) {
            tiktokTypewriterTimeout = setTimeout(typeNext, 60);
        } else {
            el.innerHTML = text;
        }
    }
    typeNext();
}

function renderTikTokImage() {
    const imgEl = document.getElementById('viewerImg');
    const currentEl = document.getElementById('viewerCurrent');
    const totalEl = document.getElementById('viewerTotal');
    
    if (imgEl && viewerImages.length > 0) {
        imgEl.src = viewerImages[viewerIndex];
    }
    if (currentEl) currentEl.innerText = viewerIndex + 1;
    if (totalEl) totalEl.innerText = viewerImages.length;
    
    const prevBtn = document.querySelector('.viewer-prev');
    const nextBtn = document.querySelector('.viewer-next');
    if (prevBtn) prevBtn.style.visibility = viewerImages.length > 1 ? 'visible' : 'hidden';
    if (nextBtn) nextBtn.style.visibility = viewerImages.length > 1 ? 'visible' : 'hidden';
    
    renderImagePins();
}

function renderImagePins() {
    const container = document.getElementById('imageCommentPinsContainer');
    if (!container) return;
    container.innerHTML = '';
    
    if (!window.currentTikTokPost) return;
    
    let comments = [];
    if (window.currentTikTokPost.interactions?.comments) {
        comments = window.currentTikTokPost.interactions.comments;
    } else if (window.currentTikTokPost.comments) {
        comments = window.currentTikTokPost.comments;
    }
    if (typeof comments === 'string') {
        try { comments = JSON.parse(comments); } catch (e) { comments = []; }
    }
    if (!Array.isArray(comments)) comments = [];
    
    comments.forEach((c, index) => {
        if (c.x !== undefined && c.y !== undefined && (c.imageIndex === undefined || c.imageIndex === viewerIndex)) {
            const pin = document.createElement('div');
            pin.className = 'image-comment-pin';
            pin.style.left = c.x + '%';
            pin.style.top = c.y + '%';
            pin.title = `${c.userName}: ${c.text}`;
            
            pin.onclick = (e) => {
                e.stopPropagation();
                highlightCommentInList(index);
            };
            
            container.appendChild(pin);
        }
    });
}

function highlightCommentInList(index) {
    const commentEl = document.getElementById(`tiktok-comment-${index}`);
    if (!commentEl) return;
    
    commentEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    document.querySelectorAll('.image-comment-pin').forEach((p, idx) => {
        if (idx === index) p.classList.add('pin-active');
        else p.classList.remove('pin-active');
    });
    
    commentEl.classList.add('comment-highlight');
    setTimeout(() => {
        commentEl.classList.remove('comment-highlight');
    }, 2000);
}

function highlightPinOnImage(index) {
    document.querySelectorAll('.image-comment-pin').forEach((p, idx) => {
        if (idx === index) {
            p.classList.add('pin-active');
            p.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            p.classList.remove('pin-active');
        }
    });
}

function renderTikTokCommentsList() {
    const listEl = document.getElementById('tiktokCommentsList');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    if (!window.currentTikTokPost) return;
    
    let comments = [];
    if (window.currentTikTokPost.interactions?.comments) {
        comments = window.currentTikTokPost.interactions.comments;
    } else if (window.currentTikTokPost.comments) {
        comments = window.currentTikTokPost.comments;
    }
    if (typeof comments === 'string') {
        try { comments = JSON.parse(comments); } catch (e) { comments = []; }
    }
    if (!Array.isArray(comments)) comments = [];
    
    document.getElementById('tiktokCommentCount').innerText = comments.length;
    
    if (comments.length === 0) {
        listEl.innerHTML = '<div class="text-muted text-center py-4 small">ยังไม่มีความคิดเห็น เขียนคนแรกเลย!</div>';
        return;
    }
    
    const myId = String(currentUser?.userId || currentUser?.id || window.currentUser?.userId || "");
    const role = String(currentUser?.role || "").toLowerCase();
    const isAdmin = /admin|ผู้ดูแลระบบ/i.test(role);
    
    comments.forEach((c, index) => {
        const isCommentOwner = String(c.userId || "").trim() === myId.trim();
        const canEdit = isCommentOwner;
        const canDelete = isCommentOwner || isAdmin;
        
        const commentLikes = Array.isArray(c.likes) ? c.likes : [];
        const isLikedByMe = commentLikes.includes(myId);
        
        const pinIndicator = (c.x !== undefined && c.y !== undefined) ? `<span class="badge bg-warning-subtle text-warning-emphasis ms-1" style="font-size:0.6rem; cursor:pointer;" onclick="highlightPinOnImage(${index})"><i class="fas fa-map-marker-alt"></i> Pin</span>` : '';
        
        const item = document.createElement('div');
        item.className = 'tiktok-comment-item';
        item.id = `tiktok-comment-${index}`;
        
        item.innerHTML = `
            <img src="${c.userImg || 'https://dummyimage.com/30x30/ccc/888&text=?'}" class="tiktok-comment-avatar" onerror="this.src='https://dummyimage.com/30x30/ccc/888&text=?';">
            <div class="tiktok-comment-body flex-grow-1">
                <div class="tiktok-comment-author text-dark">${c.userName || 'Unknown'} ${pinIndicator}</div>
                <div class="text-dark">${c.text || ''}</div>
                <div class="tiktok-comment-meta">
                    <span>${c.time || '-'}</span>
                    <button class="tiktok-comment-like-btn ${isLikedByMe ? 'liked' : ''}" onclick="toggleCommentLike(${index})">
                        <i class="fas fa-heart"></i> <span style="font-size:0.7rem;">${commentLikes.length}</span>
                    </button>
                </div>
            </div>
            ${(canEdit || canDelete) ? `
            <div class="comment-options-dropdown">
                <button class="comment-menu-btn btn btn-sm text-muted border-0 p-1" onclick="toggleCommentDropdown(${index}, event)" title="ตัวเลือก">
                    <i class="fas fa-ellipsis-v" style="font-size: 0.85rem;"></i>
                </button>
                <div id="comment-dropdown-${index}" class="comment-menu-dropdown-content">
                    ${canEdit ? `
                        <button class="btn btn-sm text-start w-100 border-0 bg-transparent px-3 py-2 text-dark" onclick="editTikTokComment(${index}); event.stopPropagation();">
                            <i class="fas fa-edit me-2" style="color: #6c5ce7; width:14px;"></i> แก้ไข
                        </button>
                    ` : ''}
                    ${canDelete ? `
                        <button class="btn btn-sm text-start w-100 border-0 bg-transparent px-3 py-2 text-danger" onclick="deleteTikTokComment(${index}); event.stopPropagation();">
                            <i class="fas fa-trash-alt me-2" style="width:14px;"></i> ลบ
                        </button>
                    ` : ''}
                </div>
            </div>
            ` : ''}
        `;
        listEl.appendChild(item);
    });

    // 🌟 ตรวจสอบและเน้นความเห็นพร้อมเลื่อนตำแหน่งเข้าสู่สายตา (Scroll & Highlight deep-linked comment)
    const urlParams = new URLSearchParams(window.location.search);
    const highlightCommentIdx = urlParams.get('commentIndex');
    if (highlightCommentIdx !== null) {
        const idx = parseInt(highlightCommentIdx);
        setTimeout(() => {
            const commentEl = document.getElementById(`tiktok-comment-${idx}`);
            if (commentEl) {
                commentEl.classList.add('comment-highlight');
                commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // ล้างพารามิเตอร์ออกจาก URL เพื่อไม่ให้ไฮไลท์ซ้ำตอนรีโหลดหน้าเองแมนนวล
                const cleanSearch = window.location.search.replace(/&?commentIndex=\d+/, '').replace(/\?$/, '');
                const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + cleanSearch;
                window.history.replaceState({}, document.title, newUrl);
            }
        }, 400);
    }
}

// Likes logic for current post
async function toggleTikTokLike() {
    if (!currentUser || !window.currentTikTokPost) return;
    const postId = window.currentTikTokPost.uuid || window.currentTikTokPost.id;
    if (isCommittee(currentUser?.role)) {
        Swal.fire('โหมดเยี่ยมชม', 'สิทธิ์กรรมการใช้สำหรับตรวจประเมินเท่านั้น ไม่สามารถกดหัวใจได้ค่ะ', 'info');
        return;
    }
    const myId = String(currentUser.userId || currentUser.id || "");
    
    let likes = Array.isArray(window.currentTikTokPost.likes) ? window.currentTikTokPost.likes : (window.currentTikTokPost.interactions?.likes || []);
    const alreadyLikedIdx = likes.findIndex(u => {
        const lid = String(u.lineId || u.userId || u).trim();
        return lid === myId && lid !== "";
    });
    
    if (alreadyLikedIdx !== -1) {
        likes.splice(alreadyLikedIdx, 1);
    } else {
        likes.push({ userId: myId, type: 'love' });
    }
    
    if (window.currentTikTokPost.interactions) {
        window.currentTikTokPost.interactions.likes = likes;
    } else {
        window.currentTikTokPost.likes = likes;
    }
    
    document.getElementById('tiktokLikeCount').innerText = likes.length;
    const likeIcon = document.getElementById('tiktokLikeIcon');
    const hasLiked = likes.some(u => String(u.lineId || u.userId || u).trim() === myId);
    likeIcon.style.color = hasLiked ? 'var(--accent)' : '#ccc';
    
    // Sync feed card
    const countEl = document.getElementById(`count-${postId}`);
    const iconEl = document.getElementById(`icon-${postId}`);
    const wrap = document.querySelector(`#react-wrap-${postId} .action-btn`);
    if (countEl) countEl.innerText = likes.length;
    if (wrap) {
        if (hasLiked) {
            wrap.classList.add('liked');
            if (iconEl) iconEl.innerText = '❤️';
        } else {
            wrap.classList.remove('liked');
            if (iconEl) iconEl.innerText = '🤍';
        }
    }
    
    if (READ_FROM_SUPABASE && supabaseClient) {
        try {
            const { data: postData } = await supabaseClient.from('Activities').select('JSON').eq('UUID', postId).maybeSingle();
            let interactions = postData?.JSON || { likes: [], verifies: [] };
            if (typeof interactions === 'string') interactions = JSON.parse(interactions);
            
            interactions.likes = (interactions.likes || []).filter(l => String(l.userId || l.lineId || l) !== myId);
            if (hasLiked) {
                interactions.likes.push({ userId: myId, type: 'love' });
            }
            
            await supabaseClient.from('Activities').update({ "JSON": interactions }).eq('UUID', postId);
        } catch (e) {
            console.error("Supabase like sync error:", e);
        }
    }
}

// Dislikes logic for current post
function toggleTikTokDislike() {
    if (!currentUser || !window.currentTikTokPost) return;
    const myId = String(currentUser.userId || currentUser.id || "");
    
    let dislikes = window.currentTikTokPost.interactions?.dislikes || window.currentTikTokPost.dislikes || [];
    if (typeof dislikes === 'string') {
        try { dislikes = JSON.parse(dislikes); } catch (e) { dislikes = []; }
    }
    if (!Array.isArray(dislikes)) dislikes = [];
    
    const isDislikedByMe = dislikes.some(d => (typeof d === 'object' ? d.userId : d) === myId);
    
    if (isDislikedByMe) {
        removeDislike();
    } else {
        Swal.fire({
            title: 'รายงานโพสต์',
            text: 'กรุณาเลือกสาเหตุการไม่ชอบโพสต์นี้:',
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'โพสต์ไม่เหมาะสม',
            denyButtonText: 'โพสต์ซ้ำ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#e74c3c',
            denyButtonColor: '#ffb142',
            cancelButtonColor: '#aaa'
        }).then((result) => {
            if (result.isConfirmed) {
                saveDislike('inappropriate');
            } else if (result.isDenied) {
                Swal.fire({
                    title: 'ระบุโพสต์ต้นฉบับ',
                    text: 'กรุณาวางลิงก์แชร์ของโพสต์ที่ซ้ำกัน (กดปุ่มแชร์บนโพสต์นั้น แล้วนำลิงก์มาวาง)',
                    input: 'text',
                    inputPlaceholder: 'วางลิงก์โพสต์ที่นี่...',
                    inputValidator: (value) => {
                        if (!value) return 'กรุณากรอกลิงก์!';
                        const val = value.trim();
                        // Accept UUID directly (for admin/power users)
                        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
                        if (isUuid) return;
                        
                        try {
                            const url = new URL(val);
                            const postIdParam = url.searchParams.get('postId');
                            if (!postIdParam) return 'ลิงก์ไม่ถูกต้อง กรุณากดปุ่มแชร์บนโพสต์ต้นฉบับแล้วนำลิงก์มาวาง';
                        } catch (e) {
                            return 'รูปแบบลิงก์ไม่ถูกต้อง กรุณาลองใหม่';
                        }
                    },
                    showCancelButton: true,
                    confirmButtonText: 'ยืนยัน',
                    cancelButtonText: 'ยกเลิก'
                }).then((dupResult) => {
                    if (dupResult.isConfirmed) {
                        const val = dupResult.value.trim();
                        let dupPostId = null;
                        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
                            dupPostId = val;
                        } else {
                            try {
                                const url = new URL(val);
                                dupPostId = url.searchParams.get('postId');
                            } catch (e) {}
                        }
                        if (dupPostId) {
                            saveDislike('duplicate', dupPostId);
                        } else {
                            Swal.fire('ไม่พบรหัสโพสต์', 'กรุณาลองใหม่อีกครั้ง', 'error');
                        }
                    }
                });
            }
        });
    }
}

async function saveDislike(reason, duplicatePostId = null) {
    const postId = window.currentTikTokPost.uuid || window.currentTikTokPost.id;
    const myId = String(currentUser.userId || currentUser.id || "");
    
    let dislikes = window.currentTikTokPost.interactions?.dislikes || window.currentTikTokPost.dislikes || [];
    if (typeof dislikes === 'string') {
        try { dislikes = JSON.parse(dislikes); } catch (e) { dislikes = []; }
    }
    if (!Array.isArray(dislikes)) dislikes = [];
    
    dislikes = dislikes.filter(d => (typeof d === 'object' ? d.userId : d) !== myId);
    dislikes.push({ userId: myId, reason, duplicatePostId });
    
    if (window.currentTikTokPost.interactions) {
        window.currentTikTokPost.interactions.dislikes = dislikes;
    } else {
        window.currentTikTokPost.dislikes = dislikes;
    }
    
    updateDislikeButtonUI(true);
    
    if (READ_FROM_SUPABASE && supabaseClient) {
        try {
            const { data: postData } = await supabaseClient.from('Activities').select('JSON, UserId').eq('UUID', postId).maybeSingle();
            let interactions = postData?.JSON || { likes: [], verifies: [] };
            if (typeof interactions === 'string') interactions = JSON.parse(interactions);
            
            interactions.dislikes = (interactions.dislikes || []).filter(d => (typeof d === 'object' ? d.userId : d) !== myId);
            interactions.dislikes.push({ userId: myId, reason, duplicatePostId });
            
            await supabaseClient.from('Activities').update({ "JSON": interactions }).eq('UUID', postId);
            
            const ownerId = postData?.UserId || window.currentTikTokPost.user_line_id || window.currentTikTokPost.userId;
            if (ownerId && typeof syncUserScore === 'function') {
                await syncUserScore(ownerId);
            }
        } catch (e) {
            console.error(e);
        }
    }
    
    updateSinglePostUI(postId);
}

async function removeDislike() {
    const postId = window.currentTikTokPost.uuid || window.currentTikTokPost.id;
    const myId = String(currentUser.userId || currentUser.id || "");
    
    let dislikes = window.currentTikTokPost.interactions?.dislikes || window.currentTikTokPost.dislikes || [];
    if (typeof dislikes === 'string') {
        try { dislikes = JSON.parse(dislikes); } catch (e) { dislikes = []; }
    }
    if (!Array.isArray(dislikes)) dislikes = [];
    
    dislikes = dislikes.filter(d => (typeof d === 'object' ? d.userId : d) !== myId);
    
    if (window.currentTikTokPost.interactions) {
        window.currentTikTokPost.interactions.dislikes = dislikes;
    } else {
        window.currentTikTokPost.dislikes = dislikes;
    }
    
    updateDislikeButtonUI(false);
    
    if (READ_FROM_SUPABASE && supabaseClient) {
        try {
            const { data: postData } = await supabaseClient.from('Activities').select('JSON, UserId').eq('UUID', postId).maybeSingle();
            let interactions = postData?.JSON || { likes: [], verifies: [] };
            if (typeof interactions === 'string') interactions = JSON.parse(interactions);
            
            interactions.dislikes = (interactions.dislikes || []).filter(d => (typeof d === 'object' ? d.userId : d) !== myId);
            
            await supabaseClient.from('Activities').update({ "JSON": interactions }).eq('UUID', postId);
            
            const ownerId = postData?.UserId || window.currentTikTokPost.user_line_id || window.currentTikTokPost.userId;
            if (ownerId && typeof syncUserScore === 'function') {
                await syncUserScore(ownerId);
            }
        } catch (e) {
            console.error(e);
        }
    }
    
    updateSinglePostUI(postId);
}

function updateDislikeButtonUI(isDisliked) {
    const dislikeIcon = document.getElementById('tiktokDislikeIcon');
    if (dislikeIcon) {
        dislikeIcon.style.color = isDisliked ? '#e74c3c' : '#ccc';
    }
}

function shareTikTokPost() {
    if (!window.currentTikTokPost) return;
    const postId = window.currentTikTokPost.uuid || window.currentTikTokPost.id;
    const shareUrl = window.location.origin + window.location.pathname + '?postId=' + postId;
    
    performShareCopy(shareUrl);
}

function shareFeedPost(postId, event) {
    if (event) event.stopPropagation();
    const shareUrl = window.location.origin + window.location.pathname + '?postId=' + postId;
    
    performShareCopy(shareUrl);
}

function performShareCopy(shareUrl) {
    navigator.clipboard.writeText(shareUrl).then(() => {
        Swal.fire({
            toast: true,
            icon: 'success',
            title: 'คัดลอกลิงก์แชร์แล้ว!',
            position: 'top-end',
            timer: 1500,
            showConfirmButton: false
        });
    }).catch(err => {
        console.error(err);
        Swal.fire({
            title: '🔗 คัดลอกลิงก์เพื่อส่งแชร์',
            html: `
                <div class="text-start">
                    <p class="small text-muted mb-2">เบราว์เซอร์บล็อกการคัดลอกอัตโนมัติ กรุณาคัดลอกจากกล่องด้านล่างนี้ได้เลยค่ะ:</p>
                    <textarea class="form-control" rows="3" readonly style="font-family: monospace; font-size: 0.85rem;" onclick="this.select();">${shareUrl}</textarea>
                </div>
            `,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#6c5ce7'
        });
    });
}

function handleCommentInputKey(event) {
    if (event.key === 'Enter') {
        submitTikTokComment();
    }
}

async function submitTikTokComment() {
    if (!currentUser || !window.currentTikTokPost) return;
    const inputEl = document.getElementById('tiktokCommentInput');
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;
    
    const postId = window.currentTikTokPost.uuid || window.currentTikTokPost.id;
    const myId = String(currentUser.userId || currentUser.id || "");
    
    const newComment = {
        userId: myId,
        userName: currentUser.name,
        userImg: currentUser.img || currentUser.avatar || 'https://dummyimage.com/30x30/ccc/888&text=?',
        text: text,
        time: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        likes: []
    };
    
    let comments = window.currentTikTokPost.interactions?.comments || window.currentTikTokPost.comments || [];
    if (typeof comments === 'string') {
        try { comments = JSON.parse(comments); } catch (e) { comments = []; }
    }
    if (!Array.isArray(comments)) comments = [];
    
    comments.push(newComment);
    
    if (window.currentTikTokPost.interactions) {
        window.currentTikTokPost.interactions.comments = comments;
    } else {
        window.currentTikTokPost.comments = comments;
    }
    
    inputEl.value = '';
    renderTikTokCommentsList();
    
    if (READ_FROM_SUPABASE && supabaseClient) {
        try {
            const { data: postData } = await supabaseClient.from('Activities').select('JSON, UserId, Tagged').eq('UUID', postId).maybeSingle();
            let interactions = postData?.JSON || { likes: [], verifies: [] };
            if (typeof interactions === 'string') interactions = JSON.parse(interactions);
            
            interactions.comments = comments;
            await supabaseClient.from('Activities').update({ "JSON": interactions }).eq('UUID', postId);
            
            if (typeof triggerPushNotification === 'function') {
                const ownerId = postData?.UserId;
                const cleanOwnerId = String(ownerId || '').trim().toLowerCase();
                const cleanMyId = String(myId || '').trim().toLowerCase();
                if (cleanOwnerId && cleanOwnerId !== cleanMyId) {
                    triggerPushNotification(
                        '💬 มีคนแสดงความคิดเห็นในโพสต์ของคุณ!',
                        `${currentUser.name} ได้คอมเม้นต์: ${text}`,
                        window.location.origin + '/index.html?postId=' + postId + '&commentIndex=' + (comments.length - 1),
                        ownerId
                    ).catch(err => console.error(err));
                }
                
                const taggedStr = postData?.Tagged || '';
                const taggedIds = taggedStr.split(',').map(s => s.trim()).filter(Boolean);
                taggedIds.forEach(tid => {
                    const cleanTid = String(tid || '').trim().toLowerCase();
                    if (cleanTid && cleanTid !== cleanMyId) {
                        triggerPushNotification(
                            '💬 มีคนแสดงความคิดเห็นในกิจกรรมร่วมของคุณ!',
                            `${currentUser.name} ได้คอมเม้นต์: ${text}`,
                            window.location.origin + '/index.html?postId=' + postId + '&commentIndex=' + (comments.length - 1),
                            tid
                        ).catch(err => console.error(err));
                    }
                });
            }
        } catch (e) {
            console.error(e);
        }
    }
    
    updateSinglePostUI(postId);
    if (_currentActivePostId === postId) {
        startCommentsTicker(postId);
    }
}

async function editTikTokComment(index) {
    if (!window.currentTikTokPost) return;
    let comments = window.currentTikTokPost.interactions?.comments || window.currentTikTokPost.comments || [];
    if (typeof comments === 'string') {
        try { comments = JSON.parse(comments); } catch (e) { comments = []; }
    }
    if (!Array.isArray(comments) || !comments[index]) return;
    
    const currentComment = comments[index];
    const myId = String(currentUser.userId || currentUser.id || "");
    if (String(currentComment.userId || "").trim() !== myId.trim()) return;
    
    const { value: newText } = await Swal.fire({
        title: 'แก้ไขความคิดเห็น',
        input: 'text',
        inputValue: currentComment.text,
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        inputValidator: (value) => {
            if (!value.trim()) return 'กรุณากรอกข้อความ!';
        }
    });
    
    if (newText) {
        currentComment.text = newText.trim();
        
        if (window.currentTikTokPost.interactions) {
            window.currentTikTokPost.interactions.comments = comments;
        } else {
            window.currentTikTokPost.comments = comments;
        }
        
        renderTikTokCommentsList();
        
        if (READ_FROM_SUPABASE && supabaseClient) {
            try {
                const postId = window.currentTikTokPost.uuid || window.currentTikTokPost.id;
                const { data: postData } = await supabaseClient.from('Activities').select('JSON').eq('UUID', postId).maybeSingle();
                let interactions = postData?.JSON || { likes: [], verifies: [] };
                if (typeof interactions === 'string') interactions = JSON.parse(interactions);
                
                interactions.comments = comments;
                await supabaseClient.from('Activities').update({ "JSON": interactions }).eq('UUID', postId);
            } catch (e) {
                console.error(e);
            }
        }
        
        const postId = window.currentTikTokPost.uuid || window.currentTikTokPost.id;
        updateSinglePostUI(postId);
        if (_currentActivePostId === postId) {
            startCommentsTicker(postId);
        }
        
        Swal.fire({
            toast: true,
            icon: 'success',
            title: 'แก้ไขความคิดเห็นสำเร็จ',
            position: 'top-end',
            timer: 1500,
            showConfirmButton: false
        });
    }
}

async function deleteTikTokComment(index) {
    if (!window.currentTikTokPost) return;
    let comments = window.currentTikTokPost.interactions?.comments || window.currentTikTokPost.comments || [];
    if (typeof comments === 'string') {
        try { comments = JSON.parse(comments); } catch (e) { comments = []; }
    }
    if (!Array.isArray(comments) || !comments[index]) return;
    
    const currentComment = comments[index];
    const myId = String(currentUser.userId || currentUser.id || "");
    const role = String(currentUser?.role || "").toLowerCase();
    const isAdmin = /admin|ผู้ดูแลระบบ/i.test(role);
    
    if (String(currentComment.userId || "").trim() !== myId.trim() && !isAdmin) return;
    
    const result = await Swal.fire({
        title: 'ยืนยันการลบความคิดเห็น?',
        text: 'คุณจะไม่สามารถกู้คืนความคิดเห็นนี้ได้!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก'
    });
    
    if (result.isConfirmed) {
        comments.splice(index, 1);
        
        if (window.currentTikTokPost.interactions) {
            window.currentTikTokPost.interactions.comments = comments;
        } else {
            window.currentTikTokPost.comments = comments;
        }
        
        renderTikTokCommentsList();
        renderImagePins();
        
        if (READ_FROM_SUPABASE && supabaseClient) {
            try {
                const postId = window.currentTikTokPost.uuid || window.currentTikTokPost.id;
                const { data: postData } = await supabaseClient.from('Activities').select('JSON').eq('UUID', postId).maybeSingle();
                let interactions = postData?.JSON || { likes: [], verifies: [] };
                if (typeof interactions === 'string') interactions = JSON.parse(interactions);
                
                interactions.comments = comments;
                await supabaseClient.from('Activities').update({ "JSON": interactions }).eq('UUID', postId);
            } catch (e) {
                console.error(e);
            }
        }
        
        const postId = window.currentTikTokPost.uuid || window.currentTikTokPost.id;
        updateSinglePostUI(postId);
        if (_currentActivePostId === postId) {
            startCommentsTicker(postId);
        }
        
        Swal.fire({
            toast: true,
            icon: 'success',
            title: 'ลบความคิดเห็นเรียบร้อยแล้ว',
            position: 'top-end',
            timer: 1500,
            showConfirmButton: false
        });
    }
}

async function toggleCommentLike(index) {
    if (!window.currentTikTokPost || !currentUser) return;
    let comments = window.currentTikTokPost.interactions?.comments || window.currentTikTokPost.comments || [];
    if (typeof comments === 'string') {
        try { comments = JSON.parse(comments); } catch (e) { comments = []; }
    }
    if (!Array.isArray(comments) || !comments[index]) return;
    
    const c = comments[index];
    if (!Array.isArray(c.likes)) c.likes = [];
    
    const myId = String(currentUser.userId || currentUser.id || "");
    const likeIdx = c.likes.indexOf(myId);
    const isLiking = (likeIdx === -1);
    
    if (likeIdx !== -1) {
        c.likes.splice(likeIdx, 1);
    } else {
        c.likes.push(myId);
    }
    
    if (window.currentTikTokPost.interactions) {
        window.currentTikTokPost.interactions.comments = comments;
    } else {
        window.currentTikTokPost.comments = comments;
    }
    
    renderTikTokCommentsList();
    
    if (READ_FROM_SUPABASE && supabaseClient) {
        try {
            const postId = window.currentTikTokPost.uuid || window.currentTikTokPost.id;
            const { data: postData } = await supabaseClient.from('Activities').select('JSON').eq('UUID', postId).maybeSingle();
            let interactions = postData?.JSON || { likes: [], verifies: [] };
            if (typeof interactions === 'string') interactions = JSON.parse(interactions);
            
            interactions.comments = comments;
            await supabaseClient.from('Activities').update({ "JSON": interactions }).eq('UUID', postId);
            
            // ส่งแจ้งเตือนไปยังผู้เขียนความคิดเห็นนี้ (ยกเว้นกดถูกใจให้ตัวเอง)
            if (isLiking && typeof triggerPushNotification === 'function') {
                const commenterId = c.userId;
                const cleanCommenterId = String(commenterId || '').trim().toLowerCase();
                const cleanMyId = String(myId || '').trim().toLowerCase();
                if (cleanCommenterId && cleanCommenterId !== cleanMyId) {
                    triggerPushNotification(
                        '❤️ มีคนถูกใจความคิดเห็นของคุณ!',
                        `${currentUser.name} ได้กดถูกใจความคิดเห็น: "${c.text}"`,
                        window.location.origin + '/index.html?postId=' + postId + '&commentIndex=' + index,
                        commenterId
                    ).catch(err => console.error(err));
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
}

// Helper: check if post should be hidden due to inappropriate dislikes
function isPostHiddenDueToDislikes(post) {
    if (!post) return false;
    const group = post.groupCode || post.GroupCode || '';
    const activeStaffCount = typeof getActiveStaffCount === 'function' ? getActiveStaffCount(group) : 1;
    
    const dislikes = post.interactions?.dislikes || post.dislikes || [];
    if (!Array.isArray(dislikes)) return false;
    
    if (dislikes.length <= activeStaffCount * 0.5) return false;
    
    const inappropriateCount = dislikes.filter(d => typeof d === 'object' && d.reason === 'inappropriate').length;
    if (inappropriateCount > dislikes.length * 0.5) {
        return true;
    }
    return false;
}

// Helper: check if post has confirmed duplicates reported by > 2 users
function getConfirmedDuplicatePostId(post) {
    if (!post) return null;
    const dislikes = post.interactions?.dislikes || post.dislikes || [];
    if (!Array.isArray(dislikes)) return null;
    
    const dupReports = {};
    dislikes.forEach(d => {
        if (typeof d === 'object' && d.reason === 'duplicate' && d.duplicatePostId) {
            const cleanId = String(d.duplicatePostId).trim();
            if (cleanId) {
                dupReports[cleanId] = (dupReports[cleanId] || 0) + 1;
            }
        }
    });
    
    for (const [dupId, count] of Object.entries(dupReports)) {
        if (count > 2) {
            return dupId;
        }
    }
    return null;
}

// Centered post scroll observer
function detectActivePost() {
    const cards = document.querySelectorAll('.feed-card');
    if (cards.length === 0) return;
    
    let closestCard = null;
    let minDistance = Infinity;
    const viewportCenter = window.innerHeight / 2;
    
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.top + rect.height / 2;
        const distance = Math.abs(cardCenter - viewportCenter);
        if (distance < minDistance) {
            minDistance = distance;
            closestCard = card;
        }
    });
    
    if (closestCard) {
        const postId = closestCard.id.replace('post-', '');
        if (_currentActivePostId !== postId) {
            // Remove active classes & hide tickers
            cards.forEach(c => {
                c.classList.remove('active-post');
                const ticker = c.querySelector('.feed-comments-ticker');
                if (ticker) ticker.style.display = 'none';
            });
            
            // Activate closest
            closestCard.classList.add('active-post');
            _currentActivePostId = postId;
            
            startCommentsTicker(postId);
        }
    }
}

function startCommentsTicker(postId) {
    if (_commentsTickerInterval) {
        clearInterval(_commentsTickerInterval);
        _commentsTickerInterval = null;
    }
    
    const post = window.globalFeedData?.find(p => (p.uuid || p.id) == postId);
    if (!post) return;
    
    let comments = [];
    if (post.interactions?.comments) {
        comments = post.interactions.comments;
    } else if (post.comments) {
        comments = post.comments;
    }
    if (typeof comments === 'string') {
        try { comments = JSON.parse(comments); } catch (e) { comments = []; }
    }
    if (!Array.isArray(comments)) comments = [];
    
    const tickerEl = document.getElementById(`comments-ticker-${postId}`);
    if (!tickerEl) return;
    
    if (comments.length === 0) {
        tickerEl.style.display = 'none';
        return;
    }
    
    tickerEl.style.display = 'flex';
    let tickerIndex = 0;
    
    const showNextComment = () => {
        const c = comments[tickerIndex];
        if (!c) return;
        
        const avatar = c.userImg || c.avatar || 'https://dummyimage.com/30x30/ccc/888&text=?';
        const name = c.userName || c.name || 'Unknown';
        const text = c.text || c.comment || '';
        
        tickerEl.innerHTML = `
            <div class="ticker-item">
                <img src="${avatar}" class="ticker-avatar" onerror="this.src='https://dummyimage.com/30x30/ccc/888&text=?';">
                <div class="ticker-text-wrapper">
                    <strong>${name}</strong>: <span>${text}</span>
                </div>
            </div>
        `;
        
        tickerIndex = (tickerIndex + 1) % comments.length;
    };
    
    showNextComment();
    if (comments.length > 1) {
        _commentsTickerInterval = setInterval(showNextComment, 3000);
    }
}

// Register events for centered post detection
window.addEventListener('scroll', () => {
    detectActivePost();
});

// Trigger once after feed render is called in renderFeedUI
const originalRenderFeedUI = renderFeedUI;
renderFeedUI = function(filteredFeed, append = false) {
    originalRenderFeedUI(filteredFeed, append);
    setTimeout(detectActivePost, 500);
};
