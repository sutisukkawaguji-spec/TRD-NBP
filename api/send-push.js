// ไฟล์: api/send-push.js

export default async function handler(req, res) {
    // 1. อนุญาตให้เรียกใช้งานจากหน้าเว็บได้ (CORS)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // 2. ถ้าเป็นคำสั่งเช็คสถานะก่อนส่ง (OPTIONS) ให้ตอบกลับทันที
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 3. รับเฉพาะคำสั่งแบบ POST เท่านั้น
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // 4. ดึงข้อมูลที่หน้าเว็บ (app.js) ส่งมาให้
        const { title, message, url } = req.body;

        // 5. ดึงกุญแจลับจากระบบของ Vercel (ดึงจากหน้า Settings > Environment Variables)
        const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
        const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

        // ตรวจสอบว่าใส่คีย์ไว้หรือยัง
        if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
            console.error("Missing OneSignal credentials in Vercel settings.");
            return res.status(500).json({ error: "OneSignal API keys are missing." });
        }

        // 6. เตรียมข้อมูลที่จะยิงไป OneSignal
        const onesignalPayload = {
            app_id: ONESIGNAL_APP_ID,
            included_segments: ['Subscribed Users'], // ส่งให้ทุกคนที่กดติดตาม
            headings: { "en": title || "การแจ้งเตือนใหม่", "th": title || "การแจ้งเตือนใหม่" },
            contents: { "en": message || "มีเรื่องราวใหม่เข้ามา", "th": message || "มีเรื่องราวใหม่เข้ามา" },
            url: url || "https://trd-nbp.vercel.app" // ลิงก์ตอนที่คนกดแจ้งเตือน
        };

        // 7. ยิงคำสั่งไปหา OneSignal
        const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}` // ใช้คีย์ลับเพื่อยืนยันตัวตน
            },
            body: JSON.stringify(onesignalPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.errors ? data.errors[0] : "OneSignal API Error");
        }

        // 8. แจ้งกลับหน้าเว็บว่าทำสำเร็จแล้ว
        return res.status(200).json({ success: true, message: "Push notification sent!", data });

    } catch (error) {
        console.error("Error sending push:", error);
        return res.status(500).json({ error: "Failed to send notification.", details: error.message });
    }
}