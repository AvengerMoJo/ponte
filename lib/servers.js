
var mosca = require("mosca");
var HTTP = require("./http");
var CoAP = require("./coap");
var persistence = require("./persistence");
var ascoltatori = require("ascoltatori");
var bunyan = require("bunyan");
var xtend = require("xtend");

module.exports = [{
  service: "logger",
  factory: function(opts, done) {
    delete opts.ponte;
    done(null, bunyan.createLogger(opts));
  },
  defaults: {
    name: "ponte",
    level: 40
  }
}, {
  service: 'broker',
  factory: function(opts, done) {
    opts.json = false;
    ascoltatori.build(opts, function(ascoltatore) {
      done(null, ascoltatore);
    });
  }
}, {
  service: "persistence",
  factory: persistence,
  defaults: {
    type: "memory"
  }
}, {
  service: "mqtt",
  factory: function(opts, cb) {
    opts.ascoltatore = opts.ponte.broker;
    opts.logger = xtend(opts.logger || {}, {
      childOf: opts.ponte.logger,
      level: opts.ponte.logger.level(),
      service: "MQTT"
    });
    var server = new mosca.Server(opts, cb);
    // example server opts for Auth0 and secure 
    //   mqtt: {
    //     port: 6001,  // tcp but overrided by secure port number following
    //     secure: {
    //       port: 8443,    // override the default and non-secure port setting
    //       keyPath: SECURE_KEY,    // TLS key path
    //       certPath: SECURE_CERT,    // TLS Cert path
    //       authMethod: auth0,    // sample of the auth0 functions from package auth0mosca 
    //     },
    //   }
    if( opts.secure ) {
      if( opts.secure.authMethod.constructor.name === "Auth0Mosca" ) { 
        server.authenticate = opts.secure.authMethod.authenticateWithCredentials();
        server.authorizePublish = opts.secure.authMethod.authorizePublish();
        server.authorizeSubscribe = opts.secure.authMethod.authorizeSubscribe();
    }
    server.on('published', function moscaPonteEvent(packet) {
      opts.ponte.emit('updated', packet.topic, packet.payload);
    });
    opts.ponte.persistence.wire(server);
  }
}, {
  service: "http",
  factory: HTTP,
  defaults: {
    port: 3000,
    serveLibraries: true
  }
}, {
  service: "coap",
  factory: CoAP,
  defaults: {
    port: 5683
  }
}];
