// ========================================================
// FUSOFTX - SUPER ADMIN CORE LOGIC (PHIÊN BẢN ĐÃ NÂNG CẤP)
// ========================================================

const SUPER_ADMIN_EMAILS = ["nguyentinh52009@gmail.com", "tomizy09icloud@gmail.com"];

let clientApp = null;
let clientDb = null;
let currentSchoolName = "";
let allSchoolsConfig = []; 

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

    if(tabId === 'tab-noti') loadClientNotis();
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

// --- GỬI THÔNG BÁO ---
function toggleNotiInput() {
    const type = document.getElementById('noti-target').value;
    const box = document.getElementById('box-noti-val');
    const lbl = document.getElementById('lbl-noti-val');
    const inp = document.getElementById('noti-val');
    if (['admin_only', 'all'].includes(type)) { box.style.display = 'none'; inp.value = ''; }
    else { box.style.display = 'block'; lbl.innerText = type === 'grade' ? "Nhập Khối (VD: 10)" : (type === 'class' ? "Nhập Lớp (VD: 11A4)" : "Nhập Mã YT"); }
}

async function sendNotiToClient() {
    if (!clientDb) return alert("❌ Hãy kết nối với một trường trước!");
    const title = document.getElementById('noti-title').value.trim(); const content = document.getElementById('noti-content').value.trim();
    const type = document.getElementById('noti-target').value; let val = document.getElementById('noti-val').value.trim();
    if (!title || !content) return alert("Nhập Tiêu đề và Nội dung!");
    if (!['admin_only', 'all'].includes(type) && !val) return alert("Nhập đối tượng nhận!");
    if (type === 'class') val = val.toUpperCase(); if (type === 'student' && val.toLowerCase().startsWith('yt-')) val = val.toUpperCase();

    try {
        await clientDb.collection('yt_notifications').add({ title, content, targetType: type, targetValue: val, sender: "FUSoftX", timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        alert("✅ Bắn thông báo thành công!"); document.getElementById('noti-title').value=''; document.getElementById('noti-content').value='';
    } catch(e) { alert("Lỗi: " + e.message); }
}

function loadClientNotis() {
    if (!clientDb) return;
    clientDb.collection('yt_notifications').where('sender', '==', 'FUSoftX').orderBy('timestamp', 'desc').onSnapshot(snap => {
        const div = document.getElementById('sp-noti-list'); div.innerHTML = '';
        if (snap.empty) return div.innerHTML = '<p style="color:#64748b;">Chưa gửi thông báo nào cho trường này.</p>';
        snap.forEach(doc => {
            const d = doc.data(); const time = d.timestamp ? new Date(d.timestamp.seconds*1000).toLocaleString('vi-VN') : '';
            div.innerHTML += `<div class="form-card" style="padding:15px; margin-bottom:0; border-left:3px solid var(--sp-warning);">
                <div style="display:flex; justify-content:space-between;"><strong>${d.title}</strong><span class="status-badge" style="background:#fffbeb; color:#d97706;">${d.targetType}</span></div>
                <div style="font-size:0.8rem; color:#64748b; margin-top:5px;">${time}</div><div style="margin-top:10px;">${d.content}</div>
            </div>`;
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
