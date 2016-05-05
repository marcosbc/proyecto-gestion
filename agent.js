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
/* Variables del programa */
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
// Vamos a realizar un barrido de las interfaces cada 10 segundos
// Se aprovecha para obtener los octetos y cortar el tráfico si procede
while(true) {
  ifArray = utils.updateIfArray(session);
  if(Object.keys(ifArray).length > 0) {
    // Obtenemos los usuarios conectados y los intentamos identificar
    connectedUsers = utils.collect(utils.getConnectedUsersAndUsage(ifArray, config.customers, config.defaultDataPlan, session), disconnectedUsers);
    for(userIterator in connectedUsers) {
      cleanUser = false;
      connectedUser = connectedUsers[userIterator];
      userDataPlan = config.dataPlan[connectedUser.plan];
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
          // Calculamos la caducidad del limite
          limitationEnd: 0
        }
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
  deasync.sleep(config.refreshPeriod);
}
