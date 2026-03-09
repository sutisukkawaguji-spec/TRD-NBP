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
          if (!item) return null;
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
            user_role: poster.role || '',
            taggedFriends: row[3],
            tagged_avatars: taggedAvatars,
            virtue: row[5], 
            image: row[6], 
            happy: row[7], 
            note: row[8],
            likes: getAvatars(interactions.likes),     
            verifies: getAvatars(interactions.verifies),
            status: row[10] || 'waiting_verify',
            score: row[11] || 0,
            privacy: privacyVal 
          });
          count++;
        } catch (e) {}
      }
      return responseJSON({ feed: feed, userMap: userMap }, e.parameter.callback);
    }

    if (action === 'get_user_posts') {
      var targetId = e.parameter.userId;
      if (!targetId) return responseJSON({status: 'error', message: 'Missing userId'});
      
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
          if (!item) return null;
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
      var limit = parseInt(e.parameter.limit) || 100;
      var count = 0;
      for (var i = actData.length - 1; i >= 1; i--) {
        if (count >= limit) break;
        try {
          var row = actData[i];
          if (!row[2]) continue;
          if (String(row[2]).trim() !== String(targetId).trim()) continue;

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

          feed.push({
            id: i, timestamp: row[0], user_name: poster.name, user_img: poster.img,
            user_line_id: uid, user_role: poster.role || '', taggedFriends: row[3], tagged_avatars: taggedAvatars,
            virtue: row[5], image: row[6], happy: row[7], note: row[8],
            likes: getAvatars(interactions.likes), verifies: getAvatars(interactions.verifies),
            status: row[10] || 'waiting_verify',
            score: row[11] || 0,
            privacy: (row.length > 12) ? row[12] : 'public'
          });
          count++;
        } catch (e) {}
      }
      return responseJSON({ status: 'success', feed: feed, userMap: userMap }, e.parameter.callback);
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
    } // <-- เพิ่มเครื่องหมายปีกกาปิดตรงนี้
    else if (action == 'promote_alumni') {
      var d = new Date();
      var thaiYear = d.getFullYear() + 543;
      var newLabel = data.label ? data.label + ' ปี ' + thaiYear : 'ศิษย์เก่า ปี ' + thaiYear;
      return updateUserRoleStatus(data.userId, newLabel, data.score);
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
        var userSheet = ss.getSheetByName('Users');
        var rowIndex = parseInt(data.postId) + 1;
        var requesterId = data.userId;

        if (!actSheet || rowIndex < 2 || rowIndex > actSheet.getLastRow()) {
          return responseJSON({ status: 'error', message: 'ไม่พบโพสต์' });
        }

        var row = actSheet.getRange(rowIndex, 1, 1, actSheet.getLastColumn()).getValues()[0];
        var postOwner = row[2]; // Column C = userId
        
        // --- Permission Check (Only owner OR Admin/Manager can edit) ---
        var canEdit = (String(postOwner) === String(requesterId));

        if (!canEdit) {
           var userData = userSheet.getDataRange().getValues();
           var headers = userData[0].map(function(h) { return String(h).trim().toLowerCase(); });
           var roleIdx = headers.indexOf('role');
           var lineIdIdx = headers.indexOf('lineid');
           if (lineIdIdx === -1) lineIdIdx = headers.indexOf('line_id');
           if (lineIdIdx === -1) lineIdIdx = headers.indexOf('line_uid');
           if (lineIdIdx === -1) lineIdIdx = headers.indexOf('line uid');
           if (lineIdIdx === -1) lineIdIdx = 5; // Fallback to F
           if (roleIdx === -1) roleIdx = 2;    // Fallback to C

           for (var i = 1; i < userData.length; i++) {
             var currentUid = String(userData[i][lineIdIdx]).trim();
             if (currentUid === String(requesterId).trim()) {
               var role = String(userData[i][roleIdx] || "").toLowerCase();
               if (/admin|ผู้ดูแล|ผู้บริหาร|manager/i.test(role)) {
                 canEdit = true;
               }
               break;
             }
           }
        }

        if (!canEdit) {
          return responseJSON({ status: 'error', message: 'ไม่มีสิทธิ์แก้ไขโพสต์นี้ (เฉพาะเจ้าของหรือผู้ดูแลระบบเท่านั้นที่แก้ไขได้)' });
        }

        // อัปเดต Note (Column I = index 8 in code, 9 in Sheet)
        var noteColIndex = 9; 
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
        if (interactionData.likes[k] && String(interactionData.likes[k].lineId) === String(userId)) {
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

    // --- 4. บันทึกกิจกรรม (Save Activity - กฎใหม่ 1.1, 1.2) ---
    if (action == 'save_activity') {
      var actSheet = ss.getSheetByName('Activities');
      var userSheet = ss.getSheetByName('Users');
      if (!actSheet || !userSheet) return responseJSON({status: 'error', message: 'Sheets missing'});

      // 1. จัดการสื่อ
      var imageUrl = data.image || ""; 
      if (data.uploadId) {
        imageUrl = reassembleAndSaveImage(data.uploadId, data.userName, data.totalChunks);
      }
      if (data.isOnlyUpload) {
         return responseJSON({ status: 'success', url: imageUrl });
      }

      // 2. ตั้งค่าตัวแปร (คะแนน และ สถานะ) ตามกฎใหม่
      var scoreToAdd = 0;
      var status = "waiting_verify";

      if (data.privacy === 'private') {
         scoreToAdd = 0;
         status = "private"; 
      } else {
         // ตรวจสอบโพสต์ระดับองค์กร (> 50%)
         var totalStaff = getActiveStaffCount(ss);
         var taggedList = data.taggedFriends ? String(data.taggedFriends).split(',').filter(Boolean) : [];
         var tagCount = taggedList.length;

         if (tagCount > (totalStaff * 0.5)) {
            // โพสต์ระดับองค์กร: อนุมัติทันที +10 XP
            scoreToAdd = 10;
            status = "approved";
         } else {
            // โพสต์เดี่ยว/กลุ่ม: 0 XP ณ ตอนโพสต์ จนกว่าจะ Verify ครบ
            scoreToAdd = 0;
            status = "waiting_verify";
         }
      }

      var initialInteractions = JSON.stringify({ likes: [], verifies: [] });

      // 4. บันทึกลงชีต
      actSheet.appendRow([
        new Date(), Utilities.getUuid(), data.userId, data.taggedFriends, data.userName,
        data.virtueTag, imageUrl, data.happyLevel, data.note, initialInteractions,
        status, scoreToAdd, data.privacy
      ]);

      // 5. อัปเดตคะแนน (เฉพาะกรณี Approved ทันที)
      if (scoreToAdd > 0) {
        updateUserScore(userSheet, data.userId, scoreToAdd);
        if (data.taggedFriends) {
           var friendIds = data.taggedFriends.toString().split(',');
           for (var i = 0; i < friendIds.length; i++) {
             updateUserScore(userSheet, friendIds[i].trim(), scoreToAdd); 
           }
        }
      }
      return responseJSON({status: 'success', score: scoreToAdd});
    }

    // --- 5. ยืนยันความถูกต้อง (Verify) - กฎใหม่ 2 ⚠️ ---
    if (action == 'verify_solo' || action == 'verify_post') {
      var userSheet = ss.getSheetByName('Users');
      var actSheet = ss.getSheetByName('Activities');
      
      var rowIdx = parseInt(data.postId) + 1;
      var cellJSON = actSheet.getRange(rowIdx, 10);
      var cellStatus = actSheet.getRange(rowIdx, 11);
      var cellScore = actSheet.getRange(rowIdx, 12);

      var interactions = { likes: [], verifies: [] };
      try { if(cellJSON.getValue()) interactions = JSON.parse(cellJSON.getValue()); } catch(e) {}
      
      var witnessId = String(data.witnessId || data.userId || data.verifierId);

      // 🚫 กฎ: ห้ามคนโพสต์หรือคนถูกแท็กยืนยันตัวเอง
      var rowData = actSheet.getRange(rowIdx, 1, 1, 13).getValues()[0];
      var ownerId = String(rowData[2]);
      var taggedIds = String(rowData[3] || "").split(',').map(function(s){ return s.trim(); });

      if (witnessId === ownerId || taggedIds.indexOf(witnessId) > -1) {
        return responseJSON({status: 'error', message: 'คุณไม่สามารถยืนยันโพสต์ตนเองหรือสมาชิกในทีมได้ครับ'});
      }

      // เช็คว่าเคยกดไหม
      if (interactions.verifies.indexOf(witnessId) === -1) {
        interactions.verifies.push(witnessId);
        cellJSON.setValue(JSON.stringify(interactions));
        
        // 1. ให้คะแนนพยาน +3 (เฉพาะ 2 คนแรก)
        if (interactions.verifies.length <= 2) {
           updateUserScore(userSheet, witnessId, 3);
        }

        // 2. เมื่อครบ 2 คน -> อนุมัติโพสต์และแจกแต้มชุดใหญ่
        if (interactions.verifies.length === 2 && cellStatus.getValue() === "waiting_verify") {
           // ให้เจ้าของ +10
           updateUserScore(userSheet, ownerId, 10);
           // ให้ทีมทุกคน +10
           if (rowData[3]) {
              var friends = String(rowData[3]).split(',');
              friends.forEach(function(fid) { updateUserScore(userSheet, fid.trim(), 10); });
           }
           cellStatus.setValue("approved");
           cellScore.setValue(10);
           return responseJSON({status: 'success', message: 'ยืนยันครบถ้วน! โพสต์นี้ได้รับอนุมัติ (+10 XP)'});
        }
        
        return responseJSON({status: 'success', message: 'บันทึกพยานแล้ว (+3 XP)'});
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
          version: "3.2.0",  // 🔧 อัปเดตตัวเลขนี้เพื่อเปิดหน้าต่างแจ้งเตือน What's New
          title: "🔥 อัปเดตใหญ่! ระบบทำเนียบและเกียรติยศ",
          message: "<div class='text-start' style='font-size:0.85rem;line-height:1.6;'><span class='badge bg-primary mb-2'>Version 3.2.0</span><br>" +
                   "✅ <b>ระบบทำเนียบ (Hall of Fame):</b> ปรับปรุงหน้าประวัติให้สมบูรณ์แบบ เห็นรายชื่อผู้ร่วมผูกพันสายใยสูงสุด<br>" +
                   "✅ <b>แช่แข็งคะแนนเกียรติยศ:</b> ผู้ที่ขึ้นทำเนียบจะถูกล็อกคะแนน XP สูงสุดไว้เป็นถาวร ไม่ลดลงตามกาลเวลา<br>" +
                   "✅ <b>แยกสัดส่วนการบริหาร:</b> หน้าสถานะบุคลากรจะแสดงเฉพาะเจ้าหน้าที่ปัจจุบันเพื่อให้ง่ายต่อการจัดการ<br>" +
                   "✅ <b>รายชื่อแท็กโพสต์:</b> กรองรายชื่อเฉพาะเจ้าหน้าที่ปัจจุบัน ทำให้เลือกเพื่อนร่วมงานได้รวดเร็วขึ้น<br>" +
                   "✅ <b>อัปเดตแบบ Realtime:</b> ทุกการเปลี่ยนตำแหน่งจะแสดงผลทันทีไม่ต้องรีโหลดหน้าจอ</div>",

          // 🔔 ข้อความแจ้งเตือนใน App (กระดิ่ง)
          notifications: [
            {
              id: "notif_20260308_v320",
              title: "🏆 ระบบทำเนียบคนดี v3.2.0",
              body: "ระบบทำเนียบเกียรติยศและระบบแช่แข็งคะแนนเปิดใช้งานแล้วครับ! ตรวจสอบรายชื่อรุ่นพี่ได้ที่หน้า Relation นะครับ 😊",
              time: "8 มี.ค. 2569"
            },
            {
              id: "notif_20260227_001",
              title: "📢 ยินดีต้อนรับสู่ระบบ ดี มีสุข!",
              body: "เริ่มบันทึกกิจกรรมความดีของคุณได้เลยครับ 😊",
              time: "27 ก.พ. 2569"
            }
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

          // แบบนี้ถ้าผู้ใช้เปลี่ยนรูปในไลน์แล้วแตกต่างจากในระบบ (และไม่ใช่ dummyimage) ให้บันทึกเพื่ออัปเดตใหม่
          if (data.img && data.img !== userData[i][6] && !data.img.includes('dummyimage')) {
            userSheet.getRange(i + 1, 7).setValue(data.img);
            userData[i][6] = data.img;
          }

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

// --- 🎯 Helper: นับจำนวนบุคลากรปัจจุบัน (ไม่รวมศิษย์เก่า) ---
function getActiveStaffCount(ss) {
  var userSheet = ss.getSheetByName('Users');
  if (!userSheet) return 1;
  var data = userSheet.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var role = String(data[i][2] || "").toLowerCase();
    if (data[i][1] && !/alumni|ศิษย์เก่า|retired|student/i.test(role)) {
      count++;
    }
  }
  return count || 1;
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

    var privacyVal = (row.length > 12) ? row[12] : 'public';

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

    // ✅ 2.1 คนโพสต์: (สะสมความสุข/จำนวนโพสต์)
    updateHappyStats(uid, happy, timestamp);
    if (!userStats[uid].postsMade) userStats[uid].postsMade = 0;
    userStats[uid].postsMade++;

    // 🌟 กฎใหม่: กราฟความดี (Virtue Radar)
    // 2. แต้มหมวดกิจกรรมและโบนัส จะคิดเมื่อสถานะ Approved แล้วเท่านั้น
    if (row[10] === 'approved') {
       // กิจกรรมหลัก: ได้แต้มปกติ (+1)
       if(!userStats[uid].virtueCounts[virtue]) userStats[uid].virtueCounts[virtue] = 0;
       userStats[uid].virtueCounts[virtue]++;

       // 💎 โบนัสความสุจริต (Integrity Bonus): 
       // ถ้า "ไม่ใช่วิชาหลัก" และเป็นโพสต์สาธารณะ ให้ +0.5 เป็นค่าความโปร่งใส
       if (virtue !== 'integrity' && privacyVal !== 'private') {
          if(!userStats[uid].virtueCounts['integrity']) userStats[uid].virtueCounts['integrity'] = 0;
          userStats[uid].virtueCounts['integrity'] += 0.5;
       }

       // เพื่อนในทีมก็ได้ผลบุญ (กราฟ) ไปด้วย
       if (taggedStr !== "") {
          var tList = taggedStr.split(',').map(function(s){ return s.trim(); });
          tList.forEach(function(tid) {
             if (tid) {
                if(!userStats[tid]) userStats[tid] = { sumHappy: 0, count: 0, totalScore: 0, virtueCounts: {}, closeness: {}, lastActive: null };
                if(!userStats[tid].virtueCounts[virtue]) userStats[tid].virtueCounts[virtue] = 0;
                userStats[tid].virtueCounts[virtue]++;
             }
          });
       }
    }

    // ✅ 2.2 สถานะความสุขอัปเดตให้คนในทีม
    if (taggedStr !== "") {
        var taggedIds = taggedStr.split(',').map(function(s) { return s.trim(); });
        taggedIds.forEach(function(tid) {
            if (tid) {
                updateHappyStats(tid, happy, timestamp);
                if (!userStats[tid].taggedIn) userStats[tid].taggedIn = 0;
                userStats[tid].taggedIn++;
            }
        });
    }

    // ✅ 2.3 คนที่ Verify (พยาน)
    if (interactions.verifies && interactions.verifies.length > 0) {
        interactions.verifies.forEach(function(v) {
            if (!v) return;
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
  
  // 3. สรุปผล + 📉 หักคะแนนความสุข (Time Decay)
  Object.keys(userStats).forEach(function(k) {
    var s = userStats[k];
    
    // 🌟 กฎใหม่: คะแนนความสุขเพิ่มขึ้น 1.5 ต่อโพสต์ (สำหรับระดับยิ้มแย้ม=3)
    // คำนวณจาก (ผลรวมระดับความสุข * 0.5) 
    // เช่น: โพสต์ยิ้ม (3) +1.5 แต้ม, โพสต์เฉย (2) +1.0 แต้ม, โพสต์เศร้า (1) +0.5 แต้ม
    var baseHappyScore = s.sumHappy * 0.5;

    // หักคะแนนถ้าหายไปนาน (Penalty 0.5 คะแนนต่อ 3 วัน)
    var penalty10 = 0;
    if (s.lastActive) {
        var diffTime = Math.abs(today - s.lastActive);
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        var decayCycles = Math.floor(diffDays / 3); 
        penalty10 = decayCycles * 0.5; 
    }

    var finalScore = Math.min(10, Math.max(0, baseHappyScore - penalty10));
    if (isNaN(finalScore)) finalScore = 0;
    s.avgHappy = Math.round(finalScore * 10) / 10; 
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
function updateUserRoleStatus(targetUserId, newRole, optionalScore) {
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
    var scoreColIndex = cleanHeaders.indexOf('score');
    
    // Fallback if not found
    if (lineIdColIndex === -1) lineIdColIndex = cleanHeaders.indexOf('line_uid');
    if (lineIdColIndex === -1) lineIdColIndex = cleanHeaders.indexOf('line_id');
    if (lineIdColIndex === -1) lineIdColIndex = 5; // Column F
    if (scoreColIndex === -1) scoreColIndex = 3; // Column D (Score)

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
        
        // ถ้ามีคะแนนส่งมาด้วย (เช่น ตอนแช่คะแนนขึ้นทำเนียบ) ให้ปรับคะแนนในชีตให้เป็นปัจจุบันด้วย
        if (optionalScore !== undefined && optionalScore !== null) {
          sheet.getRange(i + 1, scoreColIndex + 1).setValue(Number(optionalScore));
        }
        
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