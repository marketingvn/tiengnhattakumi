# Gói triển khai một lần – Nhật Ngữ Takumi

## Tải toàn bộ mã nguồn

Tải ZIP của nhánh `main` tại:

https://github.com/marketingvn/tiengnhattakumi/archive/refs/heads/main.zip

Sau khi giải nén, dùng đúng các tệp ở thư mục gốc theo hướng dẫn dưới đây. Không triển khai `worker-ket-qua-test.js`; đây là tệp thử nghiệm cũ.

## 1. Cập nhật API Worker

Tệp cần triển khai: `worker.js`

1. Mở Cloudflare Workers, chọn Worker `lophoctiengnhat-api`.
2. Giữ nguyên cấu hình D1 binding có tên chính xác là `DB`, trỏ đến database `lophoctiengnhat-db`.
3. Giữ nguyên secret `BOOTSTRAP_SECRET` đang cấu hình. Không đưa secret vào mã nguồn hoặc gửi cho người khác.
4. Thay toàn bộ mã Worker hiện tại bằng nội dung tệp `worker.js`, sau đó Deploy.
5. Kiểm tra địa chỉ API vẫn là:
   `https://lophoctiengnhat-api.haivouel.workers.dev`

Không tạo Worker API mới và không đổi tên binding `DB`.

## 2. Cập nhật trang web và trang quản trị

Triển khai đồng thời 3 tệp sau lên Worker phục vụ website `lophoctiengnhat`:

- `index.html` – trang công khai.
- `admin.html` – trang quản trị.
- `_headers` – chính sách bảo mật và cấu hình không lập chỉ mục trang quản trị.

Giữ nguyên cấu trúc đường dẫn ở thư mục gốc. Không tải `worker.js`, `schema.sql` hoặc `migration_sync.sql` vào thư mục tài sản tĩnh.

## 3. Cơ sở dữ liệu D1

Database hiện tại: `lophoctiengnhat-db`

- Bảng `app_state` đã được tạo và đồng bộ dữ liệu đã được xác nhận hoạt động.
- Vì vậy, với lần cập nhật này **không chạy lại `schema.sql` và không cần chạy lại `migration_sync.sql`**.
- `schema.sql` chỉ dùng khi dựng một database mới hoàn toàn.
- `migration_sync.sql` dùng để bổ sung đồng bộ cho database cũ chưa có bảng `app_state`.

Không xóa database hoặc các bảng hiện có. Không chạy lệnh DROP TABLE.

## 4. Kiểm tra sau triển khai

Thực hiện theo thứ tự:

1. Mở `https://lophoctiengnhat-api.haivouel.workers.dev/api/health`; kết quả mong đợi có `ok: true` và `database: "connected"`.
2. Mở website, vào trang quản trị và đăng nhập bằng tài khoản hiện có.
3. Kiểm tra dòng trạng thái cuối trang báo đã đồng bộ dữ liệu lên Cloudflare.
4. Thêm thử một học viên hoặc lịch học; mở trang quản trị trên thiết bị/trình duyệt khác để xác nhận dữ liệu xuất hiện.
5. Đăng nhập bằng tài khoản giáo viên: không được thấy mục quản lý giáo viên.
6. Đăng nhập bằng Admin: được phép tạo, khóa và mở khóa tài khoản giáo viên.
7. Gửi thử một đăng ký học từ trang công khai và kiểm tra mục Đăng ký học trong quản trị.

## 5. Phân quyền và cách lưu dữ liệu

- Admin và giáo viên dùng chung dữ liệu lớp học, lịch học, học viên, nhật ký, từ vựng và khách đăng ký.
- Giáo viên được thao tác dữ liệu học tập dùng chung.
- Chỉ Admin được xem/quản lý danh sách tài khoản giáo viên.
- Khóa tài khoản giáo viên sẽ xóa các phiên đăng nhập hiện có của tài khoản đó.
- Dữ liệu được lưu trên D1; trình duyệt chỉ giữ bản cache để giao diện hoạt động nhanh.
- Khi hai thiết bị cùng sửa một nhóm dữ liệu, hệ thống dùng revision để ngăn ghi đè âm thầm. Nếu có xung đột, dùng nút “Tải dữ liệu mới nhất” sau khi cân nhắc các chỉnh sửa chưa đồng bộ.

## Lưu ý

Bản mã đã được kiểm tra cú pháp JavaScript. Việc kiểm tra cú pháp không thay thế được kiểm thử thực tế sau Deploy trên Cloudflare. Không có thao tác triển khai production nào được thực hiện tự động trong gói này.
