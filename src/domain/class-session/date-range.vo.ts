import { ClassSessionValidationError } from './class-session.errors';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_CLASS_SESSION_DATE_RANGE_DAYS = 42;

export class ClassSessionDateRange {
  private constructor(
    private readonly _from: string,
    private readonly _to: string,
  ) {}

  public static create(from: string, to: string): ClassSessionDateRange {
    if (!from || typeof from !== 'string' || !DATE_REGEX.test(from)) {
      throw new ClassSessionValidationError('from must be in YYYY-MM-DD format');
    }

    if (!to || typeof to !== 'string' || !DATE_REGEX.test(to)) {
      throw new ClassSessionValidationError('to must be in YYYY-MM-DD format');
    }

    const [fromY, fromM, fromD] = from.split('-').map(Number);
    const fromDate = new Date(Date.UTC(fromY, fromM - 1, fromD));
    if (
      fromDate.getUTCFullYear() !== fromY ||
      fromDate.getUTCMonth() !== fromM - 1 ||
      fromDate.getUTCDate() !== fromD
    ) {
      throw new ClassSessionValidationError('from is not a valid calendar date');
    }

    const [toY, toM, toD] = to.split('-').map(Number);
    const toDate = new Date(Date.UTC(toY, toM - 1, toD));
    if (
      toDate.getUTCFullYear() !== toY ||
      toDate.getUTCMonth() !== toM - 1 ||
      toDate.getUTCDate() !== toD
    ) {
      throw new ClassSessionValidationError('to is not a valid calendar date');
    }

    if (fromDate.getTime() > toDate.getTime()) {
      throw new ClassSessionValidationError('from date cannot be after to date');
    }

    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays > MAX_CLASS_SESSION_DATE_RANGE_DAYS) {
      throw new ClassSessionValidationError(
        `Date range cannot exceed ${MAX_CLASS_SESSION_DATE_RANGE_DAYS} days`,
      );
    }

    return new ClassSessionDateRange(from, to);
  }

  get from(): string {
    return this._from;
  }

  get to(): string {
    return this._to;
  }
}
