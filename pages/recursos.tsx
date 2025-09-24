import React from 'react';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundVideo from '@/components/BackgroundVideo';
import { motion } from 'framer-motion';
import { 
  ExternalLink,
  TrendingUp,
  FileText,
  BookOpen,
  Calculator,
  Calendar,
  DollarSign,
  BarChart3,
  Activity,
  Play,
  Download
} from 'lucide-react';
import styles from '@/styles/Recursos.module.css';
import YouTubePlayer from '@/components/YouTubePlayer';

interface RecursosPageProps {
  session: any;
  formulasTradingView: Array<{
    nombre: string;
    descripcion: string;
    formula: string;
    icon: string;
  }>;
  linksImportantes: Array<{
    nombre: string;
    descripcion: string;
    url: string;
    icon: string;
  }>;
  materialComplementario: Array<{
    nombre: string;
    descripcion: string;
    descarga: string;
    icon: string;
  }>;
  librosRecomendados: Array<{
    nombre: string;
    autor: string;
    descripcion: string;
    descarga: string;
  }>;
  listasActivos: Array<{
    nombre: string;
    descripcion: string;
    url: string;
    icon: string;
  }>;
  siteConfig?: {
    resourcesVideos?: {
      mainVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
  };
}

const RecursosPage: React.FC<RecursosPageProps> = ({ 
  session,
  formulasTradingView, 
  linksImportantes, 
  materialComplementario, 
  librosRecomendados, 
  listasActivos,
  siteConfig
}) => {
  return (
    <>
      <Head>
        <title>Herramientas - Centro de Recursos para Trading | Nahuel Lozano</title>
        <meta name="description" content="Herramientas útiles para hacer análisis técnico: fórmulas de TradingView, links importantes, material complementario y libros recomendados." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        {/* Hero Section con Video de Fondo */}
        <section className={styles.heroSection}>
          <BackgroundVideo 
            videoSrc="/logos/TradingView.mp4"
            autoPlay={true}
            muted={true}
            loop={true}
            showControls={false}
            className={styles.backgroundVideo}
          />
          <div className={styles.heroOverlay}></div>
          <div className={styles.container}>
            <motion.div 
              className={styles.heroContent}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className={styles.heroText}>
                <h1 className={styles.heroTitle}>Recursos</h1>
                <p className={styles.heroDescription}>
                  <em>Herramientas útiles e indispensables para aumentar el control sobre tus inversiones en bolsa. Recursos para TradingView, información actualizada y material educativo</em>
                </p>
                <a href="#recursos-lista" className={styles.heroButtonWhite}>
                  Empezá ahora &gt;
                </a>
              </div>
              <div className={styles.heroVideo}>
                <div className={styles.videoContainer}>
                  <iframe
                    width="100%"
                    height="100%"
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                    title="Video Recursos"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                  ></iframe>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* TradingView Section */}
        <section className={styles.section}>
          <div className={styles.container}>
            <motion.div 
              className={styles.tradingViewSection}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className={styles.tradingViewCard}>
                <div className={styles.tradingViewContent}>
                  <div className={styles.tradingViewIcon}>📈</div>
                  <h2 className={styles.tradingViewTitle}>TradingView</h2>
                  <p className={styles.tradingViewSubtitle}>El aliado que necesitas</p>
                  <p className={styles.tradingViewDescription}>
                    Plataforma amigable, rápida y portable en la cual los gráficos se guardan en una nube que no consume memoria de nuestra computadora.
                    <br /><br />
                    Personalización de muchos aspectos, tanto de la interfaz como de los gráficos, instrumentos e indicadores. Su versión gratuita es realmente buena.
                    <br /><br />
                    Ofrece la posibilidad de analizar una gran cantidad de activos y compartirlos rápidamente con la comunidad inversora para discutir puntos de vista.
                  </p>
                  <div className={styles.tradingViewCTA}>
                    <h3 className={styles.discountTitle}>¡Comienza a utilizar TradingView con 15 U$D de descuento!</h3>
                    <a 
                      href="https://es.tradingview.com/pricing/?share_your_love=XTrader95" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={styles.discountButton}
                    >
                      Quiero el descuento
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Fórmulas TradingView */}
        <section className={styles.sectionAlt} id="recursos-lista">
          <div className={styles.container}>
            <motion.h2 
              className={styles.sectionTitle}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              Herramientas para TradingView
            </motion.h2>
            <motion.p 
              className={styles.sectionDescription}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              Para utilizarlas debe copiarlas y pegarlas al momento de añadir un nuevo símbolo en la plataforma de TradingView
            </motion.p>
            
