//----------------------------------------------------------------------------------------------------------------------
// PathLib
//----------------------------------------------------------------------------------------------------------------------

const path = require('path');

//----------------------------------------------------------------------------------------------------------------------

/**
 * Gets the absolute path to the root folder of the currently running node process, or the folder it was run from. If
 * running in a browser, we simple return `'/'`, as that is always the root of a website.
 *
 * @returns {string} The path to the root folder of the current node process.
 */
function getRoot()
{
    if(process.browser)
    {
        return '/';
    }
    else
    {
        return require.main ? path.dirname(require.main.filename) : process.cwd();
    } // end if
} // end getRoot

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    getRoot,
    join: path.join
};

//----------------------------------------------------------------------------------------------------------------------
