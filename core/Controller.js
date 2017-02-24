'use strict';

var _isPlainObject = require('lodash/isPlainObject');
var _isFunction = require('lodash/isFunction');
var _isArray = require('lodash/isArray');
var _clone = require('lodash/clone');
var _defaults = require('lodash/defaults');
var _omit = require('lodash/omit');

var Util = require('util');

var toArray = require('./helper/toArray');
var eachSeries = require('./helper/eachSeries');
var stringFillEndBy = require('./helper/stringFillEndBy');
var addSlashToStringEnd = require('./helper/addSlashToStringEnd');

var UUID = require('uuid');
var Express = require('express');
var Log = require('./Log');

/**
 *
 * @param   {string}    method
 * @returns {function}
 */
function make_sugar(method) {
    return function() {
        if(!this._by_autogenerated_map) {
            Log.error('controllers', 'Controller generated by .map options');
        }

        //var args = toArray(arguments, 1),
        //    params = _regulize_route_params.call(this, args),
        //
        //    url = params[0],
        //    options = params[1],
        //    user_callbacks = params[2],
        //
        //    map_key = [method, url].join(' '),
        //    map_value = _defaults({
        //        action: user_callbacks
        //    }, options);
        //
        //this.map[map_key] = map_value;

        //return this;
        return this.method.apply(this, [method].concat(toArray(arguments)));
    };
}

/**
 *
 * @class Controller
 *
 * @param {ControllerOptions}   options
 */
function Controller(options) {
    var config = this._process_config(options);

    this.id = UUID.v4();
    this.name = config.name;
    this.root = addSlashToStringEnd(config.root);
    this.router = Express.Router(config.router);
    this.map = config.map;

    if(!this.map) {
        this._by_autogenerated_map = true;
        this.map = {};
    }

    this._common_options = _omit(config, [
        'name',
        'root',
        'router',
        'map'
    ]);
    this._common_options.before = [];
    this._compiled = false;
}

Controller.prototype._config_processors = [];
Controller.prototype._populates = [];
Controller.prototype._middlewares = [];

/**
 *
 * @param {...function} processors
 */
Controller.process_config = function(processors) {
    processors = toArray(arguments);

    var config_processors = this.prototype._config_processors;
    config_processors.push.apply(config_processors, processors);
};

Controller.processConfig = Controller.process_config;

/**
 *
 * @param {...function} populates
 */
Controller.populate = function(populates) {
    populates = toArray(arguments);

    var controller_populates = this.prototype._populates;
    controller_populates.push.apply(controller_populates, populates);
};

/**
 *
 * @param {...function} middleware
 */
Controller.middleware = function(middleware) {
    middleware = toArray(arguments);

    var middlewares = this.prototype._middlewares;
    middlewares.push.apply(middlewares, middleware);
};

Controller.process_config(
    function before_processor(controller_config) {
        var self = this,

            _by_action = function(name) {
                return self[name];
            },
            _by_array = function(before) {
                return before.map(function(before_option) {
                    if(typeof before_option === 'string') {
                        return _by_action(before_option);
                    } else {
                        return before_option;
                    }
                });
            },
            before = controller_config.before;

        if(typeof before === 'string') {
            controller_config.before = _by_action(before);
        } else if(_isArray(before)) {
            controller_config.before = _by_array(before);
        } else if(_isFunction(before)) {
            controller_config.before = toArray(before);
        } else {
            controller_config.before = [];
        }
    }
);
Controller.middleware(
    function add_options_middleware(options) {
        return function add_options_middleware(request, response, next) {
            request.controller_options = request.controllerOptions = options;
            next();
        };
    },
    function ajax_middleware(options) {
        var both_request_types,
            only_ajax, without_ajax;

        switch(typeof options.ajax) {
            case 'boolean':
                both_request_types = false;
                only_ajax = options.ajax;
                without_ajax = !options.ajax;
                break;
            default:
                both_request_types = true;
        }

        return function ajax_middleware(request, response, next) {
            if (!both_request_types) {
                if (only_ajax && !request.xhr) {
                    return response.bad_request('Only AJAX request');
                }
                if (without_ajax && request.xhr) {
                    return response.bad_request('AJAX request is denied');
                }
            }

            next();
        };
    }
);

