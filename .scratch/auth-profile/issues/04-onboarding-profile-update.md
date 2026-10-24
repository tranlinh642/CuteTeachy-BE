# BE-04: Onboarding — cập nhật Profile và chặn API nghiệp vụ khi chưa hoàn tất

**What to build:** Giáo viên vừa đăng ký hoặc đăng nhập lần đầu cập nhật Profile; khi đủ `fullName`, `displayName`, `gender` thì Onboarding được đánh dấu hoàn tất. Trước đó, mọi API nghiệp vụ trả `403 onboarding_required`.

**Blocked by:** BE-03

**Status:** ready-for-agent

**Đọc:** SPEC-002 mục *Onboarding*, *API Contract* (`PATCH /auth/profile`); `GLOSSARY.md` (Onboarding, Profile); FE `docs/specs/SPEC-001-…` (validation Profile).

**Vùng sở hữu:** feature `profile` (use case cập nhật Profile, rule hoàn tất Onboarding), onboarding guard + decorator miễn trừ. Không sửa phần avatar (BE-06).

- [ ] Rule hoàn tất Onboarding nằm trong domain Profile, có unit test cho: thiếu từng trường bắt buộc, đủ trường lần đầu, đã hoàn tất rồi thì không đổi `onboardingCompletedAt`.
- [ ] `PATCH /auth/profile` cập nhật từng phần; `title` rỗng hoặc `null` → xoá; validation đúng SPEC-001 → sai thì `400 validation`; trả `User`.
- [ ] Onboarding guard áp dụng mặc định cho mọi route không thuộc `/auth/*`; chưa hoàn tất → `403 onboarding_required`.
- [ ] Vì chưa có API nghiệp vụ thật, e2e chứng minh guard bằng một route chỉ đăng ký trong test module: trước Onboarding 403, sau Onboarding 200.
- [ ] e2e: đăng ký → `PATCH` thiếu `gender` → vẫn chưa hoàn tất → `PATCH` đủ → `onboardingCompletedAt` có giá trị trong `/auth/me`.
