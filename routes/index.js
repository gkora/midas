

/*
 * GET home page.
 */

var CONFIG = require('config').System;
var uuid 	 = require('node-uuid');
var _ 		 = require('lodash');
var async  = require('async');
var mkdir  = require('mkdirp');
var path	 = require('path');
var mail 	 = require('nodemailer');
var fs 	 	 = require('fs-extra');
var ini 	 = require('ini');

var MidasWorker = require('midasWorker');


var Datastore = require('nedb')
  , db = new Datastore({ filename: path.join(__dirname, '../', CONFIG.Database.location), autoload: true });

var transport = mail.createTransport("SMTP", {
	host: CONFIG.SMTP.server,
	secureConnection: false,
	name: CONFIG.SMTP.name
});

exports.index = function(req, res){
  res.render('index');
};

exports.job = function(req, res){
  res.render('job');
};

exports.jobpost = function(req, res) {


	var newJob = {};

	newJob.id = uuid.v4();
	newJob.submitTime = new Date().getTime();
	newJob.jobDirectory = path.join(CONFIG.userDataLocation, newJob.id);

	newJob.statuses = [];
	newJob.statuses.push( { state: 'Online Request Submitted', time: new Date().getTime() } );
	_.extend(newJob, req.body);

	var fileDetails = _.clone(req.files);
	fileDetails.inputFile = _.omit(fileDetails.inputFile, 'ws');
	_.extend(newJob, fileDetails);

	newJob.request = {};
	newJob.request.UA = req.get('User-Agent');
	newJob.request.IP = req.ip;


	async.series([
			// Make directory for the job
			function(callback) {
				mkdir(newJob.jobDirectory, function (err) {

					if (err) {
						console.dir(err);
						callback(err, null);
					} else {
						newJob.statuses.push( { state: 'Job Directory Created', time: new Date().getTime() } );
						callback(null, 'Directory Created');
					}
				});

			},
			
			// Move input file into the directory.
			function(callback) {

				if ( newJob.inputFile.originalFilename !== '' ) {
					var copyDatabaseFile = fs.copySync(newJob.inputFile.path, path.join(newJob.jobDirectory, newJob.inputFile.name));
					newJob.statuses.push( { state: 'Copied search input file into job directory', time: new Date().getTime() } );
				}

				if ( newJob.databaseInputFile.originalFilename !== '' ) {
					var copyDatabaseFile = fs.copySync(newJob.databaseInputFile.path, path.join(newJob.jobDirectory, newJob.databaseInputFile.name));
					newJob.statuses.push( { state: 'Copied database file into job directory', time: new Date().getTime() } );
				}

				if ( newJob.filterInputFile.originalFilename !== '' ) {
					var copyDatabaseFile = fs.copySync(newJob.filterInputFile.path, path.join(newJob.jobDirectory, newJob.filterInputFile.name));
					newJob.statuses.push( { state: 'Copied filter input file into job directory', time: new Date().getTime() } );
				}

				if ( newJob.vizInputFile.originalFilename !== '' ) {
					var copyDatabaseFile = fs.copySync(newJob.vizInputFile.path, path.join(newJob.jobDirectory, newJob.vizInputFile.name));
					newJob.statuses.push( { state: 'Copied viz input file into job directory', time: new Date().getTime() } );
				}

				// Take it out whe you enable copying 
				callback(null, 'Copied files into job directory');

				/*
				fs.copy(newJob.inputFile.path, path.join(newJob.jobDirectory, newJob.inputFile.name), function (err) {
					if (err) {
						callback(err, null);
					} else {
						newJob.statuses.push( { state: 'Copied input file into job directory', time: new Date().getTime() } );
						callback(null, 'Copied input file into job directory');
					}
				});
				*/
			},
			
			// Send email to the user
			function(callback) {

				
				var body = _.template(CONFIG.SMTP.jobReceiveTemplate.content, { 'name': newJob.name, 'id': newJob.id});
				var mailOptions = {
					from: CONFIG.SMTP.from,
					to: newJob.email,
					subject: CONFIG.SMTP.jobReceiveTemplate.subject,
					/*text: ""*/
					html: body
				}
				// Take it out later'
				//callback(null, "Message sent: Dummy ");
				transport.sendMail(mailOptions, function(err, response){
					if(err){
						callback(err, null);
					}else{
						newJob.statuses.push( { state: 'Email message sent to user', time: new Date().getTime() } );
						callback(null, "Message sent: " + response.message);
					}
				});

			},

			// Create a properties file
			function(callback) {

				var section = CONFIG.configSection;
				var configFile = CONFIG.configFileName;


				var config = {};

				if ( req.body.jobType === 'Search') {

					if ( req.body.database === 'MetaCyc' ) {
						config.Metabolite_Database = path.join(__dirname, '../', CONFIG.metacycLocation);
					} else {
						config.Metabolite_Database = path.join(newJob.jobDirectory, req.files.databaseInputFile.originalFilename );
					}

					config.Default_Polarity = req.body.polarity;
					config.Default_Charge_State = req.body.chargeState;
					config.Parent_Mass_Windows = req.body.massWindow;
					config.Positive_Ion_Fragment_Mass_Windows = req.body.positiveMass.toString();
					config.Negative_Ion_Fragment_Mass_Windows = req.body.negativeMass.toString();
					config.Mass_Tolerance_Parent_Ion = req.body.parentIon;
					config.Mass_Tolerance_Fragment_Ions = req.body.fragmentIon;
					config.Break_rings = req.body.breakRings;
					config.Fragmentation_Depth = req.body.fragmentationDepth
					config.Number_of_Processes = req.body.procs;

					fs.writeFile(
							path.join(newJob.jobDirectory, configFile ), 
							ini.stringify(config, section), 
							function(err) {

						
						if (err) {
							callback(err, null);
						} else {
							newJob.statuses.push( { state: 'Job configuration file created', time: new Date().getTime() } );
							callback(null, 'Job configuration file created');
						}
					});

				} else {
					callback(null, 'Job configuration file not required');
				}

			},

			// Save the data to the db
			function(callback) {

				newJob.statuses.push( { state: 'Job execution started', time: new Date().getTime() } );

				db.insert(newJob, function (err, newJob) {
					if(err){
						callback(err, null);
					}else{
						callback(null, 'New job saved to the DB');
					}
				});
			},

			// Execute the job.
			function(callback) {

				if ( req.body.jobType === 'Search' ) {

					var search = new MidasWorker();

					var jobDetails = {
						jobDirectory : newJob.jobDirectory
						, jobId : newJob.id
						, inputFileName : newJob.inputFile.name
					};

					search.prepSearch(jobDetails, function(err, result) {
						if( err ) {
							console.log('Error while performing search prep.');
							callback('Error while performing search prep.');
						} else {
							search.execSearch(function(error, result2) {
								if (error) {
									console.log('Error executing search job');
									callback('Error executing search job');
								} else {


									// TODO:
									//result2 is pid of the job, add it back to newJob and save it.
									//
									callback(null, 'New submitted for execution');
								}
							});
						}

					});

					// Execute the search job
				} else if ( req.body.jobType === 'Filter' ) {
					// Execute the filter job

					var filter = new MidasWorker();

					var jobDetails = {
						jobDirectory : newJob.jobDirectory
						, jobId : newJob.id
						, outputFileName : newJob.filterInputFile.name + '.output'
						, scoreThreshold : req.body.scoreThre
						, spectralCountThreshold : req.body.spectralCountThre
						, explainPeaksThreshold : req.body.explainPeakThre
						, deltaThreshold : req.body.deltaThre
					};

					filter.prepFilter(jobDetails, function(err, result) {
						if( err ) {
							console.log('Error while performing filter prep.');
							callback('Error while performing filter prep.');
						} else {
							filter.execFilter(function(error, result2) {
								if (error) {
									console.log('Error executing filter job');
									callback('Error executing filter job');
								} else {


									// TODO:
									//result2 is pid of the job, add it back to newJob and save it.
									//
									callback(null, 'New submitted for execution');
								}
							});
						}
					});


				} else if ( req.body.jobType === 'Visualize' ) {

					// Execute the visualize job
					var visualize = new MidasWorker();

					var jobDetails = {
						jobDirectory : newJob.jobDirectory
						, jobId : newJob.id
						, inputFileName : newJob.vizInputFile.name
					};

					visualize.prepViz(jobDetails, function(err, result) {
						if( err ) {
							console.log('Error while performing visualize prep.');
							callback('Error while performing visualize prep.');
						} else {
							visualize.execViz(function(error, result2) {
								if (error) {
									console.log('Error executing visualize job');
									callback('Error executing visualize job');
								} else {


									// TODO:
									//result2 is pid of the job, add it back to newJob and save it.
									//
									callback(null, 'New submitted for execution');
								}
							});
						}
					});





				} else if ( req.body.jobType === 'SearchFilter' ) {
					// Execute the searchFilter job
				} else if ( req.body.jobType === 'FilterVisualize' ) {
					// Execute the filterVisualize job
				} else if ( req.body.jobType === 'SearchFilterVisualize' ) {
					// Execute the searchFilterVisualize job
				}
			}
			], 
			function(error, results) {
				if (error) {
					console.log('Error occured');
					console.dir(error);
					res.render('submitted', { error: error, job: newJob});
				} else {
					console.log('No Error');
					console.dir(results);
					res.render('submitted', { error: null, job: newJob});
				}
	
	});

};