/**
 *
 * @param {...routeHandler} callbacks
 */
Controller.prototype.before = function(callbacks) {
    callbacks = toArray(arguments);

    this._common_options.before = callbacks;
};

/**
 *
 * @param {string}      name
 * @param {function}    expression
 */
Controller.prototype.param = function(name, expression) {
    if(typeof name !== 'string') {
        Log.error('controllers', 'Param name must be String');
    }
    if(typeof expression !== 'function') {
        Log.error('controllers', 'Param name must be Function');
    }

    this.router.param.call(this.router, name, expression);
};

/**
 *
 * @param {string|Array.<string>}       methods
 * @param {string|Object|routeHandler}  [path]
 * @param {Object|routeHandler}         [options]
 * @param {...routeHandler}             callbacks
 */
Controller.prototype.method = function(methods, path, options, callbacks) {
    var self = this;
    var args = toArray(arguments, 1);

    toArray(methods).forEach(function(method) {
        self._generate_url.apply(self, [method].concat(args));
    });

    return this;
};

/**
 *
 * @param {string|Object|routeHandler}  [path]
 * @param {Object|routeHandler}         [options]
 * @param {...routeHandler}             callbacks
 */
Controller.prototype.get = make_sugar('get');

/**
 *
 * @param {string|Object|routeHandler}  [path]
 * @param {Object|routeHandler}         [options]
 * @param {...routeHandler}             callbacks
 */
Controller.prototype.post = make_sugar('post');

/**
 *
 * @param {string|Object|routeHandler}  [path]
 * @param {Object|routeHandler}         [options]
 * @param {...routeHandler}             callbacks
 */
Controller.prototype.put = make_sugar('put');

/**
 *
 * @param {string|Object|routeHandler}  [path]
 * @param {Object|routeHandler}         [options]
 * @param {...routeHandler}             callbacks
 */
Controller.prototype.patch = make_sugar('patch');

/**
 *
 * @param {string|Object|routeHandler}  [path]
 * @param {Object|routeHandler}         [options]
 * @param {...routeHandler}             callbacks
 */
Controller.prototype.delete = make_sugar('delete');

/**
 *
 * @param {string|Object|routeHandler}  [path]
 * @param {Object|routeHandler}         [options]
 * @param {...routeHandler}             callbacks
 */
Controller.prototype.del = Util.deprecate(
    make_sugar('del'),
    'Deprecated and will be removed from 2.0.0 version. Instead of use controller.delete()'
);

/**
 *
 * @param {errorHandler}    custom_error_handler
 */
Controller.prototype.error = function(custom_error_handler) {
    var self = this;

    this.error_handler = custom_error_handler;
    this.use(function(err, request, response, next) {
        custom_error_handler.apply(self, arguments);
    });

    return this;
};

/**
 *
 * @returns {Controller}
 */
Controller.prototype.end = function() {
    this.use(function(request, response) {
        response.not_found();
    });
    return this;
};

/**
 *
 * @param   {...routeHandler}   routes
 * @returns {Controller}
 */
Controller.prototype.use = function(routes) {
    this.router.use.apply(this.router, toArray(arguments));

    return this;
};

/**
 *
 */
Controller.prototype.compile = function() {
    if(this._compiled) {
        return;
    }

    if(this.map) {
        this._build_by_map();
    }

    this._compiled = true;
};

/**
 *
 * @private
 * @param   {Object}    controller_config
 * @returns {Object}
 */
Controller.prototype._process_config = function(controller_config) {
    if(_isPlainObject(controller_config)) {
        var self = this;

        this._config_processors.forEach(function(processor) {
            processor.call(self, controller_config);
        });
    } else {
        controller_config = {};
    }

    return controller_config;
};

