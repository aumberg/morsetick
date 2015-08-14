console.log = console.error; // write messages to stderr
console.log("(Loading MorseTick)");

option = {
	"key repeat speed":  250
	,"audio bit depth": 16
	,"audio channels": 2 // 2 - stereo, 1 - mono
	,"audio sample rate": 44100
	,"audio stdout": "sox" // variants - "sox", "speaker", "raw", "wav", "mp3".
};

Wav = require('wav');
Lame = require('lame');
jsdom = require('jsdom');
bhttp = require("bhttp");
Speaker = require('speaker');
keypress = require('keypress');

fs = require('fs');
extend = require('util')._extend;
querystring = require('querystring');
child_process = require('child_process');

htmlDocument = fs.readFileSync(__dirname + "/index.html").toString();
scriptDocument = fs.readFileSync(__dirname + "/morsetick.js").toString();

audio2output = new (function() {
	var self = this;
	var lastSoxParams = "";

	self.processOutput = {
		kill: function() {}
	};
	self.data = new Buffer(0);
	self.dataMass = [];
	self.onEvent = function() {};
	self.volume = 1;
	self.repeatTime = 50;

	self.killProcessOutput = function() {
		if (self.processOutput.stdin) {
			// (self.processOutput.stdin.unpipe || function() {})();
			(self.processOutput.stdin.removeAllListeners || function() {})("data")
			// (self.processOutput.stdin.end || function() {})()
		}
		
		if (self.processOutput.stderr) {
			// (self.processOutput.stderr.unpipe || function() {})();
			(self.processOutput.stderr.removeAllListeners || function() {})("data")
			// (self.processOutput.stderr.end || function() {})()
		}

		self.processOutput.kill("SIGHUP");
		self.processOutput = {
			kill: function() {}
		};
	};

	self.startProcessOutput = function(param) {
		param = (param || {});
		param["trim"] = (param["trim"] || "0");
		param["volume"] = self.volume = parseFloat(param["volume"] || "1") / 1.5; // decrease volume
		param["format"] = (param["format"] || "raw");
		param["audio stdout"] = (param["audio stdout"] || option["audio stdout"] || "raw");

		self.killProcessOutput();

		if ("speaker" === param["audio stdout"]) {
			self.processOutput.stdin = new Speaker({
				"channels": option["audio channels"]		// 1 channel
				,"bitDepth": option["audio bit depth"]		// 32-bit samples
				,"sampleRate": option["audio sample rate"]	// 48,000 Hz sample rate
				,"signed": true
			});
		}
		else if ("raw" === param["audio stdout"]) {
			self.processOutput.stdin = process.stdout;
		}
		else if ("wav" === param["audio stdout"]) {
			self.processOutput.stdin = new Wav.Writer({
				"channels": option["audio channels"]
				,"sampleRate": option["audio sample rate"]
				,"bitDepth": option["audio bit depth"]
			});
			self.processOutput.stdin.pipe(process.stdout);
		}
		else if ("mp3" === param["audio stdout"]) {
			self.processOutput.stdin = new Lame.Encoder();
			self.processOutput.stdin.pipe(process.stdout);
		}
		else if ("sox" === param["audio stdout"]) {
			if ("mp3" === param["format"]) {
				var soxParams = "-t mp3";
			}
			else if ("wav" === param["format"]) {
				var soxParams = "-t wav";
			}
			else if ("raw" === param["format"]) {
				var soxParams = "-t raw -c 2 -r 44100 -b 16 -e signed-integer";
			}

			var regexpDuration = new RegExp(/% (\d\d):(\d\d):(\d\d)/);

			soxParams = "-G --buffer=1024 -v " + param["volume"] + " " + soxParams + " - -d trim " + param["trim"];

			self.processOutput = child_process.spawn("sox", soxParams.split(" "), {
		        stdio: ['pipe', 'ignore', 'pipe']
		    });

			self.processOutput.stderr.on("data", function(data) {
				data = data.toString();

				var match = data.match(regexpDuration);

				if (match) {
					var date = new Date();

					date.setHours(match[1]);
					date.setMinutes(match[2]);
					date.setSeconds(match[3]);

					self.onEvent("duration", date.getSeconds());
				}
			});

		    // console.log(soxParams);
		}

		if (self.processOutput.on) {
			self.processOutput.on("error", function() {});
		}

		if (self.processOutput.stdin && self.processOutput.stdin.on) {
			self.processOutput.stdin.on("error", function() {});
		}
	};

	self.stop = function() {
		self.onEvent("stop");
		self.onEvent = function() {};
		self.data = new Buffer(0);
		self.dataMass = [];
	};

	self.play = function(param) {
		param = (param || {});
		param["data"] = (param["data"] || []);
		param["trim"] = (param["trim"] || "0");
		param["clear"] = (param["clear"] || false);
		param["format"] = (param["format"] || "raw");
		param["volume"] = self.volume = (param["volume"] || "1");

		if (param["clear"] || ("sox" === option["audio stdout"])) {
			self.data = new Buffer(0);
			self.dataMass = [];
		}

		var soxParams = param["format"] + param["volume"] + param["trim"];

		if (!self.processOutput.stdin || (("sox" === option["audio stdout"]) && (lastSoxParams !== soxParams))) {
			self.startProcessOutput(param)
			lastSoxParams = soxParams;
		}

		if ("sox" === option["audio stdout"]) {
			if (!param["data"]) {
				return;
			}

			if (!Buffer.isBuffer(param["data"])) {
				param["data"] = Buffer.concat(param["data"]);
			}

			if ("raw" === param["format"]) {
				self.data = param["data"];
			}
			else {
				self.processOutput.stdin.write(param["data"]);
			}
		}
		else if ("raw" === param["format"]) {
			if (Buffer.isBuffer(param["data"])) {
				self.data = param["data"];
			}
			else if ("object" === typeof param["data"]) {
				self.dataMass = self.dataMass.concat(param["data"]);
			}
		}

		delete param;
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

		if (!expectTime || (timeDiff > (self.repeatTime * 2))) {
			timeDiff = self.repeatTime;
		}

		var bnum = Math.round((self.repeatTime + timeDiff) / 1000 * averageBytesPerSecond);

		if (bnum % 2) {
			bnum++;
		}

		while (self.dataMass.length && (bnum > self.data.length)) {
			self.data = Buffer.concat([self.data, self.dataMass.shift()]);
		}

		if (!self.processOutput.stdin || !self.data.length) {
			self.onEvent("play");

			return;
		}

		var chunk = new Buffer(self.data.slice(0, bnum), ("string" === typeof self.data) ? "binary" : undefined);

		self.data = self.data.slice(bnum);

		// console.log("currenttime", currentTime, "expecttime", expectTime)
		// console.log("timeDiff",timeDiff, "repeatTime", self.repeatTime, "bnum", bnum, "chunk.length", chunk.length, self.dataMass.length)

		// decrease volume, bad but faster than there - https://www.npmjs.com/package/pcm-volume
		for (var i = 0; i < chunk.length; i += 2) {
			var b1 = chunk[i];
			var b2 = chunk[i+1] << 8;
			var r = (chunk[i+1] < 128) ? (b1|b2) : (b1|b2) - 65536;

			r = Math.round(r * self.volume);

			chunk[i] = r & 255;
			chunk[i+1] = r >>> 8;	
		}
		// add silence
		if (chunk.length && (bnum > chunk.length)) {
			var silence = new Buffer(bnum - chunk.length);

			silence.fill(0x00);
			chunk = Buffer.concat([chunk, silence]);
		}
		//
		self.onEvent("play", chunk);
		self.processOutput.stdin.write(chunk);
	}());
});

