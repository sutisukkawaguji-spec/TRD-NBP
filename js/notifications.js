// ============================================================
// 🔔 notifications.js — ระบบแจ้งเตือน (In-App)
// ============================================================

function triggerNotificationEffects() {
    const bell = document.getElementById('bellIcon');
    if (bell) {
        bell.classList.remove('bell-shake');
        void bell.offsetWidth;
        bell.classList.add('bell-shake');
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    }

    const sound = document.getElementById('notifSound');
    if (sound) {
        if (localStorage.getItem('notif_muted') !== 'true') {
            sound.currentTime = 0;
            const playPromise = sound.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => { console.warn("🔊 Sound play blocked by browser."); });
            }
        }
    }
}

function processAnnounceData(data, silent = false) {
    try {
        if (!data) return;
        const rawItems = data.announcements || data.data || (Array.isArray(data) ? data : []);
        const oldIds = appNotifications.map(n => n.id);
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
        const tomorrowStr = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`;
        let hasNewUpcoming = false;

        const gasNotifs = rawItems.map(a => {
            const itemDate = a.date || '';
            if (itemDate && itemDate >= todayStr && !oldIds.includes(a.id)) hasNewUpcoming = true;

            if (itemDate === tomorrowStr) {
                const isRead = localStorage.getItem(`notif_read_${a.id}`);
                const hasReminded = localStorage.getItem(`notif_reminded_${a.id}`);
                if (isRead && !hasReminded) {
                    localStorage.removeItem(`notif_read_${a.id}`);
                    localStorage.setItem(`notif_reminded_${a.id}`, 'true');
                    hasNewUpcoming = true;
                }
            }

            return {
                id: a.id || 'gas_' + Math.random(), title: a.title, body: a.body,
                date: itemDate, displayDate: a.displayDate || itemDate, eventIso: a.eventIso,
                time: a.displayDate || itemDate, source: 'gas', category: a.category || 'general', ts: a.ts
            };
        });

        const generalGasNotifs = gasNotifs.filter(n => n.category !== 'gift_box');
        const otherNotifs = appNotifications.filter(n => n.source !== 'gas');
        appNotifications = [...generalGasNotifs, ...otherNotifs];

        renderNotifList();

        if (hasNewUpcoming) {
            const unnotifiedIds = generalGasNotifs
                .filter(n => (n.date >= todayStr || n.date === tomorrowStr) && !localStorage.getItem(`last_notified_${n.id}`))
                .map(n => n.id);

            if (unnotifiedIds.length > 0) {
                unnotifiedIds.forEach(id => localStorage.setItem(`last_notified_${id}`, 'true'));
                triggerNotificationEffects();

                if (!silent) {
                    Swal.fire({
                        toast: true, position: 'top-end', icon: 'info',
                        title: '📢 มีการแจ้งเตือนเรื่องราวใหม่!',
                        showConfirmButton: false, timer: 3500
                    });
                } else if (typeof showAppNotification === 'function') {
                    showAppNotification('📢 กิจกรรมใหม่!', 'มีเรื่องราวหรืองานใหม่เข้ามา แตะเพื่อเช็คกระดิ่งแจ้งเตือนดูสิ', 'activity', 'index.html');
                }
            }
        }
    } catch (e) { console.error('🔔 processAnnounceData Error:', e); }
}

async function fetchAnnouncements(silent = false) {
    if (READ_FROM_SUPABASE && supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('Announcements')
                .select('*')
                .order('Date', { ascending: false })
                .order('Time', { ascending: false })
                .limit(50);

            if (error) throw error;

            const mappedAnnouncements = (data || []).map(row => ({
                id: row.ID,
                title: row.Title,
                body: row.Body,
                date: row.EventDate,
                displayDate: row.EventDate ? new Date(row.EventDate).toLocaleDateString('th-TH') : '',
                eventTime: row.EventTime || '',
                category: row.Category || 'general',
                postedBy: row.PostedBy || '',
                ts: row.Date + 'T' + (row.Time || '00:00:00')
            }));

            processAnnounceData({ announcements: mappedAnnouncements }, silent === true);
            return;
        } catch (e) {
            console.warn('☁️ Supabase fetchAnnouncements failed, falling back to GAS:', e);
        }
    }

    const url = GAS_URL + '?action=get_announcements&t=' + Date.now();
    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (data && data.status === 'error') {
                console.warn('📢 Server returned error for announcements:', data.message);
                renderNotifList();
                return;
            }
            processAnnounceData(data, silent === true);
        })
        .catch(err => {
            console.warn('🔔 Fetch failed, trying JSONP...', err.message);
            window.__gasNotifCb = (data) => processAnnounceData(data, silent);
            const old = document.getElementById('jsonp_gas_notif'); if (old) old.remove();
            const s = document.createElement('script');
            s.id = 'jsonp_gas_notif';
            s.src = `${GAS_URL}?action=get_announcements&callback=__gasNotifCb&t=${Date.now()}`;
            document.head.appendChild(s);
        });
}

function renderNotifList() {
    const list = document.getElementById('notifList');
    if (!list) return;

    if (appNotifications.length === 0) {
        list.innerHTML = '<div class="text-center py-5 text-muted small">ยังไม่มีรายการแจ้งเตือน</div>';
        updateBadge(0); return;
    }

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let unreadCount = 0;
    let html = '';

    appNotifications.sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(n => {
        const isUpcoming = n.date && n.date >= today;
        const isRead = localStorage.getItem(`notif_read_${n.id}`);
        if (!isRead && isUpcoming) unreadCount++;

        const color = CATEGORY_COLORS[n.category] || '#636e72';
        html += `
            <div class="notif-item ${isUpcoming ? 'notif-upcoming' : 'opacity-75'}" 
                 style="${(!isRead && isUpcoming) ? `border-left:4px solid ${color};` : 'border-left:4px solid transparent;'}" 
                 onclick="readNotif('${n.id}')">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <span class="notif-title fw-bold ${!isRead && isUpcoming ? 'text-dark' : 'text-muted'}">${n.title}</span>
                    ${isUpcoming ? '<span class="notif-status-badge bg-primary text-white">เร็วๆ นี้</span>' : '<span class="notif-status-badge bg-secondary text-white">ผ่านไปแล้ว</span>'}
                </div>
                <div class="notif-body small text-muted">${n.body || ''}</div>
                <div class="d-flex justify-content-between align-items-center mt-2 small">
                    <span style="color:${color}; fw-bold">${CATEGORY_ICONS[n.category] || '📢'} ${n.displayDate || n.date || ''}</span>
                    <span class="text-muted">${n.time || ''}</span>
                </div>
            </div>`;
    });
    list.innerHTML = html;
    updateBadge(unreadCount);
    if (typeof updateAddAnnounceButton === 'function') updateAddAnnounceButton();
}

function updateBadge(count) {
    const badge = document.getElementById('notifBadge');
    if (badge) {
        if (count > 0) { badge.style.display = 'flex'; badge.innerText = count > 9 ? '9+' : count; }
        else badge.style.display = 'none';
    }
}

function readNotif(id) {
    try {
        const item = appNotifications.find(n => n.id === id);
        if (item) {
            localStorage.setItem(`notif_read_${id}`, 'true');
            if (item.ts) {
                const parsed = new Date(String(item.ts).replace(/\(.*\)/, '').trim());
                if (!isNaN(parsed.getTime())) {
                    const current = parseInt(localStorage.getItem('notif_cleared_at') || '0');
                    if (parsed.getTime() > current) {
                        localStorage.setItem('notif_cleared_at', parsed.getTime().toString());
                    }
                }
            }
            renderNotifList();
            if (typeof closeNotifPanel === 'function') closeNotifPanel();

            const color = CATEGORY_COLORS[item.category] || '#6c5ce7';
            const icon = CATEGORY_ICONS[item.category] || '📢';

            Swal.fire({
                title: `<div style="text-align:left; font-size:1.15rem; font-weight:700;">${item.title}</div>`,
                html: `
                    <div class="text-start" style="font-family: 'Kanit', sans-serif;">
                        <div class="mb-2">
                            <span class="badge" style="background:${color}20; color:${color}; border:1px solid ${color}40; font-size:0.7rem; padding:4px 10px;">
                                ${icon} ${item.category || 'ทั่วไป'}
                            </span>
                        </div>
                        <div class="text-muted small mb-3">
                            <i class="fas fa-calendar-alt me-1"></i> ${item.displayDate || item.date} ${item.time || ''}
                        </div>
                        <div style="font-size: 0.95rem; line-height: 1.7; color: var(--text-color); white-space: pre-wrap; max-height: 60vh; overflow-y: auto; padding-right: 5px;">
                            ${item.body || 'ไม่มีรายละเอียดเพิ่มเติม'}
                        </div>
                    </div>
                `,
                confirmButtonText: 'เข้าใจแล้ว',
                confirmButtonColor: color,
                width: '92%',
                maxWidth: '420px',
                customClass: { popup: 'glass-card rounded-4' }
            });
        }
    } catch (e) {
        console.warn("readNotif data error:", e);
        if (typeof closeNotifPanel === 'function') closeNotifPanel();
    }
}

function markAllNotifRead() {
    localStorage.setItem('notif_cleared_at', Date.now().toString());
    appNotifications.forEach(n => localStorage.setItem(`notif_read_${n.id}`, 'true'));
    renderNotifList();
    if (typeof closeNotifPanel === 'function') closeNotifPanel();
}
