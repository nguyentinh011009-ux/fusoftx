// --- CẤU HÌNH BẢO MẬT SUPER ADMIN ---
const SUPER_ADMIN_EMAILS = ["nguyentinh52009@gmail.com", "tomizy09icloud@gmail.com"];

// Khai báo biến Xuyên Cơ Sở Dữ Liệu
let clientApp = null;
let clientDb = null;
let currentSchoolName = "";
let allSchoolsConfig = []; // Lưu trữ để phân tích đa luồng

firebase.auth().onAuthStateChanged((user) => {
    if (user && SUPER_ADMIN_EMAILS.includes(user.email)) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard-screen').style.display = 'flex';
        document.getElementById('sa-email').innerText = user.email;
        document.getElementById('sa-profile-email').value = user.email;
        loadLinkedSchools(); 
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

// --- QUẢN LÝ HỢP ĐỒNG ---
async function saveContract() {
    const payload = {
        name: document.getElementById('contract-name').value.trim(),
        repName: document.getElementById('contract-rep').value.trim(),
        phone: document.getElementById('contract-phone').value.trim(),
        package: document.getElementById('contract-package').value,
        startDate: document.getElementById('contract-start').value,
        endDate: document.getElementById('contract-end').value,
        config: {
            apiKey: document.getElementById('cfg-apiKey').value.trim(),
            projectId: document.getElementById('cfg-projectId').value.trim(),
            appId: document.getElementById('cfg-appId').value.trim(),
            authDomain: document.getElementById('cfg-authDomain').value.trim(),
            storageBucket: document.getElementById('cfg-storageBucket').value.trim(),
            messagingSenderId: document.getElementById('cfg-messagingSenderId').value.trim()
        }
    };

    if (!payload.name || !payload.config.apiKey || !payload.config.projectId || !payload.config.appId || !payload.startDate) 
        return alert("Nhập đủ Tên, Ngày và các ô cấu hình có dấu *");

    try {
        await db.collection('linked_schools').add({...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
        alert("✅ Đã tạo Hợp đồng!");
        ['contract-name','contract-rep','contract-phone','contract-start','contract-end','cfg-apiKey','cfg-projectId','cfg-appId','cfg-authDomain','cfg-storageBucket','cfg-messagingSenderId'].forEach(id => document.getElementById(id).value = '');
    } catch (e) { alert("Lỗi: " + e.message); }
}

function loadLinkedSchools() {
    db.collection('linked_schools').orderBy('createdAt', 'desc').onSnapshot(snap => {
        document.getElementById('stat-schools').innerText = snap.size;
        const listDiv = document.getElementById('school-list'); listDiv.innerHTML = '';
        allSchoolsConfig = [];

        snap.forEach(doc => {
            const d = doc.data();
            allSchoolsConfig.push(d.config); // Đẩy vào mảng để Dashboard phân tích
            const configStr = encodeURIComponent(JSON.stringify(d.config));
            
            const today = new Date(); const endDate = new Date(d.endDate);
            const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            let stHtml = daysLeft < 0 ? `<span style="color:#ef4444;">Hết hạn</span>` : (daysLeft <= 30 ? `<span style="color:#f59e0b;">Sắp hết hạn</span>` : `<span style="color:#10b981;">Đang HĐ</span>`);

            listDiv.innerHTML += `
                <div class="form-card" style="margin-bottom:0; border-left:4px solid var(--sp-primary);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <div><h3 style="margin:0;">${d.name}</h3><div style="font-size:0.85rem; color:#64748b;">Đại diện: ${d.repName} | SĐT: ${d.phone}</div></div>
                        <div style="text-align:right;"><span class="status-badge" style="background:#e0e7ff; color:#4338ca;">Gói ${d.package}</span><div style="font-size:0.85rem; margin-top:5px;">${stHtml}</div></div>
                    </div>
                    <div style="display:flex; gap:10px; justify-content:flex-end;">
                        <button onclick="connectToSchool('${d.name}', '${configString}')" class="btn btn-success"><i class="fas fa-plug"></i> Truy cập CSDL</button>
                        <button onclick="db.collection('linked_schools').doc('${doc.id}').delete()" class="btn btn-danger"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        });
    });
}

// --- KẾT NỐI XUYÊN CSDL ---
async function connectToSchool(schoolName, configString) {
    try {
        const conf = JSON.parse(decodeURIComponent(configString));
        if (clientApp) { await clientApp.delete(); clientApp = null; clientDb = null; }
        clientApp = firebase.initializeApp(conf, "ClientSchool"); clientDb = clientApp.firestore();
        currentSchoolName = schoolName;

        const stBar = document.getElementById('connection-status');
        stBar.style.background = '#dcfce7'; stBar.style.color = '#15803d';
        stBar.innerHTML = `<span><i class="fas fa-link"></i> ĐANG TRUY CẬP DỮ LIỆU: <strong>${schoolName}</strong></span> <button onclick="location.reload()" class="btn btn-danger" style="padding:5px 10px;">Ngắt</button>`;
        document.getElementById('lbl-tab-noti').innerHTML = `<i class="fas fa-bullhorn"></i> Gửi Thông Báo - <span style="color:var(--sp-primary);">${schoolName}</span>`;
        document.getElementById('lbl-tab-support').innerHTML = `<i class="fas fa-headset"></i> Hỗ trợ Khách hàng - <span style="color:var(--sp-primary);">${schoolName}</span>`;
        
        document.querySelectorAll('.nav-btn')[2].click(); // Chuyển sang Tab Thông báo
    } catch (e) { alert("Kết nối thất bại: " + e.message); }
}

// --- DASHBOARD TỔNG HỢP ĐA LUỒNG ---
async function loadGlobalDashboard() {
    const sDateStr = document.getElementById('dash-start').value;
    const eDateStr = document.getElementById('dash-end').value;
    if(!sDateStr || !eDateStr) return alert("Chọn Ngày bắt đầu và Kết thúc!");
    
    const sDate = new Date(sDateStr + "T00:00:00");
    const eDate = new Date(eDateStr + "T23:59:59");
    
    const btn = document.querySelector('button[onclick="loadGlobalDashboard()"]');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang quyét toàn bộ CSDL...'; btn.disabled = true;

    let totalStudents = 0;
    let totalVisits = 0;
    let diseaseMap = {};

    try {
        for (let i = 0; i < allSchoolsConfig.length; i++) {
            // Khởi tạo app tạm thời để chui vào DB của trường đó
            const tempApp = firebase.initializeApp(allSchoolsConfig[i], "TempApp_" + i);
            const tempDb = tempApp.firestore();

            // Đếm học sinh
            const stSnap = await tempDb.collection('yt_students').get();
            totalStudents += stSnap.size;

            // Đếm và lọc lượt khám theo ngày
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

            // Xóa app tạm để giải phóng RAM
            await tempApp.delete();
        }

        // Cập nhật lên UI
        document.getElementById('stat-total-students').innerText = totalStudents.toLocaleString();
        document.getElementById('stat-total-visits').innerText = totalVisits.toLocaleString();

        const sortedDiseases = Object.keys(diseaseMap).map(k => ({name: k, count: diseaseMap[k]})).sort((a,b)=>b.count - a.count).slice(0, 10);
        const tbody = document.getElementById('stat-diseases-list');
        tbody.innerHTML = '';
        if(sortedDiseases.length === 0) tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Không có dữ liệu</td></tr>';
        else sortedDiseases.forEach(d => { tbody.innerHTML += `<tr><td style="font-weight:500;">${d.name}</td><td style="text-align:right; font-weight:bold; color:#ef4444;">${d.count}</td></tr>`; });

    } catch (e) {
        alert("Lỗi quét dữ liệu: " + e.message);
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
        if (snap.empty) return div.innerHTML = '<p>Chưa gửi thông báo nào cho trường này.</p>';
        snap.forEach(doc => {
            const d = doc.data(); const time = d.timestamp ? new Date(d.timestamp.seconds*1000).toLocaleString('vi-VN') : '';
            div.innerHTML += `<div class="form-card" style="padding:15px; margin-bottom:0; border-left:3px solid var(--sp-warning);">
                <div style="display:flex; justify-content:space-between;"><strong>${d.title}</strong><span class="status-badge" style="background:#fffbeb; color:#d97706;">${d.targetType}</span></div>
                <div style="font-size:0.8rem; color:#64748b; margin-top:5px;">${time}</div><div style="margin-top:10px;">${d.content}</div>
            </div>`;
        });
    });
}

// --- LIVE CHAT HỖ TRỢ TICKETS ---
function loadClientTickets() {
    if (!clientDb) return;
    const filter = document.getElementById('ticket-filter').value;
    let query = clientDb.collection('yt_tickets').orderBy('timestamp', 'desc');
    if (filter !== 'all') query = clientDb.collection('yt_tickets').where('status', '==', filter).orderBy('timestamp', 'desc');

    query.onSnapshot(snap => {
        const div = document.getElementById('sp-ticket-list'); div.innerHTML = '';
        if (snap.empty) return div.innerHTML = '<p>Không có dữ liệu yêu cầu.</p>';
        snap.forEach(doc => {
            const t = doc.data(); 
            let chatHtml = `<div style="background:#f8fafc; padding:15px; border-radius:10px; margin-bottom:15px; max-height:250px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
                <div style="align-self:flex-start; background:#e2e8f0; color:#1e293b; padding:10px 15px; border-radius:15px 15px 15px 0; max-width:85%; font-size:0.9rem;"><strong>${t.name} (HS):</strong> ${t.content}</div>`;
            if (t.messages) {
                t.messages.forEach(m => {
                    const isMe = m.sender === 'FUSoftX';
                    chatHtml += `<div style="align-self:${isMe?'flex-end':'flex-start'}; background:${isMe?'#4f46e5':'#e2e8f0'}; color:${isMe?'white':'#1e293b'}; padding:10px 15px; border-radius:${isMe?'15px 15px 0 15px':'15px 15px 15px 0'}; max-width:85%; font-size:0.9rem;"><strong>${m.sender}:</strong> ${m.text}</div>`;
                });
            }
            chatHtml += `</div>`;

            div.innerHTML += `<div class="form-card" style="margin-bottom:0; border-top: 4px solid ${t.status==='resolved'?'#94a3b8':'#10b981'};">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                    <div><strong style="color:var(--sp-primary); font-size:1.1rem;">${t.ticketId}</strong> - ${t.name} (${t.class})</div>
                    <span class="status-badge" style="background:#f1f5f9; color:#475569;">Trạng thái: ${t.status}</span>
                </div>
                ${chatHtml}
                ${t.status !== 'resolved' ? `<div style="display:flex; gap:10px;">
                    <input type="text" id="chat-reply-${doc.id}" placeholder="Nhập tin nhắn trả lời..." style="flex:1; padding:10px; border-radius:8px; border:1px solid #cbd5e1; outline:none;">
                    <button onclick="replyClientTicket('${doc.id}')" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Gửi</button>
                    <button onclick="closeClientTicket('${doc.id}')" class="btn btn-danger"><i class="fas fa-lock"></i> Đóng</button>
                </div>` : `<div style="text-align:center; color:#94a3b8; font-size:0.85rem;">Phiên chat đã kết thúc</div>`}
            </div>`;
        });
    });
}

async function replyClientTicket(id) {
    if (!clientDb) return; const txt = document.getElementById(`chat-reply-${id}`).value.trim(); if (!txt) return;
    try { await clientDb.collection('yt_tickets').doc(id).update({ messages: firebase.firestore.FieldValue.arrayUnion({ sender: "FUSoftX", text: txt, time: Date.now() }), status: 'processing' }); } 
    catch(e) { alert("Lỗi: " + e.message); }
}
async function closeClientTicket(id) {
    if (!clientDb) return; if(confirm("Đóng phiên chat này?")) await clientDb.collection('yt_tickets').doc(id).update({ status: 'resolved' });
}
