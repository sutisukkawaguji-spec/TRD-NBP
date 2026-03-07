// --- ⚙️ ตั้งค่า (สำคัญมาก: หากเชื่อมต่อไม่ได้ รบกวนใส่ ID ชีตที่บรรทัดด้านล่าง) ---
var SHEET_ID = ""; 
try { SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId(); } catch(e) { }

// ⚠️ หากคุณสร้าง Script แยก: ให้เอา ID ชีตคุณมาใส่ที่นี่ และลบ // ด้านหน้าออก
// SHEET_ID = '1...รหัสชีตของคุณ...'; 

var FOLDER_ID = '1B0ksTsrpCBy2yxMOGWC1sSTRYnQ55Ye7'; 
var ACCESS_TOKEN = 'c88f2c8c819e455eaf3b24b6b085374b';

// --- 1. ฟังก์ชันหลักสำหรับดึงข้อมูล (GET) ---
function doGet(e) {
  var action = e.parameter ? e.parameter.action : null;
  var debugInfo = { action: action, sheetId: SHEET_ID };
  
  try {
    var ss = null;
    if (SHEET_ID && SHEET_ID !== "") {
      try { ss = SpreadsheetApp.openById(SHEET_ID); } catch(e) { debugInfo.error = "Invalid SHEET_ID"; }
    }
    if (!ss) {
      try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch(e) { }
    }
    
    if (!ss) return responseJSON({status: 'error', message: 'Spreadsheet not found or access denied.'});

    var getSheet = function(name) {
      var s = ss.getSheetByName(name);
      if (!s) {
         if (name === 'Users' || name === 'Activities' || name === 'Announcements') {
            s = ss.insertSheet(name);
            if (name === 'Users') s.appendRow(['ID', 'Name', 'Role', 'Score', 'Level', 'LineID', 'Image', 'Department', 'Office']);
            if (name === 'Activities') s.appendRow(['Timestamp', 'UUID', 'UserId', 'Tagged', 'UserName', 'Virtue', 'Image', 'Happy', 'Note', 'JSON', 'Status', 'Score', 'Privacy']);
            if (name === 'Announcements') s.appendRow(['ID', 'Title', 'Body', 'EventDate', 'Category', 'PostedBy', 'Timestamp']);
         }
      }
      return s;
    };

    if (action === 'get_feed') {
      var actSheet = getSheet('Activities');
      var userSheet = getSheet('Users');
      var actData = actSheet.getDataRange().getValues();
      var userData = userSheet.getDataRange().getValues();
      
      var userMap = {};
      for(var u=1; u<userData.length; u++) {
        if(!userData[u][5]) continue; 
        var uidKey = String(userData[u][5]).trim();
        userMap[uidKey] = { 
          lineId: uidKey,
          name: userData[u][1] || 'Unknown', 
          img: userData[u][6] || 'https://dummyimage.com/90x90/cccccc/ffffff&text=User',
          role: userData[u][2] || 'Staff'
        };
      }

      var getAvatars = function(list) {
        if (!list) return [];
        return list.map(function(item) {
          var id = (typeof item === 'object') ? item.lineId : item;
          var u = userMap[String(id).trim()];
          if (u) {
             var newU = JSON.parse(JSON.stringify(u)); 
             if (typeof item === 'object') newU.type = item.type; 
             return newU;
          }
          return null;
        }).filter(Boolean);
      };

      var feed = [];
      var limit = parseInt(e.parameter.limit) || 20;
      var count = 0;
      
      for (var i = actData.length - 1; i >= 1; i--) {
        if (count >= limit) break;
        try {
          var row = actData[i];
          if (!row[2]) continue;

          var uid = String(row[2]).trim();
          var poster = userMap[uid] || { name: 'Unknown', img: 'https://dummyimage.com/90x90/cccccc/ffffff&text=User' };
          
          var interactions = { likes: [], verifies: [] };
          try { if(row[9]) interactions = JSON.parse(row[9]); } catch(e) {}
          
          var taggedAvatars = [];
          if (row[3]) {
             var tIds = String(row[3]).split(',');
             taggedAvatars = tIds.map(function(tid) {
                return userMap[String(tid).trim()] || null;
             }).filter(Boolean);
          }

          var privacyVal = (row.length > 12) ? row[12] : 'public'; 

          feed.push({
            id: i, 
            timestamp: row[0], 
            user_name: poster.name, 
            user_img: poster.img,
            user_line_id: uid, 
            taggedFriends: row[3],
            tagged_avatars: taggedAvatars,
            virtue: row[5], 
            image: row[6], 
            happy: row[7], 
            note: row[8],
            likes: getAvatars(interactions.likes),     
            verifies: getAvatars(interactions.verifies),
            privacy: privacyVal 
          });
          count++;
        } catch (e) {}
      }
      return responseJSON({ feed: feed, userMap: userMap }, e.parameter.callback);
    }

    if (action === 'get_users' || action === 'get_dashboard') {
      var userSheet = getSheet('Users');
      var actSheet = getSheet('Activities');
      var stats = calculateRealStats(actSheet.getDataRange().getValues(), userSheet.getDataRange().getValues());
      
      var users = [];
      var userRows = userSheet.getDataRange().getValues();
      for (var i = 1; i < userRows.length; i++) {
        if(userRows[i][1]) {
          var uid = userRows[i][5] ? String(userRows[i][5]).trim() : "";
          var s = stats.userStats[uid] || { totalScore: 0, level: 1 };
          var dbScore = Number(userRows[i][3]) || 0;
          var finalScore = Math.max(s.totalScore, dbScore);
          var finalLevel = Math.floor(finalScore / 500) + 1;

          users.push({
            id: userRows[i][0], name: userRows[i][1], role: userRows[i][2],
            score: finalScore, happy: s.avgHappy || 0, img: userRows[i][6], lineId: uid,
            level: finalLevel, virtueStats: s.virtueCounts || {},
            totalCount: s.postsMade || 0, taggedCount: s.taggedIn || 0, witnessCount: s.witnessCount || 0,
            dominantVirtue: s.dominantVirtue, topFriends: s.topFriends || []
          });
        }
      }
      if (action === 'get_dashboard') return responseJSON({ users: users, trend: stats.overallTrend }, e.parameter.callback);
      return responseJSON(users, e.parameter.callback);
    }

    if (action === 'submit_presurvey') {
      var surveySheet = getSheet('Surveys');
      surveySheet.appendRow([new Date(), e.parameter.uid || 'Anonymous', e.parameter.q1 || '', e.parameter.q2 || '', e.parameter.q3 || '']);
      return responseJSON({status: 'success'}, e.parameter.callback);
    }

    if (action === 'get_announcements') {
      var annSheet = getSheet('Announcements');
      var rows = annSheet.getDataRange().getValues();
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var result = [];

      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (!row[0]) continue;
        var showThis = true;
        if (row[3]) {
          var eventDate = new Date(row[3]);
          if (!isNaN(eventDate.getTime())) {
            eventDate.setHours(0, 0, 0, 0);
            if (eventDate.getTime() < (today.getTime() - (86400000 * 7))) showThis = false;
          }
        }
        if (showThis) {
          result.push({
            id: row[0], title: row[1], body: row[2],
            date: row[3] ? Utilities.formatDate(new Date(row[3]), 'Asia/Bangkok', 'yyyy-MM-dd') : '',
            displayDate: row[3] ? Utilities.formatDate(new Date(row[3]), 'Asia/Bangkok', 'dd/MM/yyyy') : '',
            category: row[4] || 'general', postedBy: row[5] || '',
            ts: row[6] ? row[6].toString() : ''
          });
        }
      }
      result.sort(function(a, b) {
        var tA = a.ts ? new Date(a.ts).getTime() : 0;
        var tB = b.ts ? new Date(b.ts).getTime() : 0;
        return tB - tA;
      });
      return responseJSON({ announcements: result }, e.parameter.callback);
    }

    return responseJSON({ status: 'error', message: 'Unknown action: ' + action }, e.parameter.callback);

  } catch (outerErr) {
    console.error("doGet Error: " + outerErr);
    return responseJSON({ status: 'error', message: 'doGet Error: ' + outerErr.toString() }, e.parameter.callback);
  }
}