                         <div className={styles.cardsGridLarge}>
               <a href="https://www.tradingview.com/symbols/NYSE-SPY/" target="_blank" rel="noopener noreferrer" className={styles.card} style={{background: 'none', textDecoration: 'none'}}>
                 <img src="/logos/swst.png" className={styles.cardImage} alt="Lista de Seguimiento Wall Street" />
                 <div className={styles.cardOverlay}></div>
                 <div className={styles.cardContent}>
                   <div className={styles.cardTitle}>Lista de Seguimiento<br/>Wall Street</div>
                 </div>
               </a>
               <a href="https://www.tradingview.com/symbols/BCBA-IMV/" target="_blank" rel="noopener noreferrer" className={styles.card} style={{background: 'none', textDecoration: 'none'}}>
                 <img src="/logos/swsm.png" className={styles.cardImage} alt="Lista de Seguimiento Merval" />
                 <div className={styles.cardOverlay}></div>
                 <div className={styles.cardContent}>
                   <div className={styles.cardTitle}>Lista de Seguimiento<br/>Merval</div>
                 </div>
               </a>
               <a href="https://www.tradingview.com/chart/?symbol=BCBA%3AKO*5%2FNYSE%3AKO" target="_blank" rel="noopener noreferrer" className={styles.card} style={{background: 'none', textDecoration: 'none'}}>
                 <img src="/logos/fdccl.png" className={styles.cardImage} alt="Fórmula Dólar CCL" />
                 <div className={styles.cardOverlay}></div>
                 <div className={styles.cardContent}>
                   <div className={styles.cardTitle}>Fórmula<br/>Dólar CCL</div>
                 </div>
               </a>
               <a href="https://www.tradingview.com/chart/?symbol=BCBA%3AALUA%2F(BCBA%3AKO*5%2FNYSE%3AKO)" target="_blank" rel="noopener noreferrer" className={styles.card} style={{background: 'none', textDecoration: 'none'}}>
                 <img src="/logos/faccl.png" className={styles.cardImage} alt="Fórmula Acciones en CCL" />
                 <div className={styles.cardOverlay}></div>
                 <div className={styles.cardContent}>
                   <div className={styles.cardTitle}>Fórmula<br/>Acciones en CCL</div>
                 </div>
               </a>
               <a href="https://www.tradingview.com/chart/?symbol=BCBA%3AIMV%2F(BCBA%3AKO*5%2FNYSE%3AKO)" target="_blank" rel="noopener noreferrer" className={styles.card} style={{background: 'none', textDecoration: 'none'}}>
                 <img src="/logos/fmccl.png" className={styles.cardImage} alt="Fórmula Merval en CCL" />
                 <div className={styles.cardOverlay}></div>
                 <div className={styles.cardContent}>
                   <div className={styles.cardTitle}>Fórmula<br/>Merval en CCL</div>
                 </div>
               </a>
               <a href="https://www.tradingview.com/chart/?symbol=BCBA%3AIMV%2F(BCBA%3AKO*5%2FNYSE%3AKO)%2FSP%3ASPX" target="_blank" rel="noopener noreferrer" className={styles.card} style={{background: 'none', textDecoration: 'none'}}>
                 <img src="/logos/fpiws.png" className={styles.cardImage} alt="Fórmula Promedio Índices Wall Street" />
                 <div className={styles.cardOverlay}></div>
                 <div className={styles.cardContent}>
                   <div className={styles.cardTitle}>Fórmula Promedio<br/>Índices Wall Street</div>
                 </div>
               </a>
               <a href="https://www.tradingview.com/chart/?symbol=BCBA%3AIMV%2F(BCBA%3AKO*5%2FNYSE%3AKO)%2FSP%3ASPX" target="_blank" rel="noopener noreferrer" className={styles.card} style={{background: 'none', textDecoration: 'none'}}>
                 <img src="/logos/fcms500.png" className={styles.cardImage} alt="Fórmula Comparación Merval vs S&P500" />
                 <div className={styles.cardOverlay}></div>
                 <div className={styles.cardContent}>
                   <div className={styles.cardTitle}>Fórmula Comparación<br/>Merval vs S&amp;P500</div>
                 </div>
               </a>
               <a href="https://www.tradingview.com/chart/?symbol=NASDAQ%3ANDX%2FTVC%3ADJI" target="_blank" rel="noopener noreferrer" className={styles.card} style={{background: 'none', textDecoration: 'none'}}>
                 <img src="/logos/fcndj.png" className={styles.cardImage} alt="Fórmula Comparación Nasdaq vs Dow Jones" />
                 <div className={styles.cardOverlay}></div>
                 <div className={styles.cardContent}>
                   <div className={styles.cardTitle}>Fórmula Comparación<br/>Nasdaq vs Dow Jones</div> 
                 </div>
               </a>
             </div>
          </div>
        </section>



       

