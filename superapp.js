// --- 1. CẤU HÌNH BẢO MẬT SUPER ADMIN ---
const SUPER_ADMIN_EMAILS = ["nguyentinh52009@gmail.com", "tomizy09icloud@gmail.com"];

// Khai báo biến Xuyên Cơ Sở Dữ Liệu
let clientApp = null;
let clientDb = null;
let currentSchoolName = "";

firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        if (SUPER_ADMIN_EMAILS.includes(user.email)) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard-screen').style.display = 'flex';
            document.getElementById('sa-email').innerText = user.email;
            document.getElementById('sa-profile-email').value = user.email;
            loadLinkedSchools(); 
        } else {
            alert("Tài khoản không có quyền truy cập hệ thống trung tâm!");
            firebase.auth().signOut();
        }
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard-screen').style.display = 'none';
    }
});

function loginSuperAdmin() {
    const btn = document.getElementById('btn-login');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang kết nối...'; btn.disabled = true;
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())
        .then(() => { btn.innerHTML = originalText; btn.disabled = false; })
        .catch(err => {
            btn.innerHTML = originalText; btn.disabled = false;
            if (err.code !== 'auth/popup-closed-by-user') alert("❌ Lỗi Firebase: " + err.message);
        });
}

function switchSaTab(tabId, btn) {
    document.querySelectorAll('.tab-pane').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    btn.classList.add('active');

    // Tự động load data nếu tab cần Database Client
    if(tabId === 'tab-noti') loadClientNotis();
    if(tabId === 'tab-support') loadClientTickets();
}