function similarJQueryAjax(param, callback) {
	param = (param || {});
	param["url"] = (param["url"] || "");
	param["data"];
	param["stream"] = (param["stream"] || false);
	param["timeout"];

	var bhttpParams = {
		responseTimeout: param["timeout"]
		,stream: true
	}

	if (param["data"] && ("POST" !== param["type"])) {
		param["url"] += "?" + querystring.stringify(param["data"]);
	}

	if (!similarJQueryAjax.session) {
		similarJQueryAjax.session = (bhttp || require("bhttp")).session({
			headers: {"user-agent": "MorseTick", "Cache-Contro": "no-cache"}
		});
	}

	similarJQueryAjax.session.methods = {
		"fail":function() {},
		"chunk":function() {},
		"done":function() {},
		"always":function() {}
	};

	for (var i in similarJQueryAjax.session.methods) {
		(function(i) {
			similarJQueryAjax.session.methods[i] = function(callback) {
				if ("function" === typeof callback) {
					similarJQueryAjax.session.methods[i] = callback;
				}

				return similarJQueryAjax.session.methods;
			}
		}(i));
	}

	similarJQueryAjax.session.methods["error"] = similarJQueryAjax.session.methods["fail"]
	similarJQueryAjax.session.methods["success"] = similarJQueryAjax.session.methods["done"]

	if (similarJQueryAjax.session.response) {
		similarJQueryAjax.session.response.removeAllListeners("data");
		similarJQueryAjax.session.response.removeAllListeners("end");
		similarJQueryAjax.session.response.removeAllListeners("error");
	}

	if (!param["url"]) {
		return;
	}

	similarJQueryAjax.session.get(param["url"], bhttpParams, function(err, response) {
		if (err) {
			similarJQueryAjax.session.methods.fail(err);
			similarJQueryAjax.session.methods.always();
		}
		else {
			similarJQueryAjax.session.response = response;

			var bucket = [];

			response.on("error", function(message) {
				similarJQueryAjax.session.methods.fail(message);
				similarJQueryAjax.session.methods.always();

				delete bucket;
			})

			response.on("data", function(data) {
				if (!param["stream"]) {
					bucket.push(data)
				}

				// console.log(bucket.length)
				similarJQueryAjax.session.methods.chunk(data);
			})

			response.on("end", function() {
				// console.log("end", bucket.length);
				similarJQueryAjax.session.methods.done(bucket && bucket.length ? Buffer.concat(bucket).toString() : undefined);
				similarJQueryAjax.session.methods.always();

				delete bucket;
			})
		}
	});

	return similarJQueryAjax.session.methods;
};

