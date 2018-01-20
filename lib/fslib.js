//----------------------------------------------------------------------------------------------------------------------
// fslib.js - Brief description for fslib.js module.
//
// @module
//----------------------------------------------------------------------------------------------------------------------

const Promise = require('bluebird');

// Errors
const { UnsupportedInBrowserError } = require('./errors');

//----------------------------------------------------------------------------------------------------------------------

let mkdirp, statAsync, writeFileAsync, readFileAsync, dirname;

if(!process.browser)
{
    const fs = require('fs');
    const path = require('path');

    // Alias
    dirname = path.dirname;

    // Promisify functions
    mkdirp = Promise.promisify(require('mkdirp'));
    statAsync = Promise.promisify(fs.stat);
    writeFileAsync = Promise.promisify(fs.writeFile);
    readFileAsync = Promise.promisify(fs.readFile);
} // end if

//----------------------------------------------------------------------------------------------------------------------

function readDB(path)
{
    if(process.browser)
    {
        return Promise.reject(new UnsupportedInBrowserError('readDB()'));
    }
    else
    {
        return readFileAsync(path)
            .then((jsonStr) =>
            {
                try
                {
                    return JSON.parse(jsonStr);
                }
                catch(ex)
                {
                    // Wrap the exception in a more friendly one.
                    const error = new Error("Failed to parse on disk json file.");
                    error.code = 'ERR_JSON_PARSE';
                    error.innerException = ex;

                    // Throw the error
                    throw error;
                } // end try/catch
            });
    } // end if
} // end readDB

function writeDB(path, jsonStr)
{
    if(process.browser)
    {
        return Promise.reject(new UnsupportedInBrowserError('readDB()'));
    }
    else
    {
        const rootPath = dirname(path);
        return statAsync(rootPath)
            .then((stats) =>
            {
                if(!stats.isDirectory())
                {
                    throw new WriteDatabaseError("Root path " + JSON.stringify(rootPath) + " is not a directory!", path);
                } // end if
            })
            .catch((error) => { return error.code === 'ENOENT'; }, () => mkdirp(rootPath))
            .then(() => writeFileAsync(path, jsonStr));
    } // end if
} // end writeDB

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    readDB,
    writeDB
}; // end exports

//----------------------------------------------------------------------------------------------------------------------
