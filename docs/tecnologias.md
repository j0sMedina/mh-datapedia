# Stack tecnológico — MH Datapedia

Descripción de cada tecnología usada en el proyecto, agrupada por área.

---

## Monorepo y herramientas base

### Turborepo
Orquestador de tareas para monorepos. Cuando ejecutás `pnpm build`, Turborepo construye primero el paquete `shared` (porque `api` y `web` dependen de él) y luego construye ambas apps en paralelo. También cachea los resultados de las tareas: si no cambió nada en un paquete, no lo vuelve a compilar.

### pnpm
Gestor de paquetes. Más rápido que npm y ocupa menos espacio en disco porque usa un almacén centralizado de paquetes (no los duplica por proyecto). El archivo `pnpm-workspace.yaml` le indica que este repositorio tiene cuatro paquetes (`apps/api`, `apps/web`, `apps/mobile`, `packages/shared`) y les permite referenciarse entre sí — por ejemplo, la API importa `@mh-datapedia/shared` directamente desde el código fuente local.

### TypeScript
Agrega tipos estáticos a JavaScript. Los cuatro paquetes son TypeScript. Las ventajas concretas en este proyecto: si renombrás un campo en un schema de Zod, el compilador te muestra exactamente en qué archivos de la API, del frontend y de la app móvil se rompe, antes de que llegue a producción.

---

## Paquete compartido (`packages/shared`)

### Zod
Librería de validación de schemas. Definís la forma de los datos una sola vez y obtenés dos cosas automáticamente: validación en runtime del lado de la API (rechaza requests malformados antes de tocar la base de datos) y tipos de TypeScript del lado del frontend. El mismo archivo de schema lo importan tanto la API como el web.

Los schemas principales incluyen:
- **`auth.schema.ts`** — RegisterSchema, LoginSchema
- **`enums.schema.ts`** — RoleSchema (`USER | HELPER | ADMIN | MASTER`), AuditActionSchema (`ROLE_CHANGE | BAN | UNBAN`)
- **`monster.schema.ts`**, **`strategy.schema.ts`**, **`weakness.schema.ts`**, **`hitzone.schema.ts`** — schemas de contenido

---

## Backend (`apps/api`)

### Node.js
Runtime de JavaScript — el proceso que ejecuta el servidor de la API.

### Express
Framework HTTP. Define las rutas (`GET /api/monsters`, `PUT /api/monsters/:id/weaknesses`, etc.), encadena middlewares en orden (rate limit → autenticación → autorización → validación → handler) y centraliza el manejo de errores al final de la cadena.

### Prisma
Cumple dos roles. Primero, es el **ORM**: en lugar de escribir SQL, escribís `prisma.monster.findMany(...)` y genera llamadas a la base de datos con tipado completo. Segundo, gestiona las **migraciones**: cada cambio al schema genera un archivo `.sql` versionado en `prisma/migrations/`, y `prisma migrate deploy` los aplica en orden en producción de forma segura.

### PostgreSQL
La base de datos relacional. Almacena monstruos, usuarios, debilidades elementales, hitzones, drops, estrategias, favoritos, intentos de login fallidos, tokens revocados y el log de auditoría. Está hosteada en Fly.io como una app separada (`mh-datapedia-db`).

### bcrypt
Hashea las contraseñas antes de guardarlas. Un hash de bcrypt es unidireccional: podés verificar si una contraseña coincide con el hash, pero no podés revertirlo para obtener la contraseña original. El factor de costo 12 lo hace lo suficientemente lento como para resistir ataques de fuerza bruta.

### JWT (jsonwebtoken)
JSON Web Tokens para autenticación. Al hacer login, la API emite un **access token** de vida corta (15 min, se envía en el header `Authorization: Bearer`) y un **refresh token** de vida larga (7 días, guardado como cookie httpOnly en el navegador). El access token es stateless: la API verifica la firma criptográfica sin consultar la base de datos.

El payload del JWT incluye el `role` del usuario (`USER | HELPER | ADMIN | MASTER`). Al decodificar, `authenticate.ts` valida que el rol sea uno de los cuatro valores conocidos — un JWT con un rol inventado es rechazado con 401.

### crypto (Node.js built-in)
Módulo nativo de Node.js usado para **detección de reutilización de tokens**. Cuando un refresh token rota, su hash SHA-256 se guarda en la tabla `RevokedToken`. Si alguien intenta usar un token ya rotado, se detecta la reutilización, se eliminan todas las sesiones del usuario y se devuelve 401 `TOKEN_REUSE_DETECTED`.

### express-rate-limit
Limita la cantidad de requests que una misma IP puede hacer en una ventana de tiempo. El proyecto tiene cinco limitadores:

