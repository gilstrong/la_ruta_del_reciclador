require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const cors = require('cors');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Modelos
const Usuario = require('./usuario');
const Punto = require('./punto');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const frontendPath = path.join(__dirname, '..', 'frontend');
const pagesPath = path.join(frontendPath, 'pages');

// --- CORS ---
const corsOptions = {
  origin: [
    'https://larutadelreciclador.netlify.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Powered-By'],
  maxAge: 600,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// --- Seguridad ---
app.use(helmet());
app.use(helmet.hsts({ maxAge: 63072000, includeSubDomains: true, preload: true }));
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// --- Sesión ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_seguro_complejo_' + Math.random().toString(36).substring(2),
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    ttl: 24 * 60 * 60,
    autoRemove: 'interval',
    autoRemoveInterval: 10
  }),
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    domain: isProduction ? '.railway.app' : undefined
  }
}));

// --- MongoDB ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 50,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  retryWrites: true,
  w: 'majority'
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch(err => {
  console.error('❌ Error conectando a MongoDB:', err);
  process.exit(1);
});

mongoose.connection.on('connected', () => console.log('Mongoose conectado'));
mongoose.connection.on('error', err => console.error('Error MongoDB:', err));
mongoose.connection.on('disconnected', () => console.log('Mongoose desconectado'));

// --- Archivos estáticos ---
const staticOptions = {
  maxAge: isProduction ? '1y' : '0',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
};

app.use('/styles', express.static(path.join(frontendPath, 'styles'), staticOptions));
app.use('/scripts', express.static(path.join(frontendPath, 'scripts'), staticOptions));
app.use('/images', express.static(path.join(frontendPath, 'images'), staticOptions));
app.use('/model', express.static(path.join(frontendPath, 'model'), staticOptions));

// --- Rutas HTML (manual, sin dinámicas) ---
const renderPage = (page) => (req, res) =>
  res.sendFile(path.join(pagesPath, `${page}.html`));

app.get('/index', renderPage('index'));
app.get('/mapa', renderPage('mapa'));
app.get('/registro', renderPage('registro'));
app.get('/login', renderPage('login'));
app.get('/perfil', renderPage('perfil'));
app.get('/residuos', renderPage('residuos'));

// --- Página especial: /rutas ---
app.get('/rutas', (req, res) => {
  const filePath = path.join(pagesPath, 'rutas.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      console.error('Error cargando rutas.html:', err);
      return res.status(500).send('Error cargando la página');
    }

    const username = req.session.nombre || '';
    const script = `<script>window.USUARIO = ${JSON.stringify(username)};</script>`;
    const result = html.replace('</head>', `${script}\n</head>`);
    res.send(result);
  });
});

// --- API ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde'
});

app.use('/api', apiLimiter);

app.post('/api/registrar-usuario', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Nombre inválido. Debe tener al menos 3 caracteres'
      });
    }

    const nombreNorm = nombre.trim().toLowerCase();
    const usuarioExistente = await Usuario.findOne({ nombre: nombreNorm });

    if (usuarioExistente) {
      return res.status(409).json({
        success: false,
        error: 'El usuario ya existe'
      });
    }

    const nuevoUsuario = new Usuario({ nombre: nombreNorm, puntos: 0 });
    await nuevoUsuario.save();

    req.session.nombre = nombreNorm;
    req.session.usuarioId = nuevoUsuario._id;

    res.cookie('sessionId', req.sessionID, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      mensaje: 'Usuario registrado con éxito',
      usuario: {
        _id: nuevoUsuario._id,
        nombre: nuevoUsuario.nombre,
        puntos: nuevoUsuario.puntos
      },
      sessionId: req.sessionID
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno al registrar usuario'
    });
  }
});

app.get('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'Prueba CORS exitosa',
    timestamp: new Date().toISOString()
  });
});

// --- Errores y 404 ---
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: isProduction ? undefined : err.message,
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(pagesPath, '404.html'));
});

// --- Servidor ---
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Orígenes CORS permitidos: ${corsOptions.origin.join(', ')}`);
});

const shutdown = (signal) => {
  console.log(`Recibido ${signal}. Cerrando servidor...`);
  server.close(() => {
    console.log('Servidor cerrado');
    mongoose.connection.close(false, () => {
      console.log('Conexión a MongoDB cerrada');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
