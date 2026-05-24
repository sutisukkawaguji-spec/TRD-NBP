import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import webpush from "npm:web-push";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { title, body, url, targetLineId } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ดึงข้อมูลการลงทะเบียน (Subscriptions)
    let query = supabase.from('UserSubscriptions').select('*');
    
    if (targetLineId === 'admin') {
      // ค้นหา LineID ของกลุ่มผู้ดูแลระบบ/ผู้บริหาร (Role: Admin, Manager, Committee)
      const { data: admins, error: adminError } = await supabase
        .from('Users')
        .select('LineID')
        .or('Role.ilike.%admin%,Role.ilike.%ผู้ดูแลระบบ%,Role.ilike.%manager%,Role.ilike.%ผู้บริหาร%,Role.ilike.%committee%,Role.ilike.%กรรมการ%');
      
      if (adminError) throw adminError;
      
      const adminLineIds = (admins || []).map((a: any) => a.LineID).filter(Boolean);
      
      if (adminLineIds.length > 0) {
        query = query.in('LineID', adminLineIds);
      } else {
        return new Response(JSON.stringify({ success: true, sentCount: 0, message: 'No admins found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    } else if (targetLineId && targetLineId !== 'all') {
      // ส่งเฉพาะบางคน
      query = query.eq('LineID', targetLineId);
    }

    const { data: subs, error: subError } = await query;
    if (subError) throw subError;

    const results = [];
    const pushPayload = JSON.stringify({ title, body, url });

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys are not configured in Supabase Secrets.');
    }

    // กำหนดค่า VAPID
    webpush.setVapidDetails(
      'mailto:admin@example.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    if (subs && subs.length > 0) {
      for (const sub of subs) {
        try {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            }
          }, pushPayload);
          results.push({ id: sub.id, status: 'success' });
        } catch (err: any) {
          console.error(`Failed to send to endpoint: ${sub.endpoint}`, err);
          results.push({ id: sub.id, status: 'failed', error: err.message });
          
          // ลบ Subscription ที่หมดอายุ / ใช้งานไม่ได้แล้วออกจากฐานข้อมูล
          if (err.statusCode === 410 || err.statusCode === 404 || (err.message && err.message.includes('expired'))) {
            await supabase.from('UserSubscriptions').delete().eq('id', sub.id);
            console.log(`Deleted invalid subscription: ${sub.id}`);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sentCount: results.filter(r => r.status === 'success').length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error('Error in send-push function:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
