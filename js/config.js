// ============================================================
// ⚙️  config.js — Global Settings, Constants & Utilities
//     โหลดก่อนไฟล์อื่นทุกไฟล์
// ============================================================

// --- 🌐 ENV SETTINGS ---
const APP_VERSION = '2.9.7'; // ⚙️ เวอร์ชันระบบปัจจุบัน
const TEST_ENV = false; // 🔴 เปลี่ยนเป็น true ขณะทดสอบ และ false เมื่อขึ้นระบบจริง
const TEST_GAS_URL = 'https://script.google.com/macros/s/AKfycbzx43HHaxF_Z9_Kf6441lr3rJqdsaMljo-7OtfCPMxlVl7GkI9O3Fv4cWIb_SRAJ3RfTQ/exec';
const TEST_LIFF_ID = '2009329360-XeHfjaTY';
const PROD_GAS_URL = 'https://script.google.com/macros/s/AKfycbzx43HHaxF_Z9_Kf6441lr3rJqdsaMljo-7OtfCPMxlVl7GkI9O3Fv4cWIb_SRAJ3RfTQ/exec'; // 🌟 ใส่ URL ของ GAS ที่ Deploy ใหม่ตรงนี้
const PROD_LIFF_ID = '2009329360-XeHfjaTY';

const GAS_URL = (TEST_ENV && TEST_GAS_URL) ? TEST_GAS_URL : (PROD_GAS_URL || TEST_GAS_URL);
const LIFF_ID = (TEST_ENV && TEST_LIFF_ID) ? TEST_LIFF_ID : (PROD_LIFF_ID || TEST_LIFF_ID);

// --- ☁️ SUPABASE SETTINGS ---
// ⚠️ สำคัญ: นำ URL และ Key มาจาก Supabase Dashboard > Settings > API
const SUPABASE_URL = 'https://vznbkqbmysinxtspsskl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bmJrcWJteXNpbnh0c3Bzc2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjcyMTYsImV4cCI6MjA5MjYwMzIxNn0.mF7LRqXEg1KP1QL1seEx4wFlmx978WaS6u4jWETg_PQ';
const supabaseClient = (typeof supabase !== 'undefined') ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// 🌟 ย้ายมาอ่านข้อมูลจาก Supabase เป็นหลัก (เปลี่ยนเป็น false ถ้าต้องการใช้ GAS/Sheets เดิม)
const READ_FROM_SUPABASE = true; 

// --- 🛡️ SAFE localStorage Wrappers ---
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    } catch (e) {
        ['lastSeenStoryCount', 'notif_asked_at', 'GAS_URL'].forEach(k => localStorage.removeItem(k));
        try {
            localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        } catch (e2) {
            console.warn('⚠️ localStorage full, cannot save:', key);
        }
    }
}
function safeGetItem(key, defaultVal) {
    try { return localStorage.getItem(key) ?? defaultVal ?? null; } catch (e) { return defaultVal ?? null; }
}
function safeGetJSON(key, defaultVal) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? defaultVal; } catch (e) { return defaultVal; }
}

// --- 📦 GLOBAL STATE ---
var currentUser = null;
var selectedMood = 3;
var chartData = [];
var allUsersMap = {};
var globalAppUsers = [];
var globalFeedData = [];

var appNotifications = [];
var configNotifications = [];
var serverErrorMessage = '';

var CATEGORY_ICONS = {
    activity: '🎉', training: '📚', welfare: '❤️',
    meeting: '💼', holiday: '🏖️', general: '📢'
};
var CATEGORY_COLORS = {
    activity: '#6c5ce7', training: '#0984e3', welfare: '#e84393',
    meeting: '#00b894', holiday: '#fdcb6e', general: '#636e72'
};

