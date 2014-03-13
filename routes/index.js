

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
				callback(null, "Message sent: Dummy ");
				/*
				transport.sendMail(mailOptions, function(err, response){
					if(err){
						callback(err, null);
					}else{
						newJob.statuses.push( { state: 'Email message sent to user', time: new Date().getTime() } );
						callback(null, "Message sent: " + response.message);
					}
				});
				*/

			},

			// Create a properties file
			function(callback) {

				var section = CONFIG.configSection;
				var configFile = CONFIG.configFileName;


				var config = {};

				if ( req.body.jobType === 'Search') {

					if ( req.body.database === 'MetaCyc' ) {
						config.Metabolite_Database = path.join(__dirname, CONFIG.metacycLocation);
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

						console.dir(err);
						
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
					newJob.statuses.push( { state: 'Job execution started', time: new Date().getTime() } );
				}
			}
			], 
			function(error, results) {
				if (error) {
					res.render('submitted', { error: error, job: newJob});
				} else {
					res.render('submitted', { error: null, job: newJob});
				}
	
	});

};

exports.locate = function(req, res){
  res.render('locate'); 
};

exports.searchdone = function(req, res){

	db.findOne({ id: req.body.id }, function (err, doc) {

		if ( err ) {
			console.log(err + ' : Error registering the job completion');
		} else {
			if ( doc ) {

				doc.statuses.push( { state: 'Search job complete', time: new Date().getTime() } );
			} else {
				console.log(err + ' : Error registering the job completion');
			}
		}
	});

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

exports.viz = function(req, res){

	var vizContentFile = path.join(__dirname, '../public/test/all.json');
	console.log(vizContentFile);

	var vizContent = JSON.parse(fs.readFileSync(vizContentFile));

	console.dir(vizContent);

  res.render('vizOutputIndex', { vizContent: vizContent });

};

exports.vizdetails = function(req, res){
  res.render('vizOutputDetails'); 
};
