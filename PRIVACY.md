# Política de privacidad de Cooldown Tracker

Última actualización: 19 de julio de 2026.

Cooldown Tracker es una extensión que permite definir bloqueos permanentes o temporales para sitios web. Su funcionamiento se realiza localmente en el navegador.

## Datos que utiliza

La extensión procesa los siguientes datos para prestar su función principal:

- Las URLs y nombres de los sitios que el usuario añade a su lista.
- La URL y el título de la pestaña activa cuando el usuario abre el popup.
- Las URLs de navegación, exclusivamente para compararlas con las reglas de bloqueo configuradas.
- Las preferencias, duraciones y estados de cooldown elegidos por el usuario.

## Uso y almacenamiento

Estos datos se utilizan únicamente para mostrar la interfaz, identificar coincidencias con las reglas guardadas, bloquear la navegación cuando corresponda y avisar cuando finaliza un cooldown.

Los datos se almacenan localmente mediante `chrome.storage.local`. Cooldown Tracker no dispone de servidores propios, no crea perfiles de usuario y no transmite estos datos fuera del dispositivo.

## Cesión y venta de datos

Cooldown Tracker no vende, alquila, comparte ni transfiere datos personales, actividad de navegación o configuración a terceros. Tampoco utiliza datos para publicidad, analítica, crédito o elaboración de perfiles.

El uso de la información cumple las restricciones de Uso Limitado de la Política de Datos de Usuario de Chrome Web Store.

## Conservación y eliminación

Los datos permanecen en el navegador hasta que el usuario elimina un sitio, importa un nuevo conjunto de datos, borra los datos de la extensión o desinstala la extensión. La función de exportación solo genera un archivo local cuando el usuario la ejecuta expresamente.

## Permisos

- `storage`: guardar sitios, preferencias y temporizadores localmente.
- `alarms`: finalizar cooldowns y programar avisos aunque el popup esté cerrado.
- `notifications`: mostrar un aviso cuando un sitio vuelve a estar disponible.
- `webNavigation`: detectar una navegación y aplicar las reglas configuradas.
- Acceso a páginas `http` y `https`: comparar el dominio o URL visitada con la lista definida por el usuario y redirigir únicamente cuando existe un bloqueo coincidente.

## Contacto

Para consultas sobre privacidad: **[AÑADIR_EMAIL_DE_CONTACTO_ANTES_DE_PUBLICAR]**.