        {/* Biblioteca del Inversor */}
        <section className={styles.bibliotecaSection}>
          <div className={styles.bibliotecaContainer}>
            <h2 className={styles.bibliotecaTitle}>Biblioteca del Inversor</h2>
            <div className={styles.bibliotecaCarousel}>
              <button className={styles.carouselArrow} aria-label="Anterior">&#60;</button>
              <div className={styles.bibliotecaCards}>
                <div className={styles.bibliotecaCard}>
                  <a href="/logos/EMW.pdf" target="_blank" rel="noopener noreferrer" className={styles.bibliotecaCardLink}>
                    <img src="/logos/tituloMW.png" alt="El Método Wickoff" className={styles.bibliotecaImg} />
                    <div className={styles.bibliotecaCardText}>
                      <div className={styles.bibliotecaBookTitle}>El Método Wickoff</div>
                      <div className={styles.bibliotecaBookAuthor}><em>Enrique Díaz Valdecantos</em></div>
                    </div>
                  </a>
                </div>
                <div className={styles.bibliotecaCard}>
                  <a href="/logos/PRPP.pdf" target="_blank" rel="noopener noreferrer" className={styles.bibliotecaCardLink}>
                    <img src="/logos/tituloPP.png" alt="Padre Rico, Padre Pobre" className={styles.bibliotecaImg} />
                    <div className={styles.bibliotecaCardText}>
                      <div className={styles.bibliotecaBookTitle}>Padre Rico, Padre Pobre</div>
                      <div className={styles.bibliotecaBookAuthor}><em>Robert T. Kiyosaki</em></div>
                    </div>
                  </a>
                </div>
                <div className={styles.bibliotecaCard}>
                  <a href="/logos/ATMF.pdf" target="_blank" rel="noopener noreferrer" className={styles.bibliotecaCardLink}>
                    <img src="/logos/tituloATMF.png" alt="Análisis Técnico de los Mercados Financieros" className={styles.bibliotecaImg} />
                    <div className={styles.bibliotecaBookTitle}>Análisis Técnico de los Mercados Financieros</div>
                    <div className={styles.bibliotecaBookAuthor}><em>John J. Murphy</em></div>
                  </a>
                </div>
                <div className={styles.bibliotecaCard}>
                  <a href="/logos/LGI.pdf" target="_blank" rel="noopener noreferrer" className={styles.bibliotecaCardLink}>
                    <img src="/logos/tituloGPI.png" alt="Guía para Invertir" className={styles.bibliotecaImg} />
                    <div className={styles.bibliotecaBookTitle}>Guía para Invertir</div>
                    <div className={styles.bibliotecaBookAuthor}><em>Robert T. Kiyosaki</em></div>
                  </a>
                </div>
              </div>
              <button className={styles.carouselArrow} aria-label="Siguiente">&#62;</button>
            </div>
          </div>
        </section>