// ==========================================
// 🚀 ฟังก์ชันจัดการคำขอ (POST) - ฉบับแก้ไขปรับปรุง
// ==========================================
function doPost(e) {
  console.log("doPost: " + JSON.stringify(e));
  try {
    if (!e || !e.postData || !e.postData.contents) {
       return responseJSON({status: 'error', message: 'No post data received'});
    }
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = null;
    try { 
      if (SHEET_ID && SHEET_ID !== "") {
        ss = SpreadsheetApp.openById(SHEET_ID);
      } else {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      }
    } catch(err) {
      return responseJSON({status: 'error', message: 'doPost Connect Failed: ' + err.toString()});
    }
    if (!ss) return responseJSON({status: 'error', message: 'POST Spreadsheet not bound and SHEET_ID empty.'});

    // --- 0. บันทึกประกาศ/กิจกรรม ---
    if (action == 'save_announcement') {
      var annSheet = ss.getSheetByName('Announcements');
      if (!annSheet) {
        annSheet = ss.insertSheet('Announcements');
        annSheet.appendRow(['ID', 'Title', 'Body', 'EventDate', 'Category', 'PostedBy', 'Timestamp']);
      }
      var newId = 'ann_' + new Date().getTime();
      annSheet.appendRow([
        newId,
        data.title || '',
        data.body || '',
        data.eventDate ? new Date(data.eventDate) : '',
        data.category || 'general',
        data.postedBy || '',
        new Date()
      ]);
      return responseJSON({ status: 'success', id: newId });
    }

    if (action == 'upload_chunk') {
      var folder = DriveApp.getFolderById(FOLDER_ID);
      folder.createFile("temp_" + data.uploadId + "_" + data.chunkIndex, data.chunkData);
      return responseJSON({status: 'success'});
    } 
    // 🌟 เปลี่ยนมาใช้ else if ให้สอดคล้องกับด้านบน
    else if (action == 'promote_alumni') {
      return updateUserRoleStatus(data.userId, 'ศิษย์เก่า');
    } 
    else if (action == 'update_role') {
      return updateUserRoleStatus(data.userId, data.role);
    }
    // -----------------------------------------------------------
    // 🗑️ ACTION: DELETE POST (\u0e25\u0e1a\u0e42\u0e1e\u0e2a\u0e15\u0e4c + \u0e2b\u0e31\u0e01\u0e04\u0e30\u0e41\u0e19\u0e19)
    // -----------------------------------------------------------
    if (action == 'delete_post') {
      try {
        var actSheet = ss.getSheetByName('Activities');
        var userSheet = ss.getSheetByName('Users');
        var rowIndex = parseInt(data.postId) + 1; // postId คือ row index (0-based)
        var requesterId = data.userId;

        if (!actSheet || rowIndex < 2 || rowIndex > actSheet.getLastRow()) {
          return responseJSON({ status: 'error', message: '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e42\u0e1e\u0e2a\u0e15\u0e4c' });
        }

        var row = actSheet.getRange(rowIndex, 1, 1, actSheet.getLastColumn()).getValues()[0];
        var postOwner = row[2]; // Column C = userId
        var postScore = parseInt(row[11]) || 0; // Column L = Score (earned from this post)

        if (String(postOwner) !== String(requesterId)) {
          return responseJSON({ status: 'error', message: '\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c\u0e25\u0e1a\u0e42\u0e1e\u0e2a\u0e15\u0e4c\u0e19\u0e35\u0e49' });
        }

        // หักคะแนนจากผู้ใช้
        var scoreDeducted = postScore;
        if (scoreDeducted > 0) {
            var userData = userSheet.getDataRange().getValues();
            for (var i = 1; i < userData.length; i++) {
              if (String(userData[i][5]) === String(requesterId)) { // Column F = Line ID
                var currentScore = parseInt(userData[i][3]) || 0; // Column D = Score
                userSheet.getRange(i + 1, 4).setValue(Math.max(0, currentScore - scoreDeducted));
                break;
              }
            }
        }

        actSheet.deleteRow(rowIndex);
        return responseJSON({ status: 'success', scoreDeducted: scoreDeducted });
      } catch(err) {
        return responseJSON({ status: 'error', message: err.toString() });
      }
    }

    // -----------------------------------------------------------
    // ✏️ ACTION: EDIT POST (\u0e41\u0e01\u0e49\u0e44\u0e02\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21)
    // -----------------------------------------------------------
    if (action == 'edit_post') {
      try {
        var actSheet = ss.getSheetByName('Activities');
        var rowIndex = parseInt(data.postId) + 1;
        var requesterId = data.userId;

        if (!actSheet || rowIndex < 2 || rowIndex > actSheet.getLastRow()) {
          return responseJSON({ status: 'error', message: '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e42\u0e1e\u0e2a\u0e15\u0e4c' });
        }

        var row = actSheet.getRange(rowIndex, 1, 1, actSheet.getLastColumn()).getValues()[0];
        var postOwner = row[2]; // Column C = userId
        if (String(postOwner) !== String(requesterId)) {
          return responseJSON({ status: 'error', message: '\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c\u0e41\u0e01\u0e49\u0e44\u0e02\u0e42\u0e1e\u0e2a\u0e15\u0e4c\u0e19\u0e35\u0e49' });
        }

        // อัปเดต Note (Column I = index 8)
        var noteColIndex = 9; // Column I (1-based)
        actSheet.getRange(rowIndex, noteColIndex).setValue(data.newNote || '');
        return responseJSON({ status: 'success' });
      } catch(err) {
        return responseJSON({ status: 'error', message: err.toString() });
      }
    }

    // --- 2. Auto Rescue (คงเดิม) ---
    if (action == 'trigger_auto_rescue') {
      return autoRescue(data.userId);
    }

    // -----------------------------------------------------------
    // ❤️ ACTION: LIKE POST (แก้ไข: ใช้ Row Index แทน UUID)
    // -----------------------------------------------------------
    if (action == 'like_post') {
      var actSheet = ss.getSheetByName('Activities');
      var userSheet = ss.getSheetByName('Users'); 
      
      // ✅ แก้ไข: แปลง postId เป็นตัวเลขบรรทัดโดยตรง (เหมือน verify_post)
      // ข้อมูล Array เริ่มที่ 0 แต่ Sheet เริ่มที่ 1 ดังนั้นต้อง +1
      var rowIndex = parseInt(data.postId) + 1; 
      var userId = data.userId;
      var reactionType = data.reactionType || 'like'; 

      // ตรวจสอบว่ามีแถวนี้จริงไหม (กัน Error)
      var lastRow = actSheet.getLastRow();
      if (rowIndex > lastRow || rowIndex < 2) {
         return responseJSON({status: 'error', message: 'Invalid Row Index'});
      }

      // 2. ดึง JSON Interaction (Column 10 / J)
      var interactionCol = 10; 
      var jsonStr = actSheet.getRange(rowIndex, interactionCol).getValue();
      var interactionData = { likes: [], verifies: [] };
      
      try { 
        if (jsonStr && jsonStr.toString().trim() !== "") {
            interactionData = JSON.parse(jsonStr); 
        }
      } catch (e) { }

      if (!interactionData.likes) interactionData.likes = [];

      // 3. เช็คว่าคนนี้เคยกดไปรึยัง?
      var existingIndex = -1;
      for (var k = 0; k < interactionData.likes.length; k++) {
        // แปลงเป็น String ทั้งคู่เพื่อความชัวร์ในการเปรียบเทียบ
        if (String(interactionData.likes[k].lineId) === String(userId)) {
          existingIndex = k;
          break;
        }
      }

      if (existingIndex > -1) {
        // 🔄 กรณีเคยกดแล้ว -> อัปเดตประเภท (เช่น เปลี่ยนจาก Like เป็น Love)
        interactionData.likes[existingIndex].type = reactionType;
        // หรือถ้าอยากให้กดซ้ำแล้วลบ (Unlike) ให้ใช้บรรทัดนี้แทน:
        // interactionData.likes.splice(existingIndex, 1); 
      } else {
        // ➕ กรณีไม่เคยกด -> เพิ่มใหม่
        interactionData.likes.push({
          lineId: userId,
          type: reactionType,
          timestamp: new Date().toISOString()
        });
      }

      // 4. บันทึกกลับลงชีต
      actSheet.getRange(rowIndex, interactionCol).setValue(JSON.stringify(interactionData));

      return responseJSON({status: 'success', type: reactionType});
    }

    // --- 4. บันทึกกิจกรรม (Save Activity) ---
    if (action == 'save_activity') {
      var actSheet = ss.getSheetByName('Activities');
      var userSheet = ss.getSheetByName('Users');
      if (!actSheet || !userSheet) return responseJSON({status: 'error', message: 'Sheets missing'});

      // 1. จัดการสื่อ
      var imageUrl = data.image || ""; 
      
      if (data.uploadId) {
        imageUrl = reassembleAndSaveImage(data.uploadId, data.userName, data.totalChunks);
      }

      // 2. ตั้งค่าตัวแปร (คะแนน และ สถานะ)
      var scoreToAdd = 0;
      var status = "waiting_verify"; // ค่าเริ่มต้น: รอพยาน

      // --- 🛡️ Logic: ตรวจสอบ Privacy & Team ---
      if (data.privacy === 'private') {
         // 🔒 กรณีส่วนตัว: ไม่ได้คะแนน, สถานะเป็น private (ผ่านเลยไม่ต้องรอ)
         scoreToAdd = 0;
         status = "private"; 
      } else {
         // 🌍 กรณีสาธารณะ: คิดคะแนนตามปกติ
         if (data.taggedFriends && data.taggedFriends.length > 0) {
            // แบบทีม: ได้ 10 คะแนน, สถานะอนุมัติเลย (Team work ไม่ต้องรอพยาน)
            scoreToAdd = 10; 
            status = "approved"; 
         } else {
            // แบบเดี่ยว: ได้ 5 คะแนน, ต้องรอพยานยืนยัน
            scoreToAdd = 5;  
            status = "waiting_verify"; 
         }
      }

      // 3. เตรียม JSON สำหรับเก็บ Likes/Verifies
      var initialInteractions = JSON.stringify({ likes: [], verifies: [] });

      // 4. บันทึกลงชีต (✅ ปรับปรุงให้บันทึกคะแนนและ Privacy)
      // ⚠️ เรียง Column: [Date, UUID, UserId, Tagged, UserName, Virtue, Image, Happy, Note, JSON, Status, Score, Privacy]
      actSheet.appendRow([
        new Date(),             // Col 1: เวลา
        Utilities.getUuid(),    // Col 2: ID โพสต์
        data.userId,            // Col 3: User ID
        data.taggedFriends,     // Col 4: เพื่อนที่แท็ก
        data.userName,          // Col 5: ชื่อคนโพสต์ (แก้จาก "General" เพื่อให้แสดงชื่อถูก)
        data.virtueTag,         // Col 6: หมวดความดี
        imageUrl,               // Col 7: รูปภาพ
        data.happyLevel,        // Col 8: อารมณ์
        data.note,              // Col 9: ข้อความ
        initialInteractions,    // Col 10: JSON Interaction
        status,                 // Col 11: สถานะ (waiting_verify, approved, private)
        scoreToAdd,             // Col 12: คะแนนที่ได้รับ (บันทึกไว้ดูย้อนหลัง)
        data.privacy            // Col 13: ความเป็นส่วนตัว (private/public)
      ]);

      // 5. อัปเดตคะแนนผู้ใช้ (เฉพาะถ้าได้คะแนน > 0)
      if (scoreToAdd > 0) {
        // ให้คนโพสต์
        updateUserScore(userSheet, data.userId, scoreToAdd);

        // ให้เพื่อนร่วมทีม (ถ้ามี)
        if (data.taggedFriends && data.taggedFriends.length > 0) {
           var friendIds = data.taggedFriends.toString().split(',');
           for (var i = 0; i < friendIds.length; i++) {
             // ให้คะแนนเพื่อนเท่ากัน (10 คะแนน)
             updateUserScore(userSheet, friendIds[i].trim(), scoreToAdd); 
           }
        }
      }
      
      return responseJSON({status: 'success', score: scoreToAdd});
    }

    // --- 5. ยืนยันความถูกต้อง (Verify) - 🔥 เพิ่มโบนัสเจ้าของโพสต์ ---
    if (action == 'verify_solo' || action == 'verify_post') { // รองรับทั้งสองชื่อ
      var userSheet = ss.getSheetByName('Users');
      var actSheet = ss.getSheetByName('Activities');
      
      var rowIdx = parseInt(data.postId) + 1;
      var cellJSON = actSheet.getRange(rowIdx, 10); // Col J
      var cellStatus = actSheet.getRange(rowIdx, 11); // Col K
      var cellBonus = actSheet.getRange(rowIdx, 13); // Col M (สมมติว่าเพิ่มแล้ว)

      // อ่าน JSON
      var interactions = { likes: [], verifies: [] };
      try { if(cellJSON.getValue()) interactions = JSON.parse(cellJSON.getValue()); } catch(e) {}
      
      var witnessId = data.witnessId || data.userId || data.verifierId;

      // เช็คว่าเคยกดไหม
      if (interactions.verifies.indexOf(witnessId) === -1) {
        interactions.verifies.push(witnessId);
        cellJSON.setValue(JSON.stringify(interactions));
        
        // 1. ให้คะแนนพยาน +3 (ตามกติกาใหม่ ไม่อั้น)
        updateUserScore(userSheet, witnessId, 3); // ✅ เปลี่ยนจาก 5 เป็น 3 หรือตามตกลง

        // 2. เช็คโบนัสเจ้าของโพสต์
        var verifierCount = interactions.verifies.length;
        var bonusGiven = cellBonus.getValue();

        // ถ้าครบ 4 คน (มากกว่า 3) และยังไม่เคยแจก
        if (verifierCount >= 2 && bonusGiven != "TRUE") {
           var rowData = actSheet.getRange(rowIdx, 1, 1, 13).getValues()[0];
           var ownerId = rowData[2]; // UserID ของเจ้าของโพสต์

           updateUserScore(userSheet, ownerId, 3); // ✅ โบนัส +3
           cellBonus.setValue("TRUE");
           cellStatus.setValue("approved"); // เปลี่ยนสถานะเป็นผ่าน
           return responseJSON({status: 'success', message: 'Verified & Bonus Granted!'});
        }
        
        return responseJSON({status: 'success', message: 'Verified (+3 pts)'});
      } else {
        return responseJSON({status: 'already_verified'});
      }
    }

    // --- 6. Check User ---
    if (action == 'check_user') {
      var userSheet = ss.getSheetByName('Users');
      var actSheet = ss.getSheetByName('Activities');
      
      if (!userSheet) return responseJSON({status: 'error', message: 'Users sheet not found'});
      if (!actSheet) return responseJSON({status: 'error', message: 'Activities sheet not found'});
      
      var userData = userSheet.getDataRange().getValues();
      var actData = actSheet.getDataRange().getValues();
      var systemConfig = {
          version: "2.5.1",  // 🔧 อัปเดตตัวเลขนี้ทุกครั้งที่แก้โค้ด เพื่อให้ banner แสดง
          title: "🆕 อัปเดตระบบ v2.5.0",
          message: "<div class='text-start' style='font-size:0.9rem;line-height:1.7;'><span class='badge bg-success mb-2'>Version 2.5.0</span><br>✅ <b>แบบสอบถามประจำเดือน:</b> แสดงได้ถูกต้องแล้ว<br>✅ <b>กระดิ่งแจ้งเตือน:</b> แสดง badge ทันทีหลัง login<br>✅ <b>ระบบอัปเดต:</b> แสดงทุกครั้งเมื่อมีการเปลี่ยนแปลง</div>",

          // 🔔 ข้อความแจ้งเตือนใน App (กระดิ่ง + Native Notification)
          // ✏️ แก้ไขตรงนี้เพื่อเพิ่ม/ลด ข้อความได้เลย
          // id ต้องไม่ซ้ำกัน (ใช้วันที่+เลขรันนิ่ง) เพื่อให้ระบบจำว่า "อ่านแล้ว"
          notifications: [
            {
              id: "notif_20260227_001",
              title: "📢 ยินดีต้อนรับสู่ระบบ ดี มีสุข!",
              body: "เริ่มบันทึกกิจกรรมความดีของคุณได้เลยครับ 😊",
              time: "27 ก.พ. 2569"
            }
            // เพิ่มข้อความใหม่ได้ที่นี่เพื่อแจ้งเตือนผ่านกระดิ่ง:
            // , {
            //   id: "notif_20260301_001",       // ← id ต้องไม่ซ้ำ
            //   title: "🎉 กิจกรรมพิเศษ",
            //   body: "ขอเชิญร่วมกิจกรรมพัฒนาจิตใจ วันที่ 1 มีนาคม 2569",
            //   time: "1 มี.ค. 2569"
            // }
          ]
      };
      var stats = calculateRealStats(actData, userData);
      var foundUser = null;
      
      for (var i = 1; i < userData.length; i++) {
        if (userData[i][5] == data.userId) {
          var uid = data.userId;
          var userStat = stats.userStats[uid] || { totalScore: 0, level: 1 };
          
          var sheetScore = Number(userData[i][3]) || 0;
          var finalScore = Math.max(userStat.totalScore, sheetScore);
          var finalLevel = Math.floor(finalScore / 500) + 1;

          foundUser = { 
            name: userData[i][1], score: finalScore, role: userData[i][2], img: userData[i][6],
            level: finalLevel, virtueStats: userStat.virtueCounts || {},
            totalCount: userStat.count || 0, happyScore: userStat.avgHappy, 
            topFriends: userStat.topFriends || [], dominantVirtue: userStat.dominantVirtue || 'none'
          };
          break;
        }
      }
      return responseJSON({
          exists: !!foundUser, 
          user: foundUser,
          config: systemConfig || {}
      });
    }

    // --- 7. Register User ---
    if (action == 'register_user') {
      var userSheet = ss.getSheetByName('Users');
      userSheet.appendRow([
        userSheet.getLastRow(),    // ID
        data.userName,             // Name (ดึงจาก Input ที่แก้ไขได้)
        "Staff",                   // Role
        100, 1,                    // Initial Score & Level
        data.userId,               // Line ID
        data.userImg,              // Image URL (ดึงจากโปรไฟล์ LINE)
        data.department,           // ส่วนงานที่พนักงานเลือกเอง
        data.office                // ชื่อสำนักงาน (หนองบัวลำภู)
      ]);
      return responseJSON({status: 'success'});
    }

    // Default Response if no action matched
    return responseJSON({ status: 'error', message: 'Unknown POST action: ' + action });

  } catch (err) {
    console.error("doPost Error: " + err);
    return responseJSON({status: 'error', message: 'doPost Error: ' + err.toString()});
  }
}

