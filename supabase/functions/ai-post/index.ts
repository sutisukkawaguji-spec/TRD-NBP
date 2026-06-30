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
  const value = String(role || "").toLowerCase();
  return value.includes("admin") ||
    value.includes("manager") ||
    value.includes("superadmin") ||
    value.includes("ผู้ดูแลระบบ") ||
    value.includes("ผู้บริหาร");
}

function getSettingItem(notifications: unknown) {
  return Array.isArray(notifications)
    ? notifications.find((item) => item && typeof item === "object" && (item as any).type === "_aiPostSettings")
    : null;
}

function withoutSettingItem(notifications: unknown) {
  return (Array.isArray(notifications) ? notifications : [])
    .filter((item) => !(item && typeof item === "object" && (item as any).type === "_aiPostSettings"));
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const encryptionSecret = Deno.env.get("AI_SETTINGS_SECRET") || serviceRoleKey;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "กรุณาเข้าสู่ระบบก่อน" }, 401);

    const { data: users, error: usersError } = await admin
      .from("Users")
      .select("LineID, Name, Role, VirtueStats");
    if (usersError) throw usersError;

    const currentRow = (users || []).find((row) =>
      String(parseStats(row.VirtueStats)._authUserId || "") === authData.user.id
    );
    if (!currentRow) return json({ error: "ไม่พบบัญชีผู้ใช้" }, 404);

    const body = await req.json();
    const action = String(body.action || "");
    const { data: configRows, error: configError } = await admin
      .from("SystemConfig")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    if (configError) throw configError;
    const activeConfig = configRows?.[0] || null;
    if (!activeConfig) return json({ error: "ไม่พบ SystemConfig ที่ active" }, 404);

    const notifications = Array.isArray(activeConfig.notifications) ? activeConfig.notifications : [];
    const setting = getSettingItem(notifications);

    if (action === "status") {
      if (!isAdminRole(currentRow.Role)) return json({ error: "ไม่มีสิทธิ์ตั้งค่า AI" }, 403);
      return json({ success: true, configured: !!setting?.encrypted });
    }

    if (action === "save-key" || action === "delete-key") {
      if (!isAdminRole(currentRow.Role)) return json({ error: "ไม่มีสิทธิ์ตั้งค่า AI" }, 403);
      let nextNotifications = withoutSettingItem(notifications);

      if (action === "save-key") {
        const apiKey = String(body.apiKey || "").trim();
        if (!apiKey.startsWith("sk-")) return json({ error: "รูปแบบ API key ไม่ถูกต้อง" }, 400);
        const encrypted = await encryptSecret(apiKey, encryptionSecret);
        nextNotifications = [
          ...nextNotifications,
          {
            id: "_ai_post_settings",
            type: "_aiPostSettings",
            _internal: true,
            encrypted,
            updatedAt: new Date().toISOString(),
            updatedBy: currentRow.LineID,
          },
        ];
      }

      const { error } = await admin
        .from("SystemConfig")
        .update({ notifications: nextNotifications })
        .eq("is_active", true);
      if (error) throw error;
      return json({ success: true, configured: action === "save-key" });
    }

    if (action === "generate") {
      if (!setting?.encrypted) return json({ error: "ยังไม่ได้ตั้งค่า AI API key กรุณาให้ Admin ตั้งค่าก่อน" }, 400);
      const apiKey = await decryptSecret(setting.encrypted, encryptionSecret);
      const draft = String(body.draft || "").trim().slice(0, 1200);
      if (!draft) return json({ error: "กรุณาพิมพ์ข้อความตั้งต้นก่อน" }, 400);

      const virtue = String(body.virtue || "");
      const mood = String(body.mood || "");
      const prompt = [
        "ช่วยเรียบเรียงข้อความโพสกิจกรรมภาษาไทยให้น่าอ่าน อบอุ่น จริงใจ และเหมาะกับระบบ Happy Meter",
        "คงข้อเท็จจริงจากข้อความเดิม ห้ามแต่งข้อมูลใหม่เกินจริง",
        "ความยาวประมาณ 3-6 ประโยค ใช้ภาษาเป็นธรรมชาติ ไม่ต้องใส่แฮชแท็กจำนวนมาก",
        `หมวดความดี: ${virtue || "ไม่ระบุ"}`,
        `อารมณ์ผู้โพส: ${mood || "ไม่ระบุ"}`,
        `ข้อความตั้งต้น: ${draft}`,
      ].join("\n");

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a careful Thai writing assistant for workplace activity posts." },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      const aiJson = await aiResponse.json();
      if (!aiResponse.ok) {
        return json({ error: aiJson?.error?.message || "OpenAI API ใช้งานไม่ได้" }, 400);
      }
      const text = String(aiJson?.choices?.[0]?.message?.content || "").trim();
      return json({ success: true, text });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
