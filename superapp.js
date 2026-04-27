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

// --- 2. QUẢN LÝ HỢP ĐỒNG & CSDL ---
async function saveContract() {
    const name = document.getElementById('contract-name').value.trim();
    const rep = document.getElementById('contract-rep').value.trim();
    const phone = document.getElementById('contract-phone').value.trim();
    const pack = document.getElementById('contract-package').value;
    const start = document.getElementById('contract-start').value;
    const end = document.getElementById('contract-end').value;

    const apiKey = document.getElementById('cfg-apiKey').value.trim();
    const projectId = document.getElementById('cfg-projectId').value.trim();
    const appId = document.getElementById('cfg-appId').value.trim();

    if (!name || !apiKey || !projectId || !appId || !start || !end) return alert("Nhập đủ Tên trường, Hợp đồng và các ô cấu hình có dấu *");

    const btn = document.querySelector('button[onclick="saveContract()"]');
    btn.innerHTML = 'Đang xử lý...'; btn.disabled = true;

    try {
        const schoolConfig = {
            apiKey, projectId, appId,
            authDomain: document.getElementById('cfg-authDomain').value.trim(),
            storageBucket: document.getElementById('cfg-storageBucket').value.trim(),
            messagingSenderId: document.getElementById('cfg-messagingSenderId').value.trim()
        };

        await db.collection('linked_schools').add({
            name, repName: rep, phone, package: pack, startDate: start, endDate: end,
            config: schoolConfig,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("✅ Đã tạo Hợp đồng & Liên kết CSDL thành công!");
        // Clear inputs...
        ['contract-name', 'contract-rep', 'contract-phone', 'contract-start', 'contract-end', 'cfg-apiKey', 'cfg-projectId', 'cfg-appId', 'cfg-authDomain', 'cfg-storageBucket', 'cfg-messagingSenderId'].forEach(id => document.getElementById(id).value = '');
    } catch (error) { alert("❌ Lỗi: " + error.message); }
    btn.innerHTML = '<i class="fas fa-file-signature"></i> Ký Hợp Đồng & Liên Kết CSDL'; btn.disabled = false;
}

function loadLinkedSchools() {
    db.collection('linked_schools').orderBy('createdAt', 'desc').onSnapshot(snap => {
        document.getElementById('stat-schools').innerText = snap.size;
        const listDiv = document.getElementById('school-list'); listDiv.innerHTML = '';
        
        snap.forEach(doc => {
            const d = doc.data();
            const configString = encodeURIComponent(JSON.stringify(d.config));
            
            // Tính toán tình trạng hợp đồng
            let statusHtml = "";
            const today = new Date(); const endDate = new Date(d.endDate);
            const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysLeft < 0) statusHtml = `<span style="color:#ef4444; font-weight:bold;">Hết hạn</span>`;
            else if (daysLeft <= 30) statusHtml = `<span style="color:#f59e0b; font-weight:bold;">Sắp hết hạn (${daysLeft} ngày)</span>`;
            else statusHtml = `<span style="color:#10b981; font-weight:bold;">Đang hoạt động</span>`;

            listDiv.innerHTML += `
                <div class="form-card" style="margin-bottom: 0; border-left: 4px solid var(--sp-primary);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                        <div>
                            <h3 style="margin: 0 0 5px; color: var(--sp-dark);">${d.name}</h3>
                            <div style="font-size: 0.85rem; color: #64748b;">Đại diện: <strong>${d.repName}</strong> | SĐT: <strong>${d.phone}</strong></div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size: 0.8rem; background: #e0e7ff; color: #4338ca; padding: 3px 10px; border-radius: 20px; display:inline-block; margin-bottom:5px;">Gói ${d.package}</div>
                            <div style="font-size: 0.85rem;">Tình trạng: ${statusHtml}</div>
                        </div>
                    </div>
                    <div style="background: #f8fafc; padding: 10px; border-radius: 8px; font-size: 0.8rem; color: #64748b; margin-bottom: 15px;">Hợp đồng: ${new Date(d.startDate).toLocaleDateString('vi-VN')} - ${new Date(d.endDate).toLocaleDateString('vi-VN')} | ProjectID: ${d.config.projectId}</div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button onclick="connectToSchool('${d.name}', '${configString}')" class="btn btn-success"><i class="fas fa-plug"></i> Truy cập CSDL</button>
                        <button onclick="deleteSchool('${doc.id}')" class="btn btn-danger"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        });
    });
}
async function deleteSchool(id) { if(confirm("Xóa Hợp đồng này?")) await db.collection('linked_schools').doc(id).delete(); }

// --- 3. KẾT NỐI XUYÊN CƠ SỞ DỮ LIỆU ---
async function connectToSchool(schoolName, configString) {
    try {
        const schoolConfig = JSON.parse(decodeURIComponent(configString));
        if (clientApp) { await clientApp.delete(); clientApp = null; clientDb = null; }
        clientApp = firebase.initializeApp(schoolConfig, "ClientSchool");
        clientDb = clientApp.firestore();
        currentSchoolName = schoolName;

        const stBar = document.getElementById('connection-status');
        stBar.style.background = '#dcfce7'; stBar.style.color = '#15803d';
        stBar.innerHTML = `<span><i class="fas fa-link"></i> ĐANG TRUY CẬP DỮ LIỆU: <strong>${schoolName}</strong></span> <button onclick="location.reload()" style="background:white; border:1px solid #15803d; border-radius:5px; color:#15803d; cursor:pointer; padding:3px 10px; font-weight:bold;">Ngắt kết nối</button>`;

        alert(`✅ Cổng không gian đã mở! Bạn đang làm việc trên CSDL của: ${schoolName}`);
        document.querySelectorAll('.nav-btn')[1].click(); 
    } catch (error) { alert("❌ Lỗi: " + error.message); }
}

// --- 4. HỖ TRỢ CHAT 2 CHIỀU (TICKETS) ---
function loadClientTickets() {
    if (!clientDb) return;
    const filter = document.getElementById('ticket-filter').value;
    let query = clientDb.collection('yt_tickets').orderBy('timestamp', 'desc');
    if (filter !== 'all') query = clientDb.collection('yt_tickets').where('status', '==', filter).orderBy('timestamp', 'desc');

    query.onSnapshot(snap => {
        const div = document.getElementById('sp-ticket-list'); div.innerHTML = '';
        if (snap.empty) return div.innerHTML = '<p style="color:#64748b;">Không có dữ liệu yêu cầu.</p>';
        
        snap.forEach(doc => {
            const t = doc.data(); 
            const time = t.timestamp ? new Date(t.timestamp.seconds*1000).toLocaleString('vi-VN') : '';
            
            // Xây dựng khung Chat
            let chatHtml = `<div style="background: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 15px; max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">`;
            
            // Lời nhắn gốc
            chatHtml += `<div style="align-self: flex-start; background: #e0e7ff; color: #312e81; padding: 10px 15px; border-radius: 15px 15px 15px 0; max-width: 85%; font-size: 0.9rem;"><strong>${t.name} (Gốc):</strong> ${t.content}</div>`;
            
            // Các tin nhắn tiếp theo (Dạng mảng)
            if (t.messages && t.messages.length > 0) {
                t.messages.forEach(m => {
                    const isFusoft = m.sender === 'FUSoftX';
                    const align = isFusoft ? 'align-self: flex-end; background: #4f46e5; color: white; border-radius: 15px 15px 0 15px;' : 'align-self: flex-start; background: #e0e7ff; color: #312e81; border-radius: 15px 15px 15px 0;';
                    chatHtml += `<div style="${align} padding: 10px 15px; max-width: 85%; font-size: 0.9rem;"><strong>${m.sender}:</strong> ${m.text}</div>`;
                });
            }
            chatHtml += `</div>`;

            div.innerHTML += `
                <div class="form-card" style="margin-bottom:0; border-top: 4px solid ${t.status==='resolved'?'#94a3b8':'#10b981'};">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                        <div><strong style="color:var(--sp-primary); font-size:1.1rem;">${t.ticketId}</strong> - ${t.name} (${t.class})</div>
                        <span class="status-badge" style="background:#f1f5f9; color:#475569;">${t.status==='resolved'?'Đã đóng':'Đang mở'}</span>
                    </div>
                    
                    ${chatHtml}
                    
                    ${t.status !== 'resolved' ? `
                        <div style="display:flex; gap:10px;">
                            <input type="text" id="chat-reply-${doc.id}" placeholder="Nhập tin nhắn trả lời..." style="flex:1; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1;">
                            <button onclick="replyClientTicket('${doc.id}')" class="btn btn-primary"><i class="fas fa-paper-plane"></i></button>
                            <button onclick="closeClientTicket('${doc.id}')" class="btn btn-danger" style="background:#ef4444;"><i class="fas fa-lock"></i> Đóng</button>
                        </div>
                    ` : `<div style="text-align:center; color:#94a3b8; font-size:0.85rem;"><i class="fas fa-lock"></i> Phiên chat đã kết thúc</div>`}
                </div>`;
        });
    });
}

// Bắn tin nhắn chat mới vào mảng
async function replyClientTicket(id) {
    if (!clientDb) return;
    const txt = document.getElementById(`chat-reply-${id}`).value.trim();
    if (!txt) return;

    try {
        await clientDb.collection('yt_tickets').doc(id).update({
            messages: firebase.firestore.FieldValue.arrayUnion({
                sender: "FUSoftX",
                text: txt,
                time: Date.now()
            }),
            status: 'processing' // Chuyển trạng thái sang đang xử lý
        });
    } catch(e) { alert("Lỗi: " + e.message); }
}

async function closeClientTicket(id) {
    if (!clientDb) return;
    if(confirm("Đóng yêu cầu này? Học sinh sẽ không thể chat tiếp.")) {
        await clientDb.collection('yt_tickets').doc(id).update({ status: 'resolved' });
    }
}
