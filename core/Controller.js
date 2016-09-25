'use strict';

var _isPlainObject = require('lodash/isPlainObject');
var _isFunction = require('lodash/isFunction');
var _isArray = require('lodash/isArray');
var _isString = require('lodash/isString');
var _clone = require('lodash/clone');
var _defaults = require('lodash/defaults');
var _omit = require('lodash/omit');

var toArray = require('./helper/toArray');
var eachSeries = require('./helper/eachSeries');
var addFunctions = require('./helper/pushElements');
var addSlashToStringEnd = require('./helper/addSlashToStringEnd');

var debug = require('debug')('ifnode:controller');
var UUID = require('node-uuid');
var Express = require('express');
var Log = require('./extensions/log');

var _process_config = function(controller_config) {
    var self = this;

    if(_isPlainObject(controller_config)) {
        this._config_processors.forEach(function(processor) {
            processor.call(self, controller_config);
        });
    } else {
        controller_config = {};
    }

    return controller_config;
};

var _regulize_route_params = function(args) {
    var self = this,

        _regulize_options = function(options) {
            var common_options = self._common_options;

            return options?
                _defaults(_process_config.call(self, options), common_options) :
                _clone(common_options);
        },
        url, options, callbacks;

    if(_isFunction(args[0])) {
        url = '/';
        options = _regulize_options(null);
        callbacks = args;
    } else if(_isPlainObject(args[0])) {
        url = '/';
        options = _regulize_options(args[0]);
        callbacks = args.slice(1);
    } else {
        url = args[0];
        if(_isPlainObject(args[1])) {
            options = _regulize_options(args[1]);
            callbacks = args.slice(2);
        } else {
            options = _regulize_options(null);
            callbacks = args.slice(1);
        }
    }

    return [url, options, callbacks];
};

var _generate_url = function(method) {
    var args = toArray(arguments, 1),
        params = _regulize_route_params.call(this, args),

        url = params[0],
        options = params[1],
        before_callbacks = this._common_options.before,
        user_callbacks = params[2],
        callbacks = [],

        i, len;

    debug(
        Log.form('%-7s %s',
            method.toUpperCase(),
            (this.root + url).replace(/\/+/g, '/')
        )
    );

    for(i = 0, len = this._populates.length; i < len; ++i) {
        callbacks.push(this._populates[i].bind(this));
    }
    for(i = 0, len = this._middlewares.length; i < len; ++i) {
        callbacks.push(this._middlewares[i].call(this, options));
    }

    for(i = 0, len = before_callbacks.length; i < len; ++i) {
        callbacks.push(before_callbacks[i].bind(this));
    }
    for(i = 0, len = user_callbacks.length; i < len; ++i) {
        callbacks.push(user_callbacks[i].bind(this));
    }

    this.router[method](url, function(request, response, next_route) {
        eachSeries(callbacks, function(callback, next_callback, interrupt) {
            var next_handler = function(options) {
                var is_error = options instanceof Error;

                if(is_error) {
                    return next_route(options);
                }

                next_callback();
            };

            try {
                callback(request, response, next_handler, next_route);
            } catch(err) {
                interrupt();
                next_route(err);
            }
        });
    });
};

var _build_by_map = function() {
    var self = this,

        _make_handlers = function(handlers) {
            return toArray(handlers).map(function(handler) {
                if(typeof handler === 'function') {
                    return handler;
                } else {
                    return self[handler];
                }
            });
        },
        _route_by_function = function(method, path, options, handlers) {
            self.method.apply(self, [method, path, options].concat(_make_handlers(handlers)));
        },
        _route_by_object = function(method, path, options) {
            var handlers = options.action,
                route_options = _omit(options, 'action');

            _route_by_function(method, path, route_options, handlers);
        },

        map = this.map,
        routes = Object.keys(map);

    routes.forEach(function(route) {
        var method,
            path,
            handler = map[route],
            route_splitter = /\s+/;

        route = route.split(route_splitter);
        method = route[0];
        path = route[1];

        if(_isString(handler) || _isArray(handler)) {
            _route_by_function(method, path, {}, handler);
        } else {
            _route_by_object(method, path, handler);
        }
    });
};

