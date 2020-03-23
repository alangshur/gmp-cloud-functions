
// get start day of next matching (deadline)
exports.getNextMatchingDate = () => {
    var now = new Date();    
    now.setUTCDate(now.getUTCDate() + (12 - now.getUTCDay()) % 7);
    return (now.getUTCMonth() + 1) + '-' + now.getUTCDate() + '-' + now.getUTCFullYear();
}

// get start day of last matching (deadline)
exports.getCurrentMatchingDate = () => {
    var now = new Date();
    now.setUTCDate(now.getUTCDate() + (12 - now.getUTCDay()) % 7 - 7);
    return (now.getUTCMonth() + 1) + '-' + now.getUTCDate() + '-' + now.getUTCFullYear();
}