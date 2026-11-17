# RELEASE PACKAGE – NHẬT NGỮ TAKUMI

Đây là bộ triển khai đã tách sẵn, không cần tự tìm file trong mã nguồn.

## Cấu trúc

- `static/`: tải cả 3 tệp lên Worker website `lophoctiengnhat`.
- `api/worker.js`: thay mã trong Worker `lophoctiengnhat-api`.
- `database/schema.sql`: chỉ dùng khi tạo database D1 mới.
- `database/migration_sync.sql`: chỉ dùng khi database cũ chưa có bảng `app_state`.

## Cập nhật hệ thống hiện tại

Database hiện tại đã có bảng `app_state`, do đó không chạy lại SQL. Cập nhật API Worker trước, sau đó tải toàn bộ nội dung thư mục `static/` lên Worker website. Giữ nguyên D1 binding tên `DB` và secret `BOOTSTRAP_SECRET`.

Hướng dẫn đầy đủ: xem `DEPLOY_ONE_TIME.md` ở thư mục gốc repository.

## Không triển khai

Không tải `schema.sql`, `migration_sync.sql` hoặc các tệp kiểm thử vào thư mục tài sản tĩnh.
