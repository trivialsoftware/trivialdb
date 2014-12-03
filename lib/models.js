//----------------------------------------------------------------------------------------------------------------------
// Implements a model based API for JBase.
//
// @module models.js
//----------------------------------------------------------------------------------------------------------------------

var _ = require('lodash');
var Promise = require('bluebird');

var errors = require('./errors');

//----------------------------------------------------------------------------------------------------------------------

function Model(db, modelDef)
{
    this.$$db = db;
    this.$$values = {};

    // Dirty can be read by external things, but we prefix it with '$' to prevent property collision.
    this.$dirty = false;

    // Build the schema for this model
    this._buildSchema();

    // Prevent any chance of accidentally overwriting the built in model properties
    var safeDef = _.omit(modelDef, ['$$db', '$$schema', '$$values', '$dirty', 'id', 'save', 'sync', 'validate']);

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
    _.forIn(this.$$schema, function(value, key)
    {
        Object.defineProperty(self, key, {
            get: function()
            {
                return value;
            },
            set: function(newVal)
            {
                self.$dirty = true;
                self.$$values[key] = newVal;
            }
        });
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
            return self.$$db.merge(self.id, self.$$values);
        }
        else
        {
            return Promise.resolve();
        } // end if
    });
}; // end save

Model.prototype.sync = function()
{
    var self = this;
    return this.$$db.get(this.id)
        .then(function(obj)
        {
            _.merge(self.$$values, obj);
        });
}; // end sync

Model.prototype.validate = function()
{
    var self = this;
    var failed = false;
    return new Promise(function(resolve, reject)
    {
        _.forIn(self.$$schema, function(type, key)
        {
            var typeDef = {};

            // Support option objects instead of just plain types
            if(_.isPlainObject(type) && type.type)
            {
                typeDef = type;
                type = type.type;
            } // end if

            // TODO: Add support for complex types, like Arrays, or Enums

            // Pull put our value for easy access
            var val = self.$$values[key];

            // The values `null` and `undefined` are allowed when we are not in required mode. If val is anything else,
            // then that something else must be an instance of type.
            if((!typeDef.required && (val === null || val === undefined)) || !(val instanceof type))
            {
                failed = true;
                reject(new errors.ValidationError(key, type));
            } // end if
        });

        if(!failed)
        {
            resolve();
        } // end if
    });
}; // end validate

//----------------------------------------------------------------------------------------------------------------------

function defineModel(dbName, schemaDef)
{
    var db = module.exports.db(dbName);

    // Build a custom Model Instance
    function JDBModel(modelDef)
    {
        this.$$schema = schemaDef;
        Model.call(this, db, modelDef);
    } // end JDBModel

    // Inherit from Model
    JDBModel.prototype = Model;

    /**
     * Gets a single model instance, by id. If a document with that id is not found, it resolves to a
     * `DocumentNotFoundError`.
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
                }
                else
                {
                    return Promise.reject(new errors.DocumentNotFound(id));
                } // end if
            });
    }; // end get

    JDBModel.filter = function(filter)
    {
        return this.filter(filter)
            .then(function(filtered)
            {
                return _.reduce(filtered, function(models, value, id)
                {
                    var model = new JDBModel(value);
                    model.$$values.id = id;
                    models.push(model);
                }, []);
            });
    }; // end filter
} // end defineModel

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    Model: Model,
    defineModel: defineModel
};

//----------------------------------------------------------------------------------------------------------------------