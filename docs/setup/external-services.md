# Dịch vụ bên ngoài — cách lấy thông tin cấu hình

Danh sách thông tin BE cần từ dịch vụ bên ngoài, cách lấy và nơi đặt. **Không commit giá trị thật**: dev đặt trong `.env` (đã gitignore), production đặt trong Environment Variables của Vercel. Tên biến dưới đây là đề xuất; BE-01 chốt tên cuối cùng trong `.env.example`.

> Số liệu về gói miễn phí lấy từ tra cứu web ngày 2026-10-24, cần kiểm lại trên trang chính thức khi đăng ký.

## Môi trường

| Hạng mục | Local (dev) | Production |
| --- | --- | --- |
| Database | Postgres trong docker-compose | Supabase Postgres |
| Lưu file (avatar) | MinIO trong docker-compose | Cloudflare R2 |
| Email | Mailpit trong docker-compose | Gmail SMTP + App Password |
| Gọi gửi Reminder | Lịch chạy trong BE | cron-job.org gọi mỗi phút |
| Hosting | `pnpm dev` / docker `api` | Vercel serverless cho cả FE và BE (ADR 0005) |

## 0. Supabase Postgres (production)

Trong Supabase project → **Connect**, lấy hai chuỗi kết nối:

| Biến | Giá trị |
| --- | --- |
| `DATABASE_URL` | chuỗi **Transaction pooler** (cổng `6543`), thêm `?pgbouncer=true` — app dùng khi chạy |
| `DIRECT_URL` | chuỗi **Direct connection** (cổng `5432`) — chỉ dùng cho `prisma migrate` |

Dev dùng Postgres trong docker-compose: hai biến trỏ cùng một chuỗi.

## 1. Google OAuth (đăng nhập Google — BE-05)

1. Vào Google Cloud Console, tạo (hoặc chọn) project.
2. **APIs & Services → OAuth consent screen** (giao diện mới: *Google Auth platform → Branding / Audience*):
   - User type **External**, điền tên app, email hỗ trợ, email liên hệ nhà phát triển.
   - Để ở trạng thái **Testing**, thêm email Google sẽ dùng thử vào **Test users** — chỉ những tài khoản này đăng nhập được cho tới khi publish.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**, loại **Web application**.
4. **Authorized redirect URIs**:
   - Dev: `http://localhost:4000/auth/google/callback`
   - Production: `https://<domain BE>/auth/google/callback`
5. Lưu **Client ID** và **Client Secret** ngay (mất secret phải tạo lại).

| Biến | Giá trị |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID |
| `GOOGLE_CLIENT_SECRET` | Client Secret |
| `GOOGLE_CALLBACK_URL` | redirect URI tương ứng môi trường |

## 2. Gmail App Password (gửi email mã xác nhận — BE-07)

1. Nên dùng **một tài khoản Gmail riêng cho việc gửi** (không dùng Gmail cá nhân chính).
2. Tài khoản Google → **Security** → bật **2-Step Verification** (bắt buộc; không bật thì không tạo được App Password).
3. Vào **App passwords** (`https://myaccount.google.com/apppasswords`), đặt tên (ví dụ `CuteTeachy BE`), tạo → nhận mã 16 ký tự. Bỏ khoảng trắng khi dán.
4. Cấu hình SMTP: host `smtp.gmail.com`, cổng **465** (SSL, `secure = true`) hoặc **587** (STARTTLS). Username là địa chỉ Gmail đầy đủ, password là App Password.

| Biến | Giá trị |
| --- | --- |
| `SMTP_HOST` | `smtp.gmail.com` (dev: `mailpit`) |
| `SMTP_PORT` | `465` (dev: `1025`) |
| `SMTP_SECURE` | `true` (dev: `false`) |
| `SMTP_USER` | địa chỉ Gmail gửi |
| `SMTP_PASS` | App Password 16 ký tự |
| `MAIL_FROM` | ví dụ `CuteTeachy <địa-chỉ-gmail>` |

**Giới hạn cần biết:**
- Gmail miễn phí: khoảng **500 người nhận / 24 giờ**; vượt sẽ bị khoá gửi tạm thời. Đủ cho giai đoạn đầu; khi lớn hơn chuyển sang dịch vụ email qua HTTP (Resend, SendGrid…) — chỉ cần thêm adapter cho port `Mailer`.
- Trên Vercel: cổng 465/587 được phép ra ngoài (cổng 25 bị chặn). Phải `await` việc gửi trước khi trả response, nếu không function bị dừng và email không đi.

## 3. Cloudflare R2 (lưu avatar production — BE-06)

1. Tạo tài khoản Cloudflare → **R2** → tạo bucket `avatars`.
2. Bật truy cập công khai cho bucket (domain `r2.dev` hoặc gắn custom domain) → lấy **URL công khai** gốc.
3. Tạo **R2 API token** quyền đọc/ghi object cho bucket → nhận **Access Key ID**, **Secret Access Key**; endpoint S3 dạng `https://<account-id>.r2.cloudflarestorage.com`.
4. Gói miễn phí: 10 GB lưu trữ, không tính phí băng thông tải xuống.

| Biến | Local (MinIO) | Production (R2) |
| --- | --- | --- |
| `S3_ENDPOINT` | `http://minio:9000` | endpoint R2 |
| `S3_REGION` | `us-east-1` | `auto` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | user MinIO dev | R2 API token |
| `S3_BUCKET_AVATARS` | `avatars` | `avatars` |
| `S3_PUBLIC_BASE_URL` | `http://localhost:9000/avatars` | URL công khai của bucket |

## 4. Khoá VAPID (Web Push — SPEC-005)

1. Chạy `npx web-push generate-vapid-keys` → public key + private key.
2. Mỗi môi trường một cặp và **giữ cố định**: đổi khoá thì mọi thiết bị phải đăng ký push lại.

| Biến | Giá trị |
| --- | --- |
| `VAPID_PUBLIC_KEY` | public key (FE cũng dùng) |
| `VAPID_PRIVATE_KEY` | private key |
| `VAPID_SUBJECT` | `mailto:<email liên hệ>` |

## 5. cron-job.org (gọi gửi Reminder — SPEC-005, ADR 0002)

1. Tạo tài khoản cron-job.org, tạo job **POST** `https://<domain BE>/internal/reminders/dispatch`, lịch **mỗi phút**.
2. Thêm header `X-Cron-Secret: <chuỗi ngẫu nhiên dài>`; đặt cùng giá trị cho biến `CRON_SECRET` của BE.
3. Giới hạn gói miễn phí: mỗi lần gọi chờ tối đa 30 giây; thất bại 15 lần liên tiếp thì job tự tắt — kiểm tra định kỳ.
4. Lý do không dùng Vercel Cron: gói Hobby chỉ cho chạy **một lần mỗi ngày**.

| Biến | Giá trị |
| --- | --- |
| `CRON_SECRET` | chuỗi ngẫu nhiên, trùng với header trên cron-job.org |
