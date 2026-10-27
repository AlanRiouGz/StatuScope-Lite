# Pipeline y Service de StatuScope Lite

Esta pipeline parte del YAML final de preproducción proporcionado por Alan el 27 de octubre de 2026. Conserva los nombres e identificadores de etapas y pasos, las imágenes y versiones de herramientas, escáneres, canary, rolling y rollback. Los escaneos Nmap/ZAP siguen en la etapa deshabilitada del original.

## Cambios específicos de Lite

- Nueva identidad de pipeline: `StatuScope Lite - Preprod` / `StatuScope_Lite`; repositorio de Harness `StatuScope-Lite` (importar desde GitHub).
- Imagen de aplicación `statuscope-lite`; el registro por defecto sigue siendo `statuscopefront` y se puede seleccionar al ejecutar.
- Instalación sin el ajuste de Cypress porque esa dependencia ya no existe.
- Sin `FRONTEND_ENV_FILE`: la demo no necesita el Secret File StatuScope-Front.
- Service, entorno e infraestructura son entradas para seleccionar los de la empresa; no se reutiliza automáticamente el entorno de la demo anterior.
- Deploy Variables admite ClusterIP y NodePort. Por compatibilidad conserva el nombre de salida `NODE_PORT`; para ClusterIP contiene el puerto del Service (80). No activar los escáneres de instancia sin configurar un dominio y puerto accesibles desde sus ejecutores; `host.docker.internal` sigue siendo la referencia local heredada, no el destino corporativo.
- Trigger Production conserva su nombre y paso. Su URL ahora es `Production_webhook` y solo se ejecuta con `Trigger_production=true` (por defecto false). Introducir el webhook de producción de Lite; no el de StatuScopeFront_Prod. Puede proporcionarse mediante una expresión de secret de Harness.

## Crear el Service en Harness

Tipo Kubernetes / K8s Manifest. Fuente: repositorio `StatuScope-Lite`, rama `main`.

**Manifest paths:**

- `k8s/manifests/app.yml`
- `k8s/registry-secret.yml`

**Values.yaml:** `k8s/values.yml`

Agregar un artefacto primario que apunte a la imagen `statuscope-lite` en el registro seleccionado. En CD seleccionar la etiqueta que publicó CI: `<+pipeline.sequenceId>`; la entrada de artefacto sigue siendo runtime como en la referencia. No seleccionar una etiqueta de una ejecución anterior. `<+artifact.image>` debe resolver a la imagen completa, con registro y etiqueta.

El conector Kubernetes necesita autorización para el namespace seleccionado, incluyendo Deployments, Services, Secrets y ConfigMaps que utiliza Harness para sus releases. El namespace debe existir y la infraestructura debe referenciarlo.

## Credenciales

No subir los YAML como Secret Files. Son archivos del repositorio. El manifiesto del registro utiliza referencias a los Secret Text existentes `username-harness-SA` y `PAT-Harness-SA`; configurar alcance y permisos en el proyecto destino. El patrón actual usa `pkg.harness.io`. Si la empresa usa otro registry, adaptar conector, artefacto y ese host conjuntamente. La demo no necesita credenciales de Firebase, MySQL ni IA.

## Acceso y recursos

Por defecto: `serviceType: ClusterIP`. Asociar el Ingress/Gateway de la empresa a `statuscope-lite:80`, o comprobar temporalmente con:

```sh
kubectl -n NAMESPACE port-forward service/statuscope-lite 8080:80
```

Abrir http://localhost:8080. Para una prueba con NodePort, establecer `serviceType: NodePort` y elegir un `nodePort` libre en todo el clúster (30083 es solo el valor de ejemplo).

Nginx usa un worker, puerto 8080, UID/GID 101, sistema de archivos de solo lectura y un volumen temporal `/tmp`. Las cuotas de 10m/16Mi y 100m/64Mi son un punto de partida para esta demo estática. Canary crea temporalmente otro pod: reservar cuota para ambas réplicas durante el despliegue.
