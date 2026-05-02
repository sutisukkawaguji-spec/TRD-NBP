// --- ⚙️ ตั้งค่า (ระบุ ID ชีตโดยตรงเพื่อความแม่นยำ) ---
var SHEET_ID = '1VL286epbNGfEVBuIwfmdMcaP5CZiuT5kJhmC_aR4b5E'; 
var FOLDER_ID = '1B0ksTsrpCBy2yxMOGWC1sSTRYnQ55Ye7'; 
var ACCESS_TOKEN = 'c88f2c8c819e455eaf3b24b6b085374b';
var WEATHER_API_KEY = '0327003ee31fbf98951434c6b2fcea7d';
var DEFAULT_CITY = 'Nong Bua Lam Phu';

// --- Cloudinary Settings (สำหรับลบรูป) ---
var CLOUDINARY_CLOUD_NAME = 'dzh88q2fr';
var CLOUDINARY_API_KEY = 'YOUR_API_KEY_HERE';
var CLOUDINARY_API_SECRET = 'YOUR_API_SECRET_HERE';

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
         if (name === 'Users' || name === 'Activities' || name === 'Announcements' || name === 'Visits' || name === 'Rewards' || name === 'Claims') {
            s = ss.insertSheet(name);
            if (name === 'Users') s.appendRow(['ID', 'Name', 'Role', 'Score', 'Level', 'LineID', 'Image', 'Department', 'Office', 'LastDate', 'LastTime', 'VisitCount']);
            if (name === 'Activities') s.appendRow(['Date', 'Time', 'UUID', 'UserId', 'Tagged', 'UserName', 'Virtue', 'Image', 'Happy', 'Note', 'JSON', 'Status', 'Score', 'Privacy']);
            if (name === 'Announcements') s.appendRow(['ID', 'Title', 'Body', 'EventDate', 'EventTime', 'Category', 'PostedBy', 'Date', 'Time']);
            if (name === 'Visits') s.appendRow(['Date', 'Time', 'UserId', 'UserName']);
            if (name === 'Rewards') s.appendRow(['ID', 'Name', 'Image', 'Mode', 'TargetVal', 'EndDate', 'Status', 'Date', 'Time']);
            if (name === 'Claims') s.appendRow(['ClaimID', 'RewardID', 'UserID', 'UserName', 'Date', 'Time']);
         }
      }
      return s;
    };

    if (action === 'get_weather') {
      return responseJSON(fetchWeatherData(ss), e.parameter.callback);
    }

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
          var id = (typeof item === 'object') ? (item.userId || item.lineId || item.id) : item;
          var u = userMap[String(id).trim()];
          if (u) return JSON.parse(JSON.stringify(u));
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
          if (!row[3]) continue; // UserId อยู่ index 3

          var uid = String(row[3]).trim();
          var poster = userMap[uid] || { name: 'Unknown', img: 'https://dummyimage.com/90x90/cccccc/ffffff&text=User' };
          
          var interactions = { likes: [], verifies: [] };
          try { if(row[10]) interactions = JSON.parse(row[10]); } catch(e) {}
          
          var taggedAvatars = [];
          if (row[4]) {
             var tIds = String(row[4]).split(',');
             taggedAvatars = tIds.map(function(tid) {
                return userMap[String(tid).trim()] || null;
             }).filter(Boolean);
          }

          var privacyVal = (row.length > 13) ? row[13] : 'public'; 

          feed.push({
            id: i, 
            timestamp: row[0] + ' ' + row[1], // รวมวันที่และเวลาเพื่อส่งให้ Frontend
            date: row[0],
            time: row[1],
            user_name: poster.name, 
            user_img: poster.img,
            user_line_id: uid, 
            user_role: poster.role || '',
            taggedFriends: row[4],
            tagged_avatars: taggedAvatars,
            virtue: row[6], 
            image: row[7], 
            happy: parseFloat(row[8]) || 0,
            note: String(row[9] || ""),
            interactions: interactions,
            verifies: getAvatars(interactions.verifies || []),
            status: row[11] || 'waiting_verify',
            score: parseInt(row[12]) || 0,
            privacy: privacyVal,
            uuid: row[2] || ""
          });
          count++;
        } catch (e) {}
      }
      return responseJSON({ feed: feed, userMap: userMap, totalCount: actData.length - 1 }, e.parameter.callback);
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
          var id = (typeof item === 'object') ? (item.userId || item.lineId || item.id) : item;
          var u = userMap[String(id).trim()];
          if (u) return JSON.parse(JSON.stringify(u));
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
          if (!row[3]) continue;
          if (String(row[3]).trim() !== String(targetId).trim()) continue;

          var uid = String(row[3]).trim();
          var poster = userMap[uid] || { name: 'Unknown', img: 'https://dummyimage.com/90x90/cccccc/ffffff&text=User' };
          var interactions = { likes: [], verifies: [] };
          try { if(row[10]) interactions = JSON.parse(row[10]); } catch(e) {}
          
          var taggedAvatars = [];
          if (row[4]) {
             var tIds = String(row[4]).split(',');
             taggedAvatars = tIds.map(function(tid) {
                return userMap[String(tid).trim()] || null;
             }).filter(Boolean);
          }

          feed.push({
            id: i, timestamp: row[0] + ' ' + row[1], user_name: poster.name, user_img: poster.img,
            user_line_id: uid, user_role: poster.role || '', taggedFriends: row[4], tagged_avatars: taggedAvatars,
            virtue: row[6], image: row[7], happy: row[8], note: row[9],
            likes: getAvatars(interactions.likes), verifies: getAvatars(interactions.verifies),
            status: row[11] || 'waiting_verify',
            score: row[12] || 0,
            privacy: (row.length > 13) ? row[13] : 'public',
            uuid: row[2] || ''
          });
          count++;
        } catch (e) {}
      }
      var totalCount = 0;
      for (var j = 1; j < actData.length; j++) {
        if (String(actData[j][2]).trim() === String(targetId).trim()) totalCount++;
      }
      return responseJSON({ status: 'success', feed: feed, userMap: userMap, totalCount: totalCount }, e.parameter.callback);
    }

    if (action === 'get_users' || action === 'get_dashboard') {
      var userSheet = getSheet('Users');
      var actSheet = getSheet('Activities');
      var userRows = userSheet.getDataRange().getValues();
      var stats = calculateRealStats(actSheet.getDataRange().getValues(), userRows);
      
      // 🎯 เจาะจงลำดับคอลัมน์ตามโครงสร้างที่ระบุ:
      // 0:ID, 1:Name, 2:Role, 3:Score, 4:Level, 5:Line_UID, 6:Picture, 7:Department, 8:Pending_Home
      var col = {
        id: 0,
        name: 1,
        role: 2,
        score: 3,
        level: 4,
        lineUid: 5,
        img: 6
      };

      var users = [];
      for (var i = 1; i < userRows.length; i++) {
        if(userRows[i][col.name]) {
          var uid = String(userRows[i][col.lineUid] || "").trim();
          var s = stats.userStats[uid] || { totalScore: 0, level: 1 };
          var dbScore = Number(userRows[i][col.score]) || 0;
          var finalScore = Math.max(s.totalScore, dbScore);
          var finalLevel = Math.floor(finalScore / 500) + 1;

          users.push({
            id: userRows[i][col.id], 
            name: userRows[i][col.name], 
            role: userRows[i][col.role],
            score: finalScore, 
            happy: s.avgHappy || 0, 
            img: userRows[i][col.img], 
            lineId: uid,
            level: finalLevel, 
            virtueStats: s.virtueCounts || {},
            totalCount: s.postsMade || 0, 
            taggedCount: s.taggedIn || 0, 
            witnessCount: s.witnessCount || 0,
            dominantVirtue: s.dominantVirtue, 
            topFriends: s.topFriends || [],
            firstActive: s.firstActive ? s.firstActive.toISOString() : null
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
            // 📅 แสดงผลย้อนหลัง 30 วัน (แทนที่ 7 วันเดิม) เพื่อความต่อเนื่อง
            if (eventDate.getTime() < (today.getTime() - (86400000 * 30))) showThis = false;
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
      // เรียงลำดับตาม Timestamp ล่าสุดขึ้นก่อน
      result.sort(function(a, b) {
        var tA = a.ts ? new Date(a.ts).getTime() : 0;
        var tB = b.ts ? new Date(b.ts).getTime() : 0;
        return tB - tA;
      });
      return responseJSON({ announcements: result }, e.parameter.callback);
    }

    if (action === 'get_rewards') {
      var rwSheet = getSheet('Rewards');
      var rows = rwSheet.getDataRange().getValues();
      var rewards = [];
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (!row[0]) continue;
        rewards.push({
          id: row[0],
          name: row[1],
          image: row[2],
          mode: row[3], 
          targetVal: Number(row[4]) || 0,
          createdTs: row[5] ? new Date(row[5]).getTime() : 0,
          endDate: row[6] || '',
          status: row[7] || 'active'
        });
      }
      
      // Fetch Claims (safe - sheet may not exist yet)
      var claims = [];
      try {
        var clSheet = ss.getSheetByName('Claims');
        if (clSheet) {
          var clRows = clSheet.getDataRange().getValues();
          for (var j = 1; j < clRows.length; j++) {
            var clRow = clRows[j];
            if (!clRow[0]) continue;
            claims.push({
              rewardId: clRow[1],
              userId: clRow[2],
              userName: clRow[3],
              timestamp: clRow[4]
            });
          }
        }
      } catch(clErr) { Logger.log('Claims fetch error: ' + clErr); }
      
      return responseJSON({ rewards: rewards, claims: claims }, e.parameter.callback);
    }

    if (action === 'get_weather') {
      return responseJSON(fetchWeatherData(ss), e.parameter.callback);
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
  try {
    if (!e || !e.postData || !e.postData.contents) {
       return responseJSON({status: 'error', message: 'No post data received'});
    }
    var data;
    try {
        data = JSON.parse(e.postData.contents);
    } catch(parseErr) {
        return responseJSON({status: 'error', message: 'Invalid JSON: ' + parseErr.toString()});
    }
    var action = data.action;
    Logger.log("doPost received action: " + action);
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

    // --- 🏃 New Action: Track App Entry (Optimized: No long records) ---
    if (action === 'track_visit') {
      var uSheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
      var uData = uSheet.getDataRange().getValues();
      var userId = String(data.userId || '').trim();
      
      // 1. Update LastVisit and VisitCount in Users sheet
      // Column K (10) = LastVisit, Column L (11) = VisitCount
      // Column J (10) = LastDate, Column K (11) = LastTime, Column L (12) = VisitCount
      var now = new Date();
      for (var i = 1; i < uData.length; i++) {
        if (String(uData[i][5]).trim() === userId) {
          uSheet.getRange(i + 1, 10).setValue(Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd")); // LastDate
          uSheet.getRange(i + 1, 11).setValue(Utilities.formatDate(now, "GMT+7", "HH:mm:ss"));    // LastTime
          var currentCount = Number(uData[i][11]) || 0;
          uSheet.getRange(i + 1, 12).setValue(currentCount + 1); // VisitCount
          break;
        }
      }
      
      // 2. Update DailyVisits summary for HMI Graph
      var dvSheet = ss.getSheetByName('DailyVisits') || ss.insertSheet('DailyVisits');
      if (dvSheet.getLastRow() === 0) dvSheet.appendRow(['Date', 'Count']);
      
      var today = new Date();
      today.setHours(0,0,0,0);
      var dvData = dvSheet.getDataRange().getValues();
      var foundToday = false;
      
      for (var j = 1; j < dvData.length; j++) {
        var d = new Date(dvData[j][0]);
        d.setHours(0,0,0,0);
        if (d.getTime() === today.getTime()) {
          dvSheet.getRange(j + 1, 2).setValue((Number(dvData[j][1]) || 0) + 1);
          foundToday = true;
          break;
        }
      }
      if (!foundToday) {
        dvSheet.appendRow([today, 1]);
      }
      
      return responseJSON({ status: 'success' });
    }

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
    
    if (action == 'promote_alumni') {
      var d = new Date();
      var thaiYear = d.getFullYear() + 543;
      var newLabel = data.label ? data.label + ' ปี ' + thaiYear : 'ศิษย์เก่า ปี ' + thaiYear;
      return updateUserRoleStatus(ss, data.userId, newLabel, data.score);
    } 
    
    if (action == 'update_role') {
      return updateUserRoleStatus(ss, data.userId, data.role);
    }

    // -----------------------------------------------------------
    // 🗑️ ACTION: DELETE POST (ลบโพสต์ + หักคะแนน)
    // -----------------------------------------------------------
    if (action == 'delete_post') {
      try {
        var actSheet = ss.getSheetByName('Activities');
        var userSheet = ss.getSheetByName('Users');
        var requesterId = data.userId;
        
        var rowIndex = findRowIndexByPostId(actSheet, data.postId);
        if (rowIndex === -1) {
          return responseJSON({ status: 'error', message: 'ไม่พบโพสต์ที่ต้องการลบ (กรุณารีเฟรชหน้าจอ)' });
        }

        var row = actSheet.getRange(rowIndex, 1, 1, actSheet.getLastColumn()).getValues()[0];
        var postOwner = row[2]; 
        var postScore = parseInt(row[11]) || 0; 
        var postImages = row[6] || ""; 

        var postOwnerVal = String(postOwner).trim();
        var requesterIdVal = String(requesterId).trim();
        var canDelete = (postOwnerVal === requesterIdVal);

        if (!canDelete) {
           var userData = userSheet.getDataRange().getValues();
           var headers = userData[0].map(function(h) { return String(h).trim().toLowerCase(); });
           var roleIdx = headers.indexOf('role');
           var lineIdIdx = headers.indexOf('lineid');
           if (lineIdIdx === -1) lineIdIdx = headers.indexOf('line_id');
           if (lineIdIdx === -1) lineIdIdx = headers.indexOf('line_uid');

           for (var i = 1; i < userData.length; i++) {
             if (String(userData[i][lineIdIdx]).trim() === requesterIdVal) {
               var role = String(userData[i][roleIdx] || "").toLowerCase();
               if (/admin|ผู้ดูแล|ผู้บริหาร|manager|บรรณาธิการ|newseditor/i.test(role)) {
                 canDelete = true;
               }
               break;
             }
           }
        }

        if (!canDelete) {
          return responseJSON({ status: 'error', message: 'ไม่มีสิทธิ์ลบโพสต์นี้ (เฉพาะเจ้าของหรือผู้ดูแลระบบ)' });
        }

        var scoreDeducted = postScore;
        if (scoreDeducted > 0) {
            var userData = userSheet.getDataRange().getValues();
            for (var i = 1; i < userData.length; i++) {
              if (String(userData[i][5]).trim() === String(postOwner).trim()) { 
                var currentScore = parseInt(userData[i][3]) || 0; 
                userSheet.getRange(i + 1, 4).setValue(Math.max(0, currentScore - scoreDeducted));
                break;
              }
            }
        }

        actSheet.deleteRow(rowIndex);

        if (postImages) {
          var urls = postImages.split(',');
          urls.forEach(function(url) {
            deleteFromCloudinary(url.trim());
          });
        }

        return responseJSON({ status: 'success', scoreDeducted: scoreDeducted });
      } catch(err) {
        return responseJSON({ status: 'error', message: err.toString() });
      }
    }

    // -----------------------------------------------------------
    // ✏️ ACTION: EDIT POST (แก้ไขข้อความ)
    // -----------------------------------------------------------
    if (action == 'edit_post') {
      try {
        var actSheet = ss.getSheetByName('Activities');
        var userSheet = ss.getSheetByName('Users');
        var requesterId = data.userId;

        var rowIndex = findRowIndexByPostId(actSheet, data.postId);
        if (rowIndex === -1) {
          return responseJSON({ status: 'error', message: 'ไม่พบโพสต์ที่ต้องการแก้ไข (กรุณารีเฟรชหน้าจอ)' });
        }

        var row = actSheet.getRange(rowIndex, 1, 1, actSheet.getLastColumn()).getValues()[0];
        var postOwner = row[2]; 
        
        var postOwnerVal = String(postOwner).trim();
        var requesterIdVal = String(requesterId).trim();
        var canEdit = (postOwnerVal === requesterIdVal);

        if (!canEdit) {
           var userData = userSheet.getDataRange().getValues();
           var headers = userData[0].map(function(h) { return String(h).trim().toLowerCase(); });
           var roleIdx = headers.indexOf('role');
           var lineIdIdx = headers.indexOf('lineid');
           if (lineIdIdx === -1) lineIdIdx = headers.indexOf('line_id');
           if (lineIdIdx === -1) lineIdIdx = headers.indexOf('line_uid');

           for (var i = 1; i < userData.length; i++) {
             if (String(userData[i][lineIdIdx]).trim() === requesterIdVal) {
               var role = String(userData[i][roleIdx] || "").toLowerCase();
               if (/admin|ผู้ดูแล|ผู้บริหาร|manager|บรรณาธิการ|newseditor/i.test(role)) {
                 canEdit = true;
               }
               break;
             }
           }
        }

        if (!canEdit) {
          return responseJSON({ status: 'error', message: 'ไม่มีสิทธิ์แก้ไขโพสต์นี้ (เฉพาะเจ้าของหรือผู้ดูแลระบบที่แก้ไขได้)' });
        }

        var virtueColIndex = 6;
        var imageColIndex = 7;
        var noteColIndex = 9; 

        actSheet.getRange(rowIndex, noteColIndex).setValue(data.newNote || '');
        if (data.newVirtue) actSheet.getRange(rowIndex, virtueColIndex).setValue(data.newVirtue);
        
        if (data.newImage !== undefined) {
          actSheet.getRange(rowIndex, imageColIndex).setValue(data.newImage);
        }

        if (data.removedImages && Array.isArray(data.removedImages)) {
          data.removedImages.forEach(function(url) {
            deleteFromCloudinary(url.trim());
          });
        }

        return responseJSON({ status: 'success' });
      } catch(err) {
        return responseJSON({ status: 'error', message: err.toString() });
      }
    }

    if (action == 'trigger_auto_rescue') {
      return autoRescue(data.userId);
    }
    
    if (action == 'save_survey') {
      var uSheet = ss.getSheetByName('Users');
      var users = uSheet.getDataRange().getValues();
      var uid = String(data.userId).trim();
      for (var i = 1; i < users.length; i++) {
        if (String(users[i][5]).trim() === uid) {
          uSheet.getRange(i+1, 11).setValue(data.surveyStatus); 
          return responseJSON({status: 'success'});
        }
      }
      return responseJSON({status: 'error', message: 'User not found'});
    }

    if (action == 'get_survey') {
      var uSheet = ss.getSheetByName('Users');
      var users = uSheet.getDataRange().getValues();
      var uid = String(data.userId).trim();
      for (var i = 1; i < users.length; i++) {
        if (String(users[i][5]).trim() === uid) {
          return responseJSON({status: 'success', data: users[i][10] || '{}' });
        }
      }
      return responseJSON({status: 'error', message: 'User not found'});
    }

    if (action == 'like_post') {
      var actSheet = ss.getSheetByName('Activities');
      var rowIndex = findRowIndexByPostId(actSheet, data.postId);
      var userId = data.userId;
      var reactionType = data.reactionType || 'like'; 

      if (rowIndex === -1) {
         return responseJSON({status: 'error', message: 'ไม่พบเรื่องราวที่ต้องการถูกใจ'});
      }

      var interactionCol = 11; // ขยับจาก 10 เป็น 11
      var jsonStr = actSheet.getRange(rowIndex, interactionCol).getValue();
      var interactionData = { likes: [], verifies: [] };
      
      try { 
        if (jsonStr && jsonStr.toString().trim() !== "") {
            interactionData = JSON.parse(jsonStr); 
        }
      } catch (e) { }

      if (!interactionData.likes) interactionData.likes = [];

      var existingIndex = -1;
      for (var k = 0; k < interactionData.likes.length; k++) {
        if (interactionData.likes[k] && String(interactionData.likes[k].lineId) === String(userId)) {
          existingIndex = k;
          break;
        }
      }

      if (existingIndex > -1) {
        interactionData.likes[existingIndex].type = reactionType;
      } else {
        interactionData.likes.push({
          lineId: userId,
          type: reactionType,
          timestamp: new Date().toISOString()
        });
      }

      actSheet.getRange(rowIndex, interactionCol).setValue(JSON.stringify(interactionData));
      return responseJSON({status: 'success', type: reactionType});
    }

    if (action == 'save_activity') {
      var actSheet = ss.getSheetByName('Activities');
      var userSheet = ss.getSheetByName('Users');
      if (!actSheet || !userSheet) return responseJSON({status: 'error', message: 'Sheets missing'});

      var imageUrl = data.image || ""; 
      if (data.uploadId) {
        imageUrl = reassembleAndSaveImage(data.uploadId, data.userName, data.totalChunks);
      }
      if (data.isOnlyUpload) {
         return responseJSON({ status: 'success', url: imageUrl });
      }

      var scoreToAdd = 0;
      var status = "waiting_verify";

      if (data.privacy === 'private') {
         scoreToAdd = 0;
         status = "private"; 
      } else {
         var totalStaff = getActiveStaffCount(ss);
         var taggedList = data.taggedFriends ? String(data.taggedFriends).split(',').filter(Boolean) : [];
         var tagCount = taggedList.length;

         if (tagCount > (totalStaff * 0.5)) {
            scoreToAdd = 10;
            status = "approved";
         } else {
            scoreToAdd = 0;
            status = "waiting_verify";
         }
      }

      var initialInteractions = JSON.stringify({ likes: [], verifies: [] });

      var now = new Date();
      var dateStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
      var timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");

      actSheet.appendRow([
        dateStr, timeStr, Utilities.getUuid(), data.userId, data.taggedFriends, data.userName,
        data.virtueTag, imageUrl, data.happyLevel, data.note, initialInteractions,
        status, scoreToAdd, data.privacy
      ]);

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

    if (action == 'verify_solo' || action == 'verify_post') {
      var userSheet = ss.getSheetByName('Users');
      var actSheet = ss.getSheetByName('Activities');
      var rowIdx = findRowIndexByPostId(actSheet, data.postId);

      if (rowIdx === -1) {
         return responseJSON({status: 'error', message: 'ไม่พบเรื่องราวที่ต้องการยืนยัน'});
      }

      var cellJSON = actSheet.getRange(rowIdx, 11);
      var cellStatus = actSheet.getRange(rowIdx, 12);
      var cellScore = actSheet.getRange(rowIdx, 13);

      var interactions = { likes: [], verifies: [] };
      try { 
        var val = cellJSON.getValue();
        if(val) interactions = JSON.parse(val); 
      } catch(e) {}
      
      if (!interactions.verifies) interactions.verifies = [];
      
      var witnessId = String(data.witnessId || data.userId || data.verifierId).trim();

      var rowValues = actSheet.getRange(rowIdx, 1, 1, actSheet.getLastColumn()).getValues()[0];
      var ownerId = String(rowValues[2]).trim();
      var taggedIds = String(rowValues[3] || "").split(',').map(function(s){ return s.trim(); });

      if (witnessId === ownerId || taggedIds.indexOf(witnessId) > -1) {
        return responseJSON({status: 'error', message: 'คุณไม่สามารถยืนยันโพสต์ตนเองหรือสมาชิกในทีมได้ครับ'});
      }

      var witnessData = null;
      var userData = userSheet.getDataRange().getValues();
      for (var i = 1; i < userData.length; i++) {
        var sheetLineId = String(userData[i][5] || "").trim();
        var sheetId = String(userData[i][0] || "").trim();
        if (sheetLineId === witnessId || sheetId === witnessId) {
          witnessData = {
            userId: witnessId,
            name: userData[i][1],
            img: userData[i][6] || 'https://dummyimage.com/30x30/ccc/888&text=?'
          };
          break;
        }
      }
      
      if (!witnessData) {
         return responseJSON({status: 'error', message: 'ไม่พบข้อมูลผู้ยืนยันในระบบ'});
      }

      var alreadyVerified = false;
      for (var j = 0; j < interactions.verifies.length; j++) {
         var v = interactions.verifies[j];
         var vid = (typeof v === 'object') ? (v.userId || v.lineId) : v;
         if (String(vid).trim() === witnessId) {
            alreadyVerified = true;
            break;
         }
      }

      if (!alreadyVerified) {
        interactions.verifies.push(witnessData);
        cellJSON.setValue(JSON.stringify(interactions));
        
        var pointsForWitness = 0;
        if (interactions.verifies.length <= 2) {
           updateUserScore(userSheet, witnessId, 3);
           pointsForWitness = 3;
        }

        if (interactions.verifies.length >= 2 && (cellStatus.getValue() === "waiting_verify" || cellStatus.getValue() === "")) {
           updateUserScore(userSheet, ownerId, 10);
           if (rowValues[3]) {
              var friends = String(rowValues[3]).split(',');
              friends.forEach(function(fid) { updateUserScore(userSheet, fid.trim(), 10); });
           }
           cellStatus.setValue("approved");
           cellScore.setValue(10);
           return responseJSON({status: 'success', message: 'ยืนยันครบถ้วน! โพสต์นี้ได้รับอนุมัติ (+10 XP)'});
        }
        
        var msg = pointsForWitness > 0 ? 'บันทึกพยานแล้ว (+3 XP)' : 'บันทึกพยานแล้ว (ครบโควตาคะแนนแล้ว)';
        return responseJSON({status: 'success', message: msg});
      } else {
        return responseJSON({status: 'already_verified', message: 'คุณได้ยืนยันโพสต์นี้ไปแล้วครับ'});
      }
    }

    if (action == 'check_user') {
      var userSheet = ss.getSheetByName('Users');
      var actSheet = ss.getSheetByName('Activities');
      
      if (!userSheet) return responseJSON({status: 'error', message: 'Users sheet not found'});
      if (!actSheet) return responseJSON({status: 'error', message: 'Activities sheet not found'});
      
      var userData = userSheet.getDataRange().getValues();
      var actData = actSheet.getDataRange().getValues();
      var stats = calculateRealStats(actData, userData);
      var foundUser = null;
      
      for (var i = 1; i < userData.length; i++) {
        if (userData[i][5] == data.userId) {
          var uid = data.userId;
          var userStat = stats.userStats[uid] || { totalScore: 0, level: 1 };
          
          var sheetScore = Number(userData[i][3]) || 0;
          var finalScore = Math.max(userStat.totalScore, sheetScore);
          var finalLevel = Math.floor(finalScore / 500) + 1;

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
          user: foundUser
      });
    }

    if (action == 'register_user') {
      var userSheet = ss.getSheetByName('Users');
      userSheet.appendRow([
        userSheet.getLastRow(),    
        data.userName,             
        "Staff",                   
        100, 1,                    
        data.userId,               
        data.userImg,              
        data.department,           
        data.office                
      ]);
      return responseJSON({status: 'success'});
    }

    if (action == 'save_reward') {
      var rwSheet = ss.getSheetByName('Rewards');
      if (!rwSheet) {
        rwSheet = ss.insertSheet('Rewards');
        rwSheet.appendRow(['ID', 'Name', 'Image', 'Mode', 'TargetVal', 'CreatedTS', 'EndDate', 'Status']);
      }
      var newId = 'rw_' + new Date().getTime();
      rwSheet.appendRow([
        newId,
        data.name || 'ไม่มีชื่อ',
        data.image || '',
        data.mode || 1, 
        Number(data.targetVal) || 0,
        new Date().getTime(),
        data.endDate || '',
        'active'
      ]);
      return responseJSON({status: 'success', id: newId});
    }

    if (action == 'edit_reward') {
      var rwSheet = ss.getSheetByName('Rewards');
      if (!rwSheet) return responseJSON({status: 'error', message: 'Sheet not found'});
      var rows = rwSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][0] === data.rewardId) {
          if (data.name) rwSheet.getRange(i + 1, 2).setValue(data.name);
          if (data.image !== undefined) {
            var oldImage = rows[i][2];
            if (oldImage && oldImage !== data.image) {
              deleteFromCloudinary(oldImage);
            }
            rwSheet.getRange(i + 1, 3).setValue(data.image);
          }
          if (data.targetVal) rwSheet.getRange(i + 1, 5).setValue(data.targetVal);
          if (data.endDate !== undefined) rwSheet.getRange(i + 1, 7).setValue(data.endDate);
          return responseJSON({status: 'success'});
        }
      }
      return responseJSON({status: 'error', message: 'Reward not found'});
    }

    if (action == 'delete_reward') {
      var rwSheet = ss.getSheetByName('Rewards');
      if (!rwSheet) return responseJSON({status: 'error', message: 'Sheet not found'});
      var rows = rwSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][0] === data.rewardId) {
          var oldImage = rows[i][2];
          if (oldImage) {
            deleteFromCloudinary(oldImage);
          }
          rwSheet.deleteRow(i + 1);
          
          var clSheet = ss.getSheetByName('Claims');
          if (clSheet) {
            var clRows = clSheet.getDataRange().getValues();
            for (var k = clRows.length - 1; k >= 1; k--) {
               if (clRows[k][1] === data.rewardId) clSheet.deleteRow(k + 1);
            }
          }
          return responseJSON({status: 'success'});
        }
      }
      return responseJSON({status: 'error', message: 'Reward not found'});
    }

    if (action == 'delete_cloudinary_image') {
      if (data.url) {
        deleteFromCloudinary(data.url);
      }
      return responseJSON({status: 'success'});
    }

    if (action == 'claim_reward') {
      var clSheet = ss.getSheetByName('Claims');
      if (!clSheet) {
        clSheet = ss.insertSheet('Claims');
        clSheet.appendRow(['ClaimID', 'RewardID', 'UserID', 'UserName', 'Timestamp']);
      }
      
      // Check if already claimed
      var existing = clSheet.getDataRange().getValues();
      for (var m = 1; m < existing.length; m++) {
        if (existing[m][1] === data.rewardId && existing[m][2] === data.userId) {
          return responseJSON({ status: 'success', message: 'Already claimed' });
        }
      }
      
      clSheet.appendRow([
        'CL_' + new Date().getTime(),
        data.rewardId,
        data.userId,
        data.userName,
        new Date().getTime()
      ]);
      return responseJSON({ status: 'success' });
    }

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
    // 🌟 กรอง ศิษย์เก่า, Guest และคนในทำเนียบ ออกจากยอดบุคลากรปัจจุบัน
    if (data[i][1] && !/alumni|ศิษย์เก่า|retired|student|guest|ผู้เยี่ยมชม|ผู้เข้าใหม่|แขก|ทำเนียบ|hall of fame/i.test(role)) {
      count++;
    }
  }
  return count || 1;
}

