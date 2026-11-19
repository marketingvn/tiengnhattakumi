# Nhật Ngữ Umitomo — Hướng dẫn cập nhật và triển khai

## 1. Các thành phần

| Thành phần | File | Nơi triển khai |
|---|---|---|
| Website công khai + trang quản trị | `index.html`, `admin.html`, `_headers` và tài nguyên tĩnh | Cloudflare Worker `lophoctiengnhat` |
| API + đồng bộ | `worker.js` | Cloudflare Worker `lophoctiengnhat-api` |
| Cấu trúc dữ liệu | `schema.sql`, `migration_sync.sql` | Cloudflare D1 `lophoctiengnhat-db` |

## 2. Sao lưu trước khi cập nhật

1. Tải bản sao lưu mã nguồn hiện tại.
2. Xuất dữ liệu D1 hiện tại trước khi thay đổi cấu trúc bảng.
3. Giữ nguyên database `lophoctiengnhat-db`, binding `DB` và các Worker Secrets.
4. Không xóa database, không tạo database mới và không chạy lại toàn bộ `schema.sql` trên database đang có dữ liệu.

## 3. Cập nhật D1 — thực hiện trước khi deploy code

Database đang sử dụng đã có bảng `app_state`, nhưng ràng buộc cũ chưa cho phép hai khóa dữ liệu mới `att` (điểm danh) và `lessons` (bài giảng YouTube).

1. Mở D1 database `lophoctiengnhat-db` → Console.
2. Mở file `migration_sync.sql` trong GitHub, sao chép toàn bộ nội dung và chạy một lần.
3. Chỉ tiếp tục nếu câu lệnh chạy thành công. Migration giữ lại các bản ghi hiện có trong `app_state`; không xóa các dữ liệu lớp, học viên, lịch học hoặc tài khoản.
4. Không chạy migration này lần thứ hai. Nếu gặp lỗi, dừng lại và gửi nguyên văn thông báo lỗi để kiểm tra; không tự xóa bảng.

Với database cài mới hoàn toàn, chạy `schema.sql` thay cho migration trên.

\n## 3A. Bổ sung tài khoản học viên (lần cập nhật 19/11/2026)\n\nSau khi đã có bảng app_state và khóa dữ liệu att, chạy thêm migration riêng này đúng một lần:\n\n1. Mở D1 database lophoctiengnhat-db → Console.\n2. Mở file migration_student_accounts.sql trên GitHub, sao chép toàn bộ SQL và chạy.\n3. Migration chỉ tạo hai bảng student_accounts và student_sessions; không xóa hoặc sửa dữ liệu học viên/điểm danh hiện có.\n4. Chỉ deploy worker.js sau khi migration chạy thành công. Không chạy lại schema.sql trên database đang sử dụng.\n
## 4. Cập nhật API Worker

1. Mở Cloudflare Worker `lophoctiengnhat-api`.
2. Thay mã hiện tại bằng toàn bộ nội dung file `worker.js` trên nhánh `main`.
3. Kiểm tra D1 binding tên chính xác là `DB`, trỏ đến `lophoctiengnhat-db`.
4. Giữ nguyên các Worker Secrets hiện có. Không chia sẻ `BOOTSTRAP_SECRET` hoặc mật khẩu quản trị.
5. Deploy Worker API.

## 5. Cập nhật website

1. Mở Cloudflare Worker `lophoctiengnhat`.
2. Cập nhật các tài nguyên tĩnh từ repository, giữ nguyên cấu trúc thư mục.
3. Đảm bảo `index.html`, `admin.html` và `_headers` thuộc cùng một phiên bản.
4. Không tải `worker.js`, `schema.sql` hoặc `migration_sync.sql` vào thư mục tài nguyên tĩnh.

## 6. Kiểm tra sau triển khai

1. Mở `https://lophoctiengnhat-api.haivouel.workers.dev/api/health`; kết quả mong đợi: `ok: true`, `database: "connected"`.
2. Mở website công khai, kiểm tra trang chủ, các mục khóa học, tài liệu, lịch khai giảng, kiểm tra trình độ và bài giảng.
3. Gửi thử một đăng ký học thử; kiểm tra đăng ký xuất hiện trong trang quản trị.
4. Mở `/admin.html`, đăng nhập bằng tài khoản hiện có.
5. Kiểm tra danh sách lớp, học viên, lịch học, điểm danh, nhật ký, đăng ký, kết quả và bài giảng.
6. Thêm một video YouTube thử, chờ trạng thái đồng bộ thành công, sau đó kiểm tra video hiển thị trên trang công khai.
7. Đánh dấu điểm danh thử, đăng xuất/đăng nhập lại và kiểm tra dữ liệu còn nguyên.
8. Nếu có thể, đăng nhập ở trình duyệt thứ hai để xác nhận dữ liệu được đồng bộ giữa các thiết bị.

## 7. Quyền truy cập và lưu ý

- Giáo viên và admin sử dụng dữ liệu học vụ dùng chung sau khi đăng nhập.
- Chỉ admin được tạo, xem danh sách và khóa/mở khóa tài khoản giáo viên.
- Danh sách đăng ký, kết quả kiểm tra và dữ liệu quản trị yêu cầu đăng nhập.
- Phiên đăng nhập có thời hạn 12 giờ.
- Không chạy lại `schema.sql` hoặc `migration_sync.sql` tùy tiện trên database đang có dữ liệu.
- Việc cập nhật GitHub không tự động triển khai Cloudflare. Chỉ xác nhận hoàn tất sau khi đã deploy và kiểm tra thực tế theo mục 6.
