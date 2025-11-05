/**
 * Utilidades para convertir entre texto plano y HTML
 */

/**
 * Convierte HTML básico a texto plano
 * Convierte <br>, <p>, y otros elementos básicos a saltos de línea
 */
export function htmlToText(html: string): string {
  if (!html) return '';

  // Método 1: Usar DOMParser en el cliente (más robusto)
  if (typeof window !== 'undefined') {
    try {
      // Crear un elemento temporal en el DOM
      const tempDiv = document.createElement('div');
      
      // Pre-procesar el HTML para preservar saltos de línea
      let processedHtml = html
        // Agregar saltos de línea antes de cerrar párrafos y divs
        .replace(/<\/p>/gi, '\n\n</p>')
        .replace(/<\/div>/gi, '\n</div>')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n</h1>')
        .replace(/<\/li>/gi, '\n</li>');
      
      tempDiv.innerHTML = processedHtml;
      
      // Obtener el texto preservando la estructura
      let text = tempDiv.innerText || tempDiv.textContent || '';
      
      // Limpiar espacios excesivos pero preservar saltos de línea intencionales
      text = text
        .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos consecutivos
        .replace(/[ \t]+/g, ' ') // Múltiples espacios a uno solo
        .replace(/^\s+$/gm, '') // Líneas con solo espacios
        .trim();
      
      // Limpiar el elemento temporal
      tempDiv.remove();
      
      return text;
    } catch (error) {
      console.warn('Error parsing HTML with DOM, falling back to regex:', error);
    }
  }

  // Método 2: Fallback usando regex (para SSR o si falla el método 1)
  let text = html
    // Primero convertir saltos de línea HTML a saltos de línea reales
    // Importante: agregar doble salto para párrafos
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<h[1-6][^>]*>/gi, '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '')
    // Remover TODAS las etiquetas HTML restantes
    .replace(/<[^>]+>/g, '')
    // Decodificar entidades HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'")
    // Limpiar espacios excesivos pero preservar estructura
    .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos consecutivos
    .replace(/[ \t]+/g, ' ') // Múltiples espacios a uno solo
    .replace(/^\s+$/gm, '') // Líneas con solo espacios
    .trim();
  
  return text;
}

/**
 * Convierte texto plano a HTML básico
 * Convierte saltos de línea dobles a párrafos y simples a <br>
 */
export function textToHtml(text: string): string {
  if (!text) return '';

  // Dividir el texto en párrafos (separados por doble salto de línea)
  const paragraphs = text
    .split(/\n\n+/)
    .filter(p => p.trim() !== '');

  // Procesar cada párrafo
  const htmlParagraphs = paragraphs.map(paragraph => {
    // Codificar entidades HTML
    let encoded = paragraph
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // Convertir saltos de línea simples a <br>
    encoded = encoded.replace(/\n/g, '<br>');
    
    // Envolver en etiquetas <p>
    return `<p>${encoded}</p>`;
  });

  return htmlParagraphs.join('');
}

/**
 * Limpia HTML manteniendo solo etiquetas básicas permitidas
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  return html
    // Permitir solo etiquetas básicas
    .replace(/<\/?[^>]+(>|$)/g, (tag) => {
      const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span'];
      const tagName = tag.replace(/<\/?([a-zA-Z]+)[^>]*>/, '$1').toLowerCase();

      if (allowedTags.includes(tagName)) {
        return tag;
      }

      // Para <br>, asegurar que sea <br>
      if (tagName === 'br') {
        return '<br>';
      }

      return '';
    })
    .trim();
}
