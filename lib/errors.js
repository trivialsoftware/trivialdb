//----------------------------------------------------------------------------------------------------------------------
// Custom errors
//
// @module error.js
//----------------------------------------------------------------------------------------------------------------------

var SuperError = require('super-error');

//----------------------------------------------------------------------------------------------------------------------

var NotImplementedError = SuperError.subclass('NotImplementedError', function(api)
{
    this.message = api + " not implemented.";
}); // end NotImplementedError

//----------------------------------------------------------------------------------------------------------------------

var DocumentNotFound = SuperError.subclass('DocumentNotFound', function(id)
{
    this.id = id;
    this.message = "Document with id '" + id + "' not found.";
}); // end DocumentNotFound

//----------------------------------------------------------------------------------------------------------------------

var ValidationError = SuperError.subclass('ValidationError', function(key, expectedType, message)
{
    this.key = key;
    this.expectedType = expectedType;
    this.message = message || "Key '" + key + "' is not of type '" + expectedType +"'.";
}); // end ValidationError

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    NotImplementedError: NotImplementedError,
    DocumentNotFound: DocumentNotFound,
    ValidationError: ValidationError
}; // end exports

//----------------------------------------------------------------------------------------------------------------------
