import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  DollarSign, 
  Clock, 
  Plus,
  Trash2,
  Save
} from 'lucide-react';
import AdminRouteGuard from '../../../../components/AdminRouteGuard';
import styles from '../../../../styles/admin/MonthlyTrainings.module.css';

interface TrainingClass {
  _id?: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  meetLink?: string;
}

interface MonthlyTraining {
  _id: string;
  title: string;
  description: string;
  month: number;
  year: number;
  monthName: string;
  maxStudents: number;
  price: number;
  classes: TrainingClass[];
  status: 'draft' | 'open' | 'full' | 'in-progress' | 'completed' | 'cancelled';
  registrationOpenDate: string;
  registrationCloseDate: string;
  createdAt: string;
  createdBy: string;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'open', label: 'Abierto' },
  { value: 'full', label: 'Lleno' },
  { value: 'in-progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' }
];

export default function EditMonthlyTraining() {
  const router = useRouter();
  const { trainingId } = router.query;
  const { data: session, status } = useSession();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [training, setTraining] = useState<MonthlyTraining | null>(null);
  
  // Estados del formulario
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    maxStudents: 15,
    price: 0,
    status: 'draft' as MonthlyTraining['status'],
    registrationOpenDate: '',
    registrationCloseDate: ''
  });

  const [classes, setClasses] = useState<TrainingClass[]>([]);

  useEffect(() => {
    if (trainingId && status === 'authenticated') {
      loadTraining();
    }
  }, [trainingId, status]);

  const loadTraining = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/monthly-trainings?id=${trainingId}`);
      const data = await response.json();
      
      if (data.success && data.data.length > 0) {
        const trainingData = data.data[0];
        setTraining(trainingData);
        
        // Llenar el formulario con los datos existentes
        setFormData({
          title: trainingData.title,
          description: trainingData.description,
          month: trainingData.month,
          year: trainingData.year,
          maxStudents: trainingData.maxStudents,
          price: trainingData.price,
          status: trainingData.status,
          registrationOpenDate: trainingData.registrationOpenDate.split('T')[0],
          registrationCloseDate: trainingData.registrationCloseDate.split('T')[0]
        });
        
        setClasses(trainingData.classes || []);
      } else {
        alert('Entrenamiento no encontrado');
        router.push('/admin/monthly-trainings');
      }
    } catch (error) {
      console.error('Error cargando entrenamiento:', error);
      alert('Error cargando entrenamiento');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddClass = () => {
    const newClass: TrainingClass = {
      date: '',
      startTime: '19:00',
      endTime: '21:00',
      title: `Clase ${classes.length + 1}`,
      description: '',
      status: 'scheduled',
      meetLink: ''
    };
    
    setClasses(prev => [...prev, newClass]);
  };

  const handleClassChange = (index: number, field: keyof TrainingClass, value: string) => {
    setClasses(prev => prev.map((cls, i) => 
      i === index ? { ...cls, [field]: value } : cls
    ));
  };

  const handleRemoveClass = (index: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta clase?')) {
      setClasses(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('El título es requerido');
      return;
    }
    
    if (!formData.description.trim()) {
      alert('La descripción es requerida');
      return;
    }
    
    if (classes.length === 0) {
      alert('Debe agregar al menos una clase');
      return;
    }
    
    // Validar que todas las clases tengan fecha
    const invalidClasses = classes.some(cls => !cls.date || !cls.title.trim());
    if (invalidClasses) {
      alert('Todas las clases deben tener fecha y título');
      return;
    }

    setSaving(true);
    
    try {
      const response = await fetch('/api/admin/monthly-trainings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: trainingId,
          ...formData,
          classes: classes.map(cls => ({
            ...cls,
            date: new Date(cls.date).toISOString()
          }))
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Entrenamiento actualizado exitosamente');
        router.push(`/admin/monthly-trainings/${trainingId}`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error actualizando entrenamiento:', error);
      alert('Error actualizando entrenamiento');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingCard}>
          <p>Cargando entrenamiento...</p>
        </div>
      </div>
    );
  }

  if (!training) {
    return (
      <div className={styles.container}>
        <div className="text-center">
          <h2>Entrenamiento no encontrado</h2>
          <Link href="/admin/monthly-trainings" className={styles.createButton}>
            Volver a Entrenamientos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminRouteGuard>
      <div className={styles.container}>
        <Head>
          <title>Editar Entrenamiento - {training.title}</title>
        </Head>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Link href={`/admin/monthly-trainings/${trainingId}`} className={styles.backLink}>
              <ArrowLeft size={20} />
              Volver al Entrenamiento
            </Link>
            <h1>Editar Entrenamiento</h1>
            <p>Modifica los detalles del entrenamiento mensual</p>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Información Básica */}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Título *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Swing Trading - Enero 2024"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Estado</label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Mes *</label>
              <select
                value={formData.month}
                onChange={(e) => handleInputChange('month', parseInt(e.target.value))}
                required
              >
                {MONTHS.map((month, index) => (
                  <option key={index + 1} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Año *</label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                min={new Date().getFullYear()}
                max={new Date().getFullYear() + 2}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Precio (USD) *</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => handleInputChange('price', parseFloat(e.target.value))}
                min={0}
                step={0.01}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Máximo Estudiantes *</label>
              <input
                type="number"
                value={formData.maxStudents}
                onChange={(e) => handleInputChange('maxStudents', parseInt(e.target.value))}
                min={1}
                max={50}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Fecha Apertura Inscripciones *</label>
              <input
                type="date"
                value={formData.registrationOpenDate}
                onChange={(e) => handleInputChange('registrationOpenDate', e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Fecha Cierre Inscripciones *</label>
              <input
                type="date"
                value={formData.registrationCloseDate}
                onChange={(e) => handleInputChange('registrationCloseDate', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Descripción */}
          <div className={styles.formGroup}>
            <label>Descripción *</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe el contenido y objetivos del entrenamiento..."
              rows={4}
              required
            />
          </div>

          {/* Sección de Clases */}
          <div className={styles.classesSection}>
            <div className={styles.classesSectionHeader}>
              <h3>Clases del Entrenamiento ({classes.length})</h3>
              <button
                type="button"
                onClick={handleAddClass}
                className={styles.addClassButton}
              >
                <Plus size={16} />
                Agregar Clase
              </button>
            </div>

            {classes.length === 0 ? (
              <div className={styles.emptyClasses}>
                <Calendar size={48} />
                <h4>No hay clases programadas</h4>
                <p>Agrega al menos una clase para completar el entrenamiento</p>
              </div>
            ) : (
              classes.map((classItem, index) => (
                <div key={index} className={styles.classItem}>
                  <div className={styles.classHeader}>
                    <h4>Clase {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => handleRemoveClass(index)}
                      className={styles.removeClassButton}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className={styles.classGrid}>
                    <div className={styles.formGroup}>
                      <label>Título de la Clase *</label>
                      <input
                        type="text"
                        value={classItem.title}
                        onChange={(e) => handleClassChange(index, 'title', e.target.value)}
                        placeholder={`Clase ${index + 1}`}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>Fecha *</label>
                      <input
                        type="date"
                        value={classItem.date ? classItem.date.split('T')[0] : ''}
                        onChange={(e) => handleClassChange(index, 'date', e.target.value)}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>Hora Inicio *</label>
                      <input
                        type="time"
                        value={classItem.startTime}
                        onChange={(e) => handleClassChange(index, 'startTime', e.target.value)}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>Hora Fin *</label>
                      <input
                        type="time"
                        value={classItem.endTime}
                        onChange={(e) => handleClassChange(index, 'endTime', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Descripción</label>
                    <textarea
                      value={classItem.description || ''}
                      onChange={(e) => handleClassChange(index, 'description', e.target.value)}
                      placeholder="Descripción opcional de la clase..."
                      rows={2}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Link de la Reunión</label>
                    <input
                      type="url"
                      value={classItem.meetLink || ''}
                      onChange={(e) => handleClassChange(index, 'meetLink', e.target.value)}
                      placeholder="https://meet.google.com/..."
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Acciones del Formulario */}
          <div className={styles.formActions}>
            <Link 
              href={`/admin/monthly-trainings/${trainingId}`}
              className={styles.cancelButton}
            >
              Cancelar
            </Link>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </AdminRouteGuard>
  );
}
