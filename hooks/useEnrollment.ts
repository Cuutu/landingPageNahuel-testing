import { useState, useEffect } from 'react';
import { Session } from 'next-auth';
import { signIn } from 'next-auth/react';
import { toast } from 'react-hot-toast';

interface FormData {
  nombre: string;
  email: string;
  telefono: string;
  experienciaTrading: string;
  objetivos: string;
  nivelExperiencia: string;
  consulta: string;
}

export const useEnrollment = (session: Session | null, trainingType: string) => {
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [checkingEnrollment, setCheckingEnrollment] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    email: '',
    telefono: '',
    experienciaTrading: '',
    objetivos: '',
    nivelExperiencia: 'principiante',
    consulta: ''
  });

  useEffect(() => {
    if (session?.user) {
      setFormData(prev => ({
        ...prev,
        nombre: session.user.name || '',
        email: session.user.email || ''
      }));
      
      // Verificar si el usuario ya está inscrito
      checkEnrollmentStatus();
    }
  }, [session]);

  const checkEnrollmentStatus = async () => {
    if (!session?.user?.email) return;
    
    setCheckingEnrollment(true);
    try {
      const response = await fetch('/api/user/entrenamientos');
      if (response.ok) {
        const data = await response.json();
        const hasTraining = data.data.tiposDisponibles.includes(trainingType);
        setIsEnrolled(hasTraining);
      }
    } catch (error) {
      console.error('Error checking enrollment:', error);
    } finally {
      setCheckingEnrollment(false);
    }
  };

  const handleEnroll = async () => {
    if (!session) {
      toast.error('Debes iniciar sesión primero para inscribirte');
      signIn('google');
      return;
    }
    
    if (isEnrolled) {
      // Si ya está inscrito, ir directamente a las lecciones
      window.location.href = `/entrenamientos/${trainingType}/lecciones`;
      return;
    }
    
    // Iniciar proceso de pago con MercadoPago
    setIsProcessingPayment(true);
    
    try {
      // Obtener precio dinámico desde /api/pricing
      const pricingRes = await fetch('/api/pricing');
      let dynamicAmount = 0;
      let dynamicCurrency: string = 'ARS';
      if (pricingRes.ok) {
        const pricingData = await pricingRes.json();
        const p = pricingData?.data;
        if (p) {
          dynamicCurrency = p.currency || 'ARS';
          if (trainingType === 'SwingTrading') {
            dynamicAmount = p.entrenamientos?.swingTrading?.price || 0;
          } else if (trainingType === 'DowJones') {
            dynamicAmount = p.entrenamientos?.advanced?.price || 0;
          }
        }
      }

      const response = await fetch('/api/payments/mercadopago/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          type: 'training',
          service: trainingType,
          amount: dynamicAmount,
          currency: dynamicCurrency
        }),
      });

      const data = await response.json();

      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error(data.error || 'Error al procesar el pago');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar el pago. Inténtalo nuevamente.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleSubmitEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEnrolling(true);

    try {
      const response = await fetch('/api/entrenamientos/inscribir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipo: trainingType,
          ...formData
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || '¡Inscripción exitosa! Redirigiendo a las lecciones...');
        setShowEnrollForm(false);
        
        // Resetear formulario
        setFormData({
          nombre: session?.user?.name || '',
          email: session?.user?.email || '',
          telefono: '',
          experienciaTrading: '',
          objetivos: '',
          nivelExperiencia: 'principiante',
          consulta: ''
        });

        // Redirigir a las lecciones después de 2 segundos
        setTimeout(() => {
          window.location.href = data.data.redirectUrl;
        }, 2000);
      } else {
        if (response.status === 409) {
          // Ya está inscrito
          toast.success('Ya tienes acceso a este entrenamiento. Redirigiendo a las lecciones...');
          setTimeout(() => {
            window.location.href = `/entrenamientos/${trainingType}/lecciones`;
          }, 1500);
        } else {
          toast.error(data.error || 'Error al procesar inscripción');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar inscripción. Inténtalo nuevamente.');
    } finally {
      setIsEnrolling(false);
    }
  };

  return {
    isEnrolled,
    checkingEnrollment,
    isProcessingPayment,
    handleEnroll,
    showEnrollForm,
    setShowEnrollForm,
    formData,
    setFormData,
    handleSubmitEnrollment,
    isEnrolling
  };
}; 