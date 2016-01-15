
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');


var app = express();

app.locals.moment = require('moment');

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.bodyParser());

app.use(express.json({limit: '200mb'}));
app.use(express.urlencoded({limit: '200mb'}));

app.use(express.json({limit: '500mb'}));
app.use(express.urlencoded({limit: '500mb'}));

app.use(express.methodOverride());
app.use(express.cookieParser('midas rocks!'));
app.use(express.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);

app.get('/job', routes.job);
app.post('/job', routes.jobpost);

app.get('/locate', routes.locate);
app.get('/locate/:id', routes.locateWithId);
app.post('/locate', routes.locatepost);

app.get('/results/:id', routes.resultsWithId);
app.get('/resultdetails/:id/:slot', routes.resultDetails);
app.get('/results', routes.resultspost);

app.get('/viz', routes.viz);
app.get('/vizdetails', routes.vizdetails);

app.get('/download', routes.download);

app.post('/done', routes.done);

app.get('/dumpStatus/:id', routes.dumpStatus);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
