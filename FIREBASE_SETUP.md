# 🚀 Hướng Dẫn Kết Nối & Cấu Hình Firebase Firestore Cho Trợ Lý Pháp Lý Lao Động

Tài liệu này hướng dẫn chi tiết cách kết nối cơ sở dữ liệu **Firebase Firestore** để đồng bộ Mật khẩu Admin và Toàn bộ Tài liệu người dùng trên mọi thiết bị (máy tính, điện thoại, máy tính bảng).

---

## Bước 1: Tạo Project và Firestore Database trên Firebase Console

1. Truy cập vào **[Firebase Console](https://console.firebase.google.com/)** và đăng nhập bằng tài khoản Google.
2. Bấm **"Add project"** (Thêm dự án):
   - Đặt tên cho dự án (ví dụ: `tro-ly-phap-ly-lao-dong`).
   - Tắt hoặc bật Google Analytics (tùy ý) ➔ Bấm **Create project**.
3. Tại thanh menu bên trái, chọn **Build ➔ Firestore Database**:
   - Bấm **Create database**.
   - Chọn vị trí Cloud (ví dụ: `asia-southeast1` - Singapore hoặc bất kỳ khu vực nào gần bạn).
   - Chọn chế độ bảo mật: Chọn **Start in test mode** (Bắt đầu ở chế độ thử nghiệm).
   - Bấm **Enable** (Bật).

---

## Bước 2: Lấy 6 Biến Môi Trường Cấu Hình Web (`VITE_FIREBASE_*`)

1. Tại trang chính của Project trong Firebase Console, bấm vào biểu tượng bánh răng **Project settings** (Cài đặt dự án) ở góc trên bên trái.
2. Cuộn xuống mục **"Your apps"**, chọn biểu tượng Web **`</>`** để đăng ký ứng dụng Web:
   - Đặt tên cho App (ví dụ: `web-client`).
   - Bấm **Register app**.
3. Firebase sẽ hiển thị đoạn mã cấu hình `firebaseConfig`. Hãy sao chép các giá trị tương ứng:

```env
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789012"
VITE_FIREBASE_APP_ID="1:123456789012:web:abcdef..."
```

---

## Bước 3: Thiết Lập Quy Tắc Bảo Mật (Security Rules) Cho Firestore

Để cho phép ứng dụng đọc và ghi tài liệu, mật khẩu đồng bộ giữa các máy:

1. Trong Firebase Console, vào **Firestore Database ➔ tab "Rules"** (Quy tắc).
2. Dán đoạn quy tắc sau:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cho phép đọc và ghi dữ liệu tài liệu & cài đặt toàn cầu
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Bấm **Publish** (Xuất bản) để lưu quy tắc.

---

## Bước 4: Áp Dụng Cấu Hình Vào Ứng Dụng

Bạn có thể áp dụng theo một trong 2 cách:

### Cách A: Nhập trực tiếp qua giao diện Web (Nhanh nhất, không cần sửa code)
1. Mở trang web ứng dụng.
2. Bấm vào biểu tượng **Cài đặt (⚙️)** ở góc trên bên phải ➔ Nhập mật khẩu Admin (mặc định: `123456`).
3. Kéo xuống mục **"Cấu hình Firebase Firestore"**.
4. Điền **Firebase API Key** và **Project ID** của bạn ➔ Bấm **Lưu cấu hình**.
5. Hệ thống sẽ tự động kết nối và đồng bộ toàn bộ tài liệu & mật khẩu Admin.

### Cách B: Cấu hình qua biến môi trường (.env)
1. Tạo hoặc sửa tệp `.env.local` hoặc `.env` ở thư mục gốc của dự án:
   ```env
   VITE_FIREBASE_API_KEY="your_api_key_here"
   VITE_FIREBASE_AUTH_DOMAIN="your_project_id.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="your_project_id"
   VITE_FIREBASE_STORAGE_BUCKET="your_project_id.appspot.com"
   VITE_FIREBASE_MESSAGING_SENDER_ID="your_messaging_sender_id"
   VITE_FIREBASE_APP_ID="your_app_id"
   ```
2. Khởi động lại ứng dụng: `npm run dev`.

---

## Cấu Trúc Dữ Liệu Tự Động Được Tạo Trên Firestore

Khi kết nối thành công, ứng dụng sẽ tự động khởi tạo các collection sau trên Firestore của bạn:
1. **`settings`**:
   - Document `global_config`: `{ adminPassword: "...", updated_at: "..." }`
   - Dùng để đồng bộ Mật khẩu Admin toàn cầu trên mọi thiết bị.
2. **`documents`**:
   - Mỗi file do Admin tải lên là 1 document: `{ id, name, fileType, size, uploadedAt, textContent, category, summary }`
   - Tự động thay thế toàn bộ dữ liệu mẫu ban đầu bằng tài liệu thực tế của đơn vị.
