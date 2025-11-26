import Head from 'next/head';
import { motion } from 'framer-motion';
import { Construction, Wrench, Clock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from '@/styles/UnderConstruction.module.css';

/**
 * Componente de página "EN CONSTRUCCIÓN"
 * Se muestra cuando el usuario no es administrador
 */
export default function UnderConstruction() {
  return (
    <>
      <Head>
        <title>En Construcción - Nahuel Lozano</title>
        <meta name="description" content="Sitio en construcción" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.container}>
          <motion.div
            className={styles.content}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className={styles.iconContainer}>
              <motion.div
                className={styles.iconWrapper}
                animate={{ 
                  rotate: [0, 10, -10, 10, 0],
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
              >
                <Construction size={80} className={styles.mainIcon} />
              </motion.div>
            </div>

            <h1 className={styles.title}>Estamos trabajando en algo increíble</h1>
            
            <p className={styles.description}>
              Nuestro sitio está en construcción. Muy pronto estaremos listos para brindarte la mejor experiencia.
            </p>

            <div className={styles.features}>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Wrench size={32} className={styles.featureIcon} />
                <h3>Mejoras en curso</h3>
                <p>Estamos mejorando la plataforma para ofrecerte una mejor experiencia</p>
              </motion.div>

              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Clock size={32} className={styles.featureIcon} />
                <h3>Próximamente</h3>
                <p>Volveremos muy pronto con novedades y mejoras</p>
              </motion.div>
            </div>

            <motion.div
              className={styles.footerText}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <p>Gracias por tu paciencia</p>
            </motion.div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </>
  );
}

