import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

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
        
        // ✅ NUEVO: Consultar rol desde la base de datos para admin@nahuellozano.com
        if (user.email === 'admin@nahuellozano.com') {
          try {
            await dbConnect();
            const dbUser = await User.findOne({ email: user.email }).lean() as any;
            if (dbUser && dbUser.role) {
              token.role = dbUser.role;
              if (isDev) {
                console.log('🔍 [JWT] Rol obtenido de BD para admin:', token.role);
              }
            } else {
              token.role = (user as any).role || 'admin';
            }
          } catch (error) {
            console.error('❌ [JWT] Error consultando BD para admin:', error);
            token.role = (user as any).role || 'admin';
          }
        } else {
          token.role = (user as any).role || 'admin';
        }
        
        token.suscripciones = [];
        token.lastRefresh = Date.now();
        
        if (isDev) {
          console.log('🔑 [JWT] Token creado para:', token.email, 'rol:', token.role);
        }
      } else if (token.email === 'admin@nahuellozano.com') {
        // ✅ NUEVO: Refrescar rol desde BD en cada request (cada 5 minutos por updateAge)
        const now = Date.now();
        const lastRefresh = (token.lastRefresh as number) || 0;
        const refreshInterval = 5 * 60 * 1000; // 5 minutos
        
        if (now - lastRefresh > refreshInterval) {
          try {
            await dbConnect();
            const dbUser = await User.findOne({ email: token.email }).lean() as any;
            if (dbUser && dbUser.role) {
              token.role = dbUser.role;
              token.lastRefresh = now;
              if (isDev) {
                console.log('🔄 [JWT] Rol refrescado desde BD:', token.role);
              }
            }
          } catch (error) {
            console.error('❌ [JWT] Error refrescando rol desde BD:', error);
          }
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      // Con Credentials + JWT, el servidor puede recibir session con user vacío; construir desde token
      if (token?.email) {
        const user = session?.user ?? ({} as any);
        session = session ?? ({} as any);
        session.user = {
          ...user,
          id: (token.id as string) ?? user.id,
          email: (token.email as string) ?? user.email,
          name: (token.name as string) ?? user.name,
          image: (token.picture as string) ?? user.image,
          role: (token.role as 'normal' | 'suscriptor' | 'admin') || 'admin',
          suscripciones: (token.suscripciones as any[]) ?? [],
        };
      } else if (session?.user && token) {
        session.user.id = token.id as string;
        session.user.role = (token.role as 'normal' | 'suscriptor' | 'admin') || 'admin';
        session.user.suscripciones = (token.suscripciones as any[]) || [];
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
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
  // En desarrollo (http) no usar cookie segura para que la sesión persista al navegar
  useSecureCookies: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,
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