                 {/* Información para Traders */}
         <section className={styles.infoTradersSection}>
           <h2 className={styles.infoTradersTitle}>Información para Traders</h2>
           <div className={styles.infoTradersGrid}>
             <a href="https://es.investing.com/economic-calendar/" target="_blank" rel="noopener noreferrer" className={styles.infoTradersCard} style={{textDecoration: 'none'}}>
               <img src="/logos/cdeus.png" alt="Calendario datos económicos USA" className={styles.infoTradersImg} />
               <div className={styles.infoTradersOverlay}></div>
               <div className={styles.infoTradersText}>Calendario datos económicos USA</div>
             </a>
             <a href="https://es.investing.com/economic-calendar/interest-rate-decision-168" target="_blank" rel="noopener noreferrer" className={styles.infoTradersCard} style={{textDecoration: 'none'}}>
               <img src="/logos/cdtif.png" alt="Calendario datos de tasa de interés FED" className={styles.infoTradersImg} />
               <div className={styles.infoTradersOverlay}></div>
               <div className={styles.infoTradersText}>Calendario datos de tasa de interés FED</div>
             </a>
             <a href="https://es.investing.com/earnings-calendar/" target="_blank" rel="noopener noreferrer" className={styles.infoTradersCard} style={{textDecoration: 'none'}}>
               <img src="/logos/cbusa.png" alt="Calendario de Balances en USA" className={styles.infoTradersImg} />
               <div className={styles.infoTradersOverlay}></div>
               <div className={styles.infoTradersText}>Calendario de Balances en USA</div>
             </a>
             <a href="https://es.investing.com/economic-calendar/cpi-733" target="_blank" rel="noopener noreferrer" className={styles.infoTradersCard} style={{textDecoration: 'none'}}>
               <img src="/logos/cdinfla.png" alt="Calendario datos de Inflación USA" className={styles.infoTradersImg} />
               <div className={styles.infoTradersOverlay}></div>
               <div className={styles.infoTradersText}>Calendario datos de Inflación USA</div>
             </a>
             <a href="https://es.investing.com/central-banks/fed-rate-monitor" target="_blank" rel="noopener noreferrer" className={styles.infoTradersCard} style={{textDecoration: 'none'}}>
               <img src="/logos/bdtf.png" alt="Barómetro datos de tasa de interés FED" className={styles.infoTradersImg} />
               <div className={styles.infoTradersOverlay}></div>
               <div className={styles.infoTradersText}>Barómetro datos de tasa de interés FED</div>
             </a>
             <a href="https://finance.yahoo.com/calendar/dividends" target="_blank" rel="noopener noreferrer" className={styles.infoTradersCard} style={{textDecoration: 'none'}}>
               <img src="/logos/cdusa.png" alt="Calendario de Dividendos en USA" className={styles.infoTradersImg} />
               <div className={styles.infoTradersOverlay}></div>
               <div className={styles.infoTradersText}>Calendario de Dividendos en USA</div>
             </a>
             <a href="https://www.byma.com.ar/cedears/" target="_blank" rel="noopener noreferrer" className={styles.infoTradersCard} style={{textDecoration: 'none'}}>
               <img src="/logos/rccars.png" alt="Ratios de Conversión de CEDEARS" className={styles.infoTradersImg} />
               <div className={styles.infoTradersOverlay}></div>
               <div className={styles.infoTradersText}>Ratios de Conversión de CEDEARS</div>
             </a>
             <a href="https://finviz.com/map.ashx?t=sec" target="_blank" rel="noopener noreferrer" className={styles.infoTradersCard} style={{textDecoration: 'none'}}>
               <img src="/logos/mcws.png" alt="Mapa de Calor Wall Street" className={styles.infoTradersImg} />
               <div className={styles.infoTradersOverlay}></div>
               <div className={styles.infoTradersText}>Mapa de Calor Wall Street</div>
             </a>
             <a href="https://docs.google.com/spreadsheets/d/17H8-_IUFi5Pbl4S9kWwKc0iiH0w7dlpJeoORb8rv85E/edit?gid=0#gid=0" target="_blank" rel="noopener noreferrer" className={styles.infoTradersCard} style={{textDecoration: 'none'}}>
               <img src="/logos/cdcdears.png" alt="Calculadora de Desarbitrajes para CEDEARS" className={styles.infoTradersImg} />
               <div className={styles.infoTradersOverlay}></div>
               <div className={styles.infoTradersText}>Calculadora de Desarbitrajes para CEDEARS</div>
             </a>
           </div>
         </section>

        {/* CTA Principal */}
        <section className={styles.ctaSection}>
          <div className={styles.ctaContainer}>
            <h2 className={styles.ctaTitle}>¿Listo para llevar tus inversiones al siguiente nivel?</h2>
            <p className={styles.ctaSubtitle}>Únete a nuestra comunidad y comienza construir tu libertad financiera</p>
            <button className={styles.ctaButton}>Elegí tu Broker &gt;</button>
          </div>
        </section>
        {/* Fin de Información para Traders */}
        {/* Aquí terminan las secciones modernas, eliminamos las viejas */}
        