// --- 🧠 ระบบคำนวณผลจริง (ฉบับเน้นการมีส่วนร่วม) ---
function calculateRealStats(actData, usersData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dvSheet = ss.getSheetByName('DailyVisits');
  var dailyVisits = dvSheet ? dvSheet.getDataRange().getValues() : [];
  var userStats = {};
  var trendDateMap = {}; // 📌 เก็บค่าความสุขในแต่ละวัน
  var userMapForCloseness = {};
  var today = new Date(); 

  // 1. Map ชื่อเพื่อน และ สิทธิ์
  var userRoleMap = {};
  for(var i=1; i<usersData.length; i++) {
    if(usersData[i][5]) {
       var uidLine = String(usersData[i][5]).trim();
       var uRole = String(usersData[i][2] || "").toLowerCase();
       userMapForCloseness[uidLine] = usersData[i][1];
       userRoleMap[uidLine] = uRole;
    }
  }
  
  // 2. วนลูปกิจกรรม
  for (var i = 1; i < actData.length; i++) {
    var row = actData[i];
    var uid = row[3] ? String(row[3]).trim() : ""; // ID คนโพสต์ (index ขยับเป็น 3)
    if (!uid) continue;
    var taggedStr = row[4] ? String(row[4]) : ""; // เพื่อนที่ถูกแท็ก (index ขยับเป็น 4)
    var virtue = row[6]; // index ขยับเป็น 6
    var happy = Number(row[8]) || 0; // index ขยับเป็น 8
    var timestamp = new Date(row[0] + ' ' + row[1]); // รวม Date + Time
    
    // JSON Interaction (ข้อมูลการกด Like/Verify)
    var interactions = { likes: [], verifies: [] };
    try { 
      if(row[10] && String(row[10]).trim() !== "") interactions = JSON.parse(row[10]); 
    } catch(e) {}

    var privacyVal = (row.length > 13) ? row[13] : 'public';

    // 📌 จัดกลุ่มค่าความสุขตามวันที่ (🌟 กรองเฉพาะบุคลากรปัจจุบัน ไม่เอาศิษย์เก่า/Guest)
    var uRole = userRoleMap[uid] || "";
    var isIncluded = uRole && !/alumni|ศิษย์เก่า|retired|student|guest|ผู้เยี่ยมชม|ผู้เข้าใหม่|แขก/i.test(uRole);

    if (isIncluded && timestamp instanceof Date && !isNaN(timestamp)) {
        var dStr = timestamp.getFullYear() + "-" + (timestamp.getMonth() + 1) + "-" + timestamp.getDate();
        if (!trendDateMap[dStr]) trendDateMap[dStr] = [];
        trendDateMap[dStr].push(happy);
    }

    // --- ฟังก์ชันย่อยอัปเดตความสุข ---
    var updateHappyStats = function(targetId, happiness, time) {
        if (!userStats[targetId]) userStats[targetId] = { 
            sumHappy: 0, count: 0, totalScore: 0, 
            virtueCounts: {}, closeness: {}, lastActive: null,
            firstActive: null 
        };
        // บวกความสุข
        userStats[targetId].sumHappy += happiness;
        userStats[targetId].count++;
        // อัปเดตวันที่ล่าสุด (เพื่อกันคะแนนลด)
        if (userStats[targetId].lastActive === null || time > userStats[targetId].lastActive) {
            userStats[targetId].lastActive = time;
        }
        // ✨ อัปเดตวันที่เริ่มต้นกิจกรรมครั้งแรก
        if (userStats[targetId].firstActive === null || time < userStats[targetId].firstActive) {
            userStats[targetId].firstActive = time;
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

  // 📌 4. สร้างกราฟเทรนด์ภาพรวม (📈 Happy Meter Index - SET Style)
  // แนวคิด: เริ่มต้นที่ 1,000 จุด แล้วคำนวณ Momentum รายวันตามกิจกรรม
  var dayInteractions = {}; 
  var firstEverDate = new Date(); // Default today

  // ประมวลผล Activities
  for (var i = 1; i < actData.length; i++) {
    var row = actData[i];
    var ts = new Date(row[0]);
    if (!(ts instanceof Date) || isNaN(ts)) continue;
    if (i === 1 || ts < firstEverDate) firstEverDate = new Date(ts);
    
    var dStr = ts.getFullYear() + "-" + (ts.getMonth() + 1) + "-" + ts.getDate();
    if (!dayInteractions[dStr]) dayInteractions[dStr] = { posts: 0, tags: 0, verifies: 0, sads: 0, visits: 0 };
    
    dayInteractions[dStr].posts++;
    if (Number(row[7]) === 1) dayInteractions[dStr].sads++;
    if (row[3]) {
      var tList = String(row[3]).split(',').filter(Boolean);
      dayInteractions[dStr].tags += tList.length;
    }
    try {
      if (row[9]) {
        var inter = JSON.parse(row[9]);
        if (inter.verifies) dayInteractions[dStr].verifies += inter.verifies.length;
      }
    } catch(e) {}
  }

  // ประมวลผล DailyVisits (ดึงข้อมูลสรุปรายวัน)
  var dailyVisitMap = {};
  for (var v = 1; v < dailyVisits.length; v++) {
    var vDate = new Date(dailyVisits[v][0]);
    var vDStr = vDate.getFullYear() + "-" + (vDate.getMonth() + 1) + "-" + vDate.getDate();
    dailyVisitMap[vDStr] = Number(dailyVisits[v][1]) || 0;
    if (v === 1 || vDate < firstEverDate) firstEverDate = new Date(vDate);
  }

  // 🌟 คำนวณค่าลดลงของดัชนี (Momentum Penalty)
  // อ้างอิงจากจำนวนเจ้าหน้าที่ที่ไม่เอาขึ้นทำเนียบ มาร้อยละ 20
  var activeCount = getActiveStaffCount(ss);
  var basePenalty = Math.round(activeCount * 0.20 * 100) / 100;
  if (basePenalty < 1) basePenalty = 1; // ขั้นต่ำ 1

  var overallTrend = [];
  var indexValue = 1000;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // ปรับ "เปิดตลาด" ตั้งแต่วันแรกที่มีกิจกรรมจริง
  firstEverDate.setHours(0, 0, 0, 0);
  var diffDays = Math.ceil((today - firstEverDate) / (1000 * 60 * 60 * 24));
  if (diffDays < 15) diffDays = 15; // อย่างน้อย 15 วันเพื่อให้กราฟสวย
  if (diffDays > 365) diffDays = 365; // แม็กซ์ 1 ปีเพื่อ Performance

  for (var i = diffDays; i >= 0; i--) {
       var d = new Date(today);
       d.setDate(today.getDate() - i);
       var dStr = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
       
       var dayStats = dayInteractions[dStr];
       var delta = 0;
       
       if (dayStats) {
           delta += (dayStats.posts * 2);      
           delta += (dayStats.tags * 3);       
           delta += (dayStats.verifies * 1);   
           
           // ใช้ข้อมูลจาก DailyVisitMap
           var vCount = dailyVisitMap[dStr] || 0;
           delta += (vCount * 0.5);   
           
           delta -= (dayStats.sads * 5);       
       } else {
           delta -= basePenalty; }
       
       indexValue += delta;
       if (indexValue < 0) indexValue = 0;
       overallTrend.push(Math.round(indexValue));
  }

  return { userStats: userStats, overallTrend: overallTrend };
}

/* --- HELPER: ค้นหาแถวในชีต Activities จาก ID (Row Index) หรือ UUID --- */
function findRowIndexByPostId(sheet, postId) {
  if (!sheet || !postId) return -1;
  var inputId = String(postId).trim();
  var data = sheet.getDataRange().getValues();
  
  // 1. ค้นหาจาก UUID (Column B / Index 1) - แม่นยำที่สุดและไม่เปลี่ยนตามการขยับแถว
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === inputId) return i + 1;
  }
  
  // 2. ค้นหาจาก Row Index (0-based) ที่ส่งมาเป็นเลข (Fallback สำหรับระบบเก่า)
  var potentialIdx = parseInt(inputId) + 1;
  if (!isNaN(potentialIdx) && potentialIdx >= 2 && potentialIdx <= data.length) {
    // ตรวจสอบเบื้องต้นว่าไม่ใช่ UUID (ถ้าเป็น UUID parseInt จะได้เลขสั้นๆ หรือ NaN)
    if (inputId.length < 10) return potentialIdx; 
  }
  
  return -1;
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

// 🌟 ฟังก์ชันอัปเดตสถานะ (ล็อคหัวตารางตามโครงสร้างมาตรฐาน: ID, Name, Role, Score, Level, Line_UID, Picture...)
function updateUserRoleStatus(ss, targetUserId, newRole, optionalScore) {
  var diag = { 
    targetId: String(targetUserId).trim(), 
    scriptVersion: "v2.5 (Fixed Index)",
    ssId: ss ? ss.getId() : "null"
  };

  try {
    if (!ss) return responseJSON({status: 'error', message: 'ระบุไฟล์ Spreadsheet ไม่สำเร็จ', diag: diag});
    
    // 🔍 ค้นหาชีตที่เก็บรายชื่อแบบยืดหยุ่น
    var sheets = ss.getSheets();
    var sheet = null;
    for (var s=0; s<sheets.length; s++) {
      var sName = sheets[s].getName().toLowerCase().replace(/\s/g,'');
      if (sName === 'users' || sName === 'รายชื่อ' || sName === 'staff' || sName === 'user') {
        sheet = sheets[s];
        break;
      }
    }
    
    if (!sheet) return responseJSON({status: 'error', message: 'ไม่พบชีตฐานข้อมูล (Users/รายชื่อ)', diag: diag});

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return responseJSON({status: 'error', message: 'ชีตไม่มีข้อมูลพนักงาน (มีแต่หัวตาราง)', diag: diag});

    // 🎯 ล็อคตำแหน่งคอลัมน์ (0=A, 1=B, 2=C, 3=D, 4=E, 5=F...)
    var col = { id: 0, role: 2, score: 3, lineUid: 5 };
    var targetId = diag.targetId;
    var updateCount = 0;
    var updatedRows = [];
    
    for (var i = 1; i < data.length; i++) {
       var rowLineId = String(data[i][col.lineUid] || "").trim();
       var rowId = String(data[i][col.id] || "").trim();

       // เทียบรหัสแบบ Case-Sensitive (ตรงตัว) ตามความต้องการผู้ใช้
       if ((rowLineId !== "" && rowLineId === targetId) || (rowId !== "" && rowId === targetId)) {
         // ทำการบันทึก
         var roleRange = sheet.getRange(i + 1, col.role + 1);
         roleRange.setValue(newRole);
         
         if (optionalScore !== undefined && optionalScore !== null) {
           sheet.getRange(i + 1, col.score + 1).setValue(Number(optionalScore));
         }
         
         // ตรวจสอบซ้ำว่าบันทึกได้จริงไหม (Double Check)
         if (roleRange.getValue() === newRole) {
            updateCount++;
            updatedRows.push(i + 1);
         }
       }
    }

    if (updateCount > 0) {
      SpreadsheetApp.flush();
      return responseJSON({
        status: 'success', 
        message: 'อัปเดตสิทธิ์เป็น "' + newRole + '" สำเร็จ ' + updateCount + ' รายการ (แถว: ' + updatedRows.join(', ') + ')',
        version: diag.scriptVersion
      });
    } else {
       // ถ้าหาไม่เจอ ส่งตัวอย่างข้อมูล 2 แถวแรกไปให้ดูว่าไอดีหน้าตาเป็นไง
       var samples = [];
       for(var j=1; j<Math.min(data.length, 3); j++) {
         samples.push("A"+(j+1)+":"+data[j][col.id] + " | F"+(j+1)+":"+data[j][col.lineUid]);
       }
       return responseJSON({
         status: 'error', 
         message: 'หารหัส "' + targetId + '" ไม่พบในตารางบรรทัดใดเลย',
         diag: diag,
         samplesInSheet: samples
       });
    }

  } catch (err) {
    return responseJSON({status: 'error', message: "System Error: " + err.toString(), diag: diag});
  }
}

// 🌤️ ฟังก์ชันดึงสภาพอากาศจาก OpenWeatherMap (พร้อมระบบ Cache 30 นาที)
function fetchWeatherData(ss) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("weather_data");
  if (cached) return JSON.parse(cached);

  try {
    // 🔍 ตรวจสอบชื่อเมืองที่ Admin ตั้งค่าไว้ในชีต Settings (ถ้าไม่มีให้ใช้ DEFAULT_CITY)
    var city = DEFAULT_CITY;
    var settingsSheet = ss.getSheetByName('Settings');
    if (settingsSheet) {
      var data = settingsSheet.getDataRange().getValues();
      for (var i = 0; i < data.length; i++) {
        if (String(data[i][0]).toLowerCase() === 'city') {
          city = String(data[i][1]).trim();
          break;
        }
      }
    } else {
      // ถ้าไม่มีชีต Settings ให้สร้างไว้เป็นไกด์สำหรับ Admin
      ss.insertSheet('Settings').appendRow(['city', DEFAULT_CITY]);
    }

    var url = "https://api.openweathermap.org/data/2.5/weather?q=" + encodeURIComponent(city) + "&appid=" + WEATHER_API_KEY + "&units=metric&lang=th";
    var response = UrlFetchApp.fetch(url);
    var result = JSON.parse(response.getContentText());

    // 🌬️ แปลงความเร็วลม m/s -> km/h
    var windSpeedKmh = Math.round((result.wind.speed || 0) * 3.6 * 10) / 10;

    // 😷 ดึงค่าฝุ่น PM2.5 จาก Air Pollution API
    var pm25 = null;
    try {
      var lat = result.coord.lat;
      var lon = result.coord.lon;
      var airUrl = "https://api.openweathermap.org/data/2.5/air_pollution?lat=" + lat + "&lon=" + lon + "&appid=" + WEATHER_API_KEY;
      var airResponse = UrlFetchApp.fetch(airUrl);
      var airResult = JSON.parse(airResponse.getContentText());
      if (airResult.list && airResult.list.length > 0) {
        pm25 = Math.round(airResult.list[0].components.pm2_5 * 10) / 10;
      }
    } catch(airErr) {
      Logger.log("Air Pollution API Error: " + airErr);
    }

    var weatherInfo = {
      status: 'success',
      city: result.name,
      temp: result.main.temp,
      humidity: result.main.humidity,
      description: result.weather[0].description,
      icon: result.weather[0].icon,
      wind_speed: windSpeedKmh,
      pm25: pm25,
      timestamp: new Date().getTime()
    };

    // เก็บลง Cache 30 นาที (1800 วินาที)
    cache.put("weather_data", JSON.stringify(weatherInfo), 1800);
    return weatherInfo;
  } catch (e) {
    return { status: 'error', message: "Weather API Error: " + e.toString() };
  }
}

/**
 * ☁️ ฟังก์ชันสำหรับลบไฟล์ออกจาก Cloudinary
 * ต้องมี API Key และ Secret
 */
function deleteFromCloudinary(url) {
  if (!url || !url.includes('cloudinary.com')) return false;
  
  try {
    // 1. ดึง public_id ออกจาก URL
    // โครงสร้าง: .../upload/v12345/folder/id.jpg
    var regex = /\/upload\/(v\d+\/)?(.+)\.[a-z0-9]+$/i;
    var match = url.match(regex);
    if (!match || !match[2]) return false;
    
    var publicId = match[2];
    var timestamp = Math.round(new Date().getTime() / 1000).toString();
    
    // 2. สร้าง Signature (SHA-1)
    // สูตร: "public_id=<id>&timestamp=<ts><api_secret>"
    var stringToSign = "public_id=" + publicId + "&timestamp=" + timestamp + CLOUDINARY_API_SECRET;
    var signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, stringToSign)
                    .map(function(byte) {
                      var v = (byte < 0) ? (byte + 256) : byte;
                      return ("0" + v.toString(16)).slice(-2);
                    }).join("");
    
    // 3. ส่งคำขอไปยัง Cloudinary (POST)
    var apiUrl = "https://api.cloudinary.com/v1_1/" + CLOUDINARY_CLOUD_NAME + "/image/destroy";
    var payload = {
      public_id: publicId,
      timestamp: timestamp,
      api_key: CLOUDINARY_API_KEY,
      signature: signature
    };
    
    var response = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      payload: payload,
      muteHttpExceptions: true
    });
    
    var result = JSON.parse(response.getContentText());
    Logger.log("Cloudinary Destroy Result: " + JSON.stringify(result));
    return result.result === 'ok';
    
  } catch (e) {
    Logger.log("Cloudinary Delete Error: " + e.toString());
    return false;
  }
}