// --- 2. XỬ LÝ LIÊN KẾT CƠ SỞ DỮ LIỆU CÁC TRƯỜNG ---
async function parseAndSaveSchool() {
    const schoolName = document.getElementById('school-name').value.trim();
    const apiKey = document.getElementById('cfg-apiKey').value.trim();
    const authDomain = document.getElementById('cfg-authDomain').value.trim();
    const projectId = document.getElementById('cfg-projectId').value.trim();
    const storageBucket = document.getElementById('cfg-storageBucket').value.trim();
    const messagingSenderId = document.getElementById('cfg-messagingSenderId').value.trim();
    const appId = document.getElementById('cfg-appId').value.trim();

    if (!schoolName || !apiKey || !projectId || !appId) return alert("Nhập đủ Tên trường và các ô có dấu *");
    
    const btn = document.querySelector('button[onclick="parseAndSaveSchool()"]');
    btn.innerHTML = 'Đang lưu...'; btn.disabled = true;

    try {
        await db.collection('linked_schools').add({
            name: schoolName,
            config: { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId },
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("✅ Thêm khách hàng thành công!");
        ['school-name', 'cfg-apiKey', 'cfg-authDomain', 'cfg-projectId', 'cfg-storageBucket', 'cfg-messagingSenderId', 'cfg-appId'].forEach(id => document.getElementById(id).value = '');
    } catch (error) { alert("❌ Lỗi: " + error.message); }
    btn.innerHTML = '<i class="fas fa-plus"></i> Thêm Khách hàng'; btn.disabled = false;
}

function loadLinkedSchools() {
    db.collection('linked_schools').orderBy('createdAt', 'desc').onSnapshot(snap => {
        document.getElementById('stat-schools').innerText = snap.size; // Cập nhật Dashboard
        const listDiv = document.getElementById('school-list'); listDiv.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            const configString = encodeURIComponent(JSON.stringify(data.config));
            listDiv.innerHTML += `
                <div class="form-card" style="margin-bottom: 0; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--sp-success);">
                    <div><h3 style="margin: 0 0 5px;">${data.name}</h3><p style="margin: 0; font-size: 0.8rem; color: #64748b;">Project ID: <strong>${data.config.projectId}</strong></p></div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="connectToSchool('${data.name}', '${configString}')" class="btn btn-success"><i class="fas fa-plug"></i> Truy cập</button>
                        <button onclick="deleteSchool('${doc.id}')" class="btn btn-danger"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        });
    });
}
async function deleteSchool(id) { if(confirm("Xóa trường này khỏi danh sách quản lý?")) await db.collection('linked_schools').doc(id).delete(); }

// --- 3. KẾT NỐI XUYÊN CƠ SỞ DỮ LIỆU ---
async function connectToSchool(schoolName, configString) {
    try {
        const schoolConfig = JSON.parse(decodeURIComponent(configString));
        if (clientApp) { await clientApp.delete(); clientApp = null; clientDb = null; }

        // Khởi tạo App thứ 2
        clientApp = firebase.initializeApp(schoolConfig, "ClientSchool");
        clientDb = clientApp.firestore();
        currentSchoolName = schoolName;

        // Đổi trạng thái ghim trên đầu web
        const stBar = document.getElementById('connection-status');
        stBar.style.background = '#dcfce7'; stBar.style.color = '#15803d';
        stBar.innerHTML = `<span><i class="fas fa-link"></i> ĐANG TRUY CẬP DỮ LIỆU: <strong>${schoolName}</strong></span> <button onclick="location.reload()" style="background:white; border:1px solid #15803d; border-radius:5px; color:#15803d; cursor:pointer; padding:3px 10px; font-weight:bold;">Ngắt kết nối</button>`;

        // Cập nhật tiêu đề Tab để chống nhầm lẫn
        document.querySelector('#tab-noti h2').innerHTML = `<i class="fas fa-bullhorn"></i> Thông báo cho <span style="color:var(--sp-primary);">${schoolName}</span>`;
        document.querySelector('#tab-support h2').innerHTML = `<i class="fas fa-headset"></i> Hỗ trợ cho <span style="color:var(--sp-primary);">${schoolName}</span>`;

        alert(`✅ Cổng không gian đã mở! Bạn đang làm việc trên CSDL của: ${schoolName}`);
        document.querySelectorAll('.nav-btn')[1].click(); // Chuyển sang Tab Thông báo
    } catch (error) { alert("❌ Kết nối thất bại. Lỗi: " + error.message); }
}

// --- 4. GỬI THÔNG BÁO XUỐNG TRƯỜNG ---
async function sendNotiToClient() {
    if (!clientDb) return alert("❌ Bạn phải vào Tab 4 và bấm [Truy cập] một trường học trước!");
    
    const title = document.getElementById('noti-title').value.trim();
    const content = document.getElementById('noti-content').value.trim();
    const target = document.getElementById('noti-target').value;

    if (!title || !content) return alert("Nhập Tiêu đề và Nội dung!");

    try {
        await clientDb.collection('yt_notifications').add({
            title: title, content: content,
            targetType: target === 'all_students' ? 'all' : 'admin_only', // admin_only là loại đặc biệt
            sender: "FUSoftX Support",
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("✅ Đã bắn thông báo xuống hệ thống của trường!");
        document.getElementById('noti-title').value = ''; document.getElementById('noti-content').value = '';
    } catch (e) { alert("Lỗi gửi thông báo: " + e.message); }
}

function loadClientNotis() {
    if (!clientDb) return;
    clientDb.collection('yt_notifications').where('sender', '==', 'FUSoftX Support').orderBy('timestamp', 'desc').onSnapshot(snap => {
        const div = document.getElementById('sp-noti-list'); div.innerHTML = '';
        if (snap.empty) return div.innerHTML = '<p style="color:#64748b;">FUSoftX chưa gửi thông báo nào cho trường này.</p>';
        snap.forEach(doc => {
            const d = doc.data(); const time = d.timestamp ? new Date(d.timestamp.seconds*1000).toLocaleString('vi-VN') : '';
            div.innerHTML += `<div class="form-card" style="padding:15px; margin-bottom:0; border-left: 3px solid var(--sp-warning);"><div style="display:flex; justify-content:space-between;"><strong>${d.title}</strong><span class="status-badge" style="background:#fffbeb; color:#d97706;">${d.targetType==='all' ? 'Gửi cho HS' : 'Chỉ gửi Admin'}</span></div><div style="font-size:0.8rem; color:#64748b; margin-top:5px;">${time}</div><p style="margin-top:10px;">${d.content}</p></div>`;
        });
    });
}

// --- 5. HỖ TRỢ TRƯỜNG HỌC (TICKETS) ---
function loadClientTickets() {
    if (!clientDb) return;
    const filter = document.getElementById('ticket-filter').value;
    let query = clientDb.collection('yt_tickets').orderBy('timestamp', 'desc');
    if (filter !== 'all') query = clientDb.collection('yt_tickets').where('status', '==', filter).orderBy('timestamp', 'desc');

    query.onSnapshot(snap => {
        const div = document.getElementById('sp-ticket-list'); div.innerHTML = '';
        if (snap.empty) return div.innerHTML = '<p style="color:#64748b;">Không có dữ liệu yêu cầu.</p>';
        
        snap.forEach(doc => {
            const t = doc.data(); const time = t.timestamp ? new Date(t.timestamp.seconds*1000).toLocaleString('vi-VN') : '';
            div.innerHTML += `
                <div class="form-card" style="margin-bottom:0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <div><strong style="color:var(--sp-primary); font-size:1.1rem;">${t.ticketId}</strong> - ${t.name} (${t.class})</div>
                        <span class="status-badge" style="background:#f1f5f9; color:#475569;">Trạng thái: ${t.status}</span>
                    </div>
                    <p style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 3px solid #94a3b8;">${t.content}</p>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #cbd5e1;">
                        <label style="font-size: 0.85rem; font-weight: bold; color: var(--sp-success);">PHẢN HỒI CỦA FUSOFTX:</label>
                        <textarea id="fusoft-reply-${doc.id}" rows="2" style="width: 100%; padding: 10px; margin-top: 5px; border-radius: 8px; border: 1px solid #cbd5e1;">${t.adminReply || ''}</textarea>
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <button onclick="replyClientTicket('${doc.id}', 'processing')" class="btn btn-primary" style="font-size:0.85rem;"><i class="fas fa-save"></i> Đang xử lý</button>
                            <button onclick="replyClientTicket('${doc.id}', 'resolved')" class="btn btn-success" style="font-size:0.85rem;"><i class="fas fa-check"></i> Hoàn tất & Đóng</button>
                        </div>
                    </div>
                </div>`;
        });
    });
}
async function replyClientTicket(id, status) {
    if (!clientDb) return;
    const txt = document.getElementById(`fusoft-reply-${id}`).value;
    try {
        await clientDb.collection('yt_tickets').doc(id).update({ adminReply: "FUSoftX Support: " + txt, status: status });
    } catch(e) { alert("Lỗi: " + e.message); }
}
