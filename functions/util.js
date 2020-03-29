var countryRegionData = require("react-country-region-selector");

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

// randomly select adjacent age bucket
exports.pickAgeBucket = age => {
    const option = Math.floor(Math.random() * 3);

    if ((numAge == 16) || numAge == 17) {
        if ((option == 0) || (option == 1)) return '16-17';
        else return '18-19';
    }
    else if ((numAge == 108) || numAge == 109) {
        if ((option == 0) || (option == 1)) return '108-109';
        else return '106-107';
    }
    else if (numAge % 2) {
        if (option == 0) return (numAge - 3) + '-' + (numAge - 2);
        else if (option == 1) return (numAge - 1) + '-' + numAge;
        else return (numAge + 1) + '-' + (numAge + 2);
    }
    else {
        if (option == 0) return (numAge - 2) + '-' + (numAge - 1);
        else if (option == 1) return numAge + '-' + (numAge + 1);
        else return (numAge + 2) + '-' + (numAge + 3);
    }
};

// select placement for questions
exports.pickPlacementBuckets = (questionMap, surveyAnswers) => {
    var placementBuckets = [];

    for (var i = 0; i < questionMap.length; i++) {
        const questions = questionMap[i];
        var sum = 0;

        for (var j = 0; j < questions.length; j++)
            sum += surveyAnswers[questions[j]];

        const average = sum / questions.length;
        if (average < 4) placementBuckets.push('0');
        else if (average > 6) placementBuckets.push('2');
        else placementBuckets.push('1');
    }
}