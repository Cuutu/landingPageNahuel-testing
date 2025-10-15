import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './HelpTooltip.module.css';

interface HelpTooltipProps {
  isVisible: boolean;
  text: string;
  targetElement: HTMLElement | null;
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({
  isVisible,
  text,
  targetElement
}) => {
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isVisible && targetElement && mounted) {
      const rect = targetElement.getBoundingClientRect();
      setPosition({
        top: rect.top - 140,
        right: window.innerWidth - rect.right + 50
      });
    }
  }, [isVisible, targetElement, mounted]);

  if (!mounted || !isVisible) return null;

  const tooltipContent = (
    <div 
      className={styles.tooltip}
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`
      }}
    >
      {text}
    </div>
  );

  return createPortal(tooltipContent, document.body);
};

export default HelpTooltip;