// --- 🧠 ระบบคำนวณผลจริง (ฉบับเน้นการมีส่วนร่วม: ต้องกด Like ถึงได้ Happy) ---
function calculateRealStats(actData, usersData) {
  var userStats = {};
  var trendDateMap = {}; // 📌 เก็บค่าความสุขในแต่ละวัน
  var userMapForCloseness = {};
  var today = new Date(); 

  // 1. Map ชื่อเพื่อน
  for(var i=1; i<usersData.length; i++) {
    if(usersData[i][5]) {
       var uidLine = String(usersData[i][5]).trim();
       userMapForCloseness[uidLine] = usersData[i][1];
    }
  }
  
  // 2. วนลูปกิจกรรม
  for (var i = 1; i < actData.length; i++) {
    var row = actData[i];
    var uid = row[2] ? String(row[2]).trim() : ""; // ID คนโพสต์
    if (!uid) continue;
    var taggedStr = row[3] ? String(row[3]) : ""; // เพื่อนที่ถูกแท็ก
    var virtue = row[5];
    var happy = Number(row[7]) || 0;
    var timestamp = new Date(row[0]);
    
    // JSON Interaction (ข้อมูลการกด Like/Verify)
    var interactions = { likes: [], verifies: [] };
    try { 
      if(row[9] && String(row[9]).trim() !== "") interactions = JSON.parse(row[9]); 
    } catch(e) {}

    // 📌 จัดกลุ่มค่าความสุขตามวันที่
    if (timestamp instanceof Date && !isNaN(timestamp)) {
        var dStr = timestamp.getFullYear() + "-" + (timestamp.getMonth() + 1) + "-" + timestamp.getDate();
        if (!trendDateMap[dStr]) trendDateMap[dStr] = [];
        trendDateMap[dStr].push(happy);
    }

    // --- ฟังก์ชันย่อยอัปเดตความสุข ---
    var updateHappyStats = function(targetId, happiness, time) {
        if (!userStats[targetId]) userStats[targetId] = { 
            sumHappy: 0, count: 0, totalScore: 0, 
            virtueCounts: {}, closeness: {}, lastActive: null 
        };
        // บวกความสุข
        userStats[targetId].sumHappy += happiness;
        userStats[targetId].count++;
        // อัปเดตวันที่ล่าสุด (เพื่อกันคะแนนลด)
        if (userStats[targetId].lastActive === null || time > userStats[targetId].lastActive) {
            userStats[targetId].lastActive = time;
        }
    };

    // ✅ 2.1 คนโพสต์: ได้ค่าความสุขทันที
    updateHappyStats(uid, happy, timestamp);
    if (!userStats[uid].postsMade) userStats[uid].postsMade = 0;
    userStats[uid].postsMade++;
    
    userStats[uid].totalScore += 10; // (ตัวอย่างคะแนนดิบ)
    if(!userStats[uid].virtueCounts[virtue]) userStats[uid].virtueCounts[virtue] = 0;
    userStats[uid].virtueCounts[virtue]++;

    // ✅ 2.2 คนที่ถูกแท็ก: ได้ค่าความสุขและคะแนนความดีทันทีเมื่อถูกแท็ก
    if (taggedStr !== "") {
        var taggedIds = taggedStr.split(',').map(function(s) { return s.trim(); });
        
        // วนลูปให้ความสุขและบวกสถิติความดีกับทุกคนที่ถูกแท็ก
        taggedIds.forEach(function(tid) {
            if (tid) {
                // ให้คะแนนความสุขเขาด้วย (เท่ากับความสุขของโพสต์นั้น) ทันที
                updateHappyStats(tid, happy, timestamp);
                
                if (!userStats[tid].taggedIn) userStats[tid].taggedIn = 0;
                userStats[tid].taggedIn++;

                // นับประเภทความดีให้ด้วย เพื่อให้กราฟเขยื้อน
                if(!userStats[tid].virtueCounts[virtue]) userStats[tid].virtueCounts[virtue] = 0;
                userStats[tid].virtueCounts[virtue]++;
            }
        });
    }

    // ✅ 2.3 คนที่ Verify (พยาน)
    if (interactions.verifies && interactions.verifies.length > 0) {
        interactions.verifies.forEach(function(v) {
            var vid = String(v.lineId || v.userId || v).trim();
            if (vid) {
                if (!userStats[vid]) userStats[vid] = { sumHappy: 0, count: 0, totalScore: 0, virtueCounts: {}, closeness: {}, lastActive: null };
                if (!userStats[vid].witnessCount) userStats[vid].witnessCount = 0;
                userStats[vid].witnessCount++;
            }
        });
    }

    // -----------------------------------------------------
    // 🛠️ คำนวณความสนิท (Closeness) - เหมือนเดิม
    // -----------------------------------------------------
    if (taggedStr !== "") {
      var timeDiff = Math.abs(today - timestamp);
      var diffDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      var weight = 0;
      if (diffDays <= 7) weight = 1.0; 
      else if (diffDays <= 30) weight = 0.8; 
      else if (diffDays <= 90) weight = 0.5; 

      if (weight > 0) {
        var taggedIds = taggedStr.split(',');
        taggedIds.forEach(function(taggedId) {
          taggedId = taggedId.trim();
          if (taggedId && taggedId !== uid) {
            // A -> B
            if (!userStats[uid].closeness[taggedId]) userStats[uid].closeness[taggedId] = 0;
            userStats[uid].closeness[taggedId] += weight;
            
            // B -> A (ต้อง init ให้ B ก่อนเผื่อ B ไม่เคยโพสต์เลย)
            if (!userStats[taggedId]) userStats[taggedId] = { sumHappy: 0, count: 0, totalScore: 0, virtueCounts: {}, closeness: {}, lastActive: null };
            
            if (!userStats[taggedId].closeness[uid]) userStats[taggedId].closeness[uid] = 0;
            userStats[taggedId].closeness[uid] += weight;
          }
        });
      }
    }
  }
  
  // 3. สรุปผล + 📉 หักคะแนนความสุข (Time Decay) - เหมือนเดิม
  Object.keys(userStats).forEach(function(k) {
    var s = userStats[k];
    var rawAvg = s.count > 0 ? (s.sumHappy / s.count) : 0;
    
    // หักคะแนนถ้าหายไปนาน (นับจาก lastActive ล่าสุด ซึ่งรวมการกดไลก์แล้ว)
    if (s.lastActive) {
        var diffTime = Math.abs(today - s.lastActive);
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        var decayCycles = Math.floor(diffDays / 3); 
        var penalty = decayCycles * 0.1; 
        rawAvg = Math.max(1.0, rawAvg - penalty);
    }

    var score10 = ((rawAvg - 1) / 2) * 10;
    // ป้องกันค่าแปลกๆ (NaN / Infinity)
    if (isNaN(score10)) score10 = 0;
    s.avgHappy = Math.round(Math.max(0, score10) * 10) / 10; 
    s.level = Math.floor(s.totalScore / 500) + 1;
    
    var sortedFriends = Object.keys(s.closeness).sort(function(a,b) { return s.closeness[b] - s.closeness[a]; });
    s.topFriends = [];
    for(var j=0; j < Math.min(2, sortedFriends.length); j++) {
      var fid = sortedFriends[j];
      var rawScore = s.closeness[fid];
      var displayScore = Number.isInteger(rawScore) ? rawScore : rawScore.toFixed(1);
      s.topFriends.push({ id: fid, name: userMapForCloseness[fid] || 'Unknown', count: displayScore });
    }
    
    var maxV = 0; var domV = 'none';
    for(var vKey in s.virtueCounts) {
       if(s.virtueCounts[vKey] > maxV) { maxV = s.virtueCounts[vKey]; domV = vKey; }
    }
    s.dominantVirtue = domV;
  });

  // 📌 4. สร้างกราฟเทรนด์ภาพรวม 365 วันย้อนหลัง (เพื่อให้กราฟหน้าบ้านนำไปสับแบ่งเองได้)
  var past365Data = [];
  var currentDay = new Date();
  var previousValue = 5.0; // ค่าเริ่มต้น (ยิ้มเฉยๆ) ถ้าสมมติว่าไม่มีข้อมูล
  
  for (var i = 364; i >= 0; i--) {
       var d = new Date();
       d.setDate(currentDay.getDate() - i);
       var dStr = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
       
       var arr = trendDateMap[dStr];
       if (arr && arr.length > 0) {
           var sum = 0;
           for(var j=0; j<arr.length; j++) {
               // แปลงอารมณ์ 1,2,3 เป็นคะแนนเต็ม 10
               var score10 = ((arr[j] - 1) / 2) * 10;
               sum += score10; 
           }
           previousValue = Math.round((sum / arr.length) * 10) / 10;
       }
       // ถ้าไม่มีข้อมูล แนะนำให้ดึงยอดวันก่อนหน้ามาเป็นค่า Base
       past365Data.push(previousValue);
  }

  return { userStats: userStats, overallTrend: past365Data };
}
  
