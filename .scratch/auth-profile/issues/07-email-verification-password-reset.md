# BE-07 (giai đoạn cuối): Gửi mã xác nhận qua email — xác minh email và quên mật khẩu

**What to build:** Giáo viên đăng ký bằng mật khẩu nhận mã 6 số qua email để xác minh; khi bật `EMAIL_VERIFICATION_REQUIRED`, Account chưa xác minh không đăng nhập được bằng mật khẩu. Giáo viên quên mật khẩu nhận mã qua email và đặt mật khẩu mới.

**Blocked by:** BE-04, BE-05, BE-06 (cố ý xếp cuối theo quyết định của người dùng)

**Status:** ready-for-agent

**Đọc:** SPEC-002 mục *Xác minh email & quên mật khẩu*, *API Contract* (các endpoint đánh dấu \*).

**Vùng sở hữu:** feature `email-verification` và `password-reset`; port `Mailer` + adapter SMTP (Mailpit khi dev, Gmail SMTP + App Password production — xem `docs/setup/external-services.md` §2; luôn `await` việc gửi vì chạy serverless); mẫu email vi/en; nhánh `email_not_verified` trong use case đăng nhập (chỉnh nhỏ, có test).

- [ ] Đăng ký bằng mật khẩu → gửi mã xác minh (ngôn ngữ theo `Accept-Language`).
- [ ] Mã 6 số, lưu hash, TTL 10 phút, tối đa 5 lần sai, gửi lại cách nhau ≥ 60 giây; vi phạm → `400 invalid_code` hoặc `429 rate_limited`.
- [ ] `POST /auth/email/verify` → `200 AuthSession`, đặt `emailVerifiedAt`; `POST /auth/email/resend` → 204.
- [ ] `EMAIL_VERIFICATION_REQUIRED=true`: Account chỉ có Login Provider `password` và chưa xác minh → login `403 email_not_verified`; `false` → hành vi như cũ. Account Google không bị ảnh hưởng.
- [ ] `POST /auth/password/forgot` luôn 204 (không lộ email có tồn tại); `POST /auth/password/reset` đổi mật khẩu và thu hồi mọi refresh token.
- [ ] Unit test với fake `Mailer` và `Clock`; e2e đọc mã từ API của Mailpit.
