var TotalCount = require('./lib/totalCount.js')
  , PortCount = require('./lib/portCount.js')
  , util = require('util')
  , stream = require('stream')
  , xml = require('libxml-to-js')
  , fs = require('fs')
  , exec = require('child_process').exec;

// Give our module a stream interface
util.inherits(nmap,stream);

// 1. Run nmap on a loop
// 2. Analyse after nmap has run
// 3. Report Device
//
// Devices:
// 1) Total Server Count G: 0
// 2) Server count per port G: 80/3000/etc
//

var DEBUG = true;

function nmap(opts,app) {
  this.app = app;
  app.on('client::up',this.parseXML.bind(this));


};



nmap.prototype.parseXML = function() {
  var self = this;
  var xmlStr = fs.readFileSync(__dirname+'/results.xml').toString();

  if (xmlStr.indexOf('</nmaprun>')===-1) xmlStr += '</nmaprun>';

  xml(xmlStr,function(err,data) {

    if (err) return;
    if (!data.host) return;

    var totalCount = new TotalCount();
    if (!DEBUG) this.emit('register', totalCount);

    totalCount.emit('data',data.host.length);

    var ports = {};
    // Iterate over all the ports, counting them up
    for (var i=0;i<data.host.length;i++) {

      var portObj = data.host[i].ports.port;

      if (util.isArray(portObj)) {

        for (var j=0;j<portObj.length;j++) {

          var port = portObj[j]['@'].portid
          ports[port] = ports[port] || 0;
          ports[port]++;

        }

      } else {

        var port = portObj['@'].portid;
        ports[port] = ports[port] || 0;
        ports[port]++;

      }
    }

    for (var port in ports) {

      var device = self.fetchPortDevice(port);
      device.emit('data',ports[port]);

    }
  }.bind(this));

};

var devices={};
/**
 * Create and return the port device, and register it
 * if it does not already exist
 * @param  {Number} port The port number
 * @return {Object} instanceof PortCount
 */
nmap.prototype.fetchPortDevice = function(port) {

  if (!devices.hasOwnProperty(port)) {

    var device = new PortCount(port);
    devices[port] = device;
    if (!DEBUG) this.emit('register', device);
  }
  return devices[port];
}

// Export it
module.exports = nmap;