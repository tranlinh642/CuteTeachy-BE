export interface InspirationDto {
  id: string;
  quote: {
    vi: string;
    en: string;
  };
  author: string | null;
}
