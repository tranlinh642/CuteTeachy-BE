---
status: accepted
date: 2026-10-24
---

# Class Session sinh ra khi đọc từ Timetable Slot, chỉ lưu bản ghi đè

Lịch dạy lặp lại hằng tuần nên chúng tôi lưu Timetable Slot (thứ, giờ, môn, lớp, phòng, khoảng hiệu lực) và **sinh Class Session khi đọc** theo khoảng ngày; chỉ lưu bản ghi cho buổi bị ghi đè (chủ đề, việc cần chuẩn bị, huỷ) hoặc buổi lẻ không thuộc slot. Sửa hoặc xoá một slot đã có buổi trong quá khứ thì BE tách/kết thúc slot cũ tại hôm qua để lịch sử không đổi.

## Considered Options

- **Sinh sẵn mọi Class Session vào DB** khi tạo slot: truy vấn đơn giản nhưng phải chọn giới hạn tương lai, và sửa slot phải cập nhật hàng loạt bản ghi.

## Consequences

- `id` của buổi sinh từ slot phải xác định được từ (slot, ngày) và ổn định giữa các lần đọc.
- Reminder cho Class Session phải tính buổi sắp tới từ slot + bản ghi đè, không đọc một bảng buổi sẵn có.
- Đồng bộ chênh lệch cho Class Session: có slot đổi sau mốc → trả toàn bộ khoảng ngày được hỏi.
