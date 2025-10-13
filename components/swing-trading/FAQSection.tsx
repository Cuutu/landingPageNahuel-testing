import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import styles from '../../styles/SwingTrading.module.css';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const FAQSection: React.FC = () => {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const faqData: FAQItem[] = [
    {
      id: 1,
      question: "¿A quién está dirigido este entrenamiento?",
      answer: "Está pensado para personas que ya dominan el análisis técnico y quieren aplicar lo aprendido en el mercado real con una estrategia profesional de Swing Trading. Si operás sin un método claro, te cuesta sostener tus decisiones o sentís que necesitás acompañamiento para operar con criterio, este entrenamiento es para vos. No se enseñan los fundamentos del análisis técnico desde cero, por lo que es recomendable haber hecho un curso de análisis técnico previamente."
    },
    {
      id: 2,
      question: "¿Qué voy a aprender?",
      answer: "Vas a aprender una estrategia de Swing Trading enfocada en operar movimientos de varios días o semanas, usando análisis técnico, gestión del riesgo y contexto de mercado. El foco está en ayudarte a identificar oportunidades de calidad, interpretar los gráficos con criterio y ejecutar decisiones con claridad. Todo se enseña de manera aplicada, sin teoría innecesaria y con seguimiento real. No es un curso más: es entrenamiento en acción real."
    },
    {
      id: 3,
      question: "¿Cómo es la modalidad?",
      answer: "El entrenamiento dura 1 mes e incluye 1 clase en vivo por semana (100% online). Si no podés asistir, las clases quedan grabadas. Además, vas a contar con acceso a materiales descargables, herramientas listas para usar y un canal privado de Telegram donde vas a poder hacer consultas, compartir análisis y recibir seguimiento directo. Todo el proceso está pensado para que no te sientas solo y puedas avanzar paso a paso."
    },
    {
      id: 4,
      question: "¿Qué incluye la inscripción?",
      answer: "Tu inscripción incluye acceso a todas las clases en vivo, grabaciones posteriores, materiales didácticos y ejecutables, acompañamiento personalizado del mentor, y participación en un grupo exclusivo con otros alumnos. También tendrás asistencia directa entre clases para resolver dudas y seguimiento técnico constante durante todo el entrenamiento. No se trata solo de aprender, sino de integrar los conocimientos operando y recibiendo feedback en tiempo real."
    },
    {
      id: 5,
      question: "¿Cuándo empieza y cómo reservo mi lugar?",
      answer: "El entrenamiento se dicta por ciclos. La próxima edición comenzará próximamente y los cupos son limitados. Podés reservar tu lugar desde el botón \"Empezá Ahora\" y pagando el entrenamiento. Apenas te inscribís, te damos acceso anticipado al canal privado y al material introductorio para que llegues bien preparado a la primera clase. No te quedes afuera si estás buscando operar con claridad y resultados."
    }
  ];

  const toggleFAQ = (id: number) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  return (
    <section className={styles.faqSection}>
      <div className={styles.container}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className={styles.faqTitle}>
            Preguntas Frecuentes
          </h2>
          <p className={styles.faqDescription}>
            Resolvemos las dudas más comunes sobre nuestro entrenamiento de Swing Trading
          </p>
          
          <div className={styles.faqContainer}>
            {faqData.map((faq, index) => (
              <motion.div
                key={faq.id}
                className={styles.faqCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <button
                  className={styles.faqQuestion}
                  onClick={() => toggleFAQ(faq.id)}
                  aria-expanded={openFAQ === faq.id}
                >
                  <span className={styles.faqQuestionText}>{faq.question}</span>
                  <div className={styles.faqIcon}>
                    {openFAQ === faq.id ? (
                      <ChevronUp size={24} />
                    ) : (
                      <ChevronDown size={24} />
                    )}
                  </div>
                </button>
                
                <AnimatePresence>
                  {openFAQ === faq.id && (
                    <motion.div
                      className={styles.faqAnswer}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className={styles.faqAnswerContent}>
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQSection; 