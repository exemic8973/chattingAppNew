import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'chat-app-server',
    pid: process.pid
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      taily: true
    }),

    // Security events log
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ],
  
  // Exception handling
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  
  // Rejection handling
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Security logging helper
export const logSecurityEvent = (event, details = {}) => {
  logger.warn('SECURITY_EVENT', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Socket event logging helper
export const logSocketEvent = (event, socketId, details = {}) => {
  logger.info('SOCKET_EVENT', {
    event,
    socketId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Database operation logging helper
export const logDatabaseOperation = (operation, table, details = {}) => {
  logger.debug('DB_OPERATION', {
    operation,
    table,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Authentication logging helper
export const logAuthEvent = (event, username, details = {}) => {
  logger.info('AUTH_EVENT', {
    event,
    username,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Message logging helper
export const logMessageEvent = (event, channelId, sender, details = {}) => {
  logger.info('MESSAGE_EVENT', {
    event,
    channelId,
    sender,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Performance logging helper
export const logPerformance = (operation, duration, details = {}) => {
  logger.info('PERFORMANCE', {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Error logging helper with context
export const logError = (error, context = {}) => {
  logger.error('APPLICATION_ERROR', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...context
  });
};

// Request logging middleware helper
export const createRequestLogger = () => {
  return (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('HTTP_REQUEST', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString()
      });
    });
    
    next();
  };
};

// Rate limit logging helper
export const logRateLimit = (req, res) => {
  logSecurityEvent('RATE_LIMIT_EXCEEDED', {
    ip: req.ip,
    url: req.url,
    userAgent: req.get('User-Agent'),
    limit: res.get('X-RateLimit-Limit'),
    remaining: res.get('X-RateLimit-Remaining'),
    resetTime: res.get('X-RateLimit-Reset')
  });
};

// File upload logging helper
export const logFileUpload = (filename, username, details = {}) => {
  logger.info('FILE_UPLOAD', {
    filename,
    username,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Channel management logging helper
export const logChannelEvent = (event, channelId, username, details = {}) => {
  logger.info('CHANNEL_EVENT', {
    event,
    channelId,
    username,
    timestamp: new Date().toISOString(),
    ...details
  });
};

export default logger;