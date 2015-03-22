console.log = console.error; // write to stderr
console.log("(Loading MorseTick)");

var option = {
	"key repeat speed":  250
	,"audio stdout format": "pcm" // "pcm", "wav", "mp3"
	,"audio sample rate": 44100
	,"audio bit depth": 16
	,"audio channels": 2 //1 - mono, 2 - stereo
};

var jsdom = require('jsdom');
var request = require('request');
var keypress = require('keypress');

var fs = require('fs');
var wav = require('wav');
var lame = require('lame');
var querystring = require('querystring');
var child_process = require('child_process');

var lastRequest;
var htmlDocument = fs.readFileSync(__dirname + "/index.html").toString();
var scriptDocument = fs.readFileSync(__dirname + "/morsetick.js").toString();

var audio2stdout = new (function() {
	var self = this;

	self.mp3Decoder = new lame.Decoder();
	self.data = new Buffer(0);
	self.dataMass = [];
	self.onPlay = function() {};
	self.volume = 1;
	self.repeatTime = 50;
	self.outputStream = process.stdout;

	if (!option["audio stdout format"]) {
		var Speaker = require('speaker');

		self.outputStream = new Speaker({
			"channels": option["audio channels"]          // 1 channel
			,"bitDepth": option["audio bit depth"]         // 32-bit samples
			,"sampleRate": option["audio sample rate"]     // 48,000 Hz sample rate
			,"signed": true
		});
	}
	else if ("wav" === option["audio stdout format"]) {
		self.outputStream = new wav.Writer({
			"channels": option["audio channels"]
			,"sampleRate": option["audio sample rate"]
			,"bitDepth": option["audio bit depth"]
		});

		self.outputStream.pipe(process.stdout);
	}
	else if ("mp3" === option["audio stdout format"]) {
		self.outputStream = new lame.Encoder();
		self.outputStream.pipe(process.stdout);
	}

	self.stop = function() {
		var tmp = [];

		if (lastRequest) {
			lastRequest.abort();
			lastRequest = undefined;
		}

		self.mp3Decoder.removeAllListeners("finish");
		self.mp3Decoder.removeAllListeners("data");
		self.mp3Decoder = new lame.Decoder();
		self.onPlay = function() {};
		self.data = new Buffer(0);
		self.dataMass = [];

		self.mp3Decoder.on("data", function(chunk) {
			if (tmp) {
				tmp.push(chunk);

				if (100 === tmp.length) {
					self.dataMass = tmp;
					tmp = undefined;
				}
			}
			else {
				self.dataMass.push(chunk);
			}
		});

		self.mp3Decoder.on("end", function(data) {
			if (tmp) {
				self.dataMass = tmp;
				tmp = undefined;
			}

			// console.log("the finish!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
		});

		// console.log("stop")
	};

	// http://www.sonicspot.com/guide/wavefiles.html
	// http://microsin.net/programming/PC/wav-format.html
	(function outputLoop(expectTime) {
		var blockAlign = option["audio bit depth"] / 8 * option["audio channels"];
		var averageBytesPerSecond = option["audio sample rate"] * blockAlign;
		var currentTime = (new Date()).getTime();
		var timeDiff = currentTime - expectTime;

		expectTime = currentTime + self.repeatTime;

		setTimeout(function() {
			outputLoop(expectTime);
		}, self.repeatTime);

		if (!expectTime || (timeDiff > (self.repeatTime * 20))) {
			timeDiff = self.repeatTime * 20;
		}

		bnum = Math.round((self.repeatTime + timeDiff) / 1000 * averageBytesPerSecond);

		if (bnum % 2) {
			bnum++;
		}

		while (self.dataMass.length && (bnum > self.data.length)) {
			self.data = Buffer.concat([self.data, self.dataMass.shift()]);
		}

		if (!self.data.length) {
			self.onPlay();

			return;
		}

		var chunk = self.data.slice(0, bnum);

		self.onPlay(chunk);

		chunk = new Buffer(chunk, ("string" === typeof self.data) ? "binary" : undefined);

		self.data = self.data.slice(bnum);

		// console.log("currenttime", currentTime, "expecttime", expectTime)
		// console.log("timeDiff",timeDiff, "repeatTime", self.repeatTime, "bnum", bnum, "chunk.length", chunk.length, self.dataMass.length)

		// decrease volume, bad but faster than there - https://www.npmjs.com/package/pcm-volume
		for (var i = 0; i < chunk.length; i += 2) {
			var b1 = chunk[i];
			var b2 = chunk[i+1] << 8;
			var r = (chunk[i+1] < 128) ? (b1|b2) : (b1|b2) - 65536;

			r = Math.round(r * self.volume);

			chunk[i] = r & 255
			chunk[i+1] = r >>> 8;	
		}
		// 

		self.outputStream.write(chunk);
	}());
})

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
	var regexpDuration = new RegExp(/% (\d\d):(\d\d):(\d\d)/);
	var timeoutForNextSong;

	var waitForChangeSong = function(intTimeout) {
		clearTimeout(timeoutForNextSong);
		timeoutForNextSong = setTimeout(function() {
			self.onend();
		}, (intTimeout || 10000));
	}

	self.src = "";
	self.duration = 0;
	self.paused = true;

	self.decoded = false;
	self.dataBucket = [];
	self.listened = 0;

	self.onend = function() {
		self.duration = 0;
		self.pause();
		m["command"]("n");
	};

	self.pause = function() {
		self.paused = true;
		audio2stdout.stop();
		clearTimeout(timeoutForNextSong);
	};

	self.canPlayType = function() {
		return true;
	};

	self.play = function() {
		clearTimeout(timeoutForNextSong);

		audio2stdout.stop();
		audio2stdout.volume = self.volume;

		if (self.decoded && dataSrc && (dataSrc === self.src)) {
			audio2stdout.dataMass = self.dataBucket;
			
			return;
		}

		dataSrc = "";

		self.paused = false;
		self.duration = 0;

		self.decoded = false;
		self.dataBucket = [];
		self.listened = 0;

		audio2stdout.onPlay = function(data) {
			data = (data || []);

			self.listened += data.length;

			if (self.decoded && !data.length) {
				audio2stdout.onPlay = function() {};
				waitForChangeSong(1000);
			}
		}

		audio2stdout.mp3Decoder.on("data", function(data) {
			self.dataBucket.push(data);
		});

		audio2stdout.mp3Decoder.on("finish", function(data) {
			self.decoded = true;
		});
 
		lastRequest = similarJQueryAjax({"url": self.src, "timeout": 15000})
			.on("end", function(){
				// console.log("end!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
				clearTimeout(timeoutForNextSong);
				dataSrc = self.src;
			})
			.on("data", function(data){
				// console.log("data!")
				waitForChangeSong(20000);
			})
			.fail(function(e, e2){
				m["red"]("Can't load file!!!!!!!");
				self.pause();
				waitForChangeSong(5000);
			});

		lastRequest.pipe(audio2stdout.mp3Decoder);
	};

	return self;
};

