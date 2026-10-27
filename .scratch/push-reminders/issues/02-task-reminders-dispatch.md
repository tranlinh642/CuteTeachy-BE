# S5-BE-02: Reminder cho Task + endpoint dispatch cho cron

**What to build:** Giáo viên nhận push trước giờ của mỗi Task có giờ chưa hoàn thành, theo số phút nhắc trước và ngôn ngữ đã chọn; mỗi Task nhắc đúng một lần; nhắc trễ quá 10 phút thì bỏ. Cron ngoài kích hoạt qua endpoint có secret; dev có lịch chạy nội bộ.

**Blocked by:** S5-BE-01, S3-BE-02 (Settings), S3-BE-03 (Tasks)

**Status:** done

**Đọc:** SPEC-005 mục *Reminder*, *Kích hoạt gửi*, *API*; ADR BE 0002, 0005; `docs/setup/external-services.md` §5; `GLOSSARY.md` (Reminder).

**Vùng sở hữu:** feature `reminder` ở mọi layer (use case dispatch, bản ghi Reminder đã gửi, mẫu nội dung vi/en), endpoint `/internal/reminders/dispatch` + guard secret, lịch chạy chỉ bật ở dev, gọi dọn dấu xoá mềm (S3-BE-01) trong dispatch.

- [x] Thời điểm nhắc = (`date` + `time` theo `timeZone`) − `reminderLeadMinutes`; gửi khi thời điểm nhắc ∈ (bây giờ − 10 phút, bây giờ].
- [x] Không gửi khi: Task không có `time`, đã `completed`, đã xoá, `pushEnabled = false`.
- [x] Khoá idempotent (loại, id Task, thời điểm nhắc) lưu bền; gọi dispatch hai lần chỉ gửi một lần; đổi giờ/số phút/múi giờ → gửi theo giờ mới.
- [x] Nội dung theo `locale`, payload có URL mở app tại ngày của Task.
- [x] `POST /internal/reminders/dispatch`: sai/thiếu secret → `401`; đúng → `{ sent, skipped }`; không qua JWT/Onboarding guard.
- [x] Dispatch giới hạn khối lượng mỗi lần (gửi + dọn dẹp) để trả lời nhanh; dọn bản ghi Reminder đã gửi cũ.
- [x] Lịch chạy nội bộ chỉ bật ở môi trường dev (config).
- [x] Unit test use case với `Clock` + `PushSender` giả cho mọi nhánh trên; e2e endpoint; gate xanh, dán output.
