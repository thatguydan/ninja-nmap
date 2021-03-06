var TotalCount = require('./lib/totalCount.js')
  , PortCount = require('./lib/portCount.js')
  , util = require('util')
  , stream = require('stream')
  , xml = require('libxml-to-js')
  , fs = require('fs')
  , exec = require('child_process').exec
  , screenshot = require('./screenshot');

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

var DEBUG = false;

function nmap(opts,app) {

  this.app = app;
  app.on('client::up',this.runNmap.bind(this));
};

nmap.prototype.runNmap = function(cb) {

  var MINUTES = 10;

  var command = 'nmap -oX '+__dirname+'/results.xml --open -p 3000,4567,8080,8000,4000,80 10.100.*.*';

  var self = this;

  var endAndParse = function() {

    this.app.log.info('Ending Port Scan');
    child.kill();

    var xmlStr = fs.readFileSync(__dirname+'/results.xml').toString();

    // Ugly hack to just get what nmap has outputted.
    if (xmlStr.indexOf('</nmaprun>')===-1) {
      fs.appendFileSync(__dirname+'/results.xml','</nmaprun>');
      xmlStr += '</nmaprun>';
    }

    this.parseXML(xmlStr);

    var date = new Date();
    fs.createReadStream(__dirname+'/results.xml').pipe(fs.createWriteStream(__dirname+'/results/results-'+date.toString()+'.xml'));

    setTimeout(function() {

      self.app.log.info('Beginning Port Scan');
      child = exec(command);
      setTimeout(endAndParse,MINUTES*60*1000);

    },4*60*1000);

  }.bind(this);

  this.app.log.info('Beginning Port Scan');
  var child = exec(command);
  setTimeout(endAndParse,MINUTES*60*1000);
};

var totalDevice;
nmap.prototype.parseXML = function(xmlStr) {
  var self = this;

  xml(xmlStr,function(err,data) {

    if (err) return;
    if (!data.host) return;

    if (!DEBUG && !totalDevice) {
      totalDevice = new TotalCount();
      this.emit('register', totalDevice);
    }

    totalDevice.emit('data',data.host.length);

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

    screenshot(data);
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