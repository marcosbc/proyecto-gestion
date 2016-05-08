/* Configuracion inicial */
var snmp = require('net-snmp'),
    deasync = require('deasync');
/* Inicializa una sesion SNMP */
function initSnmpSession(cfg) {
  return snmp.createSession(cfg.snmp.host, cfg.snmp.community, cfg.snmp.options);
}
/* Realiza una peticion SNMP GetRequest */
function snmpGet(session, oids) {
  var responseObj = {
    error: true,
    msg: 'SNMP error',
    responses: []
  };
  var done = false,
      timeout = 100,
      counter = 0,
      i = 0;
  session.get(oids, function(error, varbinds) {
    if (error) {
      responseObj.msg = error.message;
    } else {
      responseObj.error = false;
      for (var i = 0; i < varbinds.length; i++) {
        responseObj.responses[i] = {
          oid: varbinds[i].oid,
          value: varbinds[i].value
        };
      }
    }
    done = true;
  });
  // Buscamos hacer esta llamada sincrona
  while(!done && counter < timeout) {
    deasync.sleep(20);
    counter++;
  }
  return responseObj;
}
/* Realiza una peticion SNMP GetNextRequest */
function snmpGetNext(session, oids) {
  var responseObj = {
    error: true,
    msg: 'SNMP error',
    responses: []
  };
  var done = false,
      timeout = 100,
      counter = 0,
      i = 0;
  session.getNext(oids, function(error, varbinds) {
    if (error) {
      responseObj.msg = error.message;
    } else {
      responseObj.error = false;
      for (var i = 0; i < varbinds.length; i++) {
        responseObj.responses[i] = {
          oid: varbinds[i].oid,
          value: varbinds[i].value
        };
      }
    }
    done = true;
  });
  // Buscamos hacer esta llamada sincrona
  while(!done && counter < timeout) {
    deasync.sleep(20);
    counter++;
  }
  return responseObj;
}
/* Realiza una peticion SNMP SetRequest */
function snmpSet(session, requestVarbinds) {
  var responseObj = {
    error: true,
    msg: 'SNMP error',
    responses: []
  }
  var done = false,
      timeout = 100,
      counter = 0;
  session.set(requestVarbinds, function(error, varbinds) {
    if (error) {
      responseObj.msg = error.message;
    } else {
      responseObj.error = false;
      for (var i = 0; i < varbinds.length; i++) {
        responseObj.responses[i] = {
          oid: varbinds[i].oid,
          value: varbinds[i].value
        };
      }
    }
    done = true;
  });
  // Buscamos hacer esta llamada sincrona
  while(!done && counter < timeout) {
    deasync.sleep(10);
    counter++;
  }
  return responseObj;
}
/* Comprueba si la respuesta de una de las funciones anteriores
   para realizar peticiones SNMP es correcta */
function isValidResponse(response) {
  if(response.error != false) {
    console.error(response.msg);
    return false;
  }
  return true;
}
/* Obtiene un cliente en la lista de clientes conociendo su MAC */
function findCustomer(mac, customerList) {
  var customer;
  for(customer in customerList) {
    if(mac === customerList[customer].mac) {
      return customerList[customer];
    }
  }
}
/* Obtiene la direccion MAC del dispositivo conectado al puerto
   correspondiente en el conmutador */
