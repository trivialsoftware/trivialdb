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
    this.$$relations = {};
    this.$$updates = {};
    this.$$values = modelDef || {};

    // Dirty can be read by external things, but we prefix it with '$' to prevent property collision.
    this.$dirty = true;

    // Ensure that our relations are built.
    buildRelations(this.constructor);
} // end Model

function buildSchema(model)
{
    var proto = model.prototype;
    var pk = proto.$$db.options.pk ? proto.$$db.options.pk : 'id';

    // Setup the id property
    Object.defineProperty(proto, 'id', {
        get: function() { return this.$$values[pk]; },
        set: function(val)
        {
            // We only allow setting in the event that id is undefined.
            if(this.$$values.id === undefined)
            {
                this.$dirty = true;
                this.$$values[pk] = val;
            } // end if
        }
    });

    // Setup the schema properties
    _.forIn(proto.$$schema, function(typeDef, key)
    {
        if(key != '$relations')
        {
            attachKeyToProto(proto, typeDef, key);
        } // end if
    });
    
    buildRelations(model);
} // end buildSchema

function attachKeyToProto(proto, typeDef, key)
{
    if(_.isFunction(typeDef))
    {
        typeDef = {type: typeDef};
    } // end if

    if(!_.isPlainObject(typeDef))
    {
        var err = new Error(
            "Invalid type definition! Should be a function, an object with a `type` function, or a subschema object."
        );
        err.value = typeDef;
        throw err;
    } // end if

    if(_.isFunction(typeDef.type))
    {
        Object.defineProperty(proto, key, {
            get: function()
            {
                // Check to see if we have a value in $$updates, if not, then we check $$values. Finally, if val is
                // still undefined, we grab the default value.
                var val = _.has(this.$$updates, key) ? this.$$updates[key] : this.$$values[key];
                val = val === undefined ? typeDef.default : val;

                switch(typeDef.type)
                {
                    case Date:
                        return _.isDate(val) ? _.clone(val) : new Date(val);
                    default:
                        return _.clone(val);
                } // end switch
            },
            set: function(newVal)
            {
                this.$dirty = true;
                switch(typeDef.type)
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
    }
    else
    {
        Object.defineProperty(proto, key, {
            get: function()
            {
                // Return a surrogate object with the properties of the subschema.
                this.$$updates[key] = this.$$updates[key] || {};
                var surrogate = {$$values: this.$$values[key], $$updates: this.$$updates[key]};
                _.forIn(typeDef, attachKeyToProto.bind(surrogate, surrogate));
                return surrogate;
            },
            set: function(newVal)
            {
                this.$$updates[key] = this.$$updates[key] || {};
                _.merge(this.$$updates[key], newVal);
            }
        });
    } // end if
} // end attachKeyToProto

function buildRelations(model)
{
    var proto = model.prototype;

    _.forIn(proto.$$schema.$relations, function(relationDef, relationName)
    {
        // Define a property to work with the relation
        Object.defineProperty(proto, relationName, {
            get: function()
            {
                return this.$$relations[relationName];
            },
            set: function(val)
            {
                this.$dirty = true;

                // Track changes to the underlying keys
                this[relationDef.thisKey] = val[relationDef.otherKey];

                this.$$relations[relationName] = val;
            },
            configurable: true
        });
    });
} // end buildRelations

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

    // We build a list of keys to omit. This currently only supports the hideKey option in relations.
    var skipKeys = _.reduce(_.keys(this.$$schema.$relations), function(results, relationName)
    {
        var relationDef = self.$$schema.$relations[relationName];
        if(relationDef.options.hideKey && self.$$relations[relationName] !== undefined)
        {
            results.push(relationDef.thisKey);
        } // end if

        return results;
    }, []);

    var json = _.transform(this.$$schema, function(results, value, key)
    {
        if(key != '$relations' && !_.contains(skipKeys, key))
        {
            results[key] = self[key];
        } // end if
    }, { id: self.id });

    _.forIn(this.$$relations, function(value, key)
    {
        if(_.isArray(value))
        {
            json[key] = _.reduce(value, function(results, val)
            {
                results.push(val.toJSON());
                return results;
            }, []);
        }
        else
        {
            json[key] = value.toJSON();
        } // end if
    });

    //FIXME: This is doubling the cost of calling `toJSON()`
    // This removes all keys that begin with `$$`.
    json = JSON.parse(JSON.stringify(json, function(key, value)
    {
        if (typeof key === 'string' && key.charAt(0) === '$' && key.charAt(1) === '$')
        {
            value = undefined;
        } // end if

        return value;
    }));

    return json
}; // end toJSON

Model.prototype.validate = function()
{
    var self = this;
    return Promise.try(function()
    {
        self._validate(self.$$schema, self.$$updates, self.$$values);
    });
}; // end validate

var messages = {
    requiredValue: _.template("Key ${key} requires a value!"),
    invalidChoice: _.template("Key ${key}: Value ${failedVal} is not a valid choice. Possible values: ${choices}"),
};

// Inner validation function
Model.prototype._validate = function(schema, updates, values)
{
    var self = this;
    _.forIn(schema, function(type, key)
    {
        if(key != '$relations')
        {
            var typeDef = {};

            // Check to see if we have a value in $$updates, if not, then we check $$values. Finally,
            var val = _.has(updates, key) ? updates[key] : values[key];

            if(_.isPlainObject(type) && _.isFunction(type.type))
            {
                // `type` is an options object with the key `type`.
                typeDef = type;
                type = type.type;
            }
            else if(_.isPlainObject(type))
            {
                // `type` is an object defining a nested schema.
                return self._validate(type, updates[key] || {}, values[key] || {});
            }
            else if(_.isArray(type) && type.length !== 0)
            {
                //TODO: Support typed arrays
                throw new Error("Typed arrays are not supported.");
            } // end if

            // If val is still undefined, we grab the default value.
            val = val === undefined ? typeDef.default : val;

            // Validate the value
            if(val === null || val === undefined)
            {
                if(typeDef.required)
                {
                    throw new errors.ValidationError(key, type, messages.requiredValue({key: key}));
                } // end if
            }
            else
            {
                // TODO: May want to consider switching to value: https://www.npmjs.org/package/value

                // Make sure we are of the specified type
                if(type === Date)
                {
                    if(isNaN(new Date(val).getTime()))
                    {
                        throw new errors.ValidationError(key, type);
                    } // end if
                }
                else if(!oftype(val, type, { primitiveObject: true }))
                {
                    throw new errors.ValidationError(key, type);
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
                        throw new errors.ValidationError(key, type,
                            messages.invalidChoice({key: key, failedVal: failedVal, choices: typeDef.choices})
                        );
                    } // end if
                } // end if
            } // end if
        } // end if
    });
}; // end _validate

Model.prototype.populate = function(options)
{
    var self = this;
    var promises = [];

    _.forIn(this.$$schema.$relations, function(relationDef, relationName)
    {
        // A Promise to populate this relation
        promises.push(new Promise(function(resolve)
        {
            var filter = {};
            switch(relationDef.type)
            {
                case 'hasOne':
                    filter[relationDef.otherKey] = self[relationDef.thisKey];
                    resolve(relationDef.model.filter(filter)
                        .then(function(models)
                        {
                            self.$$relations[relationName] = models[0];
                        }));
                    break;

                case 'hasMany':
                    filter[relationDef.otherKey] = self[relationDef.thisKey];
                    resolve(relationDef.model.filter(filter)
                        .then(function(models)
                        {
                            self.$$relations[relationName] = models;
                        }));
                    break;
            } // end switch
        }));
    });

    return Promise.all(promises)
        .then(function(){ return self; });
}; // end populate

Model.prototype.depopulate = function()
{
    this.$$relations = [];
    return Promise.resolve(this);
}; // end depopulate

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
     * @param {Object} options - Retrieval options.
     * @returns {Promise}
     * @static
     */
    JDBModel.get = function(id, options)
    {
        options = options || {};
        return db.get(id)
            .then(function(obj)
            {
                if(obj)
                {
                    var pk = dbOptions.pk ? dbOptions.pk : 'id';
                    var model = new JDBModel(obj);
                    model.$$values[pk] = id;
                    model.$dirty = false;

                    if(options.populate)
                    {
                        return model.populate();
                    }
                    else
                    {
                        return model;
                    } // end if
                }
                else
                {
                    return Promise.reject(new errors.DocumentNotFound(id));
                } // end if
            });
    }; // end get

    /**
     * Gets a list of all model instances for this model.
     * @param {Object} options - Retrieval options.
     * @returns {Promise<Array<JDBModel>>} - An array of model instances.
     */
    JDBModel.all = function(options)
    {
        return this.filter(undefined, options);
    }; // end all

    /**
     * Gets a list of all model instances that match the given filter.
     * @param {Object} filter - A lodash-compliant filter object.
     * @param {Object} options - Retrieval options.
     * @returns {Promise<Array<JDBModel>>}
     */
    JDBModel.filter = function(filter, options)
    {
        options = options || {};
        return db.filter(filter)
            .then(function(filtered)
            {
                return Promise.all(_.reduce(filtered, function(models, value, id)
                {
                    var model = new JDBModel(value);
                    model.$$values.id = id;
                    model.$dirty = false;

                    if(options.populate)
                    {
                        models.push(model.populate());
                    }
                    else
                    {
                        models.push(model);
                    } // end if

                    return models;
                }, []));
            });
    }; // end filter

    /**
     * Removes any documents that match the given filter.
     * @param {Object} filter - A lodash-compliant filter object.
     * @returns {Promise}
     */
    JDBModel.remove = function(filter)
    {
        return db.remove(filter);
    }; // end remove

    /**
     * Removes all documents from the model.
     * @returns {Promise}
     */
    JDBModel.removeAll = function()
    {
        db.values = {};
        return db.sync();
    }; // end removeAll

    /**
     * Defines a "many to one" relation between two models. The foreign key is `thisKey` and will be stored on
     * this model.
     *
     *  If you need a "one to one" relationship, define a `hasOne` on both models.
     * @param {JDBModel} otherModel - The other model in this relationship.
     * @param {string} relationName - The field to create when populating this relationship.
     * @param {string} thisKey - The field of this model that will be used for the join.
     * @param {string} otherKey - The field of `otherModel` that will be used for the join.
     * @param {Object=} options - Additional options for the relationship.
     */
    JDBModel.hasOne = function(otherModel, relationName, thisKey, otherKey, options)
    {
        options = options || { hideKey: true };
        schemaDef.$relations = schemaDef.$relations || {};
        schemaDef.$relations[relationName] = {
            model: otherModel,
            type: 'hasOne',
            thisKey: thisKey,
            otherKey: otherKey,
            options: options
        }
    }; // end hasOne


    /**
     * Define a "one to Many" relation between two models where the reciprocal relation is a `hasOne`.
     * The foreign key is `otherKey` and will be stored in `otherModel`.
     *
     *  If you need a "many to many" relation between two models, define a `hasMany` on both models.
     * @param {JDBModel} otherModel - The other model in this relationship.
     * @param {string} relationName - The field to create when populating this relationship.
     * @param {string} thisKey - The field of this model that will be used for the join.
     * @param {string} otherKey - The field of `otherModel` that will be used for the join.
     * @param {Object=} options - Additional options for the relationship.
     */
    JDBModel.hasMany = function(otherModel, relationName, thisKey, otherKey, options)
    {
        options = options || { hideKey: true };
        schemaDef.$relations = schemaDef.$relations || {};
        schemaDef.$relations[relationName] = {
            model: otherModel,
            type: 'hasMany',
            thisKey: thisKey,
            otherKey: otherKey,
            options: options
        }
    }; // end hasMany

    // Return the new model function
    return JDBModel;
} // end defineModel

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    Model: Model,
    defineModel: defineModel
};

//----------------------------------------------------------------------------------------------------------------------
