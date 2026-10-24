---
status: accepted
date: 2026-10-24
---

# Đồng bộ mobile-first: UUID từ client, tạo idempotent, xoá mềm, đồng bộ chênh lệch

App chủ yếu chạy trên điện thoại, hay mất mạng, và FE tự gửi lại mutation khi có mạng — nếu server sinh id thì lệnh tạo gửi lại sẽ sinh bản trùng, và tải lại toàn bộ dữ liệu mỗi lần mở app tốn băng thông. Chúng tôi chọn: client sinh UUID cho bản ghi mới, BE tạo idempotent theo `id`, cập nhật last-write-wins, xoá mềm giữ dấu 30 ngày, và mọi danh sách hỗ trợ `?updatedSince=` trả bản ghi thay đổi kèm `deletedIds` và `serverTime`.

## Considered Options

- **Server sinh id + xoá hẳn + tải toàn bộ**: đơn giản hơn nhưng tạo trùng khi gửi lại và tốn dữ liệu di động.
- **Đồng bộ có phát hiện xung đột (version/ETag)**: chính xác hơn last-write-wins nhưng phức tạp, không cần với dữ liệu cá nhân một người sửa.

## Consequences

- Mọi bảng nghiệp vụ có `updatedAt` và dấu xoá; truy vấn mặc định phải loại bản ghi đã xoá.
- Thay đổi gián tiếp (ví dụ xoá Tag gỡ khỏi Task/Note) phải cập nhật `updatedAt` của bản ghi bị ảnh hưởng.
- Gửi lại lệnh tạo cho `id` đã bị xoá → `410 gone`, không hồi sinh.
- Client có `updatedSince` cũ hơn 30 ngày phải tải lại toàn bộ.
