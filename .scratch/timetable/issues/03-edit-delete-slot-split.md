# S4-BE-03: Sửa và xoá Timetable Slot mà không làm đổi lịch sử

**What to build:** Giáo viên sửa giờ/phòng/môn hoặc ngừng một tiết giữa học kỳ; thay đổi có hiệu lực từ hôm nay, các buổi đã qua giữ nguyên; tiết tạo nhầm (chưa có buổi quá khứ) xoá hẳn được.

**Blocked by:** S4-BE-02 (cần bản ghi đè để chuyển/bỏ khi tách)

**Status:** ready-for-agent

**Đọc:** SPEC-004 mục *Timetable Slot* (sửa slot, xoá slot, chuyển bản ghi đè), *API* (`PATCH`/`DELETE /timetable-slots/:id`); ADR BE 0004; `docs/architecture/design-patterns.md` (Unit of Work).

**Vùng sở hữu:** use case sửa/xoá slot trong feature `timetable`; domain thuần quyết định tách/sửa tại chỗ.

- [ ] "Hôm nay" theo `timeZone` của giáo viên.
- [ ] Slot có `effectiveFrom` < hôm nay: sửa → slot cũ `effectiveTo = hôm qua` + slot mới (id BE sinh) `effectiveFrom = hôm nay`; response `{ previous, current }`. Slot chưa bắt đầu: sửa tại chỗ, response `{ current }`.
- [ ] Bản ghi đè từ hôm nay trở đi: chuyển sang slot mới nếu thứ và giờ không đổi; bỏ nếu đổi.
- [ ] Kiểm trùng lịch cho kết quả sau sửa/tách → `409 timetable_conflict`, không thay đổi gì.
- [ ] Xoá slot có buổi quá khứ → `effectiveTo = hôm qua`; chưa có → xoá mềm.
- [ ] Toàn bộ thao tác tách trong một transaction.
- [ ] Unit test domain với `Clock` giả (quanh nửa đêm, múi giờ khác UTC); e2e; gate xanh, dán output.
