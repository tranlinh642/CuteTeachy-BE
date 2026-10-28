import { HttpStatus } from '@nestjs/common';

export const DOMAIN_ERROR_STATUS_MAP: Record<string, HttpStatus> = {
  validation: HttpStatus.BAD_REQUEST, // 400
  cannot_delete_generated_session: HttpStatus.BAD_REQUEST, // 400
  invalid_code: HttpStatus.UNAUTHORIZED, // 401
  invalid_credentials: HttpStatus.UNAUTHORIZED, // 401
  unauthorized: HttpStatus.UNAUTHORIZED, // 401
  forbidden: HttpStatus.FORBIDDEN, // 403
  onboarding_required: HttpStatus.FORBIDDEN, // 403
  email_not_verified: HttpStatus.FORBIDDEN, // 403
  not_found: HttpStatus.NOT_FOUND, // 404
  email_taken: HttpStatus.CONFLICT, // 409
  conflict: HttpStatus.CONFLICT, // 409
  id_conflict: HttpStatus.CONFLICT, // 409
  tag_name_taken: HttpStatus.CONFLICT, // 409
  timetable_conflict: HttpStatus.CONFLICT, // 409
  gone: HttpStatus.GONE, // 410
  file_too_large: HttpStatus.PAYLOAD_TOO_LARGE, // 413
  unsupported_file_type: HttpStatus.UNSUPPORTED_MEDIA_TYPE, // 415
  rate_limited: HttpStatus.TOO_MANY_REQUESTS, // 429
  service_unavailable: HttpStatus.SERVICE_UNAVAILABLE, // 503
};

export function getStatusForDomainError(code: string): HttpStatus {
  return DOMAIN_ERROR_STATUS_MAP[code] ?? HttpStatus.BAD_REQUEST;
}
