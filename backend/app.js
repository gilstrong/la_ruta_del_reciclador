require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const morgan = require('morgan');

// Importación de modelos y configuraciones
const connectDB = require('./db');
const Usuario = require('./usuario');
const Punto = require('./punto');

// Configuración inicial
const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const frontendPath = path.join(__dirname, '..', 'frontend');
const pagesPath = path.join(frontendPath, 'pages');

// --- Configuración de Seguridad ---
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://larutadelreciclador.netlify.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Limitar peticiones para prevenir ataques DDoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de 100 peticiones por IP
});
app.use(limiter);

// --- Middleware ---
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Logger de solicitudes HTTP
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Configuración de sesión segura
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'mi_clave_secreta_fuerte_y_compleja',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 día
  }
};
app.use(session(sessionConfig));

// --- Conexión a MongoDB ---
connectDB(process.env.MONGO_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Error conectando a MongoDB:', err);
    process.exit(1);
  });

// --- Archivos estáticos ---
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
const apiRouter = express.Router();

// Middleware para loguear peticiones API
apiRouter.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// Autenticación
apiRouter.post('/registrar-usuario', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const nombreNorm = nombre.toLowerCase();
    const usuarioExistente = await Usuario.findOne({ nombre: nombreNorm });
    
    if (usuarioExistente) {
      return res.status(400).json({ error: 'Usuario ya existe' });
    }

    const nuevoUsuario = new Usuario({ nombre: nombreNorm, puntos: 0 });
    await nuevoUsuario.save();

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

apiRouter.post('/login', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const nombreNorm = nombre.toLowerCase();
    const usuario = await Usuario.findOne({ nombre: nombreNorm });
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no registrado' });
    }

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

apiRouter.get('/usuario-logueado', (req, res) => {
  if (!req.session.nombre) {
    return res.status(401).json({ error: 'No hay sesión activa' });
  }
  res.json({ 
    usuario: { 
      _id: req.session.usuarioId, 
      nombre: req.session.nombre 
    } 
  });
});

// Perfil y puntos
apiRouter.get('/perfil/:nombre', async (req, res) => {
  try {
    const nombreNorm = req.params.nombre.toLowerCase();
    let usuario = await Usuario.findOne({ nombre: nombreNorm });

    if (!usuario) {
      usuario = new Usuario({ nombre: nombreNorm, puntos: 0 });
      await usuario.save();
    }

    res.json({ 
      nombre: usuario.nombre, 
      puntos: usuario.puntos 
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

apiRouter.post('/sumar-punto', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

    const nombreNorm = nombre.toLowerCase();
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

// Puntos de reciclaje
apiRouter.get('/ubicaciones', async (req, res) => {
  try {
    const ubicaciones = await Punto.find().populate('usuario', 'nombre');
    res.json(ubicaciones.map(u => ({
      _id: u._id,
      lat: u.lat,
      lng: u.lng,
      usuario: u.usuario.nombre
    })));
  } catch (error) {
    console.error('Error al obtener ubicaciones:', error);
    res.status(500).json({ error: 'Error al obtener ubicaciones' });
  }
});

apiRouter.delete('/eliminar-punto', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'Lat y Lng requeridos' });
    }

    const eliminado = await Punto.findOneAndDelete({ lat, lng });
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

// Montar el router API
app.use('/api', apiRouter);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.stack);
  res.status(500).json({ error: 'Algo salió mal en el servidor' });
});

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).sendFile(path.join(pagesPath, '404.html'));
});

// Iniciar servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});
