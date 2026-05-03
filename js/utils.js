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
const getDominantVirtueLabel = (stats) => {
    if (!stats) return { label: 'เตรียมพร้อม', color: '#95a5a6', key: 'none' };
    const mapping = {
        volunteer: { label: 'จิตอาสา', color: '#3498db', key: 'volunteer' },
        sufficiency: { label: 'พอเพียง', color: '#2ecc71', key: 'sufficiency' },
        discipline: { label: 'มีวินัย', color: '#9b59b6', key: 'discipline' },
        integrity: { label: 'สุจริต', color: '#1abc9c', key: 'integrity' },
        gratitude: { label: 'กตัญญู', color: '#e84393', key: 'gratitude' }
    };

    let maxKey = 'none', maxVal = -1;
    Object.keys(mapping).forEach(k => {
        const val = stats[k] || stats[k.charAt(0).toUpperCase() + k.slice(1)] || 0;
        if (val > maxVal) { maxVal = val; maxKey = k; }
    });

    if (maxVal <= 0) return { label: 'เพิ่งเริ่มต้น', color: '#95a5a6', key: 'none' };
    return mapping[maxKey];
};

const getVirtueDescription = (virtueKey) => {
    const desc = {
        volunteer: `ชอบช่วยเหลือผู้อื่นโดยไม่หวังผลตอบแทน มักอาสาในทุกกิจกรรมของทีม เป็นพลังบวกที่ทำให้เพื่อนร่วมงานมีความสุข`,
        sufficiency: `ยึดถือแนวทางความพอเพียง มีการวางแผนและใช้ทรัพยากรได้อย่างคุ้มค่า เป็นแบบอย่างที่ดีในการดำเนินชีวิต`,
        discipline: `มีความเป็นระเบียบวินัยสูง ตรงต่อเวลา และเคารพกฎกติกาอย่างเคร่งครัด สม่ำเสมอในการสร้างสรรค์ผลงาน`,
        integrity: `เป็นคนซื่อสัตย์สุจริต ยึดมั่นในความถูกต้องและโปร่งใส เป็นที่ไว้วางใจของเพื่อนพนักงานและองค์กรเสมอ`,
        gratitude: `มีความกตัญญูรู้คุณคน มีสัมมาคารวะและมักขอบคุณในความช่วยเหลือจากผู้อื่น สร้างบรรยากาศที่เกื้อกูลกันในทีม`
    };
    return desc[virtueKey] || 'กำลังมุ่งมั่นสะสมพลังความดีในด้านต่างๆ เพื่อเป็นพลังที่ยอดเยี่ยมให้แก่องค์กรในอนาคต';
};

const getActivityRange = (uid) => {
    const userStat = (window.globalUserStatsMap && window.globalUserStatsMap[uid]) || (window.allUsersMap && window.allUsersMap[uid]);
    let firstDate = null;

    if (userStat && userStat.firstActive) {
        firstDate = new Date(userStat.firstActive);
    } else if (window.globalFeedData && window.globalFeedData.length > 0) {
        const userPosts = window.globalFeedData.filter(p => String(p.user_line_id) === String(uid));
        if (userPosts.length > 0) {
            const sorted = userPosts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            firstDate = new Date(sorted[0].timestamp);
        }
    }

    if (!firstDate || isNaN(firstDate.getTime())) {
        return (userStat && (userStat.postsMade > 0 || userStat.totalCount > 0)) ? 'มีประวัติกิจกรรมแล้ว' : 'ยังไม่ได้บันทึกกิจกรรม';
    }

    const fmt = (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
    return `ประวัติกิจกรรม: ${fmt(firstDate)} ถึงปัจจุบัน`;
};
const getUserLevel = (user) => {
    if (!user) return 5;
    const r = (user.role || 'Guest').toLowerCase();
    if (r === 'admin') return 1;
    if (r === 'manager' || r === 'ผู้บริหาร' || r === 'ผอ.' || r === 'หัวหน้า') return 2;
    if (r === 'staff' || r === 'officer' || r === 'newseditor') return 3;
    if (r === 'guest' || isGuest(r)) return 4;
    return 5;
};

const canManageSystem = () => {
    if (!window.currentUser) return false;
    const level = getUserLevel(window.currentUser);
    return level <= 2;
};
