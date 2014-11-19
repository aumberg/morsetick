var whatRequire = "That program require installed SoX programs - http://sox.sourceforge.net/";

var jsdom  = require('jsdom');
var fs = require('fs');
var keypress = require('keypress');
var querystring = require('querystring');
var readline = require('readline');
var request = require('request');
var spawn  = require('child_process').spawn;
var extend = require('util')._extend;
var Duplex = require('stream').Duplex;
var htmlDocument = fs.readFileSync("./index.html").toString();
var scriptDocument = fs.readFileSync("./morsetick.js").toString();
var audioSpawnedProcess;
var tickSpawnedProcess;
var option = {};

option["key repeat speed"] = 250;

function similarJQueryAjax(param, callback) {
	var param = extend({
		"url": ""
		,"followRedirect": true
		,"followAllRedirects": true
		,"timeout": undefined
		,"data": undefined
	}, param);

	if (param["data"]) {	
		param["url"] += "?" + querystring.stringify(param["data"]);
	}

	var req = request(param, function(error, resp, body) {});

	req.done = req.success = function(callback) {
		req.done = callback;

		return req;
	};

	req.fail = req.error = function(callback) {
		req.fail = callback;
		
		return req;
	}

	req.always = function(callback) {
		req.always = callback;
		
		return req;
	}

	req.on("complete", function(encoding, data) {
		req.done(data, encoding, req);
		req.always();
	});
	req.on("error", function(error) {
		req.fail(error);
		req.always();
	});

	return req;
};

function similarHTML5Audio() {
	var that = this;

	var createStream = function() {
		if (audioSpawnedProcess) {
			audioSpawnedProcess.kill("SIGSTOP");
		}
		
		params = ["-q", "-t", "mp3", "-"];
		audioSpawnedProcess = spawn("play", params);
		audioSpawnedProcess.stdout.on("end", that.onend);

		return audioSpawnedProcess;
	}

	this.src = "";

	this.onend = function() {
		console.log("end?");
		// m["command"]("n");
	}

	this.pause = function() {
		if (audioSpawnedProcess) {
			audioSpawnedProcess.kill("SIGSTOP");
		}
	}

	this.canPlayType = function() {
		return true;
	}

	this.play = function() {
		var stream = createStream();
		similarJQueryAjax({"url": that.src})
			.on("data", function(data){
				stream.stdin.write(data);
			})
			.fail(function(){
				m["red"]("Can't load file!!!!!");
			});
	}

	return this;
};

function startMorsetick() {
	jsdom.env({
		html: htmlDocument,
		src: [
			scriptDocument
		],
		done: function(errors, window) {
			m = window.morsetick;
			$ = m.$;

			window.morsetick.$.ajax = similarJQueryAjax;
			window.Audio = similarHTML5Audio;
			window.console.log = window.console.error = console.log

			m["option dot duration"] = option["key repeat speed"] + 50;
			m["option console log"] = true;

			m["event"] = function(event) {
				if ("keyup" === event) {
					// m["red"]("?", m["in history"]("current")["links"].length, m["in history"]("last")["source"]);
				}
				else if ("play link" === event) {
					// m["green"]("\"" + m["morse"](m["in history"]("current")["morse"]) + "\"  ", m["in history"]("current")["morse"]);
				}
			};

			m["tick"] = function(param) {
				if (tickSpawnedProcess) {
					tickSpawnedProcess.kill("SIGSTOP"); //"SIGHUP"
				}

				if (!param) {
					return;
				}
				// http://sox.sourceforge.net/sox.pdf
				//["-q", "-n", "-c1", "synth", "sin", "%-12", "sin", "%-9", "sin", "%-5", "sin", "%-2", "fade", "h","1", "1"]);
				var params = ["-q", "-n", "-c1", "synth", "sin", "%-12", "sin", "%-9", "sin", "%-5", "sin", "%-2", "fade", "h","1", "1"]; // ?
				tickSpawnedProcess = spawn("play", params);
			}

			// readline
			// 	.createInterface({
			// 		input: process.stdin,
			// 		output: process.stdout
			// 	})
			// 	.on("line", function(){m["keydown"](true)});

			keypress(process.stdin);
			process.stdin.setRawMode(true);
			process.stdin.resume();
			process.stdin.on('keypress', function (ch, key) {
				if (key && (key.name == 'escape' || (key.ctrl && key.name == 'c'))) {
					m["clear input"]();
					m["tick"]();
					m["audio"]();

					if (audioSpawnedProcess) {
						audioSpawnedProcess.kill("SIGSTOP");
					}

					if (tickSpawnedProcess) {
						tickSpawnedProcess.kill("SIGSTOP");
					}

					process.exit();
				}
				
				m["keydown"](true);
			});
		}
	});
};

spawn("play", ["--version"]).stdout.on('data', function (data) {
	if (!data.toString().match(/SoX/)) {
		console.log(whatRequire);

		process.exit(0);
	}

	startMorsetick();
});