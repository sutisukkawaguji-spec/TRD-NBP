# 📦 JS Module Files — Dee Mee Suk

โฟลเดอร์นี้แยกโค้ด JavaScript ออกจาก `index.html` เพื่อให้ maintain ได้ง่ายขึ้น

## โครงสร้างไฟล์

| ไฟล์ | เนื้อหา | ขนาดโดยประมาณ |
|------|---------|----------------|
| `config.js` | ENV settings, safeStorage, globals, badgeConfig, roles | ~120 บรรทัด |
| `auth.js`   | LIFF init, main(), checkUser(), registerUser(), doLineLogin() | ~130 บรรทัด |
| `feed.js`   | fetchFeed(), render, filter, reactions, verify, delete, edit | ~280 บรรทัด |
| `app.js`    | UI, tabs, forms, charts, notifications (TODO) | - |

---

## ⚠️ สำหรับ Google Apps Script Deployment

GAS Web App **ไม่สามารถ serve `.js` files แยกได้** โดยตรง

### วิธีที่ 1: รวมกลับเป็น 1 ก้อน (ง่ายสุด)

Copy โค้ดจากทุกไฟล์ JS แล้ววางต่อกันใน `<script>` เดียวใน `index.html`

```html
<script>
    // config.js content here...
    // auth.js content here...
    // feed.js content here...
    // app.js content here...
</script>
```

### วิธีที่ 2: GAS HTML Include (แนะนำสำหรับ GAS)

1. สร้างไฟล์ใหม่บน GAS Editor:
   - `config_js.html` → วาง `<script>` + โค้ดจาก `config.js`
   - `auth_js.html`   → วาง `<script>` + โค้ดจาก `auth.js`
   - `feed_js.html`   → วาง `<script>` + โค้ดจาก `feed.js`

2. เพิ่มใน `cod.gs`:
```javascript
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

3. ใน `index.html` แทนที่ `<script src="...">` ด้วย:
```html
<?!= include('config_js') ?>
<?!= include('auth_js') ?>
<?!= include('feed_js') ?>
```

### วิธีที่ 3: Host บน GitHub Pages (ดีสุดระยะยาว)

Host ทั้งโปรเจกต์บน GitHub Pages แล้วใช้ link เต็ม:
```html
<script src="https://yourusername.github.io/dee-mee-suk/js/config.js"></script>
```

---

## ลำดับการโหลด (สำคัญมาก!)

```
1. config.js  → ต้องโหลดก่อนสุด (กำหนด globals ทั้งหมด)
2. auth.js    → ต้องการ safeSetItem, safeGetItem จาก config.js
3. feed.js    → ต้องการ currentUser, GAS_URL จาก config.js
4. app.js     → ต้องการทุกอย่างข้างต้น
```
