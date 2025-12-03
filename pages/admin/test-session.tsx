import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

interface Props {
  serverSession: any;
  serverUser: any;
  serverError?: string;
}

export default function AdminTestSessionPage({ serverSession, serverUser, serverError }: Props) {
  const { data: clientSession, status } = useSession();

  return (
    <>
      <Head>
        <title>Test de Sesión - Admin Dashboard</title>
      </Head>

      <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
        <h1>🔍 Diagnóstico de Sesión Admin</h1>
        
        <div style={{ marginBottom: '2rem' }}>
          <h2>📊 Estado del Cliente (useSession)</h2>
          <p><strong>Status:</strong> {status}</p>
          <pre style={{ background: '#f5f5f5', padding: '1rem', overflow: 'auto' }}>
            {JSON.stringify(clientSession, null, 2)}
          </pre>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2>🔧 Estado del Servidor (getServerSession)</h2>
          {serverError && (
            <p style={{ color: 'red' }}><strong>Error:</strong> {serverError}</p>
          )}
          <pre style={{ background: '#f5f5f5', padding: '1rem', overflow: 'auto' }}>
            {JSON.stringify(serverSession, null, 2)}
          </pre>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2>👤 Usuario en Base de Datos</h2>
          <pre style={{ background: '#f5f5f5', padding: '1rem', overflow: 'auto' }}>
            {JSON.stringify(serverUser, null, 2)}
          </pre>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2>✅ Verificaciones</h2>
          <ul>
            <li>¿Hay sesión cliente? {clientSession ? '✅ Sí' : '❌ No'}</li>
            <li>¿Hay sesión servidor? {serverSession ? '✅ Sí' : '❌ No'}</li>
            <li>¿Email coincide? {clientSession?.user?.email === serverSession?.user?.email ? '✅ Sí' : '❌ No'}</li>
            <li>¿Usuario en BD? {serverUser ? '✅ Sí' : '❌ No'}</li>
            <li>¿Es admin? {serverUser?.role === 'admin' ? '✅ Sí' : '❌ No'}</li>
          </ul>
        </div>

        <div>
          <a href="/admin/dashboard" style={{ 
            background: '#007bff', 
            color: 'white', 
            padding: '0.5rem 1rem', 
            textDecoration: 'none',
            borderRadius: '4px'
          }}>
            🔙 Volver al Dashboard
          </a>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  let serverSession = null;
  let serverUser = null;
  let serverError = null;

  try {
    // console.log('🔍 Test Session - Iniciando verificación...');
    
    // Obtener sesión del servidor
    serverSession = await getServerSession(context.req, context.res, authOptions);
    // console.log('📋 Test Session - Sesión servidor:', !!serverSession);

    if (serverSession?.user?.email) {
      // console.log('📧 Test Session - Email:', serverSession.user.email);
      
      // Conectar a base de datos
      await connectDB();
      
      // Buscar usuario
      serverUser = await User.findOne({ email: serverSession.user.email }).lean() as any;
      // console.log('👤 Test Session - Usuario encontrado:', !!serverUser);
      // console.log('🔧 Test Session - Rol usuario:', serverUser?.role);
      
      // Convertir _id a string para evitar problemas de serialización
      if (serverUser) {
        serverUser = {
          ...serverUser,
          _id: serverUser._id.toString()
        };
      }
    }

  } catch (error) {
    console.error('💥 Test Session - Error:', error);
    serverError = (error as Error).message;
  }

  return {
    props: {
      serverSession: serverSession ? {
        user: {
          name: serverSession.user?.name || null,
          email: serverSession.user?.email || null,
          image: serverSession.user?.image || null,
        }
      } : null,
      serverUser: serverUser || null,
      serverError: serverError || null
    },
  };
}; 