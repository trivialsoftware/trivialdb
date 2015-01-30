//----------------------------------------------------------------------------------------------------------------------
// Implements a model based API for JBase.
//
// @module models.js
//----------------------------------------------------------------------------------------------------------------------

var util = require('util');

var _ = require('lodash');
var oftype = require('oftype');
var Promise = require('bluebird');

var errors = require('./errors');

//----------------------------------------------------------------------------------------------------------------------

function Model(db, modelDef)
{
    this.$$db = db;
    this.$$values = {};

    // Bind to the db's sync event
    this.$$db.on('sync', this.sync.bind(this));

    // Dirty can be read by external things, but we prefix it with '$' to prevent property collision.
    this.$dirty = false;

    // Build the schema for this model
    this._buildSchema();

    // Prevent any chance of accidentally overwriting the built in model properties
    var safeDef = _.omit(modelDef, ['$$db', '$$schema', '$$values', '$dirty', 'id', 'save', 'sync', 'toJSON', 'validate']);

    // Populate the model
    _.merge(this, safeDef);
} // end Model

Model.prototype._buildSchema = function()
{
    var self = this;

    // Setup the id property
    Object.defineProperty(this, 'id', {
        get: function(){ return self.$$values.id; },
        set: function(val)
        {
            // We only allow setting in the event that id is undefined.
            if(!self.$$values.id)
            {
                self.$dirty = true;
                self.$$values.id = val;
            } // end if
        }
    });

    // Setup the schema properties
    _.forIn(this.$$schema, function(typeDef, key)
    {
        Object.defineProperty(self, key, {
            get: function()
            {
                return self.$$values[key];
            },
            set: function(newVal)
            {
                self.$dirty = true;
                self.$$values[key] = newVal;
            }
        });

        // If we have a default configured, we set that now, and let it be overridden later.
        if(typeDef.default !== undefined)
        {
            self.$$values[key] = _.cloneDeep(typeDef.default);
        } // end if
    });
}; // end _buildSchema

Model.prototype.save = function(skipValidation)
{
    var self = this;

    // First, we validate
    var validatePromise;
    if(skipValidation)
    {
        validatePromise = Promise.resolve();
    }
    else
    {
        validatePromise = this.validate();
    } // end if

    // Now, we handle saving
    return validatePromise.then(function()
    {
        if(self.$dirty)
        {
            return self.$$db.store(self.id, self.$$values)
                .then(function(id)
                {
                    self.$$values.id = id;
                    self.$dirty = false;
                    return self;
                });
        }
        else
        {
            return Promise.resolve(self);
        } // end if
    });
}; // end save

Model.prototype.sync = function(force)
{
    var self = this;
    return this.$$db.get(this.id)
        .then(function(obj)
        {
            // Only update if we're not dirty, or are forcing a sync.
            if(obj && !self.$dirty || force)
            {
                self.$$values = obj;
            } // end if
        });
}; // end sync

Model.prototype.remove = function()
{
    var self = this;
    return this.$$db.remove(this.id)
        .then(function()
        {
            self.$$values = {};
        });
}; // end remove

Model.prototype.toJSON = function()
{
    return _.clone(this.$$values);
}; // end toJSON

Model.prototype.validate = function()
{
    var self = this;
    return new Promise(function(resolve, reject)
    {
        function fail(key, expectedType, message)
        {
            reject(new errors.ValidationError(key, expectedType, message));
        } // end fail

        _.forIn(self.$$schema, function(type, key)
        {
            var typeDef = {};

            // Support option objects instead of just plain types
            if(_.isPlainObject(type) && type.type)
            {
                typeDef = type;
                type = type.type;
            } // end if

            // TODO: Add support for complex types, like Arrays of a given type
            // TODO: May want to consider switching to value: https://www.npmjs.org/package/value

            // Pull put our value for easy access
            var val = self.$$values[key];

            // Validate the value
            if(val == null || val == undefined)
            {
                if(typeDef.required)
                {
                    return fail(key, type);
                } // end if
            }
            else
            {
                // Make sure we are of the specified type
                if(!oftype(val, type, { primitiveObject: true }))
                {
                    return fail(key, type);
                } // end if

                // If we have a 'choices' property, make sure we are one of the allowed values
                if(_.isArray(typeDef.choices))
                {
                    // Ensure the value is an array, to simplify the logic
                    val = _.isArray(val) ? val : [val];

                    // Iterate over every value in the val array, and check it against our choices.
                    var failedVal;
                    _.each(val, function(value)
                    {
                        if(!_.contains(typeDef.choices, value))
                        {
                            failedVal = value;
                        } // end if
                    });

                    if(failedVal)
                    {
                        // This will only return the last invalid choice, as opposed to all of them. This could be
                        // refactored later, if that is decided to be worth it.
                        return fail(key, type,
                            "Key '" + key + "': Value '" + failedVal + "' is not a valid choice. Possible values: " + typeDef.choices);
                    } // end if
                } // end if
            } // end if
        });

        resolve();
    });
}; // end validate

//----------------------------------------------------------------------------------------------------------------------

function defineModel(dbName, schemaDef, dbOptions)
{
    var jbase = require('../jbase');
    var db = jbase.db(dbName, dbOptions);

    // Build a custom Model Instance
    function JDBModel(modelDef)
    {
        this.$$schema = schemaDef;
        Model.call(this, db, modelDef);
    } // end JDBModel

    // Inherit from Model
    util.inherits(JDBModel, Model);

    /**
     * Expose the schema of the model.
     */
    JDBModel.schema = schemaDef;

    /**
     * Gets a single model instance, by id. If a document with that id is not found, it resolves to a
     * `DocumentNotFound`.
     *
     * @param {string} id - The id of the document to retrieve
     * @returns {Promise}
     * @static
     */
    JDBModel.get = function(id)
    {
        return db.get(id)
            .then(function(obj)
            {
                if(obj)
                {
                    var model = new JDBModel(obj);
                    model.$$values.id = id;
                    model.$dirty = false;

                    return model;
                }
                else
                {
                    return Promise.reject(new errors.DocumentNotFound(id));
                } // end if
            });
    }; // end get

    JDBModel.filter = function(filter)
    {
        return db.filter(filter)
            .then(function(filtered)
            {
                return _.reduce(filtered, function(models, value, id)
                {
                    var model = new JDBModel(value);
                    model.$$values.id = id;
                    model.$dirty = false;
                    models.push(model);

                    return models;
                }, []);
            });
    }; // end filter

    JDBModel.remove = function(filter)
    {
        return db.remove(filter);
    }; // end remove

    JDBModel.removeAll = function()
    {
        db.values = {};
        return db.sync();
    }; // end removeAll

    // Return the new model function
    return JDBModel;
} // end defineModel

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    Model: Model,
    defineModel: defineModel
};

//----------------------------------------------------------------------------------------------------------------------