// ==========================================
// 🛠️ ฟังก์ชันสำหรับตั้งค่า/อัปเดตหัวตารางทุกชีต (Run Manual)
// ==========================================
function setupDatabaseHeaders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetsInfo = {
    'Users': ['ID', 'Name', 'Role', 'Score', 'Level', 'LineID', 'Image', 'Department', 'Office', 'LastDate', 'LastTime', 'VisitCount'],
    'Activities': ['Date', 'Time', 'UUID', 'UserId', 'Tagged', 'UserName', 'Virtue', 'Image', 'Happy', 'Note', 'JSON', 'Status', 'Score', 'Privacy'],
    'Announcements': ['ID', 'Title', 'Body', 'EventDate', 'EventTime', 'Category', 'PostedBy', 'Date', 'Time'],
    'Visits': ['Date', 'Time', 'UserId', 'UserName'],
    'Rewards': ['ID', 'Name', 'Image', 'Mode', 'TargetVal', 'EndDate', 'Status', 'Date', 'Time'],
    'Claims': ['ClaimID', 'RewardID', 'UserID', 'UserName', 'Date', 'Time'],
    'Surveys': ['Date', 'Time', 'UserId', 'q1', 'q2', 'q3'],
    'DailyVisits': ['Date', 'Count'],
    'Settings': ['Key', 'Value']
  };

  for (var name in sheetsInfo) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      console.log('✅ สร้างชีตใหม่: ' + name);
    }
    
    // อัปเดตหัวตาราง (แถวที่ 1)
    var headers = sheetsInfo[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // ปรับแต่งความสวยงามเบื้องต้น
    sheet.getRange(1, 1, 1, headers.length)
         .setBackground('#dfe6e9')
         .setFontWeight('bold')
         .setHorizontalAlignment('center');
    
    // ตรึงแถวแรก
    sheet.setFrozenRows(1);
    
    console.log('🚀 อัปเดตหัวตารางชีต ' + name + ' เรียบร้อยแล้ว');
  }
  
  SpreadsheetApp.getUi().alert('✅ อัปเดตหัวตารางทุกชีตเรียบร้อยแล้ว!');
}