         {/* Sección YouTube */}
         <section className={styles.youtubeSection}>
          <div className={styles.youtubeContainer}>
            <div className={styles.youtubeText}>
              <h2 className={styles.youtubeTitle}>¡Sumate a nuestra comunidad<br/>en YouTube!</h2>
              <p className={styles.youtubeSubtitle}>No te pierdas nuestros últimos videos</p>
            </div>
            <div className={styles.youtubeVideoContainer}>
              <button className={styles.videoArrow} aria-label="Anterior">&#60;</button>
              <div className={styles.videoPlayer}>
                <YouTubePlayer
                  videoId={siteConfig?.resourcesVideos?.mainVideo?.youtubeId || "dQw4w9WgXcQ"}
                  title={siteConfig?.resourcesVideos?.mainVideo?.title || "Recursos de Trading"}
                  autoplay={siteConfig?.resourcesVideos?.mainVideo?.autoplay || false}
                  muted={siteConfig?.resourcesVideos?.mainVideo?.muted || true}
                  loop={siteConfig?.resourcesVideos?.mainVideo?.loop || false}
                  className={styles.videoPlayer}
                />
              </div>
              <button className={styles.videoArrow} aria-label="Siguiente">&#62;</button>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  
  // Obtener configuración del sitio
  let siteConfig = null;
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const configResponse = await fetch(`${baseUrl}/api/site-config`);
    if (configResponse.ok) {
      const configData = await configResponse.json();
      siteConfig = configData;
    }
  } catch (configError) {
    console.warn('Error fetching site config:', configError);
  }
  
  const formulasTradingView = [
    {
      nombre: 'Dólar CCL',
      descripcion: 'Dólar con el CEDEAR más utilizado para esta operatoria',
      formula: 'BCBA:KO*5/NYSE:KO',
      icon: '💱'
    },
    {
      nombre: 'Acciones Argentinas en Dólar CCL',
      descripcion: 'Reemplazar ALUA por el ticker del activo local que quieras',
      formula: 'BCBA:ALUA/(BCBA:KO*5/NYSE:KO)',
      icon: '🏛️'
    },
    {
      nombre: 'Índice MERVAL en Dólar CCL',
      descripcion: 'El índice MERVAL ajustado por Dólar CCL, para evitar contaminar el análisis de la devaluación del peso',
      formula: 'BCBA:IMV/(BCBA:KO*5/NYSE:KO)',
      icon: '📊'
    },
    {
      nombre: 'Comparación entre S&P500 y MERVAL',
      descripcion: 'Cuando el gráfico está alcista, conviene estar invertido en activos del S&P500. Cuando está bajista, en activos del MERVAL',
      formula: 'BCBA:IMV/(BCBA:KO*5/NYSE:KO)/SP:SPX',
      icon: '⚖️'
    },
    {
      nombre: 'Comparación entre NASDAQ 100 y DOW JONES 30',
      descripcion: 'Cuando el gráfico está alcista, conviene estar invertido en activos del NASDAQ 100. Cuando está bajista, en activos del DOW JONES 30',
      formula: 'NASDAQ:NDX/TVC:DJI',
      icon: '🔄'
    }
  ];

  const listasActivos = [
    {
      nombre: 'Lista de Activos de USA',
      descripcion: 'Watchlist completa con los principales activos del mercado estadounidense que analizo regularmente',
      url: 'https://www.tradingview.com/markets/stocks-usa/sectorandindustry-sector/',
      icon: '🇺🇸'
    },
    {
      nombre: 'Lista de Activos de ARG',
      descripcion: 'Activos del mercado argentino: acciones locales, CEDEARs y bonos más relevantes para análisis',
      url: 'https://www.tradingview.com/markets/stocks-argentina/sectorandindustry-sector/',
      icon: '🇦🇷'
    }
  ];

  const linksImportantes = [
    {
      nombre: 'TradingView - Análisis Técnico',
      descripcion: 'Plataforma líder para análisis técnico, gráficos en tiempo real y herramientas de trading profesionales',
      url: 'https://es.tradingview.com/pricing/?share_your_love=XTrader95',
      icon: '📊'
    },
    {
      nombre: 'Calendario Dato Inflacional USA',
      descripcion: 'Calendario oficial de datos de inflación (CPI) de Estados Unidos con fechas y expectativas del mercado',
      url: 'https://es.investing.com/economic-calendar/cpi-733',
      icon: '📈'
    },
    {
      nombre: 'Calendario FED Tasa de Interés USA',
      descripcion: 'Calendario oficial de reuniones de la Reserva Federal y decisiones de política monetaria',
      url: 'https://es.investing.com/economic-calendar/interest-rate-decision-168',
      icon: '🏦'
    },
    {
      nombre: 'Barómetro FED - Monitoreo de Tasas',
      descripcion: 'Monitoreo en tiempo real de las expectativas del mercado sobre las decisiones de tasas de interés de la Reserva Federal',
      url: 'https://es.investing.com/central-banks/fed-rate-monitor',
      icon: '📊'
    },
    {
      nombre: 'Balances Próximos',
      descripcion: 'Fechas de presentación de resultados trimestrales de empresas argentinas e internacionales',
      url: 'https://es.investing.com/earnings-calendar/',
      icon: '📅'
    },
    {
      nombre: 'Calendario Económico',
      descripcion: 'Eventos económicos importantes que pueden afectar los mercados financieros globales',
      url: 'https://es.investing.com/economic-calendar/',
      icon: '📊'
    },
    {
      nombre: 'Calculadora de CEDEARs',
      descripcion: 'Herramienta para calcular el precio justo de CEDEARs versus sus activos subyacentes y detectar oportunidades de arbitraje',
      url: 'https://docs.google.com/spreadsheets/d/17H8-_IUFi5Pbl4S9kWwKc0iiH0w7dlpJeoORb8rv85E/edit?gid=0#gid=0',
      icon: '💰'
    },
    {
      nombre: 'Indicador Fear and Greed',
      descripcion: 'Medidor de sentimiento del mercado que combina 7 indicadores diferentes de volatilidad y momentum para identificar oportunidades',
      url: 'https://edition.cnn.com/markets/fear-and-greed',
      icon: '😰'
    },
    {
      nombre: 'Mercap Abbaco - Renta Fija',
      descripcion: 'Información detallada sobre bonos e instrumentos de renta fija del mercado argentino con análisis y datos actualizados',
      url: 'https://bonds.mercapabbaco.com',
      icon: '📋'
    }
  ];

  const materialComplementario = [
    {
      nombre: 'Ratios de Conversión COMAFI',
      descripcion: 'Guía completa con todos los ratios de conversión de CEDEARs proporcionada por COMAFI',
      descarga: 'https://www.comafi.com.ar/cedears',
      icon: '🔄'
    },
    {
      nombre: 'Ratios de Conversión BYMA',
      descripcion: 'Ratios oficiales de conversión de CEDEARs según BYMA (Bolsas y Mercados Argentinos)',
      descarga: 'https://www.byma.com.ar/cedears/',
      icon: '📊'
    },
    {
      nombre: 'Cálculo para Comprar y Vender CEDEARs',
      descripcion: 'Manual práctico con ejemplos para calcular correctamente operaciones con CEDEARs',
      descarga: 'https://www.byma.com.ar/cedears/',
      icon: '💵'
    },
    {
      nombre: '¿Cómo Medir la Cartera?',
      descripcion: 'Manual para evaluar correctamente el performance de tu portafolio y compararlo con benchmarks',
      descarga: 'https://www.investing.com/portfolio/',
      icon: '📏'
    }
  ];

  const librosRecomendados = [
    {
      nombre: 'Análisis Técnico de los Mercados Financieros',
      autor: 'John J. Murphy',
      descripcion: 'El manual definitivo sobre análisis técnico. Cubre todos los conceptos fundamentales y técnicas avanzadas.',
      descarga: '/downloads/analisis-tecnico-murphy.pdf'
    },
    {
      nombre: 'Guía para Invertir',
      autor: 'Robert T. Kiyosaki',
      descripcion: 'Estrategias de inversión y educación financiera para construir riqueza a largo plazo.',
      descarga: '/downloads/guia-para-invertir-kiyosaki.pdf'
    },
    {
      nombre: 'El Método Wyckoff',
      autor: 'Enrique Díaz Valdecantos',
      descripcion: 'Análisis profundo del método Wyckoff para entender la estructura del mercado y el volumen.',
      descarga: '/downloads/metodo-wyckoff.pdf'
    },
    {
      nombre: 'Padre Rico, Padre Pobre',
      autor: 'Robert T. Kiyosaki',
      descripcion: 'Fundamentos de educación financiera y mentalidad para alcanzar la libertad financiera.',
      descarga: '/downloads/padre-rico-padre-pobre.pdf'
    }
  ];

  return {
    props: {
      session,
      formulasTradingView,
      linksImportantes,
      materialComplementario,
      librosRecomendados,
      listasActivos,
      siteConfig: siteConfig || null
    }
  };
};

export default RecursosPage; 