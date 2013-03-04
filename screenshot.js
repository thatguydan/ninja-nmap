var exec = require('child_process').exec
  , fs = require('fs')
  , util = require('util')
  , xml = require('libxml-to-js')
  , mkdirp = require('mkdirp')
  , async = require('async');

module.exports = function(data) {

  console.log('screening %s hosts',data.length)

  var TOOL = __dirname+'/bin/CutyCapt';

  var out = {};
  var date = (new Date()).toString();
  var q = async.queue(function (task, callback) {

    var url = util.format('--url=http://%s:%s',task.host,task.port);

    var dir = util.format('%s/screenshots/%s:%s'
      ,__dirname,task.host,task.port);

    var file = dir + '/' + date + '.png';

    console.log(file);

    mkdirp(dir,function() {
      exec([
        TOOL,url
        ,'--min-width=1024','--min-height=1024','--max-wait=2000'
        ,'--out=\''+file+'\''].join(' '),function() {
          console.log(arguments);
        callback();
      });
    });
  }, 5);

  q.drain=function() {
    console.log("ALL DONE BUDDY");
  }


  for (var i=0;i<data.host.length;i++) {

    var ip = data.host[i].address['@'].addr;

    var portObj = data.host[i].ports.port;
    var ports=[];

    if (util.isArray(portObj)) {
      for (var j=0;j<portObj.length;j++) {

        q.push({host:ip,port:portObj[j]['@'].portid},function(err) {

          console.log(err);
        });
      }
    } else {

      q.push({host:ip,port:portObj['@'].portid},function(err) {

        console.log(err);
      });
    }
  }
}
