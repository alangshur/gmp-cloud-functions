var countryRegionData = require("react-country-region-selector")

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

// validate country/region pair
exports.validateCountryRegion = (country, region) => {
    const data = countryRegionData.CountryRegionData;
    for (var i = 0; i < data.length; i++) {
        if (country === data[i][0]) {
            if (data[i][2].includes(region)) return true;
            else return false;
        }
    }

    return false;
}