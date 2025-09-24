import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Loader } from 'lucide-react';
import styles from '../../styles/SwingTrading.module.css';

interface Testimonial {
  name: string;
  role: string;
  content: string;
  rating: number;
  image: string;
  results: string;
}

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
  countdown: {
    days: number;
    hours: number;
    minutes: number;
  };
  startDateText: string;
  isEnrolled: boolean;
  checkingEnrollment: boolean;
  isProcessingPayment: boolean;
  onEnroll: () => void;
}

const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({
  testimonials,
  countdown,
  startDateText,
  isEnrolled,
  checkingEnrollment,
  isProcessingPayment,
  onEnroll
}) => {
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  
  const carouselTestimonials = [
    {
      initial: 'C',
      name: 'Carlos Mendoza',
      text: '"Las alertas de Nahuel me han ayudado a incrementar mi cuenta un 25% en los últimos 6 meses."',
      backgroundColor: '#6366f1'
    },
    {
      initial: 'A', 
      name: 'Ana Laura Quiroga',
      text: '"Los cursos de análisis técnico son realmente muy buenos y didácticos. 100% recomendables!"',
      backgroundColor: '#ef4444'
    },
    {
      initial: 'T',
      name: 'Tamara Rodriguez', 
      text: '"Las recomendaciones que brindan en las asesorías a 1 a 1 son muy buenas. Estoy muy conforme"',
      backgroundColor: '#22c55e'
    },
    {
      initial: 'M',
      name: 'María González',
      text: '"Excelente servicio de trading. Las señales son muy precisas y me han ayudado mucho en mis inversiones."',
      backgroundColor: '#f59e0b'
    },
    {
      initial: 'R',
      name: 'Roberto Silva',
      text: '"Los webinars son increíbles, aprendí mucho sobre análisis técnico. Muy recomendado para principiantes."',
      backgroundColor: '#8b5cf6'
    },
    {
      initial: 'L',
      name: 'Laura Martínez',
      text: '"El soporte al cliente es excepcional. Siempre responden rápido y con mucha paciencia a mis dudas."',
      backgroundColor: '#06b6d4'
    }
  ];

  const nextTestimonial = () => {
    setCurrentTestimonialIndex((prev) => 
      prev >= carouselTestimonials.length - 3 ? 0 : prev + 1
    );
  };

  const prevTestimonial = () => {
    setCurrentTestimonialIndex((prev) => 
      prev === 0 ? carouselTestimonials.length - 3 : prev - 1
    );
  };

  // Auto-play del carrusel
  useEffect(() => {
    const interval = setInterval(nextTestimonial, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className={styles.testimonialsSection}>
      <div className={styles.container} style={{ position: 'relative', zIndex: 2 }}>
        <motion.div
          className={styles.testimonialsCard}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className={styles.testimonialsHeader}>
            <h2 className={styles.testimonialsTitle}>
              Swing Trading
            </h2>
            
            <div className={styles.testimonialsDate}>
              Fecha de inicio: {startDateText}
            </div>
            
            <div className={styles.testimonialsCountdown}>
              <div className={styles.countdownBox}>
                <span className={styles.countdownNumber}>{countdown.days}</span>
                <span className={styles.countdownLabel}>Días</span>
              </div>
              <div className={styles.countdownBox}>
                <span className={styles.countdownNumber}>{countdown.hours}</span>
                <span className={styles.countdownLabel}>Horas</span>
              </div>
              <div className={styles.countdownBox}>
                <span className={styles.countdownNumber}>{countdown.minutes}</span>
                <span className={styles.countdownLabel}>Minutos</span>
              </div>
            </div>
            
            <button 
              onClick={onEnroll}
              className={styles.testimonialsButton}
              disabled={checkingEnrollment || isProcessingPayment}
            >
              {isProcessingPayment ? (
                <>
                  <Loader size={20} className={styles.spinner} />
                  Procesando...
                </>
              ) : (
                <>
                  Inscribirme Ahora &gt;
                </>
              )}
            </button>
          </div>

        </motion.div>
        
        <motion.div
          className={styles.testimonialsHorizontalContainer}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className={styles.testimonialsCarousel}>
            <button 
              className={styles.testimonialNavButton}
              onClick={prevTestimonial}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            
            <div className={styles.testimonialsSlider}>
              {carouselTestimonials.slice(currentTestimonialIndex, currentTestimonialIndex + 3).map((testimonial, index) => (
                <div key={index} className={styles.testimonialSlide}>
                  <div className={styles.testimonialHorizontalItem}>
                    <div 
                      className={styles.testimonialAvatar} 
                      style={{backgroundColor: testimonial.backgroundColor}}
                    >
                      <span className={styles.testimonialInitial}>{testimonial.initial}</span>
                    </div>
                    <div className={styles.testimonialVerticalInfo}>
                      <h4 className={styles.testimonialName}>{testimonial.name}</h4>
                      <div className={styles.testimonialRating}>
                        {[...Array(4)].map((_, i) => (
                          <Star key={i} size={16} className={styles.testimonialStar} fill="#fbbf24" />
                        ))}
                        <Star key={4} size={16} className={styles.testimonialStarEmpty} fill="none" stroke="#fbbf24" />
                      </div>
                      <p className={styles.testimonialText}>
                        {testimonial.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button 
              className={styles.testimonialNavButton}
              onClick={nextTestimonial}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection; 