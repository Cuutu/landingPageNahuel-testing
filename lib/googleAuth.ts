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
    signIn: '/api/auth/signin',
    error: '/auth/error',
    signOut: '/',
  },
  debug: process.env.NODE_ENV === 'development',
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('🔐 [SIGNIN] Iniciando sesión:', user.email);
      
      try {
        await dbConnect();
        
        // Buscar usuario existente en nuestra colección personalizada
        let existingUser = await User.findOne({ email: user.email });
        
        const userImageUrl = user.image || (profile as any)?.picture;
        
        if (!existingUser) {
          console.log('👤 [SIGNIN] Creando nuevo usuario:', user.email);
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
            console.log('📧 [SIGNIN] Agregando email a lista de envío masivo:', user.email);
            await (EmailList as any).addEmailIfNotExists(user.email, 'registration');
            console.log('✅ [SIGNIN] Email agregado exitosamente a la lista');
          } catch (emailError) {
            console.error('⚠️ [SIGNIN] Error agregando email a la lista (no crítico):', emailError);
            // No fallar el registro si no se puede agregar a la lista
          }
        } else {
          console.log('👤 [SIGNIN] Actualizando usuario existente:', user.email);
          await User.findByIdAndUpdate(existingUser._id, {
            name: user.name,
            picture: userImageUrl,
            googleId: account?.providerAccountId,
            lastLogin: new Date(),
          });

          // Asegurar que el email esté en la lista de envío masivo (por si no estaba)
          try {
            console.log('📧 [SIGNIN] Verificando email en lista de envío masivo:', user.email);
            await (EmailList as any).addEmailIfNotExists(user.email, 'registration');
            console.log('✅ [SIGNIN] Email verificado/agregado a la lista');
          } catch (emailError) {
            console.error('⚠️ [SIGNIN] Error verificando email en la lista (no crítico):', emailError);
            // No fallar el login si no se puede verificar en la lista
          }
        }
        
        console.log('✅ [SIGNIN] Usuario procesado correctamente, rol:', existingUser.role);
        return true;
      } catch (error) {
        console.error('❌ [SIGNIN] Error en signIn callback:', error);
        // Permitir login aunque haya error para evitar crashes
        return true;
      }
    },
    async jwt({ token, account, user, trigger }) {
      console.log('🔑 [JWT] Callback ejecutado, trigger:', trigger, 'email:', token.email);
      
      // Cargar información del usuario desde BD en cada creación de token o cuando se force update
      if (token.email && (trigger === 'signIn' || trigger === 'update' || !token.role)) {
        try {
          await dbConnect();
          const dbUser = await User.findOne({ email: token.email }).lean() as any;
          
          if (dbUser && !Array.isArray(dbUser)) {
            console.log('🔑 [JWT] Cargando datos desde BD, rol:', dbUser.role);
            token.role = dbUser.role;
            token.id = dbUser._id.toString();
            token.suscripciones = dbUser.suscripciones || [];
            token.picture = dbUser.picture || token.picture;
            token.name = dbUser.name || token.name;
          } else {
            console.log('⚠️ [JWT] Usuario no encontrado en BD:', token.email);
            token.role = 'normal';
            token.suscripciones = [];
          }
        } catch (error) {
          console.error('❌ [JWT] Error cargando usuario:', error);
          // Mantener datos existentes en caso de error, pero asegurar rol por defecto
          if (!token.role) {
            token.role = 'normal';
            token.suscripciones = [];
          }
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      console.log('📋 [SESSION] Callback ejecutado para:', session.user?.email);
      
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'normal' | 'suscriptor' | 'admin';
        session.user.suscripciones = token.suscripciones as any[] || [];
        
        // Asegurar que la información esté actualizada
        if (token.picture) {
          session.user.image = token.picture as string;
        }
        if (token.name) {
          session.user.name = token.name as string;
        }
        
        console.log('📋 [SESSION] Usuario procesado - Email:', session.user.email, 'Rol:', session.user.role);
      }
      
      return session;
    }
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
    updateAge: 24 * 60 * 60, // Actualizar cada 24 horas
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token' 
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // Simplificar dominio para Vercel
        domain: undefined // Dejar que Vercel maneje automáticamente
      }
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.callback-url' 
        : 'next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: undefined
      }
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Host-next-auth.csrf-token' 
        : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: undefined
      }
    }
  },
  // Eventos para debugging
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('🎉 [EVENT] SignIn exitoso:', user.email, 'Nuevo usuario:', isNewUser);
    },
    async signOut({ session, token }) {
      console.log('👋 [EVENT] SignOut:', session?.user?.email || token?.email);
    },
    async session({ session, token }) {
      console.log('🔄 [EVENT] Session actualizada:', session?.user?.email);
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
  }
} 