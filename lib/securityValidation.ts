import { NextApiRequest } from 'next';

/**
 * 🔒 SEGURIDAD: Módulo de validación de seguridad para endpoints críticos
 */

/**
 * Valida que el Origin/Referer de la request sea del dominio permitido
 * Previene CSRF desde dominios externos
 */
export function validateOrigin(req: NextApiRequest): { valid: boolean; error?: string } {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  
  // En desarrollo, permitir localhost
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Dominios permitidos
  const allowedOrigins = [
    process.env.NEXTAUTH_URL,
    'https://lozanonahuel.com',
    'https://www.lozanonahuel.com',
    ...(isDevelopment ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : [])
  ].filter(Boolean) as string[];

  // Verificar Origin header
  if (origin) {
    const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed));
    if (!isAllowed) {
      console.warn('🔒 [SECURITY] Origin rechazado:', origin);
      return { valid: false, error: 'Origin no permitido' };
    }
    return { valid: true };
  }

  // Si no hay Origin, verificar Referer
  if (referer) {
    const isAllowed = allowedOrigins.some(allowed => referer.startsWith(allowed));
    if (!isAllowed) {
      console.warn('🔒 [SECURITY] Referer rechazado:', referer);
      return { valid: false, error: 'Referer no permitido' };
    }
    return { valid: true };
  }

  // Si no hay Origin ni Referer, podría ser una request directa (Postman, cURL, etc.)
  // En producción, rechazar requests sin Origin/Referer para endpoints sensibles
  if (!isDevelopment) {
    // Permitir webhooks de MercadoPago que vienen sin Origin
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.includes('MercadoPago') || userAgent.includes('MercadoLibre')) {
      return { valid: true };
    }
    
    // Para otros casos sin Origin/Referer en producción, es sospechoso
    console.warn('🔒 [SECURITY] Request sin Origin/Referer en producción');
    return { valid: false, error: 'Request sin origen identificable' };
  }

  return { valid: true };
}

/**
 * Middleware para validar Origin en endpoints críticos
 * Uso: if (!validateOriginMiddleware(req, res)) return;
 */
export function validateOriginMiddleware(
  req: NextApiRequest, 
  res: any
): boolean {
  const validation = validateOrigin(req);
  
  if (!validation.valid) {
    res.status(403).json({ 
      error: 'Acceso denegado', 
      message: validation.error 
    });
    return false;
  }
  
  return true;
}

/**
 * Verifica que el Content-Type sea JSON para prevenir requests de formularios externos
 */
export function validateJsonContentType(req: NextApiRequest): boolean {
  const contentType = req.headers['content-type'] || '';
  return contentType.includes('application/json');
}

/**
 * Log seguro que no expone datos sensibles
 */
export function secureLog(message: string, data: Record<string, any>): void {
  // Lista de campos que nunca deben loguearse
  const sensitiveFields = [
    'password', 'token', 'accessToken', 'access_token', 
    'refreshToken', 'refresh_token', 'secret', 'apiKey',
    'creditCard', 'cvv', 'cardNumber'
  ];

  const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      acc[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 100) {
      // Truncar strings muy largos que podrían contener tokens
      acc[key] = value.substring(0, 50) + '...[truncated]';
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);

  console.log(message, sanitizedData);
}
