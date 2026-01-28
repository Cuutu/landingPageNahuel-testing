import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// ✅ CREDENCIALES HARDCODEADAS PARA LOGIN
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'tortu123';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        const isDev = process.env.NODE_ENV === 'development';
        
        if (isDev) {
          console.log('🔐 [AUTH] Intentando login con usuario:', credentials?.username);
        }
        
        // Verificar credenciales hardcodeadas
        if (credentials?.username === ADMIN_USERNAME && credentials?.password === ADMIN_PASSWORD) {
          if (isDev) {
            console.log('✅ [AUTH] Login exitoso para:', credentials.username);
          }
          
          // Retornar usuario admin
          return {
            id: 'admin-user-id',
            name: 'Administrador',
            email: 'admin@nahuellozano.com',
            role: 'admin',
          };
        }
        
        if (isDev) {
          console.log('❌ [AUTH] Credenciales inválidas');
        }
        
        // Si las credenciales no son válidas, retornar null
        return null;
      }
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    signOut: '/',
  },
  debug: process.env.NODE_ENV === 'development',
  callbacks: {
    async jwt({ token, user }) {
      const isDev = process.env.NODE_ENV === 'development';
      
      // Si hay un user (primer login), guardar sus datos en el token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as any).role || 'admin';
        token.suscripciones = [];
        token.lastRefresh = Date.now();
        
        if (isDev) {
          console.log('🔑 [JWT] Token creado para:', token.email, 'rol:', token.role);
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      // Validación de la sesión
      if (!session || !session.user) {
        return session;
      }

      if (token) {
        if (token.id) {
          session.user.id = token.id as string;
        }
        
        session.user.role = (token.role as 'normal' | 'suscriptor' | 'admin') || 'admin';
        session.user.suscripciones = (token.suscripciones as any[]) || [];
        
        if (token.name) {
          session.user.name = token.name as string;
        }
        if (token.email) {
          session.user.email = token.email as string;
        }
      }
      
      return session;
    }
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
    updateAge: 300,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Tipos extendidos para NextAuth
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: 'normal' | 'suscriptor' | 'admin';
      suscripciones: Array<{
        servicio: 'TraderCall' | 'SmartMoney' | 'CashFlow';
        fechaInicio: Date;
        fechaVencimiento: Date;
        activa: boolean;
      }>;
    };
  }
  
  interface User {
    role?: 'normal' | 'suscriptor' | 'admin';
  }
  
  interface JWT {
    role?: 'normal' | 'suscriptor' | 'admin';
    id?: string;
    suscripciones?: any[];
    picture?: string;
    name?: string;
    lastRefresh?: number;
  }
} 