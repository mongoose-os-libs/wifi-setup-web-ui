// Copyright (c) 2020 Cesanta Software Limited
// All rights reserved

// Simple JSON-RPC implementation over websocket. Usage example:
//
// var rpc = mkrpc('ws://1.2.3.4:8000/rpc');
// rpc.onopen = rpc.call('MyFunc', {a:1}, 3000).then(resp => console.log(resp));
var mkrpc = function(url) {
  var id = 1, reconn = true, calls = {}, defaultTimeoutMs = 3000, ws;
  var engine = {
    onopen: function() {},   // Called when WS connection is established
    onclose: function() {},  // Called when WS connection is closed
    onin: function() {},     // Called on each incoming frame
    onout: function() {},    // Called on each outgoing frame
    send: function(frame) {  // Send notification to the server
      engine.onout(frame);
      ws.send(JSON.stringify(frame));
    },
    close: function() {  // Close and stop reconnecting
      reconn = false;
      ws.close();
    },
    call: function(method, params, timeoutMilli) {
      return new Promise(function(resolve, reject) {
        var frame = {id: id++, method, params};
        // console.log('Sent:', JSON.stringify(frame));
        calls[frame.id] = resolve;
        engine.onout(frame);
        ws.send(JSON.stringify(frame));
        setTimeout(function() {
          if (calls[frame.id]) {
            reject('RPC call timeout' + JSON.stringify(frame));
            delete calls[frame.id];
          }
        }, timeoutMilli || defaultTimeoutMs);
      });
    },
  };

  var reconnect = function() {
    // console.log('Opening WS connection to', url);
    ws = new WebSocket(url);
    ws.onopen = function(ev) {
      // console.log('Established WS connection to', url);
      engine.onopen();
    };
    ws.onclose = function(ev) {
      // console.log('Closed WS connection to', url);
      engine.onclose();
      if (reconn) setTimeout(reconnect, 1000);
    };
    ws.onerror = function(ev) {
      console.log('WS connection error:', ev);
    };
    ws.onmessage = function(ev) {
      console.log('Rcvd:', ev.data);
      var frame = JSON.parse(ev.data);
      engine.onin(frame);
      if (calls[frame.id]) calls[frame.id](frame);  // Resolve call promise
      delete calls[frame.id];
    };
  };
  reconnect();

  return engine;
};
