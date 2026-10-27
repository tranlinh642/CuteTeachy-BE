# S4-BE-04: Đồng bộ chênh lệch cho Class Session

**What to build:** App trên điện thoại mở lịch dạy chỉ tải phần thay đổi khi có thể, và biết buổi nào không còn tồn tại (buổi lẻ bị xoá, buổi biến mất do sửa slot).

**Blocked by:** S4-BE-03

**Status:** in-progress

**Đọc:** SPEC-004 mục *API* (`GET /class-sessions` với `updatedSince`); ADR BE 0003, 0004.

**Vùng sở hữu:** nhánh `updatedSince` của use case đọc Class Session.

- [ ] Có slot của giáo viên đổi (tạo/sửa/tách/kết thúc/xoá) sau mốc → trả toàn bộ buổi trong khoảng.
- [ ] Không có slot đổi → chỉ trả buổi có bản ghi đè hoặc buổi lẻ thay đổi sau mốc.
- [ ] `deletedIds` gồm buổi lẻ đã xoá và id buổi không còn sinh ra do slot đổi (trong khoảng được hỏi).
- [ ] `updatedSince` cũ hơn 30 ngày → `400 validation`.
- [ ] e2e cho từng trường hợp; gate xanh, dán output.
