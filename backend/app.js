require('dotenv').config();
const connectDB = require('./db');
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const cors = require('cors');
const Usuario = require('./usuario');
const Punto = require('./punto');

const app = express();

// --- CORS configurado para Netlify y preflight OPTIONS ---
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://larutadelreciclador.netlify.app',
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// --- Middleware ---
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'mi_clave_secreta',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none'
  }
}));

// --- Conexión a MongoDB ---
connectDB()
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Error conectando a MongoDB:', err);
    process.exit(1);
  });

// --- Archivos estáticos ---
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use('/styles', express.static(path.join(frontendPath, 'styles')));
app.use('/scripts', express.static(path.join(frontendPath, 'scripts')));
app.use('/images', express.static(path.join(frontendPath, 'images')));
app.use('/model', express.static(path.join(frontendPath, 'model')));

// --- Rutas HTML y redirecciones ---
const pagesPath = path.join(frontendPath, 'pages');
const paginas = ['index','mapa','registro','login','perfil','residuos','rutas'];
paginas.forEach(p => {
  app.get(`/${p}`, (req, res) => res.sendFile(path.join(pagesPath, `${p}.html`)));
  app.get(`/${p}.html`, (req, res) => res.redirect(`/${p}`));
});

// --- RUTA DINÁMICA para /rutas ---
app.get('/rutas', (req, res) => {
  const filePath = path.join(pagesPath, 'rutas.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) return res.status(500).send('Error cargando rutas.html');
    const username = req.session.nombre || '';
    const script = `<script>window.USUARIO = ${JSON.stringify(username)};</script>`;
    const result = html.replace('</head>', `${script}\n</head>`);
    res.send(result);
  });
});

// --- API: Registrar usuario ---
app.post('/api/registrar-usuario', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const nombreNorm = nombre.toLowerCase();
    if (await Usuario.findOne({ nombre: nombreNorm })) {
      return res.status(400).json({ error: 'Usuario ya existe' });
    }
    const u = new Usuario({ nombre: nombreNorm, puntos: 0 });
    await u.save();
    res.status(201).json({ mensaje: 'Usuario registrado con éxito', usuario: { _id: u._id, nombre: u.nombre, puntos: u.puntos } });
  } catch (e) {
    console.error('Error al registrar usuario:', e);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// --- API: Login ---
app.post('/api/login', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const nombreNorm = nombre.toLowerCase();
    const u = await Usuario.findOne({ nombre: nombreNorm });
    if (!u) return res.status(404).json({ error: 'Usuario no registrado' });
    req.session.nombre = nombreNorm;
    req.session.usuarioId = u._id;
    res.json({ mensaje: 'Login exitoso', usuario: { _id: u._id, nombre: u.nombre, puntos: u.puntos } });
  } catch (e) {
    console.error('Error al iniciar sesión:', e);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// --- API: Usuario logueado ---
app.get('/api/usuario-logueado', (req, res) => {
  if (!req.session.nombre) return res.status(401).json({ error: 'No hay sesión activa' });
  res.json({ usuario: { _id: req.session.usuarioId, nombre: req.session.nombre } });
});

// --- API: Perfil del usuario ---
app.get('/api/perfil/:nombre', async (req, res) => {
  const nombreNorm = req.params.nombre.toLowerCase();
  try {
    let u = await Usuario.findOne({ nombre: nombreNorm });
    if (!u) {
      u = new Usuario({ nombre: nombreNorm, puntos: 0 });
      await u.save();
    }
    res.json({ nombre: u.nombre, puntos: u.puntos });
  } catch (e) {
    console.error('Error al obtener perfil:', e);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// --- API: Sumar punto ---
app.post('/api/sumar-punto', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const nombreNorm = nombre.toLowerCase();
    let u = await Usuario.findOne({ nombre: nombreNorm });
    if (!u) u = new Usuario({ nombre: nombreNorm, puntos: 1 });
    else u.puntos += 1;
    await u.save();
    res.json({ mensaje: 'Punto sumado con éxito', usuario: { _id: u._id, nombre: u.nombre, puntos: u.puntos } });
  } catch (e) {
    console.error('Error al sumar punto:', e);
    res.status(500).json({ error: 'Error al sumar punto' });
  }
});

// --- API: Obtener ubicaciones ---
app.get('/api/ubicaciones', async (req, res) => {
  try {
    const ubicaciones = await Punto.find().populate('usuario', 'nombre');
    res.json(ubicaciones.map(u => ({
      _id: u._id,
      lat: u.lat,
      lng: u.lng,
      usuario: u.usuario.nombre
    })));
  } catch (e) {
    console.error('Error al obtener ubicaciones:', e);
    res.status(500).json({ error: 'Error al obtener ubicaciones' });
  }
});

// --- API: Eliminar ubicación ---
app.delete('/api/eliminar-punto', async (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'Lat y Lng requeridos' });
  }
  try {
    const eliminado = await Punto.findOneAndDelete({ lat, lng });
    if (!eliminado) return res.status(404).json({ error: 'Punto no encontrado' });
    res.json({ mensaje: 'Punto eliminado con éxito', punto: { _id: eliminado._id, lat: eliminado.lat, lng: eliminado.lng } });
  } catch (e) {
    console.error('Error al eliminar punto:', e);
    res.status(500).json({ error: 'Error al eliminar punto' });
  }
});

// --- Iniciar servidor ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
