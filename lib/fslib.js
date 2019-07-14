//----------------------------------------------------------------------------------------------------------------------
// fslib.js - A Library for handling file system operations.
//----------------------------------------------------------------------------------------------------------------------

const fs = require('fs');
const { dirname } = require('path');
const Promise = require('bluebird');

const mkdirp = Promise.promisify(require('mkdirp'));
const statAsync = Promise.promisify(fs.stat);
const writeFileAsync = Promise.promisify(fs.writeFile);
const readFileAsync = Promise.promisify(fs.readFile);

const { WriteDatabaseError } = require('./errors');

//----------------------------------------------------------------------------------------------------------------------

function readDB(path)
{
    return readFileAsync(path)
        .then((jsonStr) =>
        {
            try
            {
                return JSON.parse(jsonStr);
            }
            catch (ex)
            {
                // Wrap the exception in a more friendly one.
                const error = new Error('Failed to parse on disk json file.');
                error.code = 'ERR_JSON_PARSE';
                error.innerException = ex;

                // Throw the error
                throw error;
            } // end try/catch
        });
} // end readDB

function writeDB(path, jsonStr)
{
    const rootPath = dirname(path);
    return statAsync(rootPath)
        .then((stats) =>
        {
            if(!stats.isDirectory())
            {
                throw new WriteDatabaseError(`Root path ${ JSON.stringify(rootPath) } is not a directory!`, path);
            } // end if
        })
        .catch((error) => { return error.code === 'ENOENT'; }, () => mkdirp(rootPath))
        .then(() => writeFileAsync(path, jsonStr));
} // end writeDB

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    readDB,
    writeDB
}; // end exports

//----------------------------------------------------------------------------------------------------------------------
