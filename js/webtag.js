/*
 * WebTag namespace
 */
WebTag = window.WebTag || {};

/*
 * WebTag initialization (autodetect admin or preview mode)
 */
if(document.addEventListener) {
	document.addEventListener('DOMContentLoaded', function() {
		var editorContainer = document.querySelector('[data-webtag]'),
			webtagConfig = document.querySelector('[data-webtag-config]');

		// get config from attribute
		if(webtagConfig) {
			webtagConfig = JSON.parse(webtagConfig.getAttribute('data-webtag-config'));
		} else {
			return;
		}

		if(editorContainer) {
			// this script is running in admin panel
			webtagConfig.holder = editorContainer;
			WebTag.editorInstance = new WebTag.Editor(webtagConfig);
		} else if(window.parent === window) {
			// this script is running on live site
			webtagConfig.window = window;
			WebTag.viewerInstance = new WebTag.Viewer(webtagConfig);
		}
	});
}

/*
 * WebTag - Admin editor module
 */
WebTag.Editor = function(options) {
	this.options = WebTag.Utils.extend({
		holder: 'html',
		pinImageSRC: 'pin.png',
		defaultFrameSRC: null,
		loadingAttribute: 'data-webtag-loading'
	}, options);
	this.init();
};
WebTag.Editor.prototype = {
	init: function() {
		this.initStructure();
		this.attachEvents();

		if(WebTag.Hooks.initAdminPanel) {
			WebTag.Hooks.initAdminPanel.call(this, this);
		}
	},
	initStructure: function() {
		// find root element
		var self = this;
		if(typeof this.options.holder === 'string') {
			this.holder = document.querySelector(this.options.holder);
		} else {
			this.holder = this.options.holder;
		}

		// create pin image
		this.pinImage = new Image();
		this.pinImage.onload = function() {
			self.dragPin.appendChild(self.pinImage);
			self.pinImageFullSRC = self.pinImage.src;
		};
		this.pinImage.src = this.options.pinImageSRC;

		// find other control elements
		this.editList = this.holder.querySelector('[data-webtag-editlist]');
		this.previewFrame = this.holder.querySelector('[data-webtag-frame]');
		this.pagerSelectors = this.holder.querySelectorAll('[data-webtag-pager]');
		this.btnSave = this.holder.querySelector('[data-webtag-save]');
		this.dragPin = this.holder.querySelector('[data-webtag-pin]');
	},
	attachEvents: function() {
		// initialize pin drag
		var self = this;
		this.draggable = new WebTag.Draggable({
			pin: this.dragPin,
			pinInnerOffsetX: this.options.pinInnerOffsetX,
			pinInnerOffsetY: this.options.pinInnerOffsetY,
			frame: this.previewFrame,
			onDragStart: function() {
				self.holder.setAttribute(this.options.dragActiveAttribute, '');
			},
			onDragEnd: function() {
				self.holder.removeAttribute(this.options.dragActiveAttribute);
			},
			onDragComplete: function(eventData) {
				self.childViewerInstance.addPin(eventData);
			}
		});

		// page selectors
		this.pagerChangeHandler = function(e) {
			self.loadInPreview(this.value);
		};
		for(var i = 0; i < this.pagerSelectors.length; i++) {
			this.pagerSelectors[i].addEventListener('change', this.pagerChangeHandler);
		}

		// save button handler
		if(this.btnSave) {
			this.btnSave.addEventListener('click', function(e) {
				e.preventDefault();
				self.savePinData();
			});
		}

		// detect default source
		if(this.options.defaultFrameSRC) {
			this.loadInPreview(this.options.defaultFrameSRC);
		}
	},
	injectViewer: function() {
		// inject webtag namespace if needed
		if(!this.previewFrame.contentWindow.WebTag) {
			this.previewFrame.contentWindow.WebTag = {};
		}
		// create pin viewer if not created
		var self = this;
		this.childViewerInstance = this.previewFrame.contentWindow.WebTag.viewerInstance;
		if(!this.childViewerInstance) {
			this.childViewerInstance = new WebTag.Viewer({
				window: this.previewFrame.contentWindow,
				createPinMeta: true,
				pinImageSRC: this.pinImageFullSRC,
				pinInnerOffsetX: this.options.pinInnerOffsetX,
				pinInnerOffsetY: this.options.pinInnerOffsetY,
				onNewPinAdded: function(pinInstance) {
					self.draggable.makePinDraggable(pinInstance);
					self.createMetaEditBlock(pinInstance);
				},
				onDestroyPin: function(pinInstance) {
					if(pinInstance.metaEditor) {
						pinInstance.metaEditor.destroy();
					}
				},
				onReorderPins: function(pins) {
					for(var i = 0, currentPin; i < pins.length; i++) {
						currentPin = pins[i];
						if(currentPin.metaEditor) {
							currentPin.metaEditor.setIndex(i);
						}
					}
				}
			});

			this.previewFrame.contentWindow.WebTag.viewerInstance = this.childViewerInstance;
		}
	},
	createMetaEditBlock: function(pinInstance) {
		// create meta editor for current block
		var self = this;
		if(!pinInstance.targetNode) return;
		pinInstance.metaEditor = new WebTag.MetaEditBlock({
			holder: this.editList,
			pinInstance: pinInstance,
			meta: pinInstance.options.meta,
			onEditorRequestSave: function(callback) {
				self.savePinData(callback);
			},
			onEditorRequestDelete: function() {
				pinInstance.destroy();
			},
			onEditorRequestActivatePin: function() {
				var previewWin = self.previewFrame.contentWindow,
					pinBody = pinInstance.getPinBody(),
					pinOffset = WebTag.Utils.getOffset(pinBody);
				
				// activate pin only if visible
				if(pinBody.offsetWidth) {
					if(pinOffset.top < previewWin.pageYOffset || pinOffset.top + pinInstance.pinImageHeight > previewWin.pageYOffset + previewWin.innerHeight) {
						previewWin.scrollTo(0, pinOffset.top - pinInstance.pinImageHeight);
					}
					pinBody.classList.add('webtag-pin-active');	
				}
			},
			onEditorRequestDeactivatePin: function() {
				pinInstance.getPinBody().classList.remove('webtag-pin-active');
			}
		});
		
	},
	loadInPreview: function(url) {
		// destroy child pin viewer if exists
		var self = this;
		if(this.childViewerInstance) {
			this.childViewerInstance.destroy();
		}

		// destroy edit blocks
		this.editList.innerHTML = '';

		// load new page in preview
		if(url) {
			this.previewFrame.onload = function() {
				self.injectViewer();
			};
			this.previewFrame.src = url;
		} else {
			this.previewFrame.onload = null;
			this.previewFrame.src = 'about:blank';
		}
	},
	savePinData: function(callback) {
		var self = this,
			resultObject = {},
			pinList = this.childViewerInstance.getPins();

		// serialize data
		resultObject.pins = [];
		pinList.forEach(function(pinInstance) {
			var pinState = pinInstance.getState();
			if(pinInstance.metaEditor){
				var metaData = pinInstance.metaEditor.serialize();
				pinState.meta = metaData;
				resultObject.pins.push(pinState);
			}
		});

		// save data
		self.holder.setAttribute(self.options.loadingAttribute, '');
		WebTag.Utils.ajax({
			url: this.childViewerInstance.getDataURL(),
			type: 'post',
			data: 'json=' + encodeURIComponent(JSON.stringify(resultObject)),
			success: function() {
				// data sent callback
				self.holder.removeAttribute(self.options.loadingAttribute);
				if(typeof callback === 'function') callback(self);
			}
		});
	}
};

