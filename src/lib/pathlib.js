//----------------------------------------------------------------------------------------------------------------------
/// PathLib
///
/// @module
//----------------------------------------------------------------------------------------------------------------------

import path from 'path';

//----------------------------------------------------------------------------------------------------------------------

/**
 * Gets the absolute path to the root folder of the currently running node process, or the folder it was run from.
 *
 * @returns {String} The path to the root folder of the current node process
 */
function getRoot()
{
    return require.main ? path.dirname(require.main.filename) : process.cwd();
} // end getRoot

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    getRoot,
    join: path.join
};

//----------------------------------------------------------------------------------------------------------------------