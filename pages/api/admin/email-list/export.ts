import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import EmailList from '@/models/EmailList';

/**
 * API para exportar lista de emails a CSV
 * GET: Exportar todos los emails activos a CSV
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('📊 [EXPORT CSV] Método:', req.method);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Conectar a la base de datos
    await dbConnect();

    // Verificar que el usuario sea admin
    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador' });
    }

    console.log('✅ [EXPORT CSV] Acceso de admin confirmado para:', session.user.email);

    // Obtener todos los emails activos
    const emails = await EmailList.find({ isActive: true })
      .sort({ addedAt: -1 });

    console.log(`📊 [EXPORT CSV] Exportando ${emails.length} emails`);

    // Crear contenido CSV
    const csvHeaders = [
      'Email',
      'Fuente',
      'Fecha de Agregado',
      'Tags',
      'Notas',
      'Última Vez Usado'
    ];

    const csvRows = emails.map(email => [
      email.email,
      email.source === 'manual' ? 'Manual' : 
      email.source === 'registration' ? 'Registro' : 'Importado',
      email.addedAt.toISOString().split('T')[0], // Solo la fecha
      email.tags ? email.tags.join('; ') : '',
      email.notes || '',
      email.lastUsed ? email.lastUsed.toISOString().split('T')[0] : ''
    ]);

    // Crear contenido CSV completo
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => 
        row.map(field => {
          // Escapar comillas y envolver en comillas si contiene comas o comillas
          const escapedField = String(field).replace(/"/g, '""');
          return /[,"\n\r]/.test(escapedField) ? `"${escapedField}"` : escapedField;
        }).join(',')
      )
    ].join('\n');

    // Configurar headers para descarga
    const filename = `emails-export-${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Enviar archivo CSV
    res.status(200).send('\ufeff' + csvContent); // BOM para UTF-8

    console.log('✅ [EXPORT CSV] Archivo CSV generado exitosamente:', filename);

  } catch (error) {
    console.error('❌ [EXPORT CSV] Error:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
