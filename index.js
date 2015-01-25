console.log("(Loading)");

var option = {
	"key repeat speed":  250
	,"tick sample rate": 4096
	,"use VLC player": false //true, false
};

var whatRequire = "This program is require install SoX utility (http://sox.sourceforge.net/) or VLS player (http://www.videolan.org/)";

var lastRequest;

var processForPlayTick;
var processForPlayAudio;

var jsdom = require('jsdom');
var request = require('request');
var keypress = require('keypress');

var fs = require('fs');
var wav = require('wav');
var querystring = require('querystring');
var child_process = require('child_process');

var htmlDocument = fs.readFileSync(__dirname + "/index.html").toString();
var scriptDocument = fs.readFileSync(__dirname + "/morsetick.js").toString();

function similarJQueryAjax(param, callback) {
	param = (param || {});
	param["url"] = (param["url"] || "");
	param["followRedirect"] = param["followRedirect"] ? param["followRedirect"] : true;
	param["followAllRedirects"] = param["followAllRedirects"] ? param["followAllRedirects"] : true;
	param["timeout"];
	param["data"];

	if (param["data"] && ("POST" !== param["type"])) {
		param["url"] += "?" + querystring.stringify(param["data"]);
	}

	var req = request(param, function(error, resp, body) {});

	req.done = req.success = (callback || function(callback) {
		if ("function" === typeof callback) {
			req.done = callback;
		}

		return req;
	});

	req.fail = req.error = function(callback) {
		if ("function" === typeof callback) {
			req.fail = callback;
		}
		
		return req;
	}

	req.always = function(callback) {
		if ("function" === typeof callback) {
			req.always = callback;
		}

		return req;
	}

	req.on("complete", function(encoding, data) {
		req.done(data, encoding, req);
		req.always();
		req.removeAllListeners("complete");
		req.removeAllListeners("error");
	});

	req.on("error", function(error) {
		req.fail(error);
		req.always();
		req.removeAllListeners("complete");
		req.removeAllListeners("error");
	});

	return req;
};

// maybe use https://www.npmjs.org/package/node-core-audio ?
function similarHTML5Audio() {
	var self = this;
	var dataSrc = "";
	var dataBuffer = new Buffer(0);
	var regexpDuration = new RegExp(/% (\d\d):(\d\d):(\d\d)/);
	var timeoutForNextSong;
	var bucket = new Buffer(0);

	var waitForChangeSong = function(intTimeout) {
		// console.log("wait for change song")
		clearTimeout(timeoutForNextSong);
		timeoutForNextSong = setTimeout(function() {
			// console.log("change!")
			self.onend();
		}, (intTimeout || 10000));
	}

	var dataListener = function(data) {
		data = data.toString();

		var match = data.match(regexpDuration);

		if (match) {
			var date = new Date();

			date.setHours(match[1]);
			date.setMinutes(match[2]);
			date.setSeconds(match[3]);

			self.duration = date.getSeconds();
		}
	};
	
	var audioProcess = function(command) {
		if ("start" === command) {
			audioProcess("stop");

			var proc = processController({
				"command": "start audio process"
				,"parameters": {
					"volume": (self.volume * 0.3).toPrecision(2)
					,"start time": self.duration
				}
			});

			proc.stderr.on("data", dataListener);
			proc.stdin.write(dataBuffer);

			return proc;
		}
		else if ("stop" === command) {
			clearTimeout(timeoutForNextSong);

			processController({
				"command": "stop audio process"
			});
		}
	};

	self.src = "";
	self.duration = 0;
	self.paused = true;

	self.onend = function() {
		self.duration = 0;
		self.pause();
		m["command"]("n");
	};

	self.pause = function() {
		self.paused = true;
		audioProcess("stop");
	};

	self.canPlayType = function() {
		return true;
	};

	self.play = function() {
		audioProcess("stop");

		if (dataBuffer.length && dataSrc && (dataSrc === self.src)) {
			audioProcess("start");
			
			return;
		}

		dataSrc = "";
		dataBuffer = new Buffer(0);
		self.duration = 0;

		var proc = audioProcess("start");



		lastRequest = similarJQueryAjax({"url": self.src, "timeout": 15000})
			.on("end", function(){
				// console.log("end")
				clearTimeout(timeoutForNextSong);
				proc.stdin.on("drain", waitForChangeSong);
				proc.stdin.write(bucket);
				dataSrc = self.src;
				dataBuffer = Buffer.concat([dataBuffer, bucket]);
				bucket = new Buffer(0);
			})
			.on("data", function(data){
				// console.log("data!")
				bucket = Buffer.concat([bucket, data])

				if (proc && bucket.length > 100500) {
					proc.stdin.write(bucket);
					dataBuffer = Buffer.concat([dataBuffer, bucket]);
					bucket = new Buffer(0);
				}

				waitForChangeSong(20000);
			})
			.fail(function(e, e2){
				m["red"]("Can't load file");
				audioProcess("stop");

				timeoutForNextSong = setTimeout(self.onend, 5000);
			});
	};

	return self;
};

