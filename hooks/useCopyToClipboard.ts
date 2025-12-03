import { useState, useCallback } from 'react';

interface CopyState {
  isVisible: boolean;
  itemName: string;
}

/**
 * Hook personalizado para manejar la copia al portapapeles
 * con notificación de confirmación
 */
export const useCopyToClipboard = () => {
  const [copyState, setCopyState] = useState<CopyState>({
    isVisible: false,
    itemName: ''
  });

  const copyToClipboard = useCallback(async (text: string, itemName: string) => {
    try {
      // Intentar usar la API moderna del navegador
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback para navegadores más antiguos o contextos no seguros
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Error al copiar:', err);
          throw new Error('No se pudo copiar al portapapeles');
        } finally {
          document.body.removeChild(textArea);
        }
      }

      // Mostrar notificación de éxito
      setCopyState({
        isVisible: true,
        itemName: itemName
      });

      // Log para debugging
      // console.log(`✅ Copiado al portapapeles: ${itemName} - ${text}`);

    } catch (error) {
      console.error('Error al copiar:', error);
      
      // Mostrar notificación de error
      setCopyState({
        isVisible: true,
        itemName: `Error al copiar ${itemName}`
      });
    }
  }, []);

  const hideNotification = useCallback(() => {
    setCopyState(prev => ({
      ...prev,
      isVisible: false
    }));
  }, []);

  return {
    copyToClipboard,
    hideNotification,
    isNotificationVisible: copyState.isVisible,
    notificationItemName: copyState.itemName
  };
};
