# Stack tecnológico — MH Datapedia

Descripción de cada tecnología usada en el proyecto, agrupada por área.

---

## Monorepo y herramientas base

### Turborepo
Orquestador de tareas para monorepos. Cuando ejecutás `pnpm build`, Turborepo construye primero el paquete `shared` (porque `api` y `web` dependen de él) y luego construye ambas apps en paralelo. También cachea los resultados de las tareas: si no cambió nada en un paquete, no lo vuelve a compilar.

### pnpm
Gestor de paquetes. Más rápido que npm y ocupa menos espacio en disco porque usa un almacén centralizado de paquetes (no los duplica por proyecto). El archivo `pnpm-workspace.yaml` le indica que este repositorio tiene tres paquetes (`apps/api`, `apps/web`, `packages/shared`) y les permite referenciarse entre sí — por ejemplo, la API importa `@mh-datapedia/shared` directamente desde el código fuente local.

### TypeScript
Agrega tipos estáticos a JavaScript. Los tres paquetes son TypeScript. Las ventajas concretas en este proyecto: si renombrás un campo en un schema de Zod, el compilador te muestra exactamente en qué archivos de la API y del frontend se rompe, antes de que llegue a producción.

---

## Paquete compartido (`packages/shared`)

### Zod
Librería de validación de schemas. Definís la forma de los datos una sola vez (por ejemplo, `UpsertWeaknessesSchema`) y obtenés dos cosas automáticamente: validación en runtime del lado de la API (rechaza requests malformados antes de tocar la base de datos) y tipos de TypeScript del lado del frontend (`UpsertWeaknesses`). El mismo archivo de schema lo importan tanto la API como el web.

---

## Backend (`apps/api`)

### Node.js
Runtime de JavaScript — el proceso que ejecuta el servidor de la API.

### Express
Framework HTTP. Define las rutas (`GET /api/monsters`, `PUT /api/monsters/:id/weaknesses`, etc.), encadena middlewares en orden (rate limit → autenticación → validación → handler) y centraliza el manejo de errores al final de la cadena.

### Prisma
Cumple dos roles. Primero, es el **ORM**: en lugar de escribir SQL, escribís `prisma.monster.findMany(...)` y genera llamadas a la base de datos con tipado completo. Segundo, gestiona las **migraciones**: cada cambio al schema genera un archivo `.sql` versionado en `prisma/migrations/`, y `prisma migrate deploy` los aplica en orden en producción de forma segura.

### PostgreSQL
La base de datos relacional. Almacena monstruos, usuarios, debilidades elementales, hitzones, drops, estrategias y favoritos. Está hosteada en Fly.io como una app separada (`mh-datapedia-db`).

### bcrypt
Hashea las contraseñas antes de guardarlas. Un hash de bcrypt es unidireccional: podés verificar si una contraseña coincide con el hash, pero no podés revertirlo para obtener la contraseña original. El factor de costo 12 lo hace lo suficientemente lento como para resistir ataques de fuerza bruta.

### JWT (jsonwebtoken)
JSON Web Tokens para autenticación. Al hacer login, la API emite un **access token** de vida corta (se envía en el header `Authorization`) y un **refresh token** de vida larga (guardado como cookie httpOnly en el navegador). El access token es stateless: la API verifica la firma criptográfica sin necesidad de consultar la base de datos.

### express-rate-limit
Limita la cantidad de requests que una misma IP puede hacer en una ventana de tiempo. En el proyecto hay dos limitadores: uno general (100 req / 15 min) y uno más estricto para autenticación (20 intentos / 15 min) sobre `/login` y `/register`. Usa almacenamiento en memoria, por lo que se resetea al reiniciar el proceso.

### Winston
Logger estructurado. Cada request queda registrado como JSON con un campo `requestId`, lo que permite rastrear una solicitud completa a través de los logs en Fly.io.

### dotenv
Carga archivos `.env` en `process.env` durante el desarrollo. En producción, las variables de entorno vienen de los secrets de Fly.io (`flyctl secrets set`) en lugar de archivos.

---

## Frontend (`apps/web`)

### Vite
Herramienta de build y servidor de desarrollo. En desarrollo sirve los archivos al instante usando ES modules nativos del navegador (sin paso de bundling). Para producción empaqueta y minifica todo. Es significativamente más rápido que Webpack.

### React 18
Librería de UI. Toda la app web está construida como componentes React. Usa el modelo de renderizado concurrente de React 18, que habilita `Suspense` y transiciones suaves.

### TanStack Router
Router basado en archivos para React. Cada archivo dentro de `src/routes/` se convierte en una ruta. Maneja navegación con tipado completo, parámetros de URL y parámetros de búsqueda — `useParams()` devuelve el ID del monstruo tipado como `string`, no como `any`.

### TanStack Query (React Query)
Gestor de estado del servidor. Se encarga de hacer fetching, cachear respuestas, refetchear en background e invalidar el cache cuando los datos cambian. Cuando editás las debilidades de un monstruo y guardás, `invalidateQueries(['monsters', id, 'weaknesses'])` le avisa a todos los componentes que muestran esos datos que deben volver a pedirlos. Los hooks del proyecto (`useMonster`, `useWeaknesses`, `useUpdateHitzones`, etc.) son envoltorios delgados sobre esta librería.

### Tailwind CSS
Framework de CSS utilitario. En lugar de escribir clases CSS propias (`.card { border: 1px solid ... }`), escribís las utilidades directamente en el JSX: `className="border border-stone-800 rounded p-3"`. El build de producción escanea los archivos y solo incluye las clases que realmente usaste.

### Lucide React
Librería de íconos. Provee íconos SVG como componentes React (`<Trash2 />`, `<Star />`, etc.) — usados en los botones de eliminar fila del editor de hitzones, entre otros lugares.

---

## Infraestructura

### Docker
Empaqueta la app en una imagen de contenedor portable. El Dockerfile de la API tiene dos etapas: una `builder` que instala dependencias y compila TypeScript, y un `runner` liviano que solo contiene el output compilado. El Dockerfile del web construye los archivos estáticos con Vite y los sirve con nginx.

### Fly.io
Plataforma cloud que ejecuta los contenedores Docker. El proyecto tiene tres apps en Fly: `mh-datapedia-api` (Express), `mh-datapedia-web` (nginx sirviendo el build de React) y `mh-datapedia-db` (PostgreSQL). Se comunican a través de la red privada IPv6 interna de Fly.

### GitHub
Control de versiones y disparador del pipeline de CI/CD.

### GitHub Actions *(en configuración)*
Ejecuta workflows automáticos en los servidores de GitHub cuando hay un push. Correrá los tests y, si pasan, desplegará a Fly.io automáticamente.

---

## Resumen visual

```
Repositorio (GitHub)
└── mh-datapedia/ (Turborepo + pnpm workspaces)
    ├── packages/shared/     Zod schemas + tipos TypeScript
    ├── apps/api/            Node.js + Express + Prisma → PostgreSQL (Fly)
    └── apps/web/            React 18 + Vite + TanStack → nginx (Fly)
```