/**
 *
 * @private
 * @param   {Object}    options
 * @returns {Object}
 */
Controller.prototype._regulize_options = function(options) {
    var common_options = this._common_options;

    return options?
        _defaults(this._process_config(options), common_options) :
        _clone(common_options);
};

/**
 *
 * @private
 * @param   {...*}  args
 * @returns {[string, Object, function|Array.<function>]}
 */
Controller.prototype._regulize_route_params = function(args) {
    if(_isFunction(args[0])) {
        return ['/', this._regulize_options(null), args];
    }

    if(_isPlainObject(args[0])) {
        return ['/', this._regulize_options(args[0]), args.slice(1)];
    }

    var options;
    var callbacks;

    if(_isPlainObject(args[1])) {
        options = this._regulize_options(args[1]);
        callbacks = args.slice(2);
    } else {
        options = this._regulize_options(null);
        callbacks = args.slice(1);
    }

    return [args[0], options, callbacks];
};

/**
 *
 * @private
 * @param {string}  method
 */
Controller.prototype._generate_url = function(method) {
    var args = toArray(arguments, 1);
    var params = this._regulize_route_params(args);

    var url = params[0];
    var options = params[1];
    var user_callbacks = params[2];

    Log(
        stringFillEndBy(method.toUpperCase(), ' ', 7),
        (this.root + url).replace(/\/+/g, '/')
    );

    var callbacks = [];
    var index, length;

    for(index = 0, length = this._populates.length; index < length; ++index) {
        callbacks.push(this._populates[index].bind(this));
    }
    for(index = 0, length = this._middlewares.length; index < length; ++index) {
        callbacks.push(this._middlewares[index].call(this, options));
    }

    var before_callbacks = this._common_options.before;

    for(index = 0, length = before_callbacks.length; index < length; ++index) {
        callbacks.push(before_callbacks[index].bind(this));
    }
    for(index = 0, length = user_callbacks.length; index < length; ++index) {
        callbacks.push(user_callbacks[index].bind(this));
    }

    this.router[method](url, function(request, response, next_route) {
        eachSeries(callbacks, function(callback, next_callback, interrupt) {
            try {
                callback(
                    request,
                    response,
                    /**
                     *
                     * @param {*|Error} options
                     */
                    function next_handler(options) {
                        if(options instanceof Error) {
                            interrupt();
                            next_route(options);
                        } else {
                            next_callback();
                        }
                    },
                    next_route
                );
            } catch(err) {
                interrupt();
                next_route(err);
            }
        }, next_route);
    });
};

/**
 *
 * @private
 */
Controller.prototype._build_by_map = function() {
    var self = this;

    /**
     *
     * @private
     * @param   {function|Array.<function>} handlers
     * @returns {Array.<function>}
     */
    function _make_handlers(handlers) {
        return toArray(handlers).map(function(handler) {
            if(typeof handler === 'function') {
                return handler;
            } else {
                return self[handler];
            }
        });
    }

    /**
     *
     * @private
     * @param method
     * @param path
     * @param options
     * @param handlers
     */
    function _route_by_function(method, path, options, handlers) {
        self.method.apply(self, [method, path, options].concat(_make_handlers(handlers)));
    }

    /**
     *
     * @private
     * @param method
     * @param path
     * @param options
     */
    function _route_by_object(method, path, options) {
        var handlers = options.action;
        var route_options = _omit(options, 'action');

        _route_by_function(method, path, route_options, handlers);
    }

    var map = this.map;
    var routes = Object.keys(map);

    routes.forEach(function(route) {
        var handler = map[route];
        var route_splitter = /\s+/;

        route = route.split(route_splitter);

        var method = route[0];
        var path = route[1];

        if(typeof handler === 'string' || _isArray(handler)) {
            _route_by_function(method, path, {}, handler);
        } else {
            _route_by_object(method, path, handler);
        }
    });
};

Controller.fn = Controller.prototype;

module.exports = Controller;