/*
 * WebTag - Admin viewer module
 */
WebTag.Viewer = function(options) {
	this.options = WebTag.Utils.extend({
		window: window,
		holder: null,
		dataURL: '',
		autoRefresh: true,
		createPinMeta: true,
		refreshInterval: 500
	}, options);
	this.init();
};
WebTag.Viewer.prototype = {
	init: function() {
		this.initStructure();
		this.attachEvents();
		this.loadPinData();
		/* 23.06.2014 */
		if(WebTag.editorInstance){
			this.disableLinks();
		}
		/* 23.06.2014 */
	},
	initStructure: function() {
		// find elements
		this.pins = [];
		this.win = this.options.window;
		this.doc = this.win.document;
		this.page = this.doc.body;

		// find dataURL config in page if specified
		this.pageConfig = this.doc.querySelector('[data-webtag-config]');
		if(this.pageConfig) {
			this.pageConfig = JSON.parse(this.pageConfig.getAttribute('data-webtag-config'));
			if(this.pageConfig.dataURL) {
				this.options.dataURL = this.pageConfig.dataURL;
			}
		}
	},
	disableLinks: function(){
		// make links unclickable
		var allLinks = this.doc.querySelectorAll('a, input');
		var preventHandler = function() {
			return false;
		};
		for(var i = allLinks.length; i--;){
			allLinks[i].onclick = preventHandler;
		}
	},
	attachEvents: function() {
		// handle resize
		var self = this;
		this.resizeHandler = function() {
			self.hidePins();
			self.pageWidth = self.page.scrollWidth;
			self.pageHeight = self.page.scrollHeight;
			self.repositionPins();
		};
		this.resizeHandler();
		this.win.addEventListener('resize', this.resizeHandler);

		var raf = window.requestAnimationFrame || function(f) {setTimeout(f,500);};

		// handle pin positions and visibility
		if(this.options.autoRefresh) {
			this.refreshHandler = function() {
				if(!self.destroyed) {
					self.repositionPins();
					raf(self.refreshHandler);
				}
			};
			this.refreshHandler();
		}

		// handle pin destroy event
		WebTag.Utils.bindHandlers(['destroyPin'], this);
	},
	loadPinData: function() {
		// load pin data when viewer initialized
		var self = this;
		WebTag.Utils.ajax({
			url: self.getDataURL(),
			type: 'get',
			success: function(data) {
				var pinListData = null;

				// try to parse response as JSON
				try {
					pinListData = JSON.parse(data);
				} catch(e) {
					if(window.console && console.warn) {
						console.warn('Incorrect WebTag config');
					}
				}

				// add pins if parsed successfully
				if(pinListData) {
					for(var i = 0, currentPinData; i < pinListData.pins.length; i++) {
						currentPinData = pinListData.pins[i];
						self.addPin(currentPinData);
					}
				}
			}
		});
	},
	addPin: function(pinData) {
		var newPin, newPinConfig = WebTag.Utils.extend({
			window: this.win,
			pageWidth: this.pageWidth,
			pageHeight: this.pageHeight,
			pinImageSRC: this.options.pinImageSRC,
			pinInnerOffsetX: this.options.pinInnerOffsetX,
			pinInnerOffsetY: this.options.pinInnerOffsetY,
			onDestroy: this.destroyPin
		}, pinData);
		
		newPin = new WebTag.Pin(newPinConfig);
		this.pins.push(newPin);
		this.makeCallback('newPinAdded', newPin);
		if(this.options.createPinMeta && WebTag.Hooks.createViewBlock) {
			this.createTooltip(newPin, pinData);
		}

		this.reorderPins();
		return newPin;
	},
	createTooltip: function(pinInstance, pinData){
		if(!pinInstance.popupBody){
			pinInstance.pinBody = pinInstance.getPinBody();
			pinInstance.popupBody = WebTag.Hooks.createViewBlock(pinInstance.pinBody, pinData.meta);
			pinInstance.pinBody.appendChild(pinInstance.popupBody);
			pinInstance.pinBody.onmouseover = function() {
				pinInstance.pinBody.classList.remove('inverted-position');
				var popupOffset = WebTag.Utils.getOffset(pinInstance.popupBody).left,
					popupWidth = pinInstance.popupBody.offsetWidth;

				pinInstance.pinBody.classList.toggle('inverted-position', popupOffset + popupWidth > window.innerWidth);
			};
		}
	},
	getPins: function() {
		return this.pins;
	},
	getAbsolutePath: function(href) {
		if(href.indexOf('http') === 0) {
			return href;
		} else {
			var link = this.doc.createElement('a');
			link.href = href;
			//alert(href);
			return link.protocol + '//' + link.host + link.pathname + link.search + link.hash;
		}
	},
	getDataURL: function() {
		return this.getAbsolutePath(this.options.dataURL);
	},
	reorderPins: function() {
		for(var i = 0, currentPin; i < this.pins.length; i++) {
			currentPin = this.pins[i];
			currentPin.setIndex(i);
		}
		this.makeCallback('reorderPins', this.pins);
	},
	destroyPin: function(pinInstance) {
		// remove pin from collection
		this.pins.splice(this.pins.indexOf(pinInstance), 1);
		this.reorderPins();

		// notify parent class
		this.makeCallback('destroyPin', pinInstance);
	},
	repositionPins: function() {
		for(var i = 0, currentPin; i < this.pins.length; i++) {
			currentPin = this.pins[i];
			if(currentPin.isTargetNodeVisible()) {
				currentPin.setPageSize(this.pageWidth, this.pageHeight).show().reposition();
			} else {
				currentPin.hide();
			}
		}
	},
	hidePins: function() {
		for(var i = 0, currentPin; i < this.pins.length; i++) {
			this.pins[i].hide();
		}
	},
	showPins: function() {
		for(var i = 0, currentPin; i < this.pins.length; i++) {
			this.pins[i].show();
		}

	},
	destroy: function() {
		this.destroyed = true;
		this.win.removeEventListener('resize', this.resizeHandler);
	},
	makeCallback: function(eventName, eventData) {
		var capitalizedEventName = eventName.charAt(0).toUpperCase() + eventName.slice(1),
			optionsHandler = this.options['on' + capitalizedEventName];

		if(optionsHandler) {
			optionsHandler.call(this, eventData);
		}
	}
};

