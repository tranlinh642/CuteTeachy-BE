---
status: accepted
date: 2026-10-24
---

# BE deploy dạng serverless trên Vercel

FE và BE cùng deploy trên Vercel (gói Hobby, miễn phí), file trên Cloudflare R2, Postgres trên Supabase. Chọn Vercel cho BE để dùng chung một nền tảng với FE và không phải duy trì server chạy liên tục; đổi lại BE phải chạy được dưới dạng serverless function không giữ trạng thái giữa các request.

## Considered Options

- **Render free (container)**: chạy NestJS như server thường, nhưng ngủ sau ~15 phút không có truy cập, không có ổ đĩa bền ở gói free.
- **VPS tự quản**: không giới hạn, nhưng tốn phí và công vận hành.
- **Cloudflare Workers (free)**: giới hạn 10 ms CPU mỗi request, không chạy được module native (argon2), NestJS khởi tạo DI nặng và cầu nối HTTP kém ổn định — phải bỏ NestJS sang Hono. Bị loại (2026-10-24).
- **Cloudflare Containers**: chạy nguyên NestJS trong Docker và có Cron Triggers thay cron-job.org, nhưng cần gói Workers Paid (từ 5 USD/tháng). Bị loại vì mục tiêu miễn phí; là hướng chuyển đầu tiên nếu sau này chấp nhận trả phí.

## Consequences

- **Không trạng thái trong bộ nhớ**: rate limit lưu bộ đếm trong Postgres; `state` OAuth là token có ký (hoặc lưu DB); không dùng lịch chạy trong process ở production (xem ADR 0002).
- **Kết nối DB**: app dùng Supabase pooler chế độ transaction (cổng 6543, `pgbouncer=true`) qua `DATABASE_URL`; migration dùng kết nối trực tiếp qua `DIRECT_URL` (Prisma `directUrl`).
- **Giới hạn request/response 4,5 MB**: upload avatar (≤ 2 MB) đi qua BE vẫn được; file lớn hơn sau này phải dùng presigned URL tải thẳng lên R2.
- **Gửi email/push phải `await` xong trước khi trả response**: function bị dừng ngay sau khi trả response.
- Docker (`api` service) chỉ dùng cho local; build production theo cấu hình Vercel.
