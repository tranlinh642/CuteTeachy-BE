# S5-BE-01: Thiết bị nhận push (subscription + VAPID + PushSender)

**What to build:** Một thiết bị đã được giáo viên cho phép thông báo có thể đăng ký nhận push với BE và huỷ đăng ký; BE gửi được một push thử tới mọi thiết bị của giáo viên và tự loại thiết bị đã hết hạn.

**Blocked by:** auth-profile BE-04

**Status:** ready-for-agent

**Đọc:** SPEC-005 mục *Thiết bị nhận push*, *API*, *Module BE*; `docs/setup/external-services.md` §4 (VAPID); ADR BE 0005 (phải `await` gửi xong).

**Vùng sở hữu:** feature `push-subscription` ở mọi layer; port `PushSender` + adapter Web Push (VAPID từ config); migration subscription; tạo cặp khoá VAPID cho dev trong `.env.example` hướng dẫn (không commit khoá thật).

- [ ] `GET /push/vapid-public-key` (public) → `{ publicKey }`.
- [ ] `POST /push/subscriptions` `{ endpoint, keys: { p256dh, auth } }` upsert theo `endpoint` (`201` mới / `200` đã có); endpoint đang thuộc Account khác → chuyển sang Account hiện tại.
- [ ] `DELETE /push/subscriptions` `{ endpoint }` → `204` (kể cả khi không tồn tại).
- [ ] Use case "gửi tới mọi thiết bị của giáo viên" qua `PushSender`; adapter báo hết hạn (`404`/`410` từ push service) → xoá subscription đó.
- [ ] Unit test với `PushSender` giả (nhiều thiết bị, một thiết bị hết hạn); e2e các endpoint; gate xanh, dán output.
