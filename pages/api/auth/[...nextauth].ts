import NextAuth from 'next-auth';
import { authOptions } from '@/lib/googleAuth';

// NextAuth usará automáticamente NEXTAUTH_URL si está configurado en las variables de entorno
// La redirección en vercel.json maneja las solicitudes desde .vercel.app al dominio personalizado
export default NextAuth(authOptions); 