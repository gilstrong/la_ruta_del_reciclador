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

// Importar modelos
const Usuario = require('./usuario');
const Punto = require('./punto');

// Configuración inicial
const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const frontendPath = path.join(__dirname, '..', 'frontend');
const pagesPath = path.join(frontendPath, 'pages');

// --- Middleware de Seguridad ---
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://larutadelreciclador.netlify.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());

// Logger de solicitudes
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Parseo de JSON
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// --- Configuración de Sesión con MongoDB ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_seguro_y_complejo',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    ttl: 24 * 60 * 60 // 1 día en segundos
  }),
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 día en milisegundos
  }
}));

// --- Conexión a MongoDB ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch(err => {
  console.error('❌ Error conectando a MongoDB:', err);
  process.exit(1);
});

// Eventos de conexión de MongoDB
mongoose.connection.on('error', err => {
  console.error('❌ Error de MongoDB:', err);
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

// Registrar usuario (MEJORADO)
app.post('/api/registrar-usuario', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || typeof nombre !== 'string') {
      return res.status(400).json({ error: 'Nombre de usuario inválido' });
    }

    const nombreNorm = nombre.trim().toLowerCase();
    if (nombreNorm.length < 3) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 3 caracteres' });
    }

    const usuarioExistente = await Usuario.findOne({ nombre: nombreNorm });
    if (usuarioExistente) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const nuevoUsuario = new Usuario({ 
      nombre: nombreNorm, 
      puntos: 0 
    });
    await nuevoUsuario.save();

    // Iniciar sesión automáticamente después del registro
    req.session.nombre = nombreNorm;
    req.session.usuarioId = nuevoUsuario._id;

    res.status(201).json({ 
      mensaje: 'Usuario registrado con éxito', 
      usuario: { 
        _id: nuevoUsuario._id, 
        nombre: nuevoUsuario.nombre, 
        puntos: nuevoUsuario.puntos 
      } 
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Login (MEJORADO)
app.post('/api/login', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || typeof nombre !== 'string') {
      return res.status(400).json({ error: 'Nombre de usuario inválido' });
    }

    const nombreNorm = nombre.trim().toLowerCase();
    const usuario = await Usuario.findOne({ nombre: nombreNorm });
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no registrado' });
    }

    // Actualizar última conexión
    usuario.ultimaConexion = new Date();
    await usuario.save();

    req.session.nombre = nombreNorm;
    req.session.usuarioId = usuario._id;

    res.json({ 
      mensaje: 'Login exitoso', 
      usuario: { 
        _id: usuario._id, 
        nombre: usuario.nombre, 
        puntos: usuario.puntos 
      } 
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Usuario logueado (MEJORADO)
app.get('/api/usuario-logueado', async (req, res) => {
  try {
    if (!req.session.nombre) {
      return res.status(401).json({ error: 'No hay sesión activa' });
    }

    const usuario = await Usuario.findById(req.session.usuarioId);
    if (!usuario) {
      // Sesión inválida - usuario no existe
      req.session.destroy();
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ 
      usuario: { 
        _id: usuario._id, 
        nombre: usuario.nombre, 
        puntos: usuario.puntos 
      } 
    });
  } catch (error) {
    console.error('Error al verificar sesión:', error);
    res.status(500).json({ error: 'Error al verificar sesión' });
  }
});

// Perfil del usuario (MEJORADO)
app.get('/api/perfil/:nombre', async (req, res) => {
  try {
    const nombreNorm = req.params.nombre.toLowerCase().trim();
    if (!nombreNorm) {
      return res.status(400).json({ error: 'Nombre de usuario inválido' });
    }

    let usuario = await Usuario.findOne({ nombre: nombreNorm });
    if (!usuario) {
      usuario = new Usuario({ nombre: nombreNorm, puntos: 0 });
      await usuario.save();
    }

    res.json({ 
      nombre: usuario.nombre, 
      puntos: usuario.puntos,
      registrado: usuario.createdAt ? true : false
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// Sumar punto (MEJORADO)
app.post('/api/sumar-punto', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || typeof nombre !== 'string') {
      return res.status(400).json({ error: 'Nombre de usuario inválido' });
    }

    const nombreNorm = nombre.trim().toLowerCase();
    let usuario = await Usuario.findOne({ nombre: nombreNorm });

    if (!usuario) {
      usuario = new Usuario({ nombre: nombreNorm, puntos: 1 });
    } else {
      usuario.puntos += 1;
    }

    await usuario.save();

    res.json({ 
      mensaje: 'Punto sumado con éxito', 
      usuario: { 
        _id: usuario._id, 
        nombre: usuario.nombre, 
        puntos: usuario.puntos 
      } 
    });
  } catch (error) {
    console.error('Error al sumar punto:', error);
    res.status(500).json({ error: 'Error al sumar punto' });
  }
});

// Obtener ubicaciones (MEJORADO)
app.get('/api/ubicaciones', async (req, res) => {
  try {
    const ubicaciones = await Punto.find().populate('usuario', 'nombre puntos');
    res.json(ubicaciones.map(u => ({
      _id: u._id,
      lat: u.lat,
      lng: u.lng,
      usuario: {
        nombre: u.usuario.nombre,
        puntos: u.usuario.puntos
      },
      fecha: u.createdAt
    })));
  } catch (error) {
    console.error('Error al obtener ubicaciones:', error);
    res.status(500).json({ error: 'Error al obtener ubicaciones' });
  }
});

// Eliminar ubicación (MEJORADO)
app.delete('/api/eliminar-punto', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Coordenadas inválidas' });
    }

    const eliminado = await Punto.findOneAndDelete({ 
      lat: parseFloat(lat.toFixed(6)), 
      lng: parseFloat(lng.toFixed(6)) 
    });

    if (!eliminado) {
      return res.status(404).json({ error: 'Punto no encontrado' });
    }

    res.json({ 
      mensaje: 'Punto eliminado con éxito', 
      punto: { 
        _id: eliminado._id, 
        lat: eliminado.lat, 
        lng: eliminado.lng 
      } 
    });
  } catch (error) {
    console.error('Error al eliminar punto:', error);
    res.status(500).json({ error: 'Error al eliminar punto' });
  }
});

// --- Manejo de errores ---
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).sendFile(path.join(pagesPath, '404.html'));
});

// --- Iniciar servidor ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});