// --- 🔒 ROLE PERMISSION SYSTEM (5 Levels) ---
const ROLE_MAP = {
    'Admin': 1, 'ผู้ดูแลระบบ': 1, 'admin': 1,
    'Manager': 2, 'ผู้บริหาร': 2, 'manager': 2,
    'Committee': 2, 'กรรมการ': 2, 'committee': 2,
    'NewsEditor': 3, 'บรรณาธิการข่าว': 3, 'newseditor': 3, 'officer': 3, 'เจ้าหน้าที่': 3,
    'Staff': 4, 'พนักงาน': 4, 'staff': 4,
    'Guest': 5, 'ผู้เยี่ยมชม': 5, 'guest': 5, 'ผู้เข้าใหม่': 5
};

function getUserLevel(user) {
    if (!user) return 5;
    if (user.status === 'waiting_approval' || String(user.role || '').toLowerCase().trim() === 'guest') return 5;
    const role = String(user.role || '').toLowerCase().trim();
    if (!role) return 5; // Default to Level 5 (Guest) for new users

    for (const key in ROLE_MAP) {
        if (role === key.toLowerCase()) return ROLE_MAP[key];
    }
    for (const key in ROLE_MAP) {
        if (role.includes(key.toLowerCase())) return ROLE_MAP[key];
    }
    return 5; // Default to Guest if role exists but not matched
}

// 🌟 Helpers: ตรวจสอบสถานะและสิทธิ์
const isAlumni = (r) => {
    const roleStr = String(r || '').toLowerCase();
    const keywords = ['ศิษย์เก่า', 'alumni', 'ลาออก', 'ย้าย', 'เกษียณ', 'อนุสรณ์', 'retired', 'memorial', 'ผู้ร่วมผูกพัน', 'ทำเนียบ', 'hall of fame'];
    return keywords.some(k => roleStr.includes(k.toLowerCase()));
};
const isGuest = (r) => {
    const roleStr = String(r || '').toLowerCase();
    const guestKeywords = ['guest', 'ผู้เยี่ยมชม', 'ผู้เข้าใหม่', 'แขก'];
    return guestKeywords.some(k => roleStr.includes(k.toLowerCase()));
};
const isCommittee = (r) => {
    const roleStr = String(r || '').toLowerCase();
    return roleStr.includes('committee') || roleStr.includes('กรรมการ');
};
const shouldIncludeInStats = (r) => {
    return !isAlumni(r) && !isGuest(r) && !isCommittee(r);
};

const canManageSystem = () => getUserLevel(currentUser) <= 2; // Admin & Manager can manage others
const canViewDashboard = () => getUserLevel(currentUser) <= 2;
const canPostNews = () => getUserLevel(currentUser) <= 3;
const canPostStory = () => getUserLevel(currentUser) <= 4;

function getManagedHouseCodes(user = currentUser) {
    if (!user) return [];
    const primaryHouse = String(user.groupCode || user.GroupCode || '').trim().toUpperCase();
    let virtueStats = user.virtueStats || user.VirtueStats || {};
    if (typeof virtueStats === 'string') {
        try { virtueStats = JSON.parse(virtueStats); } catch (e) { virtueStats = {}; }
    }
    const extraHouses = Array.isArray(virtueStats._managedHouses)
        ? virtueStats._managedHouses
        : [];

    return [...new Set([primaryHouse, ...extraHouses]
        .map(code => String(code || '').trim().toUpperCase())
        .filter(Boolean))];
}

function getActiveHouseCode(user = currentUser) {
    const houses = getManagedHouseCodes(user);
    if (houses.length === 0) return '';
    const userId = user?.userId || user?.lineId || 'anonymous';
    const selected = String(safeGetItem(`active_managed_house_${userId}`) || '').trim().toUpperCase();
    return houses.includes(selected) ? selected : houses[0];
}

function setActiveHouseCode(houseCode, user = currentUser) {
    const normalized = String(houseCode || '').trim().toUpperCase();
    if (!normalized || !getManagedHouseCodes(user).includes(normalized)) return false;
    const userId = user?.userId || user?.lineId || 'anonymous';
    safeSetItem(`active_managed_house_${userId}`, normalized);
    return true;
}

