/**
 * Utilidades para convertir entre texto plano y HTML
 */

/**
 * Convierte HTML básico a texto plano
 * Convierte <br>, <p>, y otros elementos básicos a saltos de línea
 */
export function htmlToText(html: string): string {
  if (!html) return '';

  return html
    // Convertir <br> y <br/> a saltos de línea
    .replace(/<br\s*\/?>/gi, '\n')
    // Convertir </p> a salto de línea
    .replace(/<\/p>/gi, '\n')
    // Remover etiquetas <p> de apertura
    .replace(/<p[^>]*>/gi, '')
    // Convertir <div> a saltos de línea
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    // Remover otras etiquetas HTML comunes
    .replace(/<\/?[^>]+(>|$)/g, '')
    // Decodificar entidades HTML comunes
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Limpiar espacios y saltos de línea múltiples
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Convierte texto plano a HTML básico
 * Convierte saltos de línea dobles a párrafos y simples a <br>
 */
export function textToHtml(text: string): string {
  if (!text) return '';

  return text
    // Codificar entidades HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Convertir saltos de línea dobles a párrafos
    .replace(/\n\n+/g, '</p><p>')
    // Convertir saltos de línea simples a <br>
    .replace(/\n/g, '<br>')
    // Envolver en etiquetas <p> si no están ya
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    // Limpiar párrafos vacíos
    .replace(/<p><\/p>/g, '')
    .replace(/<p><br><\/p>/g, '')
    // Limpiar etiquetas <p> vacías al final
    .replace(/<p>$/, '')
    .replace(/^<\/p>/, '');
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
