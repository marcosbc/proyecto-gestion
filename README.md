# Gestión de puertos de una red con usuarios mediante un agente SNMP

## Componentes del equipo

- Omar Feljy
- Beatriz Carretero Parra
- Marcos Bjorkelund

## Introducción

El proyecto consiste en la programación de un agente que sea capaz de
cortar el tráfico cuando se supere cierto umbral de octetos en el
tráfico de un puerto del conmutador usago en los laboratorios (HP 2510 o
2610).

Contaremos con un grupo de usuarios, cada uno tendrá definido una
tarifa. Si no existe un usuario, se le asigna la tarifa por defecto
("Invitados"). Podremos identificar cada usuario por la dirección
física, dirección MAC, del equipo conectado al conmutador.
La lista de usuarios está definida en el fichero de configuración, por
simplicidad, pero para una aplicación real sería necesaria una base de
datos.

El umbral mencionado anteriormente se obtiene a partir de la tarifa del
usuario conectado al puerto correspondiente.
Si se supera este umbral, se le corta el tráfico al usuario durante un
periodo de tiempo definido en el fichero de configuración (definido en
segundos), cortando el puerto.
Si se da el caso de que se ha superado el límite de tiempo establecido,
se le abre el puerto y podrá volver a enviar tráfico al conmutador.

La monitorización de puertos y del tráfico se realiza mediante
peticiones SNMP. Por cuestiones de tiempo y simplicidad, se ha optado
por realizar esto periódicamente, aunque se podría haber realizado
guardando el estado inicial y, a partir de traps SNMP, obtener los
cambios en la topología (p. ej. se disconecta un equipo del conmutador
manualmente).

## Instrucciones de uso

### Requisitos iniciales

Para empezar, es necesario cumplir con unos requisitos iniciales:

- Es necesario instalar [NodeJS](https://nodejs.org/en/) en tu equipo y
  que se pueda usar mediante línea de comandos (junto con NPM).
- Se debe configurar un servidor SNMP y configurarlo apropiadamente en
  el fichero de configuración, `config.json`. Es necesario haber creado
  la base de datos antes de ejecutar el programa.

### Ejecución del cliente

Es imprescindible tener NodeJS instalado. Una vez está hecho, solo es
necesario ejecutar el siguiente comando dentro del repositorio (donde se
encuentre el `package.json`):

    npm install

Para hacerlo funcionar, basta con ejecutar el siguiente comando:

    node agent.js

### Instrucciones para la demo

Para la demo es necesario iniciar un agente TFTP, cuyo servidor tenga
asociado la tarifa "Empresas" o "Delfin", mientras el cliente tenga
asignada la tarifa "Invitados".

Se va a enviar [una imágen sobre un cuadro de Van Gogh](https://upload.wikimedia.org/wikipedia/commons/3/3e/Irises-Vincent_van_Gogh.jpg)
desde el cliente al servidor. El cliente no podrá completar la
transferencia debido a que se le cortará su conexión antes de
terminarla. El comando correspondiente para la transferencia será:

    tftp -i -r2 IP_PC_SERVIDOR PUT Irises-Vincent_van_Gogh.jpg

Para comprobar que se corta la conexión del cliente, en cada PC
tendremos una ventana haciendo un ping contínuo (`ping -t`) mientras
se transfiere, además, el servidor seguirá pudiendo hacer peticiones
por la configuración de su tarifa ("Empresas"). Será necesario
esperar 80 segundos (tiempo de espera para invitados) hasta que el
cliente pueda volver a realizar peticiones al conmutador.
