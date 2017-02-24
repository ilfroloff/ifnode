'use strict';

/**
 *
 * @param {Array.<*>}   array
 * @param {Function}    iterator
 * @param {Function}    finish
 */
function eachSeries(array, iterator, finish) {
    if(!(Array.isArray(array) && array.length)) {
        return;
    }

    var i = 0,
        length = array.length,

        next = function() {
            if(i < length) {
                return iterator(array[i++], next, function interrupt() {
                    i = length;
                    next();
                });
            } else {
                finish();
            }
        };

    next();
}

module.exports = eachSeries;
