# 01: S6-BE-01 — Mở rộng Note (`remindTime`), Nhắc nhở Ghi chú & Sửa lỗi biên nửa đêm

**What to build:** Giáo viên tạo hoặc sửa Note có thể đặt giờ nhắc `remindTime` (`HH:mm`). Bộ điều phối nhắc việc (`DispatchRemindersUseCase`) gửi lời nhắc cho Note có `dueDate` + `remindTime` (trước `reminderLeadMinutes`) hoặc Note chỉ có `dueDate` (vào `07:00` sáng theo múi giờ của giáo viên), đồng thời quét cả 3 ngày `[yesterday, today, tomorrow]` để không bao giờ bỏ sót lịch diễn ra ngay sau nửa đêm.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Thêm cột tùy chọn `remindTime` (`HH:mm`) vào bảng `notes`, entity `Note`, DTO và mapper của Note.
- [ ] Mở rộng `ReminderType` thêm `'note'` và định dạng nội dung thông báo cho Note theo `locale` (`vi`/`en`), điều hướng tới `/notes?noteId=<id>`.
- [ ] Tính `remindAt` cho Note chưa hoàn thành và chưa xóa: nếu có `remindTime` thì lùi `reminderLeadMinutes`, nếu chỉ có `dueDate` thì nhắc lúc `07:00` sáng theo `timeZone` của giáo viên.
- [ ] Quét ứng viên `ClassSession`, `Task`, `Note` trên dải 3 ngày `[yesterday, today, tomorrow]` theo `timeZone` của giáo viên để sửa lỗi biên qua nửa đêm (`00:00`).
- [ ] Unit test với `Clock` giả và E2E test đầy đủ; `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` xanh.
