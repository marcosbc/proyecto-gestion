#!/usr/bin/env node
/*
 * Configuracion inicial
 */
var snmp = require('net-snmp');
var config = require('./config'),
    utils = require('./utils'),
    users,
    db,
    session;
/*
 * Programa principal
 */

// Inicializamos variables
db = utils.initDatabaseConnection(config);
users = utils.populateUsersArray(db);
session = utils.initSnmpSession(config);

// Contenido del programa principal
console.log('- Usuarios:')
console.log(users);
console.log();

console.log('- Resultado de una peticion GetRequest: ');
console.log(utils.snmpGet(session, "1.3.6.1.2.1.1.4.0"));
console.log();

console.log('- Resultado de una peticion SetRequest: ');
console.log(utils.snmpSet(session, {
  oid: "1.3.6.1.2.1.1.4.0",
  type: snmp.ObjectType.OctetString,
  value: "Administrator <postmaster@example.com>"
}));
console.log();

// Terminamos cerrando la conexion con la base de datos
utils.endDatabaseConnection(db);
