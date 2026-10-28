import { SetMetadata } from '@nestjs/common';

export const IS_EXEMPT_ONBOARDING_KEY = 'isExemptOnboarding';
export const ExemptOnboarding = () => SetMetadata(IS_EXEMPT_ONBOARDING_KEY, true);
