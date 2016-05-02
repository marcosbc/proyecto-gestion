# Gestión de velocidad de usuarios de una red mediante SNMP

## Componentes del equipo

- Omar Feljy
- Beatriz Carretero Parra
- Marcos Bjorkelund

## Instrucciones de uso

### Requisitos iniciales

Para empezar, es necesario cumplir con unos requisitos iniciales:

- Es necesario instalar [NodeJS](https://nodejs.org/en/) en tu equipo y
  que se pueda usar mediante línea de comandos.
- Se debe tener un servidor MySQL accesible. Se puede configurar los
  parámetros de uso en el fichero de configuración, `config.json`.
- Se debe configurar un servidor SNMP y configurarlo apropiadamente en
  el fichero de configuración, `config.json`. Es necesario haber creado
  la base de datos antes de ejecutar el programa.

### Ejecución del cliente

Es imprescindible tener NodeJS instalado. Una vez está hecho, solo es
necesario ejecutar el siguiente comando dentro del repositorio (donde se
encuentre el `package.json`):

    npm install

Para hacerlo funcionar, basta con ejecutar el siguiente comando:

    node server.js
