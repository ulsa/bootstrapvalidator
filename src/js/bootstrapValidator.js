/**
 * BootstrapValidator (https://github.com/nghuuphuoc/bootstrapvalidator)
 *
 * A jQuery plugin to validate form fields. Use with Bootstrap 3
 *
 * @author      http://twitter.com/nghuuphuoc
 * @copyright   (c) 2013 - 2014 Nguyen Huu Phuoc
 * @license     MIT
 */

(function($) {
    var BootstrapValidator = function(form, options) {
        this.$form   = $(form);
        this.options = $.extend({}, BootstrapValidator.DEFAULT_OPTIONS, options);

        // Array of deferred
        this._dfds   = {};

        // First invalid field
        this._firstInvalidField = null;

        // Validating results
        this._results = {};

        this._init();
    };

    // The default options
    BootstrapValidator.DEFAULT_OPTIONS = {
        // The form CSS class
        elementClass: 'bootstrap-validator-form',

        // Default invalid message
        message: 'This value is not valid',

        // The number of grid columns
        // Change it if you use custom grid with different number of columns
        columns: 12,

        // The custom submit handler
        // It will prevent the form from the default submission
        //
        //  submitHandler: function(validator, form) {
        //      - validator is the BootstrapValidator instance
        //      - form is the jQuery object present the current form
        //  }
        submitHandler: null,

        // Live validating option
        // Can be one of 3 values:
        // - enabled: The plugin validates fields as soon as they are changed
        // - disabled: Disable the live validating. The error messages are only shown after the form is submitted
        // - submitted: The live validating is enabled after the form is submitted
        live: 'enabled',

        // Map the field name with validator rules
        fields: null
    };

    BootstrapValidator.prototype = {
        constructor: BootstrapValidator,

        /**
         * Init form
         */
        _init: function() {
            if (this.options.fields == null) {
                return;
            }

            var that = this;
            this.$form
                // Disable client side validation in HTML 5
                .attr('novalidate', 'novalidate')
                .addClass(this.options.elementClass)
                // Disable the default submission first
                .on('submit.bootstrapValidator', function(e) {
                    e.preventDefault();
                    that.validate();
                });

            for (var field in this.options.fields) {
                this._initField(field);
            }

            this._setLiveValidating();
        },

        /**
         * Init field
         *
         * @param {String} field The field name
         */
        _initField: function(field) {
            if (this.options.fields[field] == null || this.options.fields[field].validators == null) {
                return;
            }

            this._dfds[field]    = {};
            this._results[field] = {};

            var fields = this.$form.find('[name="' + field + '"]');

            // We don't need to validate ...
            if (fields.length == 0                                  // ... non-existing fields
                || (fields.length == 1 && fields.is(':disabled')))  // ... disabled field
            {
                delete this.options.fields[field];
                delete this._dfds[field];
                return;
            }

            // Create a help block element for showing the error
            var $field  = $(fields[0]),
                $parent = $field.parents('.form-group'),
                // Calculate the number of columns of the label/field element
                // Then set offset to the help block element
                label, cssClasses, offset, size;

            if (label = $parent.find('label').get(0)) {
                // The default Bootstrap form don't require class for label (http://getbootstrap.com/css/#forms)
                if (cssClasses = $(label).attr('class')) {
                    cssClasses = cssClasses.split(' ');
                    for (var i = 0; i < cssClasses.length; i++) {
                        if (/^col-(xs|sm|md|lg)-\d+$/.test(cssClasses[i])) {
                            offset = cssClasses[i].substr(7);
                            size   = cssClasses[i].substr(4, 2);
                            break;
                        }
                    }
                }
            } else if (cssClasses = $parent.children().eq(0).attr('class')) {
                cssClasses = cssClasses.split(' ');
                for (var i = 0; i < cssClasses.length; i++) {
                    if (/^col-(xs|sm|md|lg)-offset-\d+$/.test(cssClasses[i])) {
                        offset = cssClasses[i].substr(14);
                        size   = cssClasses[i].substr(4, 2);
                        break;
                    }
                }
            }

            if (size && offset) {
                for (var validatorName in this.options.fields[field].validators) {
                    if (!$.fn.bootstrapValidator.validators[validatorName]) {
                        delete this.options.fields[field].validators[validatorName];
                        continue;
                    }

                    this._results[field][validatorName] = null;
                    $('<small/>')
                        .css('display', 'none')
                        .attr('data-bs-validator', validatorName)
                        .addClass('help-block')
                        .addClass(['col-', size, '-offset-', offset].join(''))
                        .addClass(['col-', size, '-', this.options.columns - offset].join(''))
                        .appendTo($parent);
                }
            }
        },

        /**
         * Enable live validating
         */
        _setLiveValidating: function() {
            if ('enabled' == this.options.live) {
                var that = this;
                // Since this should be called once, I have to disable the live validating mode
                this.options.live = 'disabled';

                for (var field in this.options.fields) {
                    (function(f) {
                        var fields = that.getFieldElements(f);
                        if (fields) {
                            var type  = fields.attr('type'),
                                event = ('radio' == type || 'checkbox' == type || 'SELECT' == fields[0].tagName) ? 'change' : 'keyup';

                            fields.on(event, function() {
                                that.validateField(f);
                            });
                        }
                    })(field);
                }
            }
        },

        /**
         * Called when all validations are completed
         */
        _submit: function() {
            if (!this.isValid()) {
                if ('submitted' == this.options.live) {
                    this.options.live = 'enabled';
                    this._setLiveValidating();
                }

                // Focus to the first invalid field
                if (this._firstInvalidField) {
                    this.getFieldElements(this._firstInvalidField).focus();
                }

                return;
            }

            // Call the custom submission if enabled
            if (this.options.submitHandler && 'function' == typeof this.options.submitHandler) {
                this.options.submitHandler.call(this, this, this.$form);
            } else {
                // Submit form
                this.$form.off('submit.bootstrapValidator').submit();
            }
        },

        // --- Public methods ---

        /**
         * Retrieve the field elements by given name
         *
         * @param {String} field The field name
         * @returns {null|jQuery[]}
         */
        getFieldElements: function(field) {
            var fields = this.$form.find('[name="' + field + '"]');
            return (fields.length == 0) ? null : fields;
        },

        /**
         * Validate the form
         */
        validate: function() {
            if (!this.options.fields) {
                return this;
            }
            for (var field in this.options.fields) {
                this.validateField(field);
            }

            this._submit();
            return this;
        },

        /**
         * Validate given field
         *
         * @param {String} field The field name
         */
        validateField: function(field) {
            var that       = this,
                fields     = this.$form.find('[name="' + field + '"]'),
                $field     = $(fields[0]),
                validators = this.options.fields[field].validators,
                validatorName,
                validateResult;
            for (validatorName in validators) {
                if (this._dfds[field][validatorName]) {
                    this._dfds[field][validatorName].reject();
                }

                validateResult = $.fn.bootstrapValidator.validators[validatorName].validate(this, $field, validators[validatorName]);
                if ('object' == typeof validateResult) {
                    this._dfds[field][validatorName] = validateResult;
                    validateResult.done(function(isValid, v) {
                        // v is validator name
                        delete that._dfds[field][v];
                        /*
                        if (isValid) {
                            that._submit();
                        }*/
                    });
                }

                $.when(validateResult).then(function(isValid) {
                    that._results[field][validatorName] = isValid;
                    if (isValid) {
                        that.removeError($field, validatorName);
                    } else {
                        that.showError($field, validatorName);
                    }
                });
            }
        },

        /**
         * Check the form validity
         *
         * @returns {Boolean}
         */
        isValid: function() {
            var field, validatorName;
            for (field in this._results) {
                for (validatorName in this._results[field]) {
                    if (!this._results[field][validatorName]) {
                        this._firstInvalidField = field;
                        return false;
                    }
                }
            }

            return true;
        },

        /**
         * Show field error
         *
         * @param {jQuery} $field The field element
         * @param {String} validatorName
         */
        showError: function($field, validatorName) {
            var field     = $field.attr('name'),
                validator = this.options.fields[field].validators[validatorName],
                message   = validator.message || this.options.message;

            // Add has-error class to parent element
            $field
                .parents('.form-group')
                    .removeClass('has-success')
                    .addClass('has-error')
                    .find('.help-block[data-bs-validator="' + validatorName + '"]')
                        .html(message)
                        .show();
        },

        /**
         * Remove error from given field
         *
         * @param {jQuery} $field The field element
         */
        removeError: function($field, validatorName) {
            $field
                .parents('.form-group')
                    .removeClass('has-error')
                    .addClass('has-success')
                    .find('.help-block[data-bs-validator="' + validatorName + '"]')
                        .hide();
        }
    };

    // Plugin definition
    $.fn.bootstrapValidator = function(options) {
        return this.each(function() {
            var $this = $(this), data = $this.data('bootstrapValidator');
            if (!data) {
                $this.data('bootstrapValidator', (data = new BootstrapValidator(this, options)));
            }
            if ('string' == typeof options) {
                data[options]();
            }
        });
    };

    // Available validators
    $.fn.bootstrapValidator.validators = {};

    $.fn.bootstrapValidator.Constructor = BootstrapValidator;
}(window.jQuery));
