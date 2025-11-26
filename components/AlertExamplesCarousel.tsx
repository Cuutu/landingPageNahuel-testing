import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import styles from '@/styles/AlertExamplesCarousel.module.css';

interface AlertExample {
  id: string;
  title: string;
  description: string;
  chartImage?: string;
  entryPrice: string;
  exitPrice: string;
  profit: string;
  profitPercentage: string;
  riskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
  status: 'CERRADO TP1' | 'CERRADO TP1 Y SL' | 'CERRADO SL';
  country: string;
  ticker: string;
  order: number;
}

interface AlertExamplesCarouselProps {
  examples: AlertExample[];
  autoplay?: boolean;
  interval?: number;
}

const AlertExamplesCarousel: React.FC<AlertExamplesCarouselProps> = ({ 
  examples, 
  autoplay = true, 
  interval = 5000 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Auto-play functionality
  useEffect(() => {
    if (!autoplay || examples.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === examples.length - 1 ? 0 : prevIndex + 1
      );
    }, interval);

    return () => clearInterval(timer);
  }, [autoplay, interval, examples.length]);

  const goToPrevious = () => {
    setCurrentIndex(currentIndex === 0 ? examples.length - 1 : currentIndex - 1);
  };

  const goToNext = () => {
    setCurrentIndex(currentIndex === examples.length - 1 ? 0 : currentIndex + 1);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const handleImageClick = (imageSrc: string) => {
    setSelectedImage(imageSrc);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  if (examples.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No hay ejemplos de alertas disponibles</p>
      </div>
    );
  }

  // Mostrar 3 ejemplos a la vez como solicitado
  const getVisibleExamples = () => {
    if (examples.length <= 3) return examples;
    
    const visibleExamples = [];
    for (let i = 0; i < 3; i++) {
      const index = (currentIndex + i) % examples.length;
      visibleExamples.push(examples[index]);
    }
    return visibleExamples;
  };

  return (
    <>
      <div className={styles.carousel}>
        <div className={styles.carouselContainer}>
          {/* Navigation Arrows */}
          {examples.length > 3 && (
            <>
              <button 
                className={`${styles.navButton} ${styles.prevButton}`}
                onClick={goToPrevious}
                aria-label="Ejemplos anteriores"
              >
                <ChevronLeft size={24} />
              </button>
              <button 
                className={`${styles.navButton} ${styles.nextButton}`}
                onClick={goToNext}
                aria-label="Siguientes ejemplos"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Slides */}
          <div className={styles.slidesWrapper}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                className={styles.slide}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              >
                <div className={styles.alertsGrid}>
                  {getVisibleExamples().map((example, index) => (
                    <div key={`${example.id}-${index}`} className={styles.alertCard}>
                      {/* Chart Image Only - Clickable */}
                      <div 
                        className={styles.chartContainer}
                        onClick={() => example.chartImage && handleImageClick(example.chartImage)}
                        style={{ cursor: example.chartImage ? 'pointer' : 'default' }}
                      >
                        {example.chartImage ? (
                          <img 
                            src={example.chartImage} 
                            alt={`Ejemplo de alerta ${example.ticker}`}
                            className={styles.chartImage}
                          />
                        ) : (
                          <div className={styles.chartBackground}>
                            <div className={styles.chartLines}></div>
                            <div className={styles.candlesticks}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots Indicator */}
          {examples.length > 3 && (
            <div className={styles.dotsContainer}>
              {Array.from({ length: Math.ceil(examples.length / 3) }, (_, i) => (
                <button
                  key={i}
                  className={`${styles.dot} ${Math.floor(currentIndex / 3) === i ? styles.activeDot : ''}`}
                  onClick={() => goToSlide(i * 3)}
                  aria-label={`Ir a página ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal for enlarged image */}
      {selectedImage && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeButton} onClick={closeModal}>
              <X size={24} />
            </button>
            <img 
              src={selectedImage} 
              alt="Imagen ampliada"
              className={styles.modalImage}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AlertExamplesCarousel;