var _initialize = function(controller_config) {
    var config = _process_config.call(this, controller_config);

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
};

var Controller = function(config) {
    if(!(this instanceof Controller)) {
        return new Controller(config);
    }

    _initialize.call(this, config);
};

Controller.fn = Controller.prototype;

Controller.fn._config_processors = [];
Controller.fn._populates = [];
Controller.fn._middlewares = [];

Controller.process_config = function(processors) {
    processors = toArray(arguments);
    addFunctions.apply(null, [Controller.fn._config_processors].concat(processors));
};
Controller.populate = function(populates) {
    populates = toArray(arguments);
    addFunctions.apply(null, [Controller.fn._populates].concat(populates));
};
Controller.middleware = function(middleware) {
    middleware = toArray(arguments);
    addFunctions.apply(null, [Controller.fn._middlewares].concat(middleware));
};

Controller.process_config(
    function map_processor(controller_config) {
        if(!_isPlainObject(controller_config.map)) {
            controller_config.map = null;
        }
    },
    function before_processor(controller_config) {
        var self = this,

            _by_action = function(name) {
                return self[name];
            },
            _by_array = function(before) {
                return before.map(function(before_option) {
                    if(_isString(before_option)) {
                        return _by_action(before_option);
                    } else {
                        return before_option;
                    }
                });
            },
            before = controller_config.before;

        if(_isString(before)) {
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

Controller.fn._compile = function() {
    if(this.map) {
        _build_by_map.call(this);
    }
};

Controller.fn.before = function(callbacks) {
    callbacks = toArray(arguments);

    this._common_options.before = callbacks;
};
Controller.fn.after = function() {

};

Controller.fn.param = function(name, expression) {
    if(typeof name !== 'string') {
        Log.error('controllers', 'Param name must be String');
    }
    if(typeof expression !== 'function') {
        Log.error('controllers', 'Param name must be Function');
    }

    this.router.param.call(this.router, name, expression);
};

Controller.fn.method = function(methods/*, url, options, callbacks */) {
    var self = this,
        args = toArray(arguments, 1);

    toArray(methods).forEach(function(method) {
        _generate_url.apply(self, [method].concat(args));
    });

    return this;
};

[
    { method: 'get'   , alias: ['get'] },
    { method: 'post'  , alias: ['post'] },
    { method: 'put'   , alias: ['put'] },
    { method: 'patch' , alias: ['patch'] },
    { method: 'delete', alias: ['delete', 'del'] }
].forEach(function(data) {
        var make_sugar = function(method) {
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
        };

        data.alias.forEach(function(alias) {
            Controller.fn[alias] = make_sugar(data.method);
        });
    });

Controller.fn.error = function(custom_error_handler) {
    var self = this;

    this.error_handler = custom_error_handler;
    this.use(function(err, request, response, next) {
        custom_error_handler.apply(self, arguments);
    });

    return this;
};
Controller.fn.end = function() {
    this.use(function(request, response) {
        response.not_found();
    });
    return this;
};
Controller.fn.use = function(routes, callbacks) {
    this.router.use.apply(this.router, arguments);
    return this;
};

//Controller.fn.route = function(route, options) {
//    var self = this,
//        route_arguments = _regulize_route_params.call(this, toArray(arguments, 0));
//
//    var route_methods = {
//        'get': function(/* callbacks */) {
//            var _args = [].push.apply(route_arguments.slice(0, 2), toArray(arguments));
//
//            self.get.apply(self, _args);
//
//            return route_methods;
//        }
//    };
//
//    return route_methods;
//};

module.exports = Controller;