// maybe use https://www.npmjs.org/package/node-core-audio ?
function similarHTML5Audio() {
	var self = this;
	var dataSrc = "";
	var regexpDuration = new RegExp(/% (\d\d):(\d\d):(\d\d)/);
	var timeoutForNextSong;
	var downloadBucket = [];
	var downloadBucketListenNum = 0;
	var mp3Decoder = new Lame.Decoder();

	var waitForChangeSong = function(intTimeout) {
		clearTimeout(timeoutForNextSong);
		timeoutForNextSong = setTimeout(function() {
			self.onend();
		}, (intTimeout || 10000));
	}

	self.src = "";
	self.duration = 0;
	self.paused = true;

	self.onend = function() {
		self.duration = 0;
		self.pause();

		if (!m["keydown"]["wait"]) {
			m["command"]("n");
		}
	};

	self.stop = function() {
		audio2output.killProcessOutput();
		self.pause();
		self.duration = 0;
	};

	self.pause = function() {
		self.paused = true;
		audio2output.stop();
		drawGirl({"action":"stop"})
		clearTimeout(timeoutForNextSong);
		similarJQueryAjax();
	};

	self.canPlayType = function() {
		return true;
	};

	self.play = function() {
		if (!dataSrc || (dataSrc !== self.src)) {
			dataSrc = "";
			downloadBucket = [];
			downloadBucketListenNum = 0;
			self.stop();
		}

		self.paused = false;

		var dataCatcher = function(data) {
			if ("sox" === option["audio stdout"]) {			
				audio2output.play({
					"data": [data]
					,"format": "mp3"
					,"volume": self.volume
				});
			}

			downloadBucket.push(data);
			waitForChangeSong(20000);
		}

		if ("sox" !== option["audio stdout"]) {
			mp3Decoder.removeAllListeners("data");
			mp3Decoder = new Lame.Decoder();
			mp3Decoder.on("data", function(data) {
				audio2output.play({
					"data": [data]
					,"format": "raw"
					,"volume": self.volume
				});
			});

			audio2output.onEvent = function(eventName, value) {
				if ("play" === eventName) {
					var stockSize = 20;
					var diff = stockSize - audio2output.dataMass.length;
					var isWait = !mp3Decoder._transformState.transforming && !mp3Decoder._writableState.length && !mp3Decoder._readableState.length;

					if (!value && dataSrc && (0 < diff) && isWait && !downloadBucket[downloadBucketListenNum]) {
						self.onend();
					}
					else if (!self.paused && (0 < diff) && isWait && downloadBucket[downloadBucketListenNum]) {
						// console.log("play!", downloadBucketListenNum, self.paused, diff, downloadBucket[downloadBucketListenNum].length)

						// for (var i = 0; (i < diff) && downloadBucket[downloadBucketListenNum]; i++) {			
						mp3Decoder.write(downloadBucket[downloadBucketListenNum]);
						downloadBucketListenNum++;
						// }
					}
				}
			}
		}
		else {
			audio2output.onEvent = function(eventName, value) {
				if ("duration" === eventName) {
					self.duration = value;
					waitForChangeSong(2000);
				}
			}
		}

		if (dataSrc && (dataSrc === self.src)) {
			drawGirl();
			audio2output.play({
				"data": downloadBucket.slice(downloadBucketListenNum)
				,"format": "mp3"
				,"volume": self.volume
				,"trim": self.duration
			});
			
			return;
		}

		similarJQueryAjax({"url": self.src, "stream":true, "timeout": 15000})
			.done(function() {
				drawGirl();
				clearTimeout(timeoutForNextSong);
				dataSrc = self.src;
			})
			.chunk(dataCatcher)
			.fail(function(e, e2){
				m["red"]("Can't load file!!!!!!!");
				self.pause();
				waitForChangeSong(5000);
			});
	};

	return self;
};

