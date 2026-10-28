# S3-BE-02: Settings của giáo viên

**What to build:** Giáo viên đọc và cập nhật cài đặt trên server: ngôn ngữ, múi giờ, bật/tắt thông báo, số phút nhắc trước. Account mới (và Account đã có) nhận giá trị mặc định.

**Blocked by:** auth-profile BE-03 (Account)

**Status:** done

**Đọc:** SPEC-003 mục *Kiểu dữ liệu* (Settings), *Quy tắc domain* (Settings mặc định), *API* (`/me/settings`); BA §4.

**Vùng sở hữu:** feature `settings` ở mọi layer; migration Settings + cấp mặc định cho Account đã có; port đọc `timeZone`/`locale` của giáo viên để feature khác dùng; điểm gắn tạo Settings khi tạo Account (chỉnh nhỏ trong use case đăng ký/Google, có test).

- [x] Account mới có Settings mặc định: `locale` theo `Accept-Language` (không có → `vi`), `timeZone = Asia/Ho_Chi_Minh`, `pushEnabled = true`, `reminderLeadMinutes = 15` (kiểm tra qua unit test `register.use-case.spec.ts`, `handle-google-callback.use-case.spec.ts` và e2e test `settings.e2e-spec.ts`).
- [x] Migration cấp mặc định cho mọi Account đã tồn tại (kiểm tra qua migration `20261026074500_create_settings_table`).
- [x] `GET /me/settings` trả đủ 4 trường (kiểm tra qua e2e test `settings.e2e-spec.ts` và unit test `get-settings.use-case.spec.ts`).
- [x] `PATCH /me/settings` từng phần; `locale ∉ {vi,en}`, `timeZone` không phải IANA hợp lệ, `reminderLeadMinutes ∉ {5,10,15,30,60}` → `400 validation` (kiểm tra qua e2e test `settings.e2e-spec.ts` và unit test `update-settings.use-case.spec.ts`).
- [x] Route này **không** bị Onboarding guard chặn (FE gửi `timeZone` trong lúc Onboarding) (kiểm tra qua decorator `@ExemptOnboarding()` và e2e test `settings.e2e-spec.ts`).
- [x] Port đọc Settings + hàm "hôm nay của giáo viên" từ `Clock` + `timeZone`, có unit test quanh nửa đêm ở múi giờ khác UTC (kiểm tra qua unit test `teacher-today.spec.ts`).
- [x] e2e cho các nhánh trên; gate xanh, dán output (kiểm tra qua `settings.e2e-spec.ts` và 8 suite e2e toàn bộ).
