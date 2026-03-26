const http = require('http');
const fs = require('fs');
var contentType = require('content-type');
var events = require('events');
var eventEmitter = new events.EventEmitter();
var formidable = require('formidable');


var express = require('express');
const app = express();

app.use(express.static('public'));
var url = require('url');
var path = require('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');


const { createServer } = require('node:http');

const hostname = '127.0.0.1';
const port = 3000;



// const server = http.createServer((req, res) => {
//     res.statusCode = 200;
//     res.setHeader('Content-Type', 'text/html');
//  // res.end('Hello World');
// });
const server = http.createServer(app);

app.get('/', (req,res) => {
    res.render('index');
});

app.set('view engine', 'ejs');

var myEventHandler = function () {
    console.log('Tuko on...');
}




//Assign the event handler to an event:
eventEmitter.on('scream', myEventHandler);

//fire the 'scream' event:
eventEmitter.emit('scream');


server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});