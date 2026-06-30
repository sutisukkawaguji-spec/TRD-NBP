import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function parseStats(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object") return { ...(value as Record<string, unknown>) };
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

function isAdminRole(role: unknown) {
  const value = String(role || "").toLowerCase().replace(/\s+/g, "");
  const adminKeywords = [
    "admin",
    "manager",
    "superadmin",
    "owner",
    "\u0e1c\u0e39\u0e49\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23", // ผู้จัดการ
    "\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23", // จัดการ
    "\u0e1c\u0e39\u0e49\u0e14\u0e39\u0e41\u0e25", // ผู้ดูแล
    "\u0e14\u0e39\u0e41\u0e25", // ดูแล
    "\u0e1c\u0e39\u0e49\u0e1a\u0e23\u0e34\u0e2b\u0e32\u0e23", // ผู้บริหาร
    "\u0e1a\u0e23\u0e34\u0e2b\u0e32\u0e23", // บริหาร
  ];
  return adminKeywords.some((keyword) => value.includes(keyword));
}

function getSettingItem(notifications: unknown) {
  return Array.isArray(notifications)
    ? notifications.find((item) => item && typeof item === "object" && (item as any).type === "_aiPostSettings")
    : null;
}

function getUserSettingItem(users: Array<Record<string, unknown>> | null | undefined) {
  for (const row of users || []) {
    const stats = parseStats(row.VirtueStats);
    if (stats._aiPostSettings && typeof stats._aiPostSettings === "object") {
      return stats._aiPostSettings as Record<string, unknown>;
    }
  }
  return null;
}

async function getCryptoKey(secret: string) {
  const bytes = new TextEncoder().encode(secret || "fallback-ai-post-secret");
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function encryptSecret(secretValue: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getCryptoKey(secret);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(secretValue),
  );
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(encrypted)) };
}

async function decryptSecret(payload: any, secret: string) {
  if (!payload?.iv || !payload?.data) return "";
  const key = await getCryptoKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.iv) },
    key,
    fromBase64(payload.data),
  );
  return new TextDecoder().decode(decrypted);
}

async function verifyLineIdentity(idToken: string, clientId: string) {
  if (!idToken || !clientId) return "";
  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description || "ยืนยันตัวตน LINE ไม่สำเร็จ");
  return String(data?.sub || "");
}

function detectProvider(apiKey: string, requestedProvider = "") {
  const provider = String(requestedProvider || "").toLowerCase();
  if (provider === "openai" || provider === "gemini") return provider;
  return apiKey.startsWith("sk-") ? "openai" : "gemini";
}

