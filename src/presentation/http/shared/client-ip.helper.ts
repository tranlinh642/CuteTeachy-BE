import { Request } from 'express';
import { isIP } from 'net';

export function getClientIp(req: Request): string {
  const trustProxyEnabled =
    typeof req.app?.get === 'function' && Boolean(req.app.get('trust proxy'));

  if (trustProxyEnabled && req.ip && isIP(req.ip)) {
    return req.ip;
  }

  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const candidate = forwarded.split(',')[0].trim();
    if (isIP(candidate)) {
      return candidate;
    }
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    const candidate = String(forwarded[0]).split(',')[0].trim();
    if (isIP(candidate)) {
      return candidate;
    }
  }

  if (req.ip && isIP(req.ip)) {
    return req.ip;
  }

  const remoteAddress = req.socket?.remoteAddress;
  if (remoteAddress && isIP(remoteAddress)) {
    return remoteAddress;
  }

  return '127.0.0.1';
}
