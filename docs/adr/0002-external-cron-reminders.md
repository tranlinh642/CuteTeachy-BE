---
status: accepted
date: 2026-10-24
---

# Reminder được kích hoạt bởi cron bên ngoài qua endpoint nội bộ

BE chạy trên hosting miễn phí, nơi không có lịch chạy định kỳ đủ dày: Vercel Hobby chỉ cho cron một lần mỗi ngày, còn process serverless/free-tier không chạy liên tục để giữ lịch trong bộ nhớ. Chúng tôi để dịch vụ cron bên ngoài (cron-job.org) gọi `POST /internal/reminders/dispatch` mỗi phút, xác thực bằng secret trong header; use case gửi Reminder idempotent theo (loại, id mục, thời điểm nhắc) và bỏ qua Reminder trễ quá 10 phút. Khi dev, lịch chạy trong BE gọi cùng use case.

## Considered Options

- **Vercel Cron**: gói Hobby chỉ chạy 1 lần/ngày — không đủ cho nhắc theo phút.
- **Server chạy liên tục + lịch trong process**: đúng giờ hơn nhưng tốn phí — bị loại vì mục tiêu hosting miễn phí.
- **GitHub Actions `schedule`**: tối thiểu 5 phút và không đảm bảo đúng giờ.

## Consequences

- Reminder có thể trễ vài giây đến khoảng một phút (cold start). cron-job.org chờ tối đa 30 giây mỗi lần gọi, nên dispatch phải trả lời nhanh.
- Không được giả định dispatch chạy đúng một lần mỗi phút: gọi trùng hay bỏ lỡ đều phải an toàn.
- cron-job.org tự tắt job sau 15 lần thất bại liên tiếp — cần theo dõi.
- Chuyển sang server chạy liên tục sau này chỉ cần thêm lịch nội bộ gọi cùng use case.
