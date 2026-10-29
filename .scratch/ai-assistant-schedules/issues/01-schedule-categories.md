# 01: S7-BE-01 — Phân loại 3 Loại lịch (`ScheduleCategory`) trên `TimetableSlot`, `ClassSession` & `Reminder`

**What to build:** Giáo viên phân loại được mỗi `TimetableSlot` và `ClassSession` thành một trong 3 loại lịch: `school_teaching` (Lịch trên lớp), `extra_teaching` (Lịch dạy thêm), hoặc `self_study` (Lịch học thêm của giáo viên); các buổi sinh từ slot tự kế thừa `category` và thông báo nhắc việc hiển thị đúng tiền tố loại lịch.

**Blocked by:** S6-BE-01 (Note `remindTime` & Sửa lỗi biên nửa đêm)

**Status:** done

- [x] Thêm enum `ScheduleCategory` (`school_teaching`, `extra_teaching`, `self_study`) vào Prisma schema, entity `TimetableSlot` và `ClassSession` (mặc định `'school_teaching'`).
- [x] Kế thừa `category` khi sinh `ClassSession` từ `TimetableSlot` và hỗ trợ `category` trên buổi lẻ (`ad-hoc`) cũng như bản ghi đè.
- [x] Cập nhật `formatClassSessionReminderNotification` để hiển thị tiền tố đúng theo `category` và `locale` (`Tiết dạy` / `Ca dạy thêm` / `Lịch học`).
- [x] Unit test và E2E test cho cả 3 loại lịch; `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` xanh.
