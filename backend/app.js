// --- app.js (Completo y Corregido) ---
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const connectDB = require('./db'); // Asegúrate de que este archivo exista y exporte la función de conexión
const Usuario = require('./usuario'); // Modelo de Mongoose para Usuario
const Punto = require('./punto');     // Modelo de Mongoose para Punto

const app = express();

// --- Configuración de CORS ---
const corsOptions = {
  origin: 'https://larutadelreciclador.netlify.app', // URL de tu frontend
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// --- Middlewares ---
app.use(express.json()); // Para parsear body de peticiones como JSON

// Configuración de la sesión
app.use(session({
  secret: process.env.SESSION_SECRET || 'mi_clave_secreta_de_respaldo_muy_segura',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true en producción (solo HTTPS)
    httpOnly: true, // El cookie no es accesible desde JS en el cliente
    sameSite: 'lax', // Protección contra ataques CSRF
    maxAge: 1000 * 60 * 60 * 24 // Cookie válida por 1 día
  }
}));

// --- Middleware para proteger rutas que requieren autenticación ---
const isAuthenticated = (req, res, next) => {
  if (req.session.usuarioId) {
    return next(); // Si hay un usuario en la sesión, continuar
  }
  // Si no, devolver error de no autorizado
  res.status(401).json({ error: 'Acceso no autorizado. Debes iniciar sesión.' });
};

// --- Conexión a MongoDB ---
connectDB()
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => {
    console.error('❌ Error conectando a MongoDB:', err);
    process.exit(1); // Detener la aplicación si no se puede conectar a la DB
  });

// --- Servir archivos estáticos del frontend ---
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use('/styles', express.static(path.join(frontendPath, 'styles')));
app.use('/scripts', express.static(path.join(frontendPath, 'scripts')));
app.use('/images', express.static(path.join(frontendPath, 'images')));
app.use('/model', express.static(path.join(frontendPath, 'model')));

// --- Rutas para servir páginas HTML ---
const pagesPath = path.join(frontendPath, 'pages');
// CORREGIDO: Se elimina 'rutas' del array para evitar conflicto con la ruta dinámica.
const páginas = ['index', 'mapa', 'registro', 'login', 'perfil', 'residuos'];
páginas.forEach(p => {
  // Sirve la página en /pagina
  app.get(`/${p}`, (req, res) => {
    res.sendFile(path.join(pagesPath, `${p}.html`));
  });
  // Redirige /pagina.html a /pagina para tener URLs limpias
  app.get(`/${p}.html`, (req, res) => {
    res.redirect(301, `/${p}`);
  });
});

// --- Ruta dinámica para /rutas que inyecta el nombre de usuario ---
app.get('/rutas', (req, res) => {
  const filePath = path.join(pagesPath, 'rutas.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      return res.status(500).send('Error al cargar la página de rutas.');
    }
    const username = req.session.nombre || ''; // Obtiene el nombre de la sesión
    const script = `<script>window.USUARIO = ${JSON.stringify(username)};</script>`;
    // Inyecta el script antes de cerrar la etiqueta </head>
    res.send(html.replace('</head>', `${script}\n</head>`));
  });
});

// --- API: Registrar un nuevo usuario ---
app.post('/api/registrar-usuario', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  try {
    const nombreNorm = nombre.toLowerCase();
    if (await Usuario.findOne({ nombre: nombreNorm })) {
      return res.status(409).json({ error: 'El nombre de usuario ya está en uso' }); // 409 Conflict
    }
    const u = new Usuario({ nombre: nombreNorm, puntos: 0 });
    await u.save();
    res.status(201).json({ mensaje: 'Usuario registrado con éxito' });
  } catch (e) {
    console.error('Error en /api/registrar-usuario:', e);
    res.status(500).json({ error: 'Error interno al registrar el usuario' });
  }
});

// --- API: Iniciar sesión ---
app.post('/api/login', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  try {
    const nombreNorm = nombre.toLowerCase();
    const u = await Usuario.findOne({ nombre: nombreNorm });
    if (!u) {
      return res.status(404).json({ error: 'Usuario no registrado' });
    }
    // Guardar datos en la sesión
    req.session.nombre = u.nombre;
    req.session.usuarioId = u._id;
    res.json({ mensaje: 'Login exitoso', usuario: { nombre: u.nombre, _id: u._id } });
  } catch (e) {
    console.error('Error en /api/login:', e);
    res.status(500).json({ error: 'Error interno al iniciar sesión' });
  }
});

