# Validación de StatuScope Lite

Verificado el 27 de octubre de 2026, antes de publicar.

- TypeScript: sin errores.
- Vitest: 7 pruebas aprobadas del adaptador local, acceso, filtros, formulario manual y rechazo de operaciones ajenas a la demo.
- Navegador Chrome: contraseña incorrecta, acceso correcto, tarjetas, radio de búsqueda, detalle de tarjeta, analítica, catálogo, guardado y restauración del formulario, cierre de sesión y protección de rutas. Sin llamadas al backend/Firebase ni errores de ejecución.
- Exportación de Expo: correcta; 7 rutas estáticas.
- Dockerfile.ci: imagen construida y probada como UID/GID 101, sin capacidades adicionales, raíz de solo lectura y /tmp temporal.
- Prueba HTTP en Docker con límite de 64 MiB y 0.1 CPU: rutas, health check y JavaScript respondieron 200; /api/auth/me respondió 404.
- Memoria observada tras las solicitudes de prueba: 8.41 MiB. Es una muestra breve, no una prueba de carga ni una garantía de consumo máximo.
- YAML: se comprobó que los nombres/identificadores de todas las etapas y pasos y las imágenes de herramientas coinciden con la referencia final; se analizaron los manifiestos renderizados para ClusterIP y NodePort. Pendiente la validación final en el entorno Harness y clúster de la empresa.
- Integridad: los archivos de las dos carpetas anteriores mantienen los mismos hashes.

## Comparación local

| Medida | Demo anterior | Lite |
| --- | ---: | ---: |
| Paquetes instalados por npm en Windows | 1,565 | 752 |
| Directorio web dist (bytes, sin compresión) | 9,539,548 | 3,349,918 |
| Archivo JavaScript principal aproximado | 3.88 MB | 1.83 MB |
| Imagen Docker local, bytes reportados por Docker | 29,170,341 | 27,150,564 |

El directorio web disminuyó un 64.9%. El tamaño de la imagen disminuye menos porque conserva la misma base Nginx. Expo se utiliza durante desarrollo/compilación; no se ejecuta en el pod final. Los recursos de CI y los del pod desplegado son independientes.
