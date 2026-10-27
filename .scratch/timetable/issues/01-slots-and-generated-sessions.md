# S4-BE-01: Tạo Timetable Slot và xem Class Session sinh từ slot

**What to build:** Giáo viên khai báo tiết lặp lại hằng tuần và thấy các Class Session tương ứng trong lịch tuần/tháng mà không phải nhập từng buổi; tiết trùng giờ bị từ chối.

**Blocked by:** S3-BE-01 (nền đồng bộ), S3-BE-02 (`timeZone`)

**Status:** in-progress

**Đọc:** SPEC-004 mục *Timetable Slot*, *Class Session* (sinh khi đọc, id ổn định), *API*; ADR BE 0004; `GLOSSARY.md` (Timetable Slot, Class Session).

**Vùng sở hữu:** feature `timetable` (tạo + liệt kê slot), feature `class-session` (đọc theo khoảng); domain thuần sinh buổi + kiểm trùng lịch; migration Timetable Slot.

- [x] Validation slot: `weekday` 1–7, `startTime < endTime` cùng ngày, `subject` 1–120, `grade?`/`room?` tùy chọn, `tone` hợp lệ, `effectiveTo ≥ effectiveFrom` → sai: `400 validation`.
- [x] `POST /timetable-slots` theo quy tắc tạo idempotent chung; trùng lịch (cùng thứ, giao giờ, giao hiệu lực; chạm mép không tính) → `409 timetable_conflict`.
- [x] `GET /timetable-slots[?updatedSince]` envelope.
- [x] `GET /class-sessions?from&to` (≤ 42 ngày) sinh buổi cho mọi slot hiệu lực, `timetableSlotId` có giá trị, `cancelled = false`, `prepItems = []`.
- [x] Id buổi xác định từ (slot, ngày), giống nhau giữa các lần đọc.
- [x] Logic sinh buổi và kiểm trùng là domain thuần, unit test: ranh giới tuần/tháng, hai đầu khoảng hiệu lực, chạm mép giờ.
- [x] e2e; gate xanh, dán output.
