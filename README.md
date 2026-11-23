# CuteTeachy - Backend Service (CuteTeachy-BE)

Backend API và dịch vụ lưu trữ dữ liệu cho ứng dụng **CuteTeachy** (Serene Educator) - Ứng dụng PWA quản lý thời gian, thời khóa biểu, công việc, ghi chú và trợ lý AI dành cho giáo viên.

---

## 📁 Tài liệu Nghiệp vụ & Kiến trúc (NotebookLM)

Toàn bộ tài liệu nghiệp vụ, từ điển thuật ngữ (Glossary), quyết định kiến trúc (ADR), thiết kế schema/API và hướng dẫn cấu hình dịch vụ ngoài đã được chuẩn hóa và lưu tập trung trên Google NotebookLM:

- **Notebook**: `CuteTeachy` (`ID: e2d64277-b89c-41ad-b2d9-4bb5e4ee2570`)
- **Danh mục nguồn (`[01]`–`[07]`)**:
  - `[01]` Tổng quan Dự án, Glossary & Quyết định Kiến trúc (ADR 0001-0007)
  - `[02]` Nghiệp vụ Auth, Onboarding, Hồ sơ, Avatar & Theme Giới tính (SPEC-001 & SPEC-002)
  - `[03]` Nghiệp vụ Tasks, Notes, Tags, Inspiration, Settings & Lưu trữ Offline PWA (SPEC-003)
  - `[04]` Nghiệp vụ Thời khóa biểu, Buổi lịch & 3 Phân loại Lịch (SPEC-004 & SPEC-007)
  - `[05]` Nghiệp vụ Thông báo 2 tầng, Web Push & Trợ lý AI Gemini (SPEC-005, SPEC-006 & SPEC-007)
  - `[06]` Kiến trúc Mã nguồn Chi tiết, Database Schema (Prisma) & Danh mục REST API
  - `[07]` Cấu hình Dịch vụ Ngoài, Quy chuẩn DI/Patterns & Hướng dẫn Kiểm thử

---

## 🎯 Tổng quan Yêu cầu Nghiệp vụ (Core Features)

1. **Auth, Onboarding, Hồ sơ & Avatar**: Đăng ký/đăng nhập mật khẩu (`argon2id`), Google OAuth + Account Linking, JWT Access Token (15m) + Refresh Token rotation, xác minh email / đặt lại mật khẩu OTP, Onboarding bắt buộc, upload Avatar lên S3/MinIO/R2.
2. **Thời khóa biểu & Buổi lịch (`TimetableSlot` & `ClassSession`)**: 3 phân loại lịch (`school_teaching`, `extra_teaching`, `self_study`), kiểm tra trùng giờ, tách slot giữ lịch sử quá khứ, sinh buổi động, ghi đè chủ đề/chuẩn bị/hủy tiết và buổi lẻ dạy bù.
3. **Tasks, Notes, Tags, Inspiration & Delta Sync**: Quản lý công việc, ghi chú + checklist tự tính `completed`, tìm kiếm tiếng Việt không dấu, nhãn màu pastel, câu trích dẫn song ngữ theo múi giờ và đồng bộ chênh lệch (`?updatedSince`).
4. **Thông báo 2 tầng & Nhắc việc Đa thiết bị**: In-App Notification Center + Web Push chuẩn VAPID (hỗ trợ nhắc Task, Class Session, Note và quét bù qua nửa đêm).
5. **Trợ lý AI Đa phương thức (Google Gemini)**: Bóc tách thời khóa biểu từ ảnh chụp/văn bản thành bản nháp (`AI Schedule Draft`) kèm xử lý trùng lịch (`replace_conflicts` / `skip_conflicts`), hỏi đáp lịch trình và tự động xóa ảnh chat sau 45 ngày.

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