| Limitador | Ventana | Límite | Aplicado a |
|-----------|---------|--------|-----------|
| `generalLimiter` | 15 min | 100 req | Todas las rutas |
| `authLimiter` | 15 min | 20 req | `/login`, `/register` |
| `strategyLimiter` | 1 hora | 10 req | `POST /api/strategies` |
| `adminLimiter` | 15 min | 30 req | Todos los `PATCH /api/admin/*` |
| `searchLimiter` | 1 min | 60 req | `GET /api/monsters`, `GET /api/admin/users` |

Todos los limitadores tienen `skip: () => process.env.NODE_ENV === 'test'` para no interferir con el test suite.

### Winston
Logger estructurado. Cada request queda registrado como JSON con un campo `requestId`, lo que permite rastrear una solicitud completa a través de los logs en Fly.io.

### dotenv
Carga archivos `.env` en `process.env` durante el desarrollo. En producción, las variables de entorno vienen de los secrets de Fly.io (`flyctl secrets set`) en lugar de archivos.

---

## Frontend (`apps/web`)

### Vite
Herramienta de build y servidor de desarrollo. En desarrollo sirve los archivos al instante usando ES modules nativos del navegador (sin paso de bundling). Para producción empaqueta y minifica todo.

### React 18
Librería de UI. Toda la app web está construida como componentes React.

### TanStack Router
Router basado en archivos para React. Cada archivo dentro de `src/routes/` se convierte en una ruta. Maneja navegación con tipado completo y parámetros de URL. Las rutas protegidas usan `beforeLoad` para verificar el rol del usuario — por ejemplo, `/admin` redirige a `/` si el rol es USER.

### TanStack Query (React Query)
Gestor de estado del servidor. Se encarga de hacer fetching, cachear respuestas, refetchear en background e invalidar el cache cuando los datos cambian.

### Tailwind CSS
Framework de CSS utilitario. En lugar de escribir clases CSS propias, escribís las utilidades directamente en el JSX. El build de producción solo incluye las clases que realmente se usaron.

### useDebounce (hook interno)
Hook propio en `apps/web/src/hooks/useDebounce.ts`. Retrasa la propagación de un valor que cambia rápido (como el texto de un input de búsqueda) por 400ms antes de usarlo como query key o parámetro de URL, evitando un request por cada tecla presionada.

### Lucide React
Librería de íconos SVG como componentes React.

---

## App móvil (`apps/mobile`)

### Expo
Framework para crear apps móviles con React Native. Maneja la configuración del proyecto, el proceso de build nativo (Android/iOS) y la distribución via EAS (Expo Application Services). El archivo `app.json` declara el nombre, versión, íconos y configuración de cada plataforma.

### React Native
Librería que permite escribir componentes React que se renderizan como vistas nativas (no WebViews). Los componentes son `View`, `Text`, `ScrollView` en lugar de `div`, `p`.

### NativeWind
Adapta Tailwind CSS para React Native. Permite usar `className="bg-stone-900 text-stone-50"` en componentes nativos en lugar del objeto `StyleSheet` de React Native. **Importante:** en `ScrollView`, los estilos de layout (`flex`, `flex-1`) deben pasarse como prop `style` en lugar de `className`, porque NativeWind no los aplica correctamente en ese componente específico.

### EAS (Expo Application Services)
Servicio de Expo para builds en la nube y distribución. `eas build -p android --profile preview` compila un `.apk` en los servidores de Expo sin necesitar un entorno de build local. El archivo `eas.json` define los perfiles de build (development, preview, production).

---

## Infraestructura

### Docker
Empaqueta la app en una imagen de contenedor portable. El Dockerfile de la API tiene dos etapas: una `builder` que instala dependencias y compila TypeScript, y un `runner` liviano que solo contiene el output compilado. El Dockerfile del web construye los archivos estáticos con Vite y los sirve con nginx.

### Fly.io
Plataforma cloud que ejecuta los contenedores Docker. El proyecto tiene tres apps en Fly: `mh-datapedia-api` (Express), `mh-datapedia-web` (nginx sirviendo el build de React) y `mh-datapedia-db` (PostgreSQL). Se comunican a través de la red privada IPv6 interna de Fly.

### GitHub
Control de versiones y disparador del pipeline de CI/CD.

### GitHub Actions
Ejecuta workflows automáticos en los servidores de GitHub cuando hay un push a `master`. Corre los 52 tests y, si pasan, despliega a Fly.io automáticamente. Solo despliega el servicio cuyos archivos cambiaron (path filtering).

---

## Resumen visual

```
Repositorio (GitHub)
└── mh-datapedia/ (Turborepo + pnpm workspaces)
    ├── packages/shared/     Zod schemas + tipos TypeScript (roles, auditoría, contenido)
    ├── apps/api/            Node.js + Express + Prisma → PostgreSQL (Fly)
    ├── apps/web/            React 18 + Vite + TanStack → nginx (Fly)
    └── apps/mobile/         React Native + Expo → EAS build → .apk / .ipa
```
