# BE-03: Account + Token — đăng ký, đăng nhập mật khẩu, refresh, logout, /auth/me

**What to build:** Giáo viên đăng ký bằng email + mật khẩu và được đăng nhập ngay, đăng nhập lại, phiên tự gia hạn bằng refresh token xoay vòng, đăng xuất, và lấy thông tin bản thân. Ticket này cũng đặt **toàn bộ schema dữ liệu** cho Account/Profile/token/mã để các ticket BE-04..07 chạy song song mà không đụng nhau ở schema.

**Blocked by:** BE-02

**Status:** ready-for-agent

**Đọc:** SPEC-002 mục *Account & Login Provider*, *Token*, *Chống brute-force*, *API Contract* (`register`, `login`, `refresh`, `logout`, `me`, kiểu `User`/`AuthSession`); ADR BE 0001; `GLOSSARY.md` (Account, Profile, Login Provider).

**Vùng sở hữu:** feature `account` ở mọi layer; Prisma schema + migration đầu tiên; JWT auth guard toàn cục + decorator public; rate limiting; adapter `PasswordHasher` (argon2id) và `TokenService`.

- [ ] Một migration tạo đủ dữ liệu cho: Account (email unique, `emailVerifiedAt`), Login Provider (`password` với hash / `google` với subject Google), Profile (`fullName`, `displayName`, `title`, `gender` nullable, avatar — URL ngoài hoặc object key do hệ thống quản lý, `onboardingCompletedAt`), refresh token (hash, hạn, thu hồi, chuỗi xoay vòng), mã dùng một lần cho Google exchange, mã xác nhận email/đặt lại mật khẩu (hash, mục đích, hạn, số lần sai). Ticket sau cần thêm cột → BLOCKED, không tự sửa schema.
- [ ] Domain: email chuẩn hoá (trim + lowercase), chính sách mật khẩu 8–72; Account mới có Profile rỗng, `gender = null`, `onboardingCompletedAt = null`.
- [ ] `POST /auth/register` → `201 AuthSession`; email trùng → `409 email_taken`; dữ liệu sai → `400 validation`.
- [ ] `POST /auth/login` → `200 AuthSession`; sai email/mật khẩu hoặc Account không có Login Provider `password` → `401 invalid_credentials` (cùng message).
- [ ] Access token JWT 15 phút; refresh token theo `remember` dùng TTL từ config; `POST /auth/refresh` xoay vòng; dùng lại token đã thu hồi → thu hồi mọi refresh token của Account và trả `401`.
- [ ] `POST /auth/logout` thu hồi refresh token gửi lên, trả 204 cả khi token không tồn tại.
- [ ] `GET /auth/me` trả `User` đúng contract; thiếu/sai/hết hạn access token → `401 unauthorized`.
- [ ] Guard JWT áp dụng mặc định cho mọi route; route public đánh dấu tường minh.
- [ ] Rate limit theo IP cho `register`, `login`, `refresh` → `429 rate_limited`; ngưỡng nằm trong config.
- [ ] Unit test use case với fake port; e2e cho từng endpoint, gồm cả các nhánh lỗi kể trên.
