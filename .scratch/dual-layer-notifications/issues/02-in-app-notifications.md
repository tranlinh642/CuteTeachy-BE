# 02: S6-BE-02 — Trung tâm Thông báo (`InAppNotification`) & Gửi thông báo thử (`POST /push/subscriptions/test`)

**What to build:** Mỗi lời nhắc đến hạn đều tự động lưu bản ghi `InAppNotification` vào DB để giáo viên xem lại trên biểu tượng Chuông thông báo trong ứng dụng (ngay cả khi trình duyệt chặn Web Push), đồng thời cung cấp API quản lý trạng thái đã đọc và nút Gửi thông báo thử nghiệm tới thiết bị.

**Blocked by:** 01 (S6-BE-01 — Mở rộng Note `remindTime` & Sửa lỗi biên nửa đêm)

**Status:** done

- [x] Tạo bảng `in_app_notifications` và module `notification` theo đúng Clean Architecture 4 layer.
- [x] Trong `DispatchRemindersUseCase`, mỗi khi có mục đến hạn chưa gửi trong cửa sổ 10 phút: luôn tạo bản ghi `InAppNotification` và lưu `SentReminder` idempotent; nếu `pushEnabled = true` thì gửi thêm Web Push; tự động dọn `InAppNotification` quá 30 ngày.
- [x] Cung cấp `GET /notifications` (trả `{ items, unreadCount }`), `PATCH /notifications/:id/read`, và `POST /notifications/read-all`.
- [x] Cung cấp `POST /push/subscriptions/test` tạo 1 thông báo thử In-App + gửi Web Push tới các thiết bị của giáo viên hiện tại.
- [x] Unit test và E2E test đầy đủ (bao gồm kiểm tra cô lập tài khoản `404`); `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` xanh.