// ... (ฟังก์ชันย่อย autoRescue, pushLineMessage, reassemble, updateUserScore, responseJSON คงเดิมไม่ต้องแก้) ...
function autoRescue(userId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var uSheet = ss.getSheetByName('Users');
  var users = uSheet.getDataRange().getValues();
  var userRowIndex = -1; var userData = null;
  for (var i = 1; i < users.length; i++) {
    if (String(users[i][5]) == String(userId)) { userRowIndex = i + 1; userData = users[i]; break; }
  }
  if (!userData) return responseJSON({ status: 'error', msg: 'User not found' });
  var lastRescueDate = userData[9]; var now = new Date();
  if (lastRescueDate instanceof Date) {
    var diffTime = Math.abs(now - lastRescueDate);
    var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays < 7) return responseJSON({ status: 'skip', msg: 'Cooldown active' });
  }
  var actSheet = ss.getSheetByName('Activities');
  var stats = calculateRealStats(actSheet.getDataRange().getValues(), users);
  var userStat = stats.userStats[userId];
  if (!userStat || !userStat.topFriends || userStat.topFriends.length === 0) return responseJSON({ status: 'skip', msg: 'No friends found' });
  var topFriends = userStat.topFriends;
  var friendNames = topFriends.map(function(f) { return f.name; }).join(" และ ");
  var targetName = userData[1];
  var messages = [{ "type": "text", "text": "🆘 ภารกิจด่วน! เพื่อนของคุณ \"" + targetName + "\" กำลังหมดไฟ ฝากดูแลด้วยนะ" }];
  topFriends.forEach(function(friend) { pushLineMessage(friend.id, messages); });
  uSheet.getRange(userRowIndex, 10).setValue(now); 
  return responseJSON({ status: 'success', msg: 'Rescue sent' });
}