// --- API: Obtener datos del usuario logueado ---
app.get('/api/usuario-logueado', isAuthenticated, (req, res) => {
  // El middleware 'isAuthenticated' ya valida la sesión
  res.json({ nombre: req.session.nombre, usuarioId: req.session.usuarioId });
});

// --- API: Obtener el perfil público de un usuario ---
app.get('/api/perfil/:nombre', async (req, res) => {
  try {
    const nombreNorm = req.params.nombre.toLowerCase();
    const u = await Usuario.findOne({ nombre: nombreNorm });
    // CORREGIDO: No crear un usuario si no existe. Devolver 404.
    if (!u) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ nombre: u.nombre, puntos: u.puntos });
  } catch (e) {
    console.error('Error en /api/perfil/:nombre:', e);
    res.status(500).json({ error: 'Error interno al obtener el perfil' });
  }
});

// --- API: Sumar un punto a un usuario (ej. para gamificación) ---
app.post('/api/sumar-punto', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'Nombre de usuario requerido' });
  }
  try {
    const nombreNorm = nombre.toLowerCase();
    // CORREGIDO: Usar findOneAndUpdate para una operación atómica y eficiente.
    const u = await Usuario.findOneAndUpdate(
      { nombre: nombreNorm },
      { $inc: { puntos: 1 } }, // Incrementa el campo 'puntos' en 1
      { new: true } // Opción para que devuelva el documento actualizado
    );
    if (!u) {
      return res.status(404).json({ error: 'No se pudo sumar el punto. Usuario no encontrado.' });
    }
    res.json({ mensaje: 'Punto sumado con éxito', usuario: u });
  } catch (e) {
    console.error('Error en /api/sumar-punto:', e);
    res.status(500).json({ error: 'Error interno al sumar el punto' });
  }
});

// --- API: Guardar una nueva ubicación (ruta protegida) ---
app.post('/api/ubicaciones', isAuthenticated, async (req, res) => {
  // CORREGIDO: El ID de usuario se toma de la sesión, no del body, por seguridad.
  const usuarioId = req.session.usuarioId;
  const { latitud, longitud } = req.body;

  if (latitud == null || longitud == null) {
    return res.status(400).json({ error: 'Los campos latitud y longitud son obligatorios' });
  }
  try {
    const nuevoPunto = new Punto({
      lat: latitud,
      lng: longitud,
      nombre: 'Punto de reciclaje', // Puedes hacerlo más dinámico si quieres
      usuario: usuarioId
    });
    await nuevoPunto.save();
    res.status(201).json({ mensaje: 'Ubicación guardada con éxito', punto: nuevoPunto });
  } catch (e) {
    console.error('Error en /api/ubicaciones (POST):', e);
    res.status(500).json({ error: 'Error interno al guardar la ubicación' });
  }
});

// --- API: Eliminar una ubicación (ruta protegida) ---
app.delete('/api/eliminar-punto', isAuthenticated, async (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'Latitud y longitud requeridas' });
  }
  try {
    // Adicionalmente, se podría verificar que el punto pertenece al usuario logueado
    const punto = await Punto.findOne({ lat, lng, usuario: req.session.usuarioId });

    if (!punto) {
        return res.status(404).json({ error: 'Punto no encontrado o no tienes permiso para eliminarlo.' });
    }
    
    await Punto.findByIdAndDelete(punto._id);
    res.json({ mensaje: 'Punto eliminado con éxito', punto: punto });

  } catch (e) {
    console.error('Error en /api/eliminar-punto:', e);
    res.status(500).json({ error: 'Error interno al eliminar el punto' });
  }
});

// --- API: Obtener todas las ubicaciones ---
app.get('/api/ubicaciones', async (req, res) => {
  try {
    // Trae los puntos y popula el campo 'usuario' para mostrar solo el nombre
    const ubicaciones = await Punto.find().populate('usuario', 'nombre');
    res.json(ubicaciones);
  } catch (e) {
    console.error('Error en /api/ubicaciones (GET):', e);
    res.status(500).json({ error: 'Error interno al obtener las ubicaciones' });
  }
});

// --- Iniciar servidor ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
