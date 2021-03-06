'use strict';

var Application = require('./core/Application');
var package_json = require('./package.json');

var _applications_cache = {};
var _default_app_key = null;

/**
 * Creates or/and return application instance
 *
 * @param   {string|ApplicationOptions} [options]
 * @returns {Application}
 */
function IFNode(options) {
    if(_default_app_key && !options) {
        return _applications_cache[_default_app_key];
    }

    if(typeof options === 'string') {
        return _applications_cache[options];
    }

    var app = new Application(options);
    var key = app.alias;

    if(!_default_app_key) {
        _default_app_key = key;
    }

    _applications_cache[key] = app;

    return app;
}

Object.defineProperty(IFNode, 'VERSION', {
    value: package_json.version
});

module.exports = IFNode;
