//----------------------------------------------------------------------------------------------------------------------
// Custom errors
//
// @module error.js
//----------------------------------------------------------------------------------------------------------------------

var SuperError = require('super-error');

//----------------------------------------------------------------------------------------------------------------------

SuperError.subclass(exports, 'NotImplementedError', function(api)
{
    this.message = api + " not implemented.";
}); // end NotImplementedError

//----------------------------------------------------------------------------------------------------------------------

SuperError.subclass(exports, 'DocumentNotFound', function(id)
{
    this.id = id;
    this.message = "Document with id '" + id + "' not found.";
}); // end DocumentNotFound

//----------------------------------------------------------------------------------------------------------------------

SuperError.subclass(exports, 'ValidationError', function(key, expectedType, message)
{
    this.key = key;
    this.expectedType = expectedType;
    this.message = message || "Key '" + key + "' is not of type '" + expectedType +"'.";
}); // end ValidationError

//----------------------------------------------------------------------------------------------------------------------

SuperError.subclass(exports, 'WriteError', function(message)
{
    this.message = "Error writing database: " + message;
}); // end WriteError

//----------------------------------------------------------------------------------------------------------------------
