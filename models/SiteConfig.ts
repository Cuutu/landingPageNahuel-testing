import mongoose, { Schema, Document } from 'mongoose';

interface SiteConfigDocument extends Document {
  _id: string;
  heroVideo: {
    youtubeId: string;
    title: string;
    description: string;
    thumbnail?: string;
    autoplay: boolean;
    muted: boolean;
    loop: boolean;
    volume?: number;
  };
  learningVideo: {
    youtubeId: string;
    title: string;
    description: string;
    thumbnail?: string;
    autoplay: boolean;
    muted: boolean;
    loop: boolean;
    volume?: number;
  };
  serviciosVideos: {
    alertas: {
      youtubeId: string;
      title: string;
      description: string;
    autoplay: boolean;
    muted: boolean;
    loop: boolean;
    volume?: number;
    };
    entrenamientos: {
      youtubeId: string;
      title: string;
      description: string;
    autoplay: boolean;
    muted: boolean;
    loop: boolean;
    volume?: number;
    };
    asesorias: {
      youtubeId: string;
      title: string;
      description: string;
      autoplay: boolean;
      muted: boolean;
      loop: boolean;
    };
  };
  // Videos específicos por entrenamiento
  trainingVideos: {
    swingTrading: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
        volume?: number;
      };
      promoVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    dowJones: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
        volume?: number;
      };
      promoVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    advanced: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
        volume?: number;
      };
      promoVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
  };
  // Videos específicos por página de asesorías
  advisoryVideos: {
    consultorioFinanciero: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
        volume?: number;
      };
      testimonialsVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    cuentaAsesorada: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
        volume?: number;
      };
      finalVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
  };
  // Videos específicos por página de alertas
  alertsVideos: {
    index: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
        volume?: number;
      };
      communityVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    traderCall: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    smartMoney: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    cashFlow: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
  };
  // Videos específicos por página de recursos
  resourcesVideos: {
    mainVideo: {
      youtubeId: string;
      title: string;
      description: string;
      autoplay: boolean;
      muted: boolean;
      loop: boolean;
    };
  };
  statistics: {
    visible: boolean;
    backgroundColor: string;
    textColor: string;
    stats: Array<{
      id: string;
      number: string;
      label: string;
      color: string;
      icon?: string;
      order: number;
    }>;
  };
  servicios: {
    orden: number;
    visible: boolean;
  };
  cursos: {
    orden: number;
    visible: boolean;
    destacados: string[]; // IDs de entrenamientos destacados
  };
  // Nueva sección para fechas de inicio de entrenamientos
  trainingStartDates: {
    swingTrading: {
      startDate: Date;
      startTime: string; // formato HH:mm
      enabled: boolean;
    };
    dowJones: {
      startDate: Date;
      startTime: string; // formato HH:mm
      enabled: boolean;
    };
  };
  alertExamples: {
    traderCall: Array<{
      id: string;
      title: string;
      description: string;
      chartImage?: string; // URL de la imagen del gráfico
      entryPrice: string;
      exitPrice: string;
      profit: string;
      profitPercentage: string;
      riskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
      status: 'CERRADO TP1' | 'CERRADO TP1 Y SL' | 'CERRADO SL';
      country: string;
      ticker: string;
      order: number;
    }>;
    smartMoney: Array<{
      id: string;
      title: string;
      description: string;
      chartImage?: string; // URL de la imagen del gráfico
      entryPrice: string;
      exitPrice: string;
      profit: string;
      profitPercentage: string;
      riskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
      status: 'CERRADO TP1' | 'CERRADO TP1 Y SL' | 'CERRADO SL';
      country: string;
      ticker: string;
      order: number;
    }>;
    cashFlow: Array<{
      id: string;
      title: string;
      description: string;
      chartImage?: string; // URL de la imagen del gráfico
      entryPrice: string;
      exitPrice: string;
      profit: string;
      profitPercentage: string;
      riskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
      status: 'CERRADO TP1' | 'CERRADO TP1 Y SL' | 'CERRADO SL';
      country: string;
      ticker: string;
      order: number;
    }>;
  };
  faqs: Array<{
    id: string;
    question: string;
    answer: string;
    category: 'trader-call' | 'smart-money' | 'cash-flow' | 'general';
    order: number;
    visible: boolean;
  }>;
  features: {
    mentoring: {
      enabled: boolean;
      updatedAt?: Date;
      updatedBy?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const siteConfigSchema = new Schema<SiteConfigDocument>({
  heroVideo: {
    youtubeId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    thumbnail: { type: String },
    autoplay: { type: Boolean, default: true },
    muted: { type: Boolean, default: true },
    loop: { type: Boolean, default: true },
    volume: { type: Number, default: 20, min: 0, max: 100 }
  },
  learningVideo: {
    youtubeId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    thumbnail: { type: String },
    autoplay: { type: Boolean, default: false },
    muted: { type: Boolean, default: true },
    loop: { type: Boolean, default: false },
    volume: { type: Number, default: 20, min: 0, max: 100 }
  },
  serviciosVideos: {
    alertas: {
      youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
      title: { type: String, default: 'Video de Alertas' },
      description: { type: String, default: 'Descubre cómo funcionan nuestras alertas de trading' },
      autoplay: { type: Boolean, default: false },
      muted: { type: Boolean, default: true },
      loop: { type: Boolean, default: false },
      volume: { type: Number, default: 20, min: 0, max: 100 }
    },
    entrenamientos: {
      youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
      title: { type: String, default: 'Video de Entrenamientos' },
      description: { type: String, default: 'Conoce nuestros programas de formación especializados' },
      autoplay: { type: Boolean, default: false },
      muted: { type: Boolean, default: true },
      loop: { type: Boolean, default: false }
    },
    asesorias: {
      youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
      title: { type: String, default: 'Video de Asesorías' },
      description: { type: String, default: 'Asesorías personalizadas para optimizar tu portafolio' },
      autoplay: { type: Boolean, default: false },
      muted: { type: Boolean, default: true },
      loop: { type: Boolean, default: false }
    }
  },
  // Videos específicos por entrenamiento
  trainingVideos: {
    swingTrading: {
      heroVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Zero 2 Trader - Video Promocional' },
        description: { type: String, default: 'Descubre el programa completo de Zero 2 Trader' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false },
        volume: { type: Number, default: 20, min: 0, max: 100 }
      },
      promoVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Zero 2 Trader - Video Adicional' },
        description: { type: String, default: 'Video adicional del programa Zero 2 Trader' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false },
        volume: { type: Number, default: 20, min: 0, max: 100 }
      }
    },
    dowJones: {
      heroVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Dow Jones - Video Promocional' },
        description: { type: String, default: 'Descubre el programa completo de Dow Jones' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false },
        volume: { type: Number, default: 20, min: 0, max: 100 }
      },
      promoVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Dow Jones - Video Adicional' },
        description: { type: String, default: 'Video adicional del programa Dow Jones' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false },
        volume: { type: Number, default: 20, min: 0, max: 100 }
      }
    },
    advanced: {
      heroVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Programa Avanzado - Video Promocional' },
        description: { type: String, default: 'Descubre el programa avanzado de trading' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false },
        volume: { type: Number, default: 20, min: 0, max: 100 }
      },
      promoVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Programa Avanzado - Video Adicional' },
        description: { type: String, default: 'Video adicional del programa avanzado' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false }
      }
    }
  },
  // Videos específicos por página de asesorías
  advisoryVideos: {
    consultorioFinanciero: {
      heroVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Consultorio Financiero - Introducción' },
        description: { type: String, default: 'Conoce nuestro consultorio financiero personalizado' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false },
        volume: { type: Number, default: 20, min: 0, max: 100 }
      },
      testimonialsVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Consultorio Financiero - Testimonios' },
        description: { type: String, default: 'Testimonios de clientes del consultorio' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false }
      }
    },
    cuentaAsesorada: {
      heroVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Cuenta Asesorada - Introducción' },
        description: { type: String, default: 'Descubre nuestro servicio de cuenta asesorada' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false },
        volume: { type: Number, default: 20, min: 0, max: 100 }
      },
      finalVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Cuenta Asesorada - Videos Finales' },
        description: { type: String, default: 'Videos adicionales de cuenta asesorada' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false }
      }
    }
  },
  // Videos específicos por página de alertas
  alertsVideos: {
    index: {
      heroVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Alertas de Trading - Introducción' },
        description: { type: String, default: 'Descubre nuestras alertas de trading' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false },
        volume: { type: Number, default: 20, min: 0, max: 100 }
      },
      communityVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Comunidad de YouTube - Alertas' },
        description: { type: String, default: 'Únete a nuestra comunidad de YouTube' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false },
        volume: { type: Number, default: 20, min: 0, max: 100 }
      }
    },
    traderCall: {
      heroVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Trader Call - Video Promocional' },
        description: { type: String, default: 'Descubre el servicio Trader Call' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false },
        volume: { type: Number, default: 20, min: 0, max: 100 }
      }
    },
    smartMoney: {
      heroVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Smart Money - Video Promocional' },
        description: { type: String, default: 'Descubre el servicio Smart Money' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false },
        volume: { type: Number, default: 20, min: 0, max: 100 }
      }
    },
    cashFlow: {
      heroVideo: {
        youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
        title: { type: String, default: 'Cash Flow - Video Promocional' },
        description: { type: String, default: 'Descubre el servicio Cash Flow' },
        autoplay: { type: Boolean, default: false },
        muted: { type: Boolean, default: true },
        loop: { type: Boolean, default: false },
        volume: { type: Number, default: 20, min: 0, max: 100 }
      }
    }
  },
  // Videos específicos por página de recursos
  resourcesVideos: {
    mainVideo: {
      youtubeId: { type: String, default: 'dQw4w9WgXcQ' },
      title: { type: String, default: 'Recursos de Trading' },
      description: { type: String, default: 'Recursos y herramientas para trading' },
      autoplay: { type: Boolean, default: false },
      muted: { type: Boolean, default: true },
      loop: { type: Boolean, default: false },
      volume: { type: Number, default: 20, min: 0, max: 100 }
    }
  },
  statistics: {
    visible: { type: Boolean, default: true },
    backgroundColor: { type: String, default: '#7c3aed' },
    textColor: { type: String, default: '#ffffff' },
    stats: [{
      id: { type: String, required: true },
      number: { type: String, required: true },
      label: { type: String, required: true },
      color: { type: String, default: '#ffffff' },
      icon: { type: String },
      order: { type: Number, default: 0 }
    }]
  },
  servicios: {
    orden: { type: Number, default: 1 },
    visible: { type: Boolean, default: true }
  },
  cursos: {
    orden: { type: Number, default: 2 },
    visible: { type: Boolean, default: true },
    destacados: [{ type: String }]
  },
  // Nueva sección para fechas de inicio de entrenamientos
  trainingStartDates: {
    swingTrading: {
      startDate: { type: Date, default: new Date('2024-10-11T13:00:00.000Z') },
      startTime: { type: String, default: '13:00' },
      enabled: { type: Boolean, default: true }
    },
    dowJones: {
      startDate: { type: Date, default: new Date('2024-11-01T14:00:00.000Z') },
      startTime: { type: String, default: '14:00' },
      enabled: { type: Boolean, default: true }
    }
  },
  alertExamples: {
    traderCall: [{
      id: { type: String, required: true },
      title: { type: String, required: true },
      description: { type: String, required: true },
      chartImage: { type: String }, // URL de la imagen del gráfico
      entryPrice: { type: String, required: true },
      exitPrice: { type: String, required: true },
      profit: { type: String, required: true },
      profitPercentage: { type: String, required: true },
      riskLevel: { type: String, enum: ['BAJO', 'MEDIO', 'ALTO'], required: true },
      status: { type: String, enum: ['CERRADO TP1', 'CERRADO TP1 Y SL', 'CERRADO SL'], required: true },
      country: { type: String, required: true },
      ticker: { type: String, required: true },
      order: { type: Number, default: 0 }
    }],
    smartMoney: [{
      id: { type: String, required: true },
      title: { type: String, required: true },
      description: { type: String, required: true },
      chartImage: { type: String }, // URL de la imagen del gráfico
      entryPrice: { type: String, required: true },
      exitPrice: { type: String, required: true },
      profit: { type: String, required: true },
      profitPercentage: { type: String, required: true },
      riskLevel: { type: String, enum: ['BAJO', 'MEDIO', 'ALTO'], required: true },
      status: { type: String, enum: ['CERRADO TP1', 'CERRADO TP1 Y SL', 'CERRADO SL'], required: true },
      country: { type: String, required: true },
      ticker: { type: String, required: true },
      order: { type: Number, default: 0 }
    }],

  },
  faqs: [{
    id: { type: String, required: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, enum: ['trader-call', 'smart-money', 'general'], required: true },
    order: { type: Number, default: 0 },
    visible: { type: Boolean, default: true }
  }],
  features: {
    mentoring: {
      enabled: { type: Boolean, default: false },
      updatedAt: { type: Date, default: Date.now },
      updatedBy: { type: String, default: 'system' }
    }
  }
}, {
  timestamps: true,
  collection: 'siteconfig'
});

export default mongoose.models.SiteConfig || mongoose.model<SiteConfigDocument>('SiteConfig', siteConfigSchema); 