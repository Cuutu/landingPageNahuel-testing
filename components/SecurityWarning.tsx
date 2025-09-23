import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface SecurityWarningProps {
  message?: string;
  duration?: number;
}

const SecurityWarning: React.FC<SecurityWarningProps> = ({ 
  message = "Acción no permitida por seguridad", 
  duration = 3000 
}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState(message);

  useEffect(() => {
    const handleSecurityViolation = (e: Event) => {
      let violationMessage = message;
      
      // Detectar el tipo de violación
      if (e.type === 'contextmenu') {
        violationMessage = "Click derecho deshabilitado por seguridad";
      } else if (e.type === 'dragstart') {
        violationMessage = "Arrastrar elementos no está permitido";
      }
      
      setWarningMessage(violationMessage);
      setShowWarning(true);
      
      // Ocultar después del tiempo especificado
      setTimeout(() => { 
        setShowWarning(false);
      }, duration);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Solo interceptar combinaciones de teclas específicas, no escritura normal
      const target = e.target as HTMLElement;
      
      // Permitir escritura normal en inputs, textareas, contenteditable
      if (target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.contentEditable === 'true' ||
          target.isContentEditable) {
        return;
      }
      
      // Solo interceptar combinaciones de teclas específicas
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;
      
      // Combinaciones de teclas a bloquear
      const blockedCombinations = [
        // Ctrl/Cmd + teclas
        (isCtrlOrCmd && e.key === 'c'), // Ctrl+C
        (isCtrlOrCmd && e.key === 'v'), // Ctrl+V
        (isCtrlOrCmd && e.key === 'x'), // Ctrl+X
        (isCtrlOrCmd && e.key === 'a'), // Ctrl+A
        (isCtrlOrCmd && e.key === 'z'), // Ctrl+Z
        (isCtrlOrCmd && e.key === 'y'), // Ctrl+Y
        (isCtrlOrCmd && e.key === 's'), // Ctrl+S
        (isCtrlOrCmd && e.key === 'p'), // Ctrl+P
        (isCtrlOrCmd && e.key === 'u'), // Ctrl+U 
        (isCtrlOrCmd && e.key === 'f'), // Ctrl+F
        (isCtrlOrCmd && e.key === 'd'), // Ctrl+D
        (isCtrlOrCmd && e.key === 'r'), // Ctrl+R
        (isCtrlOrCmd && e.key === 'n'), // Ctrl+N
        (isCtrlOrCmd && e.key === 't'), // Ctrl+T
        (isCtrlOrCmd && e.key === 'w'), // Ctrl+W
        (isCtrlOrCmd && e.key === 'l'), // Ctrl+L
        (isCtrlOrCmd && e.key === 'k'), // Ctrl+K
        (isCtrlOrCmd && e.key === 'j'), // Ctrl+J
        (isCtrlOrCmd && e.key === 'h'), // Ctrl+H
        (isCtrlOrCmd && e.key === 'g'), // Ctrl+G
        (isCtrlOrCmd && e.key === 'b'), // Ctrl+B
        (isCtrlOrCmd && e.key === 'i'), // Ctrl+I
        (isCtrlOrCmd && e.key === 'o'), // Ctrl+O
        (isCtrlOrCmd && e.key === 'm'), // Ctrl+M
        (isCtrlOrCmd && e.key === 'q'), // Ctrl+Q
        (isCtrlOrCmd && e.key === 'e'), // Ctrl+E
        (isCtrlOrCmd && e.key === 'w'), // Ctrl+W
        (isCtrlOrCmd && e.key === '1'), // Ctrl+1
        (isCtrlOrCmd && e.key === '2'), // Ctrl+2
        (isCtrlOrCmd && e.key === '3'), // Ctrl+3
        (isCtrlOrCmd && e.key === '4'), // Ctrl+4
        (isCtrlOrCmd && e.key === '5'), // Ctrl+5
        (isCtrlOrCmd && e.key === '6'), // Ctrl+6
        (isCtrlOrCmd && e.key === '7'), // Ctrl+7
        (isCtrlOrCmd && e.key === '8'), // Ctrl+8
        (isCtrlOrCmd && e.key === '9'), // Ctrl+9
        (isCtrlOrCmd && e.key === '0'), // Ctrl+0
        (isCtrlOrCmd && e.key === '-'), // Ctrl+-
        (isCtrlOrCmd && e.key === '='), // Ctrl+=
        (isCtrlOrCmd && e.key === '['), // Ctrl+[
        (isCtrlOrCmd && e.key === ']'), // Ctrl+]
        (isCtrlOrCmd && e.key === '\\'), // Ctrl+\
        (isCtrlOrCmd && e.key === ';'), // Ctrl+;
        (isCtrlOrCmd && e.key === "'"), // Ctrl+'
        (isCtrlOrCmd && e.key === ','), // Ctrl+,
        (isCtrlOrCmd && e.key === '.'), // Ctrl+.
        (isCtrlOrCmd && e.key === '/'), // Ctrl+/
        (isCtrlOrCmd && e.key === '`'), // Ctrl+`
        (isCtrlOrCmd && e.key === '~'), // Ctrl+~
        (isCtrlOrCmd && e.key === '!'), // Ctrl+!
        (isCtrlOrCmd && e.key === '@'), // Ctrl+@
        (isCtrlOrCmd && e.key === '#'), // Ctrl+#
        (isCtrlOrCmd && e.key === '$'), // Ctrl+$
        (isCtrlOrCmd && e.key === '%'), // Ctrl+%
        (isCtrlOrCmd && e.key === '^'), // Ctrl+^
        (isCtrlOrCmd && e.key === '&'), // Ctrl+&
        (isCtrlOrCmd && e.key === '*'), // Ctrl+*
        (isCtrlOrCmd && e.key === '('), // Ctrl+(
        (isCtrlOrCmd && e.key === ')'), // Ctrl+)
        (isCtrlOrCmd && e.key === '_'), // Ctrl+_
        (isCtrlOrCmd && e.key === '+'), // Ctrl++
        (isCtrlOrCmd && e.key === '{'), // Ctrl+{
        (isCtrlOrCmd && e.key === '}'), // Ctrl+}
        (isCtrlOrCmd && e.key === '|'), // Ctrl+|
        (isCtrlOrCmd && e.key === ':'), // Ctrl+:
        (isCtrlOrCmd && e.key === '"'), // Ctrl+"
        (isCtrlOrCmd && e.key === '<'), // Ctrl+<
        (isCtrlOrCmd && e.key === '>'), // Ctrl+>
        (isCtrlOrCmd && e.key === '?'), // Ctrl+?
        (isCtrlOrCmd && e.key === 'Tab'), // Ctrl+Tab
        (isCtrlOrCmd && e.key === 'Enter'), // Ctrl+Enter
        (isCtrlOrCmd && e.key === 'Backspace'), // Ctrl+Backspace
        (isCtrlOrCmd && e.key === 'Delete'), // Ctrl+Delete
        (isCtrlOrCmd && e.key === 'Insert'), // Ctrl+Insert
        (isCtrlOrCmd && e.key === 'Home'), // Ctrl+Home
        (isCtrlOrCmd && e.key === 'End'), // Ctrl+End
        (isCtrlOrCmd && e.key === 'PageUp'), // Ctrl+PageUp
        (isCtrlOrCmd && e.key === 'PageDown'), // Ctrl+PageDown
        (isCtrlOrCmd && e.key === 'ArrowUp'), // Ctrl+ArrowUp
        (isCtrlOrCmd && e.key === 'ArrowDown'), // Ctrl+ArrowDown
        (isCtrlOrCmd && e.key === 'ArrowLeft'), // Ctrl+ArrowLeft
        (isCtrlOrCmd && e.key === 'ArrowRight'), // Ctrl+ArrowRight
        (isCtrlOrCmd && e.key === 'F1'), // Ctrl+F1
        (isCtrlOrCmd && e.key === 'F2'), // Ctrl+F2
        (isCtrlOrCmd && e.key === 'F3'), // Ctrl+F3
        (isCtrlOrCmd && e.key === 'F4'), // Ctrl+F4
        (isCtrlOrCmd && e.key === 'F5'), // Ctrl+F5
        (isCtrlOrCmd && e.key === 'F6'), // Ctrl+F6
        (isCtrlOrCmd && e.key === 'F7'), // Ctrl+F7
        (isCtrlOrCmd && e.key === 'F8'), // Ctrl+F8
        (isCtrlOrCmd && e.key === 'F9'), // Ctrl+F9
        (isCtrlOrCmd && e.key === 'F10'), // Ctrl+F10
        (isCtrlOrCmd && e.key === 'F11'), // Ctrl+F11
        (isCtrlOrCmd && e.key === 'F12'), // Ctrl+F12
        // Shift + teclas
        (isShift && e.key === 'F10'), // Shift+F10 (menú contextual)
        (isShift && e.key === 'Insert'), // Shift+Insert
        (isShift && e.key === 'Delete'), // Shift+Delete
        (isShift && e.key === 'Home'), // Shift+Home
        (isShift && e.key === 'End'), // Shift+End
        (isShift && e.key === 'PageUp'), // Shift+PageUp
        (isShift && e.key === 'PageDown'), // Shift+PageDown
        (isShift && e.key === 'ArrowUp'), // Shift+ArrowUp
        (isShift && e.key === 'ArrowDown'), // Shift+ArrowDown
        (isShift && e.key === 'ArrowLeft'), // Shift+ArrowLeft
        (isShift && e.key === 'ArrowRight'), // Shift+ArrowRight
        // Alt + teclas
        (isAlt && e.key === 'F4'), // Alt+F4
        (isAlt && e.key === 'Tab'), // Alt+Tab
        (isAlt && e.key === 'Enter'), // Alt+Enter
        (isAlt && e.key === 'Backspace'), // Alt+Backspace
        (isAlt && e.key === 'Delete'), // Alt+Delete
        (isAlt && e.key === 'Home'), // Alt+Home
        (isAlt && e.key === 'End'), // Alt+End
        (isAlt && e.key === 'PageUp'), // Alt+PageUp
        (isAlt && e.key === 'PageDown'), // Alt+PageDown
        (isAlt && e.key === 'ArrowUp'), // Alt+ArrowUp
        (isAlt && e.key === 'ArrowDown'), // Alt+ArrowDown
        (isAlt && e.key === 'ArrowLeft'), // Alt+ArrowLeft
        (isAlt && e.key === 'ArrowRight'), // Alt+ArrowRight
        // F1-F12 solos
        e.key === 'F1',
        e.key === 'F2',
        e.key === 'F3',
        e.key === 'F4',
        e.key === 'F5',
        e.key === 'F6',
        e.key === 'F7',
        e.key === 'F8',
        e.key === 'F9',
        e.key === 'F10',
        e.key === 'F11',
        e.key === 'F12',
        // Teclas de función especiales
        e.key === 'PrintScreen',
        e.key === 'ScrollLock',
        e.key === 'Pause',
        e.key === 'Insert',
        e.key === 'Home',
        e.key === 'End',
        e.key === 'PageUp',
        e.key === 'PageDown',
        e.key === 'NumLock',
        e.key === 'CapsLock',
        e.key === 'ContextMenu'
      ];
      
      // Verificar si la combinación está bloqueada
      const isBlocked = blockedCombinations.some(combination => combination);
      
      if (isBlocked) {
        const violationMessage = "Combinación de teclas no permitida por seguridad";
        setWarningMessage(violationMessage);
        setShowWarning(true);
        
        // Ocultar después del tiempo especificado
        setTimeout(() => { 
          setShowWarning(false);
        }, duration);
      }
    };

    // Escuchar eventos de seguridad
    document.addEventListener('contextmenu', handleSecurityViolation);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', handleSecurityViolation);

    return () => {
      document.removeEventListener('contextmenu', handleSecurityViolation);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleSecurityViolation);
    };
  }, [message, duration]);

  // Cerrar modal con Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showWarning) {
        setShowWarning(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showWarning]);

  if (!showWarning) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.3s ease-out'
      }}
      onClick={() => setShowWarning(false)}
    >
      <div 
        style={{
          background: 'linear-gradient(135deg, #6b46c1 0%, #4c1d95 100%)',
          color: 'white',
          padding: '2.5rem',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          border: '2px solid #8b5cf6',
          maxWidth: '28rem',
          margin: '0 1rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          animation: 'zoomIn 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Efecto de brillo en el fondo */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
            animation: 'pulse 2s infinite'
          }}
        />
        
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
          {/* Icono de advertencia con animación */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '5rem',
              height: '5rem',
              backgroundColor: '#374151',
              borderRadius: '50%',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
              animation: 'pulse 2s infinite'
            }}
          >
            <AlertTriangle size={40} style={{ color: '#8b5cf6' }} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: 'white',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
            }}>
              ⚠️ Advertencia de Seguridad
            </h3>
            <p style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: 'white',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
            }}>
              {warningMessage}
            </p>
            <p style={{ 
              fontSize: '1rem', 
              color: '#fecaca',
              lineHeight: '1.6'
            }}>
              Esta acción no está permitida por razones de seguridad del sitio. 
              Por favor, respeta las políticas de seguridad establecidas.
            </p>
          </div>
          
          <button
            onClick={() => setShowWarning(false)}
            style={{
              padding: '1rem 2rem',
              backgroundColor: '#374151',
              color: 'white',
              fontWeight: 'bold',
              borderRadius: '0.75rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease',
              transform: 'scale(1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1f2937';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#374151';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            aria-label="Cerrar advertencia de seguridad"
          >
            <X size={24} />
            Entendido
          </button>
          
          {/* Texto de ayuda */}
          <p style={{ 
            fontSize: '0.75rem', 
            color: '#d1d5db',
            marginTop: '1rem'
          }}>
            Presiona ESC o haz clic fuera para cerrar
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
};

export default SecurityWarning; 