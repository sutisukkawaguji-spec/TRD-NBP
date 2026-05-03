// ============================================================
// 🛠️ utils.js — Helper Functions
// ============================================================

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

const shouldIncludeInStats = (r) => {
    return !isAlumni(r) && !isGuest(r);
};

const formatCompactNumber = (val) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M 🔥';
    if (val >= 10000) return (val / 1000).toFixed(0) + 'k ⭐';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
    return val || 0;
};

const formatScore = (num) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return Number.isInteger(num) ? num : num.toFixed(1);
};

function getURLParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
