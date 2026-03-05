// ============================================================
// ⚙️  config.js — Global Settings, Constants & Utilities
//     โหลดก่อนไฟล์อื่นทุกไฟล์
// ============================================================

// --- 🌐 ENV SETTINGS ---
const TEST_ENV    = true; // 🔴 เปลี่ยนเป็น false เมื่อขึ้นระบบจริง
const TEST_GAS_URL  = 'https://script.google.com/macros/s/AKfycbxRvEyRoQaxOUWR_6pTslNmCrM7IiZTRYzDDUtPtDmrhGehUq6zQpfm9MKp_CYzVmrX/exec';
const TEST_LIFF_ID  = '2009329360-XeHfjaTY';
const PROD_GAS_URL  = 'YOUR_PROD_GAS_URL_HERE';
const PROD_LIFF_ID  = 'YOUR_PROD_LIFF_ID_HERE';

const GAS_URL = TEST_ENV ? TEST_GAS_URL : PROD_GAS_URL;
const LIFF_ID = TEST_ENV ? TEST_LIFF_ID : PROD_LIFF_ID;

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
let currentUser      = null;
let selectedMood     = 3;
let chartData        = [];
let allUsersMap      = {};
let globalAppUsers   = [];
let globalFeedData   = [];

var appNotifications    = [];
var configNotifications = [];
var serverErrorMessage  = '';

var CATEGORY_ICONS = {
    activity: '🎉', training: '📚', welfare: '❤️',
    meeting: '💼', holiday: '🏖️', general: '📢'
};
var CATEGORY_COLORS = {
    activity: '#6c5ce7', training: '#0984e3', welfare: '#e84393',
    meeting: '#00b894', holiday: '#fdcb6e', general: '#636e72'
};

// --- 🔒 ROLE PERMISSION SYSTEM (4 Levels) ---
const ROLE_MAP = {
    'ผู้ดูแลระบบ': 1, 'admin': 1, 'superadmin': 1, 'administrator': 1,
    'ผู้บริหาร': 2, 'ผู้อำนวยการ': 2, 'executive': 2, 'manager': 2, 'director': 2, 'supervisor': 2,
    'ผู้จัดการข่าวสาร': 3, 'newseditor': 3, 'editor': 3, 'pr': 3,
};

function getUserLevel(user) {
    if (!user) return 4;
    const role = String(user.role || '').toLowerCase().trim();
    for (const key in ROLE_MAP) {
        if (role === key.toLowerCase()) return ROLE_MAP[key];
    }
    for (const key in ROLE_MAP) {
        if (role.includes(key.toLowerCase())) return ROLE_MAP[key];
    }
    return 4;
}

const canManageSystem  = () => getUserLevel(currentUser) <= 1;
const canViewDashboard = () => getUserLevel(currentUser) <= 2;
const canPostNews      = () => getUserLevel(currentUser) <= 3;

// --- 🔧 FEED STATE ---
let currentFeedFilter  = 'all';
let globalUserStatsMap = {};
let currentFeedLimit   = 10;
let renderedPostIds    = new Set();
let currentImageFiles  = [];
let selectedImageBase64 = null;
let isFetchingFeed     = false;

