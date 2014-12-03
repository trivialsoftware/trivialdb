//----------------------------------------------------------------------------------------------------------------------
// Custom errors
//
// @module error.js
//----------------------------------------------------------------------------------------------------------------------

function NotImplementedError(api)
{
    this.name = "NotImplementedError";
    this.message = api + " not implemented.";
} // end NotImplementedError
NotImplementedError.prototype = Error.prototype;

//----------------------------------------------------------------------------------------------------------------------

function ValidationError(key, expectedType)
{
    this.name = "ValidationError";
    this.key = key;
    this.expectedType = expectedType;
    this.message = "Key '" + key + "' is not of type '" + expectedType +"'.";
} // end ValidationError
ValidationError.prototype = Error.prototype;

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    NotImplementedError: NotImplementedError,
    ValidationError: ValidationError
}; // end exports

//----------------------------------------------------------------------------------------------------------------------