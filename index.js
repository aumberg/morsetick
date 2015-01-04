console.log("(Loading)");

var option = {
	"key repeat speed":  250
};

var whatRequire = "This program is require install SoX command line utility - http://sox.sourceforge.net/";

var jsdom = require('jsdom');
var request = require('request');
var keypress = require('keypress');

var fs = require('fs');
var spawn = require('child_process').spawn;
var querystring = require('querystring');

var htmlDocument = fs.readFileSync(__dirname + "/index.html").toString();
var scriptDocument = fs.readFileSync(__dirname + "/morsetick.js").toString();

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
		var volume = (that.volume * 0.3).toPrecision(2);
		var params = ["-G","-t","mp3", "-v", volume, "-", "-d", "trim", that.duration];
		
		deleteStream();
		m["audio"]["process"] = spawn("sox", params);
		m["audio"]["process"].stderr.on("data", dataListener);

		return m["audio"]["process"];
	};

	var deleteStream = function() {
		clearTimeout(timeoutForNextSong);

		if (m["audio"]["process"]) {
			m["audio"]["process"].stderr.removeListener("data", dataListener);
			m["audio"]["process"].kill("SIGHUP"); // "SIGHUP", "SIGSTOP"
		}

		m["audio"]["process"] = undefined;
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
		if (dataBuffer.length && dataSrc && (dataSrc === that.src)) {
			createStream();
			m["audio"]["process"].stdin.write(dataBuffer);
			
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
				m["audio"]["process"].stdin.write(data);
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
			window.console.error = console.error;
			window.console.log = function() {
				process.stdout.cursorTo(0, 0);
				process.stdout.clearScreenDown();

				console.log.apply(console, arguments);
			}

			m["option duration"]["dot"] = option["key repeat speed"] + 10;
			m["option console log"] = true;

			m["external event listener"] = function(eventName) {
				// ?
			};

			m["tick"] = function(param) {
				m["tick"]["buffers"] = (m["tick"]["buffers"] || {});
				m["tick"]["delay"];
				m["tick"]["process"];

				param = $.extend({
					"timeout": 0 // in milliseconds
					,"gain": (param && param["timeout"]) ? 0.2 : 0
					,"type": "sine" // 'sine', 'square', 'sawtooth', or 'triangle'.
					,"frequency": 440
				}, param);

				if (m["tick"]["process"]) {
					m["tick"]["process"].kill("SIGHUP"); // "SIGHUP", "SIGSTOP"
					m["tick"]["process"] = undefined;
				}

				clearTimeout(m["tick"]["delay"]);

				if (!param || !param["timeout"]) {
					return;
				}

				var duration = m["duration"]();
				var t = param["timeout"] / 1000;
				var d = duration["dot"] / 1000 - 0.1;

				t = (t && (t < 0.2)) ? 0.2 : t;

				var params = ["-G", "-n", 
					"-t", "raw", "-r", "44100", "-b", "8", "-e", "unsigned-integer", "-",
					"synth", t, "sine", param["frequency"] + "-440", 
					"vol", param["gain"],
					"fade", (t > d) ? d : t
				];
				var paramsAsString = params.join(" ");

				if (!m["tick"]["buffers"][paramsAsString]) {
					var buf = m["tick"]["buffers"][paramsAsString] = new Buffer(0);
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
							m["tick"]["buffers"][paramsAsString] = buf;
							m["tick"](param);
						});

					return;
				}
				else if (!m["tick"]["buffers"][paramsAsString].length) {
					return;
				}

				m["tick"]["delay"] = setTimeout(function() {
					m["tick"]();
					m["tick"]["process"] = spawn("sox", ["-t", "raw", "-r", "44100", "-b", "8", "-e", "unsigned-integer", "-", "-d"]);
					m["tick"]["process"].stdin.write(m["tick"]["buffers"][paramsAsString]);
				}, 100);
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

				$(window).trigger(event);
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