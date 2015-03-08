//----------------------------------------------------------------------------------------------------------------------
// Implements a model based API for TrivialDB.
//
// @module models.js
//----------------------------------------------------------------------------------------------------------------------

var util = require('util');

var _ = require('lodash');
var oftype = require('oftype');
var Promise = require('bluebird');

var errors = require('./errors');

//----------------------------------------------------------------------------------------------------------------------

function Model(modelDef)
{
    this.$$updates = {};
    this.$$values = modelDef || {};

    // Dirty can be read by external things, but we prefix it with '$' to prevent property collision.
    this.$dirty = true;

} // end Model

function buildSchema(model)
{
    var proto = model.prototype;
    var pk = proto.$$db.options.pk ? proto.$$db.options.pk : 'id';

    // Setup the id property
    Object.defineProperty(proto, 'id', {
        get: function(){ return this.$$values[pk]; },
        set: function(val)
        {
            // We only allow setting in the event that id is undefined.
            if(!this.$$values.id)
            {
                this.$dirty = true;
                this.$$values[pk] = val;
            } // end if
        }
    });

    // Setup the schema properties
    _.forIn(proto.$$schema, function(typeDef, key)
    {
        var type = typeDef.type || typeDef;

        Object.defineProperty(proto, key, {
            get: function()
            {
                // Check to see if we have a value in $$updates, if not, then we check $$values. Finally, if val is
                // still undefined, we grab the default value.
                var val = _.has(this.$$updates, key) ? this.$$updates[key] : this.$$values[key];
                val = val === undefined ? typeDef.default : val;

                switch(type)
                {
                    case Date:
                        return _.clone(_.isDate(val) ? val : new Date(val));
                    default:
                        return _.clone(val);
                } // end switch
            },
            set: function(newVal)
            {
                this.$dirty = true;
                switch(type)
                {
                    case Date:
                        this.$$updates[key] =  _.isDate(newVal) ? newVal : new Date(newVal);
                        break;
                    default:
                        this.$$updates[key] = newVal;
                        break;
                } // end switch
            }
        });
    });
} // end buildSchema

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
            var pk = self.$$db.options.pk ? self.$$db.options.pk : 'id';

            return self.$$db.store(self.id, _.assign(self.$$values, self.$$updates))
                .then(function(id)
                {
                    self.$$updates = {};
                    self.$$values[pk] = id;
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
                self.$$updates = {};
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
    var self = this;
    return _.transform(this.$$schema, function(results, value, key)
    {
        results[key] = self[key];
    }, { id: self.id });
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

            // Check to see if we have a value in $$updates, if not, then we check $$values. Finally, if val is
            // still undefined, we grab the default value.
            var val = _.has(self.$$updates, key) ? self.$$updates[key] : self.$$values[key];
            val = val === undefined ? typeDef.default : val;

            // Validate the value
            if(val === null || val === undefined)
            {
                if(typeDef.required)
                {
                    return fail(key, type);
                } // end if
            }
            else
            {
                // Make sure we are of the specified type
                if(type === Date)
                {
                    if(isNaN(new Date(val).getTime()))
                    {
                        return fail(key, type);
                    } // end if
                }
                else if(!oftype(val, type, { primitiveObject: true }))
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
    var trivialdb = require('../trivialdb');
    var db = trivialdb.db(dbName, dbOptions);

    // Build a custom Model Instance
    function JDBModel(modelDef)
    {
        Model.call(this, modelDef);
    } // end JDBModel

    // Inherit from Model
    util.inherits(JDBModel, Model);

    JDBModel.prototype.$$db = db;
    JDBModel.prototype.$$schema = schemaDef;

    /**
     * The schema definition of the model.
     */
    JDBModel.schema = schemaDef;

    // Build the schema for this model.
    buildSchema(JDBModel);

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
                    var pk = dbOptions.pk ? dbOptions.pk : 'id';
                    var model = new JDBModel(obj);
                    model.$$values[pk] = id;
                    model.$dirty = false;

                    return model;
                }
                else
                {
                    return Promise.reject(new errors.DocumentNotFound(id));
                } // end if
            });
    }; // end get

    JDBModel.all = function()
    {
        return this.filter();
    }; // end all

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
