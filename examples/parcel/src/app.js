//----------------------------------------------------------------------------------------------------------------------
// TrivialDB Parcel Example App
//----------------------------------------------------------------------------------------------------------------------

import models from './models';

//----------------------------------------------------------------------------------------------------------------------
// Control the 'Users' box
//----------------------------------------------------------------------------------------------------------------------

function buildUsers()
{
    const userElems = models.Users.query()
        .map((user) =>
        {
            return `<li class="list-group-item">
                    <i class="fas fa-user"></i>
                    ${ user.name }${ user.admin ? ' <span class="badge badge-danger badge-pill float-right">Admin</span>' : '' }
                    </li>`;
        })
        .run();

    const userListElem = document.getElementById('user-list');
    userListElem.innerHTML = userElems.join('\n');
} // end buildUsers

// Initial Loading
models.Users.loading
    .then(() =>
    {
        // Simulate network latency
        setTimeout(buildUsers, 2000);
    });

//----------------------------------------------------------------------------------------------------------------------
// Control the 'Books' box
//----------------------------------------------------------------------------------------------------------------------

function filterBooks(filter)
{
    let moreBooks = false;

    const bookElems = models.Books.query()
        .filter((book) =>
        {
            return !filter || book.title.toLowerCase().includes(filter.toLowerCase());
        })
        .map((book) =>
        {
            return `<li class="list-group-item">
                        <div class="d-flex w-100 justify-content-between">
                            <h5 class="mb-1">${ book.title }</h5>
                            <small>${ book.year } ${ book.language }</small>
                        </div>
                        <div class="d-flex">
                            <img  src="https://raw.githubusercontent.com/benoitvallon/100-best-books/master/static/${ book.imageLink }" alt="${ book.title }" height="48px" width="48px" class="rounded-circle">
                            <div class="ml-2">
                                Author: ${ book.author }
                                <br/>
                                Country: ${ book.country }
                            </div>
                        </div>
                    </li>`;
        })
        .sortBy('id')
        .run();

    // Limit the total possible books
    if(bookElems.length > 5)
    {
        moreBooks = true;
        bookElems.length = 5;
    } // end if

    // Write the list elements
    const bookListElem = document.getElementById('book-list');
    bookListElem.innerHTML = bookElems.join('\n');

    // Find the footer
    const moreBooksElem = document.getElementById('more-books');
    if(moreBooks)
    {
        moreBooksElem.classList.remove('d-none');
    }
    else
    {
        moreBooksElem.classList.add('d-none');
    } // end if
    // end if
} // end filterBooks

// Event handler
window.onUsersReload = function(event)
{
    event.stopPropagation();
    event.preventDefault();

    const userListElem = document.getElementById('user-list');
    userListElem.innerHTML = `
        <li class="list-group-item text-center">
            <h4>Loading...</h4>
            <div class="progress">
                <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
            </div>
        </li>
    `;

    models.Users.reload()
        .then(() =>
        {
            // Simulate network latency
            setTimeout(buildUsers, 2000);
        });
};

// Event handler
window.onTitleFilter = function(event)
{
    event.stopPropagation();
    const titleFilter = document.getElementById('titleFilter').value;

    filterBooks(titleFilter);
};

// Initial Loading
models.Books.loading
    .then(() =>
    {
        filterBooks();
    });

//----------------------------------------------------------------------------------------------------------------------
