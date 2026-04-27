// --- 1. CẤU HÌNH BẢO MẬT SUPER ADMIN ---
const SUPER_ADMIN_EMAILS = [
    "nguyentinh52009@gmail.com", 
    "tomizy09icloud@gmail.com"
];

firebase.auth().onAuthStateChanged((user) => {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard-screen');
    
    if (user) {
        if (SUPER_ADMIN_EMAILS.includes(user.email)) {
            loginScreen.style.display = 'none';
            dashboard.style.display = 'flex';
            document.getElementById('sa-email').innerText = user.email;
            loadLinkedSchools(); // Tải danh sách các trường
        } else {
            alert("Tài khoản không có quyền truy cập hệ thống trung tâm!");
            firebase.auth().signOut();
        }
    } else {
        loginScreen.style.display = 'flex';
        dashboard.style.display = 'none';
    }
});

function loginSuperAdmin() {
    const btn = document.getElementById('btn-login');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang kết nối...';
    btn.disabled = true;

    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        })
        .catch(err => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            if (err.code !== 'auth/popup-closed-by-user') {
                alert("❌ Lỗi Firebase: " + err.message);
            }
        });
}

function switchSaTab(tabId, btn) {
    document.querySelectorAll('.tab-pane').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    btn.classList.add('active');
}

// --- 2. XỬ LÝ TAB 5: LIÊN KẾT CƠ SỞ DỮ LIỆU CÁC TRƯỜNG ---

// Hàm bóc tách JSON từ đoạn code JS người dùng dán vào
async function parseAndSaveSchool() {
    const schoolName = document.getElementById('school-name').value.trim();
    const rawCode = document.getElementById('school-config-raw').value.trim();

    if (!schoolName || !rawCode) return alert("Vui lòng nhập Tên trường và dán Code cấu hình!");

    try {
        // Dùng Regex để moi cái object {} bên trong đoạn text "const firebaseConfig = { ... }"
        const regex = /\{[\s\S]*\}/; 
        const match = rawCode.match(regex);
        
        if (!match) throw new Error("Không tìm thấy cấu hình hợp lệ. Hãy copy y nguyên khối ngoặc nhọn {}");
        
        // Chuyển chuỗi JS Object thành định dạng JSON chuẩn (Bọc ngoặc kép cho key)
        let configStr = match[0]
            .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2": ') // Thêm ngoặc kép cho các key
            .replace(/'/g, '"'); // Đổi nháy đơn thành nháy kép

        // Loại bỏ dấu phẩy thừa ở cuối (nếu có)
        configStr = configStr.replace(/,\s*}/g, '}');

        const schoolConfig = JSON.parse(configStr);

        // Lưu thông tin kết nối này vào Database của Super Admin
        await db.collection('linked_schools').add({
            name: schoolName,
            config: schoolConfig,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("✅ Liên kết thành công!");
        document.getElementById('school-name').value = '';
        document.getElementById('school-config-raw').value = '';

    } catch (error) {
        alert("❌ Lỗi phân tích Code: \nVui lòng copy chính xác đoạn 'const firebaseConfig = { ... }' từ Firebase.\nChi tiết lỗi: " + error.message);
    }
}

// Hiển thị danh sách các trường đã liên kết
function loadLinkedSchools() {
    db.collection('linked_schools').orderBy('createdAt', 'desc').onSnapshot(snap => {
        const listDiv = document.getElementById('school-list');
        listDiv.innerHTML = '';
        
        snap.forEach(doc => {
            const data = doc.data();
            listDiv.innerHTML += `
                <div class="form-card" style="margin-bottom: 0; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #10b981;">
                    <div>
                        <h3 style="margin: 0 0 5px;">${data.name}</h3>
                        <p style="margin: 0; font-size: 0.8rem; color: #64748b;">Project ID: <strong>${data.config.projectId}</strong></p>
                    </div>
                    <button onclick="deleteSchool('${doc.id}')" class="btn btn-danger" style="padding: 8px 12px;"><i class="fas fa-trash"></i> Hủy LK</button>
                </div>
            `;
        });
    });
}

async function deleteSchool(id) {
    if(confirm("Hủy liên kết với trường này? Hệ thống của trường sẽ không bị ảnh hưởng, chỉ xóa liên kết ở phía Provider.")) {
        await db.collection('linked_schools').doc(id).delete();
    }
}