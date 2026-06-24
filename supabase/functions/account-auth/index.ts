import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const usernamePattern = /^[a-z]+_[a-z]{2}\d*$/;
const accountDomain = "accounts.happiness.local";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeUsername(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function accountEmail(username: string) {
  return `${username}@${accountDomain}`;
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

async function saveProfileImage(
  admin: ReturnType<typeof createClient>,
  authUserId: string,
  dataUrl: string,
) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) throw new Error("รองรับรูป PNG, JPG หรือ WEBP เท่านั้น");

  const mimeType = match[1];
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  if (bytes.byteLength > 2 * 1024 * 1024) throw new Error("รูปโปรไฟล์ต้องมีขนาดไม่เกิน 2 MB");

  await admin.storage.createBucket("profile-images", {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  }).catch(() => null);

  const path = `${authUserId}/avatar.${extension}`;
  const { error } = await admin.storage.from("profile-images").upload(path, bytes, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw error;
  return admin.storage.from("profile-images").getPublicUrl(path).data.publicUrl + `?v=${Date.now()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "register" || action === "link-line") {
      const username = normalizeUsername(body.username);
      const password = String(body.password || "");
      if (!usernamePattern.test(username)) {
        return json({ error: "Username ต้องเป็นชื่ออังกฤษ ตามด้วย _ และอักษรนามสกุล 2 ตัวแรก เช่น somchai_ja" }, 400);
      }
      if (password.length < 8) return json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }, 400);

      const { data: users, error: usersError } = await admin
        .from("Users")
        .select("LineID, Name, Image, Role, GroupCode, Status, VirtueStats");
      if (usersError) throw usersError;
      const duplicate = (users || []).find((row) =>
        normalizeUsername(parseStats(row.VirtueStats)._username) === username
      );
      if (duplicate) return json({ error: "Username นี้ถูกใช้งานแล้ว" }, 409);

      let targetRow = null;
      const fullName = String(body.fullName || "").trim();
      const groupCode = String(body.groupCode || "").trim().toUpperCase();
      if (action === "register" && !fullName) return json({ error: "กรุณาระบุชื่อ-นามสกุล" }, 400);
      if (action === "register" && !groupCode) return json({ error: "กรุณาระบุบ้าน" }, 400);

      if (action === "link-line") {
        const lineId = String(body.lineId || "").trim();
        const idToken = String(body.lineIdToken || "");
        const lineClientId = String(body.lineClientId || "");
        if (!lineId || !idToken || !lineClientId) return json({ error: "กรุณาเข้าใช้งานผ่าน LINE เพื่อยืนยันบัญชีเดิม" }, 401);

        const verifyResponse = await fetch("https://api.line.me/oauth2/v2.1/verify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ id_token: idToken, client_id: lineClientId }),
        });
        const verified = await verifyResponse.json();
        if (!verifyResponse.ok || verified.sub !== lineId) return json({ error: "ยืนยันบัญชี LINE ไม่สำเร็จ" }, 401);
        targetRow = (users || []).find((row) => row.LineID === lineId);
        if (!targetRow) return json({ error: "ไม่พบสมาชิกเดิมในระบบ" }, 404);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: accountEmail(username),
        password,
        email_confirm: true,
        user_metadata: { username },
      });
      if (createError) throw createError;
      const authUserId = created.user.id;

      let imageUrl = String(targetRow?.Image || "");
      if (body.imageDataUrl) imageUrl = await saveProfileImage(admin, authUserId, body.imageDataUrl);

      if (action === "link-line" && targetRow) {
        const stats = parseStats(targetRow.VirtueStats);
        stats._authUserId = authUserId;
        stats._username = username;
        stats._authProvider = "password";
        const { error } = await admin.from("Users").update({
          VirtueStats: stats,
          Image: imageUrl || targetRow.Image,
        }).eq("LineID", targetRow.LineID);
        if (error) {
          await admin.auth.admin.deleteUser(authUserId);
          throw error;
        }
        return json({ success: true, username, email: accountEmail(username), lineId: targetRow.LineID });
      }

      const knownHouse = (users || []).some((row) => {
        if (String(row.GroupCode || "").toUpperCase() === groupCode) return true;
        const managed = parseStats(row.VirtueStats)._managedHouses;
        return Array.isArray(managed) && managed.map((item) => String(item).toUpperCase()).includes(groupCode);
      });
      if (!knownHouse) {
        await admin.auth.admin.deleteUser(authUserId);
        return json({ error: `ไม่พบบ้าน ${groupCode} กรุณาสมัครผ่าน QR Code หรือลิงก์เชิญของบ้าน` }, 400);
      }

      const lineId = `A${authUserId.replaceAll("-", "")}`.toUpperCase();
      const now = new Date();
      const { error: insertError } = await admin.from("Users").insert({
        ID: lineId,
        LineID: lineId,
        EmployeeID: null,
        Name: fullName,
        Image: imageUrl,
        Role: "Guest",
        Score: 0,
        Level: 1,
        Department: String(body.position || ""),
        Office: String(body.province || ""),
        GroupCode: groupCode,
        Status: "waiting_approval",
        LastDate: now.toISOString().slice(0, 10),
        LastTime: now.toTimeString().slice(0, 8),
        VisitCount: 1,
        VirtueStats: {
          _authUserId: authUserId,
          _username: username,
          _authProvider: "password",
        },
      });
      if (insertError) {
        await admin.auth.admin.deleteUser(authUserId);
        throw insertError;
      }
      return json({ success: true, username, email: accountEmail(username), lineId });
    }

    if (action === "upload-profile") {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const { data: authData, error: authError } = await admin.auth.getUser(token);
      if (authError || !authData.user) return json({ error: "กรุณาเข้าสู่ระบบใหม่" }, 401);

      const { data: users, error: usersError } = await admin.from("Users").select("LineID, VirtueStats");
      if (usersError) throw usersError;
      const userRow = (users || []).find((row) =>
        String(parseStats(row.VirtueStats)._authUserId || "") === authData.user.id
      );
      if (!userRow) return json({ error: "ไม่พบบัญชีสมาชิกที่เชื่อมไว้" }, 404);

      const imageUrl = await saveProfileImage(admin, authData.user.id, String(body.imageDataUrl || ""));
      const stats = parseStats(userRow.VirtueStats);
      stats._profileImageManual = true;
      const { error } = await admin.from("Users").update({
        Image: imageUrl,
        VirtueStats: stats,
      }).eq("LineID", userRow.LineID);
      if (error) throw error;
      return json({ success: true, imageUrl });
    }

    if (action === "update-profile") {
      const { data: users, error: usersError } = await admin
        .from("Users")
        .select("LineID, Name, Image, VirtueStats");
      if (usersError) throw usersError;

      let userRow = null;
      let authUserId = "";
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (token) {
        const { data: authData } = await admin.auth.getUser(token);
        if (authData.user) {
          authUserId = authData.user.id;
          userRow = (users || []).find((row) =>
            String(parseStats(row.VirtueStats)._authUserId || "") === authUserId
          ) || null;
        }
      }

      if (!userRow) {
        const lineId = String(body.lineId || "").trim();
        const idToken = String(body.lineIdToken || "");
        const lineClientId = String(body.lineClientId || "");
        if (!lineId || !idToken || !lineClientId) {
          return json({ error: "กรุณาเข้าสู่ระบบใหม่เพื่อยืนยันการแก้ไขโปรไฟล์" }, 401);
        }
        const verifyResponse = await fetch("https://api.line.me/oauth2/v2.1/verify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ id_token: idToken, client_id: lineClientId }),
        });
        const verified = await verifyResponse.json();
        if (!verifyResponse.ok || verified.sub !== lineId) {
          return json({ error: "ยืนยันบัญชี LINE ไม่สำเร็จ" }, 401);
        }
        userRow = (users || []).find((row) => row.LineID === lineId) || null;
        authUserId = String(parseStats(userRow?.VirtueStats)._authUserId || lineId);
      }

      if (!userRow) return json({ error: "ไม่พบบัญชีสมาชิก" }, 404);

      const updates: Record<string, unknown> = {};
      const stats = parseStats(userRow.VirtueStats);
      const profileName = String(body.profileName || "").trim();
      if (body.profileName !== undefined) {
        if (profileName.length < 2 || profileName.length > 80) {
          return json({ error: "ชื่อโปรไฟล์ต้องมี 2-80 ตัวอักษร" }, 400);
        }
        updates.Name = profileName;
        stats._profileNameManual = true;
      }

      let imageUrl = "";
      if (body.imageDataUrl) {
        imageUrl = await saveProfileImage(admin, authUserId, String(body.imageDataUrl));
        updates.Image = imageUrl;
        stats._profileImageManual = true;
      }
      if (!profileName && !imageUrl) return json({ error: "ไม่มีข้อมูลโปรไฟล์ที่ต้องการแก้ไข" }, 400);

      updates.VirtueStats = stats;
      const { error } = await admin.from("Users").update(updates).eq("LineID", userRow.LineID);
      if (error) throw error;
      return json({
        success: true,
        profileName: profileName || userRow.Name,
        imageUrl: imageUrl || userRow.Image,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
