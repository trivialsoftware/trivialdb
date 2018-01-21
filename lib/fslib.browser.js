//----------------------------------------------------------------------------------------------------------------------
// fs operations for the browser
//
// @module
//----------------------------------------------------------------------------------------------------------------------

const Promise = require('bluebird');

// Errors
const { UnsupportedInBrowserError } = require('./errors');

//----------------------------------------------------------------------------------------------------------------------

function readDB(path)
{
    return fetch(path)
        .then((data) => data.json())
        .catch((err) =>
        {
            const error = new Error(`Failed to fetch '${ path }'.`);
            error.innerException = err;
            error.code = 'ERR_FETCH';

            console.error(err);
            throw error;
        });
} // end readDB

function writeDB(path, jsonStr)
{
    return Promise.reject(new UnsupportedInBrowserError('writeDB()'));
} // end writeDB

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    readDB,
    writeDB
}; // end exports

//----------------------------------------------------------------------------------------------------------------------
