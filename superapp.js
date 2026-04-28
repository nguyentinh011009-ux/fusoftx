// ========================================================
// FUSOFTX - SUPER ADMIN CORE LOGIC (PHIÊN BẢN ĐÃ NÂNG CẤP)
// ========================================================

const SUPER_ADMIN_EMAILS = ["nguyentinh52009@gmail.com", "tomizy09icloud@gmail.com"];
let activeDatabases = {}; // Nơi chứa KẾT NỐI SẴN SÀNG của tất cả các trường
let globalStudentsCache = []; // Nơi chứa TẤT CẢ HỌC SINH của hệ thống
let clientStudentsCache = []; // Bộ nhớ đệm học sinh của TRƯỜNG ĐANG KẾT NỐI
let selectedNotiStudents = []; // Mảng chứa các học sinh đã được tick chọn
let clientApp = null;
let clientDb = null;
let currentSchoolName = "";
let allSchoolsConfig = []; 
let isGlobalCacheReady = false; // Cờ báo hiệu đã nạp xong RAM
firebase.auth().onAuthStateChanged((user) => {
    if (user && SUPER_ADMIN_EMAILS.includes(user.email)) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard-screen').style.display = 'flex';
        document.getElementById('sa-email').innerText = user.email;
        document.getElementById('sa-profile-email').value = user.email;
        loadLinkedSchools(); 
        setupMagicPaste(); // Khởi động tính năng dán mã thông minh
    } else {
        if(user) firebase.auth().signOut();
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard-screen').style.display = 'none';
    }
});

function loginSuperAdmin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(err => {
        if (err.code !== 'auth/popup-closed-by-user') alert("Lỗi: " + err.message);
    });
}

function switchSaTab(tabId, btn) {
    document.querySelectorAll('.tab-pane').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    btn.classList.add('active');

    if(tabId === 'tab-noti') loadFusoftxSentLog();
    if(tabId === 'tab-support') loadClientTickets();
}

// ==========================================
// TÍNH NĂNG NÂNG CẤP: MAGIC PASTE FIREBASE
// ==========================================
function setupMagicPaste() {
    // Tạo ô textarea bự để dán cấu hình
    const cfgContainer = document.getElementById('cfg-apiKey').parentElement;
    cfgContainer.innerHTML = `
        <div style="grid-column: span 2;">
            <label style="font-size:0.85rem; color:#4f46e5; margin-bottom:5px;"><i class="fas fa-magic"></i> Magic Paste (Dán nguyên cục const firebaseConfig vào đây):</label>
            <textarea id="magic-config-input" rows="6" style="width:100%; padding:10px; border-radius:8px; border:2px dashed #818cf8; background:#e0e7ff; font-family:monospace;" placeholder="const firebaseConfig = {\n  apiKey: 'AIzaSy...', \n  authDomain: '...',\n  ...\n};"></textarea>
            <div id="magic-status" style="margin-top:5px; font-size:0.8rem; font-weight:bold;"></div>
        </div>
    `;

    document.getElementById('magic-config-input').addEventListener('input', function(e) {
        const text = e.target.value;
        const status = document.getElementById('magic-status');
        if(!text.trim()) { status.innerText = ""; return; }

        try {
            // Dùng Regex để tự động bóc tách các giá trị từ chuỗi Javascript Text
            const extract = (key) => {
                const regex = new RegExp(`${key}\\s*:\\s*['"\`]+([^'"\`]+)['"\`]+`);
                const match = text.match(regex);
                return match ? match[1] : null;
            };

            window.tempParsedConfig = {
                apiKey: extract("apiKey"),
                authDomain: extract("authDomain"),
                projectId: extract("projectId"),
                storageBucket: extract("storageBucket"),
                messagingSenderId: extract("messagingSenderId"),
                appId: extract("appId")
            };

            if(window.tempParsedConfig.apiKey && window.tempParsedConfig.projectId) {
                status.innerHTML = `<span style="color:#10b981;"><i class="fas fa-check-circle"></i> Bóc tách thành công Project: <b>${window.tempParsedConfig.projectId}</b></span>`;
                e.target.style.borderColor = "#10b981";
            } else {
                status.innerHTML = `<span style="color:#ef4444;"><i class="fas fa-times-circle"></i> Không tìm thấy apiKey hoặc projectId hợp lệ!</span>`;
                e.target.style.borderColor = "#ef4444";
                window.tempParsedConfig = null;
            }
        } catch(err) {
            status.innerHTML = `<span style="color:#ef4444;"><i class="fas fa-exclamation-triangle"></i> Lỗi định dạng!</span>`;
            window.tempParsedConfig = null;
        }
    });
}

