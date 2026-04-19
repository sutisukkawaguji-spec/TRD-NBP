// --- 🏢 System Configuration & What's New ---
var systemConfig = {
    version: "3.3.0", 
    title: "🚀 อัปเกรดฟีเจอร์ใหม่: รายงานสภาพอากาศและระบบจัดการรูปภาพ",
    message: "<div class='text-start' style='font-size:0.85rem;line-height:1.6;'>" +
             "<span class='badge bg-success mb-2'>Version 3.3.0</span><br>" +
             "✅ <b>Real-time Weather:</b> ตรวจสอบสภาพอากาศและค่าฝุ่น PM 2.5 ได้ทันทีใต้รูปโปรไฟล์ เพื่อการวางแผนดูแลสุขภาพที่ดีขึ้น<br>" +
             "✅ <b>Story Expand:</b> ขยายขีดจำกัดการแบ่งปันเรื่องราว! อัปโหลดรูปภาพได้สูงสุดถึง <b class='text-primary'>20 ภาพ</b> ต่อหนึ่งโพสต์<br>" +
             "✅ <b>Drag & Drop Reordering:</b> จัดระเบียบรูปภาพในโหมดแก้ไขได้ดั่งใจ เพียงลากและวางเพื่อเรียงลำดับเรื่องราวของคุณ<br>" +
             "<hr class='my-2'>" +
             "<p class='text-muted small mb-0'>เรามุ่งมั่นพัฒนาระบบเพื่อบันทึกทุกเรื่องราวความดีของคุณให้สมบูรณ์แบบที่สุด</p></div>"
};

// --- 🌐 ENV SETTINGS ---
const TEST_ENV = true; // 🔴 เปลี่ยนเป็น false เมื่อขึ้นระบบจริง
const TEST_GAS_URL = 'https://script.google.com/macros/s/AKfycbzx43HHaxF_Z9_Kf6441lr3rJqdsaMljo-7OtfCPMxlVl7GkI9O3Fv4cWIb_SRAJ3RfTQ/exec';
const TEST_LIFF_ID = '2009329360-XeHfjaTY';
const PROD_GAS_URL = 'YOUR_PROD_GAS_URL_HERE';
const PROD_LIFF_ID = 'YOUR_PROD_LIFF_ID_HERE';

const GAS_URL = TEST_ENV ? TEST_GAS_URL : PROD_GAS_URL;
const LIFF_ID = TEST_ENV ? TEST_LIFF_ID : PROD_LIFF_ID;
