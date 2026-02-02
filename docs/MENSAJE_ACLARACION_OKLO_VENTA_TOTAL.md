# Mensaje de aclaración – Venta OKLO (Venta TOTAL)

**Uso:** Podés enviar este texto desde el panel de administrador como resumen de operaciones o notificación masiva (email/Telegram) para aclarar a los usuarios que la venta de OKLO fue TOTAL (100%) y que hubo un error solo en el texto de la notificación anterior.

---

## Cómo enviar el mensaje a TODOS los usuarios de Trader Call

1. **Entrá al panel de admin:** `/admin/email/bulk` (Envío masivo de emails).

2. **Configurá los destinatarios:**
   - **Destinatarios:** elegí **"Todos los usuarios"** o **"Solo suscriptores"**.
   - **Filtrar por Servicio de Alertas:** elegí **"Trader Call"**.
   - Así el mensaje llega solo a usuarios con suscripción activa a Trader Call (y que estén en la lista de emails del sistema).

3. **Asunto del email:**  
   `Aclaración – Venta OKLO fue TOTAL (100%)`

4. **Mensaje:** copiá y pegá la "Versión para enviar" que está más abajo (o la versión corta si preferís).

5. **Opcional:** si querés un botón (ej. "Ver operaciones"), configurá texto y URL. Para solo aclaración podés dejarlo en blanco o usar "Visitar Sitio Web" con la URL de Trader Call.

6. **Enviar:** hacé clic en el botón de envío masivo. El sistema enviará el email a todos los destinatarios que cumplan el filtro (Trader Call).

**Nota:** El envío masivo usa la lista de emails del sistema. Solo reciben el mail los usuarios que tengan suscripción activa a Trader Call y estén dados de alta en esa lista. Si algún usuario de Trader Call no está en la lista, no lo recibirá hasta que lo agregues desde la misma sección de admin.

**Telegram:** Si además querés avisar por el canal de Telegram de Trader Call, podés publicar ahí la "Versión corta" del mensaje (más abajo) como si fuera un resumen o aclaración del equipo.

---

## Script para F12 (consola del navegador)

Podés copiar y pegar este script en la consola (F12 → Console) **mientras estés logueado como admin** en tu sitio (misma pestaña, mismo dominio). Envía el email de aclaración a todos los usuarios de Trader Call en un solo paso.

**Pasos:**
1. Entrá a tu sitio como administrador (ej. `https://tu-dominio.com/admin` o `/admin/email/bulk`).
2. Abrí la consola: F12 → pestaña **Console**.
3. Pegá el script completo y apretá Enter.
4. Revisá en la consola el resultado (cuántos emails se enviaron o si hubo error).

```javascript
(async function enviarAclaracionOKLOTraderCall() {
  const baseUrl = window.location.origin;
  const subject = 'Aclaración – Venta OKLO fue TOTAL (100%)';
  const message = `📊 Resumen de Operaciones – Aclaración

Hola,

Les escribimos para aclarar una notificación enviada el 02/02/2026 sobre la venta de OKLO.

🔴 VENTA OKLO – ACLARACIÓN

• La operación de venta de OKLO a precio de cierre $75.18 fue una VENTA TOTAL (100%) – se cerró la posición completa.
• En el resumen del día, el sistema mostró por error «Venta parcial (50%)» en lugar de «Venta TOTAL – Posición cerrada».
• El error fue solo en el texto del mail y de Telegram; la ejecución en sistema fue correcta (100% vendido, posición cerrada).

Resumen correcto de la operación:
• OKLO: Venta TOTAL – Posición cerrada a $75.18
• La posición quedó cerrada en su totalidad.

Cualquier duda, estamos a disposición.

Saludos,
`;

  try {
    const res = await fetch(baseUrl + '/api/admin/email/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientType: 'all',
        serviceFilter: 'TraderCall',
        subject: subject,
        message: message,
        recipients: 'all'
      })
    });
    const data = await res.json();
    if (res.ok) {
      console.log('✅ Envío OK:', data.message || data);
      if (data.results) console.log('📧 Enviados:', data.results.sent, '| Fallidos:', data.results.failed, '| Total destinatarios:', data.results.total);
    } else {
      console.error('❌ Error:', data.error || data);
    }
    return data;
  } catch (e) {
    console.error('❌ Error de red:', e);
    return null;
  }
})();
```

**Importante:** Tenés que estar en la misma pestaña y dominio del sitio (ej. `https://lozanonahuel.com`) y logueado como admin para que la cookie de sesión se envíe y la API acepte la petición.

---

## Script DRY_RUN (solo probar, no envía emails)

Mismo uso que el script anterior, pero **no envía ningún email**: solo consulta cuántos destinatarios hay y los lista. Sirve para probar que el filtro Trader Call y la sesión de admin funcionan.

1. Entrá como admin en tu sitio.
2. F12 → Console.
3. Pegá este script y Enter.

```javascript
(async function dryRunAclaracionOKLO() {
  const baseUrl = window.location.origin;
  try {
    const res = await fetch(baseUrl + '/api/admin/email/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientType: 'all',
        serviceFilter: 'TraderCall',
        subject: 'Aclaración – Venta OKLO fue TOTAL (100%)',
        message: '(DRY RUN - mensaje no enviado)',
        recipients: 'all',
        dryRun: true
      })
    });
    const data = await res.json();
    if (res.ok && data.dryRun) {
      console.log('✅ DRY RUN OK:', data.message);
      console.log('📧 Cantidad de destinatarios:', data.recipientCount);
      console.log('📋 Lista de emails:', data.recipients);
    } else {
      console.error('❌ Error:', data.error || data);
    }
    return data;
  } catch (e) {
    console.error('❌ Error de red:', e);
    return null;
  }
})();
```

Cuando estés conforme con el número y la lista, usá el script **sin** `dryRun` (el primero) para enviar de verdad.

---

## Versión para enviar (resumen de operaciones)

```
📊 Resumen de Operaciones – Aclaración

Hola,

Les escribimos para aclarar una notificación enviada el 02/02/2026 sobre la venta de OKLO.

🔴 VENTA OKLO – ACLARACIÓN

• La operación de venta de OKLO a precio de cierre $75.18 fue una **VENTA TOTAL (100%)** – se cerró la posición completa.
• En el resumen del día, el sistema mostró por error «Venta parcial (50%)» en lugar de «Venta TOTAL – Posición cerrada».
• El error fue solo en el texto del mail y de Telegram; la ejecución en sistema fue correcta (100% vendido, posición cerrada).

Resumen correcto de la operación:
• OKLO: **Venta TOTAL – Posición cerrada** a $75.18
• La posición quedó cerrada en su totalidad.

Ya corregimos el sistema para que en adelante las ventas totales se indiquen siempre como «Venta TOTAL – Posición cerrada» en el resumen.

Cualquier duda, estamos a disposición.

Saludos,
[Tu nombre / Equipo]
```

---

## Versión corta (para Telegram o mensaje breve)

```
📊 Aclaración – OKLO

La venta de OKLO del 02/02 a $75.18 fue **VENTA TOTAL (100%)** – posición cerrada. El resumen del día mostró por error «Venta parcial (50%)»; solo falló el texto de la notificación, la operación fue correcta. Disculpas por la confusión.
```

---

## Versión solo título + cuerpo (para email con asunto)

**Asunto:** Aclaración – Venta OKLO fue TOTAL (100%)

**Cuerpo:** Usar la “Versión para enviar” de arriba.
