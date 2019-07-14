//----------------------------------------------------------------------------------------------------------------------
// Custom errors
//----------------------------------------------------------------------------------------------------------------------

const { BaseError } = require('make-error');

//----------------------------------------------------------------------------------------------------------------------

class TDBError extends BaseError
{
    constructor(message, code)
    {
        super(message);

        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;

        // Set a code property to allow the error to be easily identified. This is in keeping with current nodejs.
        this.code = code ? code : 'ERR_TDB_ERROR';
    } // end constructor

    toJSON()
    {
        return { name: this.name, message: this.message, code: this.code };
    } // end toJSON()
} // end DBError

//----------------------------------------------------------------------------------------------------------------------

class NotImplementedError extends TDBError
{
    constructor(api)
    {
        super(`'${ api }' is not implemented.`, 'TDB_NOT_IMPLEMENTED');
    } // end constructor
} // end NotImplemented Error

//----------------------------------------------------------------------------------------------------------------------

class DocumentNotFoundError extends TDBError
{
    constructor(doc)
    {
        super(`Document with id '${ doc }' not found.`, 'TDB_DOC_NOT_FOUND');
        this.doc = doc;
    } // end constructor
} // end DocumentNotFoundError

//----------------------------------------------------------------------------------------------------------------------

class UnsupportedInBrowserError extends TDBError
{
    constructor(operation)
    {
        super(`The '${ operation }' is not supported in a browser.`, 'TDB_IN_BROWSER');
        this.operation = operation;
    } // end constructor
} // end UnsupportedInBrowserError

//----------------------------------------------------------------------------------------------------------------------

class WriteDatabaseError extends TDBError
{
    constructor(error, path)
    {
        super(`Error writing database('${ path }'): ${ error }`, 'TDB_WRITE_DB');
        this.innerError = error;
        this.path = path;
    } // end constructor
} // end WriteDatabaseError

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    NotImplementedError,
    DocumentNotFoundError,
    UnsupportedInBrowserError,
    WriteDatabaseError
};

//----------------------------------------------------------------------------------------------------------------------
