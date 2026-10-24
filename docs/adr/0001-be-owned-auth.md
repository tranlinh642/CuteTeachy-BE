---
status: accepted
date: 2026-10-24
---

# BE tự quản lý Auth thay cho Supabase Auth

CuteTeachy cần đăng nhập bằng tài khoản riêng (email + mật khẩu) và Google, kèm Onboarding và Account Linking theo email. Chúng tôi chọn để NestJS BE tự sở hữu toàn bộ Auth — lưu Account/Login Provider trong Postgres, tự chạy Google OAuth (redirect qua `/auth/google` → `/auth/google/callback`) và tự phát token — thay vì dùng Supabase Auth, để giữ quyền kiểm soát luồng Onboarding, Account Linking và mô hình token trong cùng codebase; Supabase chỉ còn đóng vai trò Postgres được host.

## Considered Options

- **Supabase Auth** (stack ban đầu): ít code hơn, nhưng Onboarding/Account Linking và dữ liệu Account nằm ngoài BE, BE chỉ verify JWT.
- **Google ID token (Google Identity Services) gửi lên BE**: ít endpoint hơn, bị loại vì muốn luồng redirect/callback do BE điều khiển.

## Consequences

- Token: access token JWT 15 phút + refresh token chuỗi ngẫu nhiên, lưu hash trong DB, xoay vòng mỗi lần refresh; trả trong response body (không dùng cookie vì FE và BE khác domain, Safari iOS chặn cookie bên thứ ba). Logout thu hồi refresh token.
- Callback Google không đặt token lên URL: BE redirect về FE kèm mã dùng một lần (TTL ngắn), FE đổi mã lấy token.
- Trên iOS PWA ở chế độ standalone, redirect OAuth có thể mở ra Safari ngoài app — đã chấp nhận rủi ro này.
- BE chịu trách nhiệm bảo mật mật khẩu (hash), chống brute-force và về sau là gửi email mã xác nhận.