/*
 * WebTag - Pin module
 */
WebTag.Pin = function(options) {
	this.options = WebTag.Utils.extend({
		window: window,
		pageWidth: Infinity,
		pageHeight: Infinity,
		pinImageSRC: 'pin.png'
	}, options);
	this.init();
};
WebTag.Pin.prototype = {
	init: function() {
		var self = this;
		this.win = this.options.window;
		this.doc = this.win.document;

		// find target element
		this.currentPinSelector = this.options.targetSelector;
		this.targetNode = WebTag.StickySelector.getElement(this.doc, this.currentPinSelector);

		// create pin body
		this.pinBlock = this.doc.createElement('webtagpin');
		this.pinBlock.style.backgroundImage = 'url(' + this.options.pinImageSRC + ')';
		this.pinBlock.style.position = 'absolute';
		this.pinBlock.style.display = 'block';
		this.pinBlock.style.zIndex = 65000;
		this.pinBlock.style.left = '-9999px';
		this.doc.body.appendChild(this.pinBlock);
		this.reposition();

		// detect pin size
		var tmpImage = new Image();
		tmpImage.onload = function() {
			var clearHandler = function() {
				self.pinBlock.style.width = self.pinImageWidth + 'px';
				self.pinBlock.style.height = self.pinImageHeight + 'px';
				tmpImage = tmpImage.onload = null;
			};

			if(tmpImage.width) {
				// w3c browsers
				self.pinImageWidth = tmpImage.width;
				self.pinImageHeight = tmpImage.height;
				clearHandler();
			} else {
				// IE11 svg dimensions fix
				document.body.appendChild(tmpImage);
				setTimeout(function() {
					self.pinImageWidth = tmpImage.offsetWidth;
					self.pinImageHeight = tmpImage.offsetHeight;
					document.body.removeChild(tmpImage);
					clearHandler();
				}, 1);
			}
		};
		tmpImage.src = this.options.pinImageSRC;
	},
	reposition: function() {
		// do nothing if no target element specified
		if(!this.targetNode || this.isFrozen) {
			return;
		}

		// calculate offsets
		var calcOffsetX, calcOffsetY,
			targetNodeOffset = WebTag.Utils.getOffset(this.targetNode),
			targetNodeWidth = this.targetNode.offsetWidth,
			targetNodeHeight = this.targetNode.offsetHeight;

		// calculate offset
		calcOffsetX = targetNodeOffset.left + targetNodeWidth * this.options.relativePositionX - this.options.pinInnerOffsetX;
		calcOffsetY = targetNodeOffset.top + targetNodeHeight * this.options.relativePositionY - this.options.pinInnerOffsetY;

		// clip pin if placed outside of the page
		if(calcOffsetX + this.pinImageWidth > this.options.pageWidth) {
			this.pinBlock.style.width = this.pinImageWidth - (calcOffsetX + this.pinImageWidth - this.options.pageWidth) + 'px';
		} else {
			this.pinBlock.style.width = this.pinImageWidth + 'px';
		}

		// apply calculated styles
		this.pinBlock.style.left = calcOffsetX + 'px';
		this.pinBlock.style.top = calcOffsetY + 'px';
		return this;
	},
	getPinBody: function() {
		return this.pinBlock;
	},
	getTargetNode: function() {
		return this.targetNode;
	},
	getState: function() {
		return {
			targetSelector: this.currentPinSelector,
			relativePositionX: this.options.relativePositionX,
			relativePositionY: this.options.relativePositionY
		};
	},
	setIndex: function(index) {
		if(!this.pinIndexBlock) {
			this.pinIndexBlock = document.createElement('div');
			this.pinIndexBlock.setAttribute('data-webtag-pinindex', '');
			this.pinBlock.appendChild(this.pinIndexBlock);
		}
		this.pinIndexBlock.innerHTML = index + 1;
	},
	setPageSize: function(pageWidth, pageHeight) {
		// save current page dimensions
		this.options.pageWidth = pageWidth || Infinity;
		this.options.pageHeight = pageHeight || Infinity;
		return this;
	},
	setPinData: function(data) {
		// save current pin data
		this.pinBlock.title = data.targetSelector;

		this.currentPinSelector = data.targetSelector;
		this.targetNode = WebTag.StickySelector.getElement(this.doc, this.currentPinSelector);
		this.options.relativePositionX = data.relativePositionX;
		this.options.relativePositionY = data.relativePositionY;
		return this;
	},
	isTargetNodeVisible: function() {
		return this.targetNode && !!this.targetNode.offsetHeight;
	},
	hide: function() {
		if(!this.isFrozen) {
			this.pinBlock.style.display = 'none';
		}
		return this;
	},
	show: function() {
		if(!this.isFrozen) {
			this.pinBlock.style.display = 'block';
		}
		return this;
	},
	freeze: function() {
		this.isFrozen = true;
		return this;
	},
	unfreeze: function() {
		this.isFrozen = false;
		return this;
	},
	destroy: function() {
		this.pinBlock.parentNode.removeChild(this.pinBlock);
		this.makeCallback('destroy', this);
	},
	makeCallback: function(eventName, eventData) {
		var capitalizedEventName = eventName.charAt(0).toUpperCase() + eventName.slice(1),
			optionsHandler = this.options['on' + capitalizedEventName];

		if(optionsHandler) {
			optionsHandler.call(this, eventData);
		}
	}
};

