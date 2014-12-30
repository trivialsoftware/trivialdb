//----------------------------------------------------------------------------------------------------------------------
// Custom errors
//
// @module error.js
//----------------------------------------------------------------------------------------------------------------------

var util = require('util');

//----------------------------------------------------------------------------------------------------------------------

function NotImplementedError(api)
{
    Error.call(this);

    this.name = "NotImplementedError";
    this.message = api + " not implemented.";
} // end NotImplementedError

util.inherits(NotImplementedError, Error);

//----------------------------------------------------------------------------------------------------------------------

function DocumentNotFound(id)
{
    Error.call(this);

    this.name = "DocumentNotFound";
    this.id = id;
    this.message = "Document with id '" + id + "' not found.";
} // end DocumentNotFound

util.inherits(DocumentNotFound, Error);

//----------------------------------------------------------------------------------------------------------------------

function ValidationError(key, expectedType, message)
{
    Error.call(this);

    this.name = "ValidationError";
    this.key = key;
    this.expectedType = expectedType;
    this.message = message || "Key '" + key + "' is not of type '" + expectedType +"'.";
} // end ValidationError

util.inherits(ValidationError, Error);

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    NotImplementedError: NotImplementedError,
    DocumentNotFound: DocumentNotFound,
    ValidationError: ValidationError
}; // end exports

//----------------------------------------------------------------------------------------------------------------------