// --- QUẢN LÝ HỢP ĐỒNG ---
async function saveContract() {
    if (!window.tempParsedConfig || !window.tempParsedConfig.apiKey) {
        return alert("❌ Vui lòng dán mã cấu hình Firebase hợp lệ vào ô Magic Paste!");
    }

    const payload = {
        name: document.getElementById('contract-name').value.trim(),
        repName: document.getElementById('contract-rep').value.trim(),
        phone: document.getElementById('contract-phone').value.trim(),
        package: document.getElementById('contract-package').value,
        startDate: document.getElementById('contract-start').value,
        endDate: document.getElementById('contract-end').value,
        config: window.tempParsedConfig // Lấy cấu hình đã được AI bóc tách
    };

    if (!payload.name || !payload.startDate) return alert("Nhập đủ Tên trường và Ngày bắt đầu!");

    try {
        await db.collection('linked_schools').add({...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
        alert("✅ Đã tạo Hợp đồng & CSDL thành công!");
        
        // Reset form
        ['contract-name','contract-rep','contract-phone','contract-start','contract-end','magic-config-input'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = '';
        });
        document.getElementById('magic-status').innerText = '';
        window.tempParsedConfig = null;
        document.getElementById('magic-config-input').style.borderColor = '#818cf8';
    } catch (e) { alert("Lỗi: " + e.message); }
}

function loadLinkedSchools() {
    // Ô tìm kiếm Trường học
    const listContainer = document.getElementById('school-list').parentElement;
    if(!document.getElementById('search-school')) {
        listContainer.insertAdjacentHTML('afterbegin', `
            <div style="margin-bottom:15px; position:relative;">
                <input type="text" id="search-school" placeholder="Tìm tên trường / Người đại diện..." style="width:100%; padding:12px; border-radius:8px; border:1px solid #cbd5e1; outline:none;">
                <i class="fas fa-search" style="position:absolute; right:15px; top:14px; color:#94a3b8;"></i>
            </div>
        `);

        document.getElementById('search-school').addEventListener('input', function(e) {
            const txt = e.target.value.toLowerCase();
            document.querySelectorAll('.school-card-item').forEach(el => {
                const content = el.innerText.toLowerCase();
                el.style.display = content.includes(txt) ? 'block' : 'none';
            });
        });
    }

    db.collection('linked_schools').onSnapshot(snap => {
        document.getElementById('stat-schools').innerText = snap.size;
        const listDiv = document.getElementById('school-list'); listDiv.innerHTML = '';
        allSchoolsConfig = [];

        if (snap.empty) {
            listDiv.innerHTML = '<div style="color:#94a3b8;">Chưa có hợp đồng nào. Hãy tạo mới ở form phía trên.</div>';
            return;
        }

        snap.forEach(doc => {
            const d = doc.data();
            allSchoolsConfig.push({ name: d.name, config: d.config }); 
            
            // Tên biến đúng là configStr
            const configStr = encodeURIComponent(JSON.stringify(d.config));
            
            const today = new Date(); const endDate = new Date(d.endDate);
            const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            let stHtml = daysLeft < 0 ? `<span style="color:#ef4444;">Hết hạn</span>` : (daysLeft <= 30 ? `<span style="color:#f59e0b;">Sắp hết hạn</span>` : `<span style="color:#10b981;">Đang HĐ</span>`);

            listDiv.innerHTML += `
                <div class="form-card school-card-item" style="margin-bottom:0; border-left:4px solid var(--sp-primary);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <div><h3 style="margin:0;">${d.name}</h3><div style="font-size:0.85rem; color:#64748b;">Đại diện: ${d.repName} | SĐT: ${d.phone}</div></div>
                        <div style="text-align:right;"><span class="status-badge" style="background:#e0e7ff; color:#4338ca;">Gói ${d.package}</span><div style="font-size:0.85rem; margin-top:5px;">${stHtml}</div></div>
                    </div>
                    <div style="display:flex; gap:10px; justify-content:flex-end;">
                        <!-- Đã sửa configString thành configStr ở dòng dưới này -->
                        <button onclick="connectToSchool('${d.name}', '${configStr}')" class="btn btn-success"><i class="fas fa-plug"></i> Truy cập CSDL</button>
                        <button onclick="deleteSchoolContract('${doc.id}', '${d.name}')" class="btn btn-danger"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        });
        initAllDatabasesAndCache();
    });
}

async function deleteSchoolContract(docId, name) {
    if(confirm(`CẢNH BÁO: Xóa hợp đồng và ngắt kết nối với trường ${name} khỏi hệ thống FUSoftX?\n(Dữ liệu gốc của trường vẫn an toàn trên Firebase của họ).`)) {
        if(currentSchoolName === name) {
            alert("Vui lòng ngắt kết nối với trường này trước khi xóa!");
            return;
        }
        await db.collection('linked_schools').doc(docId).delete();
    }
}

// --- KẾT NỐI XUYÊN CSDL & ĐĂNG NHẬP NGẦM ---
async function connectToSchool(schoolName, configString) {
    try {
        const conf = JSON.parse(decodeURIComponent(configString));
        if (clientApp) { await clientApp.delete(); clientApp = null; clientDb = null; }

        // 1. Khởi tạo kết nối tới Firebase của Trường
        clientApp = firebase.initializeApp(conf, "ClientSchool_" + Date.now());
        clientDb = clientApp.firestore();

        // 2. KỸ THUẬT SILENT LOGIN: Đăng nhập ngầm bằng tài khoản Bot của FUSoftX
        // Bắt buộc phải có dòng này thì lệnh gửi thông báo mới không bị báo lỗi Permission
        await clientApp.auth().signInWithEmailAndPassword("master@fusoftx.com", "fusoftx123456");

        currentSchoolName = schoolName;

        // 3. Cập nhật giao diện
        const stBar = document.getElementById('connection-status');
        stBar.style.background = '#dcfce7'; stBar.style.color = '#15803d';
        stBar.innerHTML = `<span><i class="fas fa-link"></i> ĐANG TRUY CẬP DỮ LIỆU: <strong style="text-transform:uppercase;">${schoolName}</strong></span> <button onclick="location.reload()" class="btn btn-danger" style="padding:5px 10px;">Ngắt kết nối</button>`;
        
        document.getElementById('lbl-tab-noti').innerHTML = `<i class="fas fa-bullhorn"></i> Gửi Thông Báo - <span style="color:var(--sp-primary); text-transform:uppercase;">${schoolName}</span>`;
        document.getElementById('lbl-tab-support').innerHTML = `<i class="fas fa-headset"></i> Hỗ trợ Khách hàng - <span style="color:var(--sp-primary); text-transform:uppercase;">${schoolName}</span>`;
        
        // Chuyển thẳng sang Tab Thông báo
        document.querySelectorAll('.nav-btn')[2].click(); 

    } catch (e) { 
        alert("Kết nối CSDL thất bại: " + e.message); 
    }
}

// ==========================================
// TÍNH NĂNG NÂNG CẤP: DASHBOARD ĐA LUỒNG AN TOÀN
// ==========================================
async function loadGlobalDashboard() {
    const sDateStr = document.getElementById('dash-start').value;
    const eDateStr = document.getElementById('dash-end').value;
    if(!sDateStr || !eDateStr) return alert("Chọn Ngày bắt đầu và Kết thúc!");
    
    const sDate = new Date(sDateStr + "T00:00:00");
    const eDate = new Date(eDateStr + "T23:59:59");
    
    const btn = document.querySelector('button[onclick="loadGlobalDashboard()"]');
    btn.disabled = true;

    let totalStudents = 0;
    let totalVisits = 0;
    let diseaseMap = {};

    try {
        for (let i = 0; i < allSchoolsConfig.length; i++) {
            const school = allSchoolsConfig[i];
            
            // Cập nhật UI thanh tiến trình
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang phân tích ${i+1}/${allSchoolsConfig.length} trường...`;

            // VÁ LỖI FIREBASE NẰM Ở ĐÂY: Dùng Try-Finally để đảm bảo App rác bị xóa
            const tempAppName = "TempApp_" + Date.now() + "_" + i;
            let tempApp = null;

            try {
                tempApp = firebase.initializeApp(school.config, tempAppName);
                const tempDb = tempApp.firestore();

                // Đếm học sinh (Vẫn dùng get nhưng an toàn hơn vì xử lý từng trường một)
                const stSnap = await tempDb.collection('yt_students').get();
                totalStudents += stSnap.size;

                const vSnap = await tempDb.collection('yt_visits').where('timestamp', '>=', sDate).where('timestamp', '<=', eDate).get();
                totalVisits += vSnap.size;

                vSnap.forEach(doc => {
                    const v = doc.data();
                    if(v.symptom) {
                        v.symptom.toLowerCase().split(/[,+\/]+|\s+và\s+/g).forEach(s => { 
                            let clean = s.trim(); 
                            if(clean.length > 0) {
                                clean = clean.charAt(0).toUpperCase() + clean.slice(1);
                                diseaseMap[clean] = (diseaseMap[clean] || 0) + 1; 
                            }
                        });
                    }
                });
            } catch (err) {
                console.error(`Lỗi khi quét trường ${school.name}:`, err);
            } finally {
                // LUÔN LUÔN xóa app rác dù quét thành công hay thất bại
                if(tempApp) await tempApp.delete();
            }
        }

        // Đổ dữ liệu ra UI
        document.getElementById('stat-total-students').innerText = totalStudents.toLocaleString();
        document.getElementById('stat-total-visits').innerText = totalVisits.toLocaleString();

        const sortedDiseases = Object.keys(diseaseMap).map(k => ({name: k, count: diseaseMap[k]})).sort((a,b)=>b.count - a.count).slice(0, 10);
        const tbody = document.getElementById('stat-diseases-list');
        tbody.innerHTML = '';
        if(sortedDiseases.length === 0) tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Không có dữ liệu trong khoảng thời gian này</td></tr>';
        else sortedDiseases.forEach(d => { tbody.innerHTML += `<tr><td style="font-weight:500;">${d.name}</td><td style="text-align:right; font-weight:bold; color:#ef4444;">${d.count}</td></tr>`; });

    } catch (e) {
        alert("Lỗi quá trình quét toàn cục: " + e.message);
    } finally {
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Phân tích Dữ liệu'; btn.disabled = false;
    }
}

// ==========================================
// HỆ THỐNG GỬI THÔNG BÁO NÂNG CAO (Gửi nhiều & Thu hồi)
// ==========================================
clientStudentsCache = []; // Cache học sinh của trường đang chọn
selectedNotiStudents = []; // HS đã được tick chọn

async function toggleNotiInput() {
    const type = document.getElementById('noti-target').value;
    const boxVal = document.getElementById('box-noti-val');
    const boxSelect = document.getElementById('box-select-students');
    const lbl = document.getElementById('lbl-noti-val');
    const inp = document.getElementById('noti-val');

    boxVal.style.display = 'none';
    boxSelect.style.display = 'none';

    if (['grade', 'class'].includes(type)) {
        boxVal.style.display = 'block';
        lbl.innerText = type === 'grade' ? "Nhập Khối (VD: 10)" : "Nhập Lớp (VD: 11A4)";
    } else if (type === 'student_list') {
        if (!clientDb) {
            alert("Vui lòng kết nối tới một trường trước để tải danh sách học sinh!");
            document.getElementById('noti-target').value = 'admin_only'; // Reset
            return;
        }
        boxSelect.style.display = 'block';

        // Nạp cache HS của trường này nếu chưa có
        if (clientStudentsCache.length === 0) {
            document.getElementById('noti-search-results').innerHTML = '<div style="padding:15px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Đang tải DS Học sinh...</div>';
            document.getElementById('noti-search-results').style.display = 'block';
            
            const snap = await clientDb.collection('yt_students').get();
            snap.forEach(doc => {
                const data = doc.data();
                if (!data.name_search) data.name_search = removeVietnameseTones(data.name || "");
                clientStudentsCache.push({ id: doc.id, ...data });
            });
            
            document.getElementById('noti-search-results').style.display = 'none';
        }
    }
}

function searchStudentForNoti(query) {
    const resDiv = document.getElementById('noti-search-results');
    if (query.length < 2) { resDiv.style.display = 'none'; return; }
    
    const q = removeVietnameseTones(query);
    const matched = clientStudentsCache.filter(s => {
        const str = `${s.name_search} ${s.class.toLowerCase()} ${s.id.toLowerCase()}`;
        return str.includes(q);
    }).slice(0, 10);

    resDiv.innerHTML = '';
    if(matched.length > 0) {
        matched.forEach(s => {
            const isSelected = selectedNotiStudents.some(item => item.id === s.id);
            resDiv.innerHTML += `
                <div style="padding:10px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                    <span>${s.name} (${s.class})</span>
                    <button onclick="toggleSelectNotiStudent('${s.id}', '${s.name}')" class="btn" style="padding:5px 10px; font-size:0.8rem; background:${isSelected?'#fee2e2':'#eff6ff'}; color:${isSelected?'#ef4444':'#4f46e5'};">${isSelected?'Bỏ chọn':'Chọn'}</button>
                </div>
            `;
        });
    } else {
        resDiv.innerHTML = '<div style="padding:10px; text-align:center;">Không tìm thấy!</div>';
    }
    resDiv.style.display = 'block';
}

function toggleSelectNotiStudent(id, name) {
    const index = selectedNotiStudents.findIndex(s => s.id === id);
    if (index > -1) selectedNotiStudents.splice(index, 1);
    else selectedNotiStudents.push({ id, name });
    
    renderSelectedNotiStudents();
    searchStudentForNoti(document.getElementById('noti-search-student').value);
}

function renderSelectedNotiStudents() {
    const listDiv = document.getElementById('noti-selected-list');
    const countSpan = document.getElementById('noti-selected-count');
    countSpan.innerText = selectedNotiStudents.length;

    listDiv.innerHTML = '';
    if (selectedNotiStudents.length === 0) {
        listDiv.innerHTML = '<span style="color:#94a3b8; font-style:italic;">Chưa chọn ai...</span>';
        return;
    }
    selectedNotiStudents.forEach(s => {
        listDiv.innerHTML += `<span style="background:#4f46e5; color:white; padding:4px 10px; border-radius:15px; font-size:0.8rem;">${s.name} <i onclick="toggleSelectNotiStudent('${s.id}')" class="fas fa-times-circle" style="cursor:pointer; margin-left:5px;"></i></span>`;
    });
}

async function sendNotiToClient() {
    if (!clientDb || !currentSchoolName) return alert("❌ Hãy kết nối với một trường trước!");
    const title = document.getElementById('noti-title').value.trim(); const content = document.getElementById('noti-content').value.trim();
    const type = document.getElementById('noti-target').value; 
    
    if (!title || !content) return alert("Nhập Tiêu đề và Nội dung!");
    
    let targetValue;
    if(type === 'student_list') {
        if(selectedNotiStudents.length === 0) return alert("Vui lòng tick chọn ít nhất 1 học sinh!");
        targetValue = selectedNotiStudents.map(s => s.id);
    } else if (type === 'grade' || type === 'class') {
        targetValue = document.getElementById('noti-val').value.trim();
        if(!targetValue) return alert("Vui lòng nhập Khối/Lớp!");
    } else {
        targetValue = type === 'all' ? 'all' : 'admin_only';
    }

    try {
        const btn = document.querySelector('button[onclick="sendNotiToClient()"]');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...'; btn.disabled = true;

        const payload = { title, content, targetType: type, targetValue, sender: "FUSoftX", timestamp: firebase.firestore.FieldValue.serverTimestamp() };

        // Gửi xuống CSDL của Trường
        const docRef = await clientDb.collection('yt_notifications').add(payload);

        // Lưu bản sao vào CSDL của FUSoftX, KÈM THEO ID THU HỒI
        await db.collection('fusoftx_notifications_log').add({
            ...payload,
            schoolName: currentSchoolName,
            clientNotiId: docRef.id // Lưu lại ID của thông báo bên phía Trường
        });
        
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi Thông Báo'; btn.disabled = false;
        alert("✅ Bắn thông báo thành công!"); 
        document.getElementById('noti-title').value=''; document.getElementById('noti-content').value='';
    } catch(e) { alert("Lỗi: " + e.message); }
}

function loadFusoftxSentLog() {
    db.collection('fusoftx_notifications_log').orderBy('timestamp', 'desc').limit(50).onSnapshot(snap => {
        const tbody = document.getElementById('fusoftx-noti-log'); 
        if(!tbody) return;
        tbody.innerHTML = '';
        if (snap.empty) return tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">Chưa gửi thông báo nào.</td></tr>';
        
        snap.forEach(doc => {
            const d = doc.data(); 
            const time = d.timestamp ? new Date(d.timestamp.seconds*1000).toLocaleString('vi-VN') : '';
            
            let target;
            if (d.targetType === 'student_list') target = `${d.targetValue.length} HS được chọn`;
            else target = d.targetValue;
            
            tbody.innerHTML += `
                <tr>
                    <td style="font-size:0.85rem; color:#64748b;">${time}</td>
                    <td style="font-weight:bold;">${d.schoolName}</td>
                    <td><span class="status-badge" style="background:#fffbeb; color:#d97706;">${target}</span></td>
                    <td>${d.title}</td>
                    <td>
                        <button onclick="recallNotification('${d.schoolName}', '${d.clientNotiId}')" class="btn" style="padding:5px 10px; background:#fee2e2; color:#ef4444; font-size:0.8rem;">
                            <i class="fas fa-undo"></i> Thu hồi
                        </button>
                    </td>
                </tr>
            `;
        });
    });
}
// ==========================================
// TÍNH NĂNG NÂNG CẤP: CHAT TỰ ĐỘNG CUỘN & ĐÚNG BẢNG MỚI
// ==========================================
function loadClientTickets() {
    if (!clientDb) return;
    const filter = document.getElementById('ticket-filter').value;
    
    // ĐÃ FIX: Chỉ đọc đúng bảng yt_admin_support (Chat giữa Admin và Master)
    let query = clientDb.collection('yt_admin_support').orderBy('timestamp', 'desc');
    if (filter !== 'all') query = clientDb.collection('yt_admin_support').where('status', '==', filter).orderBy('timestamp', 'desc');

    query.onSnapshot(snap => {
        const div = document.getElementById('sp-ticket-list'); div.innerHTML = '';
        if (snap.empty) return div.innerHTML = '<p style="color:#64748b;">Trường này chưa tạo yêu cầu hỗ trợ nào.</p>';
        snap.forEach(doc => {
            const t = doc.data(); 
            const chatBoxId = `chat-box-${doc.id}`;
            
            let chatHtml = `<div id="${chatBoxId}" style="background:#f8fafc; padding:15px; border-radius:10px; margin-bottom:15px; max-height:250px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">`;
            if (t.messages) {
                t.messages.forEach(m => {
                    const isMe = m.sender === 'FUSoftX';
                    chatHtml += `<div style="align-self:${isMe?'flex-end':'flex-start'}; background:${isMe?'#4f46e5':'#e2e8f0'}; color:${isMe?'white':'#1e293b'}; padding:10px 15px; border-radius:${isMe?'15px 15px 0 15px':'15px 15px 15px 0'}; max-width:85%; font-size:0.9rem;"><div style="font-size:0.7rem; opacity:0.7; margin-bottom:3px;">${m.senderName}</div>${m.text}</div>`;
                });
            }
            chatHtml += `</div>`;

            div.innerHTML += `<div class="form-card" style="margin-bottom:0; border-top: 4px solid ${t.status==='resolved'?'#94a3b8':'#10b981'};">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                    <div><strong style="color:var(--sp-primary); font-size:1.1rem;">${t.ticketId}</strong> - Yêu cầu từ Phòng Y Tế</div>
                    <span class="status-badge" style="background:#f1f5f9; color:#475569;">Trạng thái: ${t.status === 'resolved' ? 'Đã đóng' : 'Đang xử lý'}</span>
                </div>
                ${chatHtml}
                ${t.status !== 'resolved' ? `<div style="display:flex; gap:10px;">
                    <input type="text" id="chat-reply-${doc.id}" placeholder="Nhập phản hồi cho trường..." onkeydown="if(event.key === 'Enter') replyClientTicket('${doc.id}')" style="flex:1; padding:10px; border-radius:8px; border:1px solid #cbd5e1; outline:none;">
                    <button onclick="replyClientTicket('${doc.id}')" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Gửi</button>
                    <button onclick="closeClientTicket('${doc.id}')" class="btn btn-danger"><i class="fas fa-lock"></i> Đóng HT</button>
                </div>` : `<div style="text-align:center; color:#94a3b8; font-size:0.85rem;"><i class="fas fa-lock"></i> Phiên chat đã lưu trữ</div>`}
            </div>`;

            // Tự động cuộn xuống cuối đoạn chat
            setTimeout(() => {
                const chatBox = document.getElementById(chatBoxId);
                if(chatBox) chatBox.scrollTop = chatBox.scrollHeight;
            }, 100);
        });
    });
}

async function replyClientTicket(id) {
    if (!clientDb) return; const txt = document.getElementById(`chat-reply-${id}`).value.trim(); if (!txt) return;
    document.getElementById(`chat-reply-${id}`).value = ''; // Xóa chữ ngay lập tức cho mượt
    try { await clientDb.collection('yt_admin_support').doc(id).update({ messages: firebase.firestore.FieldValue.arrayUnion({ sender: "FUSoftX", senderName: "Tổng đài FUSoftX", text: txt, time: Date.now() }), status: 'processing' }); } 
    catch(e) { alert("Lỗi: " + e.message); }
}
async function closeClientTicket(id) {
    if (!clientDb) return; if(confirm("Đóng phiên chat này? Admin trường sẽ không thể gửi thêm tin nhắn.")) await clientDb.collection('yt_admin_support').doc(id).update({ status: 'resolved' });
}
// ==========================================
// HỆ THỐNG TRA CỨU ĐA LUỒNG & CHỈNH SỬA (MULTIPLE DATABASES)
// ==========================================

// 1. Hàm khởi tạo kết nối ngầm tới TẤT CẢ CÁC TRƯỜNG
async function initAllDatabasesAndCache() {
    console.log("Đang mở luồng kết nối tới toàn bộ trường học...");
    
    for (let school of allSchoolsConfig) {
        if (!activeDatabases[school.name]) {
            try {
                // Tạo kết nối ngầm định
                const appName = "GlobalApp_" + school.name.replace(/\s+/g, '') + "_" + Date.now();
                const app = firebase.initializeApp(school.config, appName);
                
                // Đăng nhập ngầm để lấy quyền truy cập CSDL của trường đó
                await app.auth().signInWithEmailAndPassword("master@fusoftx.com", "fusoftx123456");
                
                // Lưu kết nối vào RAM để xài chung
                activeDatabases[school.name] = app.firestore();
            } catch(e) {
                console.error(`Lỗi mở luồng trường ${school.name}:`, e);
            }
        }
    }
    
    // Sau khi mở luồng xong, nạp bộ đệm học sinh
    refreshGlobalCache();
}

// 2. Nạp toàn bộ học sinh vào RAM để tra cứu siêu tốc
async function refreshGlobalCache() {
    isGlobalCacheReady = false; // Tắt cờ báo hiệu, bắt đầu nạp lại
    const btn = document.querySelector('button[onclick="refreshGlobalCache()"]');
    const input = document.getElementById('sp-lookup-input');
    
    if(btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đồng bộ...'; btn.disabled = true; }
    if(input) input.placeholder = "Đang nạp dữ liệu từ các trường, vui lòng chờ...";

    globalStudentsCache = [];
    
    for (const [schoolName, dbInstance] of Object.entries(activeDatabases)) {
        try {
            const snap = await dbInstance.collection('yt_students').get();
            snap.forEach(doc => {
                const studentData = doc.data();
                // Đảm bảo có name_search để không bị lỗi
                if (!studentData.name_search) studentData.name_search = removeVietnameseTones(studentData.name || "");
                
                globalStudentsCache.push({
                    id: doc.id,
                    schoolName: schoolName,
                    ...studentData
                });
            });
        } catch(e) { console.error(`Lỗi tải HS trường ${schoolName}:`, e); }
    }
    
    if(btn) { btn.innerHTML = '<i class="fas fa-sync-alt"></i> Làm mới Dữ liệu'; btn.disabled = false; }
    if(input) input.placeholder = "Gõ tên, mã học sinh, lớp hoặc sđt...";
    
    console.log(`Đã nạp ${globalStudentsCache.length} học sinh toàn hệ thống.`);
    isGlobalCacheReady = true; // Bật cờ, báo hiệu đã sẵn sàng tìm kiếm!
}

// Hàm loại bỏ dấu (Xài chung)
function removeVietnameseTones(str) {
    if (!str) return "";
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a").replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e").replace(/ì|í|ị|ỉ|ĩ/g, "i").replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o").replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u").replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y").replace(/đ/g, "d");
    return str.toLowerCase();
}

// 3. Tìm kiếm tức thì từ bộ đệm (RAM)
function searchGlobalSuggest(val) {
    const box = document.getElementById('sp-lookup-suggest');
    const hiddenId = document.getElementById('sp-lookup-id');
    const hiddenSchool = document.getElementById('sp-lookup-school');
    
    if (!isGlobalCacheReady) {
        box.innerHTML = '<div style="padding:15px; color:#f59e0b; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Hệ thống đang nạp dữ liệu... Vui lòng chờ trong giây lát.</div>';
        box.style.display = 'block';
        return;
    }

    if (val.length < 2) { box.style.display = 'none'; return; }
    const q = removeVietnameseTones(val.trim());

    const matched = globalStudentsCache.filter(s => {
        const str = `${s.name_search} ${s.class.toLowerCase()} ${s.id.toLowerCase()} ${(s.studentCode||'').toLowerCase()} ${(s.phone||'')} ${(s.parentPhone||'')}`;
        return str.includes(q);
    }).slice(0, 15);

    box.innerHTML = '';
    if (matched.length === 0) {
        box.innerHTML = '<div style="padding:15px; color:#ef4444; text-align:center;">Không tìm thấy!</div>';
    } else {
        matched.forEach(d => {
            box.innerHTML += `
                <div style="padding:10px 15px; border-bottom:1px solid #f1f5f9; cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'"
                     onclick="selectGlobalStudent('${d.id}', '${d.name}', '${d.class}', '${d.schoolName}')">
                    <div style="display:flex; justify-content:space-between;">
                        <strong style="color:#0f172a;">${d.name} <span style="color:#ef4444;">(${d.class})</span></strong>
                        <span style="background:#e0e7ff; color:#4f46e5; font-size:0.75rem; padding:2px 8px; border-radius:10px; font-weight:bold;">${d.schoolName}</span>
                    </div>
                    <div style="font-size:0.8rem; color:#64748b; margin-top:3px;">Mã YT: ${d.id} | Mã HS: ${d.studentCode||'--'}</div>
                </div>`;
        });
    }
    box.style.display = 'block';
}

function selectGlobalStudent(id, name, cls, schoolName) {
    document.getElementById('sp-lookup-input').value = `${name} - ${cls} [${schoolName}]`;
    document.getElementById('sp-lookup-id').value = id;
    document.getElementById('sp-lookup-school').value = schoolName;
    document.getElementById('sp-lookup-suggest').style.display = 'none';
}

// Ẩn box khi click ra ngoài
document.addEventListener('click', e => {
    if(e.target.id !== 'sp-lookup-input') document.getElementById('sp-lookup-suggest').style.display = 'none';
});

// 4. Tra cứu Dữ liệu Thực tế (Trực tiếp từ CSDL của trường đó)
async function performGlobalLookup() {
    const sid = document.getElementById('sp-lookup-id').value;
    const schoolName = document.getElementById('sp-lookup-school').value;
    const resDiv = document.getElementById('sp-lookup-result');

    if (!sid || !schoolName) return alert("Chọn 1 học sinh từ danh sách gợi ý!");

    const schoolDb = activeDatabases[schoolName];
    if (!schoolDb) return alert("Mất kết nối với CSDL của trường này!");

    resDiv.style.display = 'block';
    resDiv.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x"></i><p>FUSoftX đang truy xuất dữ liệu từ trường...</p></div>';

    try {
        const doc = await schoolDb.collection('yt_students').doc(sid).get();
        const st = doc.data();

        const vSnap = await schoolDb.collection('yt_visits').where('studentId', '==', sid).get();
        let visits = []; vSnap.forEach(v => visits.push(v.data()));
        visits.sort((a,b) => (b.timestamp?.seconds||0) - (a.timestamp?.seconds||0));

        let bmiHTML = `<span style="color:#94a3b8;">Chưa cập nhật</span>`;
        if (st.height && st.weight) {
            const h = parseFloat(st.height); const w = parseFloat(st.weight);
            const bmi = (w / Math.pow(h/100, 2)).toFixed(1);
            bmiHTML = `<strong style="color:${bmi < 18.5 ? "#f59e0b" : (bmi >= 25 ? "#ef4444" : "#10b981")}; font-size:1.1rem;">${bmi}</strong>`;
        }

        resDiv.innerHTML = `
            <div class="form-card" style="background: #1e1b4b; color: white; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="color: white; margin-bottom: 5px;">${st.name}</h2>
                    <div style="color: #a5b4fc;">Lớp: <b>${st.class}</b> | Trường: <b style="color:#fef08a;">${schoolName}</b></div>
                </div>
                <button onclick="openGlobalEdit('${st.id}', '${schoolName}')" class="btn" style="background:#4f46e5; color:white;"><i class="fas fa-edit"></i> Chỉnh sửa (Override)</button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div class="form-card" style="margin:0;">
                    <h3 style="color:#4f46e5;"><i class="fas fa-address-card"></i> Thông tin</h3>
                    <p><b>Mã HS:</b> ${st.studentCode||'--'} | <b>Mã YT:</b> ${st.id}</p>
                    <p><b>SĐT:</b> ${st.phone||'--'} | <b>PH:</b> ${st.parentPhone||'--'}</p>
                    <p><b>Email LK:</b> <span style="color:#0ea5e9;">${st.linkedEmail||'Chưa có'}</span></p>
                    <hr style="border:0; border-top:1px dashed #cbd5e1; margin:15px 0;">
                    <div style="display:flex; justify-content:space-around; text-align:center;">
                        <div><div style="font-size:0.8rem; color:#64748b;">CAO</div><b>${st.height||'--'} cm</b></div>
                        <div><div style="font-size:0.8rem; color:#64748b;">NẶNG</div><b>${st.weight||'--'} kg</b></div>
                        <div><div style="font-size:0.8rem; color:#64748b;">BMI</div>${bmiHTML}</div>
                    </div>
                </div>
                <div class="form-card" style="margin:0;">
                    <h3 style="color:#ef4444;"><i class="fas fa-history"></i> Lịch sử Khám Bệnh (${visits.length})</h3>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${visits.length === 0 ? '<p style="color:#94a3b8;">Chưa có lịch sử khám.</p>' : visits.map(v => `
                            <div style="border-left: 3px solid #ef4444; background: #f8fafc; padding: 10px; margin-bottom: 8px;">
                                <div style="font-size: 0.8rem; color: #64748b;">${v.timestamp ? new Date(v.timestamp.seconds*1000).toLocaleString('vi-VN') : ''}</div>
                                <div><b>Bệnh:</b> ${v.symptom} <i class="fas fa-arrow-right"></i> <span style="color:#10b981;">${v.treatment}</span></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } catch(e) { resDiv.innerHTML = `<div style="color:red; text-align:center;">Lỗi: ${e.message}</div>`; }
}

// 5. Tính năng OVERRIDE (Chỉnh sửa trực tiếp từ FUSoftX)
async function openGlobalEdit(sid, schoolName) {
    const schoolDb = activeDatabases[schoolName];
    try {
        const doc = await schoolDb.collection('yt_students').doc(sid).get();
        const d = doc.data();
        
        document.getElementById('sp-edit-school-badge').innerHTML = `<i class="fas fa-database"></i> Thuộc CSDL: ${schoolName}`;
        document.getElementById('sp-edit-id').value = sid;
        document.getElementById('sp-edit-school').value = schoolName;
        
        const sf = (id, val) => { document.getElementById(id).value = val || ''; };
        sf('sp-edit-code', d.studentCode); sf('sp-edit-name', d.name); sf('sp-edit-class', d.class);
        sf('sp-edit-dob', d.dob); sf('sp-edit-gender', d.gender); sf('sp-edit-phone', d.phone);
        sf('sp-edit-parent-phone', d.parentPhone); sf('sp-edit-height', d.height); sf('sp-edit-weight', d.weight);
        sf('sp-edit-note', d.medicalNote);

        document.getElementById('sp-edit-modal').style.display = 'flex';
    } catch(e) { alert("Lỗi đọc dữ liệu: " + e.message); }
}

async function saveGlobalStudentEdit() {
    const sid = document.getElementById('sp-edit-id').value;
    const schoolName = document.getElementById('sp-edit-school').value;
    const schoolDb = activeDatabases[schoolName];

    const dataToSave = {
        studentCode: document.getElementById('sp-edit-code').value.trim(), 
        name: document.getElementById('sp-edit-name').value.trim(),
        class: document.getElementById('sp-edit-class').value.trim(),
        name_search: removeVietnameseTones(document.getElementById('sp-edit-name').value.trim()),
        dob: document.getElementById('sp-edit-dob').value,
        gender: document.getElementById('sp-edit-gender').value,
        phone: document.getElementById('sp-edit-phone').value.trim(),
        parentPhone: document.getElementById('sp-edit-parent-phone').value.trim(),
        height: document.getElementById('sp-edit-height').value.trim(),
        weight: document.getElementById('sp-edit-weight').value.trim(),
        medicalNote: document.getElementById('sp-edit-note').value.trim()
    };

    if(!dataToSave.name || !dataToSave.class) return alert("Tên và lớp không được trống!");

    const btn = document.querySelector('button[onclick="saveGlobalStudentEdit()"]');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang nạp lên mây...';

    try {
        // Ghi đè thẳng vào Firebase của trường đó
        await schoolDb.collection('yt_students').doc(sid).update(dataToSave);
        alert("✅ Đã ghi đè dữ liệu thành công!");
        document.getElementById('sp-edit-modal').style.display = 'none';
        performGlobalLookup(); // Render lại giao diện hiển thị
        refreshGlobalCache(); // Update lại RAM tìm kiếm
    } catch(e) {
        alert("Lỗi cập nhật: " + e.message);
    } finally {
        btn.innerHTML = '<i class="fas fa-save"></i> Lưu đè lên CSDL Trường';
    }
}
// HÀM THU HỒI TIN NHẮN
async function recallNotification(schoolName, clientNotiId) {
    if (!activeDatabases[schoolName]) return alert(`Kết nối tới trường ${schoolName} đã mất. Vui lòng tải lại trang.`);
    if (!confirm(`Thu hồi vĩnh viễn thông báo này khỏi hệ thống của trường ${schoolName}?`)) return;

    try {
        const schoolDb = activeDatabases[schoolName];
        
        // Xóa thông báo ở CSDL của trường
        await schoolDb.collection('yt_notifications').doc(clientNotiId).delete();
        
        // Xóa log ở CSDL của FUSoftX
        const logSnap = await db.collection('fusoftx_notifications_log').where('clientNotiId', '==', clientNotiId).get();
        if(!logSnap.empty) {
            await db.collection('fusoftx_notifications_log').doc(logSnap.docs[0].id).delete();
        }
        
        alert("✅ Thu hồi thành công!");
    } catch(e) {
        alert("Lỗi thu hồi: " + e.message);
    }
}

// CẬP NHẬT KHI KẾT NỐI TRƯỜNG: Reset bộ nhớ đệm
async function connectToSchool(schoolName, configString) {
    try {
        const conf = JSON.parse(decodeURIComponent(configString));
        if (clientApp) { await clientApp.delete(); clientApp = null; clientDb = null; }
        clientApp = firebase.initializeApp(conf, "ClientSchool_" + Date.now()); 
        clientDb = clientApp.firestore();
        
        await clientApp.auth().signInWithEmailAndPassword("master@fusoftx.com", "fusoftx123456");
        currentSchoolName = schoolName;

        // Reset Cache khi kết nối trường mới
        clientStudentsCache = [];
        selectedNotiStudents = [];
        renderSelectedNotiStudents();
        document.getElementById('noti-search-student').value = '';

        const stBar = document.getElementById('connection-status');
        stBar.style.background = '#dcfce7'; stBar.style.color = '#15803d';
        stBar.innerHTML = `<span><i class="fas fa-link"></i> ĐANG TRUY CẬP DỮ LIỆU: <strong style="text-transform:uppercase;">${schoolName}</strong></span> <button onclick="location.reload()" class="btn btn-danger" style="padding:5px 10px;">Ngắt kết nối</button>`;
        document.getElementById('lbl-tab-noti').innerHTML = `<i class="fas fa-bullhorn"></i> Gửi Thông Báo - <span style="color:var(--sp-primary); text-transform:uppercase;">${schoolName}</span>`;
        document.getElementById('lbl-tab-support').innerHTML = `<i class="fas fa-headset"></i> Hỗ trợ Khách hàng - <span style="color:var(--sp-primary); text-transform:uppercase;">${schoolName}</span>`;
        
        document.querySelectorAll('.nav-btn')[2].click(); 
    } catch (e) { alert("Kết nối thất bại: " + e.message); }
}
