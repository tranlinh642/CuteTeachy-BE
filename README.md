# CuteTeachy - Backend Service (CuteTeachy-BE)

Backend API và dịch vụ lưu trữ dữ liệu cho ứng dụng **CuteTeachy** (Serene Educator) - Ứng dụng quản lý thời gian, lịch giảng dạy và ghi chú dành cho nữ giáo viên.

---

## 📁 Cấu trúc Thư mục Tài liệu Docs

Tài liệu nghiệp vụ (BA) và đặc tả kỹ thuật được lưu trữ trong thư mục [`docs/`](./docs):

- [`docs/ba/prd-cuteteachy.md`](./docs/ba/prd-cuteteachy.md): Bản đặc tả yêu cầu sản phẩm (PRD), tầm nhìn và các tính năng cốt lõi.
- [`docs/ba/deploy-ket-noi-database.md`](./docs/ba/deploy-ket-noi-database.md): Hướng dẫn thiết lập database (MySQL / MongoDB) và cấu hình kết nối.
- [`docs/ba/bao-cao-fe-2026-07-20.md`](./docs/ba/bao-cao-fe-2026-07-20.md): Báo cáo tiến độ và cấu trúc màn hình phía Frontend.

---

## 🎯 Tổng quan Yêu cầu Nghiệp vụ (Core BA Requirements)

Dựa trên PRD CuteTeachy, Backend cần phục vụ các domain dữ liệu chính:

### 1. Quản lý Nhiệm vụ & Lịch giảng dạy (Tasks & Schedule)
- **Daily Focus / Tasks**: Danh sách công việc theo ngày, trạng thái hoàn thành, mức độ ưu tiên, đếm số tiết học.
- **Weekly Schedule**: Phân bổ khối lượng giảng dạy theo tuần, sự kiện cá nhân.
- **Monthly Calendar**: Xem và lên kế hoạch dài hạn, chi tiết theo từng ngày.
- **Quick Task Entry**: API tạo nhanh nhiệm vụ từ Floating Action Button (FAB).

### 2. Ghi chú & Sổ tay lớp học (Notes & Classroom Observations)
- **Notes**: Tạo và quản lý ghi chú theo chủ đề/lớp học.
- **To-Dos**: Danh sách checklist công việc đính kèm hoặc độc lập.

### 3. Hệ thống Nhãn & Phân loại (Tagging System)
- Tạo nhãn tuỳ biến theo lớp (Class), môn học (Subject), hoặc độ ưu tiên (Priority).
- Gắn nhãn cho Tasks và Notes.

### 4. Người dùng & Cài đặt (User & Settings)
- Hồ sơ giáo viên (Profile), cấu hình ca dạy và nhắc nhở.

---

## 🚀 Chạy hạ tầng dev (Local Development Infrastructure)

Hạ tầng phát triển cục bộ được quản lý bằng Docker Compose, bao gồm:
- **PostgreSQL 16**: Cổng `5432` (database: `cuteteachy`, user/password: `postgres`/`postgres`).
- **MinIO (Object Storage chuẩn S3)**: Cổng API `9000`, Web Console `9001` (user/password: `minioadmin`/`minioadmin`). Bucket `avatars` được tự động tạo và phân quyền đọc công khai (anonymous download) qua service `minio-init`.
- **Mailpit (SMTP mock & Web UI)**: Cổng SMTP `1025`, Web UI `8025` (truy cập `http://localhost:8025` để kiểm tra email gửi đi trong quá trình dev/test).

### Khởi chạy hạ tầng

1. Sao chép cấu hình môi trường từ mẫu:
   ```bash
   cp .env.example .env
   ```

2. Khởi động toàn bộ dịch vụ hạ tầng nền:
   ```bash
   docker compose up -d
   ```

3. Kiểm tra trạng thái:
   ```bash
   docker compose ps
   ```
   Các container `postgres`, `minio`, `mailpit` sẽ chuyển sang trạng thái `healthy`, service `minio-init` khởi tạo bucket và hoàn tất với mã 0 (`exited (0)`).

### Dừng hạ tầng

- Dừng dịch vụ:
  ```bash
  docker compose down
  ```
- Dừng và làm sạch dữ liệu volumes (reset DB và MinIO data):
  ```bash
  docker compose down -v
  ```
