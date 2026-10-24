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