function pushLineMessage(to, messages) {
  try { UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', { 'headers': { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ACCESS_TOKEN }, 'method': 'post', 'payload': JSON.stringify({ 'to': to, 'messages': messages }) }); } catch(e) {}
}

function reassembleAndSaveImage(uploadId, userName, totalChunks) {
  try {
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var fullBase64 = "";
    for (var i = 0; i < totalChunks; i++) {
      var files = folder.getFilesByName("temp_" + uploadId + "_" + i);
      if (files.hasNext()) { var file = files.next(); fullBase64 += file.getBlob().getDataAsString(); file.setTrashed(true); }
    }
    if (fullBase64.length > 0) {
      var contentType = "image/jpeg"; var base64Data = fullBase64;
      if (fullBase64.indexOf('base64,') > -1) { contentType = fullBase64.substring(5, fullBase64.indexOf(';')); base64Data = fullBase64.substr(fullBase64.indexOf('base64,') + 7); }
      var bytes = Utilities.base64Decode(base64Data);
      var blob = Utilities.newBlob(bytes, contentType, "Activity_" + userName + "_" + new Date().getTime() + ".jpg");
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return "https://lh3.googleusercontent.com/d/" + file.getId();
    }
    return "";
  } catch (e) { return "Error: " + e.toString(); }
}

function updateUserScore(sheet, userId, points) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][5] == userId) {
      var currentScore = Number(data[i][3]) || 0;
      sheet.getRange(i + 1, 4).setValue(currentScore + points);
      break;
    }
  }
}

