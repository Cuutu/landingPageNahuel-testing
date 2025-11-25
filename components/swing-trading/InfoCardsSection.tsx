import React from 'react';
import { motion } from 'framer-motion';
import styles from '../../styles/SwingTrading.module.css';

const InfoCardsSection: React.FC = () => {
  return (
    <section className={styles.infoCardsSection}>
      <div className={styles.infoCardsContainer}>
        {/* Card 1: ¿Por qué realizar este entrenamiento? */}
        <motion.div 
          className={styles.infoCard}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h3 className={styles.infoCardTitle}>
            ¿Por qué realizar este entrenamiento?
          </h3>
          <ul className={styles.infoCardList}>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>🎯</span>
              <span className={styles.infoCardText}>Porque hay que aplicar el análisis correcto</span>
            </li>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>✅</span>
              <span className={styles.infoCardText}>Necesitás una estrategia efectiva</span>
            </li>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>🔧</span>
              <span className={styles.infoCardText}>Método probado con guía paso a paso</span>
            </li>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>⏰</span>
              <span className={styles.infoCardText}>Ahorras tiempo, dinero y energía</span>
            </li>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>🚀</span>
              <span className={styles.infoCardText}>Transforma la teoría en resultados</span>
            </li>
          </ul>
        </motion.div>

        {/* Card 2: ¿Para quién es esta experiencia? */}
        <motion.div 
          className={styles.infoCard}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h3 className={styles.infoCardTitle}>
            ¿Para quién es esta experiencia?
          </h3>
          <ul className={styles.infoCardList}>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>📚</span>
              <span className={styles.infoCardText}>Para quienes ya saben análisis técnico</span>
            </li>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>✅</span>
              <span className={styles.infoCardText}>Traders que buscan resultados sostenibles</span>
            </li>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>📈</span>
              <span className={styles.infoCardText}>Quienes operan sin una estrategia eficaz</span>
            </li>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>💼</span>
              <span className={styles.infoCardText}>Personas comprometidas con la disciplina</span>
            </li>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>🧠</span>
              <span className={styles.infoCardText}>Para los que quieran operar con criterio</span>
            </li>
          </ul>
        </motion.div>

        {/* Card 3: ¿Cómo es el entrenamiento? */}
        <motion.div 
          className={styles.infoCard}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h3 className={styles.infoCardTitle}>
            ¿Cómo es el entrenamiento?
          </h3>
          <ul className={styles.infoCardList}>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>⏰</span>
              <span className={styles.infoCardText}>3 meses de entrenamiento intensivo</span>
            </li>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>💻</span>
              <span className={styles.infoCardText}>Clases semanales y en vivo 100% online</span>
            </li>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>🔍</span>
              <span className={styles.infoCardText}>Espacio para análisis de dudas y evolución</span>
            </li>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>📂</span>
              <span className={styles.infoCardText}>Material descargable y herramientas útiles</span>
            </li>
            <li className={styles.infoCardItem}>
              <span className={styles.infoCardIcon}>👥</span>
              <span className={styles.infoCardText}>Grupo chico y con seguimiento constante</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </section>
  );
};

export default InfoCardsSection; 