/*
 * WebTag - MetaEditBlock module
 */
WebTag.MetaEditBlock = function(options) {
	this.options = WebTag.Utils.extend({
		holder: null,
		meta: null
	}, options);
	this.init();
};
WebTag.MetaEditBlock.prototype = {
	init: function() {
		this.holder = this.options.holder;
		this.create();
	},
	create: function() {
		var self = this;
		this.editBlock = document.createElement('div');
		this.editBlock.setAttribute('data-webtag-editblock', '');

		this.holder.appendChild(this.editBlock);
		if(WebTag.Hooks.createEditBlock) {
			WebTag.Hooks.createEditBlock.call(this, this.editBlock, !!self.options.meta, function() {
				if(self.options.meta) {
					self.deserialize(self.options.meta);
				}
			});
		}
	},
	serialize: function() {
		if(WebTag.Hooks.serializeEditBlock) {
			return WebTag.Hooks.serializeEditBlock.call(this, this.editBlock);
		}
	},
	deserialize: function(metaData) {
		if(WebTag.Hooks.deserializeEditBlock) {
			WebTag.Hooks.deserializeEditBlock.call(this, this.editBlock, metaData);
		}
	},
	destroy: function() {
		if(WebTag.Hooks.destroyEditBlock) {
			WebTag.Hooks.destroyEditBlock.call(this, this.editBlock);
		}
		if(this.editBlock.parentNode) {
			this.editBlock.parentNode.removeChild(this.editBlock);
		}
	},
	makeCallback: function(eventName, eventData) {
		var capitalizedEventName = eventName.charAt(0).toUpperCase() + eventName.slice(1),
			optionsHandler = this.options['on' + capitalizedEventName];

		if(optionsHandler) {
			optionsHandler.call(this, eventData);
		}
	},
	setIndex: function(index) {
		if(WebTag.Hooks.setEditBlockIndex) {
			WebTag.Hooks.setEditBlockIndex.call(this, this.editBlock, index);
		}
	}
};

