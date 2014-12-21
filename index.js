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

var isNoobMode = false;
var htmlDocument = fs.readFileSync(__dirname + "/index.html").toString();
var scriptDocument = fs.readFileSync(__dirname + "/morsetick.js").toString();
var stringInputLatin = "";
var tickSpawnedProcess;
var audioSpawnedProcess;
var timeoutTickStartDelay;
var timeoutAudioStartDelay;
var bufferSynthPi = new Buffer(0);

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
		data = data.toString();

		var match = data.toString().match(durationRegExp);

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
		var volume = (0.3 < that.volume) ? that.volume - 0.3 : that.volume;
		var params = ["-G","-t","mp3", "-v", volume, "-", "-d", "trim", that.duration];
		audioSpawnedProcess = spawn("sox", params);
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
				if (("keydown" === event) || ("keyup" === event)) {
					var current = m["in history"]("current");

					msg = m["option program name"] + " v" + m["option program version"] + " :D ";

					if (!stringInputLatin) {
						m["clear input"]();
						current = m["in history"]("current");
						isNoobMode = false;
					}
					else if (isNoobMode) {
						current["latin"] = stringInputLatin;
						current["morse"] = m["morse"](stringInputLatin);
						msg += "(noob mode) ";
					}

					msg += JSON.stringify({
						"Latin": current["latin"]
						,"Morse": current["morse"]
					}) + "\n";

					process.stdout.moveCursor(0, -1);
					process.stdout.clearLine();
					process.stdout.write(msg);
				}
				else if ("play link" === event) {
					stringInputLatin = "";
					isNoobMode = false;
				}
			};

			var tickBuffers = {};

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

				if (!tickSpawnedProcess) {
					tickSpawnedProcess = spawn("sox", ["-t", "raw", "-r", "11025", "-b", "8", "-e", "unsigned-integer", "-", "-d"]);
				}

				// http://sox.sourceforge.net/sox.pdf

				var duration = m["duration"]();
				var t = param["timeout"] / 1000;
				var d = duration["dot"] / 1000 - 0.1;

				t = (t && (t < 0.2)) ? 0.2 : t;

				var params = ["-G", "-n", 
					"-t", "raw", "-r", "11025", "-b", "8", "-e", "unsigned-integer", "-",
					"synth", t, "sine", param["frequency"] + "-440", 
					"vol", param["gain"],
					"fade", (t > d) ? d : t
				];
				var paramsAsString = params.join(" ");

				if (!tickBuffers[paramsAsString]) {
					var buf = tickBuffers[paramsAsString] = new Buffer(0);
					var proc = spawn("sox", params);

					proc.stderr
						.on('data', function(data) {
							m["red"]("m[\"tick\"] - ", data.toString());
						});
					proc.stdout
						.on('data', function(data) {
							buf = Buffer.concat([buf, data]);
						})
						.on('end', function() {
							tickBuffers[paramsAsString] = buf;
							m["tick"](param);
						});

					return;
				}
				else if (!tickBuffers[paramsAsString].length) {
					return;
				}

				tickSpawnedProcess.stdin.write(tickBuffers[paramsAsString]);
			}

			keypress(process.stdin);
			process.stdin.setRawMode(true);
			process.stdin.resume();
			process.stdin.on('keypress', function (ch, key) {
				if (key && (key.name == 'escape' || (key.ctrl && key.name == 'c'))) {
					try {
						m["clear input"]();
						m["tick"]();
						m["audio"]();

						if (audioSpawnedProcess) {
							audioSpawnedProcess.kill("SIGHUP"); // "SIGHUP", "SIGSTOP"
						}

						if (tickSpawnedProcess) {
							tickSpawnedProcess.kill("SIGHUP"); // "SIGHUP", "SIGSTOP"
						}

						m["green"]("Bye-bye!");
					}
					catch(e) {}

					process.exit();
				}

				if (key && ("return" === key.name) && isNoobMode && !m["memory is waiting for link play"]) {
					m["search"]();

					return;
				}
				else if (key && ("backspace" === key.name)) {
					stringInputLatin = stringInputLatin.slice(0, -1);
				}
				else if (ch && !isNoobMode && stringInputLatin && (ch !== stringInputLatin.slice(-1))) {
					isNoobMode = true;
					stringInputLatin = stringInputLatin[0] + ch.toLowerCase();
				}
				else if (ch) {
					stringInputLatin += ch.toLowerCase();
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

spawn("sox", ["--version"]).stdout.on('data', function (data) {
	if (!data.toString().match(/SoX/)) {
		console.log(whatRequire);

		process.exit(0);
	}

	startMorsetick();
});
