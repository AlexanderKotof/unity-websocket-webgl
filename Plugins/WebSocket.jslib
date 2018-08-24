/*
 * unity-websocket-webgl
 * 
 * @author Jiri Hybek <jiri@hybek.cz>
 * @copyright 2018 Jiri Hybek <jiri@hybek.cz>
 * @license Apache 2.0 - See LICENSE file distributed with this source code.
 */

var LibraryWebSocket = {
	$webSocketState: {
		/*
		 * Map of instances
		 * 
		 * Instance structure:
		 * {
		 * 	url: string,
		 * 	ws: WebSocket
		 * }
		 */
		instances: {},

		/* Last instance ID */
		lastId: 0,

		/* Event listeners */
		onOpen: null,
		onMesssage: null,
		onError: null,
		onClose: null
	},

	/**
	 * Set onOpen callback
	 * 
	 * @param callback Reference to C# static function
	 */
	WebSocketSetOnOpen: function(callback) {

		webSocketState.onOpen = callback;

	},

	/**
	 * Set onMessage callback
	 * 
	 * @param callback Reference to C# static function
	 */
	WebSocketSetOnMessage: function(callback) {

		webSocketState.onMessage = callback;

	},

	/**
	 * Set onError callback
	 * 
	 * @param callback Reference to C# static function
	 */
	WebSocketSetOnError: function(callback) {

		webSocketState.onError = callback;

	},

	/**
	 * Set onClose callback
	 * 
	 * @param callback Reference to C# static function
	 */
	WebSocketSetOnClose: function(callback) {

		webSocketState.onClose = callback;

	},

	/**
	 * Allocate new WebSocket instance struct
	 * 
	 * @param url Server URL
	 */
	WebSocketAllocate: function(url) {

		var urlStr = Pointer_stringify(url);
		var id = webSocketState.lastId++;

		webSocketState.instances[id] = {
			url: urlStr,
			ws: null
		};

		return id;

	},

	/**
	 * Remove reference to WebSocket instance
	 * 
	 * If socket is not closed function will close it but onClose event will not be emitted because
	 * this function should be invoked by C# WebSocket destructor.
	 * 
	 * @param instanceId Instance ID
	 */
	WebSocketFree: function(instanceId) {

		var instance = webSocketState.instances[instanceId];

		if (!instance) return;

		// Close if not closed
		if (instance.ws !== null && instance.ws.readyState < 2)
			instance.ws.close();

		// Remove reference
		delete webSocketState.instances[instanceId];

	},

	/**
	 * Connect WebSocket to the server
	 * 
	 * @param instanceId Instance ID
	 */
	WebSocketConnect: function(instanceId) {

		var instance = webSocketState.instances[instanceId];
		if (!instance) throw new Error("Instance not found.");

		if (instance.ws !== null)
			throw new Error("Instance is already connected or in connecting state.");

		instance.ws = new WebSocket(instance.url);

		instance.ws.binaryType = 'arraybuffer';

		instance.ws.onopen = function() {

			if (webSocketState.onOpen)
				Runtime.dynCall('vi', webSocketState.onOpen, [ instanceId ]);

		};

		instance.ws.onmessage = function(ev) {

			if (ev.data instanceof ArrayBuffer) {

				var dataBuffer = new Uint8Array(ev.data);
				
				var buffer = _malloc(dataBuffer.length);
				HEAPU8.set(dataBuffer, buffer);

				if (webSocketState.onMessage)
					Runtime.dynCall('viii', webSocketState.onMessage, [ instanceId, buffer, dataBuffer.length ]);

			}

		};

		instance.ws.onerror = function(ev) {

			if (webSocketState.onError) {
				
				var msg = "WebSocket error.";
				var msgBytes = lengthBytesUTF8(msg);
				var msgBuffer = _malloc(msgBytes + 1);
				stringToUTF8(msg, msgBuffer, msgBytes);

				Runtime.dynCall('vii', webSocketState.onError, [ instanceId, msgBuffer ]);

			}

		};

		instance.ws.onclose = function() {

			if (webSocketState.onClose)
				Runtime.dynCall('vi', webSocketState.onClose, [ instanceId ]);

		};

	},

	/**
	 * Close WebSocket connection
	 * 
	 * @param instanceId Instance ID
	 */
	WebSocketClose: function(instanceId) {

		var instance = webSocketState.instances[instanceId];
		if (!instance) throw new Error("Instance not found.");

		if (instance.ws === null)
			throw new Error("WebSocket is not connected.");

		if (instance.ws.readyState === 2)
			throw new Error("WebSocket is already closing.");

		if (instance.ws.readyState === 3)
			throw new Error("WebSocket is already closed.");

		instance.ws.close();

	},

	/**
	 * Send message over WebSocket
	 * 
	 * @param instanceId Instance ID
	 * @param bufferPtr Pointer to the message buffer
	 * @param length Length of the message in the buffer
	 */
	WebSocketSend: function(instanceId, bufferPtr, length) {
	
		var instance = webSocketState.instances[instanceId];
		if (!instance) throw new Error("Instance not found.");
		
		if (instance.ws === null)
			throw new Error("WebSocket is not connected.");

		if (instance.ws.readyState !== 1)
			throw new Error("WebSocket is not in open state.");

		instance.ws.send(HEAPU8.buffer.slice(bufferPtr, bufferPtr + length));

	},

	/**
	 * Return WebSocket readyState
	 * 
	 * @param instanceId Instance ID
	 */
	WebSocketGetState: function(instanceId) {

		var instance = webSocketState.instances[instanceId];
		if (!instance) throw new Error("Instance not found.");

		if (instance.ws)
			return instance.ws.readyState;
		else
			return 3;

	}

};

autoAddDeps(LibraryWebSocket, '$webSocketState');
mergeInto(LibraryManager.library, LibraryWebSocket);