/*
 * WebTag - Draggable module
 */
WebTag.Draggable = function(options) {
	this.options = WebTag.Utils.extend({
		dragActiveAttribute: 'webtag-framedrag-active',
		pinInnerOffsetX: 0,
		pinInnerOffsetY: 0,
		pin: null,
		frame: null
	}, options);
	this.init();
};
WebTag.Draggable.prototype = {
	init: function() {
		this.initStructure();
		this.attachEvents();
	},
	initStructure: function() {
		this.injectedPins = [];
		this.pin = this.options.pin;
		this.frame = this.options.frame;
		this.page = document.documentElement;

		// wrap frame
		this.frameWrapper = document.createElement('div');
		this.frameWrapper.setAttribute('webtag-draggable-wrapper', '');
		this.frame.parentNode.insertBefore(this.frameWrapper, this.frame);
		this.frameWrapper.appendChild(this.frame);
		this.frameWrapper.style.position = 'relative';
	},
	attachEvents: function() {
		// bind handlers to current draggable instance
		WebTag.Utils.bindHandlers(['dragStartOuter', 'dragMoveOuter', 'dragEndOuter'], this);
		WebTag.Utils.bindHandlers(['dragStartFrame', 'dragMoveFrame', 'dragEndFrame', 'dragOverFrameNode'], this);

		// attach drag start event
		this.pin.addEventListener('mousedown', this.dragStartOuter);
	},
	injectFrameHandlers: function() {
		// inject drag event handlers in preview frame
		this.frameContentWindow = this.frame.contentWindow;
		this.frameContentDocument = this.frameContentWindow.document;

		// add stylesheet
		if(!this.frameContentWindow.WebTagActive) {
			this.frameContentWindow.WebTagActive = true;
		}

		// add drag event listeners
		this.frameContentDocument.documentElement.setAttribute(this.options.dragActiveAttribute, '');
		this.frameContentDocument.documentElement.addEventListener('mouseover', this.dragOverFrameNode);
		this.frameContentDocument.documentElement.addEventListener('mousemove', this.dragMoveFrame);
		this.frameContentDocument.documentElement.addEventListener('mouseup', this.dragEndFrame);
	},
	removeFrameHandlers: function() {
		// remove temporary event handlers
		this.frameContentDocument.documentElement.removeAttribute(this.options.dragActiveAttribute);
		this.frameContentDocument.documentElement.removeEventListener('mouseover', this.dragOverFrameNode);
		this.frameContentDocument.documentElement.removeEventListener('mousemove', this.dragMoveFrame);
		this.frameContentDocument.documentElement.removeEventListener('mouseup', this.dragEndFrame);
	},
	createVisualHelper: function() {
		// visual drag helper
		var helper = this.pin.cloneNode(true);
		helper.style.cssText = 'position:absolute;pointer-events:none;left:-9999px;top:-9999px;';
		document.body.appendChild(helper);
		return helper;
	},
	makePinDraggable: function(pinInstance) {
		var self = this,
			pinBody = pinInstance.getPinBody();

		this.injectedPins.push(pinInstance);
		pinBody.addEventListener('mousedown', function(e) {
			var isDragHandle = e.target === pinBody || (e.target.parentNode === pinBody && !e.target.children.length);
			if(isDragHandle) {
				self.dragStartFrame(e, pinInstance);
			}
		});
	},
	showScrollbarOverlay: function() {
		// measure scroll size
		var scrollSize = this.frameContentWindow.innerWidth - this.frameContentDocument.documentElement.offsetWidth,
			pageDirection = this.frameContentWindow.getComputedStyle(this.frameContentDocument.body, null).direction;

		// create elements
		if(scrollSize > 0) {
			this.vScrollOverlay = document.createElement('div');
			this.hScrollOverlay = document.createElement('div');

			this.vScrollOverlay.style.cssText = 'position:absolute;top:0;bottom:0;width:'+scrollSize+'px;' + (pageDirection === 'rtl' ? 'left:0' : 'right:0');
			this.hScrollOverlay.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:'+scrollSize+'px;';
			
			this.frameWrapper.appendChild(this.vScrollOverlay);
			this.frameWrapper.appendChild(this.hScrollOverlay);
		}
	},
	hideScrollbarOverlay: function() {
		// remove overlays from iframe scrollbars
		if(this.vScrollOverlay) {
			this.vScrollOverlay.parentNode.removeChild(this.vScrollOverlay);
			this.hScrollOverlay.parentNode.removeChild(this.hScrollOverlay);
			this.vScrollOverlay = this.hScrollOverlay = null;
		}
	},
	dragStartOuter: function(e) {
		// ignore right click
		if(e.button) {
			return;
		} else {
			e.preventDefault();
		}

		// calculate inner pin offset
		this.draggingTarget = true;
		this.dragVisualHelper = this.createVisualHelper();
		this.frameOffset = WebTag.Utils.getOffset(this.frame);

		// inject handlers if needed and attach temporary event handlers
		this.injectFrameHandlers();
		this.showScrollbarOverlay();
		this.page.addEventListener('mousemove', this.dragMoveOuter);
		this.page.addEventListener('mouseup', this.dragEndOuter);
		this.makeCallback('dragStart');
	},
	dragMoveOuter: function(e) {
		e.preventDefault();
		if(this.draggingTarget) {
			if(this.currentDragTarget) {
				this.currentDragTarget.removeAttribute('data-webtag-highlight');
			}
			this.dragVisualHelper.style.left = e.pageX - this.options.pinInnerOffsetX + 'px';
			this.dragVisualHelper.style.top = e.pageY - this.options.pinInnerOffsetY + 'px';
		}
	},
	dragEndOuter: function(e) {
		if(this.draggingTarget) {
			this.draggingTarget = false;
			this.dragVisualHelper.parentNode.removeChild(this.dragVisualHelper);
			this.page.removeEventListener('mousemove', this.dragMoveOuter, false);
			this.page.removeEventListener('mouseup', this.dragEndOuter, false);
			this.hideScrollbarOverlay();
			this.removeFrameHandlers();
			this.removeHighlighting();

			// if pin moved outside from frame - destroy it
			if(this.draggingPinInstance) {
				this.draggingPinInstance.destroy();
				this.makeCallback('removePin', this.draggingPinInstance);
				this.draggingPinInstance = null;
			}

			// clear current and prev drag targets
			this.prevDragTarget = this.currentDragTarget = null;
			this.makeCallback('dragEnd');
		}
	},
	dragStartFrame: function(e, pinInstance) {
		// ignore right click
		if(e.button) {
			return;
		} else {
			e.preventDefault();
		}

		// drag already existing pin
		this.draggingTarget = true;
		this.draggingPinInstance = pinInstance;
		this.dragVisualHelper = this.createVisualHelper();
		this.currentDragTarget = pinInstance.getTargetNode();

		// calculate frame offset and add temporary event handlers
		this.frameOffset = WebTag.Utils.getOffset(this.frame);
		this.page.addEventListener('mousemove', this.dragMoveOuter);
		this.page.addEventListener('mouseup', this.dragEndOuter);
		this.injectFrameHandlers();
		this.showScrollbarOverlay();
	},
	dragMoveFrame: function(e) {
		if(this.draggingTarget) {
			// hide original pin on drag start
			if(this.draggingPinInstance) {
				this.movePerformed = true;
				this.draggingPinInstance.hide().freeze();
			}

			// move helper
			if(this.dragVisualHelper) {
				this.dragVisualHelper.style.left = this.frameOffset.left - this.frameContentWindow.pageXOffset + e.pageX - this.options.pinInnerOffsetX + 'px';
				this.dragVisualHelper.style.top = this.frameOffset.top  - this.frameContentWindow.pageYOffset + e.pageY - this.options.pinInnerOffsetY + 'px';
			}
		}
	},
	dragEndFrame: function(e) {
		if(this.draggingTarget) {
			// skip plain click on node
			if(this.draggingPinInstance && !this.movePerformed) {
				this.page.removeEventListener('mousemove', this.dragMoveOuter);
				this.page.removeEventListener('mouseup', this.dragEndOuter);
				this.removeFrameHandlers();
				this.hideScrollbarOverlay();
				this.draggingTarget = false;
				return;
			} else {
				this.movePerformed = false;
			}

			// calculate offsets
			var targetNodeOffset = WebTag.Utils.getOffset(this.currentDragTarget),
				targetNodeWidth = this.currentDragTarget.offsetWidth || 1,
				targetNodeHeight = this.currentDragTarget.offsetHeight || 1;

			// calculate pin data
			var pinData = {
				targetSelector: WebTag.StickySelector.getSelector(this.currentDragTarget),
				relativePositionX: (e.pageX - targetNodeOffset.left) / targetNodeWidth,
				relativePositionY: (e.pageY - targetNodeOffset.top) / targetNodeHeight
			};

			if(this.draggingPinInstance) {
				// modify position and target block of existing pin
				this.draggingPinInstance.unfreeze().setPinData(pinData).show();
				this.makeCallback('repositionPin', this.draggingPinInstance);
				this.draggingPinInstance = null;
			} else {
				// add new pin
				this.makeCallback('dragComplete', pinData);
			}

			// stop dragging and fire event to parent class
			this.removeHighlighting(this.currentDragTarget);
			this.dragEndOuter(e);
		}
	},
	dragOverFrameNode: function(e) {
		if(this.draggingTarget) {
			this.currentDragTarget = WebTag.StickySelector.getDragTarget(e.target);

			// highlight area
			if(this.prevDragTarget !== this.currentDragTarget) {
				if(this.prevDragTarget) {
					this.removeHighlighting(this.prevDragTarget);
				}
				this.highlightNode(this.currentDragTarget);
				this.prevDragTarget = this.currentDragTarget;
			}
		}
	},
	highlightNode: function(node) {
		// create highlighter block
		if(!node.ownerDocument.getElementById('webtag-drag-highlighter')) {
			this.visualHightlighter = node.ownerDocument.createElement('webtaghighlight');
			this.visualHightlighter.setAttribute('webtag-drag-highlighter', '');
			this.visualHightlighter.id = 'webtag-drag-highlighter';
			this.visualHightlighter.style.position = 'absolute';
			this.visualHightlighter.style.pointerEvents = 'none';
		}

		// resize highlighter
		var nodeOffset = WebTag.Utils.getOffset(node);
		this.visualHightlighter.style.top = nodeOffset.top + 'px';
		this.visualHightlighter.style.left = nodeOffset.left + 'px';
		this.visualHightlighter.style.width = node.offsetWidth + 'px';
		this.visualHightlighter.style.height = node.offsetHeight + 'px';
		node.ownerDocument.body.appendChild(this.visualHightlighter);

		// add style attribute to support css styling
		node.setAttribute('data-webtag-highlight', '');
	},
	removeHighlighting: function(node) {
		if(this.visualHightlighter && this.visualHightlighter.parentNode) {
			this.visualHightlighter.parentNode.removeChild(this.visualHightlighter);
		}
		if(node) {
			node.removeAttribute('data-webtag-highlight');
		}
	},
	makeCallback: function(eventName, eventData) {
		var capitalizedEventName = eventName.charAt(0).toUpperCase() + eventName.slice(1),
			optionsHandler = this.options['on' + capitalizedEventName];

		if(optionsHandler) {
			optionsHandler.call(this, eventData);
		}
	}
};

