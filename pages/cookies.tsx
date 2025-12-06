import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Cookie, Shield, Clock, Settings, ChevronLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from '@/styles/Cookies.module.css';

/**
 * Página de Política de Cookies
 * Documenta todas las cookies utilizadas en el sitio web
 */
export default function CookiesPage() {
  const cookiesEsenciales = [
    {
      nombre: 'next-auth.session-token',
      nombreProduccion: '__Secure-next-auth.session-token',
      proveedor: 'NextAuth.js',
      proposito: 'Mantiene tu sesión activa después de iniciar sesión con Google. Esta cookie es esencial para que puedas navegar por las diferentes páginas sin tener que volver a autenticarte.',
      duracion: '30 días',
      tipo: 'Esencial',
      httpOnly: true,
    },
    {
      nombre: 'next-auth.callback-url',
      nombreProduccion: '__Secure-next-auth.callback-url',
      proveedor: 'NextAuth.js',
      proposito: 'Almacena temporalmente la URL a la que serás redirigido después de completar el proceso de inicio de sesión. Esto asegura que vuelvas a la página que estabas visitando.',
      duracion: 'Sesión',
      tipo: 'Esencial',
      httpOnly: false,
    },
    {
      nombre: 'next-auth.csrf-token',
      nombreProduccion: '__Host-next-auth.csrf-token',
      proveedor: 'NextAuth.js',
      proposito: 'Protege tu cuenta contra ataques de falsificación de solicitudes (CSRF). Esta cookie de seguridad verifica que las solicitudes de autenticación provienen de nuestro sitio web legítimo.',
      duracion: 'Sesión',
      tipo: 'Esencial / Seguridad',
      httpOnly: true,
    },
  ];

  return (
    <>
      <Head>
        <title>Política de Cookies | Nahuel Lozano</title>
        <meta name="description" content="Política de cookies del sitio web de Nahuel Lozano. Conocé qué cookies utilizamos y por qué." />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className="container">
          {/* Botón volver */}
          <Link href="/" className={styles.backButton}>
            <ChevronLeft size={20} />
            Volver al inicio
          </Link>

          <motion.div
            className={styles.content}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.iconContainer}>
                <Cookie size={48} />
              </div>
              <h1 className={styles.title}>Política de Cookies</h1>
              <p className={styles.subtitle}>
                Última actualización: {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Introducción */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>¿Qué son las cookies?</h2>
              <p className={styles.text}>
                Las cookies son pequeños archivos de texto que los sitios web almacenan en tu dispositivo (computadora, tablet o celular) 
                cuando los visitás. Estas cookies permiten que el sitio recuerde tus acciones y preferencias durante un período de tiempo, 
                para que no tengas que volver a configurarlas cada vez que volvés al sitio o navegás de una página a otra.
              </p>
            </section>

            {/* Por qué usamos cookies */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>¿Por qué usamos cookies?</h2>
              <p className={styles.text}>
                En <strong>lozanonahuel.com</strong> utilizamos únicamente cookies esenciales y de seguridad que son 
                estrictamente necesarias para el funcionamiento del sitio. Estas cookies nos permiten:
              </p>
              <ul className={styles.list}>
                <li>
                  <Shield size={18} className={styles.listIcon} />
                  <span>Mantener tu sesión activa de forma segura después de iniciar sesión con Google</span>
                </li>
                <li>
                  <Clock size={18} className={styles.listIcon} />
                  <span>Recordar tu estado de autenticación mientras navegás por el sitio</span>
                </li>
                <li>
                  <Settings size={18} className={styles.listIcon} />
                  <span>Proteger tu cuenta contra ataques de seguridad (CSRF)</span>
                </li>
              </ul>
              <div className={styles.highlight}>
                <p>
                  <strong>🔒 Nota importante:</strong> No utilizamos cookies de publicidad, cookies de seguimiento de terceros, 
                  ni cookies analíticas. Tu privacidad es nuestra prioridad.
                </p>
              </div>
            </section>

            {/* Tabla de cookies */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Cookies que utilizamos</h2>
              <p className={styles.text}>
                A continuación, detallamos todas las cookies que puede almacenar nuestro sitio web:
              </p>

              <div className={styles.cookiesGrid}>
                {cookiesEsenciales.map((cookie, index) => (
                  <motion.div
                    key={cookie.nombre}
                    className={styles.cookieCard}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <div className={styles.cookieHeader}>
                      <span className={styles.cookieType}>{cookie.tipo}</span>
                      {cookie.httpOnly && (
                        <span className={styles.httpOnlyBadge} title="Esta cookie solo es accesible por el servidor">
                          HttpOnly
                        </span>
                      )}
                    </div>
                    
                    <h3 className={styles.cookieName}>{cookie.nombre}</h3>
                    
                    <div className={styles.cookieDetail}>
                      <span className={styles.detailLabel}>En producción:</span>
                      <code className={styles.cookieCode}>{cookie.nombreProduccion}</code>
                    </div>
                    
                    <div className={styles.cookieDetail}>
                      <span className={styles.detailLabel}>Proveedor:</span>
                      <span>{cookie.proveedor}</span>
                    </div>
                    
                    <div className={styles.cookieDetail}>
                      <span className={styles.detailLabel}>Duración:</span>
                      <span className={styles.duracion}>{cookie.duracion}</span>
                    </div>
                    
                    <p className={styles.cookieProposito}>{cookie.proposito}</p>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Gestión de cookies */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>¿Cómo gestionar las cookies?</h2>
              <p className={styles.text}>
                Podés controlar y/o eliminar las cookies como desees. Podés eliminar todas las cookies que ya están 
                en tu dispositivo y configurar la mayoría de los navegadores para que no se instalen. Sin embargo, 
                si hacés esto, es posible que tengas que ajustar manualmente algunas preferencias cada vez que visites 
                un sitio y que algunos servicios y funcionalidades no estén disponibles.
              </p>
              
              <div className={styles.browserLinks}>
                <h3 className={styles.subSectionTitle}>Gestionar cookies en tu navegador:</h3>
                <ul className={styles.browserList}>
                  <li>
                    <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
                      Google Chrome
                    </a>
                  </li>
                  <li>
                    <a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias" target="_blank" rel="noopener noreferrer">
                      Mozilla Firefox
                    </a>
                  </li>
                  <li>
                    <a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">
                      Safari
                    </a>
                  </li>
                  <li>
                    <a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">
                      Microsoft Edge
                    </a>
                  </li>
                </ul>
              </div>

              <div className={styles.warning}>
                <p>
                  <strong>⚠️ Importante:</strong> Si deshabilitás las cookies esenciales, no podrás iniciar sesión 
                  en nuestro sitio ni acceder a las funcionalidades que requieren autenticación (alertas, entrenamientos, etc.).
                </p>
              </div>
            </section>

            {/* Base legal */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Base legal</h2>
              <p className={styles.text}>
                Las cookies esenciales que utilizamos son estrictamente necesarias para el funcionamiento del sitio web 
                y no requieren tu consentimiento previo según la normativa aplicable, ya que sin ellas no sería posible 
                proporcionar el servicio solicitado (autenticación y acceso a tu cuenta).
              </p>
              <p className={styles.text}>
                Al crear una cuenta e iniciar sesión, estás aceptando el uso de estas cookies esenciales para mantener 
                tu sesión activa y proteger tu cuenta.
              </p>
            </section>

            {/* Contacto */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Contacto</h2>
              <p className={styles.text}>
                Si tenés alguna pregunta sobre nuestra política de cookies o sobre cómo manejamos tus datos, 
                no dudes en contactarnos a través de nuestros canales oficiales.
              </p>
              <div className={styles.contactInfo}>
                <p>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:soporte@lozanonahuel.com">soporte@lozanonahuel.com</a>
                </p>
              </div>
            </section>

            {/* Actualizaciones */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Actualizaciones de esta política</h2>
              <p className={styles.text}>
                Podemos actualizar esta política de cookies ocasionalmente para reflejar cambios en las cookies que 
                utilizamos o por otros motivos operativos, legales o reglamentarios. Te recomendamos visitar esta 
                página periódicamente para estar informado sobre el uso de cookies.
              </p>
            </section>
          </motion.div>
        </div>
      </main>

      <Footer />
    </>
  );
}
