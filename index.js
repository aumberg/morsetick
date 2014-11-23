var whatRequire = "This program requires installed SoX programs - http://sox.sourceforge.net/";
var option = {};

option["key repeat speed"] = 250;

console.log("Loading...");

var fs = require('fs');
var spawn = require('child_process').spawn;
var querystring = require('querystring');

var jsdom = require('jsdom');
var request = require('request');
var keypress = require('keypress');
var readline = require('readline');

var htmlDocument = fs.readFileSync(__dirname + "/index.html").toString();
var scriptDocument = fs.readFileSync(__dirname + "/morsetick.js").toString();
var audioSpawnedProcess;
var tickSpawnedProcess;
var timeoutAudioStartDelay;
var timeoutTickStartDelay;

function similarJQueryAjax(param, callback) {
	var paramSend = {
		"url": ""
		,"followRedirect": true
		,"followAllRedirects": true
		,"timeout": undefined
		,"data": undefined
	};

	param = (param || {});
	paramSend["url"] = param["url"];
	paramSend["timeout"] = param["timeout"];

	if (param["data"]) {
		paramSend["url"] += "?" + querystring.stringify(param["data"]);
	}

	var req = request(paramSend, function(error, resp, body) {});

	req.done = req.success = (callback || function(callback) {
		req.done = callback;

		return req;
	});

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
	// maybe use https://www.npmjs.org/package/node-core-audio ?

	var that = this;
	var intervalDuration;

	var createStream = function() {
		params = ["-q", "-t", "mp3", "-v", that.volume, "-", "trim", that.duration];
		audioSpawnedProcess = spawn("play", params);
		audioSpawnedProcess.stdout.on("end", that.onend);

		return audioSpawnedProcess;
	};

	var deleteStream = function() {
		if (audioSpawnedProcess) {
			audioSpawnedProcess.kill(); // "SIGHUP", "SIGSTOP"
		}

		audioSpawnedProcess = undefined;
		intervalDuration = clearInterval(intervalDuration);
	};

	this.src = "";
	this.duration = 0;
	this.paused = true;

	this.onend = function() {
		that.paused = true;
		deleteStream();
		console.log("end?");
		// m["command"]("n");
	};

	this.pause = function() {
		deleteStream();
	};

	this.canPlayType = function() {
		return true;
	};

	this.play = function() {
		deleteStream();

		similarJQueryAjax({"url": that.src})
			.on("data", function(data){
				if (!audioSpawnedProcess) {
					intervalDuration = setInterval(function() {
						that.duration++;
					}, 1000);

					createStream();
				}

				audioSpawnedProcess.stdin.write(data);
			})
			.fail(function(){
				m["red"]("Can't load file");
			});
	};

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
			window.console.log = console.log;
			window.console.error = console.error;

			m["option dot duration"] = option["key repeat speed"] + 10;
			m["option console log"] = true;

			m["event"] = function(event) {
				if ("keyup" === event) {
				}
				else if ("play link" === event) {
				}
			};

			m["tick"] = function(param) {
				param = $.extend({
					"timeout": 0 // in milliseconds
					,"gain": (param ? 0.1 : 0)
					,"type": "sine" // 'sine', 'square', 'sawtooth', or 'triangle'.
					,"frequency": 440
				}, param);

				if (tickSpawnedProcess) {
					tickSpawnedProcess.kill(); // "SIGHUP", "SIGSTOP"
					tickSpawnedProcess = undefined;
				}

				if (!param) {
					return;
				}
				// http://sox.sourceforge.net/sox.pdf
				//["-q", "-n", "-c1", "synth", "sin", "%-12", "sin", "%-9", "sin", "%-5", "sin", "%-2", "fade", "h","1", "1"]);
				var params = ["-q","-n", "synth", "sin", param["frequency"], "fade", "0", param["timeout"] / 1000, (param["timeout"] - 1) / 1000, "vol", param["gain"]]; // ?
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
						audioSpawnedProcess.kill(); // "SIGHUP", "SIGSTOP"
					}

					if (tickSpawnedProcess) {
						tickSpawnedProcess.kill(); // "SIGHUP", "SIGSTOP"
					}

					process.exit();
				}
				
				m["keydown"](true);
			});
		}
	});
};

process.on('uncaughtException', function (error) {
	if ("ECONNRESET" === error.code) { // why ?
		return;
	}

	console.error("BIG ERROR :`(", error);
});

spawn("play", ["--version"]).stdout.on('data', function (data) {
	if (!data.toString().match(/SoX/)) {
		console.log(whatRequire);

		process.exit(0);
	}

	startMorsetick();
});