/*
 * WebTag - global event hooks
 */
WebTag.Hooks = {
	
};

/*
 * WebTag - global localisation
 */
WebTag.Localization = {
	
};

/*
 * WebTag - helper functions
 */
WebTag.Utils = {
	ajax: function(options) {
		var xhr = new XMLHttpRequest(),
			dataStr = '';

		options = WebTag.Utils.extend({
			url:'',
			type:'GET',
			data:'',
			async: true,
			success:null,
			error:null
		}, options);
		options.type = options.type.toUpperCase();

		if(options.type === 'GET') {
			if(options.data) {
				dataStr = (options.url.indexOf('?') < 0 ? '?' : '&') + options.data;
			}
			xhr.open(options.type, options.url + dataStr, options.async);
		} else {
			xhr.open(options.type, options.url, options.async);
			xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		}

		xhr.onreadystatechange = function() {
			if(xhr.readyState === 4) {
				if(typeof options.success === 'function') {
					options.success.call(xhr, xhr.responseText, xhr);
				}
			}
		};

		xhr.send(options.type === 'GET' ? null : options.data);
		return xhr;
	},
	extend: function(obj) {
		for(var i = 1; i < arguments.length; i++) {
			for(var p in arguments[i]) {
				if(arguments[i].hasOwnProperty(p)) {
					obj[p] = arguments[i][p];
				}
			}
		}
		return obj;
	},
	bindHandlers: function(handlerNames, obj) {
		// force scope for event handlers
		var bindScope = function(func) {
			return function() {
				func.apply(obj, arguments);
			};
		};

		for(var i = 0, currentHandlerName, currentHandler; i < handlerNames.length; i++) {
			currentHandlerName = handlerNames[i];
			currentHandler = obj[currentHandlerName];
			if(currentHandler) {
				obj[currentHandlerName] = bindScope(currentHandler);
			}
		}
	},
	getOffset: function(element) {
		// allow calculation from frame
		var doc = element.ownerDocument,
			win = doc.defaultView;

		// calculate element offset
		var scrollLeft = win.pageXOffset || doc.documentElement.scrollLeft || doc.body.scrollLeft;
		var scrollTop = win.pageYOffset || doc.documentElement.scrollTop || doc.body.scrollTop;
		var clientLeft = doc.documentElement.clientLeft || doc.body.clientLeft || 0;
		var clientTop = doc.documentElement.clientTop || doc.body.clientTop || 0;
		return {
			top: Math.round(element.getBoundingClientRect().top + scrollTop - clientTop),
			left: Math.round(element.getBoundingClientRect().left + scrollLeft - clientLeft)
		};
	}
};

