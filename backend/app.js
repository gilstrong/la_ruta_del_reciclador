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

// Importar modelos
const Usuario = require('./usuario');
const Punto = require('./punto');

// Configuración inicial
const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const frontendPath = path.join(__dirname, '..', 'frontend');
const pagesPath = path.join(frontendPath, 'pages');

// Configuración de rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 peticiones por IP
  message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde'
});

// --- Middleware de Seguridad ---
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://larutadelreciclador.netlify.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Logger de solicitudes
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Parseo de JSON
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// --- Configuración de Sesión con MongoDB ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_seguro_complejo_' + Math.random().toString(36).substring(2),
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    ttl: 24 * 60 * 60, // 1 día
    autoRemove: 'interval',
    autoRemoveInterval: 10 // Minutos
  }),
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// --- Conexión a MongoDB Mejorada ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 50,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch(err => {
  console.error('❌ Error conectando a MongoDB:', err);
  process.exit(1);
});

// Eventos de conexión mejorados
mongoose.connection.on('connected', () => {
  console.log('Mongoose conectado a la base de datos');
});

mongoose.connection.on('error', (err) => {
  console.error('Error de conexión a MongoDB:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose desconectado');
});

// --- Archivos estáticos con caché controlada ---
const staticOptions = {
  maxAge: isProduction ? '1y' : '0',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
};

app.use('/styles', express.static(path.join(frontendPath, 'styles'), staticOptions));
app.use('/scripts', express.static(path.join(frontendPath, 'scripts'), staticOptions));
app.use('/images', express.static(path.join(frontendPath, 'images'), staticOptions));
app.use('/model', express.static(path.join(frontendPath, 'model'), staticOptions));

// --- Rutas HTML ---
const paginas = ['index', 'mapa', 'registro', 'login', 'perfil', 'residuos', 'rutas'];
paginas.forEach(p => {
  app.get(`/${p}`, (req, res) => res.sendFile(path.join(pagesPath, `${p}.html`)));
  app.get(`/${p}.html`, (req, res) => res.redirect(`/${p}`));
});

// --- Ruta Dinámica para /rutas ---
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

// --- API Routes ---
app.use('/api', apiLimiter); // Aplicar rate limiting a todas las rutas API

// Registrar usuario (MEJORADO)
app.post('/api/registrar-usuario', async (req, res) => {
  try {
    const { nombre } = req.body;
    
    // Validación mejorada
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 3) {
      return res.status(400).json({ 
        error: 'Nombre inválido. Debe tener al menos 3 caracteres' 
      });
    }

    const nombreNorm = nombre.trim().toLowerCase();
    const usuarioExistente = await Usuario.findOne({ nombre: nombreNorm });
    
    if (usuarioExistente) {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }

    const nuevoUsuario = new Usuario({ 
      nombre: nombreNorm, 
      puntos: 0 
    });
    await nuevoUsuario.save();

    // Iniciar sesión automáticamente
    req.session.nombre = nombreNorm;
    req.session.usuarioId = nuevoUsuario._id;

    res.status(201).json({ 
      success: true,
      mensaje: 'Usuario registrado con éxito', 
      usuario: { 
        _id: nuevoUsuario._id, 
        nombre: nuevoUsuario.nombre, 
        puntos: nuevoUsuario.puntos 
      } 
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno al registrar usuario' 
    });
  }
});

// [Resto de tus rutas API permanecen igual pero con mejor manejo de errores...]

// --- Manejo de errores centralizado ---
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.stack);
  
  // Respuesta de error estandarizada
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: isProduction ? undefined : err.message
  });
});

// Ruta no encontrada (404)
app.use((req, res) => {
  res.status(404).sendFile(path.join(pagesPath, '404.html'));
});

// --- Iniciar servidor ---
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});

// Manejo de cierre graceful shutdown
process.on('SIGTERM', () => {
  console.log('Recibido SIGTERM. Cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado');
    mongoose.connection.close(false, () => {
      console.log('Conexión a MongoDB cerrada');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('Recibido SIGINT. Cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado');
    mongoose.connection.close(false, () => {
      console.log('Conexión a MongoDB cerrada');
      process.exit(0);
    });
  });
});
