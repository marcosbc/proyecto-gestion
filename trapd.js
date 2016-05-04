#!/usr/bin/env node
/* Configuracion inicial */
var snmpjs = require('snmpjs'),
    trapd;
// Creamos el demonio de monitorizacion de traps para actualizar el puerto
trapd = snmpjs.createTrapListener();
trapd.on('trap', function(msg) {
    result.push(msg);
    var now = new Date();
    console.log("Trap received " + now);
    console.log(result.length);
});
trapd.bind({family: 'udp4', port: 162});
