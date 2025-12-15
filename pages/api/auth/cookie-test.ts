import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Endpoint de diagnóstico para verificar si las cookies funcionan en el navegador
 * GET /api/auth/cookie-test - Establece una cookie de prueba
 * GET /api/auth/cookie-test?check=1 - Verifica si la cookie fue guardada
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const isCheck = req.query.check === '1';
  const testCookieName = 'test-cookie-auth';
  
  if (isCheck) {
    // Verificar si la cookie existe
    const testCookie = req.cookies[testCookieName];
    const allCookies = Object.keys(req.cookies);
    
    return res.status(200).json({
      success: !!testCookie,
      message: testCookie 
        ? '✅ Las cookies funcionan correctamente en este navegador' 
        : '❌ Las cookies NO están funcionando. El navegador las está bloqueando.',
      testCookieValue: testCookie || null,
      allCookiesReceived: allCookies,
      nextAuthCookies: allCookies.filter(c => c.includes('next-auth')),
      diagnosis: !testCookie ? [
        '1. Verificá que las cookies no estén bloqueadas en la configuración del navegador',
        '2. Desactivá extensiones de privacidad (uBlock, Privacy Badger, etc.)',
        '3. Si estás en modo incógnito, habilitá cookies para este sitio',
        '4. Probá agregando lozanonahuel.com a las excepciones de cookies'
      ] : [
        'El navegador acepta cookies correctamente.',
        'Si el login no funciona, el problema puede ser otro (verificá la consola del navegador).'
      ],
      timestamp: new Date().toISOString()
    });
  }
  
  // Establecer cookie de prueba
  res.setHeader('Set-Cookie', [
    `${testCookieName}=test-value-${Date.now()}; Path=/; SameSite=Lax; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}Max-Age=60`
  ]);
  
  return res.status(200).json({
    message: '🍪 Cookie de prueba establecida. Ahora visitá /api/auth/cookie-test?check=1 para verificar si se guardó.',
    nextStep: `${req.headers.host}/api/auth/cookie-test?check=1`,
    instructions: [
      '1. Esta página estableció una cookie de prueba',
      '2. Hacé clic en el link o visitá la URL con ?check=1',
      '3. Si ves "✅ Las cookies funcionan", el navegador las acepta',
      '4. Si ves "❌", las cookies están bloqueadas y por eso el login no funciona'
    ]
  });
}

