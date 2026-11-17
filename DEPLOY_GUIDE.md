# Nhật Ngữ Takumi — Hướng dẫn triển khai bản hoàn chỉnh

## 1. Cấu trúc triển khai

Bản này gồm ba phần tách biệt. Không đưa file SQL hoặc Worker API vào thư mục tài nguyên tĩnh của website.

| Thành phần | File | Nơi triển khai |
|---|---|---|
| Website công khai | `index.html` và các tài nguyên công khai đi kèm trong repo | Cloudflare Worker `lophoctiengnhat` |
| Trang quản trị | `admin.html`, `_headers` | Cùng Worker tài nguyên tĩnh `lophoctiengnhat` |
| API + đồng bộ | `worker.js` | Cloudflare Worker `lophoctiengnhat-api` |
| Cấu trúc dữ liệu | `schema.sql`, `migration_sync.sql` | Cloudflare D1 `lophoctiengnhat-db` |

## 2. Trước khi cập nhật

1. Tải bản sao lưu hiện tại của mã nguồn và xuất dữ liệu D1 trước khi thay thế.
2. Giữ nguyên tên D1 database `lophoctiengnhat-db` và binding `DB`.
3. Không xóa hoặc tạo lại database. Dữ liệu học viên, lớp, lịch học, giáo viên và kết quả đang lưu trong D1.

## 3. Cập nhật website tĩnh

1. Mở Worker `lophoctiengnhat` trong Cloudflare.
2. Cập nhật toàn bộ tài nguyên website từ thư mục gốc của repository, giữ nguyên cấu trúc thư mục.
3. Đảm bảo `index.html`, `admin.html` và `_headers` được đưa lên cùng một phiên bản.
4. Không tải `worker.js`, `schema.sql` hoặc `migration_sync.sql` vào thư mục tài nguyên tĩnh.

## 4. Cập nhật API Worker

1. Mở Worker `lophoctiengnhat-api`.
2. Thay nội dung mã Worker bằng toàn bộ file `worker.js`.
3. Kiểm tra D1 binding có tên chính xác là `DB`, trỏ đến `lophoctiengnhat-db`.
4. Giữ nguyên các Worker Secrets hiện có. `BOOTSTRAP_SECRET` chỉ dùng để tạo tài khoản admin đầu tiên; không cần chạy lại bước tạo admin nếu tài khoản đã tồn tại.
5. Deploy Worker API.

## 5. Database

- Database hiện tại đã có bảng `app_state`; không chạy lại `migration_sync.sql` nếu bảng đã tồn tại.
- `schema.sql` là schema đầy đủ dành cho cài đặt database mới. Không chạy đè schema lên database đang có dữ liệu.
- Bản cập nhật Worker tự nhận diện các cột cũ/mới của bảng `registrations`, không yêu cầu xóa bảng hoặc tạo database mới.

## 6. Kiểm tra sau triển khai

Thực hiện theo thứ tự:

1. Mở `https://lophoctiengnhat-api.haivouel.workers.dev/api/health`; kết quả mong đợi có `ok: true` và `database: "connected"`.
2. Mở website công khai, kiểm tra trang chủ và gửi thử một đăng ký học thử.
3. Mở `/admin.html`, đăng nhập bằng tài khoản hiện có.
4. Kiểm tra danh sách giáo viên, học viên, lớp học, lịch học, đăng ký và kết quả kiểm tra.
5. Tạo một thay đổi thử ở trang quản trị, chờ trạng thái báo đã đồng bộ; đăng nhập trên thiết bị/trình duyệt thứ hai để xác nhận dữ liệu xuất hiện.
6. Thử đăng xuất và đăng nhập lại; xác nhận dữ liệu vẫn còn.

## 7. Quyền truy cập

- Giáo viên và admin dùng chung dữ liệu học vụ trên các thiết bị đã đăng nhập.
- Chỉ admin được tạo, xem danh sách và khóa/mở khóa tài khoản giáo viên.
- Danh sách đăng ký, kết quả kiểm tra và dữ liệu quản trị yêu cầu đăng nhập.
- Phiên đăng nhập có thời hạn 12 giờ; tài khoản bị khóa sẽ không thể tiếp tục sử dụng phiên cũ.

## Lưu ý

Kiểm tra cú pháp mã nguồn không thay thế kiểm thử thực tế trên tài khoản Cloudflare và D1. Chỉ xác nhận hoàn tất sau khi đã chạy đủ các bước kiểm tra ở mục 6.
