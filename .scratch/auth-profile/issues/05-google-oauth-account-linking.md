# BE-05: Đăng nhập Google qua BE + Account Linking

**What to build:** Giáo viên bấm "Tiếp tục với Google", được BE dẫn qua Google rồi quay về FE với mã dùng một lần, FE đổi mã lấy `AuthSession`. Email Google trùng Account có sẵn thì vào đúng Account đó; Account mới qua Google được điền sẵn tên và avatar.

**Blocked by:** BE-03

**Status:** ready-for-agent

**Đọc:** SPEC-002 mục *Google OAuth & Account Linking*, *Token*, *API Contract* (`/auth/google*`); ADR BE 0001; `GLOSSARY.md` (Login Provider, Account Linking).

**Vùng sở hữu:** feature `google-auth` ở mọi layer; port `GoogleOAuthClient` + adapter; controller cho `/auth/google`, `/auth/google/callback`, `/auth/google/exchange`. Dùng lại (không sửa) use case phát token của BE-03.

- [ ] `GET /auth/google?remember=` → 302 tới Google với `state` chống CSRF mang theo `remember`; `state` là token có ký và có hạn (không lưu trong bộ nhớ process — ADR 0005).
- [ ] Callback kiểm `state`; lỗi bất kỳ (state sai, user huỷ, email chưa được Google xác minh) → 302 `${FE_URL}/auth/callback?error=google_failed`; không lộ chi tiết lỗi trên URL.
- [ ] Callback thành công → 302 `${FE_URL}/auth/callback?code=<mã>`; mã ngẫu nhiên, lưu hash, TTL 60 giây, dùng một lần.
- [ ] `POST /auth/google/exchange` → `200 AuthSession` (refresh TTL theo `remember` trong state); mã sai/hết hạn/đã dùng → `401 invalid_code`; có rate limit.
- [ ] Account Linking: email trùng → thêm Login Provider `google`, không tạo Account mới; đăng nhập Google lần sau tìm theo subject Google.
- [ ] Account mới qua Google: `emailVerified = true`; Profile điền `fullName`, `displayName`, avatar URL Google; `gender = null`, chưa hoàn tất Onboarding.
- [ ] Mọi test dùng fake `GoogleOAuthClient`; e2e cho: Account mới, linking với Account mật khẩu sẵn có, mã dùng lại, state sai.
- [ ] Ghi vào báo cáo các bước cấu hình Google Cloud Console (redirect URI) — giá trị client ID/secret thật `[CẦN BỔ SUNG từ người dùng]`, không commit.