// --- 🔧 FEED STATE ---
function isAggregateHouseView(user = currentUser) {
    const code = getActiveHouseCode(user);
    return code === 'HQ' || code === 'ALL';
}

function getActivityHouseCode(activity, usersById = allUsersMap) {
    let metadata = activity?.JSON || activity?.interactions || {};
    if (typeof metadata === 'string') {
        try { metadata = JSON.parse(metadata); } catch (e) { metadata = {}; }
    }
    const explicitHouse = String(activity?.houseCode || metadata?.houseCode || '').trim().toUpperCase();
    if (explicitHouse) return explicitHouse;

    const ownerId = String(activity?.UserId || activity?.user_line_id || activity?.userId || '').trim();
    const owner = usersById instanceof Map ? usersById.get(ownerId) : usersById?.[ownerId];
    return String(owner?.GroupCode || owner?.groupCode || owner?.group_code || '').trim().toUpperCase();
}

function isActivityForHouse(activity, houseCode, usersById = allUsersMap) {
    const normalizedHouse = String(houseCode || '').trim().toUpperCase();
    if (!normalizedHouse || normalizedHouse === 'HQ' || normalizedHouse === 'ALL') return true;
    return getActivityHouseCode(activity, usersById) === normalizedHouse;
}

let currentFeedFilter = 'all';
let globalUserStatsMap = {};
let globalManagerHouseCode = '';
let managerDataRequestId = 0;
let userCacheRequestId = 0;
let feedDataRequestId = 0;
let rewardDataRequestId = 0;
let currentFeedLimit = 10; // ดึงมาแค่ 10 รายการแรกก่อน (ตามคำขอ: ดึงเพิ่มเมื่อเปิดเท่านั้น)

// --- Image Upload State ---
let renderedPostIds = new Set();
let currentImageFiles = [];
let selectedImageBase64 = null;
let isFetchingFeed = false;

