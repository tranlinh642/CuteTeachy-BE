import { InspirationValidationError } from './inspiration.errors';

export interface InspirationProps {
  id: string;
  quoteVi: string;
  quoteEn: string;
  author: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInspirationProps {
  id: string;
  quoteVi: string;
  quoteEn: string;
  author?: string | null;
  now: Date;
}

export interface ReconstituteInspirationProps {
  id: string;
  quoteVi: string;
  quoteEn: string;
  author: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Inspiration {
  private constructor(private readonly props: InspirationProps) {}

  public static create(props: CreateInspirationProps): Inspiration {
    if (!props.id || typeof props.id !== 'string' || !props.id.trim()) {
      throw new InspirationValidationError('id is required');
    }
    if (!props.quoteVi || typeof props.quoteVi !== 'string' || !props.quoteVi.trim()) {
      throw new InspirationValidationError('quoteVi is required');
    }
    if (!props.quoteEn || typeof props.quoteEn !== 'string' || !props.quoteEn.trim()) {
      throw new InspirationValidationError('quoteEn is required');
    }
    if (!props.now || !(props.now instanceof Date) || isNaN(props.now.getTime())) {
      throw new InspirationValidationError('now is required and must be a valid Date');
    }

    const now = props.now;

    return new Inspiration({
      id: props.id.trim(),
      quoteVi: props.quoteVi.trim(),
      quoteEn: props.quoteEn.trim(),
      author: props.author ? props.author.trim() : null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: ReconstituteInspirationProps): Inspiration {
    return new Inspiration({ ...props });
  }

  public update(
    props: {
      quoteVi?: string;
      quoteEn?: string;
      author?: string | null;
    },
    now: Date,
  ): void {
    if (!now || !(now instanceof Date) || isNaN(now.getTime())) {
      throw new InspirationValidationError('now is required and must be a valid Date');
    }
    if (props.quoteVi !== undefined) {
      if (!props.quoteVi || typeof props.quoteVi !== 'string' || !props.quoteVi.trim()) {
        throw new InspirationValidationError('quoteVi is required');
      }
      this.props.quoteVi = props.quoteVi.trim();
    }
    if (props.quoteEn !== undefined) {
      if (!props.quoteEn || typeof props.quoteEn !== 'string' || !props.quoteEn.trim()) {
        throw new InspirationValidationError('quoteEn is required');
      }
      this.props.quoteEn = props.quoteEn.trim();
    }
    if (props.author !== undefined) {
      this.props.author = props.author ? props.author.trim() : null;
    }
    this.props.updatedAt = now;
  }

  get id(): string {
    return this.props.id;
  }

  get quoteVi(): string {
    return this.props.quoteVi;
  }

  get quoteEn(): string {
    return this.props.quoteEn;
  }

  get quote(): { vi: string; en: string } {
    return {
      vi: this.props.quoteVi,
      en: this.props.quoteEn,
    };
  }

  get author(): string | null {
    return this.props.author;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
