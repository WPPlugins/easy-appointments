;(function ( $, window, document, undefined ) {

    var pluginName = "eaBootstrap",

    defaults = {
        main_selector: '#ea-bootstrap-main',
        main_template: null,
        overview_selector: "#ea-appointments-overview",
        overview_template: null,
        store: {},
        ajaxCount: 0
    };

    // The actual plugin constructor
    function Plugin ( element, options ) {
        this.element = element;
        this.$element = $(element);
        this.settings = $.extend( {}, defaults, options );
        this._defaults = defaults;
        this._name = pluginName;
        this.init();
    }

    $.extend(Plugin.prototype, {
        /**
         * Plugin init
         */
        init: function () {
            var plugin = this;

            plugin.settings.main_template = _.template($(plugin.settings.main_selector).html());

            plugin.settings.overview_template = _.template($(plugin.settings.overview_selector).html());
            this.$element.html(plugin.settings.main_template({settings:ea_settings}));

            // close plugin if something is missing
            if (!this.settingsOk()) {
                return;
            }

            this.$element.find('form').validate();

            // select change event
            this.$element.find('select').not('.custom-field').change(jQuery.proxy( this.getNextOptions, this ));

            jQuery.datepicker.setDefaults( $.datepicker.regional[ea_settings.datepicker] );

            var firstDay = ea_settings.start_of_week;

            // datePicker
            this.$element.find('.date').datepicker({
                onSelect : jQuery.proxy( plugin.dateChange, plugin ),
                dateFormat : 'yy-mm-dd',
                minDate: 0,
                firstDay: firstDay,
                defaultDate: ea_settings.default_date,
                // on month change event
                onChangeMonthYear: function(year, month, widget) {
                    plugin.selectChange(month, year);
                },
                // add class to every field, so we can later find it
                beforeShowDay: function(date) {
                    var month = date.getMonth() + 1;
                    var days = date.getDate();

                    if(month < 10) {
                        month = '0' + month;
                    }

                    if(days < 10) {
                        days = '0' + days;
                    }

                    return [true, date.getFullYear() + '-' + month + '-' + days, ''];
                }
            });

            // hide options with one choice
            this.hideDefault();

            // time is selected
            this.$element.find('.ea-bootstrap').on('click', '.time-value', function(event) {

                event.preventDefault();

                $(this).parent().children().removeClass('selected-time');
                $(this).addClass('selected-time');

                if (ea_settings['pre.reservation'] === '1') {
                    plugin.appSelected.apply(plugin);
                } else {
                    // for booking overview
                    var booking_data = {};

                    booking_data.location = plugin.$element.find('[name="location"] > option:selected').text();
                    booking_data.service = plugin.$element.find('[name="service"] > option:selected').text();
                    booking_data.worker = plugin.$element.find('[name="worker"] > option:selected').text();
                    booking_data.date = plugin.$element.find('.date').datepicker().val();
                    booking_data.time = plugin.$element.find('.selected-time').data('val');
                    booking_data.price = plugin.$element.find('[name="service"] > option:selected').data('price');

                    var format = ea_settings['date_format'] + ' ' + ea_settings['time_format'];
                    booking_data.date_time = moment(booking_data.date + ' ' + booking_data.time, ea_settings['defult_detafime_format']).format(format);

                    // set overview cancel_appointment
                    var overview_content = '';

                    overview_content = plugin.settings.overview_template({data: booking_data, settings: ea_settings});

                    plugin.$element.find('#booking-overview').html(overview_content);

                    plugin.$element.find('#ea-total-amount').on('checkout:done', function( event, checkoutId ) {
                        var paypal_input = plugin.$element.find('#paypal_transaction_id');

                        if (paypal_input.length == 0) {
                            paypal_input = jQuery('<input id="paypal_transaction_id" class="custom-field" name="paypal_transaction_id" type="hidden"/>');
                            plugin.$element.find('.final').append(paypal_input);
                        }

                        paypal_input.val(checkoutId);

                        // make final conformation
                        plugin.singleConformation(event);
                    });

                    // plugin.$element.find('.step').addClass('disabled');
                    plugin.$element.find('.final').removeClass('disabled');

                    plugin.$element.find('.final').find('select,input').first().focus();
                    plugin.scrollToElement(plugin.$element.find('.final'));
                }

                // load custom fields from localStorage
                plugin.loadPreviousFormData(plugin.$element.find('form'));
            });

            // init blur next steps
            this.blurNextSteps(this.$element.find('.step:visible:first'), true);

            if (ea_settings['pre.reservation'] === '1') {
                this.$element.find('.ea-submit').on('click', jQuery.proxy( plugin.finalComformation, plugin ));
            } else {
                this.$element.find('.ea-submit').on('click', jQuery.proxy( plugin.singleConformation, plugin ));
            }

            this.$element.find('.ea-cancel').on('click', jQuery.proxy( plugin.cancelApp, plugin ));
        },
        /**
         * Check if settings are ok
         *
         * @returns {boolean}
         */
        settingsOk: function () {
            var selectOptions = this.$element.find('select').not('.custom-field');
            var errors = $('<div style="border: 1px solid gray; padding: 20px;">');
            var valid = true;

            selectOptions.each(function(index, element) {
                var $el = $(element);
                var options = $el.children('option');

                // <option value="">-</option>
                if (options.length === 1 && options.attr('value') == '') {
                    $(document.createElement('p'))
                        .html('You need to define at least one <strong>' + $el.attr('name') + '</strong>.')
                        .appendTo(errors);

                    valid = false;
                }
            });

            if (!valid) {
                errors.prepend('<h4>East Appointments - Settings validation:</h4>');
                errors.append('<p>There should be at least one Connection.</p>');

                this.$element.html(errors);
            }

            return valid;
        },
        /**
         * If there is only one select option used don't need to choose
         */
        hideDefault: function () {
            var steps = this.$element.find('.step');

            steps.each(function (index, element) {
                var select = $(element).find('select').not('.custom-field');

                if (select.length < 1) {
                    return;
                }

                var options = select.children('option');

                if (options.length !== 1) {
                    return;
                }

                if (options.value !== '') {
                    $(element).hide();
                }
            });
        },
        /**
         * Find all previous options that are selected
         * @param element
         * @returns {{}}
         */
        getPrevousOptions: function (element) {
            var step = element.parents('.step');

            var options = {};

            var data_prev = step.prevAll('.step');

            data_prev.each(function (index, elem) {
                var option = $(elem).find('select,input').first();

                options[$(option).data('c')] = option.val();
            });

            return options;
        },
        /**
         * Get next select option
         */
        getNextOptions: function (event) {
            var current = $(event.target);

            var step = current.closest('.step');

            // blur next options
            this.blurNextSteps(step);

            // nothing selected
            if (current.val() === '') {
                return;
            }

            var options = {};

            options[current.data('c')] = current.val();

            var data_prev = step.prevAll('.step');

            data_prev.each(function (index, elem) {
                var option = $(elem).find('select,input').first();

                options[$(option).data('c')] = option.val();
            });

            // hidden
            this.$element.find('.step:hidden').each(function (index, elem) {
                var option = $(elem).find('select,input').first();

                options[$(option).data('c')] = option.val();
            });

            //only visible step
            var nextStep = step.nextAll('.step:visible:first');

            next = $(nextStep).find('select,input');

            if (next.length === 0) {
                this.blurNextSteps(nextStep);
                //nextStep.removeClass('disabled');
                return;
            }

            options.next = next.data('c');

            this.callServer(options, next);
        },
        /**
         * Standard call for select options (location, service, worker)
         */
        callServer: function (options, next_element) {
            var plugin = this;

            options.action = 'ea_next_step';
            options.check  = ea_settings['check'];

            this.placeLoader(next_element.parent());

            $.get(ea_ajaxurl, options, function (response) {
                next_element.empty();

                // default
                next_element.append('<option value="">-</option>');

                // options
                $.each(response, function (index, element) {
                    var name = element.name;
                    var $option = $('<option value="' + element.id + '">' + name + '</option>');

                    if ('price' in element && ea_settings['price.hide'] !== '1') {
                        // see if currency is before price or now
                        if (ea_settings['currency.before'] == '1') {
                            $option.text(element.name + ' - ' + next_element.data('currency') + element.price);
                        } else {
                            $option.text(element.name + ' - ' + element.price + next_element.data('currency'));
                        }

                        $option.data('price', element.price);
                    }

                    next_element.append($option);
                });

                // enabled
                next_element.closest('.step').removeClass('disabled');

                plugin.removeLoader();

                plugin.scrollToElement(next_element.parent());
            }, 'json')
            .error(function(xhr, status) {

                if (xhr.status === 403) {
                    alert(ea_settings['trans.nonce-expired']);
                }

                if (xhr.status === 500) {
                    alert(ea_settings['trans.internal-error']);
                }

                plugin.removeLoader();
            });
        },
        placeLoader: function ($element) {
            if (++this.settings.ajaxCount !== 1) {
                return;
            }

            var width = $element.width();
            var height = $element.height();
            $('#ea-loader').prependTo($element);
            $('#ea-loader').css({
                'width': width,
                'height': height
            });
            $('#ea-loader').show();
        },
        removeLoader: function () {
            if (--this.settings.ajaxCount > 1) {
                return;
            }

            this.settings.ajaxCount = 0;

            $('#ea-loader').hide();
        },
        getCurrentStatus: function () {
            var options = $(this.element).find('select').not('.custom-field');
        },
        blurNextSteps: function (current, dontScroll) {
            // check if there is scroll param
            dontScroll = dontScroll || false;

            current.removeClass('disabled');

            var nextSteps = current.nextAll('.step:visible');

            var nextParentSteps = current.parent().nextAll('.step:visible');

            $.merge(nextSteps, nextParentSteps);
            // find all next steps in secound column

            nextSteps.each(function (index, element) {
                $(element).addClass('disabled');
            });

            // if next step is calendar
            if (current.hasClass('calendar')) {

                var calendar = this.$element.find('.date');

                this.selectChange();

                if (!dontScroll) {
                    this.scrollToElement(calendar);
                }
            }
        },
        /**
         * Change of date - datepicker
         */
        dateChange: function (dateString, calendar) {
            var plugin = this, next_element, calendarEl;

            calendarEl = $(calendar.dpDiv).parents('.date');

            calendarEl.parent().next().addClass('disabled');

            var options = this.getPrevousOptions(calendarEl);

            options.action = 'ea_date_selected';
            options.date   = dateString;
            options.check  = ea_settings['check'];

            this.placeLoader(calendarEl);

            $.get(ea_ajaxurl, options, function (response) {

                next_element = $(document.createElement('div'))
                    .addClass('time well well-lg');

                // sort response by value 11:00, 12:00, 13:00...
                response.sort(function (a, b) {
                    var a1 = a.value, b1 = b.value;

                    if (a1 == b1) {
                        return 0;
                    }

                    return a1 > b1 ? 1 : -1;
                });

                $.each(response, function (index, element) {
                    var classAMPM = '';

                    if (element.count > 0) {
                        classAMPM = (ea_settings["time_format"] == "am-pm") ? ' am-pm' : '';
                        next_element.append('<a href="#" class="time-value' + classAMPM + '" data-val="' + element.value + '">' + element.show + '</a>');
                    } else {
                        classAMPM = (ea_settings["time_format"] == "am-pm") ? ' am-pm' : '';
                        next_element.append('<a class="time-disabled' + classAMPM + '">' + element.show + '</a>');
                    }
                });

                if (response.length === 0) {
                    next_element.html('<p class="time-message">' + ea_settings['trans.please-select-new-date'] + '</p>');
                }

                var newRow = $(document.createElement('tr'))
                    .addClass('time-row')
                    .append('<td colspan="7" />');

                newRow.find('td').append(next_element);

                $(calendar.dpDiv).find('.ui-datepicker-current-day').closest('tr').after(newRow);

                // enabled
                next_element.parent().removeClass('disabled');

                next_element.find('.time-value:first').focus();

            }, 'json')
            .error(function(xhr, status) {

                if (xhr.status === 403) {
                    alert(ea_settings['trans.nonce-expired']);
                }

                if (xhr.status === 500) {
                    alert(ea_settings['trans.internal-error']);
                }

                plugin.removeLoader();
            })
            .always(function () {
                plugin.refreshData(plugin.settings.store);
                plugin.removeLoader();
            });
        },
        /**
         * Change month in calendar
         *
         * @param month
         * @param year
         */
        selectChange: function (month, year) {
            var self = this;
            self.placeLoader(self.$element.find('.calendar'));

            var simulateClick = false;

            if (typeof month === 'undefined' || typeof year === 'undefined') {

                var $firstDay = this.$element.find('[data-handler="selectDay"]:first');
                month = parseInt($firstDay.data('month')) + 1;
                year = $firstDay.data('year');

            }

            simulateClick = true;

            // check is all filled
            if (this.checkStatus()) {
                var selects = this.$element.find('select').not('.custom-field');

                var fields = selects.serializeArray();

                fields.push({'name': 'action', 'value': 'ea_month_status'});
                fields.push({'name': 'month', 'value': month});
                fields.push({'name': 'year', 'value': year});

                fields.push({'name': 'check', 'value': ea_settings['check']});

                $.get(ea_ajaxurl, fields, function (result) {
                    self.settings.store = result;
                    self.refreshData(result);

                    // simulate click for current date if there is one on calendar
                    if (simulateClick) {
                        // current day TD
                        var $cDay = self.$element.find('.ui-datepicker-current-day');

                        // it's free day after refresh
                        if ($cDay.hasClass('free')) {
                            $cDay.click();
                        } else {
                            // remove time slots row
                            self.$element.find('.time-row').remove();
                        }
                    }
                }, 'json')
                .error(function(xhr, status) {

                    if (xhr.status === 403) {
                        alert(ea_settings['trans.nonce-expired']);
                    }

                    if (xhr.status === 500) {
                        alert(ea_settings['trans.internal-error']);
                    }

                    plugin.removeLoader();
                });
            }
        },
        /**
         * Refresh table cells
         * @param data
         */
        refreshData: function (data) {

            var datepicker = this.$element.find('.date');

            $.each(data, function (key, status) {
                var $td = datepicker.find('.' + key);

                // remove all class and leave just date 2020-01-01
                $td.removeClass('free');
                $td.removeClass('busy');
                $td.removeClass('no-slots');

                $td.addClass(status);
            });

            this.removeLoader();
        },
        /**
         * Is everything selected
         * @return {boolean} Is ready for sending data
         */
        checkStatus: function () {
            var selects = this.$element.find('select').not('.custom-field');

            var isComplete = true;

            selects.each(function (index, element) {
                isComplete = isComplete && $(element).val() !== '';
            });

            return isComplete;
        },
        /**
         * Appointment information - before user add personal
         * information
         */
        appSelected: function (element) {
            var plugin = this;

            this.placeLoader(this.$element.find('.selected-time'));

            // make pre reservation
            var options = {
                location: this.$element.find('[name="location"]').val(),
                service: this.$element.find('[name="service"]').val(),
                worker: this.$element.find('[name="worker"]').val(),
                date: this.$element.find('.date').datepicker().val(),
                start: this.$element.find('.selected-time').data('val'),
                check: ea_settings['check'],
                action: 'ea_res_appointment'
            };

            // for booking overview
            var booking_data = {};
            booking_data.location = this.$element.find('[name="location"] > option:selected').text();
            booking_data.service = this.$element.find('[name="service"] > option:selected').text();
            booking_data.worker = this.$element.find('[name="worker"] > option:selected').text();
            booking_data.date = this.$element.find('.date').datepicker().val();
            booking_data.time = this.$element.find('.selected-time').data('val');
            booking_data.price = this.$element.find('[name="service"] > option:selected').data('price');

            var format = ea_settings['date_format'] + ' ' + ea_settings['time_format'];
            booking_data.date_time = moment(booking_data.date + ' ' + booking_data.time, ea_settings['defult_detafime_format']).format(format);

            $.get(ea_ajaxurl, options, function (response) {
                plugin.res_app = response.id;

                plugin.$element.find('.step').addClass('disabled');
                plugin.$element.find('.final').removeClass('disabled');

                plugin.scrollToElement(plugin.$element.find('.final'));

                // set overview cancel_appointment
                var overview_content = '';

                overview_content = plugin.settings.overview_template({data: booking_data, settings: ea_settings});

                plugin.$element.find('#booking-overview').html(overview_content);

                plugin.$element.find('#ea-total-amount').on('checkout:done', function( event, checkoutId ) {
                    var paypal_input = plugin.$element.find('#paypal_transaction_id');

                    if (paypal_input.length == 0) {
                        paypal_input = jQuery('<input id="paypal_transaction_id" class="custom-field" name="paypal_transaction_id" type="hidden"/>');
                        plugin.$element.find('.final').append(paypal_input);
                    }

                    paypal_input.val(checkoutId);

                    // make final conformation
                    plugin.finalComformation(event);
                });

            }, 'json')
            .error(function(xhr, status) {

                if (xhr.status === 403) {
                    alert(ea_settings['trans.nonce-expired']);
                }

                if (xhr.status === 500) {
                    alert(ea_settings['trans.internal-error']);
                }

                plugin.removeLoader();
            })
            .always($.proxy(function () {
                plugin.removeLoader();
            }, plugin));
        },
        /**
         *
         * @param $form
         */
        loadPreviousFormData: function ($form) {

            if (typeof localStorage === 'undefined') {
                return;
            }

            // load data from local storage
            var options = JSON.parse(localStorage.getItem('ea-form-options'));

            if (options == null) {
                return;
            }

            // place values inside form fields
            Object.keys(options).forEach(function (key) {
                $form.find('[name="' + key + '"]').val(options[key]);
            })
        },

        /**
         *
         * @param options
         */
        storeFormData: function (options) {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('ea-form-options', JSON.stringify(options));
            }
        },

        /**
         * Comform appointment
         */
        finalComformation: function (event) {
            event.preventDefault();

            var plugin = this;

            var form = this.$element.find('form');

            if (!form.valid()) {
                return;
            }

            this.$element.find('.ea-submit').prop('disabled', true);

            // make pre reservation
            var options = {
                id: this.res_app,
                check: ea_settings['check']
            };

            this.$element.find('.custom-field').each(function (index, element) {
                var name = $(element).attr('name');
                options[name] = $(element).val();
            });

            options.action = 'ea_final_appointment';

            $.get(ea_ajaxurl, options, function (response) {
                // store values from form
                plugin.storeFormData(options);

                // disable fields
                plugin.$element.find('.ea-submit').hide();
                plugin.$element.find('.ea-cancel').hide();
                plugin.$element.find('#paypal-button').hide();
                plugin.$element.find('.final').append('<h3>' + ea_settings['trans.done_message'] + '</h3>');
                plugin.$element.find('form').find('input,select,textarea').prop('disabled', true);

                plugin.triggerEvent();

                // if there is redirect do that
                if (ea_settings['submit.redirect'] !== '') {
                    setTimeout(function () {
                        window.location.href = ea_settings['submit.redirect'];
                    }, 2000);
                }
            }, 'json')
                .fail($.proxy(function () {
                    this.$element.find('.ea-submit').prop('disabled', false);
                }, plugin));
        },

        singleConformation: function (event) {
            event.preventDefault();
            var plugin = this;

            var form = this.$element.find('form');

            if (!form.valid()) {
                return;
            }

            this.$element.find('.ea-submit').prop('disabled', true);

            // make pre reservation
            var options = {
                location: this.$element.find('[name="location"]').val(),
                service: this.$element.find('[name="service"]').val(),
                worker: this.$element.find('[name="worker"]').val(),
                date: this.$element.find('.date').datepicker().val(),
                start: this.$element.find('.selected-time').data('val'),
                check: ea_settings['check'],
                action: 'ea_res_appointment'
            };

            $.get(ea_ajaxurl, options, function (response) {
                plugin.res_app = response.id;

                plugin.finalComformation(event);
            }, 'json')
            .fail($.proxy(function (response) {
                alert(response.responseJSON.message);
                this.$element.find('.ea-submit').prop('disabled', false);
            }, plugin))
            .always($.proxy(function () {
                plugin.removeLoader();
            }, plugin));
        },
        /**
         *
         */
        triggerEvent: function () {
            // Create the event.
            var event = document.createEvent('Event');

            // Define that the event name is 'easyappnewappointment'.
            event.initEvent('easyappnewappointment', true, true);

            // send event to document
            document.dispatchEvent(event);
        },
        /**
         * Cancel appointment
         */
        cancelApp: function (event) {
            event.preventDefault();
            var plugin = this;

            if (ea_settings['pre.reservation'] === '0') {
                plugin.chooseStep();
                plugin.res_app = null;
                this.$element.find('.step:not(.final)').prevAll('.step').removeClass('disabled');
                return false;
            }

            this.$element.find('.final').addClass('disabled');
            this.$element.find('.step:not(.final)').prevAll('.step').removeClass('disabled');

            var options = {
                id: this.res_app,
                check: ea_settings['check'],
                action: 'ea_cancel_appointment'
            };

            $.get(ea_ajaxurl, options, function (response) {
                if (response.data) {
                    // remove selected time
                    plugin.$element.find('.time').find('.selected-time').removeClass('selected-time');

                    //plugin.scrollToElement(plugin.$element.find('.date'));
                    plugin.chooseStep();
                    plugin.res_app = null;

                }
            }, 'json');
        },
        chooseStep: function () {
            var plugin = this;
            var $temp;

            switch (ea_settings['cancel.scroll']) {
                case 'calendar':
                    plugin.scrollToElement(plugin.$element.find('.date'));
                    break;
                case 'worker' :
                    $temp = plugin.$element.find('[name="worker"]');
                    $temp.val('');
                    $temp.change();
                    $temp.closest('.step').nextAll('.step').find('select').val('');
                    this.$element.find('.time-row').remove();
                    plugin.scrollToElement($temp);
                    break;
                case 'service' :
                    $temp = plugin.$element.find('[name="service"]');
                    $temp.val('');
                    $temp.change();
                    $temp.closest('.step').nextAll('.step').find('select').val('');
                    this.$element.find('.time-row').remove();
                    plugin.scrollToElement($temp);
                    break;
                case 'location' :
                    $temp = plugin.$element.find('[name="location"]');
                    $temp.val('');
                    $temp.change();
                    $temp.closest('.step').nextAll('.step').find('select').val('');
                    this.$element.find('.time-row').remove();
                    plugin.scrollToElement($temp);
                    break;
                case 'pagetop':
                    break;
            }
        },
        scrollToElement: function (element) {
            if (ea_settings.scroll_off === 'true') {
                return;
            }

            $('html, body').animate({
                scrollTop: ( element.offset().top - 20 )
            }, 500);
        }
    });

    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations
    $.fn[pluginName] = function (options) {
        this.each(function () {
            if (!$.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName, new Plugin(this, options));
            }
        });
        // chain jQuery functions
        return this;
    };
})(jQuery, window, document);


(function ($) {
    $('.ea-bootstrap').eaBootstrap();
})(jQuery);