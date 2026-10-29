# 02: S7-BE-02 — Trợ lý AI Đa phương thức (`GeminiAiAssistantAdapter`), Bản nháp `AI Schedule Draft` & Tự xóa ảnh sau 45 ngày

**What to build:** Giáo viên gửi ảnh chụp Thời khóa biểu hoặc tin nhắn văn bản cho Trợ lý AI để nhận thẻ Bản nháp lịch (`AI Schedule Draft`) đã quy đổi sẵn Tiết 1..10 sang giờ và đánh dấu mục trùng lịch; bấm xác nhận để thêm lịch vào tài khoản (`replace_conflicts` hoặc `skip_conflicts`); hỏi danh sách việc/lịch dạy/lịch học/ghi chú trong bất kỳ ngày nào; ảnh đính kèm tự động xóa khỏi S3/DB sau 45 ngày.

**Blocked by:** 01 (S7-BE-01 — Phân loại 3 Loại lịch `ScheduleCategory`)

**Status:** ready-for-agent

- [ ] Tạo bảng `ai_chat_messages` và module `ai-assistant` 4 layer với port `AiAssistantPort` và adapter `GeminiAiAssistantAdapter` (dùng `GEMINI_API_KEY`, `GEMINI_MODEL`, không thêm fallback giả lập làm nặng hệ thống).
- [ ] `POST /ai-assistant/messages` hỗ trợ cả văn bản và ảnh đính kèm (`JPEG/PNG/WebP` ≤ 5MB), lưu ảnh qua `ObjectStorage` với `imageExpiresAt = now + 45 ngày`, đính kèm ngữ cảnh 4 miền (`TimetableSlot`, `ClassSession`, `Task`, `Note`) + bảng quy đổi Tiết 1..10, và gắn cảnh báo `conflict` nếu mục nháp trùng giờ với `TimetableSlot` hiện có.
- [ ] `POST /ai-assistant/drafts/:messageId/apply` thực thi trong `UnitOfWork` với 2 chiến lược `replace_conflicts` (tự động kết thúc hiệu lực hoặc xóa mềm slot cũ bị trùng rồi tạo slot mới) và `skip_conflicts` (bỏ qua mục trùng), cập nhật `draft.status = 'applied'`.
- [ ] `GET /ai-assistant/messages` và `DELETE /ai-assistant/messages` quản lý lịch sử chat theo Account.
- [ ] `PurgeExpiredAiImagesUseCase` chạy trong bước housekeeping của `DispatchRemindersUseCase` để tự động xóa file ảnh trên S3/MinIO và xóa `imageUrl`/`imageKey` khi `imageExpiresAt <= now`.
- [ ] Unit test với `AiAssistantPort` giả, `ObjectStorage` giả, `Clock` giả và E2E test đầy đủ; `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` xanh.
