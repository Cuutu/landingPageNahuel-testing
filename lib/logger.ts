export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogMeta {
  module?: string;
  step?: string;
  requestId?: string;
  user?: string;
  reference?: string;
  [key: string]: any;
}

function emit(level: LogLevel, message: string, meta?: LogMeta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  // Una sola línea JSON para que Vercel lo muestre compacto y filtrable
  // Además, mantener un fallback legible
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (message: string, meta?: LogMeta) => emit('info', message, meta),
  warn: (message: string, meta?: LogMeta) => emit('warn', message, meta),
  error: (message: string, meta?: LogMeta) => emit('error', message, meta),
  debug: (message: string, meta?: LogMeta) => emit('debug', message, meta),
}; 