function responseJSON(obj, callback) {
  var output = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + output + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// ⏳ ระบบ Time Decay (ลดพลังใจถ้าไม่เข้าใช้งาน)
// ==========================================

function runDailyTimeDecay() {
  console.log('🚨 คำเตือน: ฟังก์ชัน runDailyTimeDecay ถูกระงับการทำงานชั่วคราว!');
  console.log('สาเหตุ: ค่าความสุข (HappyScore) ไม่ได้ถูกบันทึกจริงในชีต Users (คอลัมน์ E คือ "Level" ไม่ใช่คะแนนความสุข)');
  console.log('หากรันฟังก์ชันนี้ จะทำให้ Level ของผู้ใช้ถูกแก้ไขจนเสียหายครับ');
  console.log('หมายเหตุ: ระบบลดค่าความสุขแบบอัตโนมัติ (Time Decay) มีทำงานอยู่แล้วตอนประมวลผลคำนวณกราฟในฟังก์ชัน calculateRealStats');
  return;
}

// 🌟 ฟังก์ชันอัปเดตสถานะ (อิงตามหัวตารางจริง Line_UID และ Role)
function updateUserRoleStatus(targetUserId, newRole) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users'); 
    if (!sheet) return responseJSON({status: 'error', message: 'ไม่พบชีต Users'});

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    // แปลงหัวตารางให้เป็นตัวพิมพ์เล็กทั้งหมดเพื่อป้องกันการพิมพ์ผิด (Line_UID จะกลายเป็น line_uid)
    var cleanHeaders = headers.map(function(h) { 
      return String(h).trim().toLowerCase(); 
    });
    
    // 🎯 ล็อคเป้าคอลัมน์ Role และ LineID ตรงๆ
    var roleColIndex = cleanHeaders.indexOf('role');
    var lineIdColIndex = cleanHeaders.indexOf('lineid'); 
    
    // Fallback if not found
    if (lineIdColIndex === -1) lineIdColIndex = cleanHeaders.indexOf('line_uid');
    if (lineIdColIndex === -1) lineIdColIndex = cleanHeaders.indexOf('line_id');
    if (lineIdColIndex === -1) lineIdColIndex = 5; // Column F

    // ดักจับ Error เผื่อหัวตารางหาย
    if (roleColIndex === -1) return responseJSON({status: 'error', message: 'หาคอลัมน์ Role ไม่พบครับ'});

    var targetIdClean = String(targetUserId).trim();

    // เริ่มวนลูปค้นหาจากบรรทัดที่ 2 เป็นต้นไป
    for (var i = 1; i < data.length; i++) {
      var currentLineId = String(data[i][lineIdColIndex]).trim();
      
      // ถ้า Line_UID ตรงกันเป๊ะ
      if (currentLineId === targetIdClean) {
        // อัปเดตตำแหน่งลงไปในช่อง Role ทันที
        sheet.getRange(i + 1, roleColIndex + 1).setValue(newRole);
        return responseJSON({status: 'success', message: 'อัปเดตสถานะสำเร็จ!'});
      }
    }

    // ถ้าหาไม่เจอจริงๆ
    return responseJSON({status: 'error', message: 'หารหัสผู้ใช้นี้ไม่พบ: "' + targetIdClean + '"'});

  } catch (err) {
    return responseJSON({status: 'error', message: err.toString()});
  }
}

// ฟังก์ชันช่วยสร้าง JSON ส่งกลับไปหน้าบ้าน (ถ้าในโค้ดมีอยู่แล้วไม่ต้องก๊อปไปซ้ำครับ)
function createJsonResponse(status, message) {
  return ContentService.createTextOutput(JSON.stringify({
    status: status,
    message: message
  })).setMimeType(ContentService.MimeType.JSON);
}