export interface InspirationDto {
  id: string;
  quote: {
    vi: string;
    en: string;
  };
  quoteVi: string;
  quoteEn: string;
  author: string | null;
}
