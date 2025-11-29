import { NextPageContext } from 'next';

interface ErrorProps {
  statusCode: number;
  hasGetInitialPropsRun: boolean;
  err?: Error;
}

function Error({ statusCode, hasGetInitialPropsRun, err }: ErrorProps) {
  console.error('🚨 Error page rendered:', { statusCode, hasGetInitialPropsRun, err });
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1>
        {statusCode
          ? `Error ${statusCode} - Algo salió mal`
          : 'Error del cliente'}
      </h1>
      <p>
        {statusCode === 404
          ? 'Esta página no se pudo encontrar.'
          : 'Ocurrió un error en el servidor. Intenta recargar la página.'}
      </p>
      {process.env.NODE_ENV === 'development' && err && (
        <details style={{ marginTop: '20px', width: '100%', maxWidth: '600px' }}>
          <summary>Detalles del error (solo en desarrollo)</summary>
          <pre style={{ 
            background: '#f5f5f5', 
            padding: '10px', 
            overflow: 'auto',
            fontSize: '12px'
          }}>
            {err.stack}
          </pre>
        </details>
      )}
      <button 
        onClick={() => window.location.reload()} 
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Recargar página
      </button>
    </div>
  );
}

Error.getInitialProps = ({ res, err, req }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode ?? 500 : 404;
  
  // Lista de rutas sospechosas que no deberían loguearse (bots/scanners)
  const suspiciousPaths = [
    '/.env',
    '/.env.local',
    '/.env.development',
    '/.env.production',
    '/.env.bak',
    '/.env.example',
    '/config',
    '/config.json',
    '/config.js',
    '/config.yml',
    '/config.yaml',
    '/config.ini',
    '/settings',
    '/settings.json',
    '/app.config.js',
    '/configuration',
    '/sitemap_index.xml',
    '/.git/config',
    '/env',
    '/env.json',
    '/env.yml',
    '/env.yaml',
  ];
  
  // Obtener la ruta actual si está disponible
  let currentPath = '';
  try {
    if (req?.url) {
      // req.url puede ser una ruta relativa o absoluta
      const url = req.url.startsWith('http') ? req.url : `http://localhost${req.url}`;
      currentPath = new URL(url).pathname;
    }
  } catch (e) {
    // Si hay error parseando la URL, ignorar
  }
  
  const isSuspiciousPath = suspiciousPaths.some(path => 
    currentPath === path || currentPath.startsWith(path)
  );
  
  // Solo loguear errores que no sean rutas sospechosas o que sean errores del servidor (500+)
  if (!isSuspiciousPath || statusCode >= 500) {
    console.error('🚨 Error getInitialProps:', { statusCode, err: err?.message, path: currentPath });
  }
  
  return { statusCode, hasGetInitialPropsRun: true, err };
};

export default Error; 