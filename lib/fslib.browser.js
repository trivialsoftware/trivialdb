//----------------------------------------------------------------------------------------------------------------------
// fs operations for the browser
//----------------------------------------------------------------------------------------------------------------------

/* global fetch */

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
    return fetch(path, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: jsonStr
    })
        .then((data) => data.json())
        .catch((err) =>
        {
            const error = new Error(`Failed to post to '${ path }'.`);
            error.innerException = err;
            error.code = 'ERR_POST';

            console.error(err);
            throw error;
        });
} // end writeDB

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    readDB,
    writeDB
}; // end exports

//----------------------------------------------------------------------------------------------------------------------