function stripCodeFence(value: string) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json|JSON)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonPayload(value: string) {
  const text = stripCodeFence(value);
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function unescapeAiText(value: string) {
  return String(value || "")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

function extractTextField(value: string) {
  const text = stripCodeFence(value);
  const match = text.match(/"text"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"virtue"|"\s*\}|"\s*$|$)/i);
  return match ? unescapeAiText(match[1]) : "";
}

function extractLabeledValue(value: string, labelPattern: RegExp) {
  const match = String(value || "").match(labelPattern);
  return match ? String(match[1] || "").trim() : "";
}

function extractAiPostResult(rawValue: string, categories: string[]) {
  const cleaned = stripCodeFence(rawValue);
  const parsed = extractJsonPayload(cleaned);
  let text = String(parsed?.text || "").trim();
  let virtue = String(parsed?.virtue || "").trim();

  if (!text) text = extractTextField(cleaned);

  if (!virtue) {
    virtue = extractLabeledValue(
      cleaned,
      /(?:หมวด|หัวข้อความดี|virtue|category)\s*[:：]\s*(volunteer|sufficiency|discipline|integrity|gratitude)/i,
    );
  }

  if (!text) {
    const textLabelMatch = cleaned.match(/(?:ข้อความ|text)\s*[:：]\s*([\s\S]*)/i);
    text = textLabelMatch ? String(textLabelMatch[1] || "").trim() : cleaned;
  }

  text = stripCodeFence(text)
    .replace(/^\{\s*/g, "")
    .replace(/^"text"\s*:\s*"?/i, "")
    .replace(/",?\s*"virtue"\s*:\s*"(volunteer|sufficiency|discipline|integrity|gratitude)"\s*\}?$/i, "")
    .replace(/\}\s*$/g, "")
    .trim();

  const suggestedVirtue = categories.includes(virtue) ? virtue : "";
  return { text, suggestedVirtue };
}

function normalizeUserDraft(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:ช่วย)?(?:เขียน|เขีน)\s*(?:โพสต์|โพส|post)\s*/i, "")
    .replace(/^(?:ช่วย)?(?:แต่ง|เรียบเรียง)\s*(?:ข้อความ|โพสต์|โพส)?\s*/i, "")
    .replace(/ปลุก/g, "ปลูก")
    .replace(/กลางวัล|กลางว้น/g, "กลางวัน")
    .trim();
}

async function generateWithOpenAI(apiKey: string, prompt: string) {
  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a careful Thai writing assistant for workplace activity posts. Follow the requested plain text format exactly." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  const aiJson = await aiResponse.json();
  if (!aiResponse.ok) {
    throw new Error(aiJson?.error?.message || "OpenAI API ใช้งานไม่ได้");
  }
  return String(aiJson?.choices?.[0]?.message?.content || "").trim();
}

async function generateWithGemini(apiKey: string, prompt: string) {
  const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    }),
  });

  const aiJson = await aiResponse.json();
  if (!aiResponse.ok) {
    throw new Error(aiJson?.error?.message || "Gemini API ใช้งานไม่ได้");
  }
  return String(aiJson?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const encryptionSecret = Deno.env.get("AI_SETTINGS_SECRET") || serviceRoleKey;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const authHeader = req.headers.get("Authorization") || "";
    const headerToken = authHeader.replace(/^Bearer\s+/i, "");
    const bodyToken = String(body.accessToken || "").trim();
    const token = bodyToken || headerToken;
    let authUserId = "";
    let authUsername = "";
    if (token) {
      const { data: authData } = await admin.auth.getUser(token);
      authUserId = authData.user?.id || "";
      authUsername = String(authData.user?.email || "").split("@")[0].trim().toLowerCase();
    }
    const bodyLineId = String(body.lineId || "").trim();
    const bodyUsername = String(body.username || "").trim().toLowerCase();
    const bodyRole = String(body.role || "");
    const passwordAdminHint = body.hasPasswordSession === true && isAdminRole(bodyRole);

    let verifiedLineId = "";
    if (!authUserId && body.lineIdToken && body.lineClientId) {
      verifiedLineId = await verifyLineIdentity(String(body.lineIdToken), String(body.lineClientId));
      if (body.lineId && verifiedLineId && String(body.lineId) !== verifiedLineId) {
        return json({ error: "บัญชี LINE ไม่ตรงกับผู้ใช้ปัจจุบัน" });
      }
    }

    if (!authUserId && !verifiedLineId && !passwordAdminHint) {
      return json({ error: "กรุณาเข้าสู่ระบบก่อน หรือเปิดผ่าน LINE เพื่อยืนยันตัวตน" });
    }

    const { data: users, error: usersError } = await admin
      .from("Users")
      .select("LineID, EmployeeID, Name, Role, VirtueStats");
    if (usersError) throw usersError;

    const findMatchingRow = () => (users || []).find((row) => {
      const stats = parseStats(row.VirtueStats);
      const rowUsername = String(stats._username || row.EmployeeID || "").trim().toLowerCase();
      const rowLineId = String(row.LineID || "").trim().toLowerCase();
      const rowEmployeeId = String(row.EmployeeID || "").trim().toLowerCase();
      const requestedId = bodyLineId.toLowerCase();
      return String(stats._authUserId || "") === authUserId ||
        (!!authUsername && rowUsername === authUsername) ||
        (!!bodyUsername && rowUsername === bodyUsername) ||
        (!!requestedId && (rowLineId === requestedId || rowEmployeeId === requestedId)) ||
        (!!verifiedLineId && rowLineId === verifiedLineId.toLowerCase());
    });

    const currentRow = findMatchingRow();
    const passwordAdminOverride = (!!authUserId || passwordAdminHint) && isAdminRole(bodyRole);
    const overrideRow = passwordAdminOverride
      ? { LineID: bodyLineId || bodyUsername || authUsername || authUserId, Role: bodyRole, VirtueStats: {} }
      : null;
    let effectiveRow = (passwordAdminOverride && (!currentRow || !isAdminRole(currentRow.Role)))
      ? overrideRow
      : (currentRow || overrideRow);

    if (!effectiveRow) return json({ error: `ไม่พบบัญชีผู้ใช้ (username: ${authUsername || bodyUsername || "-"}, lineId: ${bodyLineId || "-"})` });

    const action = String(body.action || "");
    const setting = getUserSettingItem(users as Array<Record<string, unknown>>);

    if (action === "status") {
      if (!isAdminRole(effectiveRow.Role)) return json({ error: `ไม่มีสิทธิ์ตั้งค่า AI (Role: ${effectiveRow.Role || "-"})` });
      return json({ success: true, configured: !!setting?.encrypted });
    }

    if (action === "save-key" || action === "delete-key") {
      if (!isAdminRole(effectiveRow.Role)) return json({ error: `ไม่มีสิทธิ์ตั้งค่า AI (Role: ${effectiveRow.Role || "-"})` });
      const ownerRow = currentRow || (users || []).find((row) => isAdminRole(row.Role));
      if (!ownerRow?.LineID) return json({ error: "ไม่พบแถวผู้ดูแลสำหรับบันทึกค่า AI" });
      const ownerStats = parseStats(ownerRow.VirtueStats);

      if (action === "save-key") {
        const apiKey = String(body.apiKey || "").trim();
        const provider = detectProvider(apiKey, body.provider);
        if (/^https?:\/\//i.test(apiKey) || apiKey.includes("generativelanguage.googleapis.com")) {
          return json({ error: "ช่องนี้ต้องวาง API key เท่านั้น ไม่ใช่ URL หรือชื่อโมเดล" });
        }
        if (apiKey.length < 20) return json({ error: "รูปแบบ API key ไม่ถูกต้อง" });
        const encrypted = await encryptSecret(apiKey, encryptionSecret);
        ownerStats._aiPostSettings = {
          provider,
          encrypted,
          updatedAt: new Date().toISOString(),
          updatedBy: effectiveRow.LineID,
        };
      } else {
        delete ownerStats._aiPostSettings;
      }

      const { error } = await admin
        .from("Users")
        .update({ VirtueStats: ownerStats })
        .eq("LineID", ownerRow.LineID);
      if (error) throw error;
      return json({ success: true, configured: action === "save-key" });
    }

    if (action === "generate") {
      if (!setting?.encrypted) return json({ error: "ยังไม่ได้ตั้งค่า AI API key กรุณาให้ Admin ตั้งค่าก่อน" });
      const apiKey = await decryptSecret(setting.encrypted, encryptionSecret);
      const provider = detectProvider(apiKey, setting.provider);
      const draft = normalizeUserDraft(String(body.draft || "").trim()).slice(0, 1200);
      if (!draft) return json({ error: "กรุณาพิมพ์ข้อความตั้งต้นก่อน" });

      const virtue = String(body.virtue || "");
      const mood = String(body.mood || "");
      const categories = [
        "volunteer",
        "sufficiency",
        "discipline",
        "integrity",
        "gratitude",
      ];
      const prompt = [
        "คุณคือผู้ช่วยเขียนโพสต์กิจกรรมภาษาไทย ให้แปลงข้อความของผู้ใช้เป็นโพสต์กิจกรรมที่อ่านลื่นไหล อบอุ่น และเป็นธรรมชาติ",
        "ถ้าผู้ใช้พิมพ์เหมือนคำสั่ง เช่น ช่วยเขียนโพส, ช่วยแต่งโพสต์, ช่วยเรียบเรียง ให้ถือว่าเป็นคำสั่ง ไม่ใช่เนื้อหาโพสต์",
        "แก้คำผิดเล็กน้อยได้ เช่น เขีน=เขียน, ปลุก=ปลูก, กลางวัล=กลางวัน แต่ห้ามเปลี่ยนความหมายของกิจกรรม",
        "ต้องรักษาสาระสำคัญจากข้อความเดิมให้ครบ เช่น กิจกรรม สถานที่ วัตถุประสงค์ เวลา โอกาสสำคัญ และสิ่งที่นำไปใช้",
        "ห้ามตัดรายละเอียดสำคัญออก ห้ามแต่งข้อมูลใหม่เกินจริง และห้ามเติมประโยคแข็ง ๆ แบบสรุปท้าย",
        "เขียนให้เป็นโพสต์เดียวที่สมบูรณ์ 4-6 ประโยค จบประโยคครบ อ่านเหมือนกิจกรรมจริงของหน่วยงาน",
        "ตัวอย่าง: 'ช่วยเขียนโพส เก็บผักสำนักงานที่ปลูกเพื่อมาทำอาหารกลางวัน' ให้เขียนว่ามีการเก็บผักจากแปลงผักของสำนักงานเพื่อนำมาประกอบอาหารกลางวัน โดยไม่ใส่คำว่า 'ช่วยเขียนโพส' ในผลลัพธ์",
        "ตัวอย่าง: 'ร่วมกันทำความสะอาดสำนักงานเนื่องด้วยวัน 5 ส.' ต้องพูดถึงการทำความสะอาดสำนักงานและวัน 5 ส. อย่างเป็นธรรมชาติในเนื้อหาเดียวกัน",
        "เลือกหมวดความดีที่เหมาะที่สุดเพียง 1 หมวดจากรายการนี้: volunteer, sufficiency, discipline, integrity, gratitude",
        "แนวทางหมวด: volunteer=จิตอาสา/ช่วยเหลือผู้อื่น, sufficiency=พอเพียง/ประหยัด/ใช้ทรัพยากรคุ้มค่า, discipline=วินัย/ตรงต่อเวลา/ทำตามกติกา, integrity=สุจริต/โปร่งใส/รับผิดชอบ, gratitude=กตัญญู/ขอบคุณ/ตอบแทนบุญคุณ",
        `หมวดที่ผู้ใช้เลือกไว้เดิม: ${virtue || "ยังไม่เลือก"}`,
        `อารมณ์ผู้โพส: ${mood || "ไม่ระบุ"}`,
        `ข้อความตั้งต้น: ${draft}`,
        "ตอบกลับตามรูปแบบนี้เท่านั้น ห้ามใส่ JSON ห้ามใส่ ```",
        "หมวด: <หนึ่งใน volunteer/sufficiency/discipline/integrity/gratitude>",
        "ข้อความ:",
        "<ข้อความโพสที่เรียบเรียงแล้ว>",
      ].join("\n");

      const rawText = provider === "gemini"
        ? await generateWithGemini(apiKey, prompt)
        : await generateWithOpenAI(apiKey, prompt);
      const { text, suggestedVirtue } = extractAiPostResult(rawText, categories);
      return json({ success: true, text, suggestedVirtue });
    }

    return json({ error: "Unknown action" });
  } catch (error) {
    console.error(error);
    return json({ error: errorMessage(error) }, 500);
  }
});
