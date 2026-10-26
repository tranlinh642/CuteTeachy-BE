# S3-BE-02: Settings của giáo viên

**What to build:** Giáo viên đọc và cập nhật cài đặt trên server: ngôn ngữ, múi giờ, bật/tắt thông báo, số phút nhắc trước. Account mới (và Account đã có) nhận giá trị mặc định.

**Blocked by:** auth-profile BE-03 (Account)

**Status:** in-progress

**Đọc:** SPEC-003 mục *Kiểu dữ liệu* (Settings), *Quy tắc domain* (Settings mặc định), *API* (`/me/settings`); BA §4.

**Vùng sở hữu:** feature `settings` ở mọi layer; migration Settings + cấp mặc định cho Account đã có; port đọc `timeZone`/`locale` của giáo viên để feature khác dùng; điểm gắn tạo Settings khi tạo Account (chỉnh nhỏ trong use case đăng ký/Google, có test).

- [ ] Account mới có Settings mặc định: `locale` theo `Accept-Language` (không có → `vi`), `timeZone = Asia/Ho_Chi_Minh`, `pushEnabled = true`, `reminderLeadMinutes = 15`.
- [ ] Migration cấp mặc định cho mọi Account đã tồn tại.
- [ ] `GET /me/settings` trả đủ 4 trường.
- [ ] `PATCH /me/settings` từng phần; `locale ∉ {vi,en}`, `timeZone` không phải IANA hợp lệ, `reminderLeadMinutes ∉ {5,10,15,30,60}` → `400 validation`.
- [ ] Route này **không** bị Onboarding guard chặn (FE gửi `timeZone` trong lúc Onboarding).
- [ ] Port đọc Settings + hàm "hôm nay của giáo viên" từ `Clock` + `timeZone`, có unit test quanh nửa đêm ở múi giờ khác UTC.
- [ ] e2e cho các nhánh trên; gate xanh, dán output.