// --- 🏅 BADGE CONFIG ---
const badgeConfig = {
    'volunteer': {
        title: 'จิตอาสา',
        levels: [
            { count: 1, rank: 'มือใหม่', icon: '🌱', desc: 'เริ่มต้นทำดีครั้งแรก' },
            { count: 5, rank: 'ผู้ให้', icon: '🤝', desc: 'ช่วยเหลือผู้อื่นครบ 5 ครั้ง' },
            { count: 20, rank: 'ใจบุญ', icon: '💖', desc: 'สะสมแต้มบุญครบ 20 ครั้ง' },
            { count: 50, rank: 'นักบุญ', icon: '😇', desc: 'อุทิศตนเพื่อสังคม' },
            { count: 100, rank: 'เทวดาเดินดิน', icon: '🪽', desc: 'สุดยอดผู้เสียสละ (100 ครั้ง)' }
        ]
    },
    'sufficiency': {
        title: 'พอเพียง',
        levels: [
            { count: 1, rank: 'เริ่มต้น', icon: '💧', desc: 'เริ่มวิถีพอเพียง' },
            { count: 10, rank: 'ประหยัด', icon: '🐷', desc: 'รู้จักออมและใช้เท่าที่จำเป็น' },
            { count: 50, rank: 'สมถะ', icon: '🧘', desc: 'ใช้ชีวิตอย่างเรียบง่าย' },
            { count: 100, rank: 'ปราชญ์', icon: '🌾', desc: 'ผู้นำวิถีพอเพียงตัวจริง' }
        ]
    },
    'discipline': {
        title: 'วินัย',
        levels: [
            { count: 1, rank: 'ฝึกฝน', icon: '👟', desc: 'เริ่มรักษาวินัย' },
            { count: 10, rank: 'ตรงต่อเวลา', icon: '⏰', desc: 'รักษาเวลาดีเยี่ยม 10 ครั้ง' },
            { count: 50, rank: 'แบบอย่าง', icon: '⚖️', desc: 'เป็นแบบอย่างด้านวินัย' },
            { count: 100, rank: 'จอมทัพ', icon: '💂', desc: 'วินัยเหล็กดุจทหารกล้า' }
        ]
    },
    'integrity': {
        title: 'สุจริต',
        levels: [
            { count: 1, rank: 'จริงใจ', icon: '🤍', desc: 'พูดจริงทำจริง' },
            { count: 10, rank: 'โปร่งใส', icon: '🔍', desc: 'ตรวจสอบได้เสมอ' },
            { count: 50, rank: 'ตงฉิน', icon: '🛡️', desc: 'ยึดมั่นในความถูกต้อง' },
            { count: 100, rank: 'เปาบุ้นจิ้น', icon: '⚖️', desc: 'สัญลักษณ์แห่งความยุติธรรม' }
        ]
    },
    'gratitude': {
        title: 'กตัญญู',
        levels: [
            { count: 1, rank: 'ระลึกคุณ', icon: '💭', desc: 'ไม่ลืมผู้มีพระคุณ' },
            { count: 10, rank: 'ตอบแทน', icon: '🎁', desc: 'ตอบแทนคุณคน 10 ครั้ง' },
            { count: 50, rank: 'กตเวที', icon: '🙇', desc: 'ผู้รู้คุณคนอย่างลึกซึ้ง' },
            { count: 100, rank: 'อภิชาตบุตร', icon: '👑', desc: 'ยอดคนกตัญญู' }
        ]
    },
    'rich_score': {
        title: 'ระดับความดี', source: 'score',
        levels: [
            { count: 100, rank: 'Newbie', icon: '🥉', desc: 'สะสมครบ 100 คะแนน' },
            { count: 500, rank: 'Rookie', icon: '🥈', desc: 'สะสมครบ 500 คะแนน' },
            { count: 1000, rank: 'Pro', icon: '🥇', desc: 'สะสมครบ 1,000 คะแนน' },
            { count: 5000, rank: 'Elite', icon: '🏆', desc: 'สะสมครบ 5,000 คะแนน' },
            { count: 10000, rank: 'Legend', icon: '👑', desc: 'ตำนาน (10,000 คะแนน)' },
            { count: 50000, rank: 'Immortal', icon: '🦄', desc: 'อมตะ (50,000 คะแนน)' }
        ]
    },
    'active_total': {
        title: 'ความขยัน', source: 'total',
        levels: [
            { count: 10, rank: 'Active', icon: '🏃', desc: 'บันทึกกิจกรรมครบ 10 ครั้ง' },
            { count: 50, rank: 'Super', icon: '🚀', desc: 'บันทึกกิจกรรมครบ 50 ครั้ง' },
            { count: 100, rank: 'Hyper', icon: '⚡', desc: 'บันทึกกิจกรรมครบ 100 ครั้ง' },
            { count: 365, rank: 'Daily Hero', icon: '📅', desc: 'ทำความดีต่อเนื่อง 365 ครั้ง!' }
        ]
    }
};

// บันทึก GAS_URL ให้หน้าอื่นใช้งาน (เช่น survey.html)
safeSetItem('GAS_URL', GAS_URL);

// Dark Mode Observer
const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
        if (m.attributeName === 'data-theme') {
            if (window.myRadarChart) initUserRadar();
            if (document.getElementById('page-manager')?.classList.contains('active')) {
                if (typeof renderManagerChart === 'function') renderManagerChart();
                if (typeof renderTRDChart === 'function') {
                    const users = Object.values(globalUserStatsMap || {});
                    if (users.length > 0) renderTRDChart(users);
                }
            }
        }
    });
});
themeObserver.observe(document.documentElement, { attributes: true });


