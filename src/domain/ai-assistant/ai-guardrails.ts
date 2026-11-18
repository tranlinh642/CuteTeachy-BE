const INJECTION_PATTERNS: readonly RegExp[] = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|above|system)\s+instructions?\b/i,
  /\b(?:forget|disregard|override)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions?|rules?|prompts?)\b/i,
  /\bsystem\s+prompt\b/i,
  /\bbypass\s+(?:auth|authorization|permission|security|guardrails?|quyền|bảo\s+mật)\b/i,
  /\bswitch\s+account\b/i,
  /bỏ\s+qua\s+(?:mọi|tất\s+cả|các)?\s*(?:hướng\s+dẫn|quy\s+tắc|chỉ\s+dẫn|lệnh)\s*(?:trước|hệ\s+thống|trên)?/i,
  /(?:đóng\s+vai|act\s+as|pretend\s+to\s+be)\s+(?:admin|administrator|quản\s+trị|root|system)/i,
  /đổi\s+(?:sang\s+)?tài\s+khoản\s+khác/i,
];

const CROSS_ACCOUNT_PATTERNS: readonly RegExp[] = [
  // Vietnamese explicit other-user/account queries
  /(?:lịch|thời\s+khóa\s+biểu|tkb|công\s+việc|task|ghi\s+chú|note|dữ\s+liệu|tiết\s+dạy|hồ\s+sơ|tài\s+khoản)\s+(?:của|thuộc)\s+(?:người\s+khác|người\s+dùng\s+khác|tài\s+khoản\s+khác|giáo\s+viên\s+khác|bạn\s+khác|ai\s+đó|user\s*[a-z0-9_-]+|account\s*[a-z0-9_-]+)/i,
  /(?:xem|tra|kiểm\s+tra|lấy|đọc|cho\s+biết|liệt\s+kê)\s+(?:lịch|thời\s+khóa\s+biểu|tkb|công\s+việc|ghi\s+chú|dữ\s+liệu)\s+(?:của|từ)\s+(?:user|account|tài\s+khoản|người\s+dùng|giáo\s+viên)\s+(?!tôi\b|mình\b|em\b|hiện\s+tại\b)[a-z0-9_.@-]+/i,
  /\b(?:user|account)\s*[a-z0-9_-]*\s+(?:lịch|thời\s+khóa\s+biểu|tkb|dữ\s+liệu|schedule|timetable)/i,
  // English explicit other-user/account queries
  /\b(?:schedule|timetable|calendar|class\s+sessions?|tasks?|notes?|data|profile)\s+(?:of|for|from)\s+(?:another|other)\s+(?:user|account|teacher|educator)\b/i,
  /\b(?:schedule|timetable|calendar|class\s+sessions?|tasks?|notes?|data)\s+(?:of|for|from)\s+(?:user|account)\s*[a-z0-9_-]+\b/i,
  /\bother\s+(?:user|account|teacher)(?:'s)?\s+(?:schedule|timetable|tasks?|notes?|data)\b/i,
  // Email address referenced in a schedule/data query
  /(?:lịch|thời\s+khóa\s+biểu|tkb|công\s+việc|ghi\s+chú|dữ\s+liệu|schedule|timetable|tasks?|notes?|data).*?[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}.*?(?:lịch|thời\s+khóa\s+biểu|tkb|công\s+việc|ghi\s+chú|dữ\s+liệu|schedule|timetable|tasks?|notes?|data)/i,
];


export function detectCrossAccountOrInjectionAttempt(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) {
    return false;
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  for (const pattern of CROSS_ACCOUNT_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  return false;
}

export function buildCrossAccountRefusalReply(locale: string): string {
  if (locale === 'en') {
    return 'For security and authorization reasons, I am only permitted to access the timetable, class sessions, tasks, and notes of your own current account. I cannot view or access data belonging to any other teacher or account.';
  }
  return 'Vì lý do bảo mật và phân quyền, tôi chỉ được phép truy cập dữ liệu thời khóa biểu, buổi dạy, công việc và ghi chú của riêng tài khoản hiện tại của thầy/cô. Tôi không có quyền xem hay truy xuất dữ liệu của bất kỳ giáo viên hoặc tài khoản nào khác.';
}
