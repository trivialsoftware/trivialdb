//----------------------------------------------------------------------------------------------------------------------
// Custom errors
//
// @module error.js
//----------------------------------------------------------------------------------------------------------------------

import { BaseError } from 'make-error';

//----------------------------------------------------------------------------------------------------------------------

class NotImplementedError extends BaseError
{
    constructor(api)
    {
        super(`'${api}' is not implemented.`);
    } // end constructor
} // end NotImplemented Error

//----------------------------------------------------------------------------------------------------------------------

class DocumentNotFoundError extends BaseError
{
    constructor(doc)
    {
        super(`Document with id '${doc}' not found.`);
        this.doc = doc;
    } // end constructor
} // end DocumentNotFoundError

//----------------------------------------------------------------------------------------------------------------------

class WriteDatabaseError extends BaseError
{
    constructor(error, path)
    {
        super(`Error writing database('${ path }'): ${error}`);
        this.innerError = error;
        this.path = path;
    } // end constructor
} // end WriteDatabaseError

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    NotImplemented: NotImplementedError,
    DocumentNotFound: DocumentNotFoundError,
    WriteDatabase: WriteDatabaseError
};

//----------------------------------------------------------------------------------------------------------------------
