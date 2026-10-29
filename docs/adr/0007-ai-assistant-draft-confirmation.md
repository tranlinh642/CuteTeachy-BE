---
status: accepted
date: 2026-10-29
---

# Trợ lý AI sử dụng Google Gemini Multimodal với cơ chế Bản nháp xác nhận (Draft Confirmation) và tự động dọn ảnh sau 45 ngày

Trợ lý AI nhận ảnh chụp Thời khóa biểu hoặc tin nhắn văn bản để hỗ trợ thêm lịch (`TimetableSlot`, `ClassSession`, `Task`) thuộc 3 phân loại (`school_teaching`, `extra_teaching`, `self_study`) và trả lời truy vấn lịch trình/công việc/ghi chú theo ngày. Vì nhận diện ảnh thời khóa biểu thực tế có thể gặp chữ viết tắt, thiếu khung giờ tiết học hoặc trùng với lịch hiện có, AI không bao giờ tự động ghi thẳng vào bảng nghiệp vụ mà tạo ra `AI Schedule Draft` (bản nháp kèm cảnh báo trùng lịch và ánh xạ khung giờ tiết học) để giáo viên xem trước và bấm xác nhận (`replace_conflicts` hoặc `skip_conflicts`). BE kết nối trực tiếp tới Google Gemini API qua `AiAssistantPort` (không dùng bộ phân tích giả lập để tránh làm nặng hệ thống), và mọi ảnh đính kèm trong lịch sử chat AI được đánh dấu hạn lưu trữ để tác vụ dọn dẹp định kỳ tự động xóa khỏi S3/DB sau 45 ngày (1–2 tháng).

## Considered Options

- **AI tự động ghi thẳng lịch vào Database (Auto-commit)**: Rủi ro làm hỏng thời khóa biểu hiện tại của giáo viên nếu ảnh mờ hoặc trùng giờ mà chưa được xác nhận.
- **Lưu ảnh chat vĩnh viễn**: Tốn dung lượng Object Storage cho các ảnh thời khóa biểu vốn chỉ có giá trị tham chiếu ngắn hạn đầu học kỳ.
- **Thêm bộ rule-based fallback phức tạp khi thiếu API key**: Làm phình mã nguồn và nặng hệ thống không cần thiết.

## Consequences

- Mọi thao tác thêm lịch từ AI đều an toàn 100%, giáo viên kiểm soát hoàn toàn việc ghi đè hay bỏ qua lịch trùng.
- Dung lượng lưu trữ S3/DB được giải phóng tự động nhờ cơ chế tự xóa ảnh chat quá hạn 45 ngày trong tiến trình housekeeping.