// http://microsin.net/programming/PC/wav-format.html
// http://js.do/blog/sound-waves-with-javascript/
// https://github.com/oampo/Audiolet/blob/master/src/audiolet/Audiolet.js#L2831
// https://github.com/substack/baudio/blob/master/index.js#L33
function generateSineDataRAW(param) {
	var param = (param || {});
	var phase = (param["phase"] || 0);
	var gain = (1 >= param["gain"]) ? param["gain"] : 1;
	var bitsPerSample = (param["bits per sample"] || 16);
	var frequency = (param["frequency"] || 440);
	var sampleRate = (param["sample rate"] || 44100);
	var channels = (param["channels"] || 2);
	var timeout = (0 < param["timeout"]) ? (param["timeout"] / 1000) : 0; // translate to seconds
	var sampleSize = bitsPerSample / 8;
	var averageBytesPerSecond = (sampleRate * sampleSize * channels);
	var blockAlign = sampleSize * channels;
	var numSamples = Math.round((timeout * averageBytesPerSecond) / (blockAlign * sampleSize));
	var volume = gain * (Math.pow(2, bitsPerSample - 1) - 1);
	var t = (Math.PI * 2 * frequency) / (sampleRate) // * channels);
	var bufferAudioData = new Buffer(numSamples * blockAlign);

	for (var i = 0; i < numSamples; i++) {
		var val = Math.round(volume * Math.sin(t * i)); // sine wave
		var offset = i * sampleSize * channels;

		for (var channel = 0; channel < channels; channel++) {
			bufferAudioData['writeInt' + bitsPerSample + 'LE'](val, offset + (channel * sampleSize));
		}
	}

	return bufferAudioData;
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
				process.stderr.cursorTo(0, 0);
				process.stderr.clearScreenDown();

				console.error.apply(console, arguments);
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
				param = $.extend({
					"timeout": 0 // in milliseconds
					,"gain": (param && param["timeout"]) ? 0.7 : 0
					,"type": "sine" // 'sine', 'square', 'sawtooth', or 'triangle'.
					,"frequency": 440
				}, param);

				m["audio"]["object"].pause();
				audio2stdout.volume = param["gain"];

				if (!param["timeout"] || !param["gain"]) {
					return;
				}

				var keyName = "memory " + JSON.stringify(param);

				if (!m["tick"][keyName]) {
					if (!m["tick"]["memory silence"]) {
						m["tick"]["memory silence"] = generateSineDataRAW({
							"gain": 0
							,"sample rate": option["audio sample rate"]
							,"timeout": 5000 
							,"frequency": param["frequency"]
						});
					}

					m["tick"][keyName] = generateSineDataRAW({
						"gain": 0.2
						,"sample rate": option["audio sample rate"]
						,"timeout": param["timeout"] 
						,"frequency": param["frequency"]
					});

					m["tick"][keyName] = Buffer.concat([m["tick"][keyName], m["tick"]["memory silence"]])
				}

				audio2stdout.data = m["tick"][keyName];
			};
		
			keypress(process.stdin);
			process.stdin.setRawMode(true);
			process.stdin.resume();
			process.stdin.on('keypress', function (ch, key) {
				if (key && (key.name == 'escape' || (key.ctrl && key.name == 'c'))) {
					try {
						m["green"]("Bye-bye!");
						m["off"]();
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
	else if (("ESOCKETTIMEDOUT" === error.code) && m && m["audio"] && m["audio"]["object"]) {
		m["audio"]["object"].onend();
	}

	console.error("BIG ERROR :'Q", error);
});

startMorsetick();