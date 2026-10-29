---
status: accepted
date: 2026-10-29
---

# Hệ thống Thông báo 2 tầng (In-App Notification Center + Local Ticker & Web Push)

Web Push phụ thuộc vào quyền thông báo của trình duyệt, trạng thái cài đặt PWA trên iOS (Standalone Home Screen), và chu kỳ quét cron bên ngoài (60 giây). Để đảm bảo chức năng thông báo luôn nhanh, tin cậy và không bị vô hiệu hóa khi thiết bị chặn Web Push, chúng tôi áp dụng kiến trúc thông báo 2 tầng đồng bộ: (1) Lưu trữ `InAppNotification` trên DB hiển thị qua Trung tâm Thông báo (biểu tượng Chuông) kết hợp bộ đếm thời gian thực tại FE (`LocalReminderTicker`) bắn banner/toast đúng từng giây khi đang mở ứng dụng; (2) Kênh Web Push nền có hỗ trợ xin quyền chuyên biệt cho iOS/Android, nút gửi thông báo thử nghiệm (`POST /push-subscriptions/test`), quét bù cửa sổ qua nửa đêm (`yesterday` + `today` + `tomorrow`), và mở rộng đối tượng nhắc sang cả `Note` (`dueDate` + `remindTime`, hoặc đầu ngày `07:00` nếu chỉ có `dueDate`).

## Considered Options

- **Chỉ dùng Web Push như cũ**: Bị chặn trên iOS nếu chưa thêm vào màn hình chính hoặc khi trình duyệt tắt quyền nền; người dùng đang mở app không có trung tâm xem lại các lời nhắc đã bắn.
- **WebSockets / SSE giữ kết nối liên tục từ BE**: Không phù hợp với kiến trúc serverless trên Vercel Hobby (giới hạn thời gian sống của hàm và không giữ kết nối persistent).

## Consequences

- Giáo viên luôn nhận được thông báo ngay lập tức khi mở ứng dụng (nhờ Local Ticker + In-App Notification Center) ngay cả khi chưa bật Web Push.
- Khi ứng dụng đóng, Web Push vẫn hoạt động qua cron và đồng thời ghi nhận `InAppNotification` để khi giáo viên mở ứng dụng lên sẽ thấy lịch sử lời nhắc chưa đọc.
- Quét lời nhắc ở BE cần kiểm tra cả ngày liền kề để không bỏ sót các mục đầu ngày có thời điểm nhắc (`remindAt`) lùi về cuối ngày hôm trước.