exports.locate = function(req, res){
  res.render('locate'); 
};

exports.dumpStatus = function(req, res){

	db.findOne({ id: req.params.id }, function (err, doc) {
		if ( err ) {
			console.log(err + ' : Error retriving the job');
			res.send(503);
		} else {
			console.dir(doc);
			res.send(doc);
		}
	});

};
exports.done = function(req, res){

	var state = { state: 'Job complete', time: new Date().getTime() };
	db.update({ id: req.body.id }, { $push: { statuses: state } }, {}, function (error, numUpdated) {
		if (error) {
			console.log(err + ' : Error registering the job completion');
			res.send(503);
		} else {
			console.log('Number of updated rows = ' + numUpdated );
			res.send(200);
		}
	});


	/*
	db.findOne({ id: req.body.id }, function (err, doc) {

		if ( err ) {
			console.log(err + ' : Error registering the job completion');
			res.send(503);
		} else {
			if ( doc ) {
				doc.statuses.push( { state: 'Job complete', time: new Date().getTime() } );
				doc.save(function( error, result) {
					if (error) {
						res.send(503);
					} else {
						res.send(200);
					}
				});
			} else {
				console.log(err + ' : Error registering the job completion');
				res.send(503);
			}
		}
	});
	*/

};

exports.locatepost = function(req, res){

	db.findOne({ id: req.body.id }, function (err, doc) {

		if ( err ) {
			console.log(err);
			res.render('locateStatus', {id: null, job: null}); 
		} else {
			if ( doc ) {
			res.render('locateStatus', {id: req.body.id, job: doc}); 
			} else {
				res.render('locateStatus', {id: null, job: null}); 
			}
		}
	});

};

