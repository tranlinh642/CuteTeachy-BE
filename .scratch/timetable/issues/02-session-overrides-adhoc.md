# S4-BE-02: Ghi đè từng buổi + buổi lẻ

**What to build:** Giáo viên ghi chủ đề và việc cần chuẩn bị cho một buổi cụ thể, huỷ/khôi phục buổi đó mà các tuần khác không đổi; thêm, sửa, xoá buổi lẻ (dạy bù/dạy thay).

**Blocked by:** S4-BE-01

**Status:** in-progress

**Đọc:** SPEC-004 mục *Class Session* (bản ghi đè, buổi lẻ), *API*; ADR BE 0004.

**Vùng sở hữu:** feature `class-session` (ghi đè, buổi lẻ), migration bản ghi Class Session (ghi đè + buổi lẻ, prep items); mở rộng phần đọc của S4-BE-01 để áp bản ghi đè và thêm buổi lẻ.

- [ ] `PATCH /class-sessions/:id` với buổi sinh từ slot: chỉ nhận `topic`, `prepItems` (≤ 100, id client sinh), `cancelled`; tạo/cập nhật bản ghi đè cho đúng (slot, ngày).
- [ ] Buổi đã huỷ vẫn được trả về với `cancelled = true`; `cancelled = false` khôi phục.
- [ ] `POST /class-sessions` tạo buổi lẻ (`timetableSlotId = null`) theo quy tắc tạo idempotent chung; không kiểm trùng với slot.
- [ ] Buổi lẻ `PATCH` được mọi trường, `DELETE` xoá mềm.
- [ ] `DELETE` buổi sinh từ slot → `400 cannot_delete_generated_session`.
- [ ] `GET /class-sessions` trả buổi sinh (đã áp ghi đè) + buổi lẻ trong khoảng.
- [ ] Unit + e2e cho các nhánh trên; gate xanh, dán output.
