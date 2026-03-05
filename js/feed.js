// ============================================================
// 📰  feed.js — Feed Fetching, Rendering & Filtering
//     ต้องโหลดหลัง config.js
// ============================================================

// ----- Media Helpers -----
function getMediaContent(url) {
    if (!url) return '';
    url = url.trim();
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/))([w-]{11})/);
    if (ytMatch?.[1]) {
        const vid = ytMatch[1];
        return `<div class="ratio ratio-16x9 rounded-4 overflow-hidden shadow-sm border">
                    <iframe src="https://www.youtube.com/embed/${vid}?enablejsapi=1" allowfullscreen style="border:0;" class="yt-video"></iframe>
                </div>`;
    }
    if (url.match(/\.(mp4|webm|ogg)($|\?)/i)) {
        return `<div class="ratio ratio-16x9 rounded-4 overflow-hidden shadow-sm border bg-dark">
                    <video src="${url}" controls style="width:100%;height:100%;"></video>
                </div>`;
    }
    if (url.includes('drive.google.com') || url.includes('googleusercontent.com') || url.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i)) {
        return `<img src="${url}" loading="lazy" class="img-fluid rounded-4 shadow-sm border" style="max-height:400px;width:100%;object-fit:cover;cursor:pointer;" onclick="viewImage('${url}')">`;
    }
    if (url.includes('tiktok.com')) return createLinkCard(url, 'TikTok', 'fab fa-tiktok', '#000000');
    if (url.includes('facebook.com') || url.includes('fb.watch')) return createLinkCard(url, 'Facebook', 'fab fa-facebook', '#1877F2');
    if (url.includes('instagram.com')) return createLinkCard(url, 'Instagram', 'fab fa-instagram', '#E1306C');
    if (url.startsWith('http')) return createLinkCard(url, 'Link', 'fas fa-external-link-alt', '#6c757d');
    return '';
}

function createLinkCard(url, name, icon, color) {
    return `<a href="${url}" target="_blank" class="text-decoration-none">
        <div class="d-flex align-items-center p-3 rounded-4 bg-light border shadow-sm" style="border-left:5px solid ${color}!important;">
            <div class="me-3 fs-1" style="color:${color};"><i class="${icon}"></i></div>
            <div class="text-truncate flex-grow-1">
                <div class="fw-bold text-dark" style="font-size:0.9rem;">ดูเนื้อหาบน ${name}</div>
                <small class="text-muted text-truncate d-block" style="font-size:0.75rem;">${url}</small>
            </div>
            <div class="ms-2 text-secondary"><i class="fas fa-chevron-right"></i></div>
        </div>
    </a>`;
}

