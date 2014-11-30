var whatRequire = "This program requires installed SoX programs - http://sox.sourceforge.net/";
var option = {};

option["key repeat speed"] = 250;

console.log("Loading...");

var jsdom = require('jsdom');
var request = require('request');
var keypress = require('keypress');

var fs = require('fs');
var spawn = require('child_process').spawn;
var querystring = require('querystring');
var StringDecoder = require('string_decoder').StringDecoder;

var noobMode = false;
var inputString = "";
var htmlDocument = fs.readFileSync(__dirname + "/index.html").toString();
var scriptDocument = fs.readFileSync(__dirname + "/morsetick.js").toString();
var stringUTF8Decoder = new StringDecoder('utf8');
var tickSpawnedProcess;
var audioSpawnedProcess;
var timeoutTickStartDelay;
var timeoutAudioStartDelay;

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
	var dataSrc = "";
	var dataBuffer = new Buffer(0);
	var durationRegExp = new RegExp(/% (\d\d):(\d\d):(\d\d)/);
	var date = new Date();
	var timeoutForNextSong;

	var dataListener = function(data) {
		data = stringUTF8Decoder.write(data);

		var match = data.match(durationRegExp);

		if (match) {
			date.setHours(match[1]);
			date.setMinutes(match[2]);
			date.setSeconds(match[3]);

			that.duration = date.getSeconds();
		}

		clearTimeout(timeoutForNextSong);

		timeoutForNextSong = setTimeout(function() {
			if (that.duration) {
				that.onend();
			}
		}, 5000);
	};

	var createStream = function() {
		var vol = (0.3 < that.volume) ? that.volume - 0.3 : that.volume;

		params = ["-G", "-t", "mp3", "-v", vol, "-", "trim", that.duration];
		audioSpawnedProcess = spawn("play", params);
		audioSpawnedProcess.stderr.on("data", dataListener);

		return audioSpawnedProcess;
	};

	var deleteStream = function() {
		clearTimeout(timeoutForNextSong);

		if (audioSpawnedProcess) {
			audioSpawnedProcess.stderr.removeListener("data", dataListener);
			audioSpawnedProcess.kill("SIGHUP"); // "SIGHUP", "SIGSTOP"
		}

		audioSpawnedProcess = undefined;
	};

	this.src = "";
	this.duration = 0;
	this.paused = true;

	this.onend = function() {
		that.paused = true;
		that.duration = 0;
		deleteStream();
		m["command"]("n");
	};

	this.pause = function() {
		deleteStream();
	};

	this.canPlayType = function() {
		return true;
	};

	this.play = function() {
		deleteStream();
		
		if (dataBuffer.length && dataSrc && (dataSrc === that.src)) {
			createStream();
			audioSpawnedProcess.stdin.write(dataBuffer);
			
			return;
		}

		dataSrc = "";
		dataBuffer = new Buffer(0);
		that.duration = 0;
		createStream();

		similarJQueryAjax({"url": that.src})
			.on("end", function(){
				dataSrc = that.src;
			})
			.on("data", function(data){
				dataBuffer = Buffer.concat([dataBuffer, data]);
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
					msg = m["option program name"] + " v" + m["option program version"] + " :D ";

					if (noobMode && inputString) {
						m["memory current"]["latin"] = inputString;
						m["memory current"]["morse"] = m["morse"](inputString);
						msg += "(noob mode) ";
					}

					msg += JSON.stringify({
						"Latin": m["memory current"]["latin"]
						,"Morse": m["memory current"]["morse"]
					}) + "\n";

					process.stdout.moveCursor(0, -1);
					process.stdout.clearLine();
					process.stdout.write(msg);
				}
				else if ("play link" === event) {
					inputString = "";
					noobMode = false;
				}
			};

			m["tick"] = function(param) {
				param = $.extend({
					"timeout": 0 // in milliseconds
					,"gain": (param && param["timeout"]) ? 0.2 : 0
					,"type": "sine" // 'sine', 'square', 'sawtooth', or 'triangle'.
					,"frequency": 440
				}, param);

				if (tickSpawnedProcess) {
					tickSpawnedProcess.kill("SIGHUP"); // "SIGHUP", "SIGSTOP"
					tickSpawnedProcess = undefined;
				}

				if (!param || !param["timeout"]) {
					return;
				}

				// http://sox.sourceforge.net/sox.pdf
				//["-q", "-n", "-c1", "synth", "sin", "%-12", "sin", "%-9", "sin", "%-5", "sin", "%-2", "fade", "h","1", "1"]);
				// var params = ["-q","-n", "-b", "16", "-r", "1k", "synth", "sin", param["frequency"], "fade", "0", param["timeout"] / 1000, (param["timeout"] ) / 1000, "vol", param["gain"]]; // ?

				var params = ["-G", "-q", "-n", "-r", "2k", "synth", param["timeout"] / 1000, "sine", param["frequency"] + "-440", "vol", param["gain"]]; // ?
				tickSpawnedProcess = spawn("play", params);
			}

			keypress(process.stdin);
			process.stdin.setRawMode(true);
			process.stdin.resume();
			process.stdin.on('keypress', function (ch, key) {
				if (key && (key.name == 'escape' || (key.ctrl && key.name == 'c'))) {
					m["clear input"]();
					m["tick"]();
					m["audio"]();

					if (audioSpawnedProcess) {
						audioSpawnedProcess.kill("SIGHUP"); // "SIGHUP", "SIGSTOP"
					}

					if (tickSpawnedProcess) {
						tickSpawnedProcess.kill("SIGHUP"); // "SIGHUP", "SIGSTOP"
					}

					process.exit();
				}

				if (inputString && (ch !== inputString.slice(-1))) {
					noobMode = true;
				}

				if (key && ("return" === key.name)) {
					if (noobMode && !m["memory is waiting for link play"]) {
						m["search link and play"]();

						return;
					}
				}
				else if (key && ("backspace" === key.name)) {
					inputString = inputString.slice(0, -1)
				}
				else if (ch) {
					inputString += ch;
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

	console.error("BIG ERROR :'Q", error);
});

spawn("play", ["--version"]).stdout.on('data', function (data) {
	if (!data.toString().match(/SoX/)) {
		console.log(whatRequire);

		process.exit(0);
	}

	startMorsetick();
});