#!/usr/bin/env node
/* Configuracion inicial */
var snmp = require('net-snmp'),
    deasync = require('deasync');
var config = require('./config'),
    utils = require('./utils'),
    customers,
    connectedUsers,
    session;
/* Variables del programa */
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
  if(ifArray.length > 0) {
    // Obtenemos los usuarios conectados y los intentamos identificar
    connectedUsers = utils.getConnectedUsersAndUsage(ifArray, customers, config.defaultDataPlan, session);
    for(userIterator = 0; userIterator < connectedUsers.length; userIterator++) {
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
        // Abrimos el trafico del puerto
        utils.openIfTraffic(connectedUser.ifPort, session);
      } else if(userUsageEntry.limitationEnd === 0 && connectedUser.usage > userUsageEntry.initialUsage + userDataPlan.limit) {
        // Ha superado el limite, vamos a cortarle el trafico
        userUsageTimerArray[connectedUser.mac].limitationEnd = utils.getTime() + userDataPlan.limitationDuration;
        // Cortamos el trafico del puerto
        utils.closeIfTraffic(connectedUser.ifPort, session);
      }
      if(cleanUser) {
        // El usuario no tiene una entrada especifica aun, vamos a crearla
        userUsageTimerArray[connectedUser.mac] = {
          initialUsage: connectedUser.usage,
          // Calculamos la caducidad del limite
          limitationEnd: 0
        }
      }
    }
    // Para debugging
    /*
    console.log('Usuarios conectados:');
    console.log(connectedUsers);
    console.log('Tabla de uso:');
    console.log(userUsageTimerArray);
    */
  } else {
    console.error("Error al obtener datos");
  }
  deasync.sleep(config.refreshPeriod);
}
