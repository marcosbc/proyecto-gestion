#!/usr/bin/env node
/* Configuracion inicial */
var snmp = require('net-snmp'),
    deasync = require('deasync');
var config = require('./config'),
    utils = require('./utils'),
    customers,
    connectedUsers,
    disconnectedUsers = {},
    session;
const ifUp = 1,
      ifDown = 2;
var ifArray,
    connectedUser,
    userIterator,
    customer,
    userDataPlan,
    userUsageEntry,
    cleanUser = false,
    userUsageTimerArray = {};
/* Programa principal */
// Inicializamos variables
session = utils.initSnmpSession(config);
// Idealmente habria que usar una base de datos
users = config.customers;
// Contenido del programa principal
// Vamos a realizar un barrido de las interfaces cada 5 segundos
// Se aprovecha para obtener los octetos y cortar el trafico si procede
while(true) {
  // Primero queremos obtener las interfaces y sus estados y MACs asociadas
  ifArray = utils.updateIfArray(session, config.ifLimit);
  if(Object.keys(ifArray).length > 0) {
    // Obtenemos los usuarios conectados y los intentamos identificar
    connectedUsers = utils.collect(utils.getConnectedUsersAndUsage(ifArray, config.customers, config.defaultDataPlan, session), disconnectedUsers);
    // Por cada usuario comprobaremos si cumple con su tarifa
    for(userIterator in connectedUsers) {
      cleanUser = false;
      // Variables para acortar lineas, no util para modificar
      connectedUser = connectedUsers[userIterator];
      userDataPlan = config.dataPlan[connectedUser.plan];
      // Iremos populando el array de contador por iteracion
      userUsageEntry = userUsageTimerArray[connectedUser.mac];
      if(typeof userUsageEntry === 'undefined') {
        // No tiene una entrada especifica aun, la creamos
        cleanUser = true;
      } else if(userUsageEntry.limitationEnd !== 0 && utils.getTime() >= userUsageEntry.limitationEnd) {
        // Ha expirado el corte, vamos a limpiar la tabla
        cleanUser = true;
        // Eliminamos entrada de usuario desconectado
        connectedUsers[userIterator].status = ifUp;
        connectedUsers[userIterator] = connectedUsers[userIterator];
        delete disconnectedUsers[userIterator];
        // Abrimos el trafico del puerto
        utils.openIfTraffic(connectedUser.ifPort, session);
      } else if(userUsageEntry.limitationEnd === 0 && connectedUser.usage > userUsageEntry.initialUsage + userDataPlan.limit) {
        // Ha superado el limite, vamos a cortarle el trafico
        userUsageTimerArray[connectedUser.mac].limitationEnd = utils.getTime() + userDataPlan.limitationDuration;
        // Creamos entrada de usuario desconectado
        connectedUsers[userIterator].status = ifDown;
        disconnectedUsers[userIterator] = connectedUsers[userIterator];
        // Cortamos el trafico del puerto
        utils.closeIfTraffic(connectedUser.ifPort, session);
      }
      if(cleanUser) {
        // El usuario no tiene una entrada especifica aun, vamos a crearla
        userUsageTimerArray[connectedUser.mac] = {
          initialUsage: connectedUser.usage,
          status: ifUp,
          limitationEnd: 0
        };
      }
    }
    /*
    // Para debugging
    console.log('Usuarios conectados:');
    console.log(connectedUsers);
    console.log('Tabla de uso:');
    console.log(userUsageTimerArray);
    console.log('Usuarios desconectados:');
    console.log(disconnectedUsers);
    */
  } else {
    console.error("Error al obtener datos");
  }
  // Esperar el intervalo establecido en la configuracion
  deasync.sleep(config.refreshPeriod);
}
