const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const importTarget = `import express from 'express';
import cors from 'cors';`;
const importReplacement = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';`;

content = content.replace(importTarget, importReplacement);

const middlewareTarget = `app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());`;

const middlewareReplacement = `// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Deaktiviert CSP fuer React Inline-Styles/Skripte im Build
  crossOriginEmbedderPolicy: false
}));

// Performance Compression
app.use(compression());

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '1mb' })); // Body-Limit gegen Payload-Bombing
app.use(hpp()); // HTTP Parameter Pollution protection

// Rate Limiting (Allgemein)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 300, // Limit each IP to 300 requests per windowMs
  message: { error: 'Zu viele Anfragen von dieser IP, bitte versuche es spÃ¤ter erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Rate Limiting (Auth/Login/Register)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 30, // Max 30 Login/Register Versuche pro Stunde
  message: { error: 'Zu viele Login-Versuche, bitte warte eine Weile.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/verify-2fa', authLimiter);
app.use('/api/auth/passkey-auth', authLimiter);
app.use('/api/auth/reset-password', authLimiter);`;

content = content.replace(middlewareTarget, middlewareReplacement);

fs.writeFileSync('server.js', content, 'utf8');
console.log('Modified server.js');
