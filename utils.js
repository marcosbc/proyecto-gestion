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
    deasync.sleep(10);
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
      timeout = 50,
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
    deasync.sleep(10);
    counter++;
  }
  return users;
}
function initSnmpSession(cfg) {
  return snmp.createSession(cfg.snmp.host, cfg.snmp.community);
}
function snmpGet(session, oid) {
  var response = {
    error: false,
    msg: '',
    oid: '',
    value: ''
  }
  var done = false,
      timeout = 50,
      counter = 0;
  session.get([oid], function(error, varbinds) {
    if (error) {
      response.error = true;
      response.msg = error.message;
    } else {
      for (var i = 0; i < varbinds.length; i++) {
        if(snmp.isVarbindError(varbinds[i])) {
          // Para SNMP v2c es necesario comprobar si hubo error en el OID
          response.error = true;
          response.msg = snmp.varbindError(varbinds[i]);
        } else {
          response.oid = varbinds[i].oid;
          response.value = `${varbinds[i].value}`;
          response.msg = `${response.oid} = ${response.value}`;
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
  return response;
}
function snmpSet(session, varbind) {
  var response = {
    error: false,
    msg: '',
    oid: '',
    value: ''
  }
  var done = false,
      timeout = 50,
      counter = 0;
  session.set([varbind], function(error, varbinds) {
    if (error) {
      response.error = true;
      response.msg = error.message;
    } else {
      for (var i = 0; i < varbinds.length; i++) {
        if(snmp.isVarbindError(varbinds[i])) {
          // Para SNMP v2c es necesario comprobar si hubo error en el OID
          response.error = true;
          response.msg = snmp.varbindError(varbinds[i]);
        } else {
          response.oid = varbinds[i].oid;
          response.value = `${varbinds[i].value}`;
          response.msg = `${response.oid} = ${response.value}`;
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
  return response;
}
module.exports = {
  initDatabaseConnection: initDatabaseConnection,
  endDatabaseConnection: endDatabaseConnection,
  initSnmpSession: initSnmpSession,
  populateUsersArray: populateUsersArray,
  snmpGet: snmpGet,
  snmpSet: snmpSet,
}
