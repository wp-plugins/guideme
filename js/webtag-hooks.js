// custom hooks for WebTag 
WebTag.Utils.extend(WebTag.Hooks, {
	initAdminPanel: function(editorInstance) {
		// handle update button
		jQuery('#publish_link').click(function(e) {
			editorInstance.savePinData(function(){
				jQuery('#publish').click();
			});
			e.preventDefault();
		});		
		jQuery('#publish_em').click(function(e) {
			editorInstance.savePinData(function(){
				jQuery('#post').submit();
			});
			e.preventDefault();
		});		
	},
	createEditBlock: function(container, isLoading, callback) {
		// create inner drop
		var self = this;
		self.expandedClass = 'webtag-edit-expanded';
		var innerContainer = document.createElement('div');
		innerContainer.className = 'webtag-edit-drop';
		innerContainer.innerHTML = '<input class="webtag-box-title" /><textarea></textarea><br>';
		innerContainer.innerHTML += '<button class="button button-primary button-large webtag-btn-save">'+ WebTag.Localization.btnSave.text +'</button>';
		innerContainer.innerHTML += '<button class="webtag-btn-delete">'+ WebTag.Localization.btnDelete.text +'</button>';
		container.appendChild(innerContainer);

		// initialize WYSIWYG
		var textarea = innerContainer.querySelector('textarea');
		if(window.tinymce) {
			if(!WebTag.uid) {
				WebTag.uid = Date.now();
			}
			textarea.id = 'tinyarea' + WebTag.uid;
			WebTag.uid++;

			tinymce.init({
				menubar: false,
				statusbar: false,
				plugins: 'wordpress,wplink',
				toolbar: 'bold italic | bullist numlist link',
				selector: '#' + textarea.id,
				convert_urls:false
			});
		}

		// create header for index box
		var headerBox = document.createElement('div');
		headerBox.className = 'webtag-title-wrapper';
		container.insertBefore(headerBox, container.childNodes[0]);

		// create pin index block
		var pinIndexBlock = document.createElement('strong');
		pinIndexBlock.className = 'webtag-pin-edit-index';
		headerBox.appendChild(pinIndexBlock);

		// create block title duplicate
		var captionInput = jQuery('.webtag-box-title', innerContainer);
		var captionBlock = jQuery('<span class="webtag-meta-block-title"></span>').appendTo(headerBox);
		var defaultCaptionText = WebTag.Localization.pinDefaultName ? WebTag.Localization.pinDefaultName.text : '';
		captionInput.val(defaultCaptionText);
		captionBlock.text(defaultCaptionText);
		captionInput.on('change keyup', function() {
			captionBlock.text(captionInput.val());
		});

		// handle save button
		innerContainer.querySelector('.webtag-btn-save').onclick = function(e) {
			e.preventDefault();
			self.makeCallback('editorRequestSave', function(){
				// refresh popup html
				var viewBlock = WebTag.Hooks.createViewBlock(self.options.pinInstance.pinBody, self.options.pinInstance.metaEditor.serialize()),
					isEmptyView = viewBlock.classList.contains('webtag-info-popup-empty');
				
				self.options.pinInstance.popupBody.classList.toggle('webtag-info-popup-empty', isEmptyView);
				self.options.pinInstance.popupBody.innerHTML = viewBlock.innerHTML;
			});
		};

		// handle delete button
		innerContainer.querySelector('.webtag-btn-delete').onclick = function(e) {
			e.preventDefault();
			self.makeCallback('editorRequestDelete');
			if(self.options.pinInstance.win.WebTag.viewerInstance && self.options.pinInstance.win.WebTag.viewerInstance.getPins){
				if(self.btnToggleAll && !self.options.pinInstance.win.WebTag.viewerInstance.getPins().length){
					self.btnToggleAll.parentNode.removeChild(self.btnToggleAll);
				}
			}
		};

		// create expand/all button if not created
		this.btnToggleAll = document.getElementById('webtag-toggle-all');
		if(!this.btnToggleAll) {
			this.btnToggleAll = document.createElement('a');
			this.btnToggleAll.innerHTML = WebTag.Localization.btnToggleAll.text;
			this.btnToggleAll.id = 'webtag-toggle-all';
			this.btnToggleAll.onclick = function() {
				self.btnToggleAll.classList.toggle('exp-active');
				var drops = container.parentNode.querySelectorAll('.webtag-edit-drop');
				var isExpanding = self.btnToggleAll.classList.contains('exp-active');

				for(var i = 0, currentEditableBlock; i < drops.length; i++) {
					currentEditableBlock = drops[i].parentNode;
					currentEditableBlock.classList.toggle(self.expandedClass, isExpanding);
				}
			};
			container.parentNode.insertBefore(this.btnToggleAll, container);
		}

		// hide all active edit blocks
		var collapseAllEditBlocks = function() {
			var drops = container.parentNode.querySelectorAll('.webtag-edit-drop');
			for(var i = 0, currentEditableBlock; i < drops.length; i++) {
				currentEditableBlock = drops[i].parentNode;
				currentEditableBlock.classList.remove(self.expandedClass);
			}
		};

		// expand new block and set focus in textarea
		if(!isLoading && textarea && window.tinymce) {
			collapseAllEditBlocks();
			container.classList.add(self.expandedClass);
			tinymce.get(textarea.id).focus();
		}

		// handle open-close
		this.btnToggle = document.createElement('a');
		this.btnToggle.className = 'webtag-btn-edit';
		this.btnToggle.innerHTML = WebTag.Localization.editButton.closeText;
		headerBox.appendChild(this.btnToggle);

		headerBox.onclick = function(e) {
			e.preventDefault();
			self.options.pinInstance.pinBlock.classList.remove('webtag-pin-active');
			setTimeout(function(){
				self.options.pinInstance.pinBlock.classList.add('webtag-pin-active');
			}, 1);
		};

		pinIndexBlock.onclick = function(e) {
			e.preventDefault();
			e.stopPropagation();
			if(!container.classList.contains(self.expandedClass)) {
				WebTag.Hooks.setState.call(self, container, true);
			} else {
				WebTag.Hooks.setState.call(self, container, false);
			}
		};

		this.btnToggle.onclick = function(e) {
			e.preventDefault();
			e.stopPropagation();
			if(!container.classList.contains(self.expandedClass)) {
				WebTag.Hooks.setState.call(self, container, true);
			} else {
				WebTag.Hooks.setState.call(self, container, false);
			}
		};

		this.options.pinInstance.pinBlock.onmousedown = function(e){
			WebTag.Hooks.setState.call(self, container, true);
		};

		// make callback when ready
		callback();
	},
	setState: function(container, state){
		if(state){
			this.btnToggle.innerHTML = WebTag.Localization.editButton.openText;
			container.classList.add(this.expandedClass);
			this.makeCallback('editorRequestActivatePin');
		}
		else {
			this.btnToggle.innerHTML = WebTag.Localization.editButton.closeText;
			container.classList.remove(this.expandedClass);
			this.makeCallback('editorRequestDeactivatePin');
		}
	},
	setEditBlockIndex: function(container, index) {
		var indexBlock = container.querySelector('.webtag-pin-edit-index');
		if(indexBlock) {
			indexBlock.innerHTML = index + 1;
		}
	},
	serializeEditBlock: function(container) {
		var textarea = container.querySelector('textarea');
		return {
			input: container.querySelector('.webtag-box-title').value,
			textarea: window.tinymce ? tinymce.get(textarea.id).getContent() : textarea.value
		};
	},
	deserializeEditBlock: function(container, metaData) {
		var input = container.querySelector('.webtag-box-title'),
			caption = container.querySelector('.webtag-meta-block-title'),
			textarea = container.querySelector('textarea');

		input.value = metaData.input;
		caption.innerHTML = metaData.input.replace(/&/g, '&amp;')
										.replace(/"/g, '&quot;')
										.replace(/'/g, '&#39;')
										.replace(/</g, '&lt;')
										.replace(/>/g, '&gt;');

		if(window.tinymce) {
			tinymce.get(textarea.id).setContent(metaData.textarea);
		} else {
			textarea.value = metaData.textarea;
		}
	},
	destroyEditBlock: function(container) {
		if(window.tinymce) {
			var textarea = container.querySelector('textarea');
			tinymce.get(textarea.id).destroy();
		}
		container.innerHTML = '';
	},
	createViewBlock: function(container, metaData) {
		var popup = document.createElement('div');
		popup.setAttribute('webtag-info-popup', '');
		if(metaData) {
			popup.innerHTML += '<span class="webtag-info-triangle"></span>';
			popup.innerHTML += '<div>' + metaData.textarea + '</div>';
		}
		if(!metaData || !metaData.textarea) {
			popup.classList.add('webtag-info-popup-empty');
		}
		return popup;
	}
});

// admin panel hooks
(function(window, jQuery){
	if(!jQuery) return;
	jQuery(function(){
		initTypeSelects();
		initSelectPage();
	});
	
	function initTypeSelects() {
		var holder = jQuery('[data-webtag] .data_column'),
			typeSelect = holder.find('>select:eq(0)'),
			dropSelects = holder.find('.pages_lists > *'),
			pinBlock = holder.find('.pin_description').hide();

		dropSelects.find('select').on('change', function() {
			if(this.value) {
				pinBlock.show();
			} else {
				pinBlock.hide();
			}
		});

		var refreshDisplay = function() {
			var newSelect = dropSelects.hide().filter('#' + typeSelect.val()).show();
			if(newSelect.length && newSelect.find('select').val()) {
				pinBlock.show();
			} else {
				pinBlock.hide();
				if(window.WebTag && WebTag.editorInstance) {
					WebTag.editorInstance.loadInPreview('');
				}
			}
		};

		refreshDisplay();
		typeSelect.on('change', refreshDisplay);
	}

	function initSelectPage(){
		jQuery('#em_selest_page').toggle(function(){
			jQuery('.pages_lists').show();
			jQuery('#em_selest_page').text('close');
			return false;
		},
		function(){
			jQuery('#em_selest_page').text('edit');
			jQuery('.pages_lists').hide();
		});
	}
})(window, window.jQuery);

// classlist polyfill
(function () {

if (typeof window.Element === "undefined" || "classList" in document.documentElement) return;

var prototype = Array.prototype,
    push = prototype.push,
    splice = prototype.splice,
    join = prototype.join;

function DOMTokenList(el) {
  this.el = el;
  // The className needs to be trimmed and split on whitespace
  // to retrieve a list of classes.
  var classes = el.className.replace(/^\s+|\s+$/g,'').split(/\s+/);
  for (var i = 0; i < classes.length; i++) {
    push.call(this, classes[i]);
  }
};

DOMTokenList.prototype = {
  add: function(token) {
    if(this.contains(token)) return;
    push.call(this, token);
    this.el.className = this.toString();
  },
  contains: function(token) {
    return this.el.className.indexOf(token) != -1;
  },
  item: function(index) {
    return this[index] || null;
  },
  remove: function(token) {
    if (!this.contains(token)) return;
    for (var i = 0; i < this.length; i++) {
      if (this[i] == token) break;
    }
    splice.call(this, i, 1);
    this.el.className = this.toString();
  },
  toString: function() {
    return join.call(this, ' ');
  },
  toggle: function(token) {
    if (!this.contains(token)) {
      this.add(token);
    } else {
      this.remove(token);
    }

    return this.contains(token);
  }
};

window.DOMTokenList = DOMTokenList;

function defineElementGetter (obj, prop, getter) {
    if (Object.defineProperty) {
        Object.defineProperty(obj, prop,{
            get : getter
        });
    } else {
        obj.__defineGetter__(prop, getter);
    }
}

defineElementGetter(Element.prototype, 'classList', function () {
  return new DOMTokenList(this);
});

})();