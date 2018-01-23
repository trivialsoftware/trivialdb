//----------------------------------------------------------------------------------------------------------------------
// Models
//
// @module
//----------------------------------------------------------------------------------------------------------------------

import tdb from '../../../trivialdb';

//----------------------------------------------------------------------------------------------------------------------

const Users = tdb.db('users', {
    writeToDisk: false,
    loadFromDisk: true,
    pk: 'email',
    readFunc: (path) =>
    {
        return Promise.resolve({
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
        });
    }
});

const Books = tdb.db('books', {});

//----------------------------------------------------------------------------------------------------------------------

export default {
    Users,
    Books
};

//----------------------------------------------------------------------------------------------------------------------
