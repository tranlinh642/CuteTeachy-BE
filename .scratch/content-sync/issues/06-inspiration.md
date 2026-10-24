# S3-BE-06: Inspiration mỗi ngày

**What to build:** Giáo viên thấy một câu truyền cảm hứng (vi/en) đổi theo ngày ở múi giờ của mình.

**Blocked by:** S3-BE-02

**Status:** ready-for-agent

**Đọc:** SPEC-003 mục *Kiểu dữ liệu* (Inspiration), *Quy tắc domain* (Inspiration), *API*; danh sách câu trích hiện có trong mock seed của FE.

**Vùng sở hữu:** feature `inspiration`; migration + seed.

- [ ] Seed nạp toàn bộ câu trích hiện có trong mock FE (vi + en + `author`); chạy seed lặp lại không tạo trùng.
- [ ] `GET /inspirations/today` chọn câu theo số thứ tự ngày trong năm tính ở `timeZone` của giáo viên; cùng ngày luôn trả cùng câu.
- [ ] Unit test với `Clock` giả: hai giáo viên ở múi giờ khác nhau quanh nửa đêm UTC nhận câu theo ngày địa phương của mình.
- [ ] e2e endpoint; gate xanh, dán output.
