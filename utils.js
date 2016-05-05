/*
 * Dependencias
 */
var snmp = require('net-snmp'),
    deasync = require('deasync');
function initSnmpSession(cfg) {
  return snmp.createSession(cfg.snmp.host, cfg.snmp.community, cfg.snmp.options);
}
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
        }
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
        }
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
function snmpWalk(session, oids) {
  var responseObj = {
    error: false,
    msg: '',
    responses: []
  };
  var done = false,
      timeout = 100,
      counter = 0,
      i = 0;
  session.walk(oids, function(varbinds) {
    for (var i = 0; i < varbinds.length; i++) {
      console.log(varbinds[i]);
      responseObj.responses.push({
        oid: varbinds[i].oid,
        value: varbinds[i].value
      });
    }
  }, function(error) {
    if (error) {
      response.error = true;
      responseObj.msg = error.message;
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
        }
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
function isValidResponse(response) {
  if(response.error != false) {
    console.error(response.msg);
    return false;
  }
  return true;
}
function getMacResponse(ifPort, session) {
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
        macAddress = responseObj.value.toString('hex').replace(`${dot1dTpFdbEntry}.`, '');
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
function updateIfArray(session) {
  const ifNumber = "1.3.6.1.2.1.2.1",
        ifOperStatus = "1.3.6.1.2.1.2.2.1.8",
        ifCounterLimit = 28; // Evitar puertos con id muy elevado
  var numIfsResponse,
      ifStatusResponse,
      macResponse,
      numIfs,
      ifCounter;
      ifArr = {},
      ifIterator = 0;
  numIfsResponse = snmpGet(session, [`${ifNumber}.0`]);
  if(isValidResponse(numIfsResponse)) {
    // Obtener informacion de estado de todos los puertos
    numIfs = numIfsResponse.responses[0].value;
    for(ifIterator = 1, ifCounter = 1; ifCounter <= numIfs && ifCounter < ifCounterLimit; ifIterator++) {
      // No se puede hacer conjunto porque hay casos donde no existe un
      // puerto (p.ej. puertos 8, 10, 11... -> no existe el 9)
      ifStatusResponse = snmpGet(session, [`${ifOperStatus}.${ifIterator}`]);
      if(isValidResponse(ifStatusResponse)) {
        macResponse = '';
        ifCounter++;
        if(ifStatusResponse.responses[0].value === 1) {
          macResponse = getMacResponse(ifIterator, session);
        }
        ifArr[ifIterator] = {
          status: ifStatusResponse.responses[0].value,
          mac: macResponse
        };
      }
    }
  }
  return ifArr;
}
function findCustomer(mac, customerList) {
  var customer;
  for(customer in customerList) {
    if(mac === customerList[customer].mac) {
      return customerList[customer];
    }
  }
}
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
  // Obtener informacion del usuario conectado al puerto
  for(ifIterator in ifArray) {
    ifEntry = ifArray[ifIterator];
    if(ifEntry.status === ifUp && ifEntry.mac !== '') {
      userPlan = defaultPlan;
      if(customer = findCustomer(ifEntry.mac, customerList)) {
        userPlan = customer.dataPlan;
      }
      connectedUsers.push({
        ifPort: ifIterator,
        mac: ifEntry.mac,
        plan: userPlan,
        status: ifUp,
        usage: 0
      });
      etherStatsOctetsRequestOids.push(`${etherStatsOctets}.${ifIterator}`);
    }
  }
  // Obtener el uso de datos (en octetos) de cada usuario
  if(etherStatsOctetsRequestOids.length > 0) {
    etherStatsOctetsResponse = snmpGet(session, etherStatsOctetsRequestOids);
    if(isValidResponse(etherStatsOctetsResponse)) {
      for(userIterator in connectedUsers) {
        userUsage = etherStatsOctetsResponse.responses[userIterator].value;
        /*
        // Para debugging
        userUsage = ((new Date()).getTime());
        */
        connectedUsers[userIterator].usage = userUsage;
      }
    }
  }
  return connectedUsers;
}
function getTime() {
  var d = new Date();
  return Math.floor(d.getTime() / 1000);
}
function openIfTraffic(ifPort, session) {
  const ifAdminStatus = "1.3.6.1.2.1.2.2.1.7",
        ifUp = 1;
  var ifOpenTrafficRequest = snmpSet(session, [{
    oid: `${ifAdminStatus}.${ifPort}`,
    type: snmp.ObjectType.Integer,
    value: ifUp
  }]);
}
function closeIfTraffic(ifPort, session) {
  const ifAdminStatus = "1.3.6.1.2.1.2.2.1.7",
        ifDown = 2;
  var ifCloseTrafficRequest = snmpSet(session, [{
    oid: `${ifAdminStatus}.${ifPort}`,
    type: snmp.ObjectType.Integer,
    value: ifDown
  }]);
}
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