// --- 🏅 BADGE CONFIG ---
const badgeConfig = {
    'volunteer': {
        title: 'จิตอาสา',
        levels: [
            { count: 1,   rank: 'มือใหม่',       icon: '🌱', desc: 'เริ่มต้นทำดีครั้งแรก' },
            { count: 5,   rank: 'ผู้ให้',         icon: '🤝', desc: 'ช่วยเหลือผู้อื่นครบ 5 ครั้ง' },
            { count: 20,  rank: 'ใจบุญ',          icon: '💖', desc: 'สะสมแต้มบุญครบ 20 ครั้ง' },
            { count: 50,  rank: 'นักบุญ',         icon: '😇', desc: 'อุทิศตนเพื่อสังคม' },
            { count: 100, rank: 'เทวดาเดินดิน',   icon: '🪽', desc: 'สุดยอดผู้เสียสละ (100 ครั้ง)' }
        ]
    },
    'sufficiency': {
        title: 'พอเพียง',
        levels: [
            { count: 1,   rank: 'เริ่มต้น',  icon: '💧', desc: 'เริ่มวิถีพอเพียง' },
            { count: 10,  rank: 'ประหยัด',   icon: '🐷', desc: 'รู้จักออมและใช้เท่าที่จำเป็น' },
            { count: 50,  rank: 'สมถะ',      icon: '🧘', desc: 'ใช้ชีวิตอย่างเรียบง่าย' },
            { count: 100, rank: 'ปราชญ์',    icon: '🌾', desc: 'ผู้นำวิถีพอเพียงตัวจริง' }
        ]
    },
    'discipline': {
        title: 'วินัย',
        levels: [
            { count: 1,   rank: 'ฝึกฝน',      icon: '👟', desc: 'เริ่มรักษาวินัย' },
            { count: 10,  rank: 'ตรงต่อเวลา', icon: '⏰', desc: 'รักษาเวลาดีเยี่ยม 10 ครั้ง' },
            { count: 50,  rank: 'แบบอย่าง',   icon: '⚖️', desc: 'เป็นแบบอย่างด้านวินัย' },
            { count: 100, rank: 'จอมทัพ',     icon: '💂', desc: 'วินัยเหล็กดุจทหารกล้า' }
        ]
    },
    'integrity': {
        title: 'สุจริต',
        levels: [
            { count: 1,   rank: 'จริงใจ',   icon: '🤍', desc: 'พูดจริงทำจริง' },
            { count: 10,  rank: 'โปร่งใส',  icon: '🔍', desc: 'ตรวจสอบได้เสมอ' },
            { count: 50,  rank: 'ตงฉิน',    icon: '🛡️', desc: 'ยึดมั่นในความถูกต้อง' },
            { count: 100, rank: 'เปาบุ้นจิ้น', icon: '⚖️', desc: 'สัญลักษณ์แห่งความยุติธรรม' }
        ]
    },
    'gratitude': {
        title: 'กตัญญู',
        levels: [
            { count: 1,   rank: 'ระลึกคุณ', icon: '💭', desc: 'ไม่ลืมผู้มีพระคุณ' },
            { count: 10,  rank: 'ตอบแทน',   icon: '🎁', desc: 'ตอบแทนคุณคน 10 ครั้ง' },
            { count: 50,  rank: 'กตเวที',   icon: '🙇', desc: 'ผู้รู้คุณคนอย่างลึกซึ้ง' },
            { count: 100, rank: 'อภิชาตบุตร', icon: '👑', desc: 'ยอดคนกตัญญู' }
        ]
    },
    'rich_score': {
        title: 'ระดับความดี', source: 'score',
        levels: [
            { count: 100,   rank: 'Newbie',    icon: '🥉', desc: 'สะสมครบ 100 คะแนน' },
            { count: 500,   rank: 'Rookie',    icon: '🥈', desc: 'สะสมครบ 500 คะแนน' },
            { count: 1000,  rank: 'Pro',       icon: '🥇', desc: 'สะสมครบ 1,000 คะแนน' },
            { count: 5000,  rank: 'Elite',     icon: '🏆', desc: 'สะสมครบ 5,000 คะแนน' },
            { count: 10000, rank: 'Legend',    icon: '👑', desc: 'ตำนาน (10,000 คะแนน)' },
            { count: 50000, rank: 'Immortal',  icon: '🦄', desc: 'อมตะ (50,000 คะแนน)' }
        ]
    },
    'active_total': {
        title: 'ความขยัน', source: 'total',
        levels: [
            { count: 10,  rank: 'Active',     icon: '🏃', desc: 'บันทึกกิจกรรมครบ 10 ครั้ง' },
            { count: 50,  rank: 'Super',      icon: '🚀', desc: 'บันทึกกิจกรรมครบ 50 ครั้ง' },
            { count: 100, rank: 'Hyper',      icon: '⚡', desc: 'บันทึกกิจกรรมครบ 100 ครั้ง' },
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
