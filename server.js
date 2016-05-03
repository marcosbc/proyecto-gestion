#!/usr/bin/env node
/* Configuracion inicial */
var snmp = require('net-snmp');
var config = require('./config'),
    utils = require('./utils'),
    users,
    db,
    session;
/* Variables del programa */
var ifStatusArr;
/* Programa principal */
// Inicializamos variables
db = utils.initDatabaseConnection(config);
users = utils.populateUsersArray(db);
session = utils.initSnmpSession(config);
// Contenido del programa principal
ifStatusArr = utils.updateIfStatusArray(session);
if(ifStatusArr.length > 0) {
  // No hubo error
  console.log(ifStatusArr);
}
// Terminamos cerrando la conexion con la base de datos
utils.endDatabaseConnection(db);