// http://js.do/blog/sound-waves-with-javascript/
// https://github.com/oampo/Audiolet/blob/master/src/audiolet/Audiolet.js#L2831
// https://github.com/substack/baudio/blob/master/index.js#L33
function generateSineDataRAW(param) {
	var result = [];
	var param = (param || {});
	var phase = (param["phase"] || 0);
	var gain = (param["gain"] || 0);
	var bitRate = (param["bit rate"] || 16);
	var frequency = (param["frequency"] || 440);
	var sampleRate = (param["sample rate"] || 44100);
	var timeout = (0 < param["timeout"]) ? param["timeout"] / 1000 : 0; // translate to seconds
	var averageBytePerSecond = sampleRate * bitRate / 8; //+3048; // http://www.sonicspot.com/guide/wavefiles.html

	// console.log("ok " + phase)

	var tt = Math.round(timeout * averageBytePerSecond);

	tt = tt % 2 ? tt + 1 : tt

	var bufferAudioData = new Buffer(tt);

	// console.log(sampleRate, timeout, timeout * averageBytePerSecond, tt, averageBytePerSecond)

	for (var i = 0; i < bufferAudioData.length; i += 2) {
		var integer = Math.round((Math.pow(2, 15) * Math.sin(phase) * gain) - 1);

		bufferAudioData.writeInt16LE(integer, i);
		phase += 2 * Math.PI * frequency / sampleRate;
		phase %= 2 * Math.PI;
		// console.log(i, phase)
	}

	return {
		"buffer": bufferAudioData
		,"phase": phase
	}
};