// ----- Media Preview (Form) -----
function previewMedia(url) {
    const preview = document.getElementById('previewArea');
    const html = getMediaContent(url);
    if (html) { preview.innerHTML = html; preview.style.display = 'block'; }
    else { preview.innerHTML = ''; preview.style.display = 'none'; }
}
function clearMedia() {
    document.getElementById('mediaLinkInput').value = '';
    const p = document.getElementById('previewArea');
    p.innerHTML = '';
    p.style.display = 'none';
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
    if (isFetchingFeed) return;
    if (!silent) isFetchingFeed = true;

    if (!append) { currentFeedLimit = 10; renderedPostIds.clear(); }

    const container = document.getElementById('feedContainer');
    const filterType = currentFeedFilter;
    const filterCategory = document.getElementById('filterCategory')?.value || '';
    const filterDate = document.getElementById('filterDate')?.value || '';
    const filterYear = document.getElementById('filterYear')?.value || '';

    if (!container) { isFetchingFeed = false; return; }

    if (!append && !silent) {
        // Skeleton Loading
        container.innerHTML = `
            <div class="skeleton-card">
                <div class="d-flex align-items-center mb-3">
                    <div class="skeleton rounded-circle me-3" style="width:45px;height:45px;flex-shrink:0;"></div>
                    <div class="flex-grow-1">
                        <div class="skeleton mb-2" style="height:14px;width:60%;"></div>
                        <div class="skeleton" style="height:12px;width:35%;"></div>
                    </div>
                </div>
                <div class="skeleton mb-2" style="height:160px;width:100%;"></div>
                <div class="skeleton" style="height:12px;width:80%;"></div>
            </div>
            <div class="skeleton-card">
                <div class="d-flex align-items-center mb-3">
                    <div class="skeleton rounded-circle me-3" style="width:45px;height:45px;flex-shrink:0;"></div>
                    <div class="flex-grow-1">
                        <div class="skeleton mb-2" style="height:14px;width:50%;"></div>
                        <div class="skeleton" style="height:12px;width:30%;"></div>
                    </div>
                </div>
                <div class="skeleton mb-2" style="height:120px;width:100%;"></div>
                <div class="skeleton" style="height:12px;width:70%;"></div>
            </div>`;
    } else if (append && !silent) {
        const btn = document.getElementById('loadMoreBtnWrapper');
        if (btn) btn.innerHTML = '<button class="btn btn-outline-primary rounded-pill px-4 disabled"><i class="fas fa-spinner fa-spin me-1"></i>กำลังโหลด...</button>';
    }

    fetch(GAS_URL + '?action=get_feed&limit=' + currentFeedLimit + '&t=' + Date.now())
        .then(r => r.json())
        .then(data => {
            if (!append) container.innerHTML = '';
            else { document.getElementById('loadMoreBtnWrapper')?.remove(); }

            if (!currentUser) return;

            let feed = [];
            if (data?.status === 'error') {
                container.innerHTML = `<div class="text-danger text-center mt-5">Error: ${data.message}</div>`;
                return;
            }
            if (Array.isArray(data)) feed = data;
            else if (data?.feed) { feed = data.feed; if (data.userMap) Object.assign(allUsersMap, data.userMap); }
            if (!Array.isArray(feed)) feed = [];

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
                const iAmTagged = (p.taggedFriends || '').includes(currentUser.userId);
                const alreadyDone = (p.verifies || []).some(v => String(v.lineId) === String(currentUser.userId));
                const isOwner = String(p.user_line_id) === String(currentUser.userId);
                return iAmTagged && !alreadyDone && !isOwner && p.privacy !== 'private';
            }).length;
            const pendingBadge = document.getElementById('pending-badge');
            if (pendingBadge) {
                pendingBadge.textContent = pendingCount;
                pendingBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
            }

            // --- Filter ---
            const filteredFeed = feed.filter(post => {
                let pass = true;
                const postDate = post.timestamp ? new Date(post.timestamp) : null;
                const isValidDate = postDate && !isNaN(postDate);
                const isMyPost = String(post.user_line_id) === String(currentUser.userId);
                const amITagged = (post.taggedFriends || '').includes(currentUser.userId);
                const isPrivate = post.privacy === 'private';

                if (isPrivate && !isMyPost) return false;
                if (filterType === 'related' && !isMyPost && !amITagged) pass = false;
                if (filterType === 'request') {
                    const alreadyVerified = (post.verifies || []).some(v => String(v.lineId) === String(currentUser.userId));
                    if (!(amITagged && !alreadyVerified && !isMyPost)) pass = false;
                }
                if (filterCategory && post.virtue !== filterCategory) pass = false;
                if (isValidDate) {
                    if (filterDate && postDate.toISOString().split('T')[0] !== filterDate) pass = false;
                    if (filterYear && String(postDate.getFullYear()) !== filterYear) pass = false;
                } else if (filterDate || filterYear) pass = false;
                return pass;
            });

            if (filteredFeed.length === 0 && !append) {
                const msg = filterType === 'request' ? '✅ ไม่มีโพสต์ที่รอ Verify จากคุณ'
                    : filterType === 'related' ? 'ยังไม่มีเรื่องราวของคุณ'
                        : 'ยังไม่มีเรื่องราว';
                container.innerHTML = `<div class="text-center py-5 text-muted"><i class="fas fa-inbox fa-2x mb-3 d-block opacity-50"></i>${msg}</div>`;
                isFetchingFeed = false;
                return;
            }

            // --- Render ---
            const virtueMap = { volunteer: '🤝 จิตอาสา', sufficiency: '🌱 พอเพียง', discipline: '📏 วินัย', integrity: '💎 สุจริต', gratitude: '🙏 กตัญญู' };
            const iconMap = { like: '👍', love: '❤️', wow: '😮', laugh: '😂', sad: '😢', pray: '🙏' };

            let htmlBuffer = '';
            filteredFeed.forEach(post => {
                if (renderedPostIds.has(post.id)) return;
                renderedPostIds.add(post.id);

                const postDate = post.timestamp ? new Date(post.timestamp) : null;
                const isValidDate = postDate && !isNaN(postDate);
                const isMyPost = String(post.user_line_id) === String(currentUser.userId);
                const isPrivate = post.privacy === 'private';
                const canSee = !isPrivate || isMyPost;
                const taggedIds = post.taggedFriends ? String(post.taggedFriends).split(',').map(s => s.trim()).filter(s => s.length > 5) : [];
                const isTeam = taggedIds.length > 0;
                const amITagged = taggedIds.includes(String(currentUser.userId));
                const verifyList = post.verifies || [];
                const isVerifiedByMe = verifyList.some(v => String(v.lineId) === String(currentUser.userId));

                // Tagged avatars
                let teamList = post.tagged_avatars || [];
                if (teamList.length === 0 && taggedIds.length > 0)
                    teamList = taggedIds.map(id => allUsersMap[id]).filter(Boolean);

                let taggedHtml = '';
                if (isTeam && canSee) {
                    taggedHtml = `<div class="row-participants animate__animated animate__fadeIn"><small class="text-primary me-2 fw-bold"><i class="fas fa-users"></i> Team:</small><div class="d-flex align-items-center">`;
                    teamList.forEach(u => { taggedHtml += `<img src="${u.img}" class="tagged-img" title="${u.name}" loading="lazy" onerror="this.style.display='none'">`; });
                    taggedHtml += `</div></div>`;
                }

                // Witness
                let witnessHtml = '';
                if (verifyList.length > 0 && canSee) {
                    witnessHtml = `<div class="row-witness animate__animated animate__fadeIn"><small class="text-success me-2 fw-bold"><i class="fas fa-check-circle"></i> Witness:</small><div class="d-flex align-items-center">`;
                    verifyList.forEach(v => { witnessHtml += `<img src="${v.img}" class="witness-img" title="${v.name}" loading="lazy" onerror="this.style.display='none'">`; });
                    witnessHtml += `</div></div>`;
                }

                // Action Button
                let btnHtml = '';
                if (isPrivate) {
                    if (isMyPost) btnHtml = `<span class="badge bg-secondary rounded-pill ms-auto"><i class="fas fa-lock"></i> Private</span>`;
                } else if (isMyPost) {
                    if (isTeam) btnHtml = `<span class="badge bg-info text-dark rounded-pill ms-auto"><i class="fas fa-users"></i> Team Work</span>`;
                    else btnHtml = verifyList.length > 0
                        ? `<span class="badge bg-success rounded-pill ms-auto"><i class="fas fa-check"></i> Approved</span>`
                        : `<span class="badge bg-secondary rounded-pill ms-auto"><i class="fas fa-clock"></i> Pending</span>`;
                } else {
                    if (amITagged) btnHtml = `<span class="badge bg-light text-primary border rounded-pill ms-auto"><i class="fas fa-user-tag"></i> You're in team</span>`;
                    else btnHtml = isVerifiedByMe
                        ? `<button class="btn btn-sm btn-success rounded-pill ms-auto disabled">Verified</button>`
                        : `<button onclick="verifyPost('${post.id}','${post.user_line_id}','${post.user_name}',this)" class="btn btn-sm btn-outline-primary rounded-pill ms-auto">Verify (+3)</button>`;
                }

                // Reaction
                let myReaction = (post.likes || []).find(u => String(u.lineId) === String(currentUser.userId));
                let reactIcon = myReaction ? (iconMap[myReaction.type] || '❤️') : '🤍';

                // Media
                const mediaContent = canSee ? getMediaContent(post.image) : '';
                const noteContent = canSee ? post.note : '<span class="text-muted fst-italic"><i class="fas fa-lock"></i> Private</span>';
                let vdoBtnHtml = '';
                const lnk = post.image || '';
                if (lnk.includes('youtube') || lnk.includes('youtu.be'))
                    vdoBtnHtml = `<a href="${lnk}" target="_blank" class="btn btn-sm btn-light text-danger rounded-pill border ms-2" style="font-size:0.75rem;"><i class="fab fa-youtube"></i> Watch VDO</a>`;
                else if (lnk.includes('tiktok'))
                    vdoBtnHtml = `<a href="${lnk}" target="_blank" class="btn btn-sm btn-light text-dark rounded-pill border ms-2" style="font-size:0.75rem;"><i class="fab fa-tiktok"></i> TikTok</a>`;
                else if (lnk.includes('facebook') || lnk.includes('fb.watch'))
                    vdoBtnHtml = `<a href="${lnk}" target="_blank" class="btn btn-sm btn-light text-primary rounded-pill border ms-2" style="font-size:0.75rem;"><i class="fab fa-facebook"></i> Facebook</a>`;

                const dateStr = isValidDate ? postDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

                htmlBuffer += `
                <div class="glass-card feed-card p-3 mb-3 animate__animated animate__fadeIn">
                    <div class="feed-header d-flex align-items-start">
                        <img src="${post.user_img}" class="feed-avatar me-2 mt-1" loading="lazy" onerror="this.src='https://dummyimage.com/45x45/ddd/888&text=?'">
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between">
                                <h6 class="mb-0 fw-bold">${post.user_name}</h6>
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
                                onclick="editPost('${post.id}','${encodeURIComponent(post.note || '')}')" title="แก้ไข">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger rounded-circle" style="width:28px;height:28px;padding:0;font-size:0.75rem;"
                                onclick="deletePost('${post.id}')" title="ลบ">
                                <i class="fas fa-trash"></i>
                            </button>` : ''}
                        </div>
                    </div>
                </div>`;
            });

            if (htmlBuffer) container.insertAdjacentHTML('beforeend', htmlBuffer);

            if (feed.length >= currentFeedLimit) {
                container.insertAdjacentHTML('beforeend',
                    `<div id="loadMoreBtnWrapper" class="text-center mt-3 mb-5">
                        <button class="btn btn-outline-primary rounded-pill px-4" onclick="loadMoreFeed()">
                            <i class="fas fa-arrow-down me-1"></i>ดูเรื่องราวเพิ่มเติม
                        </button>
                    </div>`);
            }
        })
        .catch(err => {
            console.error('fetchFeed error:', err);
            if (container) {
                container.innerHTML = `<div class="text-center py-5">
                    <i class="fas fa-wifi fa-2x text-muted mb-3 d-block opacity-50"></i>
                    <span class="text-muted">โหลดไม่สำเร็จ</span><br>
                    <button onclick="fetchFeed()" class="btn btn-sm btn-outline-primary mt-3 rounded-pill px-4">
                        <i class="fas fa-sync me-1"></i>ลองใหม่
                    </button>
                </div>`;
            }
            isFetchingFeed = false;
        })
        .finally(() => { isFetchingFeed = false; });
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
function viewImage(url) {
    Swal.fire({ imageUrl: url, imageWidth: '100%', showConfirmButton: false, showCloseButton: true, background: 'transparent' });
}
