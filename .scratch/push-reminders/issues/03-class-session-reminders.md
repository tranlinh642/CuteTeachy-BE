# S5-BE-03: Reminder cho Class Session

**What to build:** Giáo viên được nhắc trước giờ vào mỗi tiết dạy — cả buổi sinh từ thời khoá biểu và buổi lẻ — trừ buổi đã huỷ.

**Blocked by:** S5-BE-02, S4-BE-02 (ghi đè + buổi lẻ)

**Status:** ready-for-agent

**Đọc:** SPEC-005 mục *Reminder* (Class Session, nội dung); SPEC-004 mục *Module BE* (domain sinh buổi dùng lại); ADR BE 0004.

**Vùng sở hữu:** nguồn Class Session trong use case dispatch; mẫu nội dung cho tiết dạy.

- [ ] Tính buổi sắp tới bằng domain sinh buổi của SPEC-004 + bản ghi đè + buổi lẻ (không tạo bảng buổi riêng).
- [ ] Bỏ qua buổi `cancelled`; buổi lẻ được nhắc như buổi thường.
- [ ] Khoá idempotent loại `class_session` + id buổi + thời điểm nhắc; sửa slot (tách) hoặc sửa giờ buổi lẻ → nhắc theo giờ mới.
- [ ] Nội dung theo `locale`: môn (+ lớp nếu có), giờ bắt đầu, phòng nếu có; URL mở app tại ngày đó.
- [ ] Unit test với `Clock` + `PushSender` giả: buổi từ slot, buổi lẻ, buổi huỷ, slot hết hiệu lực, múi giờ khác UTC; gate xanh, dán output.