function getMacConnectedAtPort(ifPort, session) {
  const dot1dTpFdbEntry = "1.3.6.1.2.1.17.4.3.1";
  var ifPortCounter = 0,
      lastOid = dot1dTpFdbEntry,
      response,
      responseObj,
      macAddressOid,
      macAddress,
      portIfForMac;
  while((response = snmpGetNext(session, [lastOid]))) {
    responseObj = response.responses[0];
    lastOid = responseObj.oid;
    if(responseObj.oid.indexOf(dot1dTpFdbEntry + ".1") === 0) {
      macAddressOid = responseObj.oid.substring(responseObj.oid.indexOf(dot1dTpFdbEntry + ".1") + dot1dTpFdbEntry.length + 3);
      portIfForMac = snmpGet(session, [`${dot1dTpFdbEntry}.2.${macAddressOid}`]).responses[0].value;
      if(portIfForMac == ifPort) {
        macAddress = responseObj.value.toString('hex');
        break;
      }
    } else {
      // No encontramos la MAC
      macAddress = '';
      break;
    }
  }
  return macAddress;
}
/* Crea un array de usuarios conectados a los puertos de un conmutador */
function updateIfArray(session, ifLimit) {
  const ifNumber = "1.3.6.1.2.1.2.1",
        ifOperStatus = "1.3.6.1.2.1.2.2.1.8",
        ifCounterLimit = ifLimit; // Evitar puertos con id muy elevado
  var numIfsResponse,
      ifStatusResponse,
      macResponse,
      numIfs,
      ifCounter;
      ifArr = {},
      ifIterator = 0;
  // Primero, obtener el numero de puertos del conmutador
  numIfsResponse = snmpGet(session, [`${ifNumber}.0`]);
  if(isValidResponse(numIfsResponse)) {
    numIfs = numIfsResponse.responses[0].value;
    // Obtener informacion de estado de todos los puertos recorriendo uno a uno
    // Se ha establecido un limite del id. de puerto en la configuracion
    for(ifIterator = 1, ifCounter = 1; ifCounter <= numIfs && ifCounter < ifCounterLimit; ifIterator++) {
      // No se puede hacer peticion conjunta porque hay casos donde no existe un
      // puerto en medio (p.ej. puertos 8, 10, 11... -> no existe el 9)
      ifStatusResponse = snmpGet(session, [`${ifOperStatus}.${ifIterator}`]);
      if(isValidResponse(ifStatusResponse)) {
        ifCounter++;
        // Intentar obtener la direccion MAC si el puerto no esta conectado
        macResponse = '';
        if(ifStatusResponse.responses[0].value === 1) {
          // Para probar en casa, descomentar la siguiente linea
          macResponse = getMacConnectedAtPort(ifIterator, session);
        }
        // Asignar la entrada correspondiente en el array resultante
        ifArr[ifIterator] = {
          status: ifStatusResponse.responses[0].value,
          mac: macResponse
        };
      }
    }
  }
  return ifArr;
}
/* Obtiene array de usuarios conectados a puertos y bytes consumidos */
function getConnectedUsersAndUsage(ifArray, customerList, defaultPlan, session) {
  const ifUp = 1,
        ifDown = 2,
        ifTesting = 3,
        etherStatsOctets = "1.3.6.1.2.1.16.1.1.1.4";
  var connectedUsers = [],
      ifEntry,
      ifIterator,
      userIterator,
      userPlan,
      customer,
      userUsage,
      etherStatsOctetsRequestOids = [],
      etherStatsOctetsResponse;
  // Obtener informacion de los usuarios conectados a los puertos
  // Se realiza a partir del array de estado de interfaces
  for(ifIterator in ifArray) {
    ifEntry = ifArray[ifIterator];
    if(ifEntry.status === ifUp && ifEntry.mac !== '') {
      // Si interfaze en linea y MAC conocida, buscar tarifa del cliente
      userPlan = defaultPlan;
      if(customer = findCustomer(ifEntry.mac, customerList)) {
        userPlan = customer.dataPlan;
      }
      // Crea la entrada de usuario en el array
      connectedUsers.push({
        ifPort: ifIterator,
        mac: ifEntry.mac,
        plan: userPlan,
        status: ifUp,
        usage: 0
      });
      // La petición de obtencion de bytes consumidos se realizara una peticion
      etherStatsOctetsRequestOids.push(`${etherStatsOctets}.${ifIterator}`);
    }
  }
  // Obtener el uso de datos (en octetos) de cada usuario y actualizar array
  if(etherStatsOctetsRequestOids.length > 0) {
    etherStatsOctetsResponse = snmpGet(session, etherStatsOctetsRequestOids);
    if(isValidResponse(etherStatsOctetsResponse)) {
      for(userIterator in connectedUsers) {
        userUsage = etherStatsOctetsResponse.responses[userIterator].value;
        /*
        // Para debugging en casa, sin conmutador
        userUsage = ((new Date()).getTime());
        */
        connectedUsers[userIterator].usage = userUsage;
      }
    }
  }
  return connectedUsers;
}
/* Obtiene la fecha y hora en formato Unix (segundos) */
function getTime() {
  var d = new Date();
  return Math.floor(d.getTime() / 1000);
}
/* Abre un puerto del conmutador */
function openIfTraffic(ifPort, session) {
  const ifAdminStatus = "1.3.6.1.2.1.2.2.1.7",
        ifUp = 1;
  var ifOpenTrafficRequest = snmpSet(session, [{
    oid: `${ifAdminStatus}.${ifPort}`,
    type: snmp.ObjectType.Integer,
    value: ifUp
  }]);
  /*
  // Para debugging
  console.log(`*** Re-abierto puerto ${ifPort} ***`);
  */
}
/* Corta un puerto del conmutador */
function closeIfTraffic(ifPort, session) {
  const ifAdminStatus = "1.3.6.1.2.1.2.2.1.7",
        ifDown = 2;
  var ifCloseTrafficRequest = snmpSet(session, [{
    oid: `${ifAdminStatus}.${ifPort}`,
    type: snmp.ObjectType.Integer,
    value: ifDown
  }]);
  /*
  // Para debugging
  console.log(`*** Cortado puerto ${ifPort} ***`);
  */
}
/* Une dos objetos Javascript de tipo clave-valor (no arrays) */
function collect() {
  var ret = {};
  var len = arguments.length;
  for (var i=0; i<len; i++) {
    for (p in arguments[i]) {
      if (arguments[i].hasOwnProperty(p)) {
        ret[p] = arguments[i][p];
      }
    }
  }
  return ret;
}
module.exports = {
  initSnmpSession: initSnmpSession,
  snmpGet: snmpGet,
  snmpSet: snmpSet,
  isValidResponse: isValidResponse,
  updateIfArray: updateIfArray,
  findCustomer: findCustomer,
  getConnectedUsersAndUsage: getConnectedUsersAndUsage,
  getTime: getTime,
  openIfTraffic: openIfTraffic,
  closeIfTraffic: closeIfTraffic,
  collect: collect
}