exports.locateWithId = function(req, res){
	
	db.findOne({ id: req.params.id }, function (err, doc) {
		if ( err ) {
			console.log(err);
			res.render('locateStatus', {id: null, job: null}); 
		} else {
			if ( doc ) {
			res.render('locateStatus', {id: req.params.id, job: doc}); 
			} else {
				res.render('locateStatus', {id: null, job: null}); 
			}
		}
	});
};

exports.resultDetails = function(req, res){
	
	db.findOne({ id: req.params.id }, function (err, doc) {
		if ( err ) {
			console.log(err);
			res.render('results', {id: null, job: null}); 
		} else {
			if ( doc ) {

				if ( doc.jobType === 'Visualize' ) { 
					
					var vizInputData = path.join( doc.jobDirectory, 'all.json');

					var vizContentFile = vizInputData;

					console.log(vizContentFile);

					var vizContent = JSON.parse(fs.readFileSync(vizContentFile));

					console.dir(vizContent);

					res.render('vizOutputDetails', 
							{ id: doc.id, 
								slot: req.params.slot, 
								vizContent: vizContent, 
								jobDirectory: '/userData/' + doc.id + '/' 
							});

				} else {
					var files = fs.readdirSync(doc.jobDirectory);
					res.render('results', {id: req.params.id, job: doc, files: files}); 
				}
			} else {
				res.render('results', {id: null, job: null}); 
			}
		}
	});
};

exports.resultsWithId = function(req, res){
	
	db.findOne({ id: req.params.id }, function (err, doc) {
		if ( err ) {
			console.log(err);
			res.render('results', {id: null, job: null}); 
		} else {
			if ( doc ) {

				if ( doc.jobType === 'Visualize' ) { 
					
					var vizInputData = path.join( doc.jobDirectory, 'all.json');

					var vizContentFile = vizInputData;

					console.log(vizContentFile);

					var test1 = fs.readFileSync(vizContentFile);
					console.log(test1);

					//var vizContent = JSON.parse(fs.readFileSync(vizContentFile));
					var vizContent = JSON.parse(test1);

					console.dir(vizContent);

					res.render('vizOutputIndex', 
							{ id: doc.id, vizContent: vizContent, jobDirectory: '/userData/' + doc.id + '/' });

				} else {
					var files = fs.readdirSync(doc.jobDirectory);
					res.render('results', {id: req.params.id, job: doc, files: files}); 
				}
			} else {
				res.render('results', {id: null, job: null}); 
			}
		}
	});
};

exports.resultspost = function(req, res){
	
	db.findOne({ id: req.body.id }, function (err, doc) {
		if ( err ) {
			console.log(err);
			res.render('results', {id: null, job: null}); 
		} else {
			if ( doc ) {
				console.dir(doc);
				var files = fs.readdirSync(doc.jobDirectory);
				res.render('results', {id: req.body.id, job: doc, files: files}); 
			} else {
				res.render('results', {id: null, job: null}); 
			}
		}
	});
};

exports.viz = function(req, res){

	var vizContentFile = path.join(__dirname, '../public/test/all.json');
	console.log(vizContentFile);

	var vizContent = JSON.parse(fs.readFileSync(vizContentFile));

	console.dir(vizContent);

  res.render('vizOutputIndex', { vizContent: vizContent });

};

exports.vizdetails = function(req, res){

	var vizContentFile = path.join(__dirname, '../public/test/all.json');

	var vizContent = JSON.parse(fs.readFileSync(vizContentFile));

  res.render('vizOutputDetails', { vizContent: vizContent });

};

exports.download = function(req, res){
  res.render('download'); 
};

