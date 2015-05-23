'use strict';

var path = require('path'),
    diread = require('diread'),

    helper = require('./../helper'),
    log = require('./../extensions/log');

module.exports = function(Application) {
    Application.fn._initialize_schemas = function() {
        var self = this,
            db = this._config.db,
            schemas_drivers = this._schemas_drivers,
            schemas = this._schemas,

            db_connections_names;

        if(!db) {
            return;
        }

        db_connections_names = Object.keys(db);
        if(!db_connections_names.length) {
            return;
        }

        self._default_creator = db_connections_names[0];
        db_connections_names.forEach(function(db_connection_name) {
            var db_config = db[db_connection_name],
                schema_driver = schemas_drivers[db_config.schema];

            if(db_config.default) {
                self._default_creator = db_connection_name;
            }

            if(schema_driver.driver) {
                schema_driver.driver(db_config.config);
            }
            schemas[db_connection_name] = schema_driver;
        });
    };
    Application.fn._initialize_models = function() {
        diread({
            src: this.config.application.folders.models
        }).each(function(model_file_path) {
            require(model_file_path);
        });
    };
    Application.fn._compile_models = function() {
        var model_prototypes = this._model_prototypes,
            app_models = this._models,

            compile;

        compile = function(model_id) {
            var model_prototype = model_prototypes[model_id],
                compiled_model = model_prototype.__schema.compile(),
                options = model_prototype.options;

            app_models[model_id] = compiled_model;

            if(options.alias) {
                helper.to_array(options.alias).forEach(function(alias) {
                    if(alias in app_models) {
                        log.error('models', 'Alias [' + alias + '] already busy.');
                    }

                    app_models[alias] = compiled_model;
                });
            }
        };

        Object.keys(model_prototypes).forEach(compile);
        delete this.__model_prototypes;
    };
    Application.fn._init_models = function() {
        this._model_prototypes = {};

        this._schemas = {};
        this._models = {};
        this._initialize_schemas();
        this._initialize_models();
        this._compile_models();
    };

    Application.fn.attach_schema = function(Schema) {
        if(!this._schemas_drivers) {
            this._schemas_drivers = {};
        }

        this._schemas_drivers[Schema.schema] = Schema;
    };
    Application.fn.Model = function(model_config, options) {
        if(typeof options === 'string') {
            options = { schema: options }
        } else if(helper.is_plain_object(options)) {
            options.schema = options.schema || this._default_creator;
        } else {
            options = { schema: this._default_creator };
        }

        var schema = this._schemas[options.schema](model_config);

        this._model_prototypes[schema.table] = {
            __schema: schema,
            options: options
        };

        return schema;
    };
};
