import { Request } from 'express';
import { isIP } from 'net';

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed === '::1') {
    return '127.0.0.1';
  }
  if (trimmed.toLowerCase().startsWith('::ffff:')) {
    const mappedV4 = trimmed.slice(7);
    if (isIP(mappedV4) === 4) {
      return mappedV4;
    }
  }
  return trimmed;
}

export function getClientIp(req: Request): string {
  const trustProxyEnabled =
    typeof req.app?.get === 'function' && Boolean(req.app.get('trust proxy'));

  if (trustProxyEnabled && req.ip && isIP(req.ip)) {
    return normalizeIp(req.ip);
  }

  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const candidate = forwarded.split(',')[0].trim();
    if (isIP(candidate)) {
      return normalizeIp(candidate);
    }
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    const candidate = String(forwarded[0]).split(',')[0].trim();
    if (isIP(candidate)) {
      return normalizeIp(candidate);
    }
  }

  if (req.ip && isIP(req.ip)) {
    return normalizeIp(req.ip);
  }

  const remoteAddress = req.socket?.remoteAddress;
  if (remoteAddress && isIP(remoteAddress)) {
    return normalizeIp(remoteAddress);
  }

  return '127.0.0.1';
}