function processController(param) {
	param = (param || {});
	param["command"] = (param["command"] || {});
	param["parameters"] = (param["parameters"] || {});
	param["callback"] = (param["callback"] || function() {});
	param["data"];

	if ("stop all processes" === param["command"]) { 
		processController({"command": "stop audio process"});
		processController({"command": "stop tick process"});
	}
	else if ("stop audio process" === param["command"]) {
		if (lastRequest) {
			lastRequest.abort();
			lastRequest = undefined;
		}

		if (processForPlayAudio) {
			processForPlayAudio.kill("SIGHUP"); // "SIGHUP", "SIGSTOP"
			processForPlayAudio = undefined;
		}
	}
	else if ("stop tick process" === param["command"]) {
		processController({"command": "stop tick"});

		if (processForPlayTick) {
			processForPlayTick.kill("SIGHUP"); // "SIGHUP", "SIGSTOP"
			processForPlayTick = undefined;
		}
	}
	else if ("start audio process" === param["command"]) {
		if (!processForPlayAudio) {
			if (option["use VLC player"]) {
				var params = "-I dummy - -vv"; //--volume=1024 * parseFloat(param["parameters"]["volume"])

				processForPlayAudio = child_process.spawn("vlc", params.split(" "));
			}
			else {
				var params = "-G -t mp3 -v " + param["parameters"]["volume"] + " - -d trim " + param["parameters"]["start time"];

				processForPlayAudio = child_process.spawn("sox", params.split(" "));
			}
		}

		processForPlayTick.stdin.on("error", function(e) {
			console.log(e);
		});

		return processForPlayAudio;
	}
	else if ("start tick process" === param["command"]) {
		if (!processForPlayTick) {
			if (option["use VLC player"]) {
	 			var params = "-I dummy - --quiet";

				processForPlayTick = child_process.spawn("vlc", params.split(" "));
			}
			else {
	 			// sox -G --buffer 256 -c 1  -r 11025 -b 8 -n -d  synth 0.2 sine 1000
	 			// processForPlayTick = child_process.spawn("sox", ["-t", "raw", "-r", "44100", "-b", "16", "-e", "unsigned-integer", "-", "-d"]);
	 			var params = "--buffer 256 -c 1 -t s16 -b 16 -r " + option["tick sample rate"] + " - -d -q";

				processForPlayTick = child_process.spawn("sox", params.split(" "));
			}	

			processForPlayTick.stdin.on("error", function(e) {
				console.log(e);
			});

			processForPlayTick.streamWav = new wav.Writer({
				"channels": 1
				,"sampleRate": option["tick sample rate"]
				,"bitDepth": 16
			});

			processForPlayTick.streamWav.pipe(processForPlayTick.stdin);
		}

		return processForPlayTick;
	}
	else if ("find audio player" === param["command"]) { 
		child_process.spawn("sox", ["--version"]).stdout.on('data', function (data) {
			if (data.toString().match(/SoX/) && (true !== option["use VLC player"])) {
				option["use VLC player"] = false;
				param["callback"]();

				return;
			}

			console.log("(Haven't SoX utility, trying use VLC player)");

			child_process.spawn("vlc", ["--version"]).stdout.on('data', function (data) {
				if (data.toString().match(/VLC/)) {
					option["use VLC player"] = true;
					param["callback"]();

					return;
				}

				console.log(whatRequire);
				process.exit(0);
			});
		});
	}
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
			window.console.error = console.error;
			window.console.log = function() {
				process.stdout.cursorTo(0, 0);
				process.stdout.clearScreenDown();

				console.log.apply(console, arguments);
			}

			m["option duration"]["dot"] = option["key repeat speed"] + 10;
			m["option console log"] = true;

			m["external event listener"] = function(eventName) {
				if ("link play" === eventName) {
					try {
						var jsonLinks = fs.readFileSync(__dirname + "/links.json").toString();
						var oldLinks = JSON.parse(jsonLinks);
						var newLink = m["links"]().slice(-1);
						var data = oldLinks.slice(-m["option links limit"] + 1).concat(newLink);

						fs.writeFile(__dirname + "/links.json", JSON.stringify(data).replace(/},{/g, "},\n{"));
					}
					catch (e) {
						m["red"]("Can't open file links.json")
					}
				}
			};

			m["tick"] = function(param) {
				m["tick"]["param"] = $.extend({
					"timeout": 0 // in milliseconds
					,"gain": (param && param["timeout"]) ? 0.05 : 0
					,"type": "sine" // 'sine', 'square', 'sawtooth', or 'triangle'.
					,"frequency": 440
				}, param);

				var repeatTime = 64;
				var nextSendTime = (new Date()).getTime();
				var proc = processController({"command": "start tick process"});

				clearTimeout(m["tick"]["timeout"]);
				clearTimeout(m["tick"]["delay"]);

				m["tick"]["loop data send"] = function() {
					clearTimeout(m["tick"]["timeout"]);
					
					if (-5000 > m["tick"]["param"]["timeout"]) {
						return;
					}
					else if (0 > m["tick"]["param"]["timeout"]) {
						m["tick"]["param"]["gain"] = 0;
						repeatTime = 172;
					}

					var audio = generateSineDataRAW({
						"gain": m["tick"]["param"]["gain"]
						,"sample rate": option["tick sample rate"]
						,"timeout": repeatTime
						,"frequency": m["tick"]["param"]["frequency"]
						,"phase": m["tick"]["phase"]
					});

					m["tick"]["phase"] = audio["phase"];
					m["tick"]["param"]["timeout"] -= repeatTime;
					proc.streamWav.write(audio["buffer"]);
					m["tick"]["timeout"] = setTimeout(m["tick"]["loop data send"], repeatTime);
				}

				m["tick"]["delay"] = setTimeout(function() {
					m["tick"]["phase"] = 0;
					repeatTime = 128;
					m["tick"]["loop data send"]();
					repeatTime = 64;
					m["tick"]["loop data send"]();
				}, 172);
			};
		
			keypress(process.stdin);
			process.stdin.setRawMode(true);
			process.stdin.resume();
			process.stdin.on('keypress', function (ch, key) {
				if (key && (key.name == 'escape' || (key.ctrl && key.name == 'c'))) {
					try {
						m["green"]("Bye-bye!");
						m["off"]();

						processController({
							"command": "stop all processes"
						})
					}
					catch(e) {}

					process.exit();
				}

				var event = $.Event("keydown.morsetick");

				event.isHaveOnlyKeydownEvent = true;

				if (key) {
					event.ctrlKey = key.ctrl;
					event.metaKey = key.meta;
					event.shiftKey = key.shift;
				}

				if (key && ("return" === key.name)) {
					event.which = 13;
				}
				else if (key && ("backspace" === key.name)) {
					event.which = 8;
				}
				else if (ch && (1 === ch.length)) {
					event.character = ch.toLowerCase();
				}
				else {
					return;
				}

				$("body").trigger(event);
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

processController({
	"command": "find audio player"
	,"callback": startMorsetick
});