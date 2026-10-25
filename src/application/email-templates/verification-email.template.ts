export function resolveLanguage(acceptLanguage?: string): 'vi' | 'en' {
  if (!acceptLanguage) {
    return 'vi';
  }
  const primary = acceptLanguage.toLowerCase().split(',')[0].trim();
  if (primary.startsWith('en')) {
    return 'en';
  }
  return 'vi';
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildEmailVerificationEmail(code: string, lang: 'vi' | 'en'): EmailContent {
  if (lang === 'en') {
    return {
      subject: `[CuteTeachy] Your verification code: ${code}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b;">Welcome to CuteTeachy!</h2>
          <p>Your email verification code is:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb; margin: 24px 0;">${code}</p>
          <p>This code expires in <strong>10 minutes</strong>. Do not share this code with anyone.</p>
          <p style="color: #64748b; font-size: 14px; margin-top: 32px;">If you did not request this email, please safely ignore it.</p>
        </div>
      `,
      text: `Welcome to CuteTeachy! Your email verification code is: ${code}. This code expires in 10 minutes.`,
    };
  }

  return {
    subject: `[CuteTeachy] Mã xác minh email của bạn: ${code}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">Chào mừng bạn đến với CuteTeachy!</h2>
        <p>Mã xác minh email của bạn là:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb; margin: 24px 0;">${code}</p>
        <p>Mã này có hiệu lực trong vòng <strong>10 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        <p style="color: #64748b; font-size: 14px; margin-top: 32px;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
      </div>
    `,
    text: `Chào mừng bạn đến với CuteTeachy! Mã xác minh email của bạn là: ${code}. Mã có hiệu lực trong vòng 10 phút.`,
  };
}

export function buildPasswordResetEmail(code: string, lang: 'vi' | 'en'): EmailContent {
  if (lang === 'en') {
    return {
      subject: `[CuteTeachy] Password reset code: ${code}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b;">CuteTeachy Password Reset</h2>
          <p>You have requested to reset your password. Your reset code is:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #dc2626; margin: 24px 0;">${code}</p>
          <p>This code expires in <strong>10 minutes</strong>. Do not share this code with anyone.</p>
          <p style="color: #64748b; font-size: 14px; margin-top: 32px;">If you did not request a password reset, your account is safe and you can safely ignore this email.</p>
        </div>
      `,
      text: `CuteTeachy Password Reset. Your reset code is: ${code}. This code expires in 10 minutes.`,
    };
  }

  return {
    subject: `[CuteTeachy] Mã đặt lại mật khẩu: ${code}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">Đặt lại mật khẩu CuteTeachy</h2>
        <p>Bạn đã yêu cầu đặt lại mật khẩu. Mã xác nhận của bạn là:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #dc2626; margin: 24px 0;">${code}</p>
        <p>Mã này có hiệu lực trong vòng <strong>10 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        <p style="color: #64748b; font-size: 14px; margin-top: 32px;">Nếu bạn không yêu cầu đặt lại mật khẩu, tài khoản của bạn vẫn an toàn và bạn có thể bỏ qua email này.</p>
      </div>
    `,
    text: `Đặt lại mật khẩu CuteTeachy. Mã xác nhận của bạn là: ${code}. Mã có hiệu lực trong vòng 10 phút.`,
  };
}
