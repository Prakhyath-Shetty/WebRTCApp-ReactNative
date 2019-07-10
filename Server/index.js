var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var connections = [];

function listAllConnections(){
  console.log("Conenctions", connections[0],connections[1]);
}

io.on('connection', function(socket){
    var role = '';
    if(Object.entries(connections).length == 0){
      connections = connections.filter(c => c.role != 'sender')
      connections.push({id: socket.id, role: 'sender'});
      role = 'sender';
    }
    else{
      connections = connections.filter(c => c.role != 'receiver')
      connections.push({id:socket.id, role: 'receiver'});
      role = 'receiver'
    }

    listAllConnections();

    socket.on('offer', function (offer) {
      console.log("offer",offer);
      var sid = connections.filter(c => c.role == 'receiver')
      console.log("sid receiver",sid);
      io.to(sid[0].id).emit('offer', offer);
      console.log("offeremited");
    });

    socket.on('answer', function (answer) {
      console.log("answer",answer);
      var sid = connections.filter(c => c.role == 'sender')
      console.log("sid sender",sid);
      io.to(sid[0].id).emit('answer', answer);
      console.log("answeremited");
    });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});