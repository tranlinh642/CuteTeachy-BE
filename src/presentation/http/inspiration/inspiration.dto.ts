export interface InspirationResponseDto {
  id: string;
  quote: {
    vi: string;
    en: string;
  };
  author?: string | null;
}