/*
 * WebTag - Sticky selector module
 */
WebTag.StickySelector = {
	skipClasses: [
		'wrap',
		'mask',
		'slideset',
		'active',
		'hover',
		'holder',
		'hold',
		'wrapper',
		'container',
		'js-slide-hidden',
		'hidden',
		'w1',
		'w2'
	],
	ignoreClasses: [
		'gallery-js-ready',
		'active'
	],
	skipId: [
		'main',
		'wrapper'
	],
	needSkipById: function(node) {
		return !node.id || this.skipId.indexOf(node.id) > -1;
	},
	needSkipByClass: function(node) {
		if(node.className) {
			for(var tmpClassList = node.classList, i = tmpClassList.length - 1; i >= 0; i--) {
				if(this.skipClasses.indexOf(tmpClassList[i]) > -1) {
					return true;
				}
			}
		} else {
			return true;
		}
	},
	needSkipNode: function(node) {
		return needSkipById(node) || needSkipByClass(node);
	},
	printSelector: function(node) {
		if(node.id) {
			return '#' + node.id;
		} else if(node.className) {
			if(node.classList.length > 1) {
				for(var i = 0, classList = [], currentClass; i < node.classList.length; i++) {
					currentClass = node.classList[i];
					if(this.ignoreClasses.indexOf(currentClass) < 0) {
						classList.push(currentClass);
					}	
				}
				return '.' + classList.join('.');
			} else {
				return '.' + node.className;
			}
		} else {
			return null;
		}
	},
	getUniqueAncestor: function(node) {
		var tmpNode = node,
			tmpClasses = '',
			ownerDoc = node.ownerDocument;

		// detect ancestor with id
		while(tmpNode.parentNode && tmpNode.parentNode !== ownerDoc.documentElement) {
			tmpNode = tmpNode.parentNode;
			if(!this.needSkipById(tmpNode)) {
				return tmpNode;
			}
		}

		// detect ancestor with unique classList
		tmpNode = node;
		while(tmpNode.parentNode && tmpNode.parentNode !== ownerDoc.documentElement) {
			tmpNode = tmpNode.parentNode;
			tmpClasses = tmpNode.className ? Array.prototype.slice.call(tmpNode.classList, 0) : '';
			if(tmpClasses && !this.needSkipByClass(tmpNode) && ownerDoc.querySelectorAll('.' + tmpClasses.join('.')).length === 1) {
				return tmpNode;
			}
		}

		// otherwise return root element
		return null;
	},
	getDragTarget: function(targetNode) {
		// detect which target is better to attach
		var i, matchFlag, tmpClassList, uniqueAnsector;
		while(targetNode) {
			// skip small nodes
			if(targetNode.offsetHeight < 10) {
				targetNode = targetNode.parentNode;
				continue;
			}

			// return node id
			if(targetNode.id) {
				break;
			}

			tmpClassList = targetNode.classList;
			if(tmpClassList.length) {
				// try to find reliable class name
				for(i = tmpClassList.length - 1, matchFlag = false; i >= 0; i--) {
					if(this.skipClasses.indexOf(tmpClassList[i]) > -1) {
						matchFlag = true;
						break;
					}
				}

				// skip repeated elements
				if(!matchFlag) {					
					uniqueAnsector = this.getUniqueAncestor(targetNode) || targetNode.ownerDocument;
					if(uniqueAnsector.querySelectorAll('.' + targetNode.classList[0]).length === 1) {
						break;
					}
				}
			}

			// no success! try the same with parent node
			if(targetNode.parentNode && targetNode.parentNode.tagName) {
				targetNode = targetNode.parentNode;
			} else {
				break;
			}
		}
		return targetNode;
	},
	getSelector: function(element) {
		// generate optimal css selector for element
		if(element.id) {
			// if element has ID simply return its ID
			return '#' + element.id;
		} else if(element.className) {
			// generate simple nested selector
			var uniqueAnsector = this.getUniqueAncestor(element);
			if(uniqueAnsector) {
				return this.printSelector(uniqueAnsector) + ' ' + this.printSelector(element);
			} else {
				return this.printSelector(element);
			}
		}
	},
	getElement: function(document, selector) {
		// find element or its by selector
		return document.querySelector(selector);
	}
};