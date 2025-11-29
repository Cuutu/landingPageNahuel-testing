import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

const Custom404: NextPage = () => {
  return (
    <>
      <Head>
        <title>404 - Página no encontrada | Nahuel Lozano</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        padding: '20px',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '4rem', margin: '0', color: '#3b82f6' }}>404</h1>
        <h2 style={{ fontSize: '1.5rem', margin: '1rem 0', color: '#333' }}>
          Página no encontrada
        </h2>
        <p style={{ color: '#666', marginBottom: '2rem', maxWidth: '500px' }}>
          Lo sentimos, la página que estás buscando no existe o ha sido movida.
        </p>
        <Link 
          href="/"
          style={{
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '5px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }}
        >
          Volver al inicio
        </Link>
      </div>
    </>
  );
};

export default Custom404;

