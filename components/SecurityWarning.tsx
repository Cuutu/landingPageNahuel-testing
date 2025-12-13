import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { AlertTriangle, X } from 'lucide-react';

interface SecurityWarningProps {
  message?: string;
  duration?: number;
}

/**
 * ✅ OPTIMIZADO: Modal de advertencia solo en páginas protegidas
 * Se activa solo en:
 * - /alertas/trader-call
 * - /alertas/smart-money
 */
const SecurityWarning: React.FC<SecurityWarningProps> = ({ 
  message = "Acción no permitida por seguridad", 
  duration = 3000 
}) => {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState(message);

  // Verificar si estamos en página protegida
  const isProtectedPage = useMemo(() => {
    const protectedPaths = [
      '/alertas/trader-call', 
      '/alertas/smart-money',
    ];
    
    return protectedPaths.some(path => 
      router.pathname === path || router.pathname.startsWith(path + '/')
    );
  }, [router.pathname]);

  useEffect(() => {
    // Si NO es página protegida, no activar listeners
    if (!isProtectedPage) {
      return;
    }

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

    // ✅ OPTIMIZADO: Solo bloquear teclas críticas para evitar screenshots
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      
      // Permitir escritura en formularios
      if (target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.contentEditable === 'true') {
        return;
      }
      
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      
      // Solo bloquear: PrintScreen, Ctrl+P (imprimir), Ctrl+S (guardar)
      const shouldBlock = 
        e.key === 'PrintScreen' ||
        (isCtrlOrCmd && key === 'p') ||
        (isCtrlOrCmd && key === 's');
      
      if (shouldBlock) {
        e.preventDefault();
        setWarningMessage("Esta acción no está permitida");
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), duration);
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
  }, [message, duration, isProtectedPage]);

  // Cerrar modal con Escape
  useEffect(() => {
    if (!isProtectedPage) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showWarning) {
        setShowWarning(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showWarning, isProtectedPage]);

  // No renderizar si no es página protegida o si no hay warning
  if (!isProtectedPage || !showWarning) return null;

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