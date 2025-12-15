import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import dbConnect from './mongodb';
import User from '@/models/User';
import EmailList from '@/models/EmailList';

export const authOptions: NextAuthOptions = {
  // ❌ DESHABILITAMOS el adapter para evitar conflictos con nuestro sistema personalizado
  // adapter: MongoDBAdapter(getMongoClient()),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'select_account',
          response_type: 'code'
        },
      },
    }),
  ],
  pages: {
    // ✅ HABILITADO: Usar página personalizada que maneja mejor cookies bloqueadas
    // y muestra instrucciones claras para navegadores como Brave
    signIn: '/auth/signin',
    error: '/auth/error',
    signOut: '/',
  },
  debug: process.env.NODE_ENV === 'development',
  callbacks: {
    async signIn({ user, account, profile }) {
      // Solo loguear en desarrollo para evitar lentitud en producción
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        console.log('🔐 [SIGNIN] Iniciando sesión:', user.email);
        console.log('🔐 [SIGNIN] NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
        console.log('🔐 [SIGNIN] Account provider:', account?.provider);
      }
      
      try {
        await dbConnect();
        
        // Buscar usuario existente en nuestra colección personalizada
        let existingUser = await User.findOne({ email: user.email });
        
        const userImageUrl = user.image || (profile as any)?.picture;
        
        if (!existingUser) {
          if (isDev) console.log('👤 [SIGNIN] Creando nuevo usuario:', user.email);
          existingUser = await User.create({
            googleId: account?.providerAccountId,
            name: user.name,
            email: user.email,
            picture: userImageUrl,
            role: 'normal',
            tarjetas: [],
            compras: [],
            suscripciones: [],
            lastLogin: new Date(),
          });

          // Agregar email a la lista de envío masivo
          try {
            await (EmailList as any).addEmailIfNotExists(user.email, 'registration');
          } catch (emailError) {
            // No fallar el registro si no se puede agregar a la lista
          }
        } else {
          if (isDev) console.log('👤 [SIGNIN] Actualizando usuario existente:', user.email);
          await User.findByIdAndUpdate(existingUser._id, {
            name: user.name,
            picture: userImageUrl,
            googleId: account?.providerAccountId,
            lastLogin: new Date(),
          });

          // Asegurar que el email esté en la lista de envío masivo
          try {
            await (EmailList as any).addEmailIfNotExists(user.email, 'registration');
          } catch (emailError) {
            // No fallar el login si no se puede verificar en la lista
          }
        }
        
        if (isDev) console.log('✅ [SIGNIN] Usuario procesado correctamente, rol:', existingUser.role);
        return true;
      } catch (error) {
        console.error('❌ [SIGNIN] Error en signIn callback:', error);
        // Permitir login aunque haya error para evitar crashes
        return true;
      }
    },
    async jwt({ token, account, user, trigger }) {
      const isDev = process.env.NODE_ENV === 'development';
      
      // ✅ CORREGIDO: Validar que el token tenga email antes de procesar
      if (!token.email) {
        // Si hay un user object (signIn inicial), usar su email
        if (user?.email) {
          token.email = user.email;
        } else {
          if (isDev) console.warn('⚠️ [JWT] Token sin email, saltando callback');
          return token;
        }
      }
      
      // ✅ CRÍTICO: SIEMPRE cargar de BD para asegurar que los datos estén actualizados
      // Esto es especialmente importante para roles y suscripciones que pueden cambiar
      if (isDev) {
        console.log('🔑 [JWT] Cargando datos desde BD, trigger:', trigger, 'email:', token.email);
      }
      
      try {
        await dbConnect();
        const dbUser = await User.findOne({ email: token.email }).lean() as any;
        
        if (dbUser && !Array.isArray(dbUser)) {
          // ✅ CRÍTICO: Siempre actualizar con datos de BD para asegurar consistencia
          token.role = dbUser.role || 'normal';
          token.id = dbUser._id.toString();
          token.suscripciones = dbUser.suscripciones || [];
          token.picture = dbUser.picture || token.picture || user?.image;
          token.name = dbUser.name || token.name || user?.name;
          
          // ✅ MEJORADO: Agregar timestamp para tracking
          token.lastRefresh = Date.now();
          
          if (isDev) {
            console.log('✅ [JWT] Datos cargados desde BD:', {
              email: token.email,
              role: token.role,
              id: token.id,
              suscripciones: Array.isArray(token.suscripciones) ? token.suscripciones.length : 0
            });
          }
        } else {
          // Usuario no encontrado en BD - establecer valores por defecto
          if (isDev) console.warn('⚠️ [JWT] Usuario no encontrado en BD:', token.email);
          token.role = 'normal';
          token.suscripciones = [];
          if (!token.id && user?.id) {
            token.id = user.id;
          }
        }
      } catch (error) {
        console.error('❌ [JWT] Error cargando usuario:', error);
        // ✅ CORREGIDO: En caso de error, mantener valores existentes o usar defaults
        if (!token.role) {
          token.role = 'normal';
        }
        if (!token.suscripciones) {
          token.suscripciones = [];
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      // ✅ CORREGIDO: Validación más robusta de la sesión
      if (!session || !session.user) {
        return session;
      }

      if (token) {
        // ✅ CORREGIDO: Siempre usar valores del token (que vienen de BD en signIn/update)
        // Asegurar que siempre haya valores válidos
        if (token.id) {
          session.user.id = token.id as string;
        }
        
        if (token.role) {
          session.user.role = token.role as 'normal' | 'suscriptor' | 'admin';
        } else {
          // Si no hay rol en el token, usar 'normal' como default
          session.user.role = 'normal';
        }
        
        if (token.suscripciones) {
          session.user.suscripciones = token.suscripciones as any[];
        } else {
          session.user.suscripciones = [];
        }
        
        // Actualizar imagen y nombre si están disponibles en el token
        if (token.picture) {
          session.user.image = token.picture as string;
        }
        if (token.name) {
          session.user.name = token.name as string;
        }
        
        // ✅ CORREGIDO: Si falta información crítica después de asignar valores,
        // puede indicar un problema - loguear en desarrollo
        if (process.env.NODE_ENV === 'development') {
          if (!session.user.id || !session.user.role) {
            console.warn('⚠️ [SESSION] Información crítica faltante después de asignar valores:', {
              hasId: !!session.user.id,
              hasRole: !!session.user.role,
              role: session.user.role,
              email: session.user.email
            });
          }
        }
      }
      
      return session;
    }
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
    updateAge: 0, // ✅ CRÍTICO: Actualizar en cada request para asegurar datos frescos de BD
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      // ✅ CORREGIDO: Usar nombres simples sin prefijos problemáticos para mejor compatibilidad
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        // ✅ MEJORADO: 'lax' para compatibilidad con navegadores estrictos
        // 'lax' permite cookies en navegación top-level (redirecciones OAuth)
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // ✅ MEJORADO: No especificar dominio para que funcione en todos los subdominios de Vercel
        // Esto evita problemas cuando se accede desde .vercel.app o dominio personalizado
        domain: undefined
      }
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: {
        // ✅ CRÍTICO: callbackUrl NO debe ser httpOnly para que JavaScript pueda leerla
        httpOnly: false,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: undefined
      }
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: undefined
      }
    }
  },
  // Eventos de NextAuth (necesarios para el funcionamiento correcto)
  events: {
    async signIn({ user, isNewUser }) {
      // Solo loguear en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log('🎉 [EVENT] SignIn exitoso:', user.email, 'Nuevo:', isNewUser);
      }
    },
    async signOut({ session, token }) {
      if (process.env.NODE_ENV === 'development') {
        console.log('👋 [EVENT] SignOut:', session?.user?.email || token?.email);
      }
    },
    async session({ session, token }) {
      // Evento necesario para mantener sesión sincronizada
    }
  }
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