function drawGirl(param) {
	param = (param || {});
	param["action"] = (param["action"] || "start");

	var sp = "                  ";
	var frameNum = 0;
	var frames = {};
	// http://ascii.co.uk/art
	frames[0] = sp + "Hello!  \n"; frames[1]  = sp + "        \n"; frames[2]  = sp + "Have fun! \n";  frames[3]  = sp + "        \n";
	frames[0]+= sp + "  _     \n"; frames[1] += sp + "  _     \n"; frames[2] += sp + "   _      \n";  frames[3] += sp + "   _    \n"; 
	frames[0]+= sp + " //|\\  \n"; frames[1] += sp + " //|\\  \n"; frames[2] += sp + " /|\\\\   \n";  frames[3] += sp + " /|\\\\ \n"; 
	frames[0]+= sp + " '_'/   \n"; frames[1] += sp + " '_\"/  \n"; frames[2] += sp + " \\'_'    \n";  frames[3] += sp + " \\\"_' \n"; 
	frames[0]+= sp + "__/\\__ \n"; frames[1] += sp + "  /\\   \n"; frames[2] += sp + "  /\\__   \n";  frames[3] += sp + "  /\\   \n"; 
	frames[0]+= sp + " /  \\  \n"; frames[1] += sp + " /\\/\\ \n"; frames[2] += sp + " /\\ \\   \n";  frames[3] += sp + " /\\/\\ \n"; 
	frames[0]+= sp + "/____\\ \n"; frames[1] += sp + "/____\\ \n"; frames[2] += sp + "/____\\   \n";  frames[3] += sp + "/____\\ \n"; 
	frames[0]+= sp + "  /l    \n"; frames[1] += sp + "  ll    \n"; frames[2] += sp + "  ll      \n";  frames[3] += sp + "  /l    \n"; 
	//
	clearInterval(drawGirl.interval);

	if ("stop" === param["action"]) {
		return;
	}

	drawGirl.interval = setInterval(function() {
		process.stderr.cursorTo(0, 5);
		process.stderr.clearScreenDown();
		console.log(frames[frameNum]);
		frameNum = frames[frameNum + 1] ? frameNum + 1 : 0;
	}, 1000);
}

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
			window.console.error = function() {
				console.error.apply(console, arguments);
				// uncomment for debug
				// console.error.apply(console, [new Error().stack]);
			}

			window.console.log = function() {
				process.stderr.cursorTo(0, 0);
				process.stderr.clearScreenDown();

				console.log.apply(console, arguments);
			}

			try {
				var jsonLinks = fs.readFileSync(__dirname + "/links.json").toString();

				m["memory history"] = JSON.parse(jsonLinks);
			}
			catch (e) {}

			m["option duration"]["dot"] = option["key repeat speed"] + 10;
			m["option console log"] = true;

			m["external event listener"] = function(eventName, value) {
				if ("link play" === eventName) {
					try {
						fs.writeFile(__dirname + "/links.json", JSON.stringify(m["links"]().slice(0, 100)).replace(/},{/g, "},\n{"));
					}
					catch (e) {
						m["red"]("Can't write links.json");
					}
				}
				else if (("start command" === eventName) && ("h" === value[0])) {
					m["green"](fs.readFileSync("./readme.md").toString());
				}
			};

			m["tick"] = function(param) {
				param = $.extend({
					"timeout": 0 // in milliseconds
					,"gain": (param && param["timeout"]) ? 0.2 : 0
					,"frequency": 440
				}, param);

				m["audio"]();

				var keyName = "memory " + JSON.stringify(param);

				if (!m["tick"][keyName]) {
					if (!m["tick"]["memory silence"]) {
						m["tick"]["memory silence"] = new Buffer(100000);
						m["tick"]["memory silence"].fill(0)
					}

					m["tick"][keyName] = generateSineDataRAW({
						"gain": param["gain"]
						,"sample rate": option["audio sample rate"]
						,"timeout": param["timeout"] 
						,"frequency": param["frequency"]
					});

					m["tick"][keyName] = Buffer.concat([m["tick"][keyName], m["tick"]["memory silence"]])
				}

				audio2output.play({
					"data": m["tick"][keyName]
					,"clear": true
					,"format": "raw"
				});
			};

			process.stderr.cursorTo(0, 0);
			process.stderr.clearScreenDown();
			m["green"]("ready?");
			m["tick"]({"timeout": m["duration"]()["dash"]});
			m["tick"]({"timeout": m["duration"]()["dot"]});
			m["green"]("steady?!");
	
			keypress(process.stdin);
			process.stdin.setRawMode(true);
			process.stdin.resume();
			process.stdin.on('keypress', function (ch, key) {
				if (key && (key.name == 'escape' || (key.ctrl && key.name == 'c'))) {
					try {
						m["green"]("Bye-bye!");
						m["off"]();
						audio2output.killProcessOutput()
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
// catch fatal exceptions
process.on('uncaughtException', function (error) {
	error = error.message;

	if (200 < error.length) {
		error = error.slice(0, 100) + " ... " + error.slice(-100); 
	}

	console.error("BIG ERROR :'Q", error);
});
// parse JSON in argument
for (var i = 0; i < process.argv.length; i++) {
    if (-1 !== process.argv[i].indexOf("{")) {
        try {
            option = extend(option, JSON.parse(process.argv[i].replace(/\'/g, "\"")), true);
        }
        catch (e) {
            console.log("not valid JSON in argument", process.argv[i]);
            process.exit();
        }
    }
};
// search SoX utils and start program
child_process.spawn("sox", ["--version"])
	.on("error", function() {
		if ("sox" === option["audio stdout"]) {
			option["audio stdout"] = "speaker";
			setTimeout(function() {
				console.log("You don't have SoX utils installed, this program will use \"speaker\" library");
			}, 5000);
		}
	})
	.stdout.on("end", startMorsetick);