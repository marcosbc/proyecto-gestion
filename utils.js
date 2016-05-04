/*
 * Dependencias
 */
var mysql = require('mysql'),
    snmp = require('net-snmp'),
    deasync = require('deasync')
/*
 * Inicializa la base de datos e inserta datos de ejemplo,
 * segun lo especificado en config.json.
 */
function initDatabaseConnection(cfg) {
  var connection = mysql.createConnection(cfg.db);
  var done = false,
      timeout = 50,
      counter = 0;
  var query = 'DROP TABLE IF EXISTS `usuarios`;\n' +
              'CREATE TABLE `usuarios` (\n'        +
              '  nombre CHAR(20) NOT NULL,\n'      +
              '  tarifa CHAR(20),\n'               +
              '  mac_address CHAR(17)\n'           +
              ');\n'                               +
              'INSERT INTO `usuarios`\n'           +
              '  (nombre, tarifa, mac_address)\n'  +
              'VALUES\n'                           +
              '   ("' + cfg.user1.nombre + '", "' + cfg.user1.tarifa + '", "' + cfg.user1.mac + '");\n' +
              'INSERT INTO `usuarios`\n'           +
              '  (nombre, tarifa, mac_address)\n'  +
              'VALUES\n'                           +
              '   ("' + cfg.user2.nombre + '", "' + cfg.user2.tarifa + '", "' + cfg.user2.mac + '");'
  connection.connect();
  connection.query(query, function(err) {
    if (err) {
      throw err;
    }
    done = true;
  });
  // Buscamos hacer esta llamada sincrona
  while(!done && counter < timeout) {
    deasync.sleep(20);
    counter++;
  }
  return connection
}
function endDatabaseConnection(connection) {
  connection.end();
}
function populateUsersArray(connection) {
  var query = '',
      i,
      users = [];
  var done = false,
      timeout = 100,
      counter = 0;
  var query = 'SELECT nombre, tarifa, mac_address FROM `usuarios`;';
  connection.query(query, function(err, rows, fields) {
    if (err) {
      throw err;
    }
    for(i = 0; i < rows.length; i++) {
      users.push({
        nombre: rows[i].nombre,
        tarifa: rows[i].tarifa,
        mac: rows[i].mac_address
      });
    }
    done = true;
  });
  // Buscamos hacer esta llamada sincrona
  while(!done && counter < timeout) {
    deasync.sleep(20);
    counter++;
  }
  return users;
}
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
function updateIfArray(session) {
  const ifNumber = "1.3.6.1.2.1.2.1",
        ifOperStatus = "1.3.6.1.2.1.2.2.1.8",
        ifPhysAddress = "1.3.6.1.2.1.2.2.1.6";
  var numIfsResponse,
      ifStatusResponse,
      macResponse,
      numIfs,
      ifArr = [],
      ifIterator = 0,
      ifStatusRequestOids = [],
      macRequestOids = [];
  numIfsResponse = snmpGet(session, [`${ifNumber}.0`]);
  if(isValidResponse(numIfsResponse)) {
    // Obtener informacion de estado de todos los puertos
    numIfs = numIfsResponse.responses[0].value;
    for(ifIterator = 1; ifIterator <= numIfs; ifIterator++) {
      ifStatusRequestOids.push(`${ifOperStatus}.${ifIterator}`);
      macRequestOids.push(`${ifPhysAddress}.${ifIterator}`);
    }
    ifStatusResponse = snmpGet(session, ifStatusRequestOids);
    macResponse = snmpGet(session, macRequestOids);
    if(isValidResponse(ifStatusResponse) && isValidResponse(macResponse)) {
      // Popular tabla de estados de puertos
      for(ifIterator = 0; ifIterator < numIfs; ifIterator++) {
        ifArr[ifIterator] = {
          status: ifStatusResponse.responses[ifIterator].value,
          mac: macResponse.responses[ifIterator].value.toString('hex')
        }
      }
    } else {
      console.log('err');
    }
  }
  return ifArr;
}
module.exports = {
  initDatabaseConnection: initDatabaseConnection,
  endDatabaseConnection: endDatabaseConnection,
  initSnmpSession: initSnmpSession,
  populateUsersArray: populateUsersArray,
  snmpGet: snmpGet,
  snmpSet: snmpSet,
  isValidResponse: isValidResponse,
  updateIfArray: updateIfArray
}
