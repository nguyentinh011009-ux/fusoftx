// Cấu hình Firebase của Super Admin (Fusoftx)
const firebaseConfig = {
  apiKey: "AIzaSyCEauMsxzGd2Th1_kEadqR2HrFRhzHP0ls",
  authDomain: "fusoftx.firebaseapp.com",
  projectId: "fusoftx",
  storageBucket: "fusoftx.firebasestorage.app",
  messagingSenderId: "634682320154",
  appId: "1:634682320154:web:859c66a1878028de11b8a3",
  measurementId: "G-X3NE3P2VJG"
};

// Khởi tạo Firebase theo chuẩn v8 (Tuyệt đối không dùng chữ import)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();