//----------------------------------------------------------------------------------------------------------------------
// Models
//
// @module
//----------------------------------------------------------------------------------------------------------------------

import tdb from '../../../trivialdb';

//----------------------------------------------------------------------------------------------------------------------

// This could come from another source, like an `import` statement.
const userDict = {
    'foo@example.com': {
        name: "Foo User",
        age: 23,
        email: "foo@example.com"
    },
    'admin@example.com': {
        name: "Admin User",
        age: 47,
        admin: true,
        email: "admin@example.com"
    },
    'some.user@example.com': {
        name: "Some User",
        age: 21,
        email: "some.usern@example.com"
    },
    'admin2@example.com': {
        name: "Charles Xavier",
        age: 71,
        admin: true,
        email: "admin2@example.com"
    },
    'bar@example.com': {
        name: "Bar Bar",
        age: 31,
        email: "bar@example.com"
    }
};

//----------------------------------------------------------------------------------------------------------------------

const Users = tdb.db('users', {
    writeToDisk: false,
    pk: 'email',
    readFunc: () => Promise.resolve(userDict)
});

const Books = tdb.db('books', { writeToDisk: false });

//----------------------------------------------------------------------------------------------------------------------

export default {
    Users,
    Books
};

//----------------------------------------------------------------------------------------------------------------------
