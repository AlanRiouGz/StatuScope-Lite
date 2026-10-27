# StatuScope Lite

Demo de médico construida con **Expo 54, Expo Router y React Native Web**. Conserva las pantallas de la demo anterior: acceso, dashboard, tarjetas y detalles, mapas con radio/estado, filtros de enfermedades, analítica y evaluación manual con catálogo y notas.

## Acceso de demostración

- Usuario: `medico@statuscope.demo`
- Contraseña pública de ejemplo: `Demo123!`

Todos los datos son ficticios. La sesión y los cambios del formulario se conservan en esta pestaña hasta cerrar sesión. Las credenciales son parte de una maqueta, no una barrera de seguridad. No introducir datos reales. La IA permanece deshabilitada.

## Desarrollo y construcción

Requiere Node 22 y npm. No necesita archivos `.env`, Firebase, backend ni MySQL.

```sh
npm ci
npm run web
npm test
npm run typecheck
npm run build:web
```

`npm run build:web` genera `dist/` mediante Expo. `Dockerfile` compila desde cero; `Dockerfile.ci` utiliza el directorio que ya generó CI. La imagen final solo ejecuta Nginx, no Node ni Metro.

## Qué se eliminó

Administración, registro de usuarios reales, Firebase y cliente HTTP de backend, operaciones de IA, rutas de ejemplo de Expo, Storybook, Cypress, Gluestack, NativeWind/Tailwind, librerías móviles no utilizadas, componentes no alcanzables y familias de iconos no utilizadas. Se mantienen los iconos Feather y MaterialCommunityIcons, los mapas y los formularios de médico.

El selector de documentos conserva únicamente nombre, tipo y tamaño; no lee ni envía su contenido. Los mapas base utilizan teselas públicas de OpenStreetMap, por lo que esa parte necesita salida a Internet. Los datos de la demo se generan localmente.

## Despliegue

Consultar [HARNESS.md](HARNESS.md). Los manifiestos están en `k8s/` y la pipeline en `.harness/pipeline.yml`. Se usa un Service ClusterIP, una réplica, puerto interno 8080 y proceso sin root. Petición inicial: 10m CPU / 16Mi; límite: 100m / 64Mi. Ajustar con mediciones de carga de la empresa.

No se desplegó automáticamente en el clúster de la empresa. Esta carpeta y este repositorio son independientes de StatuScopeFront y StatuScopeFrontDemo.
