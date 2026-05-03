// ============================================================
// 🔌  gas.js — GAS (Google Apps Script) Compatibility Layer
//     Provides frontend equivalents for all GAS actions.
//     ต้องโหลดหลัง config.js และ supabaseClient พร้อมใช้งาน
// ============================================================

/**
 * GAS_COMPAT is a frontend compatibility layer that mirrors all actions
 * that used to be handled by cod.gs on the Google Apps Script backend.
 *
 * ใช้งาน: แทนที่การเรียก fetch(GAS_URL, ...) ด้วย GAS_COMPAT.call(action, payload)
 * ระบบจะส่งไปยัง Supabase โดยตรง หากไม่สำเร็จจึงจะ fallback ไปยัง GAS เดิม
 */
const GAS_COMPAT = {

    /**
     * Main dispatcher — mirrors the doPost() function in cod.gs
     * @param {string} action - action name matching cod.gs cases
     * @param {object} payload - data object to pass
     * @returns {Promise<any>} result
     */
    async call(action, payload = {}) {
        console.log(`[GAS_COMPAT] Action: ${action}`, payload);
        try {
            if (typeof this[action] === 'function') {
                return await this[action](payload);
            }
            throw new Error(`Unknown GAS action: ${action}`);
        } catch (e) {
            console.error(`[GAS_COMPAT] ❌ ${action} failed:`, e);
            // Fallback to real GAS if available
            if (typeof GAS_URL !== 'undefined' && GAS_URL) {
                return this._fallbackToGAS(action, payload);
            }
            throw e;
        }
    },

    /** Fallback to original GAS endpoint */
    async _fallbackToGAS(action, payload) {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, ...payload })
        });
        const text = await res.text();
        try { return JSON.parse(text); } catch { return text; }
    },

    // =========================================
    // 👤 USER MANAGEMENT (เดิมอยู่ใน cod.gs)
    // =========================================

    /** check_user: ตรวจสอบผู้ใช้จาก LineID */
    async check_user({ userId, img, name }) {
        if (!supabaseClient || !userId) throw new Error('Supabase not ready');
        const { data, error } = await supabaseClient
            .from('Users').select('*').eq('LineID', userId).maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            return {
                exists: true,
                user: {
                    lineId: data.LineID, name: data.Name, img: data.Image,
                    role: data.Role || 'Guest', level: data.Level || 1,
                    score: data.Score || 0,
                    happyScore: parseFloat(data.HappyScore || data.Happy || 0),
                    virtueStats: data.VirtueStats || {},
                    totalCount: data.TotalCount || 0,
                    status: data.Status || 'active'
                }
            };
        }
        return { exists: false };
    },

    /** get_users: ดึงผู้ใช้ทั้งหมดเข้า cache */
    async get_users() {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const { data, error } = await supabaseClient.from('Users').select('*');
        if (error) throw error;
        return (data || []).map(u => ({
            lineId: u.LineID, name: u.Name, img: u.Image,
            role: u.Role || 'Guest', level: u.Level || 1,
            score: u.Score || 0, department: u.Department,
            happyScore: parseFloat(u.HappyScore || u.Happy || 0),
            virtueStats: u.VirtueStats || {}, status: u.Status || 'active'
        }));
    },

    /** track_visit: บันทึกเวลาเข้าใช้งาน */
    async track_visit({ userId, userName }) {
        if (!supabaseClient || !userId) return;
        const now = new Date();
        await supabaseClient.from('Users').update({
            LastDate: now.toLocaleDateString('en-CA'),
            LastTime: now.toTimeString().split(' ')[0]
        }).eq('LineID', userId);
        return { success: true };
    },

    /** update_user_role: เปลี่ยน Role ของผู้ใช้ (Admin/Manager เท่านั้น) */
    async update_user_role({ lineId, newRole }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const { error } = await supabaseClient
            .from('Users').update({ Role: newRole }).eq('LineID', lineId);
        if (error) throw error;
        return { success: true };
    },

    /** approve_user: อนุมัติบัญชีผู้ใช้ใหม่ */
    async approve_user({ lineId }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const { error } = await supabaseClient
            .from('Users').update({ Status: 'active', Role: 'Staff' }).eq('LineID', lineId);
        if (error) throw error;
        return { success: true };
    },

    /** reject_user: ปฏิเสธบัญชีผู้ใช้ */
    async reject_user({ lineId }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const { error } = await supabaseClient
            .from('Users').update({ Status: 'rejected' }).eq('LineID', lineId);
        if (error) throw error;
        return { success: true };
    },

    /** promote_to_alumni: ย้ายพนักงานไปยังทำเนียบ Hall of Fame */
    async promote_to_alumni({ lineId, newRole, originalRole }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const alumniRole = newRole || `ศิษย์เก่า (${originalRole || 'Staff'})`;
        const { error } = await supabaseClient
            .from('Users').update({ Role: alumniRole }).eq('LineID', lineId);
        if (error) throw error;
        return { success: true, newRole: alumniRole };
    },

    /** register_user: ลงทะเบียนผู้ใช้ใหม่ */
    async register_user({ userId, name, img, department, officeCode, groupCode }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const now = new Date();
        const { error } = await supabaseClient.from('Users').insert({
            LineID: userId, Name: name, Image: img || '',
            Role: 'Guest', Level: 1, Score: 0,
            Status: 'waiting_approval',
            Department: department || '', OfficeCode: officeCode || '', GroupCode: groupCode || '',
            Date: now.toLocaleDateString('en-CA'),
            Time: now.toTimeString().split(' ')[0],
            VirtueStats: { volunteer: 0, sufficiency: 0, discipline: 0, integrity: 0, gratitude: 0 }
        });
        if (error && error.code !== '23505') throw error; // 23505 = duplicate key
        return { success: true };
    },

    // =========================================
    // 📝 ACTIVITY MANAGEMENT
    // =========================================

    /** submit_activity: บันทึกกิจกรรมใหม่ */
    async submit_activity({ userId, userName, virtue, note, happy, imageUrl, tagged, privacy }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const now = new Date();
        const uuid = 'sup_' + Date.now().toString(36);
        const { error } = await supabaseClient.from('Activities').insert({
            UUID: uuid,
            Date: now.toLocaleDateString('en-CA'),
            Time: now.toTimeString().split(' ')[0],
            UserId: userId, UserName: userName,
            Virtue: virtue, Note: note,
            Happy: parseInt(happy) || 3,
            Image: imageUrl || '',
            Tagged: Array.isArray(tagged) ? tagged.join(',') : (tagged || ''),
            Privacy: privacy || 'public',
            JSON: JSON.stringify({ likes: [], verifies: [] }),
            Status: privacy === 'private' ? 'private' : 'waiting_verify',
            Score: 0
        });
        if (error) throw error;
        return { success: true, uuid };
    },

    /** delete_activity: ลบกิจกรรม */
    async delete_activity({ uuid, userId }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const { error } = await supabaseClient
            .from('Activities').delete().eq('UUID', uuid);
        if (error) throw error;
        // Recalculate score after deletion
        if (typeof syncUserScore === 'function') {
            setTimeout(() => syncUserScore(userId), 500);
        }
        return { success: true };
    },

    /** edit_activity: แก้ไขกิจกรรม */
    async edit_activity({ uuid, note, virtue, imageUrl, privacy }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const updates = {};
        if (note !== undefined) updates.Note = note;
        if (virtue !== undefined) updates.Virtue = virtue;
        if (imageUrl !== undefined) updates.Image = imageUrl;
        if (privacy !== undefined) {
            updates.Privacy = privacy;
            if (privacy === 'private') updates.Status = 'private';
        }
        const { error } = await supabaseClient
            .from('Activities').update(updates).eq('UUID', uuid);
        if (error) throw error;
        return { success: true };
    },

    /** verify_activity: ยืนยันกิจกรรม (อนุมัติและให้คะแนน) */
    async verify_activity({ uuid, verifierId, verifierName, verifierImg, postOwnerId, scoreToGive }) {
        if (!supabaseClient) throw new Error('Supabase not ready');

        const { data: post } = await supabaseClient
            .from('Activities').select('JSON, UserId, Status').eq('UUID', uuid).single();
        if (!post) throw new Error('Post not found');

        let json = post.JSON;
        if (typeof json === 'string') try { json = JSON.parse(json); } catch { json = { likes: [], verifies: [] }; }
        json.verifies = json.verifies || [];

        // ตรวจว่ายืนยันไปแล้วหรือยัง
        const alreadyVerified = json.verifies.some(v => v.userId === verifierId || v.lineId === verifierId);
        if (alreadyVerified) return { success: false, reason: 'already_verified' };

        json.verifies.push({ userId: verifierId, name: verifierName, img: verifierImg, at: new Date().toISOString() });

        // ตรวจว่าครบเงื่อนไขอนุมัติหรือยัง (ต้อง >= 2 คนยืนยัน)
        const isApproved = json.verifies.length >= 2;
        const updates = { JSON: json };
        if (isApproved && post.Status !== 'approved') {
            updates.Status = 'approved';
            updates.Score = scoreToGive || 10;
        }

        const { error } = await supabaseClient.from('Activities').update(updates).eq('UUID', uuid);
        if (error) throw error;

        // อัปเดตคะแนนเจ้าของโพสต์
        if (isApproved && typeof syncUserScore === 'function') {
            setTimeout(() => syncUserScore(post.UserId || postOwnerId), 500);
        }
        return { success: true, approved: isApproved };
    },

    /** react_to_activity: กด Like/Reaction */
    async react_to_activity({ uuid, userId, userName, userImg, reactionType }) {
        if (!supabaseClient) throw new Error('Supabase not ready');

        const { data: post } = await supabaseClient
            .from('Activities').select('JSON').eq('UUID', uuid).single();
        if (!post) throw new Error('Post not found');

        let json = post.JSON;
        if (typeof json === 'string') try { json = JSON.parse(json); } catch { json = { likes: [], verifies: [] }; }
        json.likes = json.likes || [];

        const existingIdx = json.likes.findIndex(l => l.userId === userId || l.lineId === userId);
        if (existingIdx >= 0) {
            // Toggle off if same reaction
            if (json.likes[existingIdx].type === reactionType) {
                json.likes.splice(existingIdx, 1);
            } else {
                json.likes[existingIdx].type = reactionType;
            }
        } else {
            json.likes.push({ userId, name: userName, img: userImg, type: reactionType || 'like', at: new Date().toISOString() });
        }

        const { error } = await supabaseClient.from('Activities').update({ JSON: json }).eq('UUID', uuid);
        if (error) throw error;
        return { success: true, likeCount: json.likes.length };
    },

    // =========================================
    // 📢 ANNOUNCEMENTS
    // =========================================

    /** save_announcement: บันทึกประกาศ */
    async save_announcement({ title, body, eventDate, category, postedBy }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const now = new Date();
        const { error } = await supabaseClient.from('Announcements').insert({
            ID: 'ann_' + Date.now(),
            Title: title, Body: body || '',
            EventDate: eventDate,
            Category: category || 'general',
            PostedBy: postedBy,
            Date: now.toLocaleDateString('en-CA'),
            Time: now.toTimeString().split(' ')[0],
            Status: 'active'
        });
        if (error) throw error;
        return { success: true };
    },

    /** delete_announcement: ลบประกาศ */
    async delete_announcement({ id }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const { error } = await supabaseClient.from('Announcements').delete().eq('ID', id);
        if (error) throw error;
        return { success: true };
    },

    /** get_announcements: ดึงประกาศทั้งหมด */
    async get_announcements() {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const { data, error } = await supabaseClient
            .from('Announcements').select('*')
            .eq('Status', 'active').order('Date', { ascending: false }).limit(50);
        if (error) throw error;
        return data || [];
    },

    // =========================================
    // 🎁 REWARDS & CLAIMS
    // =========================================

    /** get_rewards: ดึงรายการรางวัลทั้งหมด */
    async get_rewards() {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const [{ data: rewards }, { data: claims }] = await Promise.all([
            supabaseClient.from('Rewards').select('*'),
            supabaseClient.from('Claims').select('*')
        ]);
        return { rewards: rewards || [], claims: claims || [] };
    },

    /** claim_reward: แจ้งรับรางวัล */
    async claim_reward({ rewardId, userId }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const { error } = await supabaseClient.from('Claims').insert({
            RewardID: rewardId, UserID: userId,
            Date: new Date().toISOString(), Status: 'pending'
        });
        if (error) throw error;
        return { success: true };
    },

    /** save_reward: บันทึก/แก้ไขรางวัล (Admin) */
    async save_reward({ id, name, description, targetVal, imageUrl, mode }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const payload = {
            Name: name, Description: description || '',
            TargetVal: parseInt(targetVal) || 100,
            Image: imageUrl || '', Mode: parseInt(mode) || 1
        };
        if (id) {
            const { error } = await supabaseClient.from('Rewards').update(payload).eq('ID', id);
            if (error) throw error;
        } else {
            payload.ID = 'rwd_' + Date.now();
            const { error } = await supabaseClient.from('Rewards').insert(payload);
            if (error) throw error;
        }
        return { success: true };
    },

    /** delete_reward: ลบรางวัล (Admin) */
    async delete_reward({ id }) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const { error } = await supabaseClient.from('Rewards').delete().eq('ID', id);
        if (error) throw error;
        return { success: true };
    },

    // =========================================
    // 📊 ADMIN & REPORTING
    // =========================================

    /** sync_all_scores: รีเฟรชคะแนนทุกคน */
    async sync_all_scores() {
        if (!supabaseClient) throw new Error('Supabase not ready');
        const { data: users } = await supabaseClient.from('Users').select('LineID');
        if (!users) throw new Error('Cannot fetch users');
        for (const u of users) {
            if (typeof syncUserScore === 'function') await syncUserScore(u.LineID);
        }
        return { success: true, count: users.length };
    },

    /** get_feed: ดึงข้อมูล feed กิจกรรม */
    async get_feed({ limit = 100, userId = null, filter = 'all' } = {}) {
        if (!supabaseClient) throw new Error('Supabase not ready');
        let query = supabaseClient.from('Activities').select('*')
            .not('Status', 'eq', 'private')
            .order('Date', { ascending: false })
            .order('Time', { ascending: false })
            .limit(limit);

        if (userId) {
            query = query.or(`UserId.eq.${userId},Tagged.ilike.%${userId}%`);
        }
        if (filter === 'waiting_verify') {
            query = query.eq('Status', 'waiting_verify');
        } else if (filter === 'approved') {
            query = query.eq('Status', 'approved');
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }
};

// =====================================================
// 🔧 Helper: สร้าง GAS-compatible wrapper functions
//    เพื่อให้ component อื่นๆ เรียกใช้ได้โดยตรง
// =====================================================

/**
 * gasCall() — ฟังก์ชัน shorthand สำหรับเรียก GAS_COMPAT
 * ทดแทนการเรียก fetch(GAS_URL, ...) แบบเดิม
 */
async function gasCall(action, payload = {}) {
    return GAS_COMPAT.call(action, payload);
}

console.log('✅ gas.js (GAS Compatibility Layer) loaded successfully');
