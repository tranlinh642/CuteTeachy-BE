# Refactoring

Refactor = đổi cấu trúc, giữ nguyên hành vi. Mỗi refactor phải chứng minh được cả hai vế: cấu trúc mới đúng kiến trúc, và hành vi cũ không đổi.

## Điều kiện tiên quyết

- BE là git repo và đã được GitNexus index (skill `gitnexus-cli`). Index báo stale → analyze lại trước khi tin kết quả.
- Test của vùng sắp chạm đang xanh. Vùng chưa có test → viết characterization test trước.

## Quy trình

1. **Bind repo:** `list_repos` của GitNexus, xác nhận đúng repo `CuteTeachy-BE`.
2. **Đo blast radius:** skill `gitnexus-impact-analysis` — `impact` upstream cho symbol sắp đổi, `context` để xem mọi ref vào/ra.
3. **Lên thứ tự sửa:** port/interface → adapter/implementation → caller → test → composition.
4. **Thực hiện theo loại** (skill `gitnexus-refactoring`):
   - Rename: `rename` với `dry_run: true`, đọc preview, rồi mới `dry_run: false`.
   - Extract / split / move: theo checklist tương ứng trong skill.
5. **Xác minh phạm vi:** `detect_changes` — chỉ các file dự kiến bị đổi. Kết quả `partial` hoặc `truncated` → chạy lại, chưa được coi là đã xác minh.
6. **Xác minh hành vi:** type-check + lint (`no-restricted-imports`) + test xanh. Báo cáo kèm output lệnh thật.

## Mỗi commit một bước

- Một commit = một loại thay đổi (move, rename, extract, đổi hành vi). Đổi cấu trúc và đổi hành vi nằm ở hai commit khác nhau.
- Message dạng `refactor(task): move due-date rule into Task entity`.

## Hướng refactor ưu tiên trong dự án

1. Đưa rule nghiệp vụ từ controller/use case vào entity/value object.
2. Gom các method repository tổng quát thành method theo nhu cầu use case.
3. Thay `new Adapter()` trong code bằng port + binding ở composition.
4. Xoá port/abstraction chỉ có một adapter và không phải ranh giới IO.

Danh sách dấu hiệu chi tiết: [`design-patterns.md`](design-patterns.md#dấu-hiệu-cần-refactor). Tìm ứng viên refactor lớn: skill `improve-codebase-architecture`; thiết kế interface mới cho ứng viên đã chọn: skill `codebase-design`.

## Review sau refactor

Chạy skill `code-review` trên diff, hoặc `gitnexus-review` khi cần đánh giá rủi ro merge dựa trên graph.
