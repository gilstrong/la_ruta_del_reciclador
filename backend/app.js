// app.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const session = require('express-session');
const Usuario = require('./models/Usuario');
const Punto = require('./models/punto');

const app = express();

// --- Middleware ---
app.use(express.json());
app.use(session({
  secret: 'mi_clave_secreta',
  resave: false,
  saveUninitialized: true
}));

// --- Conexión a MongoDB ---
mongoose.connect('mongodb://127.0.0.1:27017/rutaReciclador', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado a MongoDB'))
.catch(err => console.error('❌ Error conectando a MongoDB:', err));

// --- Archivos estáticos ---
app.use('/styles', express.static(path.join(__dirname, '..', 'styles')));
app.use('/scripts', express.static(path.join(__dirname, '..', '..', 'public', 'scripts')));
app.use('/model', express.static(path.join(__dirname, '..', '..', 'public', 'model')));
app.use('/images', express.static(path.join(__dirname, '..', '..', 'public', 'images')));

// --- Rutas HTML y redirecciones para páginas no-dinámicas ---
const páginas = ['index','mapa','registro','login','perfil','residuos'];
páginas.forEach(p => {
  app.get(`/${p}`, (req, res) =>
    res.sendFile(path.join(__dirname, '..', 'pages', `${p}.html`))
  );
  app.get(`/${p}.html`, (req, res) => res.redirect(`/${p}`));
});

// --- RUTA DINÁMICA para /rutas: inyectar window.USUARIO ---
app.get('/rutas', (req, res) => {
  const filePath = path.join(__dirname, '..', 'pages', 'rutas.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) return res.status(500).send('Error cargando rutas.html');
    const username = req.session.nombre || '';
    const script = `<script>window.USUARIO = ${JSON.stringify(username)};</script>`;
    // Insertamos justo antes de </head>
    const result = html.replace('</head>', `${script}\n</head>`);
    res.send(result);
  });
});
app.get('/rutas.html', (req, res) => res.redirect('/rutas'));

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
    res.status(201).json({ mensaje: 'Usuario registrado con éxito' });
  } catch (e) {
    console.error(e);
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
    res.json({
      mensaje: 'Login exitoso',
      usuario: { nombre: u.nombre, _id: u._id }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// --- API: Usuario logueado ---
app.get('/api/usuario-logueado', (req, res) => {
  if (!req.session.nombre) {
    return res.status(401).json({ error: 'No hay sesión activa' });
  }
  res.json({ nombre: req.session.nombre, usuarioId: req.session.usuarioId });
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
    console.error(e);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// --- API: Sumar punto ---
app.post('/sumar-punto', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const nombreNorm = nombre.toLowerCase();
    let u = await Usuario.findOne({ nombre: nombreNorm });
    if (!u) u = new Usuario({ nombre: nombreNorm, puntos: 1 });
    else u.puntos += 1;
    await u.save();
    res.json({ mensaje: 'Punto sumado con éxito', usuario: u });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al sumar punto' });
  }
});



// --- API: Guardar ubicaciones ---
app.post('/api/ubicaciones', async (req, res) => {
  const { usuarioId, latitud, longitud, puntos } = req.body;
  if (!usuarioId || latitud == null || longitud == null || puntos == null) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }
  try {
    const nuevo = new Punto({
      lat: latitud,
      lng: longitud,
      nombre: 'Punto de reciclaje',
      usuario: usuarioId
    });
    await nuevo.save();
    res.json({ mensaje: 'Ubicación guardada con éxito', punto: nuevo });
  } catch (e) {
    console.error('Error al guardar ubicación:', e);
    res.status(500).json({ error: 'Hubo un error al guardar la ubicación' });
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
    res.json({ mensaje: 'Punto eliminado con éxito', punto: eliminado });
  } catch (e) {
    console.error('Error al eliminar punto:', e);
    res.status(500).json({ error: 'Error al eliminar punto' });
  }
});

// --- API: Obtener todas las ubicaciones ---
app.get('/api/ubicaciones', async (req, res) => {
  try {
    const ubicaciones = await Punto.find().populate('usuario', 'nombre');
    res.json(ubicaciones);
  } catch (e) {
    console.error('Error al obtener ubicaciones:', e);
    res.status(500).json({ error: 'Error al obtener ubicaciones' });
  }
});

// --- Iniciar servidor ---
const port